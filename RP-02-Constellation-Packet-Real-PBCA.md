# Constellation Packet — RP-02: Real PBCA Integration
**Project:** The Methodology Runner
**Tier:** 1
**Date:** 2026-03-24
**Prepared by:** Claude (Orchestrator)

---

## Context Block

The Methodology Runner's orchestrator core (RP-01) is built and working with mock adapters. The worker polls jobs, the reducer advances RP state through the 10-step methodology, decisions pause for human input, and the chat interface lets Ben talk to the system naturally.

This Constellation Packet replaces the `MockPbcaAdapter` with a real adapter that calls the OpenAI API to replicate Ben's PBCA R&D Orchestrator — a Custom GPT that runs a comprehensive first-principles R&D pipeline producing structured research output (problem framing, discovery brief, evidence ledger, options matrix, red team analysis, simulation, teach brief, and handoff spec).

The PBCA Custom GPT runs on GPT-5.4 Thinking with a ~3,000-word system prompt and 4 knowledge files. We replicate this as an API call with the system prompt and relevant knowledge embedded in context.

**Tech Stack:** Node.js (TypeScript) + OpenAI API (GPT-5.4 or gpt-4o as fallback) + Supabase
**Repo:** `~/Documents/Puppy Projects/methodology-runner`

---

## Implementation Spec

### What to Build

A real PBCA adapter that:

1. Takes an RP context (title, description, project context, questions to answer, constraints)
2. Constructs a prompt that includes the PBCA system instructions and relevant context
3. Calls the OpenAI API with that prompt
4. Parses the structured output (the "File Bundle" of RND/ artifacts)
5. Returns the research output as an `ExecutionResult` with artifacts
6. Handles errors, rate limits, and malformed responses gracefully

### Build Order

**Step 1: OpenAI client setup**

Create an OpenAI client wrapper in `src/adapters/openai-client.ts`:
- Initialize the OpenAI SDK with the API key from `.env`
- Create a helper function for chat completions with retry logic
- Handle rate limits with exponential backoff
- Log token usage for cost tracking

```typescript
// .env addition needed:
// OPENAI_API_KEY=sk-...
// OPENAI_MODEL=gpt-4o  (or gpt-5.4 if available on Ben's account)
```

**Step 2: PBCA system prompt as a constant**

