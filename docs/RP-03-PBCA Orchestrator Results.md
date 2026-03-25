1. **Problem framing**

**Facts.** You already framed the core problem correctly: the hard part is not “call Anthropic from the worker,” it is designing three non-chat prompts whose outputs are reliable enough to drive a reducer, Code Puppy, and Ben without hand-holding. Your existing R&D docs also point to the right failure modes: evidence drift, assumption burial, handoff drift, weak review loops, and missing simulation/validation. They explicitly recommend structured handoff artifacts, assumption registers, options matrices, design blueprints with architecture/user flow/task breakdown, and a red-team/simulation step before execution.   

**Missing piece.** The biggest hidden constraint is model capability mismatch: your pinned model is `claude-sonnet-4-20250514`, which is still active today but has a tentative retirement date “not sooner than May 14, 2026.” Anthropic’s current structured outputs are GA on Claude API for Sonnet 4.5/4.6, not Sonnet 4. Anthropic also recommends migrating from Sonnet 4 to 4.5 or 4.6, and the Messages API is the forward path while Text Completions is legacy. ([Claude][1])

**Inference.** That creates two valid designs:

* **Hard-pin design:** stay on Sonnet 4 and use a strict marker header for parseable verdicts.
* **Best-available design:** move Claude Brain to Sonnet 4.5/4.6 and use structured outputs for metadata plus markdown for human-readable content, at the same list price tier Anthropic documents for Sonnet 4.5/4.6. ([Claude][2])

**Recommendation.** Under your stated constraint, I would design for **Sonnet 4 marker-based parsing now**, but make the adapter abstraction support a later flip to **Sonnet 4.5/4.6 structured outputs** with no prompt rewrite.

---

2. **Prompt designs**

## A. CLAUDE_REVIEW

### System prompt

```text
You are CLAUDE_REVIEW, the quality gate between research and specification.

Your role:
- Act like a skeptical staff engineer + product architect.
- Your job is NOT to restate the PBCA.
- Your job is to decide whether the research is good enough to drive implementation without hidden guessing.

Operating principles:
1. Assume the research may contain unsupported claims, buried assumptions, missing constraints, or false confidence.
2. Spend most of your effort on disconfirmation:
   - contradictions
   - missing decisions
   - unsupported leaps
   - vague implementation consequences
   - places where Code Puppy would be forced to guess
3. Be adversarial but fair. Call something "unsupported in provided context" if not evidenced by the inputs.
4. Do not rubber-stamp. A PROCEED verdict still requires residual risks.
5. Distinguish:
   - PROCEED = sufficient to write a buildable spec without guessing about core decisions
   - NEEDS_DECISION = research is mostly sufficient, but 1-3 bounded tradeoffs require Ben
   - REDO = research has blocking gaps, contradictions, or missing fundamentals that would make the spec fictional
6. Prefer concrete critique over generic commentary.
7. Do not repeat large parts of the input. Surface deltas, not paraphrase.

Review checklist:
- Is the problem framing stable?
- Are success metrics and constraints clear?
- Are major assumptions explicit?
- Are key claims supported or at least bounded?
- Is there a coherent path from research -> design -> implementation?
- Are there unresolved decisions only a human should make?
- Would Code Puppy know what to build, test, and avoid?

Output rules:
- Output the machine-readable header EXACTLY first.
- Then output the markdown body exactly under the required section headings.
- Keep total response under 1200 words unless the inputs are deeply contradictory.

Required first lines:
@@JOB_TYPE: CLAUDE_REVIEW
@@VERDICT: <PROCEED|NEEDS_DECISION|REDO>
@@CONFIDENCE: <LOW|MEDIUM|HIGH>
@@BLOCKER_COUNT: <integer>
@@DECISION_COUNT: <integer>
@@REDO_COUNT: <integer>
@@END_HEADER

Then output:

# Review Summary

## 1. What's genuinely new or valuable
Only the highest-signal points worth preserving.

## 2. What's adequately supported
Separate "supported by provided artifacts" from "reasonable but still assumed".

## 3. What is concerning
Concrete gaps, contradictions, weak links, or places a builder would guess.

## 4. Decision cards
If verdict is NEEDS_DECISION, provide 1-3 cards in this exact structure:
### Decision Card <n>
- Decision:
- Why it matters:
- Option A:
- Option B:
- Tradeoff:
- Recommended default if Ben does not answer:

## 5. Minimum fix to change verdict
- If PROCEED: what would make you downgrade?
- If NEEDS_DECISION: what answer(s) would let spec proceed?
- If REDO: what minimum new research is required?

## 6. Residual risk after this review
Top 1-3 risks even if proceeding.
```

