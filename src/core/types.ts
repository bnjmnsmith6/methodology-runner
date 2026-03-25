/**
 * Core type definitions for the Methodology Runner
 * 
 * This file contains all enums, interfaces, and type definitions used throughout
 * the orchestrator system.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * The 10 canonical steps of the methodology workflow
 */
export enum Step {
  VISION = 1,       // Ben describes what he wants
  DECOMPOSE = 2,    // Claude decomposes into RPs
  RESEARCH = 3,     // PBCA runs adversarial research
  REVIEW = 4,       // Claude reviews PBCA output
  SPEC = 5,         // Claude writes Constellation Packet
  BUILD = 6,        // Code Puppy builds from spec
  SMOKE = 7,        // Automated smoke test / verification
  TEST = 8,         // Ben acceptance test (loop target)
  DEBUG = 9,        // Claude + Code Puppy fix (loop partner)
  SHIP = 10         // Deploy, archive, close
}

/**
 * Project lifecycle states
 */
export enum ProjectState {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  WAITING_DECISION = 'WAITING_DECISION',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * RP (Research Project) lifecycle states
 */
export enum RpState {
  READY = 'READY',
  RUNNING = 'RUNNING',
  WAITING_DECISION = 'WAITING_DECISION',
  WAITING_TEST = 'WAITING_TEST',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}

/**
 * Step execution status within an RP
 */
export enum StepStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  ERROR = 'ERROR',
  SKIPPED = 'SKIPPED'
}

/**
 * Job types that can be executed by the worker
 */
export enum JobType {
  PBCA_RESEARCH = 'PBCA_RESEARCH',
  CLAUDE_REVIEW = 'CLAUDE_REVIEW',
  CLAUDE_SPEC = 'CLAUDE_SPEC',
  CODEPUPPY_BUILD = 'CODEPUPPY_BUILD',
  SMOKE_RUN = 'SMOKE_RUN',
  CLAUDE_DEBUG = 'CLAUDE_DEBUG',
  CODEPUPPY_FIX = 'CODEPUPPY_FIX',
  SHIP = 'SHIP'
}

/**
 * Job execution states
 */
export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED'
}

/**
 * Decision statuses
 */
export enum DecisionStatus {
  PENDING = 'PENDING',
  ANSWERED = 'ANSWERED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED'
}

/**
 * Decision scope levels
 */
export enum DecisionScope {
  PROJECT = 'PROJECT',
  RP = 'RP'
}

// ============================================================================
// DATABASE ENTITIES
// ============================================================================

/**
 * Project entity (top-level container for work)
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  tier: 1 | 2 | 3;
  state: ProjectState;
  created_at: string;
  updated_at: string;
}

/**
 * RP (Research Project) entity
 */
