# Constellation Packet — RP-03: Real Claude Brain Integration (PBCA-Informed)
**Project:** The Methodology Runner
**Tier:** 1
**Date:** 2026-03-24
**Prepared by:** Claude (Orchestrator), incorporating PBCA R&D output

---

## Context Block

The Methodology Runner has a working orchestrator core (RP-01) and real PBCA integration (RP-02). The workflow runs end-to-end with mock adapters for Claude Brain and Code Puppy. This RP replaces MockClaudeAdapter with real Anthropic API calls for REVIEW, SPEC, and DEBUG jobs.

PBCA research was run on this RP and produced critical design decisions: marker-header parsing for reliable verdict extraction, typed context packs for token-efficient context chaining, adversarial review prompts that prevent rubber-stamping, and a 5-level debug escalation taxonomy.

**Tech Stack:** Node.js (TypeScript) + Anthropic API (Claude Sonnet 4) + Supabase
**Repo:** `~/Documents/Puppy Projects/methodology-runner`

---

## Implementation Spec

### What to Build

A real Claude Brain adapter organized as a self-contained module at `src/adapters/claude-brain/` that handles three job types with marker-header parsing, typed context packs, and deterministic context chaining.

### Build Order

**Step 1: Types and interfaces**

Create `src/adapters/claude-brain/types.ts`:

```typescript
export type ReviewVerdict = 'PROCEED' | 'NEEDS_DECISION' | 'REDO';
export type SpecStatus = 'READY' | 'BLOCKED';
export type DebugAction = 'PATCH' | 'PATCH_AND_RETEST' | 'ESCALATE_SPEC' | 'ESCALATE_RESEARCH' | 'ASK_HUMAN';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'P1' | 'P2' | 'P3';

export interface ProjectCard {
  rpId: string;
  rpTitle: string;
  rpDescription?: string;
  projectName: string;
  projectTier: number;
  problemStatement?: string;
  successMetrics?: string[];
  constraints?: string[];
  nonGoals?: string[];
}

export interface ReviewContextPack {
  projectCard: ProjectCard;
  pbcaSlices: {
    problemFraming?: string;
    discoveryBrief?: string;
    evidenceLedger?: string;
    optionsMatrix?: string;
    plan?: string;
    redTeam?: string;
    simulation?: string;
    assumptions?: string;
  };
  rawPbcaOutput: string; // fallback if slices not parseable
}

export interface SpecContextPack {
  projectCard: ProjectCard;
  reviewOutput: string;        // full review markdown
  reviewVerdict: ReviewVerdict;
  chosenApproach?: string;
  acceptedConstraints?: string[];
  assumptionsAndTests?: string;
  evidenceTopRows?: string;
  decisionsAnswered?: { question: string; answer: string }[];
}

export interface DebugContextPack {
  projectCard: ProjectCard;
  specSlice: string;           // relevant spec sections only
  errorLogs: string;
  recentAttemptHistory: string; // last 1-2 debug attempts
  changedFiles?: string[];
  attemptNumber: number;
}

export interface ParsedHeader {
  jobType: string;
  [key: string]: string;
}

export interface ReviewResult {
  verdict: ReviewVerdict;
  confidence: Confidence;
  blockerCount: number;
  decisionCount: number;
  redoCount: number;
  markdownBody: string;
  decisionCards?: {
    decision: string;
    whyItMatters: string;
    optionA: string;
    optionB: string;
    tradeoff: string;
    recommendedDefault: string;
  }[];
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}

export interface SpecResult {
  specStatus: SpecStatus;
  confidence: Confidence;
  openDecisions: number;
  openAssumptions: number;
  constellationPacket: string;
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}

export interface DebugResult {
  action: DebugAction;
  severity: Severity;
  rootCauseConfidence: Confidence;
  repeatFailure: boolean;
  markdownBody: string;
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}
```

**Step 2: Header parser**

Create `src/adapters/claude-brain/parsers/header-parser.ts`:

Parse the `@@KEY: VALUE` header block that appears at the top of every Claude Brain response.

```typescript
// Regex: /^@@([A-Z_]+):\s*(.+)$/gm
// Parse until @@END_HEADER
// Return ParsedHeader object
// If header is missing or invalid:
//   - return { parseError: true, rawResponse }
//   - reducer should convert parse errors to NEEDS_DECISION (never silently PROCEED)
```

Validation rules:
- Header must appear before the first markdown heading (`#`)
- `@@END_HEADER` must be present
- VERDICT/STATUS/ACTION must be valid enum values
- Counts must parse as integers
- If any validation fails, mark as parse error and preserve raw output