### User message template

```text
<job>
type: CLAUDE_REVIEW
project_id: {{project_id}}
rp_id: {{rp_id}}
attempt: {{attempt}}
timestamp: {{timestamp}}
</job>

<project_card>
{{problem_framing_compact}}
</project_card>

<artifact_index>
{{artifact_index_with_ids_and_versions}}
</artifact_index>

<pbca_context>
{{review_context_pack}}
</pbca_context>

<review_instruction>
Review only the provided context.
Do not invent missing evidence.
Your job is to determine whether this is sufficient to move into specification.
</review_instruction>
```

### Why this works

**Facts.** Your pipeline docs say the review loop should catch missing considerations, challenge scope drift, and validate whether the plan is grounded enough to move forward; they also emphasize evidence ledgers, options review, assumptions, and pre-execution critique.  

**Inference.** Rubber-stamping happens when the reviewer is asked to “summarize” or “comment on” research. It drops sharply when the reviewer is explicitly cast as a gatekeeper with stop criteria, bounded verdicts, and a required “minimum fix to change verdict” section.

---

## B. CLAUDE_SPEC

### System prompt

```text
You are CLAUDE_SPEC, the builder-facing specification writer.

Your role:
- Convert approved research + review context into a Constellation Packet that Code Puppy can build from.
- You are writing for an implementation agent, not for executives.

Primary goal:
Produce a spec that is specific enough to implement confidently, but not so over-detailed that it becomes brittle or speculative.

Operating principles:
1. Preserve the intent of the research and the constraints of the review.
2. Do not invent product decisions that are not grounded in the provided context.
3. Prefer:
   - interfaces
   - invariants
   - file/module boundaries
   - data contracts
   - task ordering
   - acceptance tests
   over long prose.
4. If something is unresolved:
   - turn it into an explicit assumption with a fallback, or
   - mark it as blocked if a human decision is required.
5. Do not bloat.
6. Do not re-explain the whole research bundle.
7. Write so that Code Puppy should not need to reread PBCA to start work.
8. Make non-goals explicit so scope stays stable.

Quality bar:
A competent engineer should be able to answer all of the following from your packet:
- What are we building?
- What is out of scope?
- What contracts and invariants must hold?
- What files/modules should change?
- In what order should work happen?
- How do we know it's done?
- What should cause escalation instead of improvisation?

Output rules:
- Output the machine-readable header EXACTLY first.
- Then output the markdown Constellation Packet.
- Keep it dense and operational.

Required first lines:
@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: <READY|BLOCKED>
@@CONFIDENCE: <LOW|MEDIUM|HIGH>
@@OPEN_DECISIONS: <integer>
@@OPEN_ASSUMPTIONS: <integer>
@@END_HEADER

Then output:

# Constellation Packet

## 1. Objective
- Problem
- Desired outcome
- Success checks

## 2. In scope / Out of scope

## 3. Source-of-truth constraints
Bulleted, only binding constraints.

## 4. Architecture and flow
- Components
- Data flow
- State transitions or control flow
- External dependencies

## 5. Contracts and invariants
- Inputs/outputs
- Schemas or structures
- Non-negotiable rules

## 6. File-by-file implementation plan
For each file/module:
- Purpose
- Change required
- Key functions/types/interfaces

## 7. Build order
Ordered steps with dependencies.

## 8. Acceptance tests
Concrete tests or checks that prove completion.

## 9. Risks, assumptions, and rollback
- Open assumptions
- Risk hotspots
- What to do if reality disagrees with the spec

## 10. Escalate instead of guessing
List the exact conditions that should trigger STOP_AND_ASK or an upstream revision.
```

### User message template

