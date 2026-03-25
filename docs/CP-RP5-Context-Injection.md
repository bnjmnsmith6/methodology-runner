# Constellation Packet — RP-5: Downstream Context Injection
**Project:** GUPPI Vision Conversation Mode
**Tier:** 2
**Date:** 2026-03-25
**Dependencies:** RP-1 (Data Layer), RP-4 (Vision Doc + Decomposition)

---

## Context Block

RPs 1-4 built the intake system: classify, converse, generate Vision Document, decompose into RPs. Now we need to make the downstream agents actually USE this richer context.

Currently, PBCA research gets only the RP title and description (~100 words). Claude Review gets only the PBCA output. Claude Spec gets only the review output. Claude Code gets only the Constellation Packet. None of them see the full project context, the user's decisions, the risk register, or the decomposition rationale.

This RP builds context pack generators — functions that slice the Vision Document into role-specific payloads for each downstream agent. Each agent gets exactly what it needs, no more.

This RP modifies existing adapter code. It updates how PBCA, review, spec, and build prompts are constructed to include Vision Document context when available.

**Tech Stack:** TypeScript, imports from vision types, modifies existing adapter prompt builders

---

## Implementation Spec

### What to Build

Context pack generators for each downstream consumer, plus modifications to existing prompt builders to use them.

### Build Order

**Step 1: Context Pack Builders**

Create `src/prompts/buildContextPack.ts`:

```typescript
import { VisionDocument, ContextPack, ContextConsumer, RPProposal } from '../types/vision';

// Build a context pack for a specific consumer and RP
export function buildContextPack(
  consumer: ContextConsumer,
  visionDoc: VisionDocument,
  rpProposal?: RPProposal
): ContextPack
```

Each consumer gets different slices:

**PBCA context pack includes:**
- projectSummary: `visionDoc.intent.one_sentence_brief`
- rpObjective: `rpProposal.description` (rich, not just title)
- relevantConstraints: `visionDoc.constraints.tech` + `.product` + `.policy`
- acceptanceCriteria: `visionDoc.done_definition.success_criteria`
- assumptions: `visionDoc.risk_register.assumptions`
- dependencies: `rpProposal.dependencies` mapped to strings
- nonGoals: `visionDoc.intent.non_goals` + `visionDoc.done_definition.out_of_scope`
- openQuestions: `visionDoc.risk_register.unknowns` + `rpProposal.pbca_focus`

**Review context pack includes:**
- projectSummary: same
- rpObjective: same
- relevantConstraints: `visionDoc.decisions_made.fixed_choices` + `.rejected_directions`
- acceptanceCriteria: same
- assumptions: same (review should challenge these)
- dependencies: same
- nonGoals: same
- openQuestions: `visionDoc.downstream_context.review_focus`

**Spec context pack includes:**
- projectSummary: same
- rpObjective: same
- relevantConstraints: `visionDoc.constraints.tech` + done_definition details
- acceptanceCriteria: `visionDoc.done_definition.success_criteria` + `.acceptance_examples`
- assumptions: only confirmed/fixed decisions
- dependencies: same + interface contracts implied by dependencies
- nonGoals: `visionDoc.done_definition.out_of_scope`
- openQuestions: empty (spec should be working from resolved context)

**Build context pack includes:**
- projectSummary: brief (1 sentence)
- rpObjective: `rpProposal.description`
- relevantConstraints: tech constraints only
- acceptanceCriteria: testable criteria only
- assumptions: none (build should work from spec, not assumptions)
- dependencies: what this RP depends on, in concrete terms
- nonGoals: `visionDoc.done_definition.out_of_scope`
- openQuestions: empty

**Step 2: Context Pack Renderer**

Create `src/prompts/renderContextPack.ts`:

```typescript
import { ContextPack } from '../types/vision';

// Render a context pack as text suitable for prompt injection
export function renderContextForPrompt(pack: ContextPack): string
```

Output format:
```
## Project Context
{projectSummary}

## This RP's Objective
{rpObjective}

## Constraints
{relevantConstraints as bullet list}

## Acceptance Criteria
{acceptanceCriteria as numbered list}

## Assumptions (verify or challenge these)
{assumptions as bullet list}

## Dependencies
{dependencies as bullet list}

## Out of Scope
{nonGoals as bullet list}

## Open Questions
{openQuestions as bullet list}
```

Skip any section that's empty. Keep the output compact — this goes into prompts with token budgets.

**Step 3: Context Pack Persistence**

Create `src/prompts/persistContextPack.ts`:

```typescript
import { ContextPack, ContextConsumer } from '../types/vision';
import { createContextPack, getContextPack } from '../db/vision-repo';

// Save a context pack to the database
export async function saveContextPack(
  projectId: string,
  rpId: string,
  consumer: ContextConsumer,
  pack: ContextPack,
  renderedText: string
): Promise<{ id: string }>

// Retrieve a context pack for a specific consumer
export async function loadContextPack(
  projectId: string,
  rpId: string,
  consumer: ContextConsumer
): Promise<{ pack: ContextPack; renderedText: string } | null>
```