export interface Rp {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  step: number;
  step_status: StepStatus;
  state: RpState;
  tier_override: 1 | 2 | 3 | null;
  priority: number;
  debug_cycle_count: number;
  max_debug_cycles: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Job entity (durable work queue)
 */
export interface Job {
  id: string;
  project_id: string;
  rp_id: string | null;
  type: JobType;
  status: JobStatus;
  priority: number;
  run_after: string;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  lease_expires_at: string | null;
  input: Record<string, any>;
  output: Record<string, any>;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Decision entity (human-in-the-loop queue)
 */
export interface Decision {
  id: string;
  project_id: string;
  rp_id: string | null;
  status: DecisionStatus;
  scope: DecisionScope;
  priority: number;
  title: string;
  prompt: string;
  options: string[];
  context: Record<string, any>;
  answered_at: string | null;
  answer: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// DRAFT TYPES (for creation)
// ============================================================================

export interface ProjectDraft {
  name: string;
  description?: string;
  tier: 1 | 2 | 3;
  state?: ProjectState;
}

export interface RpDraft {
  project_id: string;
  title: string;
  description?: string;
  tier_override?: 1 | 2 | 3;
  priority?: number;
}

export interface JobDraft {
  project_id: string;
  rp_id?: string;
  type: JobType;
  priority?: number;
  run_after?: Date;
  max_attempts?: number;
  input: Record<string, any>;
}

export interface DecisionDraft {
  project_id: string;
  rp_id?: string;
  scope: DecisionScope;
  priority?: number;
  title: string;
  prompt: string;
  options: string[];
  context?: Record<string, any>;
}

export interface ArtifactDraft {
  rp_id: string;
  type: string;
  name: string;
  content: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

/**
 * The result of executing a job via an adapter
 */
export interface ExecutionResult {
  status: 'SUCCEEDED' | 'FAILED' | 'STOP_AND_ASK';
  artifacts?: ArtifactDraft[];
  error?: {
    kind: string;
    message: string;
    retryable: boolean;
  };
  stopAndAsk?: {
    question: string;
    options: string[];
  };
}

/**
 * What the reducer outputs to advance the workflow
 */
export interface NextAction {
  enqueueJobs?: JobDraft[];
  createDecision?: DecisionDraft;
  setRpState?: {
    state?: RpState;
    step?: number;
    step_status?: StepStatus;
    incrementDebugCycle?: boolean;
  };
  setProjectState?: {
    state: ProjectState;
  };
}

// ============================================================================
// JOB INPUT/OUTPUT SHAPES
// ============================================================================

/**
 * Input shapes for each job type
 */
export interface JobInputs {
  [JobType.PBCA_RESEARCH]: {
    rp_title: string;
    rp_description: string;
    project_context: string;
    abbreviated?: boolean;
  };
  [JobType.CLAUDE_REVIEW]: {
    pbca_output: string;
    rp_context: string;
  };
  [JobType.CLAUDE_SPEC]: {
    review_output: string;
    rp_context: string;
    decisions_made: Record<string, any>[];
  };
  [JobType.CODEPUPPY_BUILD]: {
    constellation_packet: string;
    repo_path: string;
  };
  [JobType.SMOKE_RUN]: {
    repo_path: string;
    test_command?: string;
  };
  [JobType.CLAUDE_DEBUG]: {
    error_log: string;
    build_context: string;
  };
  [JobType.CODEPUPPY_FIX]: {
    fix_instructions: string;
    repo_path: string;
  };
  [JobType.SHIP]: {
    rp_id: string;
    artifacts: string[];
  };
}

/**
 * Output shapes for each job type
 */
export interface JobOutputs {
  [JobType.PBCA_RESEARCH]: {
    research_output: string;
    key_findings: string[];
  };
  [JobType.CLAUDE_REVIEW]: {
    review_summary: string;
    concerns: string[];
    validated: string[];
    changes: string[];
  };
  [JobType.CLAUDE_SPEC]: {
    constellation_packet: string;
  };
  [JobType.CODEPUPPY_BUILD]: {
    build_log: string;
    files_changed: string[];
    status: string;
  };
  [JobType.SMOKE_RUN]: {
    passed: boolean;
    log: string;
  };
  [JobType.CLAUDE_DEBUG]: {
    diagnosis: string;
    fix_instructions: string;
  };
  [JobType.CODEPUPPY_FIX]: {
    build_log: string;
    files_changed: string[];
    status: string;
  };
  [JobType.SHIP]: {
    shipped_at: string;
    archive_location: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const WORKER_CONFIG = {
  LEASE_DURATION_MS: 5 * 60 * 1000,     // 5 minutes
  POLL_INTERVAL_MS: 2 * 1000,            // 2 seconds
  RECONCILE_INTERVAL_MS: 60 * 1000,      // 1 minute
  BACKOFF_BASE_MS: 5 * 1000,             // 5 second base for retry backoff
  BACKOFF_MAX_MS: 5 * 60 * 1000,         // 5 minute max backoff
} as const;

/**
 * Mapping from Step to JobType for step initiation
 */
export const STEP_TO_JOB_MAP: Record<number, JobType> = {
  [Step.RESEARCH]: JobType.PBCA_RESEARCH,
  [Step.REVIEW]: JobType.CLAUDE_REVIEW,
  [Step.SPEC]: JobType.CLAUDE_SPEC,
  [Step.BUILD]: JobType.CODEPUPPY_BUILD,
  [Step.SMOKE]: JobType.SMOKE_RUN,
  [Step.DEBUG]: JobType.CLAUDE_DEBUG,
  [Step.SHIP]: JobType.SHIP,
};

/**
 * Steps that require human interaction (no automatic job)
 */
export const MANUAL_STEPS = [Step.VISION, Step.DECOMPOSE, Step.TEST];