```text
<job>
type: CLAUDE_SPEC
project_id: {{project_id}}
rp_id: {{rp_id}}
attempt: {{attempt}}
timestamp: {{timestamp}}
</job>

<project_card>
{{problem_framing_compact}}
</project_card>

<review_output>
{{full_review_output}}
</review_output>

<spec_context>
{{spec_context_pack}}
</spec_context>

<instruction>
Write a buildable Constellation Packet.
Use the review as the gate.
If the review says NEEDS_DECISION and the missing decision is unresolved, set SPEC_STATUS to BLOCKED.
</instruction>
```

### Why this works

**Facts.** Your R&D docs say the builder-facing blueprint should include architecture, user flow, task breakdown, assumptions, validation/tests, and decision records, and should remain traceable back to requirements rather than becoming a prose blob.  

**Inference.** Code Puppy needs a packet optimized around “what to change / in what order / how to know it worked,” not a long narrative. The prompt above forces that shape.

---

## C. CLAUDE_DEBUG

### System prompt

```text
You are CLAUDE_DEBUG, the diagnosis-and-fix planner for failed build/test attempts.

Your role:
- Diagnose the failure against the current spec and recent attempt history.
- Recommend the smallest fix that is likely to work.
- Escalate when the failure is actually a spec/research problem.

Operating principles:
1. Separate symptom, evidence, and root cause.
2. Prefer minimal reversible fixes when the problem is local.
3. Escalate when the problem is structural.
4. Never recommend the same fix repeatedly if the same failure family has already survived it.
5. Use the current spec as the contract. If the code violates the spec, patch the code. If the spec is wrong or incomplete, escalate the spec.
6. Distinguish:
   - PATCH = local code fix
   - PATCH_AND_RETEST = local fix with explicit test sequence
   - ESCALATE_SPEC = architecture/data contract/state-flow mismatch
   - ESCALATE_RESEARCH = missing or invalid upstream assumptions
   - ASK_HUMAN = ambiguous tradeoff or external dependency choice
7. If confidence is low, say so explicitly.

Escalation triggers:
- same failure family after 2 attempts
- fix would require changing a core contract, schema, or data model
- spec contradicts runtime reality
- multiple unrelated failures suggest wrong architecture
- missing external dependency or policy decision

Output rules:
- Output the machine-readable header EXACTLY first.
- Then output the markdown body.
- Keep it operational.

Required first lines:
@@JOB_TYPE: CLAUDE_DEBUG
@@ACTION: <PATCH|PATCH_AND_RETEST|ESCALATE_SPEC|ESCALATE_RESEARCH|ASK_HUMAN>
@@SEVERITY: <P1|P2|P3>
@@ROOT_CAUSE_CONFIDENCE: <LOW|MEDIUM|HIGH>
@@REPEAT_FAILURE: <YES|NO>
@@END_HEADER

Then output:

# Debug Report

## 1. Symptom
What failed, where, and during which step.

## 2. Evidence
The exact clues from logs, traces, or test output.

## 3. Most likely root cause
Why this is happening.

## 4. Recommended action
One of PATCH / PATCH_AND_RETEST / ESCALATE_SPEC / ESCALATE_RESEARCH / ASK_HUMAN.

## 5. Exact instructions for Code Puppy
Concrete change list, ordered.

## 6. Why this should work
Short causal explanation.

## 7. If this fails again
The next escalation path and the trigger for it.
```

### User message template

```text
<job>
type: CLAUDE_DEBUG
project_id: {{project_id}}
rp_id: {{rp_id}}
attempt: {{attempt}}
timestamp: {{timestamp}}
</job>

<spec_slice>
{{relevant_spec_sections_only}}
</spec_slice>

<failure_context>
{{error_logs}}
{{test_failures}}
{{stack_traces}}
</failure_context>

<attempt_history>
{{last_two_debug_attempts_and_outcomes}}
</attempt_history>

<instruction>
Recommend the smallest fix likely to work.
Escalate if this is not actually a local bug.
Avoid repeating failed advice.
</instruction>
```

### Why this works

**Facts.** Your docs warn about debug loops that do not converge and call for retries, escalation paths, rollback thinking, and simulation before broader execution.  

**Inference.** Debug becomes wasteful when it lacks attempt history and a formal escalation threshold. The prompt above makes both first-class.

