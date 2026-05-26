# System audit report

**Generated:** 2026-05-22
**System:** Kit Unlock Academy — STEM Learning LMS (Mamuza Engineering)
**Audited by:** opencode/big-pickle
**Audit scope:** Performance, Security, UX, Code Quality, Scalability

---

## Executive summary

- **Overall health score:** 5.5 / 10
- **Total findings:** 27
- **Critical:** 5 | **High:** 8 | **Medium:** 9 | **Low:** 5
- **Top 3 issues requiring immediate action:**
  1. `generate-certificate` edge function has no JWT auth — anyone with the URL can forge certificates for any user using the SERVICE_ROLE key
  2. `reset_session_xp` RPC is `SECURITY DEFINER` with no caller check — any authenticated user can destroy any other user's XP data
  3. N+1 query pattern in Dashboard (1 + 3N DB calls per render) combined with zero caching and only 6 explicit indexes for 26 tables

---

## Findings

---

### FINDING-001: No JWT auth check in generate-certificate edge function

| Field        | Value |
|--------------|-------|
| ID           | FINDING-001 |
| Domain       | Security |
| Severity     | CRITICAL |
| OWASP ref    | A01 — Broken Access Control |
| CWE ref      | CWE-862: Missing Authorization |
| Location     | `supabase/functions/generate-certificate/index.ts:9-19` |
| Status       | Open |

**Description**
The `generate-certificate` edge function accepts `userId`, `programId`, `score`, and `certificateType` from anyone who can reach the endpoint. It creates a Supabase client using the `SUPABASE_SERVICE_ROLE_KEY` (full admin privileges) without verifying the caller's identity. There is no JWT extraction, no `auth.uid()` check, and no admin-role verification before generating certificates, uploading to storage, and inserting database records.

**Attack vector / impact**
Any user who discovers or guesses the edge function URL (or can trigger it via the client bundle) can forge a certificate for any `userId` with any `score`. The certificate will be uploaded to the public `certificates` storage bucket, inserting a forged record into the `certificates` table. This enables certificate fraud, credential inflation, and social engineering attacks using fake Mamuza Engineering credentials.

**Evidence**
```typescript
// supabase/functions/generate-certificate/index.ts:9-19
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { testAttemptId, userId, programId, kitId, score, certificateType } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    // No auth check — proceeds to generate certificate for any userId
```

**Recommendation**
Add JWT verification at the top of the handler. Extract the Bearer token from the `Authorization` header, verify it with `supabase.auth.getUser(token)`, and reject if the token's `user.id` does not match the requested `userId` (unless the caller is an admin). Example:

```typescript
const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "");
const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
if (authError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
if (user.id !== userId && !isAdmin(user.id)) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
}
```

**Estimated effort:** S
**Estimated impact:** Critical

---

### FINDING-002: No caller check in reset_session_xp SECURITY DEFINER RPC

| Field        | Value |
|--------------|-------|
| ID           | FINDING-002 |
| Domain       | Security |
| Severity     | CRITICAL |
| OWASP ref    | A01 — Broken Access Control |
| CWE ref      | CWE-862: Missing Authorization |
| Location     | `supabase/migrations/20260514000003_add_reset_session_xp_function.sql:4-59` |
| Status       | Open |

**Description**
The `reset_session_xp` RPC function is declared with `SECURITY DEFINER`, meaning it executes with the privileges of the database owner (bypassing RLS). The function accepts `p_user_id` and `p_session_id` and deletes XP transactions for that user + session. There is zero verification that the caller is authorized — no check that the caller is the user themselves or an admin/instructor.

**Attack vector / impact**
Any authenticated user can call `supabase.rpc("reset_session_xp", { p_user_id: "<any-uuid>", p_session_id: "<any-uuid>" })` and destroy another user's XP history. This allows griefing, competitive sabotage, and data loss for any learner's gamification progress. No rate limiting or audit logging exists for this operation.

**Evidence**
```sql
-- supabase/migrations/20260514000003_add_reset_session_xp_function.sql:4-59
CREATE OR REPLACE FUNCTION public.reset_session_xp(
  p_user_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- executes as DB owner, bypasses RLS
SET search_path = public
AS $$
BEGIN
  -- Deletes XP for ANY user_id — no caller check
  DELETE FROM public.xp_transactions
  WHERE user_id = p_user_id
    AND reference_type = 'session'
    AND reference_id = p_session_id;
  -- ... continues to delete more data and recalculate ...
```

**Recommendation**
Add a caller authorization check at the top of the function. Use the `auth.uid()` function (available because the function is called via RPC over the authenticated PostgREST API):

```sql
BEGIN
  IF auth.uid() != p_user_id AND NOT public.is_admin_or_instructor(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: you can only reset your own XP or must be an admin';
  END IF;
  -- ... rest of function ...
```

**Estimated effort:** S
**Estimated impact:** Critical

---

### FINDING-003: N+1 query pattern in Dashboard fetchEnrolledPrograms

