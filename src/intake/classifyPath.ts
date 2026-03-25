/**
 * Path Classifier
 * 
 * Determines whether a request should follow fast-path, micro-vision,
 * or full-vision based on complexity and coverage analysis.
 */

import { ParsedRequest } from './parseRequest.js';
import { IntakeDecision, IntakePath, CoverageStatus } from '../types/vision.js';

/**
 * Classify a parsed request into one of three paths
 */
export function classifyPath(parsed: ParsedRequest): IntakeDecision {
  const reasons: string[] = [];
  const missingFields: string[] = [];
  
  // Check for fast-path eligibility
  const fastPathResult = checkFastPath(parsed, reasons, missingFields);
  if (fastPathResult) {
    return fastPathResult;
  }
  
  // Check for full-vision triggers
  const fullVisionResult = checkFullVision(parsed, reasons, missingFields);
  if (fullVisionResult) {
    return fullVisionResult;
  }
  
  // Default: micro-vision
  return buildMicroVisionDecision(parsed, reasons, missingFields);
}

/**
 * Check if request qualifies for fast-path
 */
function checkFastPath(
  parsed: ParsedRequest,
  reasons: string[],
  missingFields: string[]
): IntakeDecision | null {
  const issues: string[] = [];
  
  // Fast-path criteria (ALL must be true)
  if (parsed.componentCount > 1) {
    issues.push(`Multiple components detected (${parsed.componentCount})`);
  }
  
  if (parsed.specificity !== 'high') {
    issues.push(`Specificity is ${parsed.specificity}, need high`);
  }
  
  if (parsed.mentionsIntegrations) {
    issues.push('Mentions integrations');
  }
  
  if (parsed.mentionsAuth) {
    issues.push('Mentions authentication/authorization');
  }
  
  if (parsed.mentionsData && !isSimpleFileOrScript(parsed)) {
    issues.push('Mentions data/database concerns');
  }
  
  if (parsed.wordCount >= 50) {
    issues.push(`Word count (${parsed.wordCount}) exceeds fast-path threshold`);
  }
  
  if (hasAmbiguousLanguage(parsed.rawMessage)) {
    issues.push('Contains ambiguous language');
  }
  
  // If no issues, it's fast-path
  if (issues.length === 0) {
    reasons.push('Single specific artifact with clear acceptance criteria');
    if (parsed.specificArtifact) {
      reasons.push(`Exact artifact identified: ${parsed.specificArtifact}`);
    }
    reasons.push('No integration, auth, or data complexity detected');
    
    // Check what's missing for coverage
    if (!parsed.artifactType) {
      missingFields.push('artifact_type');
    }
    if (!parsed.statedDoneState) {
      missingFields.push('done_state');
    }
    
    const confidence = parsed.specificArtifact && parsed.statedDoneState ? 0.9 : 0.7;
    
    return {
      path: 'fast-path',
      confidence,
      reasons,
      missingFields,
    };
  }
  
  // Not fast-path, add reasons why
  reasons.push(...issues);
  return null;
}

/**
 * Check if request requires full-vision
 */
function checkFullVision(
  parsed: ParsedRequest,
  reasons: string[],
  missingFields: string[]
): IntakeDecision | null {
  const triggers: string[] = [];
  let confidence = 0.6;
  
  // Strong triggers (high confidence)
  if (parsed.componentCount >= 4) {
    triggers.push(`Multiple components detected: ${parsed.componentCount} distinct areas`);
    confidence = 0.8;
  }
  
  if (parsed.mentionsAuth && parsed.mentionsIntegrations) {
    triggers.push('Complex system: both authentication and integrations mentioned');
    confidence = 0.8;
  }
  
  if (parsed.specificity === 'low' && parsed.componentCount >= 2) {
    triggers.push('Vague request with multiple components - need full context');
    confidence = 0.7;
  }
  
  // Medium triggers
  const lower = parsed.rawMessage.toLowerCase();
  const complexityKeywords = ['rebuild', 'redesign', 'migrate', 'overhaul', 'rewrite', 
                               'multi-tenant', 'enterprise'];
  const hasComplexityKeyword = complexityKeywords.some(kw => lower.includes(kw));
  
  if (hasComplexityKeyword) {
    triggers.push('Major system change detected (rebuild/redesign/migrate)');
    confidence = Math.max(confidence, 0.75);
  }
  
  // Check for multiple user roles
  if (parsed.statedUsers && parsed.statedUsers.length > 2) {
    triggers.push(`Multiple stakeholder groups: ${parsed.statedUsers.join(', ')}`);
    confidence = Math.max(confidence, 0.7);
  }
  
  // If any triggers fired, it's full-vision
  if (triggers.length > 0) {
    reasons.push(...triggers);
    
    // Determine missing fields for full-vision
    if (!parsed.artifactType) missingFields.push('artifact_type');
    if (!parsed.statedUsers) missingFields.push('target_user');
    if (!parsed.statedDoneState) missingFields.push('done_state');
    if (!lower.includes('current') && !lower.includes('exists') && !lower.includes('today')) {
      missingFields.push('current_state');
    }
    if (!parsed.mentionsIntegrations) missingFields.push('integrations');
    if (!parsed.mentionsData && !parsed.mentionsAuth) missingFields.push('data_auth_permissions');
    if (!lower.includes('risk') && !lower.includes('concern') && !lower.includes('worry')) {
      missingFields.push('non_obvious_risks');
    }
    if (!lower.includes('decision') && !lower.includes('chose') && !lower.includes('already')) {
      missingFields.push('decisions_already_made');
    }
    
    return {
      path: 'full-vision',
      confidence,
      reasons,
      missingFields,
    };
  }
  
  return null;
}

/**
 * Build micro-vision decision (default path)
 */
function buildMicroVisionDecision(
  parsed: ParsedRequest,
  reasons: string[],
  missingFields: string[]
): IntakeDecision {
  if (reasons.length === 0) {
    reasons.push('Standard complexity - 1-3 clarifying questions needed');
  }
  
  // Determine missing fields for micro-vision
  if (!parsed.artifactType) {
    missingFields.push('artifact_type');
    reasons.push('Artifact type needs clarification');
  }
  if (!parsed.statedUsers) {
    missingFields.push('target_user');
    reasons.push('Target user/audience not specified');
  }
  if (!parsed.statedDoneState) {
    missingFields.push('done_state');
    reasons.push('Success criteria not clearly defined');
  }
  
  const lower = parsed.rawMessage.toLowerCase();
  if (!lower.includes('current') && !lower.includes('exists') && !lower.includes('today')) {
    missingFields.push('current_state');
  }
  if (!parsed.statedConstraints || parsed.statedConstraints.length === 0) {
    missingFields.push('constraints');
  }
  
  return {
    path: 'micro-vision',
    confidence: 0.7,
    reasons,
    missingFields,
  };
}

/**
 * Check if request is for a simple file or script
 */
function isSimpleFileOrScript(parsed: ParsedRequest): boolean {
  if (!parsed.artifactType) return false;
  
  const simpleTypes = ['file', 'script'];
  return simpleTypes.includes(parsed.artifactType);
}

/**
 * Check for ambiguous language patterns
 */
function hasAmbiguousLanguage(message: string): boolean {
  const lower = message.toLowerCase();
  const ambiguousPatterns = [
    'maybe',
    'something like',
    'not sure',
    'or maybe',
    'possibly',
    'perhaps',
    'kind of',
    'sort of',
    ' or ',  // space-padded "or" to avoid matching words like "for"
  ];
  
  return ambiguousPatterns.some(pattern => lower.includes(pattern));
}