**Step 3: Prompt files**

Create three prompt files. Use the EXACT system prompts from the PBCA research output — they are production-ready and should be copied verbatim:

`src/adapters/claude-brain/prompts/review.ts`:
- System prompt: Copy the full CLAUDE_REVIEW system prompt from the PBCA output (the one starting with "You are CLAUDE_REVIEW, the quality gate between research and specification.")
- User message builder: function that takes ReviewContextPack and produces the user message using the template from the PBCA output

`src/adapters/claude-brain/prompts/spec.ts`:
- System prompt: Copy the full CLAUDE_SPEC system prompt from the PBCA output
- User message builder: function that takes SpecContextPack

`src/adapters/claude-brain/prompts/debug.ts`:
- System prompt: Copy the full CLAUDE_DEBUG system prompt from the PBCA output
- User message builder: function that takes DebugContextPack

**Step 4: Context pack builders**

Create `src/adapters/claude-brain/context/`:

`review-context.ts`:
- Takes: completed PBCA_RESEARCH job output, RP data, project data
- Produces: ReviewContextPack
- If PBCA output has parsed file slices (from RP-02's parser), use them
- If not, pass rawPbcaOutput as fallback
- Build the ProjectCard from RP and project data

`spec-context.ts`:
- Takes: completed CLAUDE_REVIEW job output, PBCA output, answered decisions (if any), RP/project data
- Produces: SpecContextPack
- Does NOT include the full PBCA output — only extracted key info
- Includes the full review output (it's the quality gate, spec needs it all)

`debug-context.ts`:
- Takes: failed CODEPUPPY_BUILD or SMOKE_RUN job output, most recent CLAUDE_SPEC output, prior debug attempts, RP/project data
- Produces: DebugContextPack
- Only includes relevant spec sections, NOT full research/review
- Includes last 1-2 debug attempt outputs for repeat-failure detection

`job-context.ts`:
- Helper function: `getPriorJobOutput(rpId: string, jobType: string): Promise<any>`
- Queries the most recent SUCCEEDED job of the given type for this RP
- Returns its output field

**Step 5: Anthropic client wrapper**

Create `src/adapters/claude-brain/anthropic-client.ts`:
- Initialize Anthropic SDK (API key from .env, already exists)
- Model from `CLAUDE_BRAIN_MODEL` env var, default `claude-sonnet-4-20250514`
- Retry with exponential backoff for rate limits (429)
- Log token usage from response
- Calculate cost estimate: $3/M input tokens, $15/M output tokens
- Do NOT stream — await full response

**Step 6: Real Claude adapter**

Create `src/adapters/claude-brain/real-claude.ts`:

```typescript
class RealClaudeAdapter implements AgentAdapter {
  async execute(job: Job): Promise<ExecutionResult> {
    switch (job.type) {
      case 'CLAUDE_REVIEW': return this.runReview(job);
      case 'CLAUDE_SPEC': return this.runSpec(job);
      case 'CLAUDE_DEBUG': return this.runDebug(job);
      default: return { status: 'FAILED', error: { kind: 'UNKNOWN_JOB', message: `...`, retryable: false } };
    }
  }

  private async runReview(job: Job): Promise<ExecutionResult> {
    // 1. Build ReviewContextPack from job.input + prior job outputs
    const contextPack = await buildReviewContext(job);
    // 2. Build messages (system + user)
    const { systemPrompt, userMessage } = buildReviewPrompt(contextPack);
    // 3. Call Anthropic API
    const response = await callAnthropic(systemPrompt, userMessage);
    // 4. Parse header
    const header = parseHeader(response.text);
    // 5. Handle parse errors
    if (header.parseError) {
      return {
        status: 'SUCCEEDED', // we got output, just couldn't parse verdict
        artifacts: [{ type: 'REVIEW_OUTPUT', content: response.text, metadata: { parseError: true } }],
        stopAndAsk: { question: 'Review output could not be parsed. Please review manually.', options: ['PROCEED', 'REDO'] }
      };
    }
    // 6. Handle verdict
    const verdict = header.VERDICT as ReviewVerdict;
    if (verdict === 'NEEDS_DECISION') {
      // Extract decision cards from markdown body
      const decisions = extractDecisionCards(response.text);
      return {
        status: 'STOP_AND_ASK',
        artifacts: [{ type: 'REVIEW_OUTPUT', content: response.text }],
        stopAndAsk: {
          question: `Review found ${header.DECISION_COUNT} decision(s) needed before spec can proceed.`,
          options: decisions.map(d => d.decision)
        }
      };
    }
    if (verdict === 'REDO') {
      return {
        status: 'FAILED',
        error: { kind: 'REVIEW_REDO', message: 'Review recommends re-running research', retryable: true },
        artifacts: [{ type: 'REVIEW_OUTPUT', content: response.text }]
      };
    }
    // PROCEED
    return {
      status: 'SUCCEEDED',
      artifacts: [{
        type: 'REVIEW_OUTPUT',
        content: response.text,
        metadata: { verdict, confidence: header.CONFIDENCE }
      }]
    };
  }

  private async runSpec(job: Job): Promise<ExecutionResult> {
    const contextPack = await buildSpecContext(job);
    const { systemPrompt, userMessage } = buildSpecPrompt(contextPack);
    const response = await callAnthropic(systemPrompt, userMessage);
    const header = parseHeader(response.text);

    if (header.parseError) {
      // Still return the spec even if header didn't parse — the markdown body is the value
      return {
        status: 'SUCCEEDED',
        artifacts: [{ type: 'CONSTELLATION_PACKET', content: response.text, metadata: { parseError: true } }]
      };
    }

    if (header.SPEC_STATUS === 'BLOCKED') {
      return {
        status: 'STOP_AND_ASK',
        artifacts: [{ type: 'CONSTELLATION_PACKET', content: response.text }],
        stopAndAsk: { question: 'Spec is blocked on unresolved decisions.', options: ['Review decisions', 'Override and proceed'] }
      };
    }

    return {
      status: 'SUCCEEDED',
      artifacts: [{ type: 'CONSTELLATION_PACKET', content: response.text }]
    };
  }

  private async runDebug(job: Job): Promise<ExecutionResult> {
    const contextPack = await buildDebugContext(job);
    const { systemPrompt, userMessage } = buildDebugPrompt(contextPack);
    const response = await callAnthropic(systemPrompt, userMessage);
    const header = parseHeader(response.text);

    const action = (header.ACTION || 'PATCH') as DebugAction;

    // Escalation actions become decisions
    if (['ESCALATE_SPEC', 'ESCALATE_RESEARCH', 'ASK_HUMAN'].includes(action)) {
      return {
        status: 'STOP_AND_ASK',
        artifacts: [{ type: 'DEBUG_OUTPUT', content: response.text }],
        stopAndAsk: {
          question: `Debug recommends escalation: ${action}. ${response.text.slice(0, 200)}`,
          options: ['Accept escalation', 'Try one more patch', 'Abort RP']
        }
      };
    }

    // PATCH or PATCH_AND_RETEST — return fix instructions for Code Puppy
    return {
      status: 'SUCCEEDED',
      artifacts: [{
        type: 'DEBUG_OUTPUT',
        content: response.text,
        metadata: { action, severity: header.SEVERITY, repeatFailure: header.REPEAT_FAILURE === 'YES' }
      }]
    };
  }
}
```

**Step 7: Adapter registry update**

Update `src/adapters/registry.ts`:
- Add `USE_REAL_CLAUDE` toggle from `.env`
- Import `RealClaudeAdapter` from `./claude-brain/real-claude`
- Route CLAUDE_REVIEW, CLAUDE_SPEC, CLAUDE_DEBUG to real or mock

**Step 8: Reducer integration — context chaining**

Update the reducer / workflow advancement so that:

When PBCA_RESEARCH succeeds → CLAUDE_REVIEW job input includes:
```json
{
  "pbca_output": "<full PBCA output from completed job>",
  "pbca_files": "<parsed file array if available>",
  "rp_title": "...",
  "rp_description": "...",
  "project_name": "...",
  "project_tier": 1
}
```

When CLAUDE_REVIEW succeeds with PROCEED → CLAUDE_SPEC job input includes:
```json
{
  "review_output": "<full review text>",
  "review_verdict": "PROCEED",
  "pbca_summary": "<extracted key sections, NOT full PBCA>",
  "rp_title": "...",
  "project_name": "...",
  "project_tier": 1,
  "decisions_answered": []
}
```

When CODEPUPPY_BUILD fails → CLAUDE_DEBUG job input includes:
```json
{
  "error_log": "<build error output>",
  "spec_slice": "<relevant spec sections>",
  "attempt_number": 1,
  "prior_debug_attempts": [],
  "rp_title": "..."
}
```

Use the `job-context.ts` helper to pull prior job outputs by type for a given RP.

### File Structure

```
src/adapters/claude-brain/
├── index.ts                    # exports RealClaudeAdapter
├── types.ts                    # all types and interfaces
├── anthropic-client.ts         # SDK wrapper with retry + cost tracking
├── prompts/
│   ├── review.ts               # review system prompt + user message builder
│   ├── spec.ts                 # spec system prompt + user message builder
│   └── debug.ts                # debug system prompt + user message builder
├── context/
│   ├── review-context.ts       # builds ReviewContextPack from job data
│   ├── spec-context.ts         # builds SpecContextPack
│   ├── debug-context.ts        # builds DebugContextPack
│   └── job-context.ts          # helper: get prior job outputs for an RP
└── parsers/
    ├── header-parser.ts        # parses @@KEY: VALUE headers
    └── decision-cards.ts       # extracts decision cards from review markdown

src/adapters/
├── registry.ts                 # MODIFIED — add Claude toggle
└── ...existing files unchanged
```

---

## Constraints (What NOT to Do)

- DO NOT modify the chat server's Claude integration — that's the conversational orchestrator, completely separate.
- DO NOT use Opus — Sonnet is sufficient and cheaper. Model is configurable via env var for future upgrade.
- DO NOT stream responses — these are background worker jobs.
- DO NOT pass the full PBCA output to SPEC or DEBUG jobs. REVIEW gets full PBCA. SPEC gets deterministic extracts. DEBUG gets local evidence only.
- DO NOT summarize PBCA output using another LLM call before sending to REVIEW. Pass the parsed slices directly.
- DO NOT modify the database schema.
- DO NOT modify the mock Code Puppy adapter.
- DO NOT use JSON mode or structured outputs on Sonnet 4 — it's not reliably supported. Use the marker header pattern. We can upgrade to structured outputs when we move to Sonnet 4.5/4.6.
- DO NOT silently default to PROCEED if the header can't be parsed. Parse errors become NEEDS_DECISION.

---

## Stop and Ask List (This Build)

1. **Header parsing reliability.** If Claude consistently fails to output the `@@KEY: VALUE` header even with the explicit prompt instructions, stop. The prompt may need reinforcement or a different approach.
2. **Token budget.** If a single REVIEW call exceeds 15K total tokens (prompt + response), stop and report usage. We may need to trim the PBCA context.
3. **Context chaining complexity.** If pulling prior job outputs creates circular imports or the wiring between reducer and context builders becomes tangled, stop and describe the architecture issue.
4. **Review always says PROCEED.** If during testing the review never returns NEEDS_DECISION or REDO even on weak inputs, the prompt needs tuning. Stop and report.

---

## Acceptance Criteria

- [ ] `USE_REAL_CLAUDE=true` causes real Anthropic API calls for REVIEW, SPEC, and DEBUG
- [ ] `USE_REAL_CLAUDE=false` falls back to mock adapter — no regressions
- [ ] CLAUDE_REVIEW parses the `@@VERDICT` header and routes correctly: PROCEED → advance, NEEDS_DECISION → create decision and block, REDO → fail with retryable
- [ ] CLAUDE_REVIEW receives the actual PBCA output (not empty/placeholder) and produces a substantive review
- [ ] CLAUDE_SPEC receives the review output + extracted PBCA context (not full PBCA) and produces a real Constellation Packet
- [ ] CLAUDE_DEBUG receives error logs + spec slice and produces actionable fix instructions
- [ ] Parse errors on any job type result in NEEDS_DECISION (never silent PROCEED)
- [ ] Debug escalation actions (ESCALATE_SPEC, ESCALATE_RESEARCH, ASK_HUMAN) create decisions
- [ ] Token usage and cost estimates are logged in job output for all three job types
- [ ] Running a full Tier 1 project end-to-end produces: real PBCA → real Claude review → real Claude spec → mock build
- [ ] Total cost for PBCA + review + spec is under $0.30 for a typical RP
- [ ] All existing tests still pass

---

## Reference Material

- **PBCA Research Output:** The full PBCA output for RP-03 (filed above) — contains the exact system prompts, context pack types, parsing strategy, cost model, and simulation scenarios. The prompts should be copied VERBATIM from the PBCA output into the prompt files.
- **RP-02 Implementation:** The real-pbca.ts adapter and registry pattern are the template for this build.
- **Methodology Playbook v1.0:** Constellation Packet template structure (Section 5).
