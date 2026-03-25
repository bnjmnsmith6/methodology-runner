# Constellation Packet — RP-3: Conversation Manager
**Project:** GUPPI Vision Conversation Mode
**Tier:** 2
**Date:** 2026-03-25
**Dependencies:** RP-1 (Data Layer), RP-2 (Intake Classifier + Coverage Model)

---

## Context Block

RP-1 built the database. RP-2 built the classifier and coverage model. This RP builds the conversation engine — the module that actually talks to the user, asks one question at a time, tracks what it's learned, summarizes progress, detects pivots, and decides when to stop.

The PBCA research is clear on the UX principles:
- **One primary question per turn.** Not multi-part prompts.
- **Summary every 1-2 turns.** So the user (ADHD, mobile-first) can re-orient after distraction.
- **"Start now with assumptions" escape hatch.** Always available.
- **Pivot detection.** If the user changes direction, acknowledge and reset.
- **Short messages.** Mobile screen, burst thinker. No walls of text.

The conversation manager does NOT create projects or RPs. It produces a finalized Vision Session that RP-4 will turn into a Vision Document and RP decomposition.

This module DOES call the LLM — it uses Claude Sonnet to generate contextual questions and summaries. The classifier and coverage model (RP-2) are pure logic, but the conversation itself needs natural language generation.

**Tech Stack:** TypeScript, Anthropic API (Claude Sonnet), imports from RP-1 types and RP-2 functions, Supabase via vision-repo

---

## Implementation Spec

### What to Build

A conversation manager that:
1. Takes the classified intake decision and starts a session
2. Generates the next best question based on coverage gaps
3. Processes user replies and updates coverage
4. Summarizes current understanding every 1-2 turns
5. Detects when the user pivots or contradicts earlier input
6. Decides when to stop asking (coverage met, user says "go", or max turns)
7. Provides a "start now with assumptions" escape at every turn

### Build Order

**Step 1: Session Manager**

Create `src/intake/sessionManager.ts`:

```typescript
import { VisionSession, IntakeDecision, CoverageState } from '../types/vision';
import { createVisionSession, updateVisionSession, addVisionMessage, getVisionMessages } from '../db/vision-repo';
import { initCoverage } from './coverageModel';

// Start a new vision session from the classifier's decision
export async function startSession(
  initialMessage: string,
  decision: IntakeDecision
): Promise<VisionSession>
// Creates a vision_sessions row
// Initializes coverage from the parsed request
// Adds the initial user message to vision_messages
// Returns the session

// Get the current session state with all messages
export async function getSessionWithMessages(sessionId: string): Promise<{
  session: VisionSession;
  messages: VisionMessage[];
}>

// Mark session as completed
export async function completeSession(sessionId: string): Promise<void>

// Mark session as abandoned
export async function abandonSession(sessionId: string): Promise<void>
```

**Step 2: Question Generator**

Create `src/intake/nextQuestion.ts`:

This is the core of the conversation. It uses Claude Sonnet to generate a natural, contextual question based on what's missing.

```typescript
import { VisionSession, VisionMessage, CoverageState } from '../types/vision';
import { getHighestValueUnknown } from './coverageModel';

export interface ConversationTurn {
  summary: string;          // 1-2 sentence summary of current understanding
  question: string;         // the primary question
  quickOptions?: string[];  // 2-4 short answer suggestions (for future UI chips)
  escapeOption: string;     // always present: "start now with assumptions" phrasing
  turnNumber: number;
}

export async function generateNextTurn(
  session: VisionSession,
  messages: VisionMessage[],
  coverage: CoverageState
): Promise<ConversationTurn>
```

Implementation:
- Call `getHighestValueUnknown(coverage, session.path)` to determine WHAT to ask about
- If it returns null, return a "ready to proceed" turn instead of a question
- Call Claude Sonnet with a system prompt that instructs it to:
  1. Read the conversation so far
  2. Produce a 1-2 sentence summary of current understanding
  3. Ask ONE question about the identified gap
  4. Suggest 2-4 quick answer options when appropriate
  5. Always include a "start now" escape phrasing

**The Claude system prompt for question generation:**

```
You are GUPPI's intake assistant. You're having a brief conversation to understand what the user wants to build before starting work.

Rules:
1. You've already classified this request as needing clarification.
2. Ask ONE question per turn. Never ask multiple questions.
3. Start each turn with a 1-2 sentence summary: "Here's my read so far: ..."
4. Then ask the ONE most important question.
5. Suggest 2-4 quick answers when the question has common responses.
6. Always end with an escape: "Or just say 'start now' and I'll begin with reasonable defaults."
7. Keep messages SHORT. The user is on mobile.
8. Never be condescending. Never ask obvious questions.
9. If the user gives a one-word answer, accept it and move on.
10. Be warm but efficient. Think smart colleague, not intake form.

The field you need to ask about: {fieldName}
Field description: {fieldDescription}

Conversation so far:
{conversationHistory}

Current understanding:
{coverageSummary}
```

