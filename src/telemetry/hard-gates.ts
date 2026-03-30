/**
 * Deterministic Hard Gates
 * 
 * Objective checks that run after every build. No LLM needed.
 * Returns pass/fail with evidence for each check.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface GateCheck {
  dimension: string;
  passed: boolean;
  checker_type: 'deterministic';
  evidence: Record<string, any>;
  notes: string;
}

export interface GateResult {
  hard_gate_pass: boolean;
  checks: GateCheck[];
  summary: string;
}

const FORBIDDEN_PATHS = [
  'node_modules',
  '.env',
  '.DS_Store',
  'package-lock.json',
  '.secret',
  '.credentials',
];

const REQUIRED_README_SECTIONS = [
  'what was built',
  'files changed',
  'how to run',
];

/**
 * Run all hard gates on a worktree after build
 */
export function runHardGates(
  worktreePath: string,
  buildResult: { changedFiles?: string[]; status?: string; summary?: string }
): GateResult {
  const checks: GateCheck[] = [];

  // 1. Repo Hygiene: No forbidden files tracked in git
  checks.push(checkRepoHygiene(worktreePath));

  // 2. Gitignore exists
  checks.push(checkGitignoreExists(worktreePath));

  // 3. Build produced files
  checks.push(checkArtifactPresence(worktreePath, buildResult));

  // 4. No uncommitted changes after commitBuildArtifacts
  checks.push(checkCleanWorkingTree(worktreePath));

  // 5. Build status was success
  checks.push(checkBuildStatus(buildResult));

  const hard_gate_pass = checks.every(c => c.passed);
  const failed = checks.filter(c => !c.passed);
  const summary = hard_gate_pass
    ? `All ${checks.length} hard gates passed`
    : `${failed.length}/${checks.length} gates failed: ${failed.map(f => f.dimension).join(', ')}`;

  return { hard_gate_pass, checks, summary };
}

function checkRepoHygiene(worktreePath: string): GateCheck {
  try {
    const tracked = execSync('git ls-files', { cwd: worktreePath, encoding: 'utf8' });
    const trackedFiles = tracked.split('\n').filter(Boolean);
    const forbidden: string[] = [];

    for (const file of trackedFiles) {
      for (const pattern of FORBIDDEN_PATHS) {
        if (file === pattern || file.startsWith(pattern + '/')) {
          forbidden.push(file);
        }
      }
    }

    // Cap at 10 to avoid massive lists
    const sample = forbidden.slice(0, 10);
    const total = forbidden.length;

    return {
      dimension: 'repo_hygiene',
      passed: forbidden.length === 0,
      checker_type: 'deterministic',
      evidence: { forbidden_tracked: sample, total_forbidden: total },
      notes: forbidden.length === 0
        ? 'No forbidden files tracked'
        : `${total} forbidden file(s) tracked in git`,
    };
  } catch {
    return {
      dimension: 'repo_hygiene',
      passed: false,
      checker_type: 'deterministic',
      evidence: { error: 'Failed to check git ls-files' },
      notes: 'Could not check repo hygiene',
    };
  }
}

function checkGitignoreExists(worktreePath: string): GateCheck {
  const exists = fs.existsSync(path.join(worktreePath, '.gitignore'));
  return {
    dimension: 'gitignore_present',
    passed: exists,
    checker_type: 'deterministic',
    evidence: { exists },
    notes: exists ? '.gitignore present' : '.gitignore missing',
  };
}

function checkArtifactPresence(
  worktreePath: string,
  buildResult: { changedFiles?: string[] }
): GateCheck {
  const expected = buildResult.changedFiles || [];
  const missing: string[] = [];

  for (const file of expected) {
    if (!fs.existsSync(path.join(worktreePath, file))) {
      missing.push(file);
    }
  }

  return {
    dimension: 'artifact_presence',
    passed: expected.length > 0 && missing.length === 0,
    checker_type: 'deterministic',
    evidence: { expected_count: expected.length, missing },
    notes: expected.length === 0
      ? 'No files reported by build'
      : missing.length === 0
        ? `All ${expected.length} expected file(s) present`
        : `${missing.length} file(s) missing: ${missing.join(', ')}`,
  };
}

function checkCleanWorkingTree(worktreePath: string): GateCheck {
  try {
    const status = execSync('git status --porcelain', { cwd: worktreePath, encoding: 'utf8' }).trim();
    const clean = status === '';
    return {
      dimension: 'clean_working_tree',
      passed: clean,
      checker_type: 'deterministic',
      evidence: { uncommitted_files: clean ? 0 : status.split('\n').length },
      notes: clean ? 'Working tree clean' : `${status.split('\n').length} uncommitted file(s)`,
    };
  } catch {
    return {
      dimension: 'clean_working_tree',
      passed: false,
      checker_type: 'deterministic',
      evidence: { error: 'Failed to check git status' },
      notes: 'Could not check working tree status',
    };
  }
}

function checkBuildStatus(buildResult: { status?: string }): GateCheck {
  const passed = buildResult.status === 'success';
  return {
    dimension: 'build_status',
    passed,
    checker_type: 'deterministic',
    evidence: { status: buildResult.status },
    notes: passed ? 'Build succeeded' : `Build status: ${buildResult.status}`,
  };
}
