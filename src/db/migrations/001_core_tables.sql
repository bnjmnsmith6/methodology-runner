-- Migration 001: Core Tables
-- Creates the 4 foundational tables for the Methodology Runner

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  tier INT NOT NULL CHECK (tier IN (1, 2, 3)),
  state TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (state IN ('DRAFT', 'ACTIVE', 'WAITING_DECISION', 'PAUSED', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RPS (RESEARCH PROJECTS) TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  step INT NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 10),
  step_status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (step_status IN ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ERROR', 'SKIPPED')),
  state TEXT NOT NULL DEFAULT 'READY'
    CHECK (state IN ('READY', 'RUNNING', 'WAITING_DECISION', 'WAITING_TEST', 'COMPLETED', 'FAILED', 'CANCELED')),
  tier_override INT NULL CHECK (tier_override IN (1, 2, 3)),
  priority INT NOT NULL DEFAULT 100,
  debug_cycle_count INT NOT NULL DEFAULT 0,
  max_debug_cycles INT NOT NULL DEFAULT 8,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- JOBS TABLE (DURABLE WORK QUEUE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED')),
  priority INT NOT NULL DEFAULT 100,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- DECISIONS TABLE (HUMAN-IN-THE-LOOP QUEUE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ANSWERED', 'CANCELED', 'EXPIRED')),
  scope TEXT NOT NULL CHECK (scope IN ('PROJECT', 'RP')),
  priority INT NOT NULL DEFAULT 100,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  answered_at TIMESTAMPTZ,
  answer JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- RPs indexes
CREATE INDEX IF NOT EXISTS idx_rps_project_id ON rps(project_id);
CREATE INDEX IF NOT EXISTS idx_rps_state_priority ON rps(state, priority, updated_at);

-- Jobs indexes (critical for worker performance)
CREATE INDEX IF NOT EXISTS idx_jobs_queued ON jobs(status, run_after, priority) 
  WHERE status = 'QUEUED';
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_rp_id ON jobs(rp_id);
CREATE INDEX IF NOT EXISTS idx_jobs_lease_expiry ON jobs(lease_expires_at)
  WHERE status = 'RUNNING';

-- Decisions indexes
CREATE INDEX IF NOT EXISTS idx_decisions_pending ON decisions(status, priority, created_at)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_decisions_project_id ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_rp_id ON decisions(rp_id);

-- ============================================================================
-- TRIGGERS (auto-update updated_at timestamps)
-- ============================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rps_updated_at BEFORE UPDATE ON rps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decisions_updated_at BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 001_core_tables.sql completed successfully';
END $$;
