# REDO Loop Safeguard Implementation

## Problem
The automated PBCA output is currently thin on context (expected until vision conversation feature is added). This causes CLAUDE_REVIEW to consistently return REDO verdicts, creating an infinite loop:

```
PBCA → REVIEW (REDO) → PBCA → REVIEW (REDO) → PBCA → ...
```

## Solution
Added a safeguard that converts the 2nd REDO to a human decision instead of retrying indefinitely.

## Implementation Details

### New Function: `countJobsByType()`
Location: `src/adapters/claude-brain/context/job-context.ts`

```typescript
export async function countJobsByType(rpId: string, jobType: JobType): Promise<number>
```

Counts how many jobs of a specific type have been created for an RP.

### Modified: REDO Handling in `RealClaudeAdapter.runReview()`
Location: `src/adapters/claude-brain/real-claude.ts`

**Before:**
```typescript
if (verdict === 'REDO') {
  return {
    status: 'FAILED',
    error: { kind: 'REVIEW_REDO', retryable: true },
    ...
  };
}
```

**After:**
```typescript
if (verdict === 'REDO') {
  // Count PBCA attempts
  const pbcaAttempts = await countJobsByType(job.rp_id!, JobType.PBCA_RESEARCH);
  
  if (pbcaAttempts >= 2) {
    // 2nd REDO → Escalate to human decision
    return {
      status: 'STOP_AND_ASK',
      stopAndAsk: {
        question: `Research quality is below the review threshold after ${pbcaAttempts} attempts. What would you like to do?`,
        options: [
          'Proceed with spec writing anyway',
          'Let me provide more context (will re-run research)',
          'Cancel this RP',
        ],
      },
      ...
    };
  }
  
  // First REDO → Retry normally
  return {
    status: 'FAILED',
    error: { kind: 'REVIEW_REDO', retryable: true },
    ...
  };
}
```

## Flow Diagram

### Without Safeguard (Infinite Loop):
```
PBCA #1 → REVIEW → REDO → PBCA #2 → REVIEW → REDO → PBCA #3 → ...
```

### With Safeguard (Human Decision):
```
PBCA #1 → REVIEW → REDO → PBCA #2 → REVIEW → REDO → DECISION
                                                        ├─ Option 1: Proceed anyway → SPEC
                                                        ├─ Option 2: Provide context → Back to RESEARCH
                                                        └─ Option 3: Cancel RP → CANCELED
```

## Decision Options

When the safeguard triggers, Ben is presented with 3 options:

### 1. "Proceed with spec writing anyway"
- Advances RP to SPEC step
- Accepts that research quality is below ideal
- Useful when Ben knows the context is sufficient despite review concerns

### 2. "Let me provide more context (will re-run research)"
- Returns RP to RESEARCH step
- Allows Ben to add more vision context
- Re-runs PBCA with additional information
- **Future:** Will integrate with vision conversation feature

### 3. "Cancel this RP"
- Marks RP as CANCELED
- Prevents further processing
- Cleans up the workflow queue

## Logging

When the safeguard triggers, you'll see:
```
   ↩️  Review recommends re-running research
   📊 PBCA attempts so far: 2
   ⚠️  PBCA has run 2 times - escalating to human decision
```

## Benefits

1. **Prevents infinite loops** - No more wasted API calls
2. **Clear feedback** - Ben knows why the decision is needed
3. **Flexible resolution** - Three clear paths forward
4. **Cost control** - Stops expensive PBCA retries
5. **Future-ready** - Integrates cleanly with upcoming vision feature

## Testing

To test the safeguard:
1. Create a Tier 1 project with a minimal RP description
2. Activate the project
3. Watch PBCA run and REVIEW return REDO
4. PBCA runs again automatically
5. REVIEW returns REDO again
6. **Safeguard triggers** → Decision created instead of 3rd PBCA run
7. Check decision queue: `curl -X POST http://localhost:3000/chat -H 'Content-Type: application/json' -d '{"message": "Show pending decisions"}'`

## Related Files

- `src/adapters/claude-brain/real-claude.ts` - Main logic
- `src/adapters/claude-brain/context/job-context.ts` - Helper function
- `src/core/types.ts` - ExecutionResult interface
- `src/adapters/claude-brain/types.ts` - ReviewVerdict type

## Future Enhancements

When the vision conversation feature is added:
- Option 2 will trigger an interactive vision conversation
- Ben can provide additional context through structured dialogue
- PBCA will re-run with enriched vision data
- Review quality should improve, reducing REDO frequency

---

**Status:** ✅ Implemented and tested  
**Version:** v1.0  
**Date:** 2026-03-24
