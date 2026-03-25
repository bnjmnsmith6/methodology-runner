# RP-4: Vision Document Generator + Decomposition Engine - COMPLETED

**Status:** ✅ Complete  
**Date:** 2025-03-25  
**Dependencies:** RP-1 (Data Layer), RP-2 (Classifier), RP-3 (Conversation Manager)

---

## What Was Built

Two complete modules for turning vision conversations into structured work:

### 1. Vision Module (`src/vision/`)

**buildVisionDoc.ts** - LLM-powered Vision Document generator
- Takes completed conversation session + messages + coverage
- Calls Claude Sonnet with structured prompt (max_tokens 2000)
- Parses JSON response into VisionDocument schema
- Fallback handling for JSON parsing errors
- Saves to vision_documents table via vision-repo

**renderVisionSummary.ts** - Human-readable renderers (pure functions)
- `renderShortSummary()` - 3-5 line summary for chat display
- `renderFullMarkdown()` - Complete markdown document with all sections

### 2. Decompose Module (`src/decompose/`)

**proposeRPs.ts** - LLM-powered decomposition engine
- Analyzes Vision Document and proposes RP split
- Skips LLM for simple projects (returns single RP)
- Calls Claude Sonnet with decomposition rules (max_tokens 2000)
- Returns: proposals, explanation, suggestedBuildOrder
- Fallback to single RP on errors

**assignTier.ts** - Tier validation (pure logic)
- Upgrades auth/security/permissions → Tier 3
- Upgrades data migration/schema → Tier 2
- Caps single-file with no deps → Tier 1
- Caps all tiers at 2 for simple projects

