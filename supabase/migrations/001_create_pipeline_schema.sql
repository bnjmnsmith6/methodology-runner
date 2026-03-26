-- GUPPI Pipeline Tracker Schema
-- Migration: 001_create_pipeline_schema

-- Stage enum type
CREATE TYPE pipeline_stage AS ENUM (
  'research',
  'review',
  'spec',
  'build',
  'test',
  'ship'
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_stage pipeline_stage NOT NULL DEFAULT 'research',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stage transitions table
CREATE TABLE IF NOT EXISTS stage_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage pipeline_stage NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exited_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_current_stage ON projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_project_id ON stage_transitions(project_id);
CREATE INDEX IF NOT EXISTS idx_stage_transitions_stage ON stage_transitions(stage);

-- Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enforce stage transition order constraint
-- Stage order: research(0), review(1), spec(2), build(3), test(4), ship(5)
CREATE OR REPLACE FUNCTION validate_stage_transition()
RETURNS TRIGGER AS $$
DECLARE
  stage_order TEXT[] := ARRAY['research', 'review', 'spec', 'build', 'test', 'ship'];
  old_idx INT;
  new_idx INT;
BEGIN
  old_idx := array_position(stage_order, OLD.current_stage::TEXT);
  new_idx := array_position(stage_order, NEW.current_stage::TEXT);
  IF new_idx <> old_idx + 1 THEN
    RAISE EXCEPTION 'Invalid stage transition from % to %. Stages must advance sequentially.',
      OLD.current_stage, NEW.current_stage;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_stage_order
  BEFORE UPDATE OF current_stage ON projects
  FOR EACH ROW
  WHEN (OLD.current_stage IS DISTINCT FROM NEW.current_stage)
  EXECUTE FUNCTION validate_stage_transition();

-- Enable realtime for these tables
ALTER TABLE projects REPLICA IDENTITY FULL;
ALTER TABLE stage_transitions REPLICA IDENTITY FULL;

-- Seed: insert a sample project for development
-- (Remove this in production)
-- INSERT INTO projects (name, current_stage) VALUES ('Sample GUPPI Project', 'research');