---

3. **Context chaining strategy**

**Facts.** RP-02 already parses PBCA’s File Bundle into structured RND artifacts, and your pipeline docs explicitly favor structured handoff artifacts over free-form summaries because that reduces handoff drift, assumption burial, and loss of traceability.  

**Recommendation.** Do **not** summarize raw PBCA output for REVIEW. Do **not** pass full PBCA output to DEBUG. Use **deterministic context packs** assembled from the parsed RND artifacts you already store.

### Best strategy by job

**REVIEW**

* Pass the **full relevant PBCA artifact set**, not a model summary.
* Relevant means: problem framing, discovery, evidence ledger, options matrix, plan, red-team/simulation outputs if present.
* Exclude teaching/handoff prose unless it adds unique constraints.

Why: the review is the anti-rubber-stamp gate. Summarizing before review can erase the very gaps you want caught.

**SPEC**

* Pass:

  * compact project card
  * chosen-option summary
  * high-signal evidence rows
  * assumptions/tests
  * accepted constraints
  * full review output
* Do **not** pass the full PBCA by default.
* Add an appendix slice only for unusually complex RPs.

Why: by spec time, the reducer already knows what matters. Deterministic extraction is cheaper and safer than another LLM summary.

**DEBUG**

* Pass:

  * relevant Constellation Packet sections only
  * build/test logs
  * last 1-2 attempts
  * changed files or file list
* Never pass the whole research bundle.

Why: debug quality depends on local runtime evidence, not broad research context.

### Suggested context pack shapes

```ts
type ProjectCard = {
  rpId: string;
  title: string;
  problem: string;
  successMetrics: string[];
  constraints: string[];
  nonGoals: string[];
};

type ReviewContextPack = {
  projectCard: ProjectCard;
  artifactIndex: ArtifactRef[];
  pbcaSlices: {
    problemFramingMd: string;
    evidenceLedgerMd: string;
    optionsMatrixMd: string;
    planMd: string;
    assumptionsMd: string;
    redTeamMd?: string;
    simulationMd?: string;
  };
};

type SpecContextPack = {
  projectCard: ProjectCard;
  chosenApproach: string;
  acceptedConstraints: string[];
  assumptionsAndTests: string;
  evidenceTopRows: string;
  fullReview: string;
  appendixSlices?: string[];
};

type DebugContextPack = {
  projectCard: ProjectCard;
  specSlice: string;
  recentAttemptHistory: string;
  logs: string;
  changedFiles?: string[];
};
```

### Token-efficiency rule of thumb

* **REVIEW:** full relevant PBCA is fine if it stays under your budget.
* **SPEC:** deterministic extraction beats full PBCA.
* **DEBUG:** spec slice + logs only.

### Cost lever

Anthropic supports prompt caching on repeated prompt prefixes, including `tools`, `system`, and `messages`; cache hits are billed at 10% of base input price, and cached reads generally do not count toward ITPM for most models. Prompt caching is supported on Sonnet 4, 4.5, and 4.6. ([Claude API Docs][3])

**Practical use.**

* Cache the system prompt.
* Cache the immutable project card + stable artifact slices.
* Biggest savings show up on retries, follow-up review/spec calls, and debug loops.

---

4. **Verdict parsing design**

**Recommendation.** For your current pinned model, use a **marker header**, not natural-language verdicts and not JSON-only.

### Why not natural language

Because Claude will eventually say “I’d lean PROCEED, with caveats,” and your parser will hate you.

### Why not JSON-only on Sonnet 4

Because guaranteed structured outputs are a 4.5+/4.6 feature, not a Sonnet 4 guarantee. ([Claude][4])

### Recommended parser format now

```text
@@JOB_TYPE: CLAUDE_REVIEW
@@VERDICT: NEEDS_DECISION
@@CONFIDENCE: MEDIUM
@@BLOCKER_COUNT: 0
@@DECISION_COUNT: 2
@@REDO_COUNT: 0
@@END_HEADER
```

Regex:

```ts
const headerLine = /^@@([A-Z_]+):\s*(.+)$/m;
```

Validation:

* `VERDICT` must be one of enum values.
* counts must parse as integers.
* header must appear before first markdown heading.

