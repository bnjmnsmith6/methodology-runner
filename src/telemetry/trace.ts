/**
 * Trace ID generation and span management
 * 
 * Every pipeline run gets a trace_id. Every step gets a span_id.
 * These correlate logs, grades, issues, and repairs.
 */

import { randomUUID } from 'crypto';

/**
 * Generate a trace ID for a pipeline run
 * Format: trc_<short-uuid> (human-readable, sortable)
 */
export function generateTraceId(): string {
  return `trc_${randomUUID().split('-')[0]}${randomUUID().split('-')[0]}`;
}

/**
 * Generate a span ID for a pipeline step
 * Format: spn_<step-name>_<short-uuid>
 */
export function generateSpanId(stepName: string): string {
  const shortStep = stepName.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase();
  return `spn_${shortStep}_${randomUUID().split('-')[0]}`;
}

/**
 * Build expected/actual/delta for a step
 */
export function buildExpectedActualDelta(
  expected: Record<string, any>,
  observed: Record<string, any>
): { expected: Record<string, any>; observed: Record<string, any>; delta: Record<string, any> } {
  const delta: Record<string, any> = {};
  
  // Find missing expected items
  const missingArtifacts: string[] = [];
  if (expected.artifacts && observed.artifacts_present) {
    for (const art of expected.artifacts) {
      if (!observed.artifacts_present.includes(art)) {
        missingArtifacts.push(art);
      }
    }
  }
  if (missingArtifacts.length > 0) delta.missing_artifacts = missingArtifacts;
  
  // Find failed checks
  const failedChecks: string[] = [];
  if (observed.checks) {
    for (const [check, result] of Object.entries(observed.checks)) {
      if (result === 'fail' || result === false) {
        failedChecks.push(check);
      }
    }
  }
  if (failedChecks.length > 0) delta.failed_checks = failedChecks;
  
  // Cost delta
  if (expected.max_cost_usd && observed.cost_usd) {
    if (observed.cost_usd > expected.max_cost_usd) {
      delta.cost_over_budget = observed.cost_usd - expected.max_cost_usd;
    }
  }
  
  return { expected, observed, delta };
}