**Field descriptions for the prompt** (map field names to natural descriptions):
```typescript
const FIELD_DESCRIPTIONS: Record<string, string> = {
  target_user: "Who will use this? What role, team, or person?",
  done_state: "What does 'done' look like? How will you know it works?",
  current_state: "What exists today? Is this replacing something or starting fresh?",
  user_problem: "What problem does this solve? What pain point?",
  constraints: "Any technical, time, or business constraints?",
  data_auth_permissions: "Any database, auth, login, or permission requirements?",
  integrations: "Does this connect to external systems or APIs?",
  non_obvious_risks: "What's the riskiest or most uncertain part?",
  must_not_do: "Anything explicitly out of scope or off-limits?",
  decisions_already_made: "Any choices you've already locked in?"
};
```

**Token budget for this call:** Keep it cheap. Use `max_tokens: 300`. The response should be short.

**Step 3: Reply Processor**

Create `src/intake/processReply.ts`:

```typescript
import { VisionSession, CoverageState } from '../types/vision';

export interface ProcessedReply {
  updatedCoverage: CoverageState;
  detectedPivot: boolean;
  pivotDescription?: string;
  extractedInfo: Record<string, string>;  // field -> value extracted from reply
  userWantsToStart: boolean;              // detected "start now" / "just go" / "enough"
}

export async function processUserReply(
  session: VisionSession,
  messages: VisionMessage[],
  newMessage: string,
  currentCoverage: CoverageState
): Promise<ProcessedReply>
```

Implementation:
- Call Claude Sonnet with the conversation history and the new message
- Ask it to extract structured information: which coverage fields does this message address?
- Ask it to detect pivots: did the user change direction from what was previously understood?
- Ask it to detect "start now" signals: "just go", "start now", "enough", "that's it", "begin", "build it"

**The Claude system prompt for reply processing:**

```
You are processing a user's reply in a project intake conversation.

Given the conversation history and the new message, extract:

1. FIELD_UPDATES: Which coverage fields does this message address? Return as JSON:
   {"field_name": "extracted value", ...}
   Valid fields: target_user, done_state, current_state, user_problem, constraints, 
   data_auth_permissions, integrations, non_obvious_risks, must_not_do, decisions_already_made

2. PIVOT: Did the user change direction from what was previously discussed? 
   Return: {"detected": true/false, "description": "what changed"}

3. START_NOW: Does the user want to skip further questions and start building?
   Return: {"detected": true/false}

Respond ONLY with JSON:
{
  "field_updates": {...},
  "pivot": {"detected": false, "description": ""},
  "start_now": {"detected": false}
}
```

**Token budget:** `max_tokens: 400`

Parse the JSON response. If JSON parsing fails, fall back to:
- Mark userWantsToStart = true if message contains "start", "go", "build", "enough", "begin"
- Mark no pivot
- Mark no field updates

**Step 4: Stop Decision**

Create `src/intake/stopDecision.ts`:

```typescript
import { VisionSession, CoverageState, IntakePath } from '../types/vision';
import { hasEnoughCoverage } from './coverageModel';

export type StopReason = 
  | 'coverage_met'        // all required fields covered
  | 'user_requested'      // user said "start now"
  | 'max_turns_reached'   // hit turn limit
  | 'low_info_replies'    // user giving minimal answers, switch to assumptions
  | 'continue';           // keep asking

export interface StopDecision {
  shouldStop: boolean;
  reason: StopReason;
  assumptionMode: boolean;  // if true, fill remaining unknowns with assumptions
}

export function shouldStopAsking(
  session: VisionSession,
  coverage: CoverageState,
  userWantsToStart: boolean,
  consecutiveLowInfoReplies: number
): StopDecision
```

Logic:
- If `userWantsToStart` → stop, reason: 'user_requested', assumptionMode: true
- If `hasEnoughCoverage(coverage, session.path)` → stop, reason: 'coverage_met', assumptionMode: false
- If `session.turn_count >= maxTurns(session.path)` → stop, reason: 'max_turns_reached', assumptionMode: true
- If `consecutiveLowInfoReplies >= 2` → stop, reason: 'low_info_replies', assumptionMode: true
- Otherwise → continue

Max turns by path:
- fast-path: 0 (should never enter conversation)
- micro-vision: 3
- full-vision: 8

**Step 5: Conversation Orchestrator**

Create `src/intake/conversationOrchestrator.ts`:

This ties everything together into a single function the chat server calls.

```typescript
import { IntakeDecision } from '../types/vision';

export interface IntakeResponse {
  type: 'question' | 'ready' | 'fast-path';
  sessionId?: string;
  message: string;            // the message to show the user
  quickOptions?: string[];    // suggested quick replies
  visionSessionComplete: boolean;
}

// Called when the user sends their FIRST message (new project intent)
export async function handleNewIntake(
  userMessage: string
): Promise<IntakeResponse>
// 1. Parse the request
// 2. Classify the path
// 3. If fast-path: return { type: 'fast-path', message: "Got it — starting now.", visionSessionComplete: true }
// 4. Otherwise: create session, generate first question, return it

// Called when the user replies during an active vision session
export async function handleIntakeReply(
  sessionId: string,
  userMessage: string
): Promise<IntakeResponse>
// 1. Load session and messages
// 2. Add user message to vision_messages
// 3. Process the reply (extract info, detect pivot, detect start-now)
// 4. Update coverage
// 5. Check stop decision
// 6. If should stop: complete session, return { type: 'ready', visionSessionComplete: true }
// 7. Otherwise: generate next turn, update session, return { type: 'question' }

// Check if there's an active vision session
export async function getActiveIntake(): Promise<{ active: boolean; sessionId?: string }>
```

