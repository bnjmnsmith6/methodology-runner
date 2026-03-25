-- ============================================================================
-- TELEMETRY SYSTEM
-- Pipeline run tracking, step logs, quality grading, and replay capability
-- ============================================================================

-- ============================================================================
-- PIPELINE RUNS TABLE
-- One row per RP execution through the pipeline
-- ============================================================================

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

-- ============================================================================
-- STEP LOGS TABLE
-- One row per pipeline step execution
-- ============================================================================

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

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_project ON pipeline_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_rp ON pipeline_runs(rp_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_status ON pipeline_runs(status);
CREATE INDEX IF NOT EXISTS idx_step_logs_pipeline ON step_logs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_step ON step_logs(step_name);
CREATE INDEX IF NOT EXISTS idx_step_logs_prompt_version ON step_logs(prompt_version);
