// revoke-user-sessions
// ------------------------------------------------------------
// Hard part of an admin "Block": immediately revoke a user's Supabase
// sessions (refresh tokens) so they're kicked out within seconds instead
// of lingering until their JWT expires. The DB status change itself is
// done by the set_account_status RPC from the client; this function only
// performs the token revocation. Admin-only.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is an authenticated admin.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerRole?.role !== "admin") return json({ error: "Forbidden: admins only" }, 403);

    let payload: { user_id?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid request body." }, 400);
    }

    const targetId = payload.user_id;
    if (!targetId) return json({ error: "user_id is required." }, 400);
    if (targetId === user.id) return json({ error: "You cannot revoke your own sessions." }, 400);

    const { error: signOutErr } = await admin.auth.admin.signOut(targetId, "global");
    if (signOutErr) return json({ error: signOutErr.message }, 500);

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Unexpected error." }, 500);
  }
});