| Field        | Value |
|--------------|-------|
| ID           | FINDING-003 |
| Domain       | Performance |
| Severity     | CRITICAL |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/pages/Dashboard.tsx:87-167` |
| Status       | Open |

**Description**
The `fetchEnrolledPrograms` function first queries `user_program_access` (1 query), then for each enrolled program (N programs) makes 3 additional queries: one for total session count, one to fetch session IDs for the program, and one for completed session count. For 10 enrolled programs, this results in 1 + (3 × 10) = 31 sequential database round-trips. The `Promise.all` on line 115 only parallelizes within a single page load — data is never cached.

**Attack vector / impact**
Page load time scales linearly with enrollment count, causing multi-second blank-loading states for users with 10+ programs. This generates unnecessary database load and increases Supabase connection pool pressure. The repeated pattern in `ProgramView` (FINDING-011) and `SessionView` (FINDING-010) compounds the problem across the entire application.

**Evidence**
```typescript
// src/pages/Dashboard.tsx:115-158
const programsWithProgress = await Promise.all(
  (accessData || []).map(async (access: any) => {
    // Query 1 per program: count sessions
    const { count: totalSessions } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("program_id", access.program_id);
    // Query 2 per program: fetch session IDs
    const sessionIds = (await supabase
      .from("sessions")
      .select("id")
      .eq("program_id", access.program_id)
    ).data?.map(s => s.id) || [];
    // Query 3 per program: count completed
    const { count: completedSessions } = await supabase
      .from("session_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("completed", true)
      .in("session_id", sessionIds);
  })
);
```

**Recommendation**
Replace the per-program queries with a single batched SQL query using Supabase's `select()` with nested counts, or create a Postgres view / SECURITY DEFINER function that returns enrolled programs with session counts in one round-trip. Alternatively, pre-compute and cache progress counts in `user_program_access` or a dedicated materialized view.

**Estimated effort:** M
**Estimated impact:** Critical

---

### FINDING-004: Only 6 explicit indexes for 26 tables

| Field        | Value |
|--------------|-------|
| ID           | FINDING-004 |
| Domain       | Scalability |
| Severity     | CRITICAL |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `supabase/setup.sql` (throughout) |
| Status       | Open |

**Description**
The database schema contains 26 tables but only 6 explicit `CREATE INDEX` statements:
- `idx_user_devices_user_id`
- `idx_user_devices_fingerprint`
- `idx_xp_transactions_user_id`
- `idx_xp_transactions_created_at`
- `idx_daily_logins_user_id`
- `idx_redemptions_user_id`

Missing indexes exist on commonly queried foreign keys and filter columns: `sessions(program_id, session_order)`, `content_blocks(session_id)`, `test_attempts(user_id)`, `certificates(user_id)`, `user_program_access(user_id)`, `session_progress(user_id, session_id)`, `xp_transactions(reference_type, reference_id)`, and more.

**Attack vector / impact**
As user count and content scale past 1,000+ rows in these tables, every sequential-scan query becomes a performance bottleneck. Dashboard page loads that require filtered queries on unindexed columns will degrade from sub-100ms to multi-second response times. The N+1 problem (FINDING-003) is amplified because each individual query also scans.

**Evidence**
```
$ grep -c "CREATE INDEX" supabase/setup.sql
6
$ grep -c "CREATE TABLE" supabase/setup.sql
26
```

The six indexes cover only: `user_devices` (2), `xp_transactions` (2), `daily_logins` (1), `redemptions` (1). Tables with zero explicit indexes include: `sessions`, `content_blocks`, `session_progress`, `user_program_access`, `test_attempts`, `certificates`, `session_quiz_attempts`, `profiles`, `user_assessments`, `personalized_content`.

**Recommendation**
Add the following composite indexes (as a single migration):

```sql
CREATE INDEX idx_sessions_program_order ON public.sessions(program_id, session_order);
CREATE INDEX idx_content_blocks_session ON public.content_blocks(session_id, block_order);
CREATE INDEX idx_session_progress_user_session ON public.session_progress(user_id, session_id);
CREATE INDEX idx_user_program_access_user ON public.user_program_access(user_id);
CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id);
CREATE INDEX idx_certificates_user ON public.certificates(user_id);
CREATE INDEX idx_certificates_number ON public.certificates(certificate_number);
CREATE INDEX idx_xp_transactions_ref ON public.xp_transactions(reference_type, reference_id);
CREATE INDEX idx_unlock_codes_code ON public.unlock_codes(code);
CREATE INDEX idx_session_quiz_attempts_user_session ON public.session_quiz_attempts(user_id, session_id);
```

**Estimated effort:** S
**Estimated impact:** Critical

---

### FINDING-005: session_quiz_attempts duplicates questions JSONB per attempt

| Field        | Value |
|--------------|-------|
| ID           | FINDING-005 |
| Domain       | Scalability |
| Severity     | CRITICAL |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `supabase/setup.sql:311-323` |
| Status       | Open |

**Description**
The `session_quiz_attempts` table stores a full copy of the `questions` JSONB array on every attempt (line 316: `questions JSONB NOT NULL DEFAULT '[]'::jsonb`). The same set of questions already lives in `session_quizzes.questions`. For a session with 10 questions, each attempt duplicates ~5-10 KB of question data. After 1,000 attempts on the same session, this wastes 5-10 MB of storage and increases query payload size for every history lookup.

**Attack vector / impact**
Storage grows quadratically with usage — each new attempt copies the same question set. This is not a security issue, but at scale (10,000+ attempts) it wastes gigabytes of unnecessary storage and slows down queries that need to read attempt history. Migration to remove the column will require data migration scripts.

**Evidence**
```sql
-- supabase/setup.sql:311-323
CREATE TABLE public.session_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.sessions(id),
  program_id UUID NOT NULL REFERENCES public.programs(id),
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,  -- DUPLICATED: same data as session_quizzes.questions
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
```

**Recommendation**
Remove the `questions` column from `session_quiz_attempts`. Reference `session_quizzes.questions` via the `session_id` foreign key instead. This requires updating any client code that reads `attempt.questions` to join with `session_quizzes` or store only `answers` and `score` on the attempt.

```sql
ALTER TABLE public.session_quiz_attempts DROP COLUMN questions;
```

**Estimated effort:** M
**Estimated impact:** Critical

---

### FINDING-006: No auth check in generate-learning-content edge function

| Field        | Value |
|--------------|-------|
| ID           | FINDING-006 |
| Domain       | Security |
| Severity     | HIGH |
| OWASP ref    | A01 — Broken Access Control |
| CWE ref      | CWE-306: Missing Authentication for Critical Function |
| Location     | `supabase/functions/generate-learning-content/index.ts:8-14` |
| Status       | Open |

**Description**
The `generate-learning-content` edge function accepts `kitName`, `kitCategory`, `inputContent`, `uploadedFiles`, and `userInstructions` from any HTTP request without verifying the caller's identity. It uses the `LOVABLE_API_KEY` server environment variable to make AI generation calls via the Lovable AI gateway. Each call consumes AI credits tied to the Mamuza Engineering account.

**Attack vector / impact**
An attacker who discovers the function URL can exhaust the AI credit budget by sending unlimited generation requests. While this function does not access the database directly, it consumes billable AI resources and can be used for denial-of-wallet attacks. The function also accepts arbitrary `uploadedFiles` content which passes through to the AI gateway without sanitization.

**Evidence**
```typescript
// supabase/functions/generate-learning-content/index.ts:8-19
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { kitName, kitCategory, inputContent, uploadedFiles, numberOfSessions, generateImages, userInstructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // No authentication check — proceeds directly to AI API call
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      // ...
```

**Recommendation**
Add JWT verification at the top of the handler (same pattern as `personalize-content/index.ts:24-30`). Restrict access to authenticated users with the `admin` role:

```typescript
const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
}
// Add admin role check
const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
if (!roles?.some(r => r.role === "admin")) {
  return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
}
```

**Estimated effort:** S
**Estimated impact:** High

---

### FINDING-007: unlock_codes UPDATE policy permits any authenticated user

| Field        | Value |
|--------------|-------|
| ID           | FINDING-007 |
| Domain       | Security |
| Severity     | HIGH |
| OWASP ref    | A01 — Broken Access Control |
| CWE ref      | CWE-862: Missing Authorization |
| Location     | `supabase/setup.sql:369` |
| Status       | Open |

**Description**
The `unlock_codes` table UPDATE policy on line 369 is `USING (true) WITH CHECK (true)`. This means any authenticated user can update ANY row in the `unlock_codes` table, including marking any code as used, changing the `redeemed_by` field, or modifying the `code` itself. The policy was likely intended to allow users to redeem codes, but it grants unrestricted write access to the entire table.

**Attack vector / impact**
An authenticated user can:
1. Mark any unlock code as used (`is_used = true`), preventing others from redeeming it
2. Re-assign a redeemed code to themselves by changing `redeemed_by`
3. Steal XP rewards by modifying `xp_reward` fields before redeeming
4. Cause denial of service for learners who need specific codes

**Evidence**
```sql
-- supabase/setup.sql:364-369
-- UNLOCK CODES
CREATE POLICY "Authenticated users can look up codes" ON public.unlock_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage codes" ON public.unlock_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can redeem codes" ON public.unlock_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

**Recommendation**
Restrict the UPDATE policy to only allow a user to mark a code as used for themselves, and only when the code is not already used:

```sql
DROP POLICY IF EXISTS "Users can redeem codes" ON public.unlock_codes;
CREATE POLICY "Users can redeem codes" ON public.unlock_codes
  FOR UPDATE TO authenticated
  USING (is_used = false)
  WITH CHECK (is_used = true AND redeemed_by = auth.uid());
```

**Estimated effort:** S
**Estimated impact:** High

---

### FINDING-008: React Query imported but never called

| Field        | Value |
|--------------|-------|
| ID           | FINDING-008 |
| Domain       | Performance |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/App.tsx:4,25-28,97` |
| Status       | Open |

**Description**
`@tanstack/react-query` is imported and its `QueryClientProvider` wraps the entire component tree in `App.tsx`. However, there are zero `useQuery()` or `useMutation()` calls anywhere in the codebase. All data fetching uses raw `useEffect` + `useState` with direct Supabase calls. This adds approximately 35 KB (gzipped ~11 KB) of unused JavaScript to every page load, while providing zero caching, deduplication, or background refetch benefits.

**Attack vector / impact**
Every API call is uncached, leading to duplicate requests when a user navigates away and back. The Dashboard, for example, re-fetches all data on every mount (FINDING-003). The unused library increases bundle size and first-load time. This is a wasted opportunity — React Query's `staleTime` alone would eliminate most redundant API calls.

**Evidence**
```typescript
// src/App.tsx:4,25-28,97
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();  // default staleTime: 0 (no caching)
const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* ... */}
  </QueryClientProvider>
);
// No useQuery() or useMutation() calls exist in any component
```

```typescript
// src/pages/Dashboard.tsx:87 — raw useEffect fetch, no React Query
const [enrolledPrograms, setEnrolledPrograms] = useState<EnrolledProgram[]>([]);
useEffect(() => { if (user) { fetchEnrolledPrograms(); } }, [user]);
```

**Recommendation**
Either wire up React Query by migrating data fetches to `useQuery`/`useMutation` with `staleTime: 300000` (5 min), or remove the library entirely. Priority pages to migrate: Dashboard, ProgramView, SessionView, Admin. This eliminates the N+1 / waterfall issues because React Query deduplicates and caches results.

```typescript
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 300000, retry: 1 } } });
```

**Estimated effort:** L
**Estimated impact:** High

---

### FINDING-009: No React.lazy() for route code splitting

| Field        | Value |
|--------------|-------|
| ID           | FINDING-009 |
| Domain       | Performance |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/App.tsx:8-23` |
| Status       | Open |

