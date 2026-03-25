/**
 * Tests for context pack builder
 */

import { describe, it, expect } from 'vitest';
import { buildContextPack } from '../buildContextPack.js';
import { VisionDocument, RPProposal } from '../../types/vision.js';

describe('Context Pack Builder', () => {
  const mockVisionDoc: VisionDocument = {
    version: 1,
    status: 'draft',
    confidence: 0.8,
    source: {
      initial_user_message: 'Build a dashboard',
      conversation_summary: 'User wants a metrics dashboard',
    },
    classification: {
      path: 'full-vision',
      complexity: 'standard',
      confidence: 0.8,
      reasons: [],
    },
    intent: {
      project_title: 'Metrics Dashboard',
      one_sentence_brief: 'Build a real-time metrics dashboard',
      primary_outcome: 'Users can view metrics',
      non_goals: ['Mobile app', 'Offline support'],
    },
    users: {
      primary_user: 'Engineering managers',
    },
    current_state: {},
    done_definition: {
      success_criteria: ['Dashboard must load in < 2s', 'Must show real-time data'],
      acceptance_examples: ['User sees CPU metrics updating'],
      out_of_scope: ['Historical data beyond 7 days'],
    },
    constraints: {
      tech: ['Must use React', 'Must work in Chrome'],
      product: ['No more than 5 widgets'],
      time: [],
      policy: [],
      ux: [],
    },
    decisions_made: {
      fixed_choices: ['Use WebSockets for real-time'],
      preferred_directions: [],
      rejected_directions: ['Polling approach'],
    },
    risk_register: {
      key_risks: ['WebSocket stability'],
      assumptions: ['Backend API is stable'],
      unknowns: ['What metrics to show?'],
    },
    decomposition_hints: {
      likely_workstreams: ['Backend', 'Frontend'],
      suspected_dependencies: [],
      suggested_rp_count: 2,
    },
    downstream_context: {
      review_focus: ['Verify WebSocket error handling'],
      research_questions: ['How to handle disconnections?'],
      build_constraints: [],
    },
  };

  const mockRPProposal: RPProposal = {
    title: 'Dashboard Frontend',
    description: 'Build the React dashboard with real-time widgets. Must show CPU and memory metrics.',
    tier: 2,
    dependencies: [
      { rpTitle: 'Metrics API', reason: 'Needs API endpoints' },
    ],
    rationale: 'UI is separate from backend',
    pbca_focus: ['How to optimize re-renders?', 'WebSocket connection management'],
  };

  describe('PBCA context pack', () => {
    it('includes research questions and assumptions', () => {
      const pack = buildContextPack('pbca', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.consumer).toBe('pbca');
      expect(pack.payload.openQuestions).toContain('What metrics to show?');
      expect(pack.payload.openQuestions).toContain('How to optimize re-renders?');
      expect(pack.payload.assumptions).toContain('Backend API is stable');
    });

    it('includes all relevant constraints', () => {
      const pack = buildContextPack('pbca', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.relevantConstraints).toContain('Must use React');
      expect(pack.payload.relevantConstraints).toContain('Must work in Chrome');
      expect(pack.payload.relevantConstraints).toContain('No more than 5 widgets');
    });

    it('includes dependencies', () => {
      const pack = buildContextPack('pbca', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.dependencies).toHaveLength(1);
      expect(pack.payload.dependencies[0]).toContain('Metrics API');
    });

    it('includes non-goals', () => {
      const pack = buildContextPack('pbca', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.nonGoals).toContain('Mobile app');
      expect(pack.payload.nonGoals).toContain('Historical data beyond 7 days');
    });
  });

  describe('Review context pack', () => {
    it('includes decisions to challenge', () => {
      const pack = buildContextPack('review', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.consumer).toBe('review');
      expect(pack.payload.relevantConstraints).toContain('Use WebSockets for real-time');
      expect(pack.payload.relevantConstraints).toContain('Rejected: Polling approach');
    });

    it('includes review-specific focus areas', () => {
      const pack = buildContextPack('review', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.openQuestions).toContain('Verify WebSocket error handling');
    });

    it('includes assumptions for review to challenge', () => {
      const pack = buildContextPack('review', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.assumptions).toContain('Backend API is stable');
    });
  });

  describe('Spec context pack', () => {
    it('includes only tech constraints', () => {
      const pack = buildContextPack('spec', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.consumer).toBe('spec');
      expect(pack.payload.relevantConstraints).toContain('Must use React');
      expect(pack.payload.relevantConstraints).not.toContain('No more than 5 widgets'); // product constraint
    });

    it('includes acceptance examples', () => {
      const pack = buildContextPack('spec', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      const exampleCriteria = pack.payload.acceptanceCriteria.find(c => c.includes('Example:'));
      expect(exampleCriteria).toBeDefined();
      expect(exampleCriteria).toContain('User sees CPU metrics updating');
    });

    it('includes only fixed decisions (not assumptions)', () => {
      const pack = buildContextPack('spec', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.assumptions).toContain('Use WebSockets for real-time');
      expect(pack.payload.assumptions).not.toContain('Backend API is stable'); // assumption, not decision
    });

    it('has no open questions', () => {
      const pack = buildContextPack('spec', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.openQuestions).toHaveLength(0);
    });
  });

  describe('Build context pack', () => {
    it('includes only tech constraints', () => {
      const pack = buildContextPack('build', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.consumer).toBe('build');
      expect(pack.payload.relevantConstraints).toContain('Must use React');
      expect(pack.payload.relevantConstraints).toContain('Must work in Chrome');
    });

    it('filters for testable criteria only', () => {
      const pack = buildContextPack('build', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      // Should include criteria with testable keywords
      const hasTestable = pack.payload.acceptanceCriteria.some(
        c => c.toLowerCase().includes('must') || c.toLowerCase().includes('should')
      );
      expect(hasTestable).toBe(true);
      // Should have at least one criterion
      expect(pack.payload.acceptanceCriteria.length).toBeGreaterThan(0);
    });

    it('has no assumptions', () => {
      const pack = buildContextPack('build', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.assumptions).toHaveLength(0);
    });

    it('has no open questions', () => {
      const pack = buildContextPack('build', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.openQuestions).toHaveLength(0);
    });

    it('includes dependencies in concrete terms', () => {
      const pack = buildContextPack('build', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.payload.dependencies).toHaveLength(1);
      expect(pack.payload.dependencies[0]).toContain('Depends on: Metrics API');
    });
  });

  describe('All consumers', () => {
    it('include project summary and RP objective', () => {
      const consumers = ['pbca', 'review', 'spec', 'build'] as const;
      
      consumers.forEach(consumer => {
        const pack = buildContextPack(consumer, mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');
        
        expect(pack.payload.projectSummary).toBe('Build a real-time metrics dashboard');
        expect(pack.payload.rpObjective).toContain('Build the React dashboard');
      });
    });

    it('set correct metadata', () => {
      const pack = buildContextPack('pbca', mockVisionDoc, mockRPProposal, 'proj-1', 'rp-1');

      expect(pack.project_id).toBe('proj-1');
      expect(pack.rp_id).toBe('rp-1');
      expect(pack.consumer).toBe('pbca');
    });
  });
});
