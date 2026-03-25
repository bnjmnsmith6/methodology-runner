/**
 * Tests for decomposition explainer
 */

import { describe, it, expect } from 'vitest';
import { formatDecompositionForUser, formatDecompositionSummary } from '../explainDecomposition.js';
import { RPProposal } from '../../types/vision.js';

describe('Decomposition Explainer', () => {
  describe('formatDecompositionForUser', () => {
    it('formats single RP correctly', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Simple Feature',
          description: 'Build a simple feature with one component. It should work well.',
          tier: 1,
          dependencies: [],
          rationale: 'Single unit',
          pbca_focus: [],
        },
      ];

      const result = formatDecompositionForUser(
        proposals,
        'This is a focused piece of work.',
        ['Simple Feature']
      );

      expect(result).toContain('single focused piece of work');
      expect(result).toContain('Simple Feature');
      expect(result).toContain('Tier 1');
    });

    it('formats multiple RPs with dependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Data Model',
          description: 'Database schema for users. Includes tables and indexes.',
          tier: 3,
          dependencies: [],
          rationale: 'Foundation',
          pbca_focus: [],
        },
        {
          title: 'API',
          description: 'REST API endpoints. Implements CRUD operations.',
          tier: 2,
          dependencies: [{ rpTitle: 'Data Model', reason: 'Uses schema' }],
          rationale: 'Interface',
          pbca_focus: [],
        },
      ];

      const result = formatDecompositionForUser(
        proposals,
        'Split into data and interface layers.',
        ['Data Model', 'API']
      );

      expect(result).toContain('2 parts');
      expect(result).toContain('Data Model');
      expect(result).toContain('API');
      expect(result).toContain('Tier 3');
      expect(result).toContain('Tier 2');
      expect(result).toContain('Depends on: Data Model');
      expect(result).toContain('Build order');
      expect(result).toContain('Data Model → API');
    });

    it('shows explanation at the end', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Feature',
          description: 'A feature.',
          tier: 1,
          dependencies: [],
          rationale: 'Simple',
          pbca_focus: [],
        },
      ];

      const explanation = 'This keeps things simple and focused.';
      
      const result = formatDecompositionForUser(
        proposals,
        explanation,
        ['Feature']
      );

      expect(result).toContain(explanation);
    });

    it('handles multiple dependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Auth',
          description: 'Authentication system.',
          tier: 3,
          dependencies: [
            { rpTitle: 'Data Model', reason: 'User table' },
            { rpTitle: 'API', reason: 'Auth endpoints' },
          ],
          rationale: 'Security',
          pbca_focus: [],
        },
      ];

      const result = formatDecompositionForUser(
        proposals,
        'Security layer depends on both data and API.',
        ['Data Model', 'API', 'Auth']
      );

      expect(result).toContain('Depends on: Data Model, API');
    });
  });

  describe('formatDecompositionSummary', () => {
    it('formats summary for logging', () => {
      const proposals: RPProposal[] = [
        {
          title: 'A',
          description: 'First',
          tier: 1,
          dependencies: [],
          rationale: 'Base',
          pbca_focus: [],
        },
        {
          title: 'B',
          description: 'Second',
          tier: 2,
          dependencies: [{ rpTitle: 'A', reason: 'Needs A' }],
          rationale: 'Builds on A',
          pbca_focus: [],
        },
      ];

      const result = formatDecompositionSummary(proposals);

      expect(result).toContain('2 RPs');
      expect(result).toContain('A [Tier 1]');
      expect(result).toContain('B [Tier 2]');
      expect(result).toContain('depends on: A');
    });

    it('handles RPs with no dependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Standalone',
          description: 'Independent',
          tier: 1,
          dependencies: [],
          rationale: 'Simple',
          pbca_focus: [],
        },
      ];

      const result = formatDecompositionSummary(proposals);

      expect(result).toContain('1 RPs');
      expect(result).toContain('Standalone [Tier 1]');
      expect(result).not.toContain('depends on');
    });
  });
});
