# Constellation Packet — GUPPI Quality Grading + Telemetry System
**Project:** GUPPI Telemetry
**Tier:** 2
**Date:** 2026-03-25
**Dependencies:** Existing pipeline (all adapters), Vision system tables

---

## Context Block

GUPPI runs an autonomous development pipeline but has no way to measure output quality. We can't tell if a project turned out well, which step was the bottleneck, or whether prompt changes improve results. This system adds telemetry, self-grading, human grading, and replay capability.

The PBCA research recommends **Option B: Balanced Hybrid** — queryable metadata in Postgres, immutable raw artifacts in local files, exportable replay bundles, rubric-based self-grading, and a minimal human grading step for shipped projects.

**Architecture principle:** Keep full blobs out of hot tables. Treat replayability as the product.

**Tech Stack:** Supabase (Postgres JSONB for metadata), local filesystem for raw logs, TypeScript

---

## Implementation Spec

### Build Order (6 Steps)

**Step 1: Telemetry Schema**

Create `src/db/migrations/004_telemetry.sql`:

```sql
-- Pipeline run: one row per RP execution through the pipeline
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed, abandoned
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_cost_usd NUMERIC DEFAULT 0,
  total_duration_ms INTEGER,
  total_api_calls INTEGER DEFAULT 0,
  total_debug_cycles INTEGER DEFAULT 0,
  step_grades JSONB DEFAULT '{}'::jsonb,  -- { "pbca": 4, "review": 5, "spec": 3, "build": 4 }
  overall_grade NUMERIC,                   -- 1-5, computed from step grades
  human_grade JSONB,                       -- { "score": 4, "built_right_thing": "yes", "main_miss": "none" }
  flags JSONB DEFAULT '[]'::jsonb,         -- ["slow_build", "multiple_redos", "thin_research"]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step log: one row per pipeline step execution
CREATE TABLE IF NOT EXISTS step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,      -- pbca_research, claude_review, claude_spec, codepuppy_build, smoke_run
  job_id UUID,                  -- references jobs(id) if applicable
  status TEXT NOT NULL,         -- succeeded, failed, redo, needs_decision
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  cost_usd NUMERIC,
  tokens_in INTEGER,
  tokens_out INTEGER,
  prompt_hash TEXT,             -- SHA256 of the prompt sent (for A/B tracking)
  prompt_version TEXT,          -- version tag for the prompt template used
  rubric_version TEXT,          -- version of self-grading rubric
  self_grade NUMERIC,           -- 1-5, from LLM self-grading
  self_grade_reasons JSONB,     -- ["specific_to_rp", "covered_edge_cases", "actionable"]
  output_summary TEXT,          -- 2-3 sentence summary of what this step produced
  artifact_paths JSONB DEFAULT '[]'::jsonb,  -- paths to raw prompt/response files
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project ON pipeline_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_rp ON pipeline_runs(rp_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_step_logs_pipeline ON step_logs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_step ON step_logs(step_name);
CREATE INDEX IF NOT EXISTS idx_step_logs_prompt_version ON step_logs(prompt_version);
```

Run this migration in Supabase SQL Editor.

**Step 2: Telemetry Logger**

Create `src/telemetry/logger.ts`:

```typescript
// Start a pipeline run when an RP begins processing
export async function startPipelineRun(projectId: string, rpId: string): Promise<string>
// Returns pipeline_run_id

// Log a step execution
export async function logStep(params: {
  pipelineRunId: string;
  rpId: string;
  stepName: string;
  jobId?: string;
  status: string;
  startedAt: Date;
  completedAt: Date;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
  promptHash?: string;
  promptVersion?: string;
  outputSummary?: string;
  artifactPaths?: string[];
  metadata?: Record<string, any>;
}): Promise<void>

// Complete a pipeline run
export async function completePipelineRun(
  pipelineRunId: string,
  status: string,
  totalCost?: number
): Promise<void>

// Record human grade
export async function recordHumanGrade(
  pipelineRunId: string,
  grade: { score: number; builtRightThing: string; mainMiss: string; notes?: string }
): Promise<void>
```

Implementation: simple Supabase inserts/updates using the existing client.

**Step 3: Raw Artifact Logger**

Create `src/telemetry/artifact-logger.ts`:

```typescript
// Save raw prompt and response to local filesystem
export async function saveRawArtifact(params: {
  pipelineRunId: string;
  stepName: string;
  type: 'prompt' | 'response' | 'artifact';
  content: string;
}): Promise<string>
// Saves to: .telemetry/<pipelineRunId>/<stepName>/<type>-<timestamp>.txt
// Returns the file path

// Get the artifact directory for a pipeline run
export function getArtifactDir(pipelineRunId: string): string
// Returns: .telemetry/<pipelineRunId>/
```

Store under `.telemetry/` in the project root. These are gitignored but persist on disk.

**Step 4: Self-Grading Module**

Create `src/telemetry/self-grade.ts`:

```typescript
export interface StepGrade {
  score: number;           // 1-5
  reasons: string[];       // what was good/bad
  rubricVersion: string;   // for tracking rubric changes
}

// Grade a PBCA research output
export async function gradePBCAOutput(
  rpTitle: string,
  rpDescription: string,
  pbcaOutput: string
): Promise<StepGrade>

// Grade a Claude Review output
export async function gradeReviewOutput(
  pbcaOutput: string,
  reviewOutput: string
): Promise<StepGrade>

// Grade a Claude Spec output
export async function gradeSpecOutput(
  reviewOutput: string,
  specOutput: string,
  visionDoc?: any
): Promise<StepGrade>

// Grade a build output
export async function gradeBuildOutput(
  specOutput: string,
  buildResult: any
): Promise<StepGrade>

// Compute overall grade from step grades
export function computeOverallGrade(stepGrades: Record<string, number>): number
```

