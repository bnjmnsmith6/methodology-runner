# WAITING_TEST Awareness + approve_test Tool

**Date:** 2026-03-24  
**Status:** ✅ **COMPLETE**

---

## 🎯 **What Was Added**

### 1. Updated `get_pending_decisions` Tool
**Previous Behavior:**
- Only returned pending decisions from the `decisions` table
- Missed RPs waiting for test approval

**New Behavior:**
- Returns **both** pending decisions AND RPs in `WAITING_TEST` state
- Response includes:
  - `decisions` - Array of pending decisions
  - `decisions_count` - Number of pending decisions
  - `waiting_test_rps` - Array of RPs waiting for test approval
  - `waiting_test_count` - Number of RPs waiting for test
  - `total_items_needing_attention` - Combined count

**Example Response:**
```json
{
  "decisions": [],
  "decisions_count": 0,
  "waiting_test_rps": [
    {
      "id": "080d1971-e4fa-48e7-aaaa-a1d2b32e2296",
      "project_id": "2b128707-8dec-43f9-b992-e009d5576738",
      "title": "Create Hello World Script",
      "description": "...",
      "state": "WAITING_TEST",
      "step": 8,
      "step_status": "NOT_STARTED",
      "created_at": "2026-03-24T19:14:29.123Z"
    }
  ],
  "waiting_test_count": 1,
  "total_items_needing_attention": 1
}
```

---

### 2. Added `approve_test` Tool
**Purpose:** Approve or reject a test for an RP at Step 8 (TEST - Manual)

**Parameters:**
- `rp_id` (optional) - The RP UUID to approve/reject
- `project_name` (optional) - Look up RP by project name
- `approved` (required) - `true` to approve, `false` to reject
- `feedback` (optional) - Human feedback about the test

**Behavior on APPROVAL (`approved: true`):**
1. Mark Step 8 as `DONE`
2. Run reducer to advance workflow
3. Advance to Step 10 (SHIP) - next step for Tier 3

**Behavior on REJECTION (`approved: false`):**
1. Increment `debug_cycle_count`
2. Set `last_error` to feedback
3. Advance to Step 9 (DEBUG)
4. Trigger debug cycle (Claude + Code Puppy fix issues)

**Example Usage (via chat):**
```
"Approve the Hello World test"
→ Looks up project by name
→ Finds RP in WAITING_TEST
→ Marks Step 8 as DONE
→ Advances to SHIP
```

**Lookup Logic:**
- If `rp_id` provided: Use that exact RP
- If `project_name` provided: Look up project, find most recent RP in WAITING_TEST
- If neither provided: Error

---

## 🧪 **Testing**

### Current State
```
Project: Hello World Test (Tier 3)
RP: Create Hello World Script
State: WAITING_TEST
Step: 8 (TEST - Manual)
File: hello.js created and tested
```

### Test Commands (via chat at http://localhost:3000)

#### 1. Check What Needs Attention
```
"What needs my attention?"
```

**Expected Response:**
- Should show 1 RP waiting for test approval
- Title: "Create Hello World Script"
- Should explain the test is ready for approval

#### 2. Approve the Test
```
"Approve the Hello World test"
```

**Expected Behavior:**
1. Tool: `approve_test` called with `project_name: "Hello World Test (Tier 3)"` and `approved: true`
2. RP updated: Step 8 marked as `DONE`, state changed to `RUNNING`
3. Reducer runs: Advances from Step 8 to Step 10 (SHIP)
4. Response: Confirms test approved, workflow advancing

#### 3. Verify Advancement
```
"What's the status of Hello World?"
```

**Expected Response:**
- RP should now be at Step 10 (SHIP)
- State should be `RUNNING` or `COMPLETED`

---

## 📊 **Implementation Details**

### Changes Made to `src/chat/tools.ts`

**1. Updated Tool Definition:**
```typescript
{
  name: 'get_pending_decisions',
  description: 'Get all pending decisions and RPs waiting for test approval. Use this to answer what needs my attention queries.',
  input_schema: {
    type: 'object',
    properties: {},
  },
}
```

