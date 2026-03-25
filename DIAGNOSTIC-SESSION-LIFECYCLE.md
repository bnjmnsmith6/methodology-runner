# 🔍 DIAGNOSTIC: Vision Session Lifecycle Investigation

**Date:** 2025-03-25  
**Status:** DIAGNOSTIC LOGGING ADDED - READY FOR TESTING  
**Commits:** ebda3c6, 498aa5c

---

## The Reported Bug

**User says:** After completing vision conversation and seeing decomposition summary, when user says "yes", it routes to `continue_vision` instead of `approve_vision`.

**Expected behavior:**
```
User: "enough, just go"
  → Session completes
  → Vision doc built
  → Summary shown
User: "yes"
  → Routes to orchestrator
  → Orchestrator calls approve_vision
  → Project created ✅
```

**Actual behavior (suspected):**
```
User: "enough, just go"
  → Session completes
  → Vision doc built
  → Summary shown
User: "yes"
  → Routes to continue_vision (WRONG!)
  → Tries to continue completed session ❌
```

---

## The Investigation

### Code Review (What SHOULD Happen)

**Session Completion Flow:**
1. `handleIntakeReply()` detects "start now" phrase
2. Calls `completeSession(sessionId)` (src/intake/sessionManager.ts:95)
3. `completeSession` calls `updateVisionSession(sessionId, { status: 'completed' })`
4. Database UPDATE sets status = 'completed'
5. Returns `type: 'ready'` to middleware
6. Middleware builds vision doc and sends summary

**Next Request ("yes") Flow:**
1. Middleware calls `getActiveIntake()`
2. `getActiveIntake` calls `getActiveSession()`
3. `getActiveSession` calls `getActiveSessionForUser()`
4. `getActiveSessionForUser` queries: `SELECT * FROM vision_sessions WHERE status = 'active'`
5. Should return NULL (because session is 'completed', not 'active')
6. Middleware routes to orchestrator
7. Orchestrator calls `approve_vision`

### Code Check Results

✅ **completeSession** does update status to 'completed' (line 95-100)  
✅ **getActiveSessionForUser** does filter by `status = 'active'` (line 113)  
✅ **Middleware** does check `activeSession.active` (line 48)  
✅ **Orchestrator** system prompt mentions calling `approve_vision` when user approves (line 75)

**Conclusion:** The code LOOKS correct. The bug might be:
- Database update failing silently
- Multiple sessions being created
- Timing issue
- Something else we haven't thought of

---

## What We Added

### 1. Comprehensive Logging (`498aa5c`)

**Added logs to trace session lifecycle:**

#### A) Session Completion (`src/intake/sessionManager.ts`)
```typescript
export async function completeSession(sessionId: string): Promise<void> {
  console.log(`   🏁 Completing session: ${sessionId}`);
  await updateVisionSession(sessionId, {
    status: 'completed',
  });
  console.log(`   ✅ Session ${sessionId} marked as COMPLETED in database`);
}
```

#### B) Active Session Lookup (`src/db/vision-repo.ts`)
```typescript
export async function getActiveSessionForUser(): Promise<VisionSession | null> {
  const { data, error } = await supabase
    .from('vision_sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('   🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)');
      return null;
    }
    throw new Error(`Failed to get active session: ${extractSupabaseError(error)}`);
  }

  console.log(`   🔍 getActiveSessionForUser: Found active session ${data.id} (status: ${data.status})`);
  return data as VisionSession;
}
```

#### C) Middleware Routing (`src/chat/server.ts`)
```typescript
const activeSession = await getActiveIntake();
console.log(`   🔍 Middleware: Active session check result: active=${activeSession.active}, sessionId=${activeSession.sessionId || 'none'}`);
if (activeSession.active && activeSession.sessionId) {
  // Route to vision flow...
}
```

#### D) Vision Completion Detection (`src/chat/server.ts`)
```typescript
if (intakeResponse.visionSessionComplete && intakeResponse.type === 'ready') {
  console.log(`   🎉 Vision session completed! Building Vision Document...`);
  console.log(`   📝 Session should now be status='completed' in database`);
  // Build vision doc...
}
```

### 2. Test Plan Document (`ebda3c6`)