**Description**
All 15+ page components (Landing, Login, Dashboard, Programs, ProgramView, SessionView, Admin, Store, Redeem, etc.) are eagerly imported at the top of `App.tsx`. The Admin page alone is 657 lines, and SessionContentEditor is 1224 lines. Every page component and its transitive dependencies are included in the initial JavaScript bundle, regardless of whether the user visits those routes. Vite emits a warning: `"chunk src/main.tsx ... is 1336 KB"`.

**Attack vector / impact**
First-load bundle is 1,336 KB (391 KB gzipped). Users on slow connections in Africa (the target market for Mamuza Engineering) experience multi-second load times before any content is interactive. This directly impacts conversion and user retention.

**Evidence**
```typescript
// src/App.tsx:8-23 — all eager imports
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Programs from "./pages/Programs";
import ProgramView from "./pages/ProgramView";
import SessionView from "./pages/SessionView";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import TestView from "./pages/TestView";
import Store from "./pages/Store";
import Redeem from "./pages/Redeem";
import VerifyEmail from "./pages/VerifyEmail";
```

**Recommendation**
Replace eager imports with `React.lazy()` + `<Suspense>` for all route components. Non-essential pages (Admin, Store, Profile) can be split into separate chunks loaded on demand:

```typescript
import { lazy, Suspense } from "react";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
// ... wrap routes in <Suspense fallback={<LoadingScreen />}>
```

**Estimated effort:** M
**Estimated impact:** High

---

### FINDING-010: 6 sequential waterfall DB queries in SessionView

| Field        | Value |
|--------------|-------|
| ID           | FINDING-010 |
| Domain       | Performance |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/pages/SessionView.tsx:76-176` |
| Status       | Open |

**Description**
The `fetchData` function in SessionView makes 6 sequential (non-parallelized) database queries that each depend on the previous result: (1) fetch session → (2) fetch program → (3) fetch all sessions for navigation → (4) fetch content blocks → (5) fetch session progress → (6) fetch XP transactions. Each query waits for the previous to complete before starting, even though queries 2-3 depend only on query 1, and queries 5-6 depend only on the user being available.

**Attack vector / impact**
Page load latency equals the sum of 6 round-trip latencies (~100-200ms each = ~600-1200ms total) rather than the max of parallelized groups (~200-400ms). The 800ms `setTimeout` retry on content blocks (FINDING-017) adds further delay. Users experience a blank or partially-rendered page for over a second.

**Evidence**
```typescript
// src/pages/SessionView.tsx:80-168
const sessionData = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
// ... then ...
const programData = await supabase.from("programs").select("id, title").eq("id", sessionData.program_id).maybeSingle();
// ... then ...
const allSessions = await supabase.from("sessions").select("*").eq("program_id", sessionData.program_id).order("session_order");
// ... then ...
const blocks = await supabase.from("content_blocks").select("*").eq("session_id", sessionId).order("block_order");
// ... then (if user) ...
const progress = await supabase.from("session_progress").select("completed").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
// ... then ...
const xpTx = await supabase.from("xp_transactions").select("id").eq("user_id", user.id).eq("reference_type", "session").eq("reference_id", sessionId).limit(1);
```

**Recommendation**
Parallelize independent queries with `Promise.all`. Group queries by dependency: batch the session fetch, then fire program + all sessions + content blocks in parallel, then (if user) fire progress + XP transactions in parallel:

```typescript
const { data: sessionData } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
if (!sessionData) return;
const [programData, allSessions, blocks] = await Promise.all([
  supabase.from("programs").select("id, title").eq("id", sessionData.program_id).maybeSingle(),
  supabase.from("sessions").select("*").eq("program_id", sessionData.program_id).order("session_order"),
  supabase.from("content_blocks").select("*").eq("session_id", sessionId).order("block_order"),
]);
if (user) {
  const [progress, xpTx] = await Promise.all([ ... ]);
}
```

**Estimated effort:** S
**Estimated impact:** High

---

### FINDING-011: 10 sequential DB queries in ProgramView on mount

| Field        | Value |
|--------------|-------|
| ID           | FINDING-011 |
| Domain       | Performance |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/pages/ProgramView.tsx:106-121` |
| Status       | Open |

**Description**
The `useEffect` in ProgramView fires 10 sequential database queries on mount: `fetchProgram()`, `fetchSessions()`, `fetchProgramTest()`, `checkAccess()`, `fetchProgress()`, `checkTestPassed()`, `checkAssessment()`, `fetchSessionScores()`, `checkCertificate()`, `fetchUserXP()`. None are parallelized. Several of these are independent of each other (e.g., fetching the program test is independent of checking access).

**Attack vector / impact**
Each query adds 50-200ms of wall-clock time. With 10 queries, users wait 500-2000ms before the page is fully interactive. The cumulative database load at 100+ concurrent users could overwhelm the Supabase free-tier connection pool (default: 15 connections).

**Evidence**
```typescript
// src/pages/ProgramView.tsx:106-121
useEffect(() => {
  if (id) {
    fetchProgram();
    fetchSessions();
    fetchProgramTest();
    if (user) {
      checkAccess();
      fetchProgress();
      checkTestPassed();
      checkAssessment();
      fetchSessionScores();
      checkCertificate();
      fetchUserXP();
    }
  }
}, [id, user]);
```

**Recommendation**
Group independent queries into parallel batches:

```typescript
useEffect(() => {
  if (!id) return;
  const programPromise = fetchProgram();
  const sessionPromise = fetchSessions();
  const testPromise = fetchProgramTest();
  const [program, sessions, test] = await Promise.all([programPromise, sessionPromise, testPromise]);
  if (user) {
    const [access, progress, passed, assessment, scores, cert, xp] = await Promise.all([
      checkAccess(), fetchProgress(), checkTestPassed(),
      checkAssessment(), fetchSessionScores(), checkCertificate(), fetchUserXP()
    ]);
  }
}, [id, user]);
```

**Estimated effort:** S
**Estimated impact:** High

---

### FINDING-012: Silent error handling via console.error only

| Field        | Value |
|--------------|-------|
| ID           | FINDING-012 |
| Domain       | UX |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | Multiple files (45+ `console.error` / `console.warn` calls across 25+ files) |
| Status       | Open |

**Description**
The codebase has 45+ `console.error()` and `console.warn()` calls across the application. In virtually every case, the error is logged to the developer console but no user-facing feedback is shown (no toast, no inline error message, no fallback UI). This includes critical user flows: XP award failures, session fetch errors, content block loading failures, code redemption errors, profile update failures. Users see a blank state or spinner with no indication something went wrong.

**Attack vector / impact**
When a query fails (network error, RLS policy rejection, timeout), users see either a permanently blank section, an infinite loading spinner, or silently stale data. They cannot distinguish between "loading" and "error" states. This erodes trust and causes confusion, especially on slow connections where errors are more frequent.

