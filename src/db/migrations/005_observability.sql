-- ============================================================================
-- OBSERVABILITY SYSTEM - Phase 1: Trace IDs + Expected/Actual + New Tables
-- ============================================================================

-- Extend pipeline_runs with trace and observability fields
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS baseline_run_id UUID;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS release_decision TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS failure_class TEXT;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS repair_origin TEXT DEFAULT 'none';
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS run_metadata JSONB DEFAULT '{}'::jsonb;

-- Extend step_logs with trace correlation and expected/actual
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS trace_id TEXT;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS span_id TEXT;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS parent_span_id TEXT;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'step.completed';
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info';
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS attempt_no INTEGER DEFAULT 1;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS expected JSONB;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS observed JSONB;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS delta JSONB;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS usage JSONB;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS artifact_refs JSONB DEFAULT '[]'::jsonb;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS human_summary TEXT;
ALTER TABLE step_logs ADD COLUMN IF NOT EXISTS machine_summary JSONB DEFAULT '{}'::jsonb;

-- Indexes for trace correlation and pattern detection
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_trace ON pipeline_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_failure ON pipeline_runs(failure_class);
CREATE INDEX IF NOT EXISTS idx_step_logs_trace ON step_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_span ON step_logs(span_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_fingerprint ON step_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_step_logs_severity ON step_logs(severity);

-- ============================================================================
-- GRADE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS grade_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  target_artifact_id UUID,
  phase TEXT NOT NULL DEFAULT 'pre-ship',
  hard_gate_pass BOOLEAN,
  quality_score NUMERIC,
  confidence NUMERIC,
  grader_version TEXT,
  summary TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grade_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_run_id UUID REFERENCES grade_runs(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  checker_type TEXT NOT NULL,
  score NUMERIC,
  passed BOOLEAN,
  weight NUMERIC DEFAULT 1.0,
  evidence JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ISSUE AND PATTERN TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
  grade_run_id UUID,
  fingerprint TEXT NOT NULL,
  failure_class TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  symptom JSONB DEFAULT '{}'::jsonb,
  root_cause_candidates JSONB DEFAULT '[]'::jsonb,
  selected_root_cause JSONB,
  confidence NUMERIC,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pattern_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  failure_class TEXT NOT NULL,
  support_count INTEGER DEFAULT 1,
  recent_count INTEGER DEFAULT 0,
  avg_severity NUMERIC,
  avg_quality_drop NUMERIC,
  environment_only BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'observing',
  evidence JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS improvement_backlog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID,
  change_class TEXT NOT NULL,
  title TEXT NOT NULL,
  repair_spec JSONB DEFAULT '{}'::jsonb,
  blast_radius TEXT DEFAULT 'low',
  approval_required BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repair_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backlog_id UUID REFERENCES improvement_backlog(id) ON DELETE CASCADE,
  sandbox_branch TEXT,
  applied_change JSONB DEFAULT '{}'::jsonb,
  targeted_eval_pass BOOLEAN,
  regression_eval_pass BOOLEAN,
  promoted BOOLEAN DEFAULT false,
  rollback_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for issue/pattern queries
CREATE INDEX IF NOT EXISTS idx_issue_fingerprint ON issue_instances(fingerprint);
CREATE INDEX IF NOT EXISTS idx_issue_status ON issue_instances(status);
CREATE INDEX IF NOT EXISTS idx_issue_failure_class ON issue_instances(failure_class);
CREATE INDEX IF NOT EXISTS idx_pattern_status ON pattern_candidates(status);
CREATE INDEX IF NOT EXISTS idx_pattern_fingerprint ON pattern_candidates(fingerprint);
CREATE INDEX IF NOT EXISTS idx_backlog_status ON improvement_backlog(status);