**detectDependencies.ts** - Dependency graph validator (pure logic)
- Validates all dependency references exist
- Detects cycles using DFS
- Topological sort for build order (Kahn's algorithm)

**explainDecomposition.ts** - User-facing explainer (pure logic)
- Formats decomposition for chat display
- Shows tier labels, dependencies, build order
- Compact summary for logging

**decomposeProject.ts** - Orchestrator
- Ties everything together
- Propose → Validate Tiers → Validate Dependencies → Build Order → Format

**persistDecomposition.ts** - Database persistence
- Save decomposition to decomposition_decisions table (status: 'proposed')
- Get decomposition by ID
- Update status (proposed → approved → rejected)

---

## Implementation Details

### Vision Document Generation

**System Prompt Strategy:**
- Explicit rules for field population (only stated/implied info)
- Mark assumptions in risk_register.assumptions
- Testable success criteria, not vague goals
- JSON-only output, no markdown

**Token Budget:**
- max_tokens: 2000 (Vision Docs can be substantial)
- Cost per generation: ~$0.03-0.05

**Error Handling:**
- JSON parsing fails → retry once with explicit reminder
- Second failure → fallback to minimal Vision Doc with conversation summary

### RP Decomposition

**Skip LLM Conditions:**
- Fast-path classification
- suggested_rp_count === 1
- Simple complexity + no integrations

**Decomposition Rules (taught to Claude):**
1. Split when work can be independently researched
2. Split across system boundaries (data/UI/auth/integrations)
3. Split when different risk profiles
4. Split when blocking via interface/contract
5. DO NOT split tiny tightly-coupled tasks
6. Default to FEWER RPs
7. Soft cap: 6 RPs

**Tier Assignment Rules:**
- Tier 1: Bounded, reversible, low-risk, single file
- Tier 2: Moderate complexity, multiple files, integration
- Tier 3: Architecture/security/data/permissions, high reversibility cost

**Token Budget:**
- max_tokens: 2000
- Cost per decomposition: ~$0.03-0.05

**Total cost per full workflow:** < $0.10

---

## Files Created

```
src/
  vision/
    buildVisionDoc.ts          (207 lines) - LLM-powered Vision Doc generator
    renderVisionSummary.ts     (306 lines) - Markdown renderers
    index.ts                   (6 lines) - Exports
  decompose/
    proposeRPs.ts              (280 lines) - LLM-powered RP proposer
    assignTier.ts              (71 lines) - Tier validator
    detectDependencies.ts      (150 lines) - Dependency validator
    explainDecomposition.ts    (104 lines) - User-facing explainer
    decomposeProject.ts        (64 lines) - Orchestrator
    persistDecomposition.ts    (72 lines) - Database persistence
    index.ts                   (13 lines) - Exports
    __tests__/
      assignTier.test.ts       (200 lines) - 7 tests
      detectDependencies.test.ts (234 lines) - 8 tests
      explainDecomposition.test.ts (161 lines) - 6 tests

docs/
  CP-RP4-Vision-Doc-Decomposition-COMPLETED.md (this file)
```

**Total:** 12 new files, 1,868 lines of code + tests + docs

---

## Test Coverage

**New Tests:** 21 tests across 3 test files

### assignTier.test.ts (7 tests)
- ✅ Upgrades auth-related RPs to Tier 3
- ✅ Upgrades security-related RPs to Tier 3
- ✅ Upgrades permission-related RPs to Tier 3
- ✅ Upgrades data migration RPs to at least Tier 2
- ✅ Caps single-file RPs with no dependencies at Tier 1
- ✅ Caps all tiers at 2 for simple complexity projects
- ✅ Does not downgrade correctly assigned RPs

### detectDependencies.test.ts (8 tests)
- ✅ Validates linear dependency chain
- ✅ Detects invalid references
- ✅ Detects cycles in dependency graph
- ✅ Validates complex DAG with multiple dependencies
- ✅ Returns correct order for linear chain
- ✅ Returns valid order for DAG with multiple roots
- ✅ Handles single RP with no dependencies
- ✅ Handles parallel RPs with no interdependencies

### explainDecomposition.test.ts (6 tests)
- ✅ Formats single RP correctly
- ✅ Formats multiple RPs with dependencies
- ✅ Shows explanation at the end
- ✅ Handles multiple dependencies
- ✅ Formats summary for logging
- ✅ Handles RPs with no dependencies

**Total Test Suite:** 82 tests (61 from RP-1/2/3 + 21 new)
**All tests:** ✅ PASS

---

## Acceptance Criteria

- [✅] `buildVisionDocument` produces valid VisionDocument from conversation
- [✅] `renderShortSummary` returns 3-5 line summary for chat
- [✅] `renderFullMarkdown` returns complete markdown document
- [✅] `proposeRPDecomposition` returns 1 RP for simple projects (no LLM call)
- [✅] `proposeRPDecomposition` returns 2-6 RPs for complex projects
- [✅] `validateTierAssignments` upgrades auth-related RPs to Tier 3
- [✅] `validateDependencyGraph` catches cycles and invalid references
- [✅] `getBuildOrder` returns valid topological sort
- [✅] `formatDecompositionForUser` produces clear, non-condescending text
- [✅] `decomposeProject` handles both simple and complex cases
- [✅] `saveDecomposition` persists to Supabase correctly
- [✅] Total LLM cost per decomposition: < $0.10
- [✅] TypeScript compiles cleanly
- [✅] No changes to existing code outside src/vision/ and src/decompose/

---

## Usage Example

```typescript
import { buildVisionDocument, saveVisionDocument } from './vision';
import { decomposeProject, saveDecomposition } from './decompose';
import { getVisionSession, getVisionMessages } from './db/vision-repo';

// 1. Build Vision Document from completed session
const session = await getVisionSession(sessionId);
const messages = await getVisionMessages(sessionId);
const coverage = session.state.coverage;

const visionDoc = await buildVisionDocument(session, messages, coverage);
const { id: visionDocId } = await saveVisionDocument(session.id, visionDoc);

// 2. Decompose into RPs
const decomposition = await decomposeProject(visionDoc);

console.log(decomposition.userSummary);
// "I've broken this into 3 parts:
//  1. Data Model (Tier 3) — Database schema...
//  2. API (Tier 2) — REST endpoints...
//  3. UI (Tier 2) — Frontend components...
//  Build order: Data Model → API → UI"

// 3. Save decomposition (status: 'proposed')
const { decompositionId } = await saveDecomposition(
  session.project_id,
  visionDocId,
  decomposition
);

// 4. Later: approve or reject
await updateDecompositionStatus(decompositionId, 'approved');
```

---

## What's Next

**RP-5: Context Pack Generator** (NEXT)
- Take approved decomposition
- Generate role-specific context packs for each RP
- PBCA focus questions
- Review focus areas
- Build constraints from Vision Document

**RP-6: Chat Interface Integration**
- Wire up `/vision` command
- Connect conversation flow
- Show Vision Doc + decomposition to user
- Get approval before creating actual projects/RPs

---

## Notes

- Vision Document schema matches RP-1 database schema exactly
- Claude Sonnet (claude-sonnet-4-20250514) used for all LLM calls
- Reuses existing `callAnthropic` client from Claude Brain adapter
- No new dependencies added
- All pure logic functions (tier assignment, dependency validation, explanation) are testable without mocks
- LLM functions (buildVisionDoc, proposeRPs) have fallback behavior for errors

---

**RP-4 Complete! Ready for RP-5: Context Pack Generator** 🚀
