-- ============================================================
-- MIGRATION 9: user_devices table (device fingerprint tracking)
-- ============================================================

CREATE TABLE public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fingerprint TEXT NOT NULL,
  device_label TEXT DEFAULT 'Unknown device',
  ip_address TEXT,
  last_sign_in_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  sign_in_count INTEGER DEFAULT 1,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_fingerprint ON public.user_devices(fingerprint);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.user_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.user_devices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.user_devices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all devices" ON public.user_devices
  FOR SELECT TO authenticated USING (public.is_admin_or_instructor(auth.uid()));

CREATE POLICY "Admins can revoke devices" ON public.user_devices
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
