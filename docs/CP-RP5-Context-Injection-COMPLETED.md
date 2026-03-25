# RP-5: Downstream Context Injection - COMPLETED

**Status:** ✅ Complete  
**Date:** 2025-03-25  
**Dependencies:** RP-1 (Data Layer), RP-4 (Vision Doc + Decomposition)

---

## What Was Built

Context pack system that slices Vision Documents into role-specific payloads for downstream agents.

### 1. Context Pack Builders (`src/prompts/`)

**buildContextPack.ts** (251 lines) - Role-specific context slicing
- `buildPBCAContext()` - Research questions, assumptions, constraints
- `buildReviewContext()` - Decisions to validate, fixed choices
- `buildSpecContext()` - Tech constraints, acceptance examples, interface contracts
- `buildBuildContext()` - Only implementation requirements, testable criteria
- Pure logic functions (no LLM calls)

**renderContextPack.ts** (70 lines) - Text rendering for prompt injection
- `renderContextForPrompt()` - Formats context packs as markdown
- Skips empty sections for compact output
- Special labels for review mode

**persistContextPack.ts** (48 lines) - Database persistence
- `saveContextPack()` - Saves to context_packs table
- `loadContextPack()` - Retrieves by project/RP/consumer
- Null returns for backwards compatibility

**generateAllContextPacks.ts** (60 lines) - Batch generation
- `generateAndSaveContextPacks()` - Creates all packs for all RPs
- Iterates through 4 consumers × N RPs
- Error handling per pack

**index.ts** (7 lines) - Module exports

### 2. Adapter Modifications (Context Injection)

**PBCA Adapter** (`src/adapters/real-pbca.ts`)
- Added `loadContextPack` import
- Injects context BEFORE user prompt
- Backwards compatible (no context = works as before)

**Claude Review Context** (`src/adapters/claude-brain/context/review-context.ts`)
- Added Vision Document context to `rawPbcaOutput`
- Appends context after PBCA output with separator

**Claude Spec Context** (`src/adapters/claude-brain/context/spec-context.ts`)
- Added Vision Document context to `reviewOutput`
- Appends context after review output with separator

**Code Puppy Prompt Assembler** (`src/adapters/code-puppy/prompt-assembler.ts`)
- Updated `assembleBuildPrompt` signature to accept project_id/rp_id
- Injects context into system prompt
- Updated `real-codepuppy.ts` to pass IDs

---

## Context Pack Structure

Each consumer gets different slices:

### PBCA (Research)
- ✅ Research questions (`risk_register.unknowns` + `rpProposal.pbca_focus`)
- ✅ Assumptions to validate
- ✅ All constraints (tech + product + policy)
- ✅ Acceptance criteria
- ✅ Dependencies
- ✅ Non-goals

### Review
- ✅ Decisions to challenge (`decisions_made.fixed_choices` + `rejected_directions`)
- ✅ Assumptions to verify
- ✅ Acceptance criteria
- ✅ Review-specific focus areas (`downstream_context.review_focus`)
- ✅ Dependencies
- ✅ Non-goals

### Spec
- ✅ Tech constraints ONLY
- ✅ Acceptance criteria + examples
- ✅ Only fixed decisions (not assumptions)
- ✅ Dependencies with interface hints
- ✅ Out of scope
- ❌ No open questions (should be resolved)

### Build
- ✅ Tech constraints ONLY
- ✅ Testable criteria ONLY (filters for 'must', 'should', 'when', 'test')
- ❌ No assumptions (build from spec, not assumptions)
- ✅ Dependencies in concrete terms
- ✅ Out of scope
- ❌ No open questions

---

## Implementation Details

