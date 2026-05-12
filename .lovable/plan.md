
# Fix: Code Redemption & Session "Start" Button

## Two Confirmed Root Causes

### Bug 1 — "Invalid code. Please check and try again."

The code lookup in `RedeemCodeModal.tsx` uses `.single()`. In Supabase/PostgREST, `.single()` **throws an error** when zero rows are found (`PGRST116`). This error is caught by the `if (findError || !unlockCode)` check and displayed as the generic "Invalid code" message — even when the code is valid but a transient issue occurred.

There is also a second `.single()` call to check `existingAccess` — this one also **throws when no access row exists** (i.e., the normal case for a new user), which could silently corrupt the flow.

The `programs` lookup via `kit_id` also uses `.single()` with the same flaw.

**Fix**: Replace all `.single()` calls in the redemption flow with `.maybeSingle()`, which returns `null` instead of throwing when no rows are found. This prevents false "invalid code" errors from transient issues or normal empty results.

### Bug 2 — Clicking "Start" doesn't open session content

In `ProgramView.tsx`, `handleSessionClick` checks `!hasAssessment && user` and if true, **always opens the assessment modal instead of navigating to the session**. The `checkAssessment` function also uses `.single()`, which **throws and returns an error** when no assessment exists yet — causing `hasAssessment` to stay `false` permanently.

This creates an infinite loop:
1. User clicks "Start" → assessment modal opens
2. User completes or dismisses assessment → `hasAssessment` is set to `true`
3. But they have to click "Start" again manually since no navigation happens after the modal

**Fix**: 
- Replace `.single()` with `.maybeSingle()` in `checkAssessment`
- After `handleAssessmentComplete`, automatically navigate to the intended session instead of making the user click again
- Store the "pending session" in state so the navigation can be completed after the assessment

---

## Files to Change

### 1. `src/components/modals/RedeemCodeModal.tsx`
- Replace `.single()` → `.maybeSingle()` on the `unlock_codes` lookup
- Replace `.single()` → `.maybeSingle()` on the `programs` lookup (kit_id branch)
- Replace `.single()` → `.maybeSingle()` on the `user_program_access` existingAccess check
- Add more specific error logging so real DB errors show a different message than "code not found"

### 2. `src/pages/ProgramView.tsx`
- Replace `.single()` → `.maybeSingle()` in `checkAssessment()`
- Add a `pendingSessionId` state variable to store the session the user wanted to open
- In `handleSessionClick`, save `pendingSessionId` before opening the assessment modal
- In `handleAssessmentComplete`, after setting `hasAssessment = true`, automatically navigate to `pendingSessionId` if it exists
- Also fix `checkAccess` and `fetchProgramTest` to use `.maybeSingle()` for safety

---

## Technical Details

```text
// RedeemCodeModal.tsx - the critical fix

// BEFORE (throws on no rows):
.eq("code", code.toUpperCase())
.single();

// AFTER (returns null on no rows):
.eq("code", code.toUpperCase())
.maybeSingle();
```

```text
// ProgramView.tsx - session click flow fix

// New state:
const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

// Updated handleSessionClick:
const handleSessionClick = (sessionId: string, isLocked: boolean) => {
  if (isLocked) return;
  if (!hasAssessment && user) {
    setPendingSessionId(sessionId);  // Save where to go
    setIsAssessmentOpen(true);
    return;
  }
  window.location.href = `/programs/${program?.id}/session/${sessionId}`;
};

// Updated handleAssessmentComplete:
const handleAssessmentComplete = (level: string) => {
  setHasAssessment(true);
  setUserSkillLevel(level);
  // Auto-navigate after assessment
  if (pendingSessionId && program) {
    window.location.href = `/programs/${program.id}/session/${pendingSessionId}`;
  }
};
```
