/**
 * Vision Conversation Mode Types
 * 
 * Type definitions for the Vision intake system, including sessions,
 * documents, context packs, and decomposition proposals.
 */

// ============================================================================
// INTAKE CLASSIFICATION
// ============================================================================

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

// ============================================================================
// VISION DOCUMENT
// ============================================================================

export interface VisionDocument {
  id?: string;
  session_id?: string;
  project_id?: string;
  version: number;
  status?: 'draft' | 'final' | 'superseded';
  confidence?: number;
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
  created_at?: string;
}

// ============================================================================
// RP PROPOSAL (from decomposition)
// ============================================================================

export interface RPProposal {
  title: string;
  description: string;
  tier: 1 | 2 | 3;
  dependencies: { rpTitle: string; reason: string }[];
  rationale: string;
  pbca_focus?: string[];
}

export interface RPProposalGraph {
  rps: RPProposal[];
  execution_order: string[][];  // Array of parallel groups
}

// ============================================================================
// CONTEXT PACK (for downstream agents)
// ============================================================================

export type ContextConsumer = 'pbca' | 'review' | 'spec' | 'build';

export interface ContextPack {
  id?: string;
  project_id: string;
  rp_id?: string;
  consumer: ContextConsumer;
  payload: {
    projectSummary: string;
    rpObjective: string;
    relevantConstraints: string[];
    acceptanceCriteria: string[];
    assumptions: string[];
    dependencies: string[];
    nonGoals: string[];
    openQuestions: string[];
  };
  rendered_text?: string;
  created_at?: string;
}

// ============================================================================
// VISION SESSION STATE
// ============================================================================

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

// ============================================================================
// DECOMPOSITION DECISION
// ============================================================================

export type DecompositionStatus = 'proposed' | 'approved' | 'edited' | 'rejected';

export interface DecompositionDecision {
  id: string;
  project_id: string;
  vision_doc_id?: string;
  proposed_graph: RPProposalGraph;
  approved_graph?: RPProposalGraph;
  status: DecompositionStatus;
  explanation?: string;
  created_at: string;
}

// ============================================================================
// RP DEPENDENCY
// ============================================================================

export interface RPDependency {
  from_rp_id: string;
  to_rp_id: string;
  reason?: string;
}