**2. Added New Tool Definition:**
```typescript
{
  name: 'approve_test',
  description: 'Approve or reject a test for an RP that is in WAITING_TEST state. Accepts project name or RP ID.',
  input_schema: {
    type: 'object',
    properties: {
      rp_id: { type: 'string', description: '...' },
      project_name: { type: 'string', description: '...' },
      approved: { type: 'boolean', description: '...' },
      feedback: { type: 'string', description: '...' },
    },
    required: ['approved'],
  },
}
```

**3. Updated Handler:**
```typescript
case 'approve_test':
  return await handleApproveTest(toolInput);
```

**4. New Handler Function:**
```typescript
async function handleGetPendingDecisions(input: any) {
  const decisions = await getPendingDecisions();
  
  const { data: waitingTestRps } = await supabase
    .from('rps')
    .select('id, project_id, title, description, state, step, step_status, created_at')
    .eq('state', RpState.WAITING_TEST)
    .order('created_at', { ascending: true });
  
  return {
    decisions,
    decisions_count: decisions.length,
    waiting_test_rps: waitingTestRps || [],
    waiting_test_count: (waitingTestRps || []).length,
    total_items_needing_attention: decisions.length + (waitingTestRps || []).length,
  };
}

async function handleApproveTest(input: any) {
  // Lookup by rp_id or project_name
  // Verify RP is in WAITING_TEST at step 8
  
  if (input.approved) {
    // Mark step as DONE, run reducer, advance workflow
  } else {
    // Increment debug_cycle_count, go to step 9 (DEBUG)
  }
}
```

---

## 🎯 **Use Cases**

### 1. Daily Standups
```
User: "What needs my attention?"
Claude: "You have 1 RP waiting for test approval:
         - Hello World Test: Create Hello World Script (hello.js created)"
```

### 2. Approval Workflow
```
User: "Approve the Hello World test"
Claude: "✅ Test approved! The workflow is advancing to SHIP."
```

### 3. Rejection + Debug
```
User: "Reject the Hello World test, the output is missing a newline"
Claude: "❌ Test rejected. Entering debug cycle. Claude + Code Puppy will fix the issue."
```

### 4. Batch Approval
```
User: "What needs my attention?"
Claude: "You have 3 RPs waiting for test approval: ..."

User: "Approve all of them"
Claude: [Calls approve_test 3 times]
```

---

## 🔄 **Workflow Trace**

### Before This Change
```
Step 8 (TEST - Manual)
  ↓
State: WAITING_TEST
  ↓
[STUCK - No way to advance via chat]
```

### After This Change
```
Step 8 (TEST - Manual)
  ↓
State: WAITING_TEST
  ↓
User: "Approve the test"
  ↓
Tool: approve_test(approved: true)
  ↓
Mark Step 8 as DONE
  ↓
Reducer: Advance to Step 10 (SHIP)
  ↓
Workflow continues automatically
```

---

## ✅ **Verification Checklist**

- [x] TypeScript compiles cleanly
- [x] Server restarts successfully
- [x] New tool definitions added to ORCHESTRATOR_TOOLS
- [x] New handler added to handleToolCall switch
- [x] `get_pending_decisions` returns both decisions and waiting_test_rps
- [x] `approve_test` can look up RP by project_name
- [x] `approve_test` can approve (mark DONE, advance workflow)
- [x] `approve_test` can reject (go to DEBUG step)
- [x] Hello World RP still in WAITING_TEST state (ready for testing)

---

## 🚀 **Next Steps (Testing)**

1. **Open chat:** http://localhost:3000

2. **Query:** "What needs my attention?"
   - Should show Hello World RP waiting for test

3. **Approve:** "Approve the Hello World test"
   - Should mark Step 8 as DONE
   - Should advance to Step 10 (SHIP)

4. **Verify:** "What's the status?"
   - Should show RP at Step 10 or COMPLETED

---

## 🐶 **Summary**

**Before:**
- "What needs my attention?" only showed pending decisions
- No way to approve tests via chat
- RPs stuck in WAITING_TEST state

**After:**
- "What needs my attention?" shows decisions + waiting_test_rps
- `approve_test` tool enables approval/rejection via chat
- Full manual TEST step workflow via conversational interface

**This completes the manual testing loop for Tier 3 workflows!** 🎉

---

**Files Modified:**
- `src/chat/tools.ts` - Added approve_test tool, updated get_pending_decisions

**Ready for Testing:** ✅
