
# GUPPI Telemetry + Grading System — File Bundle

## Run Summary

**Facts**
- GUPPI already logs job status, token usage/cost estimates, build artifacts, review verdicts, decision cards, the Vision Document, and decomposition proposals, but it does not yet log full prompts/responses, per-step timing, intermediate quality assessments, user satisfaction, alternative approaches considered, decision rationale, or input→output quality correlations. That leaves you unable to compare GUPPI vs. manual builds, identify bottlenecks, or run grounded A/B tests. 
- Your existing PBCA materials already point toward the right control surfaces: a Problem Framing Contract, Evidence Ledger, Assumption Register, Options Matrix, Simulation Before Deployment, and a Facts-vs-Inferences discipline. fileciteturn0file0 fileciteturn0file1 fileciteturn0file2 fileciteturn0file3
- Supabase recommends `jsonb` for most JSON use cases; PostgreSQL supports GIN indexes for efficient `jsonb` key/value lookups; Supabase Storage is governed by RLS with private buckets by default; and Supabase notes that database backups do **not** include Storage objects. That makes a hybrid design the safest choice: queryable metadata in Postgres, large immutable blobs in Storage/local export. citeturn445933search4turn445933search5turn445933search1turn926251search3turn926251search14turn445933search16
- For live UI updates, Supabase documents two paths: Broadcast is the recommended method for scalability/security, while Postgres Changes is simpler but does not scale as well. For Ben’s current scale, Postgres Changes is acceptable in v1 if the abstraction can later swap to Broadcast. citeturn445933search15turn445933search3
- OpenTelemetry’s trace model maps cleanly to this problem: one pipeline run as a root trace, step runs as child spans, and agent calls / decisions / errors as events or child spans. citeturn445933search10turn445933search2turn445933search18
- Anthropic’s eval guidance recommends detailed, explicit rubrics, and current LLM-as-judge research supports rubric-based judging as useful but imperfect: G-Eval found structured rubric prompting improved alignment, while later work shows judge reliability gaps and rubric-position bias. This supports a layered grading design: deterministic checks + rubric judge + targeted human review. citeturn932407search3turn932407search1turn932407search2turn932407search0turn932407search10

**Assumptions**
- Ben is the primary grader and can spare ~30 seconds per shipped project, but not per step on every run.
- Dozens of projects means heterogenous data and small sample sizes; offline reference-suite replay matters more than classical large-n experimentation.
- Existing `projects`, `rps`, `jobs`, `vision_documents`, and `context_packs` tables can be extended rather than replaced.

**Inferences**
- The right MVP is **not** “log everything in Postgres” and **not** “grade everything with humans.” It is a balanced hybrid with canonical artifacts, selective human touchpoints, and replay bundles.
- A single overall score is useful for communication, but improvement work needs decomposed dimension scores by step and rubric version.

**Recommendation**
- Ship **Option B: Balanced Hybrid Telemetry**. Log every run/step/agent call structurally, store full prompts and outputs as immutable blobs, auto-grade canonical artifacts with stable rubrics, require Ben’s fast final grade on shipped projects, and create exportable replay bundles for A/B and regression testing.

---

