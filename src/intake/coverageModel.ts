/**
 * Coverage Model
 * 
 * Tracks which fields are known/assumed/unknown and determines when
 * the system has enough context to stop asking questions.
 */

import { CoverageState, CoverageStatus, IntakePath } from '../types/vision.js';
import { ParsedRequest } from './parseRequest.js';

/**
 * Initialize coverage state from a parsed request
 */
export function initCoverage(parsed: ParsedRequest): CoverageState {
  const coverage: CoverageState = {
    artifact_type: 'unknown',
    user_problem: 'unknown',
    target_user: 'unknown',
    current_state: 'unknown',
    done_state: 'unknown',
    constraints: 'unknown',
    must_not_do: 'unknown',
    integrations: 'unknown',
    data_auth_permissions: 'unknown',
    non_obvious_risks: 'unknown',
    decisions_already_made: 'unknown',
  };
  
  // Mark fields as known based on parsed content
  if (parsed.artifactType) {
    coverage.artifact_type = 'known';
  }
  
  // User problem is always at least assumed from the initial message
  coverage.user_problem = 'assumed';
  
  if (parsed.statedUsers && parsed.statedUsers.length > 0) {
    coverage.target_user = 'known';
  }
  
  if (parsed.statedDoneState) {
    coverage.done_state = 'known';
  } else if (parsed.specificArtifact) {
    // If they specified an exact artifact, we can assume done state
    coverage.done_state = 'assumed';
  }
  
  if (parsed.statedConstraints && parsed.statedConstraints.length > 0) {
    coverage.constraints = 'known';
  }
  
  const lower = parsed.rawMessage.toLowerCase();
  
  // Check for current state mentions
  if (lower.includes('current') || lower.includes('exists') || lower.includes('today') ||
      lower.includes('right now') || lower.includes('currently')) {
    coverage.current_state = 'known';
  }
  
  // Integrations
  if (parsed.mentionsIntegrations) {
    coverage.integrations = 'known';
  } else if (parsed.artifactType === 'file' || parsed.artifactType === 'script') {
    // Simple files likely don't need integrations
    coverage.integrations = 'assumed';
  }
  
  // Data/auth permissions
  if (parsed.mentionsData || parsed.mentionsAuth) {
    coverage.data_auth_permissions = 'known';
  } else if (parsed.artifactType === 'file' || parsed.artifactType === 'script') {
    // Simple files likely don't need special data/auth
    coverage.data_auth_permissions = 'assumed';
  }
  
  // Must not do
  if (lower.includes('don\'t') || lower.includes('not') || lower.includes('avoid') ||
      lower.includes('exclude') || lower.includes('without')) {
    coverage.must_not_do = 'known';
  }
  
  // Risks
  if (lower.includes('risk') || lower.includes('concern') || lower.includes('worry') ||
      lower.includes('careful') || lower.includes('important')) {
    coverage.non_obvious_risks = 'known';
  }
  
  // Decisions already made
  if (lower.includes('decided') || lower.includes('chose') || lower.includes('using') ||
      lower.includes('with ') || parsed.statedConstraints) {
    coverage.decisions_already_made = 'known';
  }
  
  return coverage;
}

/**
 * Update coverage based on new information from user
 */
export function updateCoverage(
  current: CoverageState,
  newInfo: Record<string, string>
): CoverageState {
  const updated = { ...current };
  
  // Map of field names to coverage keys
  const fieldMap: Record<string, keyof CoverageState> = {
    'artifact': 'artifact_type',
    'artifact_type': 'artifact_type',
    'user': 'target_user',
    'target_user': 'target_user',
    'for': 'target_user',
    'current': 'current_state',
    'current_state': 'current_state',
    'exists': 'current_state',
    'done': 'done_state',
    'done_state': 'done_state',
    'success': 'done_state',
    'constraint': 'constraints',
    'constraints': 'constraints',
    'requirement': 'constraints',
    'integration': 'integrations',
    'integrations': 'integrations',
    'auth': 'data_auth_permissions',
    'data': 'data_auth_permissions',
    'permissions': 'data_auth_permissions',
    'risk': 'non_obvious_risks',
    'risks': 'non_obvious_risks',
    'decision': 'decisions_already_made',
    'decisions': 'decisions_already_made',
    'avoid': 'must_not_do',
    'dont': 'must_not_do',
    'not': 'must_not_do',
  };
  
  // Update coverage based on new info
  for (const [key, value] of Object.entries(newInfo)) {
    const coverageKey = fieldMap[key.toLowerCase()];
    if (coverageKey && value && value.trim().length > 0) {
      updated[coverageKey] = 'known';
    }
  }
  
  return updated;
}

/**
 * Check if we have enough coverage to stop asking questions
 */
export function hasEnoughCoverage(coverage: CoverageState, path: IntakePath): boolean {
  const requiredFields = getRequiredFields(path);
  
  for (const field of requiredFields) {
    const status = coverage[field];
    if (status === 'unknown') {
      return false;
    }
  }
  
  return true;
}

/**
 * Get the most important unknown field (next thing to ask about)
 */
export function getHighestValueUnknown(
  coverage: CoverageState,
  path: IntakePath
): string | null {
  // Priority order for what to ask next
  const priorityOrder: (keyof CoverageState)[] = [
    'target_user',
    'done_state',
    'current_state',
    'data_auth_permissions',
    'constraints',
    'non_obvious_risks',
    'integrations',
    'artifact_type',
    'must_not_do',
    'decisions_already_made',
    'user_problem',
  ];
  
  const requiredFields = getRequiredFields(path);
  
  // Find first unknown field in priority order that's required for this path
  for (const field of priorityOrder) {
    if (requiredFields.includes(field) && coverage[field] === 'unknown') {
      return field;
    }
  }
  
  return null;
}

/**
 * Get coverage summary for logging/debugging
 */
export function getCoverageSummary(coverage: CoverageState): {
  known: number;
  assumed: number;
  unknown: number;
  total: number;
} {
  const values = Object.values(coverage);
  const known = values.filter(v => v === 'known').length;
  const assumed = values.filter(v => v === 'assumed').length;
  const unknown = values.filter(v => v === 'unknown').length;
  
  return {
    known,
    assumed,
    unknown,
    total: values.length,
  };
}

/**
 * Get required fields for a given path
 */
function getRequiredFields(path: IntakePath): (keyof CoverageState)[] {
  switch (path) {
    case 'fast-path':
      return ['artifact_type', 'done_state'];
    
    case 'micro-vision':
      return [
        'artifact_type',
        'target_user',
        'done_state',
        'current_state',
        'constraints',
      ];
    
    case 'full-vision':
      return [
        'artifact_type',
        'target_user',
        'done_state',
        'current_state',
        'constraints',
        'integrations',
        'data_auth_permissions',
        'non_obvious_risks',
        'decisions_already_made',
      ];
    
    default:
      return [];
  }
}