Each grading function calls Claude Sonnet with a rubric prompt. Keep it cheap — max_tokens 200 per grade.

**PBCA Rubric (v1):**
```
Rate this research output 1-5:
5: Specific to the RP, covers edge cases, identifies real risks, actionable recommendations
4: Good coverage, mostly specific, minor gaps
3: Generic but correct, missing RP-specific insights
2: Shallow, mostly restating the prompt
1: Wrong, irrelevant, or harmful

Respond with JSON: {"score": N, "reasons": ["reason1", "reason2"]}
```

**Review Rubric (v1):**
```
Rate this review 1-5:
5: Found real issues, specific blockers, useful decisions, didn't rubber-stamp
4: Good catches, some useful decisions
3: Surface-level review, didn't add much
2: Rubber-stamped or asked unnecessary questions
1: Wrong verdict or missed critical issues
```

**Spec Rubric (v1):**
```
Rate this spec 1-5:
5: Complete file-by-file plan, clear acceptance criteria, addresses review feedback
4: Good structure, mostly actionable
3: Generic template, missing specifics
2: Vague, not implementable
1: Wrong approach or missing critical requirements
```

**Build Rubric (v1):**
```
Rate this build 1-5:
5: All acceptance criteria met, tests pass, clean code, matches spec
4: Most criteria met, minor issues
3: Partially works, significant gaps
2: Doesn't match spec, major issues
1: Broken or wrong
```

**Step 5: Integration into Worker**

Modify `src/core/worker.ts` to log telemetry at each step:

```typescript
// When a job starts:
const stepStart = new Date();

// When a job completes:
const stepEnd = new Date();
await logStep({
  pipelineRunId: run.id,
  rpId: job.rp_id,
  stepName: job.type,
  jobId: job.id,
  status: result.status,
  startedAt: stepStart,
  completedAt: stepEnd,
  costUsd: result.cost,
  tokensIn: result.tokensIn,
  tokensOut: result.tokensOut,
  outputSummary: result.summary?.slice(0, 500),
});

// After step completes, self-grade:
if (job.type === 'PBCA_RESEARCH' && result.status === 'SUCCEEDED') {
  const grade = await gradePBCAOutput(rp.title, rp.description, result.output);
  // Store grade in step_logs
}
```

Also save raw prompts and responses via `saveRawArtifact()` in each adapter.

**Step 6: Human Grade Chat Tool**

Add a `grade_project` tool to the chat:

```typescript
// Tool: grade_project
// Shows completed projects and lets Ben rate them
{
  name: 'grade_project',
  description: 'Rate a completed project. GUPPI shows what shipped and asks for a quick grade.',
  parameters: {
    type: 'object',
    properties: {
      project_name: { type: 'string' },
      score: { type: 'number', description: '1-5 overall score' },
      built_right_thing: { type: 'string', enum: ['yes', 'almost', 'no'] },
      main_miss: { type: 'string', description: 'What was the biggest gap, if any' }
    },
    required: ['project_name', 'score', 'built_right_thing']
  }
}
```

GUPPI should proactively ask for grades when projects ship:
```
✅ "Personal Dashboard" shipped!

Quick grade? (takes 10 seconds)
📊 Score (1-5): ___
🎯 Built the right thing? yes / almost / no
💭 Biggest miss (optional): ___
```

### File Structure

```
src/
  telemetry/
    logger.ts              # NEW — pipeline run + step logging
    artifact-logger.ts     # NEW — raw prompt/response file storage
    self-grade.ts          # NEW — LLM-based self-grading per step
    index.ts               # NEW — exports
  db/
    migrations/
      004_telemetry.sql    # NEW — pipeline_runs + step_logs tables
  core/
    worker.ts              # MODIFIED — add telemetry hooks
  chat/
    tools.ts               # MODIFIED — add grade_project tool
  adapters/
    pbca/*.ts              # MODIFIED — save raw prompts/responses
    claude-brain/*.ts      # MODIFIED — save raw prompts/responses
    code-puppy/*.ts        # MODIFIED — save raw prompts/responses
```

---

## Constraints (What NOT to Do)

- DO NOT store full prompts or responses in Postgres — use local files, reference by path
- DO NOT self-grade every step in v1 — start with PBCA and build output only (cheapest, highest signal)
- DO NOT block the pipeline on grading — grade asynchronously after the step completes
- DO NOT require human grading for every project — prompt for it, but make it optional
- DO NOT add more than $0.02 per step in grading costs (one cheap LLM call per grade)
- DO NOT change existing pipeline behavior — telemetry is additive, never blocking

---

## Stop and Ask List

1. **Supabase storage limits.** If raw artifacts are large, check free tier limits. May need to cap artifact size or rotate old files.
2. **Self-grading accuracy.** If grades are consistently 4-5 (rubber-stamping), the rubric needs tightening. Log rubric version so we can iterate.

---

## Acceptance Criteria

- [ ] `pipeline_runs` and `step_logs` tables created
- [ ] Each pipeline step logs timing, cost, and token usage
- [ ] PBCA output is self-graded with score + reasons
- [ ] Build output is self-graded with score + reasons
- [ ] Raw prompts and responses saved to `.telemetry/` directory
- [ ] `grade_project` chat tool works — Ben can rate from the chat
- [ ] GUPPI proactively asks for grades when projects ship
- [ ] Pipeline is not blocked or slowed by telemetry
- [ ] All existing tests still pass
- [ ] Telemetry adds <5% to per-project cost