### FILE: RND/00A-mise-en-place.md
```md
# DG0 — Mise en Place

## Control Knobs
- Guidance Level: High
- Risk Tier: Medium
- Pipeline Variant: Default
- RPD Eligibility: No

## Readiness Checklist
- Inputs present: Yes
- Output formats locked: Yes (`RND/*` markdown bundle + implementation backlog)
- Existing schema known: Partial (`projects`, `rps`, `jobs`, `vision_documents`, `context_packs`)
- Constraints known: Yes (Supabase + optional files, phone-first grading, <5% cost overhead, privacy-sensitive)
- Stress tests known: Yes
- Tools available: Yes (Supabase Postgres/JSONB/Storage/Realtime, local files, mobile web UI)

## Glossary
- Canonical artifact: The single output from a step that downstream grading/replay should reference
- Replay bundle: Portable manifest + artifacts needed to rerun a project
- Step run: One execution attempt of one pipeline step
- Judge packet: The bounded evidence bundle sent to a self-grader
- Gold project: A replayable project used in regression/A/B testing

## Known Unknowns
- Exact prompt versioning scheme across PBCA / Claude / Claude Code
- Whether to keep a local mirror of raw blobs in addition to Supabase Storage
- Whether “manual project” baselines will be captured prospectively only or recreated retrospectively
- How deterministic Code Puppy runs are across environment changes

## DG0
- PASS with assumptions logged
```

### FILE: RND/00-problem-framing-contract.md
```md
# Problem Framing Contract — GUPPI Quality Grading + Telemetry

## Facts
- GUPPI can already move an idea through vision, PBCA research, review, spec, build, and output working code.
- Today it lacks enough telemetry to judge intermediate quality, end-to-end intent match, reproducibility, and prompt-change impact.
- Ben needs a grading workflow that works on a phone in ~30 seconds.

## Job Story
When GUPPI ships a project, Ben wants to know whether it built the right thing, which step helped or hurt, and whether a prompt/process change made things better, so he can improve GUPPI systematically instead of guessing.

## Success Metrics
1. Replay completeness: >=95% of shipped runs have all mandatory replay fields present.
2. Human feedback speed: median final-grade time <=30 seconds.
3. Improvement utility: within 4 weeks, the system identifies at least one repeatable weak step and supports one prompt A/B comparison on a reference suite.

## Constraints
- Storage: Supabase Postgres JSONB + optional local files
- UI: phone-first, fast
- Cost: added grading/telemetry overhead target <5% per project
- Privacy: logs may contain sensitive project details
- Scale: dozens of projects, not thousands
- Existing tables should be extended, not replaced

## In Scope
- Per-step telemetry and grading
- End-to-end project grading
- Replay/export format
- Mobile human-grading UX
- Feedback loops from grades to prompt/tests/process changes
- A/B methodology for prompts and workflow variants

## Out of Scope
- Enterprise multi-tenant permissions
- Full analytics warehouse
- Fully automated prompt optimization
- Perfect determinism across all future model versions

## Top Risks
1. Over-logging creates cost/privacy/storage pain
2. Self-grades create fake precision and wrong conclusions
3. Ben stops grading if the UX feels like homework

## Commander's Intent
### Purpose
Create enough observability and judgment to improve GUPPI with evidence instead of anecdotes.

### Key Outcomes
- Every shipped project has a trustworthy replay bundle
- Weak steps are visible, not hidden in a single final score
- Prompt changes can be compared against a stable baseline
- Human grading is tiny but high-leverage

### Non-Goals
- Research-grade observability on day 1
- Perfect automated grading
- Logging every byte forever

### Acceptable Tradeoffs
- Prefer replayability over exhaustive analytics
- Prefer selective human review over universal human review
- Prefer bounded judge packets over judging entire conversations

### Do-Not-Violate Constraints
- Do not exceed Ben’s grading attention budget
- Do not store secrets/raw sensitive data without classification and access control
- Do not make prompt experiments impossible to attribute
```

### FILE: RND/00B-stakeholder-empathy-map.md
```md
# Stakeholder Empathy Map

## Ben (product owner / grader)
- Wants: fast confidence, trend lines, “did it build the right thing?”, low-friction grading
- Fears: admin burden, noisy scores, losing trust in GUPPI
- Loss looks like: he stops grading, ignores dashboards, reverts to intuition
- Likely objection: "I’m not doing QA paperwork on my phone"
- “That’s right” sounds like: "Three taps tell me whether the project landed, and I only go deeper when something smells off"

## Future GUPPI maintainer
- Wants: queryable tables, stable schemas, prompt/version traceability, replay exports
- Fears: blob swamp, duplicated context, impossible joins
- Loss looks like: cannot answer “what changed?” or “why did this regress?”
- Likely objection: "Don’t make me reverse-engineer every run from raw chat dumps"
- “That’s right” sounds like: "Metadata is queryable; raw blobs are immutable and referenced, not stuffed everywhere"

## Builder / Code Puppy handoff consumer
- Wants: actionable specs, testable acceptance criteria, debug history
- Fears: ambiguous artifacts, hidden decisions, missing context
- Loss looks like: extra debug loops and wrong builds
- Likely objection: "Don’t hand me a score; hand me the evidence and failing criteria"
- “That’s right” sounds like: "I can see the artifact, rubric misses, and exact decision trail"

## Experiment analyst / future Ben
- Wants: apples-to-apples comparisons across prompt versions
- Fears: contaminated experiments, changing rubrics, no baselines
- Loss looks like: prompt wins that are actually dataset mix changes
- Likely objection: "Small samples will lie to me if the suite isn’t stable"
- “That’s right” sounds like: "Prompt version, rubric version, and replay inputs are frozen and exportable"
```

### FILE: RND/01-discovery-brief.md
```md
# Discovery Brief: GUPPI Telemetry + Grading

## 0. Metadata
- Date: 2026-03-25
- Methodology: First-Principles + Empirical Validation
- Source: User brief + existing PBCA workflow artifacts

## 1. Phase 0 — Methodology Selection
| Dimension | Assessment |
|---|---|
| Time Urgency | Days |
| Reversibility | Type 2 for UI, Type 1-ish for schema sprawl |
| Novelty | Partially understood |
| Predictability | Complex-emergent |
| Stakes | Medium |

Decision: Use first-principles architecture, then validate with a 3-project dogfood and a reference-suite replay.

## 2. Phase 1 — Scope
### Facts
- The bottleneck is not building software; it is judging output quality and learning from runs.
- Reproducibility requires prompts, outputs, decisions, timing, costs, and human interventions.

### Knowledge Gaps
- Which fields are truly mandatory for replay?
- Which steps deserve human review vs. self-grade only?
- How much raw context can be deduplicated by artifact hash?

## 3. Phase 2 — Fundamentals
### Hard Constraints
- Ben’s grading time is scarce
- Storage/queryability/privacy all matter
- Model outputs are non-deterministic; exact replay may not equal exact reproduction
- Comparisons need frozen prompt/rubric versions

### Assumptions
- Canonical artifacts exist for each step
- Prompt versions can be identified independently from run IDs
- Downstream steps can consume artifact references instead of giant pasted context

## 4. Phase 3 — Hypotheses
1. If every step emits a canonical artifact + judge packet, weak steps become diagnosable.
2. If full prompts/responses are stored as immutable blobs and referenced by hash, replayability improves without bloating tables.
3. If human grading is limited to final outcomes and flagged exceptions, completion stays high.
4. If prompt/rubric versions are frozen per run, small-sample A/B becomes decision-useful.

## 5. Phase 4 — Explore
### Option A — Lightweight
Event log + final thumbs + build/test metrics only

### Option B — Balanced Hybrid
Structured run/step/grade tables + blob storage + selective human grading + replay bundle

### Option C — Research-Grade
Event-sourced envelopes, multi-judge ensembles, full transcript capture, automated regression lab

## 6. Phase 5 — Validate (Graveyard)
| ☠️ Idea | Killed Because | Could Resurrect If |
|---|---|---|
| Final-score-only system | Cannot diagnose step variance or improvement targets | Only for a demo |
| DB-only raw logging | Storage backups omit blobs; replay portability weak | If all artifacts are tiny text and mirrored elsewhere |
| Human-grade-every-step | Ben attention budget too small | If a dedicated reviewer exists |

## 7. Phase 6 — Wildcard
Inversion: Treat replay as the primary product and analytics as a derived product.
Insight: If a run is replayable, many analytics can be recomputed later; if it isn’t replayable, no dashboard can save you.

## 8. Phase 7 — Synthesis
### Rank
1. Balanced Hybrid — best fit
2. Lightweight — fastest, but too blind
3. Research-Grade — strongest science, too heavy now

### Tradeoffs
- Balanced Hybrid accepts some schema complexity to win replayability and actionable grading.
- It deliberately refuses universal human review and universal raw-context duplication.

## 9. Phase 8 — Reality Validation Plan
### MVP Test
Instrument 3 real projects end-to-end and export replay bundles.

### Success Criteria
- Missing mandatory replay fields <5%
- Ben finishes final grade in <=30 seconds median
- One weak-step trend appears in dashboard and is believable

### Failure Criteria
- Replay export is incomplete
- Ben abandons grading
- Scores do not correlate with obvious project outcomes

## Assumptions Register
| Assumption | Source | Validated? | Risk if Wrong |
|---|---|---|---|
| Canonical artifacts can be defined per step | Design assumption | No | Grading becomes noisy |
| Blob references are easier than full DB storage | Design assumption | No | Query complexity rises |
| Ben will reliably provide final grades | User context | No | Human calibration vanishes |

## Recommended Next Experiments
1. Instrument one PBCA→spec→build run with blob hashes and export manifest
2. Build the 30-second phone grading card
3. Define one frozen rubric per step and test self-grade vs. obvious human judgment
4. Create 5 gold replay projects spanning known failure modes
5. Compare one prompt change offline on that suite
```

### FILE: RND/01A-hypothesis-slate.md
```md
# Hypothesis Slate

## Observation
GUPPI can produce working code but cannot yet explain whether a run was good, where it went wrong, or whether a prompt change helped.

## Plausible Explanations
1. Instrumentation gap: key run context is missing (prompts, outputs, durations, interventions)
2. Rubric gap: intermediate artifacts are not judged against stable criteria
3. Identity gap: artifacts, prompts, and decisions lack versioned lineage
4. Human-signal gap: no quick intent-match grade exists
5. Experiment gap: prompt changes are not compared against a frozen suite

## Discriminating Tests
- If instrumentation is the main problem, replay completeness should predict analysis usefulness
- If rubrics are the main problem, adding self-grade should expose step variance before human changes
- If human-signal is the main problem, shipped-but-wrong projects should look “successful” until final grading is added
- If experiment design is the main problem, prompt changes should remain ambiguous even after richer telemetry unless reference-suite replay is added

## What Would Flip My View
- If final human grading alone explains most variance, step-level grading can stay minimal
- If replay bundles prove too expensive/unreliable, a structured partial replay may be enough
- If LLM judges disagree too often on obvious cases, rule-based checks must carry more weight
```

### FILE: RND/02-research-gate.md
```md
# Deep Research Gate Prompt

## Goal
Stress-test the telemetry and grading design before implementation.

## Explicit Questions
1. Which fields are minimally required for replay-complete runs?
2. Which step-level rubric dimensions are most predictive of final project quality?
3. What are the failure modes of LLM-as-judge in coding/spec evaluation?
4. What retention/redaction strategy best balances replayability and privacy?
5. Which experiment design works best for dozens of heterogeneous projects?

## Required Outputs
- Evidence ledger with sources, confidence, falsifiers, and staleness risk
- Counter-evidence and disagreements
- Recommended rubric revisions
- Recommended schema revisions
- Minimum viable reference-suite definition
- “What to delete” list to prevent over-logging

## Counter-Evidence Required
- Cases where more telemetry did not improve decisions
- Cases where LLM judges misled teams
- Cases where fine-grained scores reduced trust or actionability

## Staleness Risk
- Supabase feature guidance
- Model-evaluation guidance
- Any claims about judge reliability

## Adoption / Reflexivity Notes
- If teams know they are scored, they may optimize for the rubric
- If prompts are tuned against a small gold suite, overfitting risk rises
- Human grading quality may drift over time
```

### FILE: RND/03-evidence-ledger.md
```md
# Evidence Ledger

| Claim | Source | Confidence | Boundaries | Falsifier | Defense Layers | Corroboration | Notes |
|---|---|---:|---|---|---|---|---|
| Existing PBCA workflow already uses framing, evidence, assumptions, options, simulation, and teach-back disciplines | Existing internal docs | High | Workflow intent, not current GUPPI instrumentation | If those artifacts are not actually used downstream | Evidence + stakeholder validation | Multiple uploaded files agree | Reuse these patterns instead of inventing new nouns |
| `jsonb` should be the default for semi-structured telemetry metadata | Supabase + PostgreSQL docs | High | Metadata, not giant raw blobs | If queries are simple fixed columns only | Evidence + implementation test | Vendor + database docs | Use `jsonb` for flexible dimensions, not for everything |
| GIN indexes support efficient `jsonb` key/value lookup | PostgreSQL docs | High | Query-heavy metadata | If measured queries are not JSON-heavy | Evidence + simulation | Multiple Postgres docs | Add only where query patterns justify |
| Storage should hold raw prompts/responses/artifacts, not just DB rows | Supabase docs + reproducibility logic | High | Large immutable blobs | If database-only logging remains portable and cheap | Evidence + IRAC | Backup limitation matters | DB backups omit Storage objects, so export/local mirror is still required |
| RLS + private buckets + selective column protection should enforce privacy boundaries | Supabase docs | High | Access control, not full secrecy against privileged operators | If data is leaked through service-role misuse or exports | Evidence + red team | Storage + RLS + column controls | Sensitive fields may still need encryption/redaction |
| Trace/span semantics fit pipeline runs and step runs | OpenTelemetry docs | Medium | Conceptual mapping, not mandatory vendor adoption | If the model makes querying harder | Evidence + simulation | OTel trace/span/event structure | Good mental model even without full OTel stack |
| Detailed rubrics improve judge usefulness; holistic single-score judging is weak | Anthropic eval docs + LLM judge research | Medium | Text/spec/code evaluation | If rubric detail hurts consistency more than it helps | Evidence + simulation | Official docs + papers | Prefer dimension scoring over one giant grade |
| LLM judges are useful but not ground truth; reliability gaps and position bias exist | G-Eval + JudgeBench + rubric-position-bias papers | Medium | Open-ended evaluation | If calibration vs. humans is consistently high in your domain | Evidence + red team | Multiple papers | Use human spot checks and disagreement thresholds |
```

### FILE: RND/04-options-matrix.md
```md
# Options Matrix (DG2)

## Options

| Option | Description | Pros | Cons | Kill Criteria | Political / Emotional Feasibility |
|---|---|---|---|---|---|
| A. Lightweight | One events table + final human grade + build metrics | Fastest, cheapest, easy to ship | Weak replay, poor root-cause analysis, poor A/B | Cannot replay a run or explain wrong-thing-right-code | High |
| B. Balanced Hybrid | Normalized run/step/grade tables + immutable blobs + selective human grading + replay export | Best fit, queryable, replayable, supports experiments | Moderate build complexity | If Ben refuses grading or replay completeness stays low | Highest |
| C. Research-Grade | Event sourcing, multi-judge ensemble, exhaustive transcript capture, automated eval lab | Strongest science, best future-proofing | Expensive, slow, schema/ops overhead | If build time exceeds appetite or usage stays low | Low |

## Recommendation
Choose **B. Balanced Hybrid**.

## IRAC — Top 5 Decisions

| Issue | Rule | Application | Conclusion | What Changes My Mind |
|---|---|---|---|---|
| Where should raw prompts/responses live? | Queryable metadata belongs in DB; large immutable artifacts belong in object storage/export bundles | Prompts/responses are needed for replay but awkward for hot-query tables | Store blobs in Storage/local export; keep hashes/metadata in DB | If artifacts stay tiny and DB-only replay proves portable |
| Should we use one overall grade? | Scores should preserve diagnostic value | One score hides step variance | Keep project score separate from step scores | If step scores never affect decisions |
| When is human grading required? | Use humans where intent and satisfaction matter most | Final shipped outcome and flagged disagreements are highest value | Human-grade final projects + flagged steps only | If Ben reliably grades more without friction |
| How do prompt experiments stay attributable? | Treatment must be stable within unit of analysis | Mixed prompt versions contaminate comparisons | Freeze prompt bundle per run/project | If arm contamination proves negligible |
| What makes replay portable? | A replay must outlive the original DB state | Storage objects may not ride with DB backups | Export signed replay bundles with manifest + blobs | If a full infra snapshot becomes easy and cheap |
```

### FILE: RND/05-plan.md
```md
# Recommended Plan — Telemetry, Grading, Replay

## 1) Minimum Viable Telemetry (must log every step)
### Required Fields
- `project_id`, `rp_id`, `pipeline_run_id`, `step_run_id`, `step_name`, `attempt_no`
- `agent_provider`, `agent_model`, `prompt_template_id`, `prompt_template_version`
- `input_artifact_ids[]`, `input_hashes[]`, `output_artifact_ids[]`, `output_hashes[]`
- `started_at`, `ended_at`, `duration_ms`, `status`, `error_code`
- `token_input`, `token_output`, `cost_usd`
- `decision_ids[]`, `intervention_ids[]`
- `canonical_artifact_id`
- `judge_packet_id`, `self_grade_id`, `human_grade_id (nullable)`

### Step-Specific Extras
- PBCA research: citations_count, assumptions_count, options_count, open_questions_count
- Review: verdict, blocking_issues_count, decision_needed_count
- Spec: acceptance_criteria_count, unresolved_ambiguities_count, edge_case_count
- Build: files_changed_count, tests_passed_count, tests_failed_count, lint_status
- Test/debug: bug_count, repro_steps_present, cycle_count

## 2) Where It Goes
### Postgres (queryable metadata)
Tables:
- `pipeline_runs`
- `step_runs`
- `agent_calls`
- `artifacts`
- `decisions`
- `interventions`
- `grade_records`
- `human_feedback`
- `prompt_templates`
- `experiments`
- `experiment_assignments`
- `replay_exports`

### Storage / Files (immutable blobs)
- Rendered prompts
- Full model responses
- Judge packets
- Final artifacts
- Build logs / test logs / diffs
- Voice notes from Ben
- Replay bundle zip

Rule: DB stores pointers, hashes, summaries, and extracted metadata. Storage stores the full thing.

## 3) Canonical Schema Sketch
```json
{
  "step_run": {
    "id": "uuid",
    "pipeline_run_id": "uuid",
    "step_name": "PBCA_RESEARCH",
    "attempt_no": 1,
    "status": "SUCCEEDED",
    "prompt_template_version": "pbca_research@v12",
    "canonical_artifact_id": "uuid",
    "duration_ms": 84213,
    "cost_usd": 0.84,
    "token_input": 14622,
    "token_output": 2811
  }
}
```

## 4) Grading Design
### Common Dimensions (0-4 each)
- Intent fidelity
- Correctness / groundedness
- Completeness
- Specificity / actionability
- Traceability
- Efficiency

### Step Rubrics
- PBCA research: intent fidelity, evidence quality, options breadth, falsifiability, handoff clarity
- Review: issue detection, prioritization, rationale clarity, false-positive restraint
- Spec: actionability, acceptance-testability, ambiguity control, edge-case coverage, traceability to intent
- Build: acceptance coverage, test evidence, regression control, operational quality
- Test/debug: bug-finding power, repro quality, fix guidance, stop/escalate judgment
- Project final: right-thing-ness, shippability, delight/satisfaction, efficiency, replay completeness

### Scoring Layers (Swiss Cheese)
1. Deterministic checks
2. LLM judge with stable rubric version
3. Human grade when flagged or final shipped outcome

### Escalate to Human if
- self-grade confidence <0.65
- rule-based checks and LLM judge disagree materially
- final project passes tests but intent-fidelity <3
- debug cycle count >3
- Ben manually intervened in decomposition/spec

## 5) Ben-on-Phone UX
### Default Final Grade Card (30 seconds)
1. Overall: 1-5
2. “Built the right thing?”: Yes / Almost / No
3. “Main miss” chip: wrong thing / low quality / too many loops / needed too much help / broken / other
4. Optional 10-second voice note
5. Optional “grade key step” button if something obviously broke earlier

### Exception Card (15 seconds)
Shown only when system flags disagreement / low confidence.
- “Was the spec actionable?” thumbs up/down
- “Was the research useful?” thumbs up/down

## 6) Feedback Loop
- Nightly rollup groups grades by step, rubric dimension, prompt version, project type
- Trigger an `improvement_ticket` when:
  - same dimension <2.8 average across last 5 comparable runs, or
  - same failure mode appears in 3 runs, or
  - human “wrong thing” occurs on a shipped build
- Ticket routes to one of:
  - prompt change
  - schema/template change
  - new deterministic check
  - new decision gate
  - new test case in gold suite
  - routing/escalation rule change

## 7) A/B Methodology
### Offline First
- Build a gold suite of 10-20 replayable projects spanning your stress tests
- Re-run candidate prompt bundles against frozen inputs
- Compare:
  - step win-rate
  - project win-rate
  - median cost/time delta
  - retry/debug delta
- Use blind pairwise human adjudication on close calls

### Online Second
- Randomize by project or RP, not by step within the same project
- Freeze prompt bundle per assigned run
- Keep rubric version fixed during the experiment
- Use win-rate + median deltas, not false confidence from tiny-n p-values

## 8) Replay Format
```
replay_bundle/
  manifest.json
  project_snapshot.json
  prompt_versions.json
  steps/001_pbca_research/
    inputs.json
    prompt.txt
    response.txt
    canonical_artifact.md
    judge_packet.json
    grades.json
  steps/002_review/...
  steps/003_spec/...
  final/
    project_grade.json
    human_feedback.json
    diff_summary.json
```

### Manifest Must Include
- project/rp/run IDs
- source vision/context artifact hashes
- prompt/rubric versions
- model names + params
- timestamps + costs
- decisions + interventions
- artifact hashes + storage paths
- environment snapshot (repo commit, CLI/tool versions)

## 9) Avoid Over-Logging
- Store full text once; reference by hash thereafter
- Judge only canonical artifacts, not every intermediate thought
- Sample step-level human grading; require final human grade only
- Retain hot metadata indefinitely; raw blobs on retention tiers unless marked gold
- Redact secrets/PII before persistence when feasible
```

### FILE: RND/06A-adoption-dynamics.md
```md
# Adoption Dynamics

## Belief → Behavior → Metrics Loops

### Loop 1: “This helps me”
- Belief: grading is fast and useful
- Behavior: Ben actually grades shipped projects
- Metric: final-grade completion rate, median grading time, voice-note usage

### Loop 2: “These scores are real enough”
- Belief: step grades roughly match lived outcomes
- Behavior: Ben trusts trend charts and prompt comparisons
- Metric: override rate, disagreement rate, appealed-grade rate

### Loop 3: “The system learns”
- Belief: low grades cause visible fixes
- Behavior: team keeps instrumenting and using gold-suite regressions
- Metric: improvement tickets created/closed, weak-step trend movement, post-change win-rate

## Narrative Risks
- “Telemetry is bureaucracy”
- “LLM judges are fake precision”
- “This dashboard says 4.1/5 but I still hated the result”
- “We can’t compare projects because every project is different”

## Staged Rollout Tests
1. Dogfood on 3 projects with manual review of every replay bundle
2. Turn on final-grade card for all shipped projects
3. Add step-level exception cards only after false positives are low
4. Build gold suite, then allow prompt A/B claims in dashboard
```

### FILE: RND/06-red-team.md
```md
# Red Team

| Failure Mode | Warning Sign | Mitigation | Simpler Alternative |
|---|---|---|---|
| Wrong thing shipped with green tests | High build score, low final intent score | Make “built the right thing?” a first-class final dimension | Final yes/no intent gate |
| Spec blamed for build issues unfairly | Low build score but spec never reviewed | Grade spec independently before build | Spec thumbs-up exception card |
| Over-logging cost blowout | Storage grows fast, judge cost creeps | Hash dedupe, retention tiers, canonical-artifact-only grading | Log only shipped runs |
| Judge hallucination | Judge cites issues not in artifact | Judge packet includes artifact only; require evidence field | Human spot-check low scores |
| Prompt experiment contamination | Mixed prompt versions in one project | Freeze bundle per run/project | Offline replay only |
| Privacy leak in logs | Secrets/PII appear in prompts/responses | Redaction pass + sensitivity labels + private buckets/RLS | Manual export-only for sensitive projects |
| Blob swamp | Thousands of unnamed artifacts | Deterministic paths + manifest + hash + retention tags | Keep local export zip only |
| Ben ignores grading | Completion rate falls | 3-tap card, no mandatory essays, escalate only on exceptions | Only overall 1-5 + intent |
| Scores gamed by prompts | Outputs optimized to rubric wording | Keep hidden holdout suite + human pairwise checks | Lower score granularity |
| Endless debug loops | cycle_count >3 with no progress | escalation rule + efficiency penalty + stop-and-ask | hard cap on loops |

## Two-Pass Premortem
### Pass A
- We built observability theater, not learning
- We created dashboards no one trusts
- Replay bundles are missing one critical file

### Pass B
- Human grading rate collapses
- Prompt wins are actually data-mix changes
- Sensitive data leaks through artifact exports

### Merged Mitigations
- final-grade UX first
- replay completeness gate
- frozen prompt/rubric versions
- private-by-default storage + redaction
- gold-suite before online A/B claims
```

### FILE: RND/07-simulation-report.md
```md
# Simulation Report (DG3)

## Decision
CONDITIONAL GO

## What Must Change Before Full Rollout
1. Define canonical artifact type for each step
2. Implement replay completeness validator
3. Implement final phone-grade card
4. Freeze prompt/rubric versioning
5. Export replay bundle with blobs, not DB metadata only

## Failure Injection Scenarios

### Scenario 1 — Successful build, wrong intent
Expected:
- build/test layers score high
- final human intent score drops
- project grade explanation says “spec/build strong, intent mismatch”
Pass if:
- system does not call this a “good project” without caveat

### Scenario 2 — Great PBCA, bad spec
Expected:
- PBCA score high, spec score low, build score low or mixed
- dashboard highlights spec as bottleneck
Pass if:
- step variance is visible without reading raw transcripts

### Scenario 3 — Five debug cycles
Expected:
- efficiency score drops
- escalation triggered after cycle 3
- final summary shows “worked, but expensive”
Pass if:
- loop count is queryable and influences final grade

### Scenario 4 — Replay with new prompt bundle
Expected:
- original run remains immutable
- new run points to same source bundle as `source_run_id`
- comparison view shows win/loss by dimension
Pass if:
- attribution is not contaminated

## GO / NO-GO Logic
- GO if replay completeness >=95% on dogfood set and Ben grades >=80% of shipped projects
- NO GO if replay exports are incomplete or final-grade UX is abandoned
```

### FILE: RND/11-near-miss-log.md
```md
# Near-Miss Log

| Near-Miss | Layer That Caught It | Fix | Residual Risk |
|---|---|---|---|
| Treating final score as the whole truth | Red team | Keep project and step scores separate | Users may still over-focus on headline score |
| Assuming DB backup == replay backup | Evidence layer | Add replay export + optional local mirror | Export discipline can still fail |
| Requiring Ben to grade every step | Stakeholder empathy | Final-grade-first UX; step grading only on exceptions/sample | Some weak steps may go unreviewed |
| Letting LLM judge be sole arbiter | Evidence + red team | Deterministic checks + human escalation | Calibration drift over time |
| Logging full expanded context every time | Constraints + plan review | Hash dedupe and artifact references | Hard-to-debug lineage bugs early on |
```

### FILE: RND/08-teach-brief.md
```md
# Teach Brief: How the GUPPI Grading System Works

## HOOK
A project can “work” and still be bad. The whole point of this system is to catch that early enough to improve GUPPI, not just admire green test results.

## EXTRACT
You already know build logs, review verdicts, and vision docs. This system adds three missing layers:
1. replayability
2. step quality
3. fast human intent signal

## MAP
Think in three layers:
- Layer 1: telemetry (what happened)
- Layer 2: grading (how good it was)
- Layer 3: learning loop (what changes next)

## BRIDGE
### Analogy
This is a flight recorder plus report card plus coaching loop.
- Flight recorder = prompts, outputs, decisions, timing, costs
- Report card = step and project grades
- Coaching loop = prompt/test/process changes triggered by patterns

### Where the Analogy Breaks
A flight recorder is passive; this system is active because it decides when to ask for human judgment.

## EXEMPLIFY
### Example 1
Build passed all tests, but Ben taps “No” on “built the right thing?”
Outcome: final grade drops, intent mismatch is logged, prompt/spec improvements become candidates.

### Example 2
PBCA research scores 4/4 on evidence and options, but spec scores 1/4 on actionability.
Outcome: dashboard blames spec, not research or build.

## BOUND
- A 4/5 does not mean “perfect”
- LLM judges are assistants, not truth machines
- Small samples can mislead; that is why gold-suite replay exists

## CHECK
### Self-Test
1. Why is a replay bundle more important than a dashboard?
2. Why should final human grading stay mandatory even with self-grading?
3. Why should prompt versions be frozen per run?

### Answers
1. Because analytics can be recomputed from replayable evidence, but not from missing context.
2. Because “right thing?” is the highest-value human signal and LLM judges can be wrong.
3. Because mixed treatments contaminate A/B conclusions.

### Apply-It Exercise
Prompt: A run passes tests, took 6 debug cycles, and Ben says “Almost” on intent match. How should the system summarize it?
What good looks like: “Technically successful but inefficient and partially misaligned; likely spec/decomposition issue, escalate for review and include in gold suite.”
```

### FILE: RND/09-handoff-to-code-puppy.md
```md
# Handoff to Code Puppy

## Implementation Backlog (build in this order)
1. Add DB migrations for telemetry core tables
2. Add Storage adapter for raw blobs + deterministic paths
3. Instrument pipeline wrapper to emit `pipeline_run`, `step_run`, `agent_call`
4. Hash artifacts and link inputs/outputs by lineage
5. Build replay completeness validator + replay export zip
6. Add rule-based graders
7. Add LLM judge service with rubric versions
8. Build phone-grade API + minimal mobile UI
9. Add nightly rollups + weak-step trend queries
10. Add experiment/reference-suite runner

## Suggested File Structure
- `src/db/schema/*`
- `src/telemetry/runTracker.ts`
- `src/telemetry/blobStore.ts`
- `src/telemetry/replayExport.ts`
- `src/grading/rubrics/*`
- `src/grading/ruleChecks.ts`
- `src/grading/judgeService.ts`
- `src/feedback/mobileGradeRoutes.ts`
- `src/analytics/rollups.ts`
- `src/experiments/referenceSuite.ts`

## Top 5 IRAC Decisions
1. Raw artifacts in Storage/export; metadata in DB
2. Final score separate from step scores
3. Human grade final outcomes + flagged exceptions only
4. Freeze prompt/rubric versions per run
5. Replay export is a required feature, not a nice-to-have

## Top 5 Assumptions with Owners / Tests
| Assumption | Owner | Test |
|---|---|---|
| Canonical artifacts can be named per step | Ben + builder | instrument one real project |
| Ben will complete final grade in <=30s | Ben | dogfood on 5 shipped projects |
| Judge packets are small enough for low cost | builder | token-count simulation |
| Hash-dedupe meaningfully reduces storage | builder | compare 3 replay bundles |
| Gold suite of 10-20 projects is enough to detect regressions | Ben | first two prompt experiments |

## Builder Prompt 1 — Telemetry Core
“Implement normalized telemetry tables and instrumentation wrappers for pipeline runs, step runs, agent calls, artifacts, decisions, interventions, grades, and replay exports. Prefer append-only inserts for telemetry events, strong foreign keys, and deterministic storage paths. Include tests for replay completeness.”

## Builder Prompt 2 — Grading
“Implement rubric-versioned grading with three layers: rule checks, LLM judge packet evaluation, and human feedback capture. Keep final project grade separate from step grades and expose reasons, not just numbers.”

## Builder Prompt 3 — Mobile Feedback
“Implement a phone-first grading card that lets Ben rate a shipped project in three taps plus optional voice note. Optimize for <=30-second completion and support exception cards for flagged steps.”

## Builder Prompt 4 — Experiments
“Implement gold-suite replay and prompt-bundle comparison. Freeze prompt/rubric versions per run and produce win/loss summaries by dimension, cost, and latency.”
```