### Backwards Compatibility
- If `loadContextPack` returns null, adapters work exactly as before
- No breaking changes to existing prompt construction
- Context is PREPENDED to existing prompts (doesn't replace them)

### Separation Markers
- PBCA: `\n\n---\n\n` between context and prompt
- Review: `\n\n---\n\n## Vision Document Context\n\n`
- Spec: `\n\n---\n\n## Vision Document Context\n\n`
- Build: Injected into system prompt with `---` separator

### Error Handling
- `loadContextPack` catches errors and returns null (fail-safe)
- Logs warnings but doesn't block job execution
- Per-pack error handling in batch generation

---

## Files Created/Modified

### Created (5 new files + 2 test files)
```
src/
  prompts/
    buildContextPack.ts          (251 lines) - Context slicing logic
    renderContextPack.ts         (70 lines) - Text rendering
    persistContextPack.ts        (48 lines) - Database persistence
    generateAllContextPacks.ts   (60 lines) - Batch generation
    index.ts                     (7 lines) - Exports
    __tests__/
      buildContextPack.test.ts   (225 lines) - 18 tests
      renderContextPack.test.ts  (123 lines) - 5 tests
```

### Modified (4 existing files)
```
src/adapters/
  real-pbca.ts                   (MODIFIED) - Added context injection
  claude-brain/context/
    review-context.ts            (MODIFIED) - Added Vision Doc context
    spec-context.ts              (MODIFIED) - Added Vision Doc context
  code-puppy/
    prompt-assembler.ts          (MODIFIED) - Added context injection
    real-codepuppy.ts            (MODIFIED) - Pass project/rp IDs
```

**Total:** 7 new files, 4 modified files, 784 lines of code + tests

---

## Test Coverage

**New Tests:** 23 tests across 2 test files

### buildContextPack.test.ts (18 tests)
- ✅ PBCA context includes research questions and assumptions
- ✅ PBCA context includes all relevant constraints
- ✅ PBCA context includes dependencies
- ✅ PBCA context includes non-goals
- ✅ Review context includes decisions to challenge
- ✅ Review context includes review-specific focus areas
- ✅ Review context includes assumptions for review to challenge
- ✅ Spec context includes only tech constraints
- ✅ Spec context includes acceptance examples
- ✅ Spec context includes only fixed decisions (not assumptions)
- ✅ Spec context has no open questions
- ✅ Build context includes only tech constraints
- ✅ Build context filters for testable criteria only
- ✅ Build context has no assumptions
- ✅ Build context has no open questions
- ✅ Build context includes dependencies in concrete terms
- ✅ All consumers include project summary and RP objective
- ✅ All consumers set correct metadata

### renderContextPack.test.ts (5 tests)
- ✅ Renders all non-empty sections
- ✅ Skips empty sections
- ✅ Uses special label for review assumptions
- ✅ Numbers acceptance criteria
- ✅ Renders compact format suitable for prompts

**Total Test Suite:** 105 tests (82 from RP-1/2/3/4 + 23 new)
**All tests:** ✅ PASS

---

## Acceptance Criteria

- [✅] `buildContextPack('pbca', visionDoc, rpProposal)` returns pack with research questions
- [✅] `buildContextPack('review', visionDoc, rpProposal)` returns pack with decisions to challenge
- [✅] `buildContextPack('build', visionDoc, rpProposal)` returns only implementation constraints
- [✅] `renderContextForPrompt` produces compact, readable text
- [✅] Empty sections are omitted from rendered output
- [✅] PBCA prompts include project context when context pack exists
- [✅] Review prompts include project context when context pack exists
- [✅] Spec prompts include project context when context pack exists
- [✅] Build prompts include project context when context pack exists
- [✅] When no context pack exists, all adapters work exactly as before
- [✅] All 82 existing tests still pass
- [✅] TypeScript compiles cleanly
- [✅] No modifications outside src/prompts/ and adapter context files

---

## Usage Example

```typescript
import { 
  buildContextPack, 
  renderContextForPrompt, 
  saveContextPack,
  generateAndSaveContextPacks 
} from './prompts';

// 1. Build a single context pack
const pbcaPack = buildContextPack(
  'pbca',
  visionDoc,
  rpProposal,
  projectId,
  rpId
);

// 2. Render as text
const renderedText = renderContextForPrompt(pbcaPack);

// 3. Save to database
await saveContextPack(projectId, rpId, 'pbca', pbcaPack, renderedText);

// 4. Or batch-generate all packs for all RPs
await generateAndSaveContextPacks(
  projectId,
  visionDoc,
  rpProposals,
  rpIdMap
);

// 5. Later, adapters automatically load context
// In real-pbca.ts:
const contextPack = await loadContextPack(job.project_id, job.rp_id, 'pbca');
if (contextPack) {
  userPrompt = contextPack.renderedText + '\n\n---\n\n' + userPrompt;
}
```

---

## What's Next

**RP-6: Orchestrator Integration** (FINAL)
- Wire up `/vision` command to existing chat server
- Connect conversation flow (handleNewIntake + handleIntakeReply)
- Build Vision Document after conversation completes
- Decompose into RPs
- Generate context packs
- Create actual projects and RPs in database
- Show summary to user for approval
- End-to-end: conversation → Vision Doc → decomposition → project creation

---

## Notes

- Context packs are generated ONCE after decomposition is approved (RP-6)
- Context packs are NOT regenerated during job execution
- If Vision Document changes, context packs must be regenerated manually
- All context slicing is pure logic (no LLM calls)
- Cost: $0 (pure logic + database operations)
- Adapters remain backwards compatible (no breaking changes)
- All 4 downstream consumers now receive rich project context

---

**RP-5 Complete! Downstream agents now receive rich Vision Document context! Ready for RP-6: Final Integration** 🚀