Fail-safe:

* if header missing or invalid, mark result as `PARSE_ERROR`
* reducer should convert parse error to `NEEDS_DECISION`
* store raw output for inspection
* never silently assume `PROCEED`

### Best-available design later

If you move Claude Brain to Sonnet 4.5/4.6, use Anthropic structured outputs for metadata:

```json
{
  "job_type": "CLAUDE_REVIEW",
  "verdict": "NEEDS_DECISION",
  "confidence": "MEDIUM",
  "blocker_count": 0,
  "decision_count": 2,
  "redo_count": 0,
  "analysis_md": "..."
}
```

Anthropic says JSON outputs via `output_config.format` provide schema-compliant responses, and strict tool use gives schema-validated tool inputs. ([Claude][4])

**Opinion.** Keep the markdown body even after you adopt structured outputs. Machines want enums; Ben wants readable reasoning.

---

5. **Options matrix**

| Approach                              | Prompt/output style                          | Context strategy                                                  | Pros                                                                  | Cons                                                                                         | My take                                |
| ------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| A. Plain markdown, full raw context   | Long prose output, regex for verdict in body | Pass full PBCA/review/spec every time                             | Simplest to prototype                                                 | Most expensive, highest ambiguity, rubber-stamp prone, debug distracts on irrelevant context | Not recommended                        |
| B. Marker header + markdown body      | Strict header lines + operational markdown   | Full relevant PBCA for REVIEW; deterministic packs for SPEC/DEBUG | Works on Sonnet 4, parseable, readable, minimal integration risk      | Not schema-guaranteed, still needs parser hardening                                          | **Best under current model pin**       |
| C. Structured outputs + compact packs | JSON metadata plus markdown field            | Deterministic packs + caching                                     | Strongest parsing reliability, lowest reducer ambiguity, future-proof | Requires Sonnet 4.5/4.6 migration                                                            | **Best overall if model pin can move** |

**Inference.** Multi-turn prompt chains inside Claude Brain are not worth it here. Your worker jobs are background one-shots; every extra turn adds token cost, state complexity, and another place for drift. A single well-structured call per job is cleaner.

**Recommendation.**

* **Now:** B
* **Later:** C

---

6. **Red team analysis**

### What fails

**Rubber-stamp reviews**

* Cause: prompt asks for “review” but not “gate.”
* Fix: bounded verdicts, blocker counts, explicit downgrade rules, decision cards.

**Vague specs**

* Cause: prompt optimizes for elegance instead of buildability.
* Fix: file-by-file plan, contracts, acceptance tests, escalation triggers.

**Bloated specs**

* Cause: prompt says “comprehensive” without a relevance filter.
* Fix: prefer invariants/interfaces/tests over exposition; cap scope to builder needs.

**Context overflow / wasted tokens**

* Cause: passing full PBCA everywhere.
* Fix: REVIEW gets full relevant PBCA; SPEC gets deterministic extracts; DEBUG gets local evidence only.

**Verdict parse failures**

* Cause: verdict buried in prose.
* Fix: marker header now; structured outputs later.

**Debug loops**

* Cause: no attempt history, no escalation threshold.
* Fix: include repeat-failure flag, last-two-attempt history, and hard escalation after repeated failure family.

### Near-miss log

| Near-miss                      | Layer that caught it           | Fix                                    | Residual risk              |
| ------------------------------ | ------------------------------ | -------------------------------------- | -------------------------- |
| “Use JSON mode on Sonnet 4”    | Web evidence check             | Marker header under current pin        | Medium until model upgrade |
| “Summarize PBCA before review” | Red-team pass                  | Full relevant PBCA for REVIEW          | Low                        |
| “Pass full research to DEBUG”  | Simulation/cost reasoning      | Local spec slice + logs only           | Low                        |
| “PROCEED means no risks”       | Review prompt design           | Require residual risks even on PROCEED | Low                        |
| “Retry debug forever”          | Orchestrator stress-test logic | Escalate after repeated failure family | Medium                     |

---

7. **Simulation**

## Scenario A: solid PBCA, review says PROCEED, spec is generated

1. Worker creates `CLAUDE_REVIEW` job with full relevant PBCA context pack.
2. Claude returns:

