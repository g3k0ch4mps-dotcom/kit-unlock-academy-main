-- ============================================================
-- Migration: Role Management Improvements
-- 1. Fix handle_new_user trigger (idempotent for OAuth re-logins)
-- 2. Backfill any auth.users missing a profile or role
-- 3. Enforce one role per user (drop multi-role constraint)
-- 4. Add set_user_role RPC (admin-only)
-- 5. Add claim_first_admin RPC (bootstrap when no admins exist)
-- ============================================================

-- 1. Make the new-user trigger idempotent so OAuth re-logins don't break
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'learner')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Backfill any existing auth users who are missing a profile or role
-- (catches users who signed up before the trigger was applied, or via OAuth)
INSERT INTO public.profiles (user_id, email, full_name)
SELECT
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    au.email
  )
FROM auth.users au
WHERE au.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = au.id)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'learner'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = au.id)
ON CONFLICT DO NOTHING;

-- 3. Enforce exactly one role per user
-- First, deduplicate: for users with multiple roles, keep the most privileged one
WITH ranked AS (
  SELECT
    id,
    user_id,
    role,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE role
          WHEN 'admin'      THEN 1
          WHEN 'instructor' THEN 2
          WHEN 'learner'    THEN 3
        END
    ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Drop the old (user_id, role) unique constraint and add (user_id) only
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- 4. set_user_role: atomically replace a user's role (admin-only)
CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user_id UUID,
  new_role       app_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  -- Only admins may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can set user roles';
  END IF;

  -- Prevent demoting yourself if you are the last admin
  IF target_user_id = auth.uid() AND new_role <> 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.user_roles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the only admin account';
    END IF;
  END IF;

  -- Replace role atomically
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, new_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, created_at = now();
END;
$$;

-- 5. claim_first_admin: bootstrap the very first admin (no admins must exist)
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';

  -- If admins already exist, refuse
  IF admin_count > 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin', created_at = now();

  RETURN TRUE;
END;
$$;