**Evidence**
```typescript
// src/pages/Dashboard.tsx:76 — user XP silently fails
const { data, error } = await supabase.from("user_xp").select("total_xp, level").eq("user_id", user.id).maybeSingle();
if (error) console.error("Dashboard fetchUserXP error:", error);  // user sees "—" with no error message

// src/pages/Dashboard.tsx:163 — enrolled programs fails
} catch (error) {
  console.error("Error fetching enrolled programs:", error);  // user sees empty "No Programs Yet" state
}

// src/hooks/use-xp.ts:45 — XP read fails
if (error) {
  console.error("getUserXP select error:", error)  // no toast, no user feedback
}

// src/components/modals/RedeemCodeModal.tsx:150 — code lookup fails
if (findError) {
  console.error("DB error looking up code:", findError);  // user just sees no result
}
```

**Recommendation**
Add user-facing error feedback for every async operation. Use the existing `toast()` system or inline error states:

```typescript
if (error) {
  console.error("Dashboard fetchUserXP error:", error);
  toast({ title: "Failed to load XP", description: "Please refresh the page", variant: "destructive" });
}
```

Or add proper error states to the component:
```typescript
const [error, setError] = useState<string | null>(null);
// ... in catch: setError(error.message)
// ... in render: {error && <Alert variant="destructive">{error}</Alert>}
```

**Estimated effort:** L
**Estimated impact:** High

---

### FINDING-013: SessionContentEditor is 1224 lines (monolithic)

| Field        | Value |
|--------------|-------|
| ID           | FINDING-013 |
| Domain       | Code Quality |
| Severity     | HIGH |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/components/admin/SessionContentEditor.tsx` (whole file, 1224 lines) |
| Status       | Open |

**Description**
`SessionContentEditor.tsx` is a single monolithic component spanning 1224 lines. It handles content block CRUD, drag-and-drop reordering, image uploads, code block editing, auto-populate from AI, and multi-block transactions — all within one file. It has multiple internal state variables (15+), nested JSX callbacks, and deeply nested conditional rendering.

**Attack vector / impact**
The component is extremely difficult to maintain, test, or reason about. Any change risks breaking unrelated functionality. Code review is impractical (1224 lines per file exceeds most team's review limits). Bug fix velocity slows as developers must understand the entire file before making safe changes. This is the primary barrier to improving admin content management.

**Evidence**
```typescript
// src/components/admin/SessionContentEditor.tsx — line count
// 1224 lines, single file component
// Estimated breakdown:
//   - 100 lines imports + types + state
//   - 200 lines render helpers
//   - 800 lines main render (nested JSX with conditional blocks for image upload, code editor, dialog, etc.)
//   - 124 lines utility functions
```

**Recommendation**
Break into the following focused components:
- `ContentBlockEditor` — handles editing a single block (type-specific forms)
- `ContentBlockList` — drag-and-drop list container
- `ImageBlockEditor` — image upload + preview
- `CodeBlockEditor` — code editor wrapper
- `AutoPopulateDialog` — AI content generation dialog
- `BlockReorderControls` — drag handle + move buttons

Target max 250 lines per component.

**Estimated effort:** L
**Estimated impact:** High

---

### FINDING-014: dangerouslySetInnerHTML without sanitization

| Field        | Value |
|--------------|-------|
| ID           | FINDING-014 |
| Domain       | Security |
| Severity     | MEDIUM |
| OWASP ref    | A03 — Injection |
| CWE ref      | CWE-79: Improper Neutralization of Input During Web Page Generation (XSS) |
| Location     | `src/components/content/FormattedText.tsx:63` |
| Status       | Open |

**Description**
The `FormattedText` component uses `dangerouslySetInnerHTML` to render HTML content when it detects that the content string contains HTML tags (line 57-65). There is no sanitization library (DOMPurify, sanitize-html, etc.) applied before injection. Content stored in the database by admin users could contain malicious `<script>` tags, event handlers (`onload`, `onerror`), or `iframe` embeds.

**Attack vector / impact**
If an admin account is compromised, or if a stored-XSS vector exists via another path (e.g., AI-generated content that includes HTML), an attacker can inject arbitrary JavaScript. This executes in the context of every user who views the affected session content, enabling credential theft, session hijacking, or defacement. While the attack surface is limited to admin content creation, the impact is severe.

**Evidence**
```typescript
// src/components/content/FormattedText.tsx:57-65
const isHtml = /<[a-z][\s\S]*>/i.test(content);

if (isHtml) {
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}  // No DOMPurify sanitization
    />
  );
}
```

**Recommendation**
Install DOMPurify and sanitize content before injection:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

```typescript
import DOMPurify from "dompurify";
// ...
if (isHtml) {
  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
    />
  );
}
```

**Estimated effort:** XS
**Estimated impact:** Medium

---

### FINDING-015: No Content Security Policy header

| Field        | Value |
|--------------|-------|
| ID           | FINDING-015 |
| Domain       | Security |
| Severity     | MEDIUM |
| OWASP ref    | A05 — Security Misconfiguration |
| CWE ref      | CWE-693: Protection Mechanism Failure |
| Location     | `index.html` (entire file, 25 lines) |
| Status       | Open |

**Description**
The `index.html` file contains no `<meta http-equiv="Content-Security-Policy">` tag, and the production server (Cloudflare Pages) has no CSP HTTP header configured. Without CSP, the browser allows unrestricted execution of inline scripts, connection to any external origin, loading of any external resources. This means any stored-XSS vulnerability (see FINDING-014) can execute arbitrary code without mitigation.

**Attack vector / impact**
An XSS attacker can exfiltrate data to any external server, load keyloggers, or perform crypto-mining — CSP would block these by restricting allowed script sources and connection endpoints. CSP is the most effective defense-in-depth against XSS.

**Evidence**
```html
<!-- index.html:1-25 — no CSP anywhere -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <title>Mamuza Engineering LMS</title>
    <!-- No CSP meta tag -->
