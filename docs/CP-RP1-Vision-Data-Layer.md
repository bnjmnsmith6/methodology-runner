# Constellation Packet — RP-1: Data Layer + Vision Document Schema
**Project:** GUPPI Vision Conversation Mode
**Tier:** 2
**Date:** 2026-03-25
**Dependencies:** None (this is the foundation)

---

## Context Block

GUPPI is getting a new front door. Instead of immediately creating one project and one RP from a user's chat message, the system will run an adaptive conversation to gather context, produce a Vision Document, and decompose the work into the right RPs. This RP builds the database foundation that everything else depends on.

The PBCA research recommends a hybrid coverage-driven conversation with three paths (fast-path, micro-vision, full-vision), a canonical Vision Document as shared project memory, and role-specific context packs for downstream agents. All of this needs persistent storage.

**Existing tables:** projects, rps, jobs, decisions
**New tables needed:** vision_sessions, vision_messages, vision_documents, rp_dependencies, context_packs, decomposition_decisions
**Existing fields that need updates:** rps table needs source_vision_doc_id, tier (if not present), and dependency support

**Tech Stack:** Supabase (Postgres), TypeScript, existing migration pattern in src/db/migrations/

---

## Implementation Spec

### What to Build

Database migrations and TypeScript types for the Vision Conversation system. No application logic — just the schema, types, and repository functions.

### Build Order

**Step 1: New migration file**

Create `src/db/migrations/002_vision_system.sql`:

```sql
-- Vision Sessions: tracks the intake conversation state
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

-- Vision Messages: the conversation transcript
CREATE TABLE IF NOT EXISTS vision_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES vision_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vision Documents: the canonical structured context
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

-- RP Dependencies: DAG edges between RPs
CREATE TABLE IF NOT EXISTS rp_dependencies (
  from_rp_id UUID NOT NULL REFERENCES rps(id) ON DELETE CASCADE,
  to_rp_id UUID NOT NULL REFERENCES rps(id) ON DELETE CASCADE,
  reason TEXT,
  PRIMARY KEY (from_rp_id, to_rp_id)
);

-- Context Packs: role-specific context slices for downstream agents
CREATE TABLE IF NOT EXISTS context_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  rp_id UUID REFERENCES rps(id) ON DELETE SET NULL,
  consumer TEXT NOT NULL,  -- pbca, review, spec, build
  payload JSONB NOT NULL,
  rendered_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Decomposition Decisions: proposed and approved RP graphs
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

-- Add vision reference to rps table
ALTER TABLE rps ADD COLUMN IF NOT EXISTS source_vision_doc_id UUID REFERENCES vision_documents(id) ON DELETE SET NULL;

-- Add tier column to rps if it doesn't exist (it might already via tier_override)
-- Check first: if tier_override exists, we'll use that. If not, add tier.
ALTER TABLE rps ADD COLUMN IF NOT EXISTS tier INTEGER;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vision_sessions_status ON vision_sessions(status);
CREATE INDEX IF NOT EXISTS idx_vision_sessions_project ON vision_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_vision_messages_session ON vision_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_vision_documents_project ON vision_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_vision_documents_session ON vision_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_context_packs_project ON context_packs(project_id);
CREATE INDEX IF NOT EXISTS idx_context_packs_rp ON context_packs(rp_id);
CREATE INDEX IF NOT EXISTS idx_context_packs_consumer ON context_packs(consumer);
CREATE INDEX IF NOT EXISTS idx_rp_dependencies_from ON rp_dependencies(from_rp_id);
CREATE INDEX IF NOT EXISTS idx_rp_dependencies_to ON rp_dependencies(to_rp_id);
```

**Step 2: Run the migration**

Run this SQL against the Supabase database. You can do this via the Supabase SQL Editor or a migration script.

**Step 3: TypeScript types**

Create `src/types/vision.ts`:

