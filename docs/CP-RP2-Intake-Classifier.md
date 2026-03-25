# Constellation Packet — RP-2: Intake Classifier + Coverage Model
**Project:** GUPPI Vision Conversation Mode
**Tier:** 2
**Date:** 2026-03-25
**Dependencies:** RP-1 (Data Layer) must be complete

---

## Context Block

RP-1 built the database tables and TypeScript types. This RP builds the brain that decides what happens when a user sends their first message: should GUPPI skip straight to building, ask 1-3 quick questions, or run a fuller conversation?

The PBCA research recommends a three-tier classifier (fast-path / micro-vision / full-vision) with a weighted coverage model that tracks what the system knows vs. what it needs. The classifier runs once on the initial message. The coverage model tracks state throughout the conversation and determines when to stop asking.

This is pure logic — no LLM calls, no chat integration, no database writes. Just functions that take text in and return decisions out.

**Tech Stack:** TypeScript, imports from `src/types/vision.ts`

---

## Implementation Spec

### What to Build

Two modules:
1. **Request Parser + Classifier:** Analyzes the user's initial message and decides fast-path / micro-vision / full-vision
2. **Coverage Model:** Tracks which fields are known / assumed / unknown, and decides when the system has enough context to stop asking

### Build Order

**Step 1: Request Parser**

Create `src/intake/parseRequest.ts`:

```typescript
export interface ParsedRequest {
  rawMessage: string;
  
  // Extracted signals
  artifactType?: string;        // "file", "api endpoint", "dashboard", "script", etc.
  specificArtifact?: string;     // "hello.js", "GET /api/status", etc.
  statedUsers?: string[];        // who it's for, if mentioned
  statedConstraints?: string[];  // tech, time, policy constraints mentioned
  statedDoneState?: string;      // what "done" looks like, if mentioned
  mentionsIntegrations: boolean; // references external systems, APIs, databases
  mentionsAuth: boolean;         // references auth, permissions, roles, security
  mentionsData: boolean;         // references data migration, schemas, storage
  mentionsMobileOrUI: boolean;   // references UI, mobile, responsive, design
  
  // Complexity signals
  wordCount: number;
  sentenceCount: number;
  questionMarks: number;         // user asking questions = ambiguity
  specificity: 'high' | 'medium' | 'low';  // how precise is the request?
  componentCount: number;        // how many distinct things are being asked for?
}

export function parseRequest(message: string): ParsedRequest
```

Implementation notes:
- This does NOT call an LLM. It uses keyword detection and heuristics.
- `specificity` is 'high' if the message names exact files, endpoints, or technologies; 'medium' if it describes a category ("a dashboard"); 'low' if it's vague ("improve the system").
- `componentCount` estimates how many distinct deliverables are implied. "Build a server with auth and a database" = 3 components. "Create hello.js" = 1 component.
- Use simple keyword lists for integration/auth/data/UI detection:
  - integrations: ["api", "integrate", "connect", "webhook", "third-party", "external", "import", "export", "sync"]
  - auth: ["auth", "login", "permission", "role", "security", "password", "token", "oauth", "session", "user access"]
  - data: ["database", "migration", "schema", "storage", "postgresql", "supabase", "mongodb", "data model", "table"]
  - ui: ["dashboard", "ui", "ux", "mobile", "responsive", "frontend", "design", "layout", "screen", "page"]

**Step 2: Path Classifier**

Create `src/intake/classifyPath.ts`:

```typescript
import { ParsedRequest } from './parseRequest';
import { IntakeDecision, IntakePath } from '../types/vision';

export function classifyPath(parsed: ParsedRequest): IntakeDecision
```

Classification rules (in order of evaluation):