Create `src/adapters/pbca-system-prompt.ts`:
- Store the full PBCA system prompt as a TypeScript string constant
- This is the complete instructions from Ben's Custom GPT (provided below in Reference Material)
- Include the key knowledge from the reference files as inline context (not separate file uploads — the API doesn't support Custom GPT knowledge files, so we embed the critical parts)
- The system prompt should be the PBCA instructions, with a section appended that summarizes the key frameworks from the knowledge files

The system prompt constant should include:
1. The full PBCA R&D Orchestrator instructions (v2.0) — copied exactly
2. A condensed "Reference Knowledge" section that includes:
   - The First-Principles Engine 8-phase methodology (from first-principles-engine.json)
   - The Teach Brief format (HOOK → EXTRACT → MAP → BRIDGE → EXEMPLIFY → BOUND → CHECK) from teach-agent.json
   - The failure modes taxonomy (from the Upgrading doc): hallucination laundering, scope amnesia, assumption burial, handoff drift, etc.
   - The gated workflow structure: DG1 (Problem Agreement) → DG2 (Option Selection) → DG3 (Go/No-Go)

DO NOT include the full text of all knowledge files — that would blow up the context window. Extract and condense the load-bearing parts only.

**Step 3: PBCA prompt builder**

Create `src/adapters/pbca-prompt-builder.ts`:

A function that takes RP context and builds the user message for the PBCA:

```typescript
interface PbcaPromptInput {
  rpTitle: string;
  rpDescription: string;
  projectName: string;
  projectTier: number;
  projectDescription?: string;
  questionsToAnswer?: string[];
  constraints?: string[];
  stressTestItems?: string[];
  existingArtifacts?: string[];  // content from prior steps if available
}

function buildPbcaUserPrompt(input: PbcaPromptInput): string
```

The user prompt should be structured like the PBCA prompt template from the Methodology Playbook:
- Context section (what system this is part of, what's already built)
- The Problem (crisp statement)
- Questions to Answer (5-8 specific questions)
- Constraints (technical, business, product)
- What to Stress-Test (failure modes to probe)
- Deliverable Format (the RND file bundle structure)
- What Success Looks Like

If `questionsToAnswer` and `constraints` are not provided (e.g., for a quick Tier 2 research), the prompt builder should generate reasonable defaults based on the RP title and description.

**Step 4: Response parser**

Create `src/adapters/pbca-response-parser.ts`:

The PBCA outputs a "File Bundle" with sections like:
```
### FILE: RND/00-problem-framing-contract.md
[content]

### FILE: RND/01-discovery-brief.md
[content]
```

The parser should:
- Extract individual file sections from the response
- Parse the "Run Summary" section separately (key anchors)
- Return a structured object with each RND file as a named artifact
- Handle variations in formatting (the PBCA sometimes uses `FILE:` vs `### FILE:`)
- If the response doesn't contain the expected structure, return the raw text as a single artifact with a warning flag

```typescript
interface PbcaOutput {
  runSummary: string;
  files: {
    path: string;      // e.g., "RND/00-problem-framing-contract.md"
    content: string;
  }[];
  rawResponse: string;  // always keep the full response
  warnings: string[];   // any parsing issues
}
```

**Step 5: Real PBCA adapter**

Create `src/adapters/real-pbca.ts` implementing the `AgentAdapter` interface:

```typescript
class RealPbcaAdapter implements AgentAdapter {
  async execute(job: Job): Promise<ExecutionResult> {
    // 1. Extract RP context from job.input
    // 2. Build the user prompt via pbca-prompt-builder
    // 3. Call OpenAI API with system prompt + user prompt
    // 4. Parse the response via pbca-response-parser
    // 5. Return ExecutionResult with artifacts

    // On success:
    return {
      status: 'SUCCEEDED',
      artifacts: parsedOutput.files.map(f => ({
        type: 'PBCA_OUTPUT',
        content: f.content,
        metadata: { path: f.path }
      }))
    };

    // On API error (rate limit, timeout):
    return {
      status: 'FAILED',
      error: { kind: 'API_ERROR', message: '...', retryable: true }
    };

    // On parse error (response doesn't match expected format):
    return {
      status: 'SUCCEEDED',  // still succeeded — we got output
      artifacts: [{
        type: 'PBCA_OUTPUT',
        content: rawResponse,
        metadata: { path: 'RND/raw-output.md', parseWarnings: warnings }
      }]
    };
  }
}
```

**Step 6: Adapter registry update**

Update `src/adapters/` to support choosing between mock and real adapters:

Create `src/adapters/registry.ts`:
```typescript
function getAdapter(jobType: JobType): AgentAdapter {
  switch (jobType) {
    case 'PBCA_RESEARCH':
      return USE_REAL_ADAPTERS.pbca
        ? new RealPbcaAdapter()
        : new MockPbcaAdapter();
    // ... other adapters remain mock for now
  }
}
```

Add to `.env`:
```
USE_REAL_PBCA=true   # toggle between mock and real
```

This lets Ben switch between mock and real PBCA without code changes.

**Step 7: Wire into the worker**

Update the worker's job execution to use the adapter registry. When a `PBCA_RESEARCH` job runs:
1. The real adapter builds the prompt from RP context
2. Calls OpenAI API
3. Parses the response
4. Stores the parsed artifacts in job.output
5. The reducer advances the RP to the next step (REVIEW)

**Step 8: Update the chat orchestrator context**

Update `src/chat/system-prompt.ts` so that when the orchestrator (Claude) reviews PBCA output (step 4: REVIEW), it can read the actual research output from the job's output field. The CLAUDE_REVIEW job input should include the PBCA output content.

Update the reducer: when step 3 (RESEARCH) completes successfully, the next job (CLAUDE_REVIEW at step 4) should include the PBCA output in its input:
```typescript
// In reducer, after PBCA_RESEARCH succeeds:
enqueueJob({
  type: 'CLAUDE_REVIEW',
  input: {
    pbca_output: completedJob.output.rawResponse,  // or the parsed files
    rp_context: { title, description, project info }
  }
})
```

### File Structure (new/modified files)

```
src/adapters/
├── interface.ts              # existing — no changes
├── openai-client.ts          # NEW — OpenAI SDK wrapper with retry
├── pbca-system-prompt.ts     # NEW — full PBCA system prompt constant
├── pbca-prompt-builder.ts    # NEW — builds user prompts from RP context
├── pbca-response-parser.ts   # NEW — parses File Bundle output
├── real-pbca.ts              # NEW — real PBCA adapter
├── registry.ts               # NEW — adapter selection (mock vs real)
├── mock-pbca.ts              # existing — kept as fallback
├── mock-claude.ts            # existing — no changes
└── mock-codepuppy.ts         # existing — no changes

src/core/
├── reducer.ts                # MODIFIED — pass PBCA output to REVIEW job
└── worker.ts                 # MODIFIED — use adapter registry
```

### Contracts & Interfaces

**OpenAI API call shape:**
```typescript
{
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  messages: [
    { role: 'system', content: PBCA_SYSTEM_PROMPT },
    { role: 'user', content: buildPbcaUserPrompt(rpContext) }
  ],
  max_tokens: 16000,    // PBCA output is long — file bundles can be 5-10k tokens
  temperature: 0.7       // some creativity for research, not too wild
}
```

**Job input for PBCA_RESEARCH:**
```typescript
{
  rp_title: string,
  rp_description: string,
  project_name: string,
  project_tier: number,
  project_description?: string,
  questions_to_answer?: string[],
  constraints?: string[],
  stress_test_items?: string[]
}
```

**Job output for PBCA_RESEARCH (on success):**
```typescript
{
  run_summary: string,
  files: { path: string, content: string }[],
  raw_response: string,
  warnings: string[],
  token_usage: { prompt_tokens: number, completion_tokens: number, total_tokens: number },
  cost_estimate_usd: number
}
```

---

## Constraints (What NOT to Do)

- DO NOT try to replicate the Custom GPT's file upload/knowledge retrieval mechanism. Instead, embed the critical knowledge inline in the system prompt. The API doesn't support the same RAG that Custom GPTs use.
- DO NOT call the ChatGPT Custom GPT directly (there's no API for that). We're replicating its behavior via the standard OpenAI API.
- DO NOT embed the full text of all 4 knowledge files in the system prompt — that would use ~15,000 tokens of context just for the prompt. Extract and condense the essential frameworks only.
- DO NOT modify the mock adapters for Claude or Code Puppy — those are separate RPs.
- DO NOT change the database schema — job.output JSONB field handles the new output shape.
- DO NOT stream the PBCA response — it's a background job, not user-facing. Just await the full response.

---

## Stop and Ask List (This Build)

In addition to the Universal Rules:

1. **OpenAI API authentication issues.** If the API key doesn't work or the model isn't available, stop. Don't try different models without asking.
2. **Token limit concerns.** If the system prompt + user prompt + expected output exceeds the model's context window, stop. We may need to split the PBCA pipeline into multiple calls.
3. **Response parsing failures.** If the PBCA response format is fundamentally different from what we expect (no File Bundle structure at all), stop and show me the raw response. The parser may need a different approach.
4. **Cost concerns.** If a single PBCA call costs more than $0.50, stop and let Ben know before running more.

---

## Acceptance Criteria

- [ ] `USE_REAL_PBCA=true` in `.env` causes the worker to call the real OpenAI API instead of the mock
- [ ] `USE_REAL_PBCA=false` (or unset) falls back to the mock adapter — existing behavior preserved
- [ ] Creating a Tier 1 project and activating it triggers a real PBCA research call via the OpenAI API
- [ ] The PBCA response is parsed into individual RND file artifacts stored in job.output
- [ ] If the response can't be parsed into files, the raw response is stored as a single artifact with warnings
- [ ] API errors (rate limit, timeout) return retryable errors and the worker retries with backoff
- [ ] Token usage and estimated cost are logged in job.output
- [ ] The CLAUDE_REVIEW job that follows receives the PBCA output in its input so it has context to review
- [ ] The system prompt includes condensed versions of the key frameworks from the PBCA knowledge files
- [ ] Running `npm test` still passes all existing tests (no regressions)

---

## Reference Material

### PBCA System Prompt (embed this in pbca-system-prompt.ts)

The full system prompt is the "PBCA R&D Orchestrator — Instructions (v2.0)" provided by Ben. Copy it exactly. Then append a condensed "Reference Knowledge" section.

**The condensed reference knowledge should include these key elements:**

From first-principles-engine.json:
- The 8-phase methodology: Methodology Selection → Scope → Fundamentals → Hypothesize → Explore → Validate/Graveyard → Wildcard → Synthesize → Reality
- The methodology selection matrix (novel + time → first principles; well-understood → consult experts; etc.)
- Assumption hygiene rules

From teach-agent.json:
- The 7-step teaching frame for the Teach Brief: HOOK → EXTRACT → MAP → BRIDGE → EXEMPLIFY → BOUND → CHECK
- Include self-test questions and apply-it exercise requirements

From the failure modes document:
- The 10 failure modes taxonomy (names + one-line descriptions)
- The 8 failure mode guards from the PBCA instructions

From the upgrade plan document:
- The 3 decision gates: DG1 (Problem Agreement), DG2 (Option Selection), DG3 (Go/No-Go)
- The RND folder structure and artifact list

**Total condensed reference knowledge should be ~2,000-3,000 tokens** — enough to ground the model's behavior without blowing the context window.

### Methodology Playbook PBCA Prompt Template

The user prompt builder should follow the structure from Section 8 of the Methodology Playbook:
- Context (2-3 paragraphs)
- The Problem (1 paragraph)
- Questions to Answer (5-8)
- Constraints
- What to Stress-Test
- Deliverable Format (the File Bundle structure)
- What Success Looks Like