Created `docs/TEST-Vision-Session-Lifecycle.md` with:
- Detailed manual test procedure
- Expected logs for each step
- 4 hypotheses for root cause
- Debugging next steps
- Success criteria

---

## How to Test

### Run the Server
```bash
npm run dev
open http://localhost:3000
# Watch terminal for logs
```

### Test Conversation
```
1. User: "Build a dashboard"
   → Watch for: "No active sessions found"
   → Watch for: "routing to orchestrator"
   → Watch for: "Tool call: start_vision"

2. User: "For managers"
   → Watch for: "Found active session <uuid> (status: active)"
   → Watch for: "Bypassing orchestrator"

3. User: "enough, just go"
   → Watch for: "Completing session: <uuid>"
   → Watch for: "Session <uuid> marked as COMPLETED"
   → Watch for: "Vision session completed!"

4. User: "yes"  ← THE CRITICAL TEST
   → EXPECTED: "No active sessions found (all completed/abandoned)"
   → EXPECTED: "routing to orchestrator"
   → EXPECTED: "Tool call: approve_vision"
   
   → BUG IF: "Found active session <uuid>"
   → BUG IF: "Bypassing orchestrator"
```

---

## Interpreting the Logs

### ✅ CORRECT Behavior (Session Properly Completed)

**Step 3 logs:**
```
🏁 Completing session: abc-123
✅ Session abc-123 marked as COMPLETED in database
🎉 Vision session completed! Building Vision Document...
```

**Step 4 logs:**
```
🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)
🔍 Middleware: Active session check result: active=false, sessionId=none
➡️ No active vision session, routing to orchestrator
🔧 Tool call: approve_vision
```

### ❌ BUG: Session Not Being Completed

**Step 3 logs:**
```
⏭️ User wants to start now
🛑 Stop decision: user_requested (should stop: true)
[NO "Completing session" LOG!]  ← Missing!
[NO "marked as COMPLETED" LOG!]  ← Missing!
```

**Fix:** `completeSession()` not being called or failing

### ❌ BUG: Session Completed But Still Found As Active

**Step 3 logs:**
```
🏁 Completing session: abc-123
✅ Session abc-123 marked as COMPLETED in database
```

**Step 4 logs:**
```
🔍 getActiveSessionForUser: Found active session abc-123 (status: active)  ← WRONG!
```

**Fix:** Database update isn't working, or query is finding wrong session

### ❌ BUG: Orchestrator Not Calling approve_vision

**Step 4 logs:**
```
🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)
🔍 Middleware: Active session check result: active=false, sessionId=none
➡️ No active vision session, routing to orchestrator
[NO "Tool call: approve_vision"]  ← Missing!
```

**Fix:** Update system prompt or add explicit detection for approval phrases

---

## Next Steps

1. **RUN MANUAL TEST** with the 4-step conversation above
2. **CAPTURE LOGS** from all steps (especially steps 3 and 4)
3. **COMPARE TO EXPECTED LOGS** in this document
4. **IDENTIFY ROOT CAUSE** from the log patterns
5. **IMPLEMENT FIX** based on which logs are missing/wrong
6. **RE-TEST** to verify fix

---

## Files Changed

### Modified (Diagnostic Logging)
- `src/intake/sessionManager.ts` - completeSession logging
- `src/db/vision-repo.ts` - getActiveSessionForUser logging
- `src/chat/server.ts` - middleware routing + completion logging

### New (Documentation)
- `docs/TEST-Vision-Session-Lifecycle.md` - Detailed test plan
- `DIAGNOSTIC-SESSION-LIFECYCLE.md` - This file

**Total:** 3 modified, 2 new

---

## Expected Outcome

After running the manual test, we will have **definitive proof** of:
- Whether session completion is working
- Whether active session lookup is correct
- Where the routing logic breaks
- What needs to be fixed

**The logs will tell us exactly what's happening!** 🔍

---

## Status

- ✅ Diagnostic logging added
- ✅ Test plan documented
- ✅ Code reviewed
- ⏳ **READY FOR MANUAL TESTING**
- ⏳ Pending: Root cause identification
- ⏳ Pending: Bug fix implementation

**Next: Run the test and check the logs!**
