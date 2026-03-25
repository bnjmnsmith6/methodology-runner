/**
 * Claude Brain adapter types
 * 
 * Typed context packs and result types for REVIEW, SPEC, and DEBUG jobs.
 */

export type ReviewVerdict = 'PROCEED' | 'NEEDS_DECISION' | 'REDO';
export type SpecStatus = 'READY' | 'BLOCKED';
export type DebugAction = 'PATCH' | 'PATCH_AND_RETEST' | 'ESCALATE_SPEC' | 'ESCALATE_RESEARCH' | 'ASK_HUMAN';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'P1' | 'P2' | 'P3';

export interface ProjectCard {
  rpId: string;
  rpTitle: string;
  rpDescription?: string;
  projectName: string;
  projectTier: number;
  problemStatement?: string;
  successMetrics?: string[];
  constraints?: string[];
  nonGoals?: string[];
}

export interface ReviewContextPack {
  projectCard: ProjectCard;
  pbcaSlices: {
    problemFraming?: string;
    discoveryBrief?: string;
    evidenceLedger?: string;
    optionsMatrix?: string;
    plan?: string;
    redTeam?: string;
    simulation?: string;
    assumptions?: string;
  };
  rawPbcaOutput: string; // fallback if slices not parseable
}

export interface SpecContextPack {
  projectCard: ProjectCard;
  reviewOutput: string;        // full review markdown
  reviewVerdict: ReviewVerdict;
  chosenApproach?: string;
  acceptedConstraints?: string[];
  assumptionsAndTests?: string;
  evidenceTopRows?: string;
  decisionsAnswered?: { question: string; answer: string }[];
}

export interface DebugContextPack {
  projectCard: ProjectCard;
  specSlice: string;           // relevant spec sections only
  errorLogs: string;
  recentAttemptHistory: string; // last 1-2 debug attempts
  changedFiles?: string[];
  attemptNumber: number;
}

export interface ParsedHeader {
  jobType: string;
  [key: string]: string;
}

export interface ReviewResult {
  verdict: ReviewVerdict;
  confidence: Confidence;
  blockerCount: number;
  decisionCount: number;
  redoCount: number;
  markdownBody: string;
  decisionCards?: {
    decision: string;
    whyItMatters: string;
    optionA: string;
    optionB: string;
    tradeoff: string;
    recommendedDefault: string;
  }[];
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}

export interface SpecResult {
  specStatus: SpecStatus;
  confidence: Confidence;
  openDecisions: number;
  openAssumptions: number;
  constellationPacket: string;
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}

export interface DebugResult {
  action: DebugAction;
  severity: Severity;
  rootCauseConfidence: Confidence;
  repeatFailure: boolean;
  markdownBody: string;
  rawResponse: string;
  tokenUsage: { promptTokens: number; completionTokens: number };
  costEstimateUsd: number;
}
