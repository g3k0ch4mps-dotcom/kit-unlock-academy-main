// register-with-key
// ------------------------------------------------------------
// The ONLY door for new accounts (public sign-up is disabled in the
// Supabase Auth settings). Requires a valid unlock/access key:
//   1. validate the key (exists, not expired, uses left)
//   2. admin.createUser (email pre-confirmed -> can log in immediately)
//   3. redeem the key for the new user (activates account + grants access)
//   4. on any redeem failure, delete the just-created user (no orphans)
//
// No Authorization header is required (the caller has no account yet);
// the key itself is the credential.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Maps redeem_unlock_code_for error codes to human messages.
const REDEEM_ERRORS: Record<string, string> = {
  not_found: "That access key is not valid.",
  expired: "That access key has expired.",
  already_redeemed: "That access key has already been used by this account.",
  used_up: "That access key has reached its usage limit.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let payload: { code?: string; email?: string; password?: string; full_name?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const code = (payload.code ?? "").trim();
    const email = (payload.email ?? "").trim().toLowerCase();
    const password = payload.password ?? "";
    const fullName = (payload.full_name ?? "").trim();

    if (!code) return json({ error: "An access key is required." }, 400);
    if (!email) return json({ error: "Email is required." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fail fast on an obviously bad key before creating any account.
    const { data: codeRow, error: codeErr } = await admin
      .from("unlock_codes")
      .select("id, expires_at, max_uses, uses_count")
      .eq("code", code)
      .maybeSingle();

    if (codeErr) return json({ error: "Could not validate the access key." }, 500);
    if (!codeRow) return json({ error: REDEEM_ERRORS.not_found }, 400);
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      return json({ error: REDEEM_ERRORS.expired }, 400);
    }
    if (codeRow.max_uses != null && codeRow.uses_count >= codeRow.max_uses) {
      return json({ error: REDEEM_ERRORS.used_up }, 400);
    }

    // 2. Create the account (email confirmed so they can sign in right away).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email },
    });

    if (createErr || !created?.user) {
      const msg = /already.*registered|exists/i.test(createErr?.message ?? "")
        ? "An account with this email already exists. Please sign in instead."
        : (createErr?.message ?? "Could not create the account.");
      return json({ error: msg }, 400);
    }

    const uid = created.user.id;

    // 3. Redeem the key for the new user (locks the code row -> race-safe).
    const { data: redeem, error: redeemErr } = await admin.rpc("redeem_unlock_code_for", {
      p_code: code,
      p_user_id: uid,
    });

    const ok = !redeemErr && (redeem as { ok?: boolean })?.ok === true;
    if (!ok) {
      // 4. Roll back the account so a failed redeem leaves nothing behind.
      await admin.auth.admin.deleteUser(uid);
      const errCode = (redeem as { error?: string })?.error;
      const msg = (errCode && REDEEM_ERRORS[errCode]) || "Could not redeem the access key.";
      return json({ error: msg }, 400);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Unexpected error." }, 500);
  }
});
