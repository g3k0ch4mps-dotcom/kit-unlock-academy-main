# Security Audit — What's Broken and How to Fix It

## Critical (Fix These First)

### C1: Anyone can call the image generator (no login required)

**What's wrong:**  
The `generate-content-image` function in Supabase can be called by *anyone on the internet*. There is zero authentication — no check for a logged-in user, no JWT token verification. An attacker could:

- Drain your Lovable AI credit budget by spamming image requests
- Upload random files to your Supabase storage using the admin key

**Why it matters:** This costs you real money and fills your storage with garbage.

**Fix it:**  
Open `supabase/functions/generate-content-image/index.ts`. At the top of the `serve()` handler, add the same JWT verification pattern used in `personalize-content/index.ts` (lines 18-32):

```ts
const authHeader = req.headers.get("Authorization");
if (!authHeader) return new Response("Unauthorized", { status: 401 });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
if (userError || !user) return new Response("Unauthorized", { status: 401 });
```

Then delete the old `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` reads and replace them with the new ones that have `!` assertions.

### C2: No rate limiting — attackers can hammer your auth endpoints

**What's wrong:**  
There is no limit on how many times someone can try to log in, sign up, reset a password, or redeem a code. An attacker could:

- Try thousands of passwords against any email (brute-force login)
- Flood a user's inbox with password reset emails
- Try random unlock codes until one works

**Why it matters:** Accounts can be compromised. Your email sending costs can explode.

**Fix it:**  
Option A (Supabase built-in): Go to Supabase Dashboard → Authentication → Settings and enable **Rate Limiting**. Supabase Auth has built-in protection for login/signup.

Option B (client-side throttle): In `src/contexts/AuthContext.tsx`, add a simple in-memory throttle to `signIn`, `signUp`, and the password reset function:

```ts
const loginAttempts = new Map<string, { count: number; last: number }>();
const THROTTLE_MAX = 5;
const THROTTLE_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkThrottle(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now - entry.last > THROTTLE_WINDOW) {
    loginAttempts.set(email, { count: 1, last: now });
    return true;
  }
  if (entry.count >= THROTTLE_MAX) return false;
  entry.count++;
  entry.last = now;
  return true;
}
```

Call `checkThrottle(email)` before each auth operation and return an error if blocked.

### C3: The master setup.sql file has the old insecure unlock_codes policy

**What's wrong:**  
The file `supabase/setup.sql` (line 369) still has the old policy:
```sql
USING (true) WITH CHECK (true)
```
This lets ANY logged-in user modify ANY unlock code. The fix exists in `migrations/20260522000004_fix_unlock_codes_policy.sql` but `setup.sql` was never updated.

**Why it matters:** If you ever re-run `setup.sql` on a fresh database, you get the insecure version.

**Fix it:**  
Open `supabase/setup.sql`, find line 369, and replace:
```sql
CREATE POLICY "Users can redeem codes" ON public.unlock_codes 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```
with:
```sql
CREATE POLICY "Users can redeem codes" ON public.unlock_codes
  FOR UPDATE TO authenticated
  USING (is_used = false)
  WITH CHECK (is_used = true AND redeemed_by = auth.uid());
```

Also protect the other columns — create a `SECURITY DEFINER` RPC function `redeem_code` that atomically checks and marks a code as used. This prevents race conditions and column tampering.

---

## High Priority

### H1: Missing HSTS header

**What's wrong:** When someone visits your site over HTTP first (before HTTPS), there's nothing telling their browser to always use HTTPS. This makes SSL-stripping attacks possible.

**Fix it:**  
Open `public/_headers`. After the existing headers, add:
```
Strict-Transport-Security: max-age=315400000; includeSubDomains; preload
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### H2: Edge functions have wildcard CORS (`Access-Control-Allow-Origin: *`)

**What's wrong:** All 4 Supabase Edge Functions allow requests from ANY website. This means if a user visits a malicious site, that site can make authenticated requests to your functions (since the browser sends cookies/tokens automatically).

**Fix it:**  
In each of the 4 files in `supabase/functions/`, find:
```ts
"Access-Control-Allow-Origin": "*",
```
Replace with:
```ts
"Access-Control-Allow-Origin": "https://mokabittechnologies.co.ke",
```

### H3: Storage bucket insert policy has no auth check

**What's wrong:** The `certificates` storage bucket allows anyone to upload files. The policy only checks the bucket name, not who the user is.

**Fix it:**  
In `supabase/setup.sql` line 497, change:
```sql
CREATE POLICY "System can upload certificates" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'certificates');
```
to:
```sql
CREATE POLICY "System can upload certificates" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'certificates' 
    AND auth.role() = 'service_role'
  );
