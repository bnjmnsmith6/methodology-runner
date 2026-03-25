-- ============================================================================
-- RP PROPOSALS TABLE
-- Stores decomposed RPs before project approval
-- ============================================================================

CREATE TABLE IF NOT EXISTS rp_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vision_doc_id UUID NOT NULL REFERENCES vision_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  dependencies JSONB DEFAULT '[]'::jsonb,  -- Array of RP titles this depends on
  estimated_complexity TEXT,  -- low, medium, high
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookups by vision doc
CREATE INDEX IF NOT EXISTS idx_rp_proposals_vision_doc ON rp_proposals(vision_doc_id);