**Step 6: Fast-path Vision Doc**

Create `src/intake/fastPathVision.ts`:

For fast-path requests, generate a minimal Vision Document without conversation.

```typescript
import { ParsedRequest } from './parseRequest';
import { VisionDocument } from '../types/vision';

export function buildFastPathVision(parsed: ParsedRequest): VisionDocument
// Creates a minimal Vision Document with:
// - source.initial_user_message = the raw message
// - classification.path = 'fast-path'
// - classification.complexity = 'simple'
// - intent.project_title = extracted from message
// - intent.one_sentence_brief = the message itself
// - intent.primary_outcome = the done state
// - done_definition.success_criteria = ["Output matches specification"]
// - Everything else empty or with sensible defaults
// - risk_register.assumptions = ["Request is self-contained", "No external dependencies"]
```

**Step 7: Index file**

Create/update `src/intake/index.ts` to export everything from RP-2 AND RP-3:

```typescript
// RP-2 exports
export { parseRequest } from './parseRequest';
export { classifyPath } from './classifyPath';
export { initCoverage, updateCoverage, hasEnoughCoverage, getHighestValueUnknown, getCoverageSummary } from './coverageModel';

// RP-3 exports
export { startSession, getSessionWithMessages, completeSession, abandonSession } from './sessionManager';
export { generateNextTurn } from './nextQuestion';
export { processUserReply } from './processReply';
export { shouldStopAsking } from './stopDecision';
export { handleNewIntake, handleIntakeReply, getActiveIntake } from './conversationOrchestrator';
export { buildFastPathVision } from './fastPathVision';
```

### File Structure

```
src/
  intake/
    parseRequest.ts              # FROM RP-2
    classifyPath.ts              # FROM RP-2
    coverageModel.ts             # FROM RP-2
    sessionManager.ts            # NEW — session CRUD
    nextQuestion.ts              # NEW — LLM-powered question generation
    processReply.ts              # NEW — LLM-powered reply extraction
    stopDecision.ts              # NEW — when to stop asking
    conversationOrchestrator.ts  # NEW — ties it all together
    fastPathVision.ts            # NEW — minimal Vision Doc for simple requests
    index.ts                     # UPDATED — add RP-3 exports
    __tests__/
      classifier.test.ts         # FROM RP-2
      coverage.test.ts           # FROM RP-2
      stopDecision.test.ts       # NEW
```

---

## Constraints (What NOT to Do)

- DO NOT create projects or RPs — that's RP-4 and RP-6
- DO NOT modify existing chat tools — that's RP-6
- DO NOT build the Vision Document generator from conversation — that's RP-4
- DO NOT build the decomposition engine — that's RP-4
- DO NOT build downstream context injection — that's RP-5
- DO NOT use more than 300-400 tokens per LLM call — keep costs low
- DO NOT ask the user multiple questions in one turn — ONE question only
- DO NOT generate long messages — mobile-first, 2-4 sentences max
- DO NOT skip the escape hatch — every question turn must include a "start now" option
- Use Claude Sonnet (claude-sonnet-4-20250514) for all LLM calls, same as the existing Claude Brain adapter

---

## Stop and Ask List

1. **Anthropic client.** Use the same Anthropic client/wrapper the Claude Brain adapter uses. Don't create a new one. Find it and reuse it.
2. **RP-2 not complete.** If `src/intake/parseRequest.ts` and `classifyPath.ts` don't exist, stop. This RP depends on RP-2.
3. **Supabase client.** Use the same Supabase client the rest of the app uses.

---

## Acceptance Criteria

- [ ] `handleNewIntake("Create hello.js that prints hello world")` returns `{ type: 'fast-path', visionSessionComplete: true }`
- [ ] `handleNewIntake("Build me a dashboard")` returns `{ type: 'question' }` with a natural question about who it's for
- [ ] Each question turn includes a summary, one question, and a "start now" escape
- [ ] User saying "just start" or "enough" triggers stop with assumption mode
- [ ] Coverage updates correctly when user provides information
- [ ] Pivot detection works when user changes direction
- [ ] Max turns limit prevents infinite questioning (3 for micro, 8 for full)
- [ ] Two consecutive low-info replies trigger assumption mode
- [ ] LLM calls use max_tokens 300-400 (cheap and fast)
- [ ] Messages are short enough for mobile (no walls of text)
- [ ] All session state persists to Supabase (survives server restart)
- [ ] TypeScript compiles cleanly
- [ ] No modifications to existing code outside src/intake/ and src/db/vision-repo.ts