```text
@@JOB_TYPE: CLAUDE_REVIEW
@@VERDICT: PROCEED
@@CONFIDENCE: MEDIUM
@@BLOCKER_COUNT: 0
@@DECISION_COUNT: 0
@@REDO_COUNT: 0
@@END_HEADER
```

3. Reducer validates header, stores review artifact.
4. Worker creates `CLAUDE_SPEC` job with:

   * project card
   * chosen option + assumptions/tests
   * full review
5. Claude returns `@@SPEC_STATUS: READY`
6. Reducer stores Constellation Packet and moves RP to build.

**Why this works.** The review is adversarial, but because the PBCA is already well-formed and the decision space is closed, the spec can stay compact and builder-facing. This matches your docs’ preferred flow: evidence -> option choice -> blueprint -> implementation. 

## Scenario B: PBCA has gaps, review says NEEDS_DECISION, Ben answers, spec proceeds

1. Review sees research is mostly good but finds one unresolved tradeoff:

   * Supabase artifact storage format
   * or whether Code Puppy may change DB schema automatically
2. Claude returns:

```text
@@VERDICT: NEEDS_DECISION
@@DECISION_COUNT: 1
```

3. Body includes:

```markdown
### Decision Card 1
- Decision: Allow Code Puppy to perform additive DB migrations automatically?
- Why it matters: Build scope and rollback risk differ materially.
- Option A: Yes, additive migrations allowed.
- Option B: No, schema changes require STOP_AND_ASK.
- Tradeoff: Speed vs. operational safety.
- Recommended default if Ben does not answer: No.
```

4. Reducer pauses RP and creates human decision artifact.
5. Ben answers.
6. Reducer appends decision to context and resumes `CLAUDE_SPEC`.
7. Spec now emits `READY`.

**Why this works.** The review adds value by exposing bounded human judgment calls instead of pretending they do not exist.

## Scenario C: build fails, debug runs, fix works on second attempt

1. Code Puppy builds from packet.
2. Test step fails with import-path mismatch plus missing env contract.
3. `CLAUDE_DEBUG` gets:

   * failing spec sections
   * logs
   * changed files
   * no full research
4. Claude returns:

```text
@@ACTION: PATCH_AND_RETEST
@@REPEAT_FAILURE: NO
```

5. Body tells Code Puppy to:

   * correct module import path
   * align env loader with specified contract
   * rerun targeted tests first, then full test
6. Code Puppy applies fix.
7. Second attempt passes.
8. If second attempt had failed with same signature, next debug run would return `ESCALATE_SPEC`.

**Why this works.** The debug prompt distinguishes local defects from upstream contract mistakes, preventing wasteful loop churn.

---

8. **Cost model**

**Facts.** Anthropic’s current pricing for Sonnet 4.5/4.6 is $3 per million input tokens and $15 per million output tokens, and Anthropic’s Claude 4 announcement says Sonnet 4 pricing remained at $3/$15 per million input/output tokens. Prompt caching cache hits cost 10% of base input price; 5-minute writes cost 1.25x base input price. ([Claude API Docs][5])

### Per-call estimates

| Call   |                         Low |                           Base |                         High |
| ------ | --------------------------: | -----------------------------: | ---------------------------: |
| REVIEW | 5k in / 1k out = **$0.030** | 8k in / 1.5k out = **$0.0465** | 10k in / 2k out = **$0.060** |
| SPEC   | 7k in / 2k out = **$0.051** |   10k in / 3k out = **$0.075** | 12k in / 4k out = **$0.096** |
| DEBUG  | 4k in / 1k out = **$0.027** | 6k in / 1.5k out = **$0.0405** |  8k in / 2k out = **$0.054** |

### Per RP

* **Review + Spec only**

  * Low: **$0.081**
  * Base: **$0.1215**
  * High: **$0.156**

* **Review + Spec + one Debug**

  * Low: **$0.108**
  * Base: **$0.162**
  * High: **$0.210**

### Per month at 2 RPs/day (~60 RPs/month)

* **No debug**

  * Low: **$4.86**
  * Base: **$7.29**
  * High: **$9.36**

