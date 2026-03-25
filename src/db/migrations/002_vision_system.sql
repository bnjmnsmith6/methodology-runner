-- Migration 002: Vision System Tables
-- Creates the database foundation for Vision Conversation Mode

-- ============================================================================
-- VISION SESSIONS TABLE
-- Tracks the intake conversation state
-- ============================================================================

CREATE TABLE IF NOT EXISTS vision_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',  -- active, completed, abandoned
  path TEXT,  -- fast-path, micro-vision, full-vision
  classifier_confidence NUMERIC,
  classifier_reasons JSONB DEFAULT '[]'::jsonb,
  coverage JSONB DEFAULT '{}'::jsonb,
  current_summary TEXT,
  last_question TEXT,
  turn_count INTEGER DEFAULT 0,
  initial_message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- VISION MESSAGES TABLE
-- The conversation transcript
-- ============================================================================

CREATE TABLE IF NOT EXISTS vision_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES vision_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- VISION DOCUMENTS TABLE
-- The canonical structured context
-- ============================================================================

CREATE TABLE IF NOT EXISTS vision_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES vision_sessions(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, final, superseded
  doc JSONB NOT NULL,
  rendered_markdown TEXT,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- RP DEPENDENCIES TABLE
-- DAG edges between RPs
-- ============================================================================

CREATE TABLE IF NOT EXISTS rp_dependencies (
  from_rp_id UUID NOT NULL REFERENCES rps(id) ON DELETE CASCADE,
  to_rp_id UUID NOT NULL REFERENCES rps(id) ON DELETE CASCADE,
  reason TEXT,
  PRIMARY KEY (from_rp_id, to_rp_id)
);

-- ============================================================================
-- CONTEXT PACKS TABLE
-- Role-specific context slices for downstream agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS context_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE SET NULL,
  consumer TEXT NOT NULL,  -- pbca, review, spec, build
  payload JSONB NOT NULL,
  rendered_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- DECOMPOSITION DECISIONS TABLE
-- Proposed and approved RP graphs
-- ============================================================================

CREATE TABLE IF NOT EXISTS decomposition_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  vision_doc_id UUID REFERENCES vision_documents(id) ON DELETE SET NULL,
  proposed_graph JSONB NOT NULL,
  approved_graph JSONB,
  status TEXT NOT NULL DEFAULT 'proposed',  -- proposed, approved, edited, rejected
  explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ALTER EXISTING TABLES
-- Add vision reference to rps table
-- ============================================================================

-- Add vision reference to rps table
ALTER TABLE rps ADD COLUMN IF NOT EXISTS source_vision_doc_id UUID REFERENCES vision_documents(id) ON DELETE SET NULL;

-- Add tier column to rps if it doesn't exist
-- Note: tier_override already exists, this is for the actual tier
ALTER TABLE rps ADD COLUMN IF NOT EXISTS tier INTEGER;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Vision Sessions indexes
CREATE INDEX IF NOT EXISTS idx_vision_sessions_status ON vision_sessions(status);
CREATE INDEX IF NOT EXISTS idx_vision_sessions_project ON vision_sessions(project_id);

-- Vision Messages indexes
CREATE INDEX IF NOT EXISTS idx_vision_messages_session ON vision_messages(session_id);

-- Vision Documents indexes
CREATE INDEX IF NOT EXISTS idx_vision_documents_project ON vision_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_vision_documents_session ON vision_documents(session_id);

-- Context Packs indexes
CREATE INDEX IF NOT EXISTS idx_context_packs_project ON context_packs(project_id);
CREATE INDEX IF NOT EXISTS idx_context_packs_rp ON context_packs(rp_id);
CREATE INDEX IF NOT EXISTS idx_context_packs_consumer ON context_packs(consumer);

-- RP Dependencies indexes
CREATE INDEX IF NOT EXISTS idx_rp_dependencies_from ON rp_dependencies(from_rp_id);
CREATE INDEX IF NOT EXISTS idx_rp_dependencies_to ON rp_dependencies(to_rp_id);

-- ============================================================================
-- TRIGGERS
-- Apply auto-update updated_at timestamps to new tables
-- ============================================================================

-- Vision Sessions trigger
CREATE TRIGGER update_vision_sessions_updated_at BEFORE UPDATE ON vision_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 002_vision_system.sql completed successfully';
END $$;
