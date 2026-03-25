/**
 * Code Puppy adapter types
 */

export type BuildTerminalStatus = 'success' | 'failed' | 'needs_human' | 'infrastructure_error';

export interface BuildRunContext {
  projectId: string;
  rpId: string;
  jobId: string;
  executable: string;         // resolved path to claude or code-puppy
  repoRoot: string;           // project's git repo root
  worktreePath: string;       // isolated worktree for this RP
  branchName: string;         // branch for this RP lineage
  sessionId?: string;         // for session continuation across debug cycles
  packetPath: string;         // path to constellation packet in worktree
}

export interface NormalizedBuildResult {
  status: BuildTerminalStatus;
  summary: string;
  changedFiles: string[];
  commandsRun?: string[];
  testsRun?: string[];
  questionForHuman?: string;
  optionsForHuman?: string[];
  assumptionsUsed?: string[];
  sessionId?: string;
  costUsd?: number;
  numTurns?: number;
  rawLogPath: string;
}

// The JSON schema Claude Code must return
export const BUILD_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['success', 'failed', 'needs_human'] },
    summary: { type: 'string' },
    changed_files: { type: 'array', items: { type: 'string' } },
    tests_run: { type: 'array', items: { type: 'string' } },
    commands_run: { type: 'array', items: { type: 'string' } },
    question_for_human: { type: 'string' },
    options_for_human: { type: 'array', items: { type: 'string' } },
    assumptions_used: { type: 'array', items: { type: 'string' } }
  },
  required: ['status', 'summary', 'changed_files']
};