```typescript
// Intake classification
export type IntakePath = 'fast-path' | 'micro-vision' | 'full-vision';

export type CoverageStatus = 'known' | 'assumed' | 'unknown';

export type CoverageState = {
  artifact_type: CoverageStatus;
  user_problem: CoverageStatus;
  target_user: CoverageStatus;
  current_state: CoverageStatus;
  done_state: CoverageStatus;
  constraints: CoverageStatus;
  must_not_do: CoverageStatus;
  integrations: CoverageStatus;
  data_auth_permissions: CoverageStatus;
  non_obvious_risks: CoverageStatus;
  decisions_already_made: CoverageStatus;
};

export interface IntakeDecision {
  path: IntakePath;
  confidence: number;
  reasons: string[];
  missingFields: string[];
}

// Vision Document
export interface VisionDocument {
  id?: string;
  project_id?: string;
  version: number;
  source: {
    initial_user_message: string;
    conversation_summary: string;
    transcript_refs?: string[];
  };
  classification: {
    path: IntakePath;
    complexity: 'simple' | 'standard' | 'complex';
    confidence: number;
    reasons: string[];
  };
  intent: {
    project_title: string;
    one_sentence_brief: string;
    job_story?: string;
    primary_outcome: string;
    non_goals: string[];
  };
  users: {
    primary_user?: string;
    secondary_users?: string[];
    stakeholders?: string[];
  };
  current_state: {
    what_exists_now?: string;
    pain_points?: string[];
    replaced_systems?: string[];
  };
  done_definition: {
    success_criteria: string[];
    acceptance_examples: string[];
    out_of_scope: string[];
  };
  constraints: {
    tech: string[];
    product: string[];
    time: string[];
    policy: string[];
    ux: string[];
  };
  decisions_made: {
    fixed_choices: string[];
    preferred_directions: string[];
    rejected_directions: string[];
  };
  risk_register: {
    key_risks: string[];
    assumptions: string[];
    unknowns: string[];
  };
  decomposition_hints: {
    likely_workstreams: string[];
    suspected_dependencies: string[];
    suggested_rp_count: number;
  };
  downstream_context: {
    review_focus: string[];
    research_questions: string[];
    build_constraints: string[];
  };
}

// RP Proposal from decomposition
export interface RPProposal {
  title: string;
  description: string;
  tier: 1 | 2 | 3;
  dependencies: { rpTitle: string; reason: string }[];
  rationale: string;
  pbca_focus?: string[];
}

// Context Pack for downstream agents
export type ContextConsumer = 'pbca' | 'review' | 'spec' | 'build';

export interface ContextPack {
  consumer: ContextConsumer;
  projectSummary: string;
  rpObjective: string;
  relevantConstraints: string[];
  acceptanceCriteria: string[];
  assumptions: string[];
  dependencies: string[];
  nonGoals: string[];
  openQuestions: string[];
}

// Vision Session state
export type SessionStatus = 'active' | 'completed' | 'abandoned';

export interface VisionSession {
  id: string;
  project_id?: string;
  status: SessionStatus;
  path?: IntakePath;
  classifier_confidence?: number;
  classifier_reasons?: string[];
  coverage: CoverageState;
  current_summary?: string;
  last_question?: string;
  turn_count: number;
  initial_message: string;
  created_at: string;
  updated_at: string;
}

export interface VisionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  created_at: string;
}
```

**Step 4: Repository functions**

Create `src/db/vision-repo.ts`:

```typescript
// CRUD operations for the vision system tables.
// Each function uses the existing Supabase client.
// Functions needed:

// Vision Sessions
export async function createVisionSession(initialMessage: string, path?: IntakePath): Promise<VisionSession>
export async function getVisionSession(id: string): Promise<VisionSession | null>
export async function updateVisionSession(id: string, updates: Partial<VisionSession>): Promise<VisionSession>
export async function getActiveSessionForUser(): Promise<VisionSession | null>

// Vision Messages
export async function addVisionMessage(sessionId: string, role: string, content: string, metadata?: any): Promise<VisionMessage>
export async function getVisionMessages(sessionId: string): Promise<VisionMessage[]>

// Vision Documents
export async function createVisionDocument(sessionId: string, doc: VisionDocument): Promise<{ id: string }>
export async function getVisionDocument(id: string): Promise<VisionDocument | null>
export async function getLatestVisionDocForProject(projectId: string): Promise<VisionDocument | null>
export async function updateVisionDocStatus(id: string, status: string): Promise<void>

// RP Dependencies
export async function addRPDependency(fromRpId: string, toRpId: string, reason: string): Promise<void>
export async function getRPDependencies(rpId: string): Promise<{ from_rp_id: string; to_rp_id: string; reason: string }[]>

// Context Packs
export async function createContextPack(pack: { project_id: string; rp_id?: string; consumer: string; payload: any; rendered_text: string }): Promise<{ id: string }>
export async function getContextPack(projectId: string, rpId: string, consumer: string): Promise<any | null>

// Decomposition Decisions
export async function createDecompositionDecision(projectId: string, visionDocId: string, proposedGraph: any, explanation: string): Promise<{ id: string }>
export async function approveDecomposition(decisionId: string, approvedGraph?: any): Promise<void>
```

Implement each function using the existing Supabase client pattern from the codebase. Look at how `src/db/` or `src/services/` currently interacts with Supabase and follow the same pattern.

**Step 5: Export and wire up**

Create `src/types/index.ts` (or update if it exists) to export all vision types.
Create `src/db/index.ts` (or update if it exists) to export vision-repo functions.

### File Structure

```
src/
  types/
    vision.ts              # NEW — all vision system types
  db/
    migrations/
      002_vision_system.sql  # NEW — migration
    vision-repo.ts           # NEW — CRUD functions
```

---

## Constraints (What NOT to Do)

- DO NOT modify the existing projects, rps, jobs, or decisions tables beyond adding the source_vision_doc_id column to rps
- DO NOT add application logic — this RP is schema and types only
- DO NOT create API endpoints — that's RP-6
- DO NOT implement the classifier, conversation, or decomposition — those are RP-2 through RP-4
- DO NOT change the existing chat tools or system prompt

---

## Stop and Ask List

1. **Supabase migration method.** If the project uses a migration runner script, use it. If migrations are run manually via SQL Editor, just create the .sql file. Don't guess — check how 001_core_tables.sql was applied.
2. **Existing Supabase client.** Find the existing Supabase client configuration and use the same pattern. Don't create a new Supabase client.
3. **Column conflicts.** If `rps` already has a `tier` column (not just `tier_override`), don't add a duplicate. Check first.

---

## Acceptance Criteria

- [ ] Migration SQL file exists and is valid
- [ ] Running the migration creates all 6 new tables + indexes
- [ ] The `rps` table has a `source_vision_doc_id` column
- [ ] TypeScript types compile cleanly
- [ ] Repository functions exist for all CRUD operations listed above
- [ ] Repository functions use the existing Supabase client pattern
- [ ] No changes to existing application logic
- [ ] All existing tests still pass