**Fast-path if ALL of these are true:**
- `componentCount` <= 1
- `specificity` === 'high'
- `mentionsIntegrations` === false
- `mentionsAuth` === false
- `mentionsData` === false (unless it's a simple file/script)
- `wordCount` < 50
- No ambiguous language ("maybe", "something like", "not sure", "or")

Confidence: 0.9 if all criteria met cleanly, 0.7 if borderline

**Full-vision if ANY of these are true:**
- `componentCount` >= 4
- `mentionsAuth` === true AND `mentionsIntegrations` === true
- `specificity` === 'low' AND `componentCount` >= 2
- Message mentions multiple user roles or stakeholders
- Message mentions "rebuild", "redesign", "migrate", "overhaul"

Confidence: 0.8 for strong signals, 0.6 for weak signals

**Micro-vision: everything else**
- The default path when the request isn't trivially simple or clearly complex
- 1-3 clarifying turns expected

Confidence: 0.7 default

Return reasons as human-readable strings explaining why this path was chosen:
- "Single specific file requested with clear acceptance criteria"
- "Multiple components detected: auth, data, UI"
- "Request is vague — need to clarify target user and done state"

Return missingFields listing the coverage fields that are currently unknown.

**Step 3: Coverage Model**

Create `src/intake/coverageModel.ts`:

```typescript
import { CoverageState, CoverageStatus, IntakePath } from '../types/vision';

// Initialize coverage from a parsed request
export function initCoverage(parsed: ParsedRequest): CoverageState

// Update coverage based on a new user message
export function updateCoverage(current: CoverageState, newInfo: Record<string, string>): CoverageState

// Check if we have enough coverage to stop asking
export function hasEnoughCoverage(coverage: CoverageState, path: IntakePath): boolean

// Get the most important unknown field (the next thing to ask about)
export function getHighestValueUnknown(coverage: CoverageState, path: IntakePath): string | null

// Get a coverage summary for logging/debugging
export function getCoverageSummary(coverage: CoverageState): { known: number; assumed: number; unknown: number; total: number }
```

**Required coverage by path:**

Fast-path requires:
- artifact_type: known
- done_state: known or assumed

Micro-vision requires:
- artifact_type: known
- target_user: known or assumed
- done_state: known
- current_state: known or assumed
- constraints: known or assumed (at least one)

Full-vision requires all micro-vision fields PLUS:
- integrations: known
- data_auth_permissions: known
- non_obvious_risks: known or assumed
- decisions_already_made: known or assumed

**`hasEnoughCoverage` logic:**
Returns true when all required fields for the current path are 'known' or 'assumed'. The caller should also check turn count — if we've asked 3+ questions and coverage still isn't met, recommend switching to "start with assumptions" mode.

**`getHighestValueUnknown` logic:**
Priority order for what to ask next:
1. target_user (if unknown) — "Who is this for?"
2. done_state (if unknown) — "What does done look like?"
3. current_state (if unknown) — "What exists today?"
4. data_auth_permissions (if unknown and path is full-vision) — "Any data or auth requirements?"
5. constraints (if unknown) — "Any constraints I should know about?"
6. non_obvious_risks (if unknown and path is full-vision) — "What's the riskiest part?"
7. integrations (if unknown and path is full-vision) — "Does this connect to external systems?"

Return null when all required fields are covered.

**Step 4: Tests**

Create `src/intake/__tests__/classifier.test.ts`:

```typescript
// Test cases for the classifier

// Fast-path cases:
// - "Create hello.js that prints hello world" → fast-path, high confidence
// - "Rename the Save button to Publish" → fast-path, high confidence
// - "Add a console.log to server.ts line 42" → fast-path, high confidence

// Micro-vision cases:
// - "Build a landing page for my app" → micro-vision
// - "Make me a dashboard" → micro-vision
// - "Create an API for user management" → micro-vision

// Full-vision cases:
// - "Build a customer success dashboard with alerts, permissions, and Slack integration" → full-vision
// - "Rebuild the app onboarding and payment flow" → full-vision
// - "Create a multi-tenant SaaS admin panel with role-based access" → full-vision

// Edge cases:
// - Very long, detailed message with everything specified → should classify correctly even at high word count
// - One word: "dashboard" → micro-vision (not fast-path)
// - User says "just create something" → micro-vision (too vague for fast-path)
```

Create `src/intake/__tests__/coverage.test.ts`:

```typescript
// Test cases for coverage model

// - initCoverage from "Create hello.js that prints hello world" → artifact_type: known, done_state: known
// - initCoverage from "Build me a dashboard" → artifact_type: known, most others: unknown
// - hasEnoughCoverage for fast-path with artifact + done_state → true
// - hasEnoughCoverage for micro-vision missing target_user → false
// - getHighestValueUnknown for micro-vision missing target_user → "target_user"
// - updateCoverage marks field as known when info provided
```

Run tests with whatever test runner the project uses (likely jest or vitest). If no test runner is configured, use a simple script that calls the functions and asserts results.

**Step 5: Index file**

Create `src/intake/index.ts`:

```typescript
export { parseRequest } from './parseRequest';
export type { ParsedRequest } from './parseRequest';
export { classifyPath } from './classifyPath';
export { initCoverage, updateCoverage, hasEnoughCoverage, getHighestValueUnknown, getCoverageSummary } from './coverageModel';
```

### File Structure

```
src/
  intake/
    parseRequest.ts          # NEW — keyword extraction and signal detection
    classifyPath.ts          # NEW — fast-path / micro / full classification
    coverageModel.ts         # NEW — coverage tracking and stop decisions
    index.ts                 # NEW — exports
    __tests__/
      classifier.test.ts     # NEW — classifier tests
      coverage.test.ts       # NEW — coverage model tests
```

---

## Constraints (What NOT to Do)

- DO NOT call any LLM API — this is pure TypeScript logic
- DO NOT import or modify any existing chat tools, adapters, or worker code
- DO NOT write to the database — these are pure functions that return data
- DO NOT over-engineer the keyword lists — simple string matching is fine for v1
- DO NOT try to handle every edge case — the classifier will be wrong sometimes, and that's okay because micro-vision is the safe default
- DO NOT add npm dependencies — use only built-in string methods

---

## Stop and Ask List

1. **Test runner.** If the project doesn't have a test framework, ask whether to add vitest/jest or just write assertion scripts.
2. **Existing types.** If `src/types/vision.ts` doesn't exist yet (RP-1 not complete), stop. This RP depends on RP-1.

---

## Acceptance Criteria

- [ ] `parseRequest` extracts signals from natural language messages
- [ ] `classifyPath` returns fast-path for "Create hello.js that prints hello world"
- [ ] `classifyPath` returns micro-vision for "Build me a dashboard"
- [ ] `classifyPath` returns full-vision for "Build a multi-tenant admin panel with auth and Slack integration"
- [ ] `classifyPath` never returns fast-path when auth or integrations are mentioned
- [ ] `initCoverage` correctly marks fields as known/unknown based on parsed request
- [ ] `hasEnoughCoverage` returns true for fast-path when artifact + done_state are known
- [ ] `hasEnoughCoverage` returns false for micro-vision when target_user is unknown
- [ ] `getHighestValueUnknown` returns the right next question field
- [ ] All test cases pass
- [ ] No LLM API calls anywhere in this module
- [ ] TypeScript compiles cleanly
- [ ] No changes to existing code outside src/intake/
