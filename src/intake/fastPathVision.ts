/**
 * Fast-path Vision Document Generator
 * 
 * Creates minimal Vision Documents for simple requests without conversation
 */

import { ParsedRequest } from './parseRequest.js';
import { VisionDocument } from '../types/vision.js';

/**
 * Build a fast-path Vision Document from a parsed request
 */
export function buildFastPathVision(parsed: ParsedRequest): VisionDocument {
  // Extract project title from artifact or message
  const projectTitle = buildProjectTitle(parsed);
  
  return {
    version: 1,
    status: 'draft',
    confidence: 0.85, // Fast-path has high confidence since it's specific
    
    source: {
      initial_user_message: parsed.rawMessage,
      conversation_summary: 'Fast-path request (no conversation needed)',
    },
    
    classification: {
      path: 'fast-path',
      complexity: 'simple',
      confidence: 0.9,
      reasons: [
        'Single specific artifact with clear criteria',
        'No integration, auth, or data complexity',
      ],
    },
    
    intent: {
      project_title: projectTitle,
      one_sentence_brief: parsed.rawMessage,
      primary_outcome: parsed.statedDoneState || 'Artifact functions as specified',
      non_goals: [
        'No UI changes beyond the specified artifact',
        'No database or backend changes',
        'No integration with external systems',
      ],
    },
    
    users: {
      primary_user: parsed.statedUsers?.[0] || 'Developer',
      secondary_users: parsed.statedUsers?.slice(1),
      stakeholders: [],
    },
    
    current_state: {
      what_exists_now: 'Unknown (fast-path skipped this question)',
      pain_points: [],
      replaced_systems: [],
    },
    
    done_definition: {
      success_criteria: [
        parsed.statedDoneState || 'Output matches specification',
        'Code runs without errors',
        'Acceptance criteria from request are met',
      ],
      acceptance_examples: [
        `User provides: ${parsed.rawMessage}`,
        'System delivers the specified artifact',
      ],
      out_of_scope: [
        'Any changes beyond the specified artifact',
        'Performance optimization',
        'Production deployment',
      ],
    },
    
    constraints: {
      tech: parsed.statedConstraints || [],
      product: [],
      time: ['Fast-path implies urgency or simplicity'],
      policy: [],
      ux: [],
    },
    
    decisions_made: {
      fixed_choices: [
        `Artifact type: ${parsed.artifactType || 'file'}`,
        parsed.specificArtifact ? `Target: ${parsed.specificArtifact}` : '',
      ].filter(Boolean),
      preferred_directions: [],
      rejected_directions: [],
    },
    
    risk_register: {
      key_risks: [
        'Request may be more complex than it appears',
        'User may have unstated requirements',
      ],
      assumptions: [
        'Request is self-contained',
        'No external dependencies required',
        'User has provided complete specification',
      ],
      unknowns: [
        'Current state of the system',
        'Integration requirements',
      ],
    },
    
    decomposition_hints: {
      likely_workstreams: ['Single implementation task'],
      suspected_dependencies: [],
      suggested_rp_count: 1,
    },
    
    downstream_context: {
      review_focus: [
        'Does output match exact request?',
        'Are there any hidden edge cases?',
      ],
      research_questions: [],
      build_constraints: [
        'Implement exactly what was requested, no more',
        'Keep changes minimal and focused',
      ],
    },
  };
}

/**
 * Build a project title from parsed request
 */
function buildProjectTitle(parsed: ParsedRequest): string {
  if (parsed.specificArtifact) {
    return `Create ${parsed.specificArtifact}`;
  }
  
  if (parsed.artifactType) {
    return `Create ${parsed.artifactType}`;
  }
  
  // Fallback: use first few words of message
  const words = parsed.rawMessage.split(/\s+/).slice(0, 5);
  return words.join(' ') + (words.length >= 5 ? '...' : '');
}