```

### H4: Simulation URLs can point anywhere

**What's wrong:** The `SimulationEmbed` component in `src/components/content/SimulationEmbed.tsx` checks if a URL contains "wokwi.com" or "tinkercad.com" using `.includes()`. This is trivially bypassed — `evil-wokwi.com` would pass the check. An attacker could embed a phishing page or malicious site in an iframe.

**Fix it:**  
Use proper URL parsing to check the hostname:
```ts
const getEmbedUrl = (inputUrl: string): string => {
  try {
    const parsed = new URL(inputUrl);
    const allowedHosts = ["wokwi.com", "www.wokwi.com", "tinkercad.com", "www.tinkercad.com"];
    if (!allowedHosts.includes(parsed.hostname)) {
      console.warn("Blocked simulation URL:", inputUrl);
      return "";
    }
    // ... rest of the logic
  } catch {
    return "";
  }
};
```

Also handle the empty URL case in the render:
```tsx
{embedUrl ? (
  <iframe src={embedUrl} ... />
) : (
  <p>Simulation unavailable</p>
)}
```

### H5: Content block images from DB not validated

**What's wrong:** `ContentBlockRenderer.tsx` renders `block.image_url` directly as an `<img>` src. If an attacker (or compromised admin) stores a `javascript:` URI or a malicious URL, it could execute code.

**Fix it:**  
Add validation before rendering:
```ts
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};
```

Use it:
```tsx
{block.image_url && isValidImageUrl(block.image_url) && (
  <img src={block.image_url} ... />
)}
```

---

## Medium Priority

### M1: Missing Permissions-Policy header
**Fix:** Add to `public/_headers` (already included in H1 fix above).

### M2: Vite dev server exposed to network
**Fix:** In `vite.config.ts`, change `host: "::"` to `host: "localhost"`.

### M3: Edge functions leak error details
**Fix:** In all 4 function catch blocks, return `{ error: "Internal server error" }` to clients. Log the real error server-side.

### M4: Password reset token visible in URL
**Fix:** After extracting the token from the URL hash in `src/pages/ResetPassword.tsx:20-33`, add:
```ts
window.history.replaceState({}, "", window.location.pathname);
```

### M5: Unlock codes are enumerable
**Fix:** In `supabase/setup.sql`, restrict the SELECT policy on `unlock_codes`:
```sql
CREATE POLICY "Users can look up their own codes" ON public.unlock_codes
  FOR SELECT TO authenticated
  USING (redeemed_by = auth.uid());
```

### M6: Missing `TO authenticated` qualifier
**Fix:** In `supabase/setup.sql` lines 426, 432, and the migration file — add `TO authenticated` after `FOR INSERT`.

### M7: No input validation library
**Fix:** Not critical — Supabase SDK parameterizes queries. Optional: install Zod and add schemas to form pages.

### M8: User-controlled file extensions
**Fix:** In `ContentBlockDialog.tsx:145` and `RichTextEditor.tsx:82`, replace:
```ts
const fileExt = file.name.split('.').pop();
```
with:
```ts
const allowedExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"];
const fileExt = (file.name.split('.').pop() || "").toLowerCase();
if (!allowedExtensions.includes(fileExt)) throw new Error("File type not allowed");
```

### M9: Admin checks are client-side only
**Fix:** Already mitigated — edge functions and RLS enforce admin checks server-side. No code change needed, but note that the client-side check is a convenience, not a security boundary.

---

## Low Priority

| # | Issue | Fix |
|---|-------|-----|
| L1 | CSP uses `'unsafe-inline'` for styles | Acceptable with shadcn/ui — low risk |
| L2 | No CSP reporting endpoint | Add `report-uri /api/csp-report` — optional |
| L3 | No `.env.example` file | Create one with placeholder values |
| L4 | Missing FK constraints on `test_attempts.user_id` and `certificates.user_id` | Add `REFERENCES auth.users(id) ON DELETE CASCADE` to both tables |
