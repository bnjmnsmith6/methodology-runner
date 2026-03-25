/**
 * Tests for tier assignment validation
 */

import { describe, it, expect } from 'vitest';
import { validateTierAssignments } from '../assignTier.js';
import { RPProposal, VisionDocument } from '../../types/vision.js';

describe('Tier Assignment Validator', () => {
  const mockVisionDoc: VisionDocument = {
    version: 1,
    status: 'draft',
    confidence: 0.8,
    source: {
      initial_user_message: 'Build a dashboard',
      conversation_summary: 'User wants a dashboard',
    },
    classification: {
      path: 'full-vision',
      complexity: 'standard',
      confidence: 0.8,
      reasons: [],
    },
    intent: {
      project_title: 'Dashboard',
      one_sentence_brief: 'Build a dashboard',
      primary_outcome: 'Dashboard built',
      non_goals: [],
    },
    users: {},
    current_state: {},
    done_definition: {
      success_criteria: [],
      acceptance_examples: [],
      out_of_scope: [],
    },
    constraints: {
      tech: [],
      product: [],
      time: [],
      policy: [],
      ux: [],
    },
    decisions_made: {
      fixed_choices: [],
      preferred_directions: [],
      rejected_directions: [],
    },
    risk_register: {
      key_risks: [],
      assumptions: [],
      unknowns: [],
    },
    decomposition_hints: {
      likely_workstreams: [],
      suspected_dependencies: [],
      suggested_rp_count: 2,
    },
    downstream_context: {
      review_focus: [],
      research_questions: [],
      build_constraints: [],
    },
  };

  it('upgrades auth-related RPs to Tier 3', () => {
    const proposals: RPProposal[] = [
      {
        title: 'User Authentication',
        description: 'Implement JWT-based auth system',
        tier: 1,
        dependencies: [],
        rationale: 'Auth is needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBe(3);
  });

  it('upgrades security-related RPs to Tier 3', () => {
    const proposals: RPProposal[] = [
      {
        title: 'Security Layer',
        description: 'Add security headers and CSRF protection',
        tier: 2,
        dependencies: [],
        rationale: 'Security needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBe(3);
  });

  it('upgrades permission-related RPs to Tier 3', () => {
    const proposals: RPProposal[] = [
      {
        title: 'RBAC System',
        description: 'Implement role-based access control with permissions',
        tier: 1,
        dependencies: [],
        rationale: 'Permissions needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBe(3);
  });

  it('upgrades data migration RPs to at least Tier 2', () => {
    const proposals: RPProposal[] = [
      {
        title: 'Database Migration',
        description: 'Migrate data from old schema to new schema',
        tier: 1,
        dependencies: [],
        rationale: 'Migration needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBeGreaterThanOrEqual(2);
  });

  it('caps single-file RPs with no dependencies at Tier 1', () => {
    const proposals: RPProposal[] = [
      {
        title: 'helper.ts',
        description: 'Single file utility helpers',
        tier: 2,
        dependencies: [],
        rationale: 'Helpers needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBe(1);
  });

  it('caps all tiers at 2 for simple complexity projects', () => {
    const simpleVisionDoc = {
      ...mockVisionDoc,
      classification: {
        ...mockVisionDoc.classification,
        complexity: 'simple' as const,
      },
    };

    const proposals: RPProposal[] = [
      {
        title: 'Feature',
        description: 'Build the feature',
        tier: 3,
        dependencies: [],
        rationale: 'Feature needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, simpleVisionDoc);

    expect(result[0].tier).toBe(2);
  });

  it('does not downgrade RPs that are correctly assigned', () => {
    const proposals: RPProposal[] = [
      {
        title: 'API Integration',
        description: 'Integrate with third-party API',
        tier: 2,
        dependencies: [],
        rationale: 'Integration needed',
        pbca_focus: [],
      },
    ];

    const result = validateTierAssignments(proposals, mockVisionDoc);

    expect(result[0].tier).toBe(2);
  });
});