**Step 4: Update PBCA prompt builder**

Find the existing PBCA adapter where it constructs the research prompt. It currently uses only RP title and description. Add a check:

```typescript
// In the PBCA adapter, when building the prompt:
const contextPack = await loadContextPack(projectId, rpId, 'pbca');
if (contextPack) {
  // Prepend the context to the PBCA prompt
  prompt = contextPack.renderedText + '\n\n' + prompt;
}
```

Look at how the PBCA prompt is currently built in `src/adapters/pbca/` and add the context injection BEFORE the existing prompt content. The PBCA should see the project context first, then the RP-specific research instructions.

**Step 5: Update Claude Review context builder**

Find `src/adapters/claude-brain/context/review-context.ts`. When building review context, add:

```typescript
const contextPack = await loadContextPack(projectId, rpId, 'review');
if (contextPack) {
  // Add project context alongside the PBCA output
  reviewContext = contextPack.renderedText + '\n\n---\n\n' + reviewContext;
}
```

**Step 6: Update Claude Spec context builder**

Find `src/adapters/claude-brain/context/spec-context.ts`. When building spec context, add:

```typescript
const contextPack = await loadContextPack(projectId, rpId, 'spec');
if (contextPack) {
  specContext = contextPack.renderedText + '\n\n---\n\n' + specContext;
}
```

**Step 7: Update Code Puppy prompt assembler**

Find `src/adapters/code-puppy/prompt-assembler.ts`. When building the build prompt, add:

```typescript
const contextPack = await loadContextPack(projectId, rpId, 'build');
if (contextPack) {
  // Add constraints and acceptance criteria to the system prompt
  systemPrompt = systemPrompt + '\n\n' + contextPack.renderedText;
}
```

**Step 8: Context Pack Generation on Project Creation**

Create `src/prompts/generateAllContextPacks.ts`:

```typescript
import { VisionDocument, RPProposal, ContextConsumer } from '../types/vision';

// Generate and save all context packs for all RPs in a project
export async function generateAndSaveContextPacks(
  projectId: string,
  visionDoc: VisionDocument,
  rpProposals: RPProposal[],
  rpIdMap: Record<string, string>  // rpTitle -> rpId
): Promise<void>
// For each RP proposal:
//   For each consumer (pbca, review, spec, build):
//     Build context pack
//     Render to text
//     Save to database
```

This gets called after decomposition is approved and RPs are created (in RP-6).

**Step 9: Index file**

Create `src/prompts/index.ts`:
```typescript
export { buildContextPack } from './buildContextPack';
export { renderContextForPrompt } from './renderContextPack';
export { saveContextPack, loadContextPack } from './persistContextPack';
export { generateAndSaveContextPacks } from './generateAllContextPacks';
```

### File Structure

```
src/
  prompts/
    buildContextPack.ts          # NEW — role-specific context slicing
    renderContextPack.ts         # NEW — text rendering for prompts
    persistContextPack.ts        # NEW — save/load from Supabase
    generateAllContextPacks.ts   # NEW — batch generation
    index.ts                     # NEW — exports
  adapters/
    pbca/
      *.ts                       # MODIFIED — add context injection
    claude-brain/
      context/
        review-context.ts        # MODIFIED — add context injection
        spec-context.ts          # MODIFIED — add context injection
    code-puppy/
      prompt-assembler.ts        # MODIFIED — add context injection
```

---

## Constraints (What NOT to Do)

- DO NOT change the structure of existing prompts — only PREPEND context
- DO NOT make context injection mandatory — if no context pack exists, existing behavior continues unchanged (backwards compatible)
- DO NOT include the full Vision Document in any single prompt — use the role-specific slices
- DO NOT include the conversation transcript in downstream prompts
- DO NOT call any LLM in this module — context packs are built from the Vision Document with pure logic
- DO NOT break existing tests — all 82 tests must still pass

---

## Stop and Ask List

1. **Find existing prompt construction code.** The exact file paths for PBCA prompt, review context, spec context, and build prompt may differ from what's listed. Find them first.
2. **Project ID availability.** Some adapters may not have easy access to project_id and rp_id. Check how job objects carry this information and trace it through.

---

## Acceptance Criteria

- [ ] `buildContextPack('pbca', visionDoc, rpProposal)` returns a pack with research questions and assumptions
- [ ] `buildContextPack('review', visionDoc, rpProposal)` returns a pack with decisions and risks to challenge
- [ ] `buildContextPack('build', visionDoc, rpProposal)` returns only implementation-relevant constraints
- [ ] `renderContextForPrompt` produces compact, readable text
- [ ] Empty sections are omitted from rendered output
- [ ] PBCA prompts include project context when a context pack exists
- [ ] Review prompts include project context when a context pack exists
- [ ] Spec prompts include project context when a context pack exists
- [ ] Build prompts include project context when a context pack exists
- [ ] When no context pack exists, all adapters work exactly as before (backwards compatible)
- [ ] All 82 existing tests still pass
- [ ] TypeScript compiles cleanly
