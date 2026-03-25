/**
 * Result normalizer - converts CLI output to NormalizedBuildResult
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { NormalizedBuildResult, BuildRunContext } from './types.js';
import { CliRunResult } from './cli-runner.js';

const execAsync = promisify(exec);

/**
 * Normalize CLI result to standardized build result
 */
export function normalizeBuildResult(
  cliResult: CliRunResult,
  context: BuildRunContext
): NormalizedBuildResult {
  const { exitCode, rawLogPath, jsonResult, stderr, sessionId, totalCostUsd } = cliResult;
  
  // If we have valid JSON result with status field, use it
  if (jsonResult && typeof jsonResult.status === 'string') {
    const status = jsonResult.status;
    
    // Map JSON status to our terminal status
    let terminalStatus: NormalizedBuildResult['status'];
    if (status === 'success') {
      terminalStatus = 'success';
    } else if (status === 'failed') {
      terminalStatus = 'failed';
    } else if (status === 'needs_human') {
      terminalStatus = 'needs_human';
    } else {
      terminalStatus = 'infrastructure_error';
    }
    
    return {
      status: terminalStatus,
      summary: jsonResult.summary || 'Build completed',
      changedFiles: jsonResult.changed_files || [],
      commandsRun: jsonResult.commands_run,
      testsRun: jsonResult.tests_run,
      questionForHuman: jsonResult.question_for_human,
      optionsForHuman: jsonResult.options_for_human,
      assumptionsUsed: jsonResult.assumptions_used,
      sessionId: sessionId || jsonResult.session_id || context.sessionId,  // Use extracted sessionId from outer JSON
      costUsd: totalCostUsd || jsonResult.cost_usd,  // Use extracted cost from outer JSON
      numTurns: jsonResult.num_turns,
      rawLogPath
    };
  }
  
  // No valid JSON - determine status from exit code
  if (exitCode === 0) {
    // Exit code 0 but no JSON = infrastructure error
    return {
      status: 'infrastructure_error',
      summary: 'Build appeared to succeed but no valid JSON result was returned. Check raw logs.',
      changedFiles: [],
      sessionId: sessionId || context.sessionId,  // Preserve session ID even on error
      rawLogPath
    };
  } else {
    // Non-zero exit code = failed
    return {
      status: 'failed',
      summary: `Build failed with exit code ${exitCode}.\n\nStderr:\n${stderr || '(empty)'}`,
      changedFiles: [],
      sessionId: sessionId || context.sessionId,  // Preserve session ID even on error
      rawLogPath
    };
  }
}

/**
 * Get git diff stats after build
 */
export async function getGitDiffStats(worktreePath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync('git diff --stat', { cwd: worktreePath });
    return stdout.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}