* **One debug on every RP**

  * Low: **$6.48**
  * Base: **$9.72**
  * High: **$12.60**

* **More realistic: debug on 30% of RPs**

  * Base monthly debug add-on: `18 * $0.0405 = $0.729`
  * Base total: **about $8.02/month**

**Inference.** Claude Brain cost is not the budget risk. The real cost risk is bad reviews or debug loops wasting downstream build cycles.

**Opinion.** Spend tokens on REVIEW quality before you spend them on spec verbosity.

---

9. **Handoff spec**

## File structure

```text
src/adapters/claude-brain/
  index.ts
  types.ts
  prompts/
    review.ts
    spec.ts
    debug.ts
  context/
    project-card.ts
    review-context.ts
    spec-context.ts
    debug-context.ts
  parsers/
    header-parser.ts
    review-parser.ts
    spec-parser.ts
    debug-parser.ts
  real-claude.ts
  mock-claude.ts
  registry.ts
```

## Core interfaces

```ts
export type ClaudeBrainJobType =
  | "CLAUDE_REVIEW"
  | "CLAUDE_SPEC"
  | "CLAUDE_DEBUG";

export type ReviewVerdict = "PROCEED" | "NEEDS_DECISION" | "REDO";
export type SpecStatus = "READY" | "BLOCKED";
export type DebugAction =
  | "PATCH"
  | "PATCH_AND_RETEST"
  | "ESCALATE_SPEC"
  | "ESCALATE_RESEARCH"
  | "ASK_HUMAN";

export interface ClaudeBrainJob {
  jobId: string;
  projectId: string;
  rpId: string;
  type: ClaudeBrainJobType;
  attempt: number;
  contextPack: string;
}

export interface ClaudeBrainResult {
  rawText: string;
  header: Record<string, string>;
  parsedBody: Record<string, unknown>;
}
```

## Parser contract

* Parse header before anything else.
* Validate enums.
* If parse fails:

  * mark artifact `parse_status = invalid`
  * preserve raw output
  * reducer converts to safe pause, not silent continue

## Adapter behavior

* Use Anthropic **Messages API**, not Completions. Anthropic documents Completions as legacy and says future models/features will not be compatible. ([Claude][6])
* Follow existing registry pattern from RP-02.
* Gate real adapter behind `USE_REAL_CLAUDE`.
* Do not touch chat-server Claude integration.

## Build order

1. `types.ts`
2. prompt files
3. context pack builders
4. header parser + validators
5. real adapter
6. registry wiring
7. reducer integration
8. tests with frozen fixtures
9. optional migration path to structured outputs

## Minimum tests

* Review parser accepts valid header
* Review parser rejects buried/ambiguous verdict
* Spec blocked state pauses workflow
* Debug repeated-failure escalation triggers after threshold
* Context builders exclude irrelevant artifacts
* Raw output always stored on parse failure

## Final recommendation

**Under your current hard pin:** implement **marker-header + markdown** prompts, deterministic context packs, full PBCA only for REVIEW, compact packs for SPEC, and local evidence only for DEBUG.

**Best future upgrade:** switch only the metadata layer to Anthropic structured outputs on Sonnet 4.5/4.6, keep the markdown body format the same. That gives you stronger parsing without throwing away prompt work. ([Claude][4])

The two changes with the highest leverage are:

1. make REVIEW a real gate with stop criteria, and
2. stop passing raw upstream context to jobs that no longer need it.

[1]: https://platform.claude.com/docs/en/about-claude/model-deprecations?utm_source=chatgpt.com "Model deprecations - Claude API Docs"
[2]: https://platform.claude.com/docs/en/about-claude/models/migration-guide?utm_source=chatgpt.com "Migration guide - Claude API Docs"
[3]: https://docs.anthropic.com/en/docs/about-claude/pricing "Pricing - Claude API Docs"
[4]: https://platform.claude.com/docs/en/build-with-claude/structured-outputs "Structured outputs - Claude API Docs"
[5]: https://docs.anthropic.com/en/docs/about-claude/models/overview "Models overview - Claude API Docs"
[6]: https://platform.claude.com/docs/en/api/completions/create?utm_source=chatgpt.com "Create a Text Completion - Claude API Reference"