```

**Recommendation**
Add a CSP header via the `_headers` file for Cloudflare Pages (recommended) and/or a `<meta>` tag as fallback:

```
# public/_headers — add this entry
/*  X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://*.supabase.co; font-src 'self'; base-uri 'self'; form-action 'self'
```

**Estimated effort:** XS
**Estimated impact:** Medium

---

### FINDING-016: No cache-control headers for static assets

| Field        | Value |
|--------------|-------|
| ID           | FINDING-016 |
| Domain       | Performance |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `public/` directory (6 files) |
| Status       | Open |

**Description**
The `public/` directory contains `favicon.ico`, `favicon.png`, `og-image.png`, `placeholder.svg`, `robots.txt`, and `_redirects`. There is no `_headers` file configuring cache-control. Cloudflare Pages sets default cache headers (typically 4-hour TTL for immutable assets) but Vite-built JS/CSS bundles in `dist/assets/` with content hashes should have `immutable, max-age=31536000` cache headers for optimal performance.

**Attack vector / impact**
Repeat visitors re-download unchanged JS/CSS bundles (~391 KB gzipped) on every visit because cache headers are missing or too short. This increases bandwidth costs, CDN egress fees, and page load times. On mobile networks in Africa (the target market), this directly impacts usability.

**Evidence**
```
$ ls public/
favicon.ico  favicon.png  og-image.png  placeholder.svg  robots.txt  _redirects
# No _headers file exists for cache-control configuration
```

**Recommendation**
Create `public/_headers` with aggressive caching for hashed assets:

```
# public/_headers
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/favicon.*
  Cache-Control: public, max-age=86400
/og-image.png
  Cache-Control: public, max-age=86400
/placeholder.svg
  Cache-Control: public, max-age=86400
/*  X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self' https://*.supabase.co; font-src 'self'; base-uri 'self'; form-action 'self'
```

**Estimated effort:** XS
**Estimated impact:** Medium

---

### FINDING-017: setTimeout retry for content blocks with no max or backoff

| Field        | Value |
|--------------|-------|
| ID           | FINDING-017 |
| Domain       | Performance |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/pages/SessionView.tsx:135-145` |
| Status       | Open |

**Description**
When content blocks return empty, SessionView waits 800ms and retries exactly once with the same query. The 800ms delay is hardcoded (no exponential backoff) and there's no maximum retry count — if the second attempt also returns empty, the user sees a blank content area with no further retry. The `setTimeout` fires regardless of whether the component is still mounted, risking a state update on unmounted component.

**Attack vector / impact**
On slow networks where the first query times out, a single 800ms retry is insufficient (real packet loss on African mobile networks can cause 3-5 second delays). When the retry also fails, no further attempts are made and no error is shown to the user. The hardcoded 800ms adds unnecessary latency even when the first query succeeds.

**Evidence**
```typescript
// src/pages/SessionView.tsx:135-145
if (blocks && blocks.length > 0) {
  setContentBlocks(blocks);
} else if (!blocksError) {
  console.warn("No content blocks returned — retrying...");
  await new Promise(r => setTimeout(r, 800));  // Fixed 800ms delay, no backoff
  const { data: retryBlocks, error: retryError } = await supabase
    .from("content_blocks")
    .select("*")
    .eq("session_id", sessionId)
    .order("block_order");
  if (retryError) console.error("Retry blocks error:", retryError);
  if (retryBlocks) setContentBlocks(retryBlocks);
}
```

**Recommendation**
Replace with exponential backoff, max retries, and a cleanup flag:

```typescript
const MAX_RETRIES = 3;
let attempt = 0;
let delay = 400;
let cancelled = false;

const fetchWithRetry = async () => {
  while (attempt < MAX_RETRIES && !cancelled) {
    const { data, error } = await supabase.from("content_blocks")...
    if (data?.length) return setContentBlocks(data);
    if (error) break;
    attempt++;
    await new Promise(r => setTimeout(r, delay));
    delay *= 2;  // exponential backoff: 400, 800, 1600ms
  }
  // Show user-facing error
};

// Cleanup in useEffect return
return () => { cancelled = true; };
```

**Estimated effort:** S
**Estimated impact:** Medium

---

### FINDING-018: Zero ARIA labels in application code

| Field        | Value |
|--------------|-------|
| ID           | FINDING-018 |
| Domain       | UX |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | All custom components in `src/components/` and `src/pages/` |
| Status       | Open |

**Description**
All 5 `aria-label` attributes found in the codebase are in shadcn/ui library components (sidebar, pagination, breadcrumb). None of the custom application components use `aria-label`, `role`, `aria-describedby`, `aria-live`, or any other ARIA attributes. This includes critical interactive elements: navigation buttons, modal triggers, quiz controls, progress indicators, session navigation, and admin management panels.

**Attack vector / impact**
Screen readers (JAWS, NVDA, VoiceOver) cannot properly interpret the application's interactive elements. Users with visual disabilities cannot:
- Identify button purposes (e.g., "Continue Learning" vs "Redeem Code")
- Understand tab navigation in the admin panel
- Receive feedback on quiz submission or XP award outcomes
- Navigate the session content structure

This creates a complete accessibility barrier and may violate WCAG 2.1 AA standards, with potential legal liability for educational platforms.

**Evidence**
```
$ grep -r "aria-label" src/components/* src/pages/* --include="*.tsx"
src/components/ui/sidebar.tsx:        aria-label="Toggle Sidebar"    # shadcn library component
src/components/ui/pagination.tsx:     aria-label="pagination"        # shadcn library component
src/components/ui/pagination.tsx:     aria-label="Go to previous page"  # shadcn library component
src/components/ui/pagination.tsx:     aria-label="Go to next page"      # shadcn library component
src/components/ui/breadcrumb.tsx:     aria-label="breadcrumb"       # shadcn library component
# No matches in any custom application component
```

**Recommendation**
Add ARIA labels to all custom interactive elements. Priority targets:
- All `<Button>` elements in `Dashboard.tsx`, `ProgramView.tsx`, `SessionView.tsx`
- `<Input>` search fields (already semantic but add `aria-label`)
- Modal triggers and close buttons
- Progress bars (add `aria-valuenow`, `aria-valuemin`, `aria-valuemax`)
- Navigation links

Example:
```typescript
<Button variant="hero" onClick={() => setIsRedeemModalOpen(true)} aria-label="Redeem an unlock code for a new program">
```

**Estimated effort:** M
**Estimated impact:** Medium

---

### FINDING-019: Plain text "Loading kits..." instead of spinner

| Field        | Value |
|--------------|-------|
| ID           | FINDING-019 |
| Domain       | UX |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/pages/Admin.tsx:456-458` |
| Status       | Open |

**Description**
The Admin page uses plain text "Loading kits..." inside a `<p>` tag as the loading state, while other pages (Dashboard, ProgramView, SessionView) use proper animated spinner components (`animate-spin` or `<Loader2>` from lucide-react). This inconsistency creates a jarring UX — users see a static text label with no visual indication of progress.

**Attack vector / impacts**
Users perceive the admin panel as unresponsive or broken during loading. The lack of an animated indicator makes it unclear whether the page is loading or stuck. This is especially problematic for admin users with large datasets.

**Evidence**
```tsx
// src/pages/Admin.tsx:456-458
{isLoading ? (
  <div className="text-center py-12">
    <p className="text-muted-foreground">Loading kits...</p>   {/* Static text, no spinner */}
  </div>
) : /* ... */}
```

Compare with Dashboard.tsx:362:
```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>  {/* Proper spinner */}
  </div>
) : /* ... */}
```

**Recommendation**
Replace the static text with the same animated spinner used elsewhere:

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
) : /* ... */}
```

**Estimated effort:** XS
**Estimated impact:** Medium

---

### FINDING-020: Only 1 placeholder test in entire codebase

| Field        | Value |
|--------------|-------|
| ID           | FINDING-020 |
| Domain       | Code Quality |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/test/example.test.ts:1-7` |
| Status       | Open |

**Description**
The entire test suite consists of one file with a single test: `expect(true).toBe(true)`. There are no unit tests, integration tests, component tests, or E2E tests for any of the application's 15+ pages, 20+ components, 5+ hooks, or 4 edge functions. Vitest is set up with `setup.ts` but no actual tests use it.

**Attack vector / impact**
Every code change — refactors, dependency updates, new features — carries unknown regression risk. The critical XP award flow (`useXP` hook, `award_xp` RPC), code redemption flow, quiz scoring, and session completion have zero test coverage. Bugs in these paths reach production without detection. The cost of adding tests after deployment is significantly higher than writing them during development.

**Evidence**
```typescript
// src/test/example.test.ts — complete file
import { describe, it, expect } from "vitest";
describe("example", () => {
  it("should pass", () => {
    expect(true).toBe(true);
  });
});
```

```
$ ls src/test/
example.test.ts
setup.ts
```

**Recommendation**
Add tests for critical paths in priority order:
1. `useXP` hook — `awardXP`, `getUserXP`, `awardDailyLoginXP` (unit test with mocked Supabase)
2. `SessionQuiz` component — quiz scoring, pass/fail logic
3. `FormattedText` component — HTML rendering, markdown parsing
4. Code redemption flow — `RedeemCodeModal`
5. XP badge calculation
6. Integration tests for Dashboard + ProgramView data fetching

```typescript
// Example test for useXP (using vitest + mocked supabase)
describe("useXP", () => {
  it("awardXP calls supabase.rpc with award_xp", async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: { total_xp: 50, level: 2 }, error: null });
    vi.mocked(supabase.rpc).mockImplementation(mockRpc);
    const { result } = renderHook(() => useXP());
    await result.current.awardXP("user-1", 50, "test", "session", "session-1");
    expect(mockRpc).toHaveBeenCalledWith("award_xp", {
      p_user_id: "user-1", p_amount: 50, p_reason: "test",
      p_reference_type: "session", p_reference_id: "session-1"
    });
  });
});
```

**Estimated effort:** XL (16h for meaningful coverage)
**Estimated impact:** Medium

---

### FINDING-021: .single() used instead of .maybeSingle() in edge functions

| Field        | Value |
|--------------|-------|
| ID           | FINDING-021 |
| Domain       | Scalability |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `supabase/functions/generate-certificate/index.ts:26,40,47,188` and `personalize-content/index.ts:145,317` |
| Status       | Open |

**Description**
6 `.single()` calls remain in edge functions (the `generate-certificate` and `personalize-content` functions). `.single()` throws error code `PGRST116` when zero rows are returned, while `.maybeSingle()` returns `null`. This means that if a user profile doesn't exist, or a program is deleted, the edge function crashes with an unhandled error instead of gracefully returning a fallback or error message.

**Attack vector / impact**
A race condition (e.g., user deleted mid-request) or data integrity issue causes 500 errors instead of graceful degradation. The `generate-certificate` function will crash if `supabase.from("profiles").select().eq("user_id", userId).single()` finds no matching profile — the error is caught only by the outer try/catch, returning a generic 500 with no recovery path.

**Evidence**
```typescript
// supabase/functions/generate-certificate/index.ts:22-27
const { data: profile } = await supabase
  .from("profiles")
  .select("full_name, email")
  .eq("user_id", userId)
  .single();  // Throws PGRST116 if profile not found
