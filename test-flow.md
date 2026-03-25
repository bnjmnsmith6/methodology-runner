# Testing the PBCA → REVIEW flow

## Steps to reproduce

1. Create a new Tier 1 project with an RP
2. Start the project
3. Watch PBCA_RESEARCH complete
4. Check what happens next - should be CLAUDE_REVIEW, not another PBCA_RESEARCH

## Expected flow
- Step 3 (RESEARCH) job completes → step_status = DONE
- Reducer advances: step=4, step_status=NOT_STARTED
- Orphan scanner finds step=4, NOT_STARTED
- Reducer enqueues CLAUDE_REVIEW

## Actual behavior (reported)
- PBCA_RESEARCH runs twice
- Then jumps to step 5

## Hypothesis
There might be a race condition or the reducer is being called multiple times with stale state.

## Debug strategy
Add logging to:
1. advanceWorkflow - to see when it's called and with what state
2. Reducer - to see what state it receives
3. Job completion handler - to see the sequence of events
