# 🧪 TEST PLAN: Vision Session Lifecycle Bug

**Date:** 2025-03-25  
**Issue:** After vision session completes, user says "yes" but it routes to `continue_vision` instead of `approve_vision`  
**Commit:** 498aa5c (diagnostic logging added)

---

## The Bug (Reported)

**Expected Flow:**
1. User describes project → Vision conversation starts
2. User says "enough, just go" → Session completes, vision doc built, summary shown
3. User says "yes" → Should call `approve_vision` and create project ✅

**Actual Flow (Bug):**
1. User describes project → Vision conversation starts
2. User says "enough, just go" → Session completes, vision doc built, summary shown
3. User says "yes" → Routes to `continue_vision` instead of `approve_vision` ❌

---

## Root Cause Hypotheses

### Hypothesis 1: Session not being marked 'completed'
**Check:** Does `completeSession()` actually update the database?

**Expected logs when session completes:**
```
🏁 Completing session: <uuid>
✅ Session <uuid> marked as COMPLETED in database
```

**If missing:** Session status update is failing → **BUG FOUND**

---

### Hypothesis 2: Middleware not checking status correctly
**Check:** Does `getActiveSessionForUser()` filter for `status = 'active'`?

**Expected query:**
```sql
SELECT * FROM vision_sessions 
WHERE status = 'active' 
ORDER BY created_at DESC 
LIMIT 1
```

**Code check:** ✅ Already verified in `src/db/vision-repo.ts` line 113

---

### Hypothesis 3: Completed session still treated as active
**Check:** When user says "yes", does middleware find an active session?

**Expected logs on "yes" message:**
```
🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)
🔍 Middleware: Active session check result: active=false, sessionId=none
➡️ No active vision session, routing to orchestrator
```

**If we see instead:**
```
🔍 getActiveSessionForUser: Found active session <uuid> (status: active)
🔍 Middleware: Active session check result: active=true, sessionId=<uuid>
🔄 Active vision session detected: <uuid>
```

→ **BUG FOUND: Session is still marked active**

---

### Hypothesis 4: Orchestrator not calling approve_vision
**Check:** If session correctly routes to orchestrator, does it know to call `approve_vision`?

**System prompt check:** ✅ Line 75 says "User approves → Call `approve_vision`"

**Context check:** Orchestrator receives conversation history including vision summary, so it should have context.

---

## Manual Test Procedure

### Setup
```bash
# Start server with logging visible
npm run dev
# Open browser
open http://localhost:3000
# Open terminal to watch server logs
```

### Test Steps

**Step 1: Start vision conversation**
```
User: "Build a real-time dashboard for tracking projects"
```

**Expected logs:**
```
💬 User: Build a real-time dashboard for tracking projects
🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)
🔍 Middleware: Active session check result: active=false, sessionId=none
➡️ No active vision session, routing to orchestrator
🔧 Tool call: start_vision
```

**Expected response:** Vision question

---

**Step 2: Answer first question**
```
User: "For engineering managers"
```

**Expected logs:**
```
💬 User: For engineering managers
🔍 getActiveSessionForUser: Found active session <uuid> (status: active)
🔍 Middleware: Active session check result: active=true, sessionId=<uuid>
🔄 Active vision session detected: <uuid>
➡️ Bypassing orchestrator, calling continue_vision directly
```

**Expected response:** Another vision question

---

**Step 3: Complete session**
```
User: "enough, just go"
```

**Expected logs:**
```
💬 User: enough, just go
🔍 getActiveSessionForUser: Found active session <uuid> (status: active)
🔍 Middleware: Active session check result: active=true, sessionId=<uuid>
🔄 Active vision session detected: <uuid>
⏭️ User wants to start now
🛑 Stop decision: user_requested (should stop: true)
🏁 Completing session: <uuid>
✅ Session <uuid> marked as COMPLETED in database    ← CRITICAL!
🎉 Vision session completed! Building Vision Document...
📝 Session should now be status='completed' in database
```

**Expected response:** Vision summary with RPs and "Say 'yes' to start"

---

**Step 4: Approve (THE BUG)**
```
User: "yes"
```

**Expected logs (CORRECT BEHAVIOR):**
```
💬 User: yes
🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)
🔍 Middleware: Active session check result: active=false, sessionId=none
➡️ No active vision session, routing to orchestrator
🔧 Tool call: approve_vision
✅ Created project "<name>" with N RP(s)
```

**Actual logs if BUG EXISTS:**
```
💬 User: yes
🔍 getActiveSessionForUser: Found active session <uuid> (status: active)  ← BUG!
🔍 Middleware: Active session check result: active=true, sessionId=<uuid>
🔄 Active vision session detected: <uuid>
➡️ Bypassing orchestrator, calling continue_vision directly  ← WRONG!
```

---

## Debugging Next Steps

### If session IS being marked 'completed' but middleware finds it:

**Cause:** Database query is wrong or there are multiple sessions

**Check:**
```sql
-- Manually query database
SELECT id, status, created_at, updated_at 
FROM vision_sessions 
ORDER BY created_at DESC 
LIMIT 5;
```

**Look for:**
- Is the latest session status = 'completed'?
- Are there multiple 'active' sessions?
- Is there a timing issue?

---

### If session is NOT being marked 'completed':

**Cause:** `updateVisionSession()` is failing silently

**Fix:** Add error logging:
```typescript
export async function completeSession(sessionId: string): Promise<void> {
  console.log(`   🏁 Completing session: ${sessionId}`);
  try {
    const result = await updateVisionSession(sessionId, {
      status: 'completed',
    });
    console.log(`   ✅ Session ${sessionId} marked as COMPLETED:`, result);
  } catch (error) {
    console.error(`   ❌ Failed to complete session:`, error);
    throw error;
  }
}
```

---

### If orchestrator doesn't call approve_vision:

**Cause:** Orchestrator doesn't have context or doesn't understand to call it

**Fix:** Update system prompt to be more explicit:
```
When the user says "yes", "approve", "looks good", or similar after seeing 
a vision summary, call `approve_vision` to create the project.
```

---

## Success Criteria

✅ Session status updates to 'completed' when user says "enough, just go"  
✅ Middleware finds NO active session on subsequent request  
✅ "yes" message routes to orchestrator  
✅ Orchestrator calls `approve_vision`  
✅ Project is created with RPs  

---

## Next Actions

1. **RUN MANUAL TEST** following steps above
2. **CAPTURE LOGS** from all 4 steps
3. **IDENTIFY BUG** from log output
4. **FIX BUG** based on root cause
5. **RE-TEST** to confirm fix

---

**This test plan will definitively identify where the session lifecycle breaks!** 🔍