```

```typescript
// supabase/functions/personalize-content/index.ts:145
.single();  // Same issue
```

Note: The frontend code was already fixed (commit `27fce44`: "fix: replace all .single() with .maybeSingle() to prevent PGRST116 errors"), but the edge functions were missed.

**Recommendation**
Replace all `.single()` calls with `.maybeSingle()` in edge functions, and add proper null-handling after each call:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("full_name, email")
  .eq("user_id", userId)
  .maybeSingle();

if (!profile) {
  throw new Error("User profile not found");
}
```

**Estimated effort:** S
**Estimated impact:** Medium

---

### FINDING-022: SELECT * on user_xp instead of narrow columns

| Field        | Value |
|--------------|-------|
| ID           | FINDING-022 |
| Domain       | Performance |
| Severity     | MEDIUM |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/hooks/use-xp.ts:39-42` |
| Status       | Open |

**Description**
The `getUserXP` function in `use-xp.ts` uses `select("*")` on the `user_xp` table instead of selecting only the needed columns (`total_xp`, `level`). The `user_xp` table has 5 columns (`id`, `user_id`, `total_xp`, `level`, `updated_at`). While the current overhead is minor, this sets a bad pattern. The dashboard's `fetchUserXP` correctly uses `.select("total_xp, level")` (Dashboard.tsx:73), showing inconsistency.

**Attack vector / impact**
Unnecessary columns (`id`, `user_id`, `updated_at`) are transferred over the network on every XP read, adding ~15% payload overhead. More critically, this pattern, if replicated on larger tables like `content_blocks` or `sessions` (which have JSONB columns), would significantly increase bandwidth usage.

**Evidence**
```typescript
// src/hooks/use-xp.ts:39-42 — SELECT * on user_xp
const getUserXP = useCallback(async (userId: string) => {
  const { data, error } = await supabase
    .from("user_xp")
    .select("*")  // Should be .select("total_xp, level")
    .eq("user_id", userId)
    .maybeSingle()
```

Compare with Dashboard.tsx:72-73 (correct):
```typescript
const { data, error } = await supabase
  .from("user_xp")
  .select("total_xp, level")
```

**Recommendation**
Narrow to specific columns:

```typescript
.select("total_xp, level")
```

**Estimated effort:** XS
**Estimated impact:** Medium

---

### FINDING-023: Commented-out old Supabase credentials in .env

| Field        | Value |
|--------------|-------|
| ID           | FINDING-023 |
| Domain       | Security |
| Severity     | LOW |
| OWASP ref    | A05 — Security Misconfiguration |
| CWE ref      | CWE-312: Cleartext Storage of Sensitive Information |
| Location     | `.env:2-3` |
| Status       | Open |

**Description**
The `.env` file contains commented-out lines with old Supabase credentials, including a previous project API key (`eyJhbGciOi...`) and URL (`https://cuvlljfdfwazkjdptmun.supabase.co`). While commented out, these are stored in plaintext in the repository and visible to anyone with repository access.

**Attack vector / impacts**
If the old key is still active (Supabase keys are not automatically invalidated when replaced), it provides an alternative entry point to the old project's data. Even if inactive, the presence of any API key in a `.env` file in a git repository is a credential hygiene issue. Committed secrets persist in git history even after removal.

**Evidence**
```bash
# .env:1-3
VITE_SUPABASE_PROJECT_ID="inzxtybkqwagwgjvdbes"
# VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluenh0eWJrcXdhZ3dnanZkYmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDYxNzcsImV4cCI6MjA5MzY4MjE3N30.-6yZDONwmUOC8rhSwOYGNKiQcwkj4RpK4j2PftvfLDA"
# VITE_SUPABASE_URL="https://cuvlljfdfwazkjdptmun.supabase.co"
```

**Recommendation**
Remove the commented-out lines from `.env`. Ensure `.env` is in `.gitignore` (already done per commit `ec11da4`). For existing git history, consider using `git filter-branch` or `git guardian` to purge the secret, or rotate the old key.

**Estimated effort:** XS
**Estimated impact:** Low

---

### FINDING-024: allowedHosts: true in vite dev server config

| Field        | Value |
|--------------|-------|
| ID           | FINDING-024 |
| Domain       | Security |
| Severity     | LOW |
| OWASP ref    | A05 — Security Misconfiguration |
| CWE ref      | CWE-350: Reliance on Reverse DNS |
| Location     | `vite.config.ts:11` |
| Status       | Open |

**Description**
The Vite dev server has `allowedHosts: true` (line 11), which permits any Host header value. This is set to allow ngrok tunneling during development. However, in production this is not used (Vite dev server is not exposed), but the configuration is committed and could be copied to other environments.

**Attack vector /impact**
If the `allowedHosts: true` configuration were accidentally applied to a production-like setting (e.g., a preview deployment that runs the Vite dev server instead of the built output), it could enable DNS rebinding attacks where an attacker-controlled domain proxies requests to the internal dev server, bypassing CORS.

**Evidence**
```typescript
// vite.config.ts:8-15
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,  // Permits any Host header
    hmr: {
      overlay: false,
    },
  },
```

**Recommendation**
Restrict `allowedHosts` to specific hosts rather than using `true`:

```typescript
allowedHosts: ["localhost", "127.0.0.1", "*.ngrok-free.app", "*.ngrok.io"],
```

Or use an environment variable to control this in dev only:
```typescript
allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(",") || ["localhost"],
```

**Estimated effort:** XS
**Estimated impact:** Low

---

### FINDING-025: .filter() / .some() / .reduce() not memoized in render

| Field        | Value |
|--------------|-------|
| ID           | FINDING-025 |
| Domain       | Performance |
| Severity     | LOW |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | Multiple render functions in `src/pages/Dashboard.tsx`, `src/pages/ProgramView.tsx`, `src/components/admin/*.tsx` |
| Status       | Open |

**Description**
Multiple components recompute derived data using `.filter()`, `.some()`, `.reduce()`, and `.find()` directly in the render body on every render cycle. For example, Dashboard re-filters `enrolledPrograms` on every keystroke in the search input (`filteredPrograms` on line 262-266), and recalculates session totals via `.reduce()` on lines 307-308. These are not wrapped in `useMemo`.

**Attack vector / impact**
On every state change (including unrelated ones like typing in the search box), these array iterations re-run. For small arrays (<100 items) the performance impact is negligible, but it indicates a pattern that will break when datasets grow. More critically, un-memoized callbacks passed to child components (e.g., inline arrow functions) cause unnecessary re-renders.

**Evidence**
```typescript
// src/pages/Dashboard.tsx:262-266 — recomputes on every render
const filteredPrograms = enrolledPrograms.filter(
  (p) =>
    p.program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.program.kit.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// src/pages/Dashboard.tsx:307-308 — two reduce calls per render
{enrolledPrograms.reduce((acc, p) => acc + p.completedSessions, 0)}/
{enrolledPrograms.reduce((acc, p) => acc + p.totalSessions, 0)}
```

**Recommendation**
Wrap derived computations in `useMemo`:

```typescript
const filteredPrograms = useMemo(() =>
  enrolledPrograms.filter(p =>
    p.program.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.program.kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  ),
  [enrolledPrograms, searchQuery]
);

const totals = useMemo(() => ({
  completed: enrolledPrograms.reduce((acc, p) => acc + p.completedSessions, 0),
  total: enrolledPrograms.reduce((acc, p) => acc + p.totalSessions, 0),
}), [enrolledPrograms]);
```

**Estimated effort:** S
**Estimated impact:** Low

---

### FINDING-026: 17+ `any` type usages throughout codebase

| Field        | Value |
|--------------|-------|
| ID           | FINDING-026 |
| Domain       | Code Quality |
| Severity     | LOW |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | 17 matches across: `Dashboard.tsx`, `ProgramView.tsx`, `Admin.tsx`, `monitor.ts`, `SessionContentEditor.tsx`, `RichTextEditor.tsx`, `KitDialogs.tsx`, `ImageBubbleMenu.tsx`, `AIContentGenerator.tsx`, `personalize-content/index.ts` |
| Status       | Open |

**Description**
There are 17+ uses of the `any` type across the TypeScript codebase. Most are in `async` data fetching callbacks where Supabase query results are typed as `any` instead of using proper interfaces. For example, `Dashboard.tsx` casts `access: any`, `progress: any`, `unlock: any` in `.map()` and `.forEach()` callbacks rather than defining explicit interfaces.

**Attack vector / impact**
`any` disables TypeScript's type checking entirely. This means:
- Refactoring a database column name will not produce compile errors if the column is accessed through an `any`-typed reference
- Runtime errors from shape mismatches go undetected during compilation
- IDE autocomplete and inline documentation are disabled for those references

**Evidence**
```typescript
// src/pages/Dashboard.tsx:116
(accessData || []).map(async (access: any) => {  // should be typed
// src/pages/Dashboard.tsx:194
progressData.forEach((progress: any) => {  // should be typed
// src/pages/Dashboard.tsx:221
unlockData.forEach((unlock: any) => {  // should be typed
// src/pages/ProgramView.tsx:219
data.forEach((d: any) => {  // should be typed
// src/integrations/supabase/monitor.ts:8
error?: any;  // should be Error | null
```

**Recommendation**
Replace `any` with proper TypeScript interfaces for all data shapes. Extract shared types into a `types/` directory:

```typescript
// src/types/program.ts
export interface EnrolledProgram {
  id: string;
  program_id: string;
  unlocked_at: string;
  program: Program;
  totalSessions: number;
  completedSessions: number;
}

export interface RecentActivity {
  id: string;
  type: "session" | "unlock";
  name: string;
  program: string;
  time: string;
  timestamp: Date;
}
```

**Estimated effort:** M
**Estimated impact:** Low

---

### FINDING-027: Race condition in awardDailyLoginXP

| Field        | Value |
|--------------|-------|
| ID           | FINDING-027 |
| Domain       | Scalability |
| Severity     | LOW |
| OWASP ref    | N/A |
| CWE ref      | N/A |
| Location     | `src/hooks/use-xp.ts:121-143` |
| Status       | Open |

**Description**
The `awardDailyLoginXP` function performs a SELECT-then-INSERT pattern without any locking or upsert. It first checks if a `daily_logins` row exists for today (SELECT), and only if it doesn't, proceeds to INSERT. Between the SELECT and INSERT, a concurrent call from another tab or device could also find no existing row, resulting in a unique constraint violation or double XP award.

**Attack vector / impact**
Users with multiple browser tabs or devices (phone + laptop) who log in simultaneously can receive double daily login XP awards on the same day, or cause `console.error` from the failed duplicate INSERT. While the `UNIQUE (user_id, login_date)` constraint on `daily_logins` prevents a duplicate row, it does not prevent the XP from being awarded twice since the `awardXP` RPC fires before the INSERT and has no duplicate check.

**Evidence**
```typescript
// src/hooks/use-xp.ts:121-143
const awardDailyLoginXP = useCallback(async (userId: string) => {
  const today = new Date().toISOString().split("T")[0]
  // SELECT — window between here and INSERT
  const { data: existing } = await supabase
    .from("daily_logins")
    .select("id")
    .eq("user_id", userId)
    .eq("login_date", today)
    .maybeSingle()

  if (existing) return null

  // XP awarded before INSERT — window for duplicate XP
  const xpResult = await awardXP(userId, XP_VALUES.DAILY_LOGIN, "Daily login bonus", "daily_login", undefined)

  await supabase
    .from("daily_logins")
    .insert({ user_id: userId, login_date: today, xp_awarded: XP_VALUES.DAILY_LOGIN })

  return xpResult
}, [awardXP])
```

**Recommendation**
Use `INSERT ... ON CONFLICT DO NOTHING` instead of SELECT-then-INSERT, and award XP inside the insert operation or use a database-side approach. Restructure to insert first and conditionally award XP based on the result:

```typescript
const { data: insertResult, error: insertError } = await supabase
  .from("daily_logins")
  .insert({ user_id: userId, login_date: today, xp_awarded: XP_VALUES.DAILY_LOGIN })
  .select()
  .maybeSingle();

// If the insert succeeded (no conflict), award XP
if (insertResult && !insertError) {
  return awardXP(userId, XP_VALUES.DAILY_LOGIN, "Daily login bonus", "daily_login", undefined);
}
return null;
```

**Estimated effort:** S
**Estimated impact:** Low

---

## Findings summary table

| ID | Domain | Severity | Location | Title | Effort | Impact |
|----|--------|----------|----------|-------|--------|--------|
| FINDING-001 | Security | CRITICAL | supabase/functions/generate-certificate/index.ts:9-19 | No JWT auth check in generate-certificate | S | Critical |
| FINDING-002 | Security | CRITICAL | supabase/migrations/20260514000003_add_reset_session_xp_function.sql:4-59 | No caller check in reset_session_xp RPC | S | Critical |
| FINDING-003 | Performance | CRITICAL | src/pages/Dashboard.tsx:87-167 | N+1 query in Dashboard fetchEnrolledPrograms | M | Critical |
| FINDING-004 | Scalability | CRITICAL | supabase/setup.sql (entire file) | Only 6 explicit indexes for 26 tables | S | Critical |
| FINDING-005 | Scalability | CRITICAL | supabase/setup.sql:311-323 | session_quiz_attempts duplicates questions JSONB | M | Critical |
| FINDING-006 | Security | HIGH | supabase/functions/generate-learning-content/index.ts:8-14 | No auth check in generate-learning-content | S | High |
| FINDING-007 | Security | HIGH | supabase/setup.sql:369 | unlock_codes UPDATE policy permits any user | S | High |
| FINDING-008 | Performance | HIGH | src/App.tsx:4,25-28,97 | React Query imported but never used | L | High |
| FINDING-009 | Performance | HIGH | src/App.tsx:8-23 | No React.lazy for route code splitting | M | High |
| FINDING-010 | Performance | HIGH | src/pages/SessionView.tsx:76-176 | 6 sequential waterfall DB queries | S | High |
| FINDING-011 | Performance | HIGH | src/pages/ProgramView.tsx:106-121 | 10 sequential DB queries on mount | S | High |
| FINDING-012 | UX | HIGH | 25+ files across codebase | Silent error handling via console.error only | L | High |
| FINDING-013 | Code Quality | HIGH | src/components/admin/SessionContentEditor.tsx | 1224-line monolithic component | L | High |
| FINDING-014 | Security | MEDIUM | src/components/content/FormattedText.tsx:63 | dangerouslySetInnerHTML without sanitization | XS | Medium |
| FINDING-015 | Security | MEDIUM | index.html:1-25 | No Content Security Policy header | XS | Medium |
| FINDING-016 | Performance | MEDIUM | public/ directory | No cache-control headers for static assets | XS | Medium |
| FINDING-017 | Performance | MEDIUM | src/pages/SessionView.tsx:135-145 | setTimeout retry with no max or backoff | S | Medium |
| FINDING-018 | UX | MEDIUM | All custom components | Zero ARIA labels in application code | M | Medium |
| FINDING-019 | UX | MEDIUM | src/pages/Admin.tsx:456-458 | Plain text "Loading kits..." instead of spinner | XS | Medium |
| FINDING-020 | Code Quality | MEDIUM | src/test/example.test.ts | Only 1 placeholder test | XL | Medium |
| FINDING-021 | Scalability | MEDIUM | supabase/functions/generate-certificate/index.ts:26,40,47,188 | .single() instead of .maybeSingle() in edge functions | S | Medium |
| FINDING-022 | Performance | MEDIUM | src/hooks/use-xp.ts:39-42 | SELECT * on user_xp instead of narrow columns | XS | Medium |
| FINDING-023 | Security | LOW | .env:2-3 | Commented-out old Supabase credentials | XS | Low |
| FINDING-024 | Security | LOW | vite.config.ts:11 | allowedHosts: true in dev server config | XS | Low |
| FINDING-025 | Performance | LOW | src/pages/Dashboard.tsx:262-266,307-308 | .filter/.reduce not memoized in render | S | Low |
| FINDING-026 | Code Quality | LOW | 17 matches in 10+ files | 17+ `any` type usages throughout codebase | M | Low |
| FINDING-027 | Scalability | LOW | src/hooks/use-xp.ts:121-143 | Race condition in awardDailyLoginXP | S | Low |

---

## Remediation roadmap

### Immediate (week 1–2) — critical fixes
- [ ] FINDING-001: Add JWT auth check to `generate-certificate` edge function
- [ ] FINDING-002: Add `auth.uid() != p_user_id AND NOT is_admin_or_instructor` check to `reset_session_xp` RPC
- [ ] FINDING-003: Fix N+1 query in Dashboard — batch session counts into single query or use a view
- [ ] FINDING-004: Add 10+ missing composite indexes on foreign keys
- [ ] FINDING-005: Remove duplicated `questions` column from `session_quiz_attempts`

### Short term (month 1) — high priority
- [ ] FINDING-006: Add JWT auth + admin role check to `generate-learning-content` edge function
- [ ] FINDING-007: Restrict `unlock_codes` UPDATE RLS policy to `is_used = false AND redeemed_by = auth.uid()`
- [ ] FINDING-008: Wire up React Query with `staleTime: 300000` or remove the library
- [ ] FINDING-009: Add `React.lazy()` + `<Suspense>` for route code splitting
- [ ] FINDING-010: Parallelize sequential DB queries in SessionView with `Promise.all`
- [ ] FINDING-011: Parallelize independent queries in ProgramView
- [ ] FINDING-012: Add toast / inline error feedback for all 45+ console.error paths
- [ ] FINDING-013: Refactor `SessionContentEditor` (1224 lines) into 5-6 focused sub-components

### Medium term (quarter 1) — medium priority
- [ ] FINDING-014: Add DOMPurify sanitization to `FormattedText.tsx`
- [ ] FINDING-015: Add CSP header via `_headers` file
- [ ] FINDING-016: Add cache-control headers for static assets in `_headers`
- [ ] FINDING-017: Replace setTimeout retry with exponential backoff + max retries
- [ ] FINDING-018: Add ARIA labels to all custom interactive elements
- [ ] FINDING-019: Replace plain text loading with animated spinner
- [ ] FINDING-020: Write tests for critical paths (XP, quiz, code redemption)
- [ ] FINDING-021: Replace all .single() with .maybeSingle() in edge functions
- [ ] FINDING-022: Narrow SELECT * to specific columns in use-xp.ts

### Long term (quarter 2+) — low priority + architecture
- [ ] FINDING-023: Remove commented-out old credentials from .env
- [ ] FINDING-024: Restrict allowedHosts to specific dev domains
- [ ] FINDING-025: Wrap derived render computations in useMemo
- [ ] FINDING-026: Replace 17+ `any` types with proper interfaces
- [ ] FINDING-027: Fix race condition — use INSERT ON CONFLICT pattern

---

## Scalability readiness scores

| Component | Score (1–10) | Bottleneck |
|-----------|-------------|------------|
| Database | 3 | Only 6 indexes for 26 tables; N+1 queries unbatched; no connection pooling optimization |
| Backend / API | 4 | 3 of 4 edge functions lack auth; .single() instead of .maybeSingle(); no rate limiting |
| Frontend | 4 | 1.3 MB initial bundle; no lazy loading; no React Query caching; waterfall data fetches |
| Infrastructure | 2 | Not deployed (Workers vs Pages misconfig); no CDN cache config; no error monitoring |
| Async / queues | 1 | No async processing at all — AI generation blocks HTTP response; no background job queue |

---

## UX score

**Overall UX score:** 7 / 10

**Top 5 UX improvements by impact:**
1. **Error feedback for failed operations** — 45+ console.error calls silently swallow errors; users see blank states or spinners with no explanation. Fixing FINDING-012 would have the highest UX impact.
2. **Loading state consistency** — Dashboard uses spinner, Admin uses static text "Loading kits...". Standardize on skeleton loaders or animated spinners everywhere.
3. **Bundle size reduction** — 1.3 MB JS bundle on first load causes multi-second blank screen on slow connections. Code splitting (FINDING-009) is the highest-impact performance UX fix.
4. **ARIA labels for screen readers** — Zero ARIA labels in application code (FINDING-018) excludes visually impaired users entirely. Priority for an educational platform.
5. **Inline validation feedback** — Quiz submissions, code redemptions, and form submissions should show real-time validation feedback rather than relying on toast notifications only.

---

## Dependency vulnerabilities

| Package | Current version | Latest version | CVE | Severity |
|---------|----------------|---------------|-----|----------|
| @tanstack/react-query | (installed, unused) | 5.x | N/A | N/A — dead dependency |
| vitest | (installed) | 3.x | N/A | N/A — no security advisories found |
| Note: Package-lock.json audit not run. Run `npm audit` after next install for full CVE report. |

---

## Notes & assumptions

1. **Scope limitation:** The audit covers only the application code, database schema, and edge functions. The following are out of scope: runtime security scanning, penetration testing, social engineering assessment, third-party service audits (Supabase, Cloudflare, Lovable AI), and physical security.
2. **Supabase RLS assumption:** The audit assumes RLS is correctly enabled on all tables (verified in `setup.sql`). However, the fixed `setup.sql` includes policies that may not match the current running state of the Supabase project — the three migration files (`20260514000001`, `20260514000002`, `20260514000003`) may not have been applied.
3. **No load testing performed:** The scalability scores are estimates based on schema analysis and query patterns. Actual load testing with 100+ concurrent users may reveal additional bottlenecks not listed here.
4. **Deployment assumption:** The audit assumes Cloudflare Pages as the intended deployment target. The current Workers-instead-of-Pages misconfiguration means the production environment does not exist yet, so infrastructure scores are based on intended (not actual) configuration.
5. **AI service key assumption:** `LOVABLE_API_KEY` is stored as a Supabase edge function secret. The audit assumes this key has billable usage limits and is not rotated regularly.
6. **Auth context:** All RLS policies use `auth.uid()` which depends on the caller being authenticated via Supabase Auth. Public routes (Landing, Login, Register) bypass RLS for read-only operations on public tables.
