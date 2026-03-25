/**
 * Tests for dependency graph validation
 */

import { describe, it, expect } from 'vitest';
import { validateDependencyGraph, getBuildOrder } from '../detectDependencies.js';
import { RPProposal } from '../../types/vision.js';

describe('Dependency Validator', () => {
  describe('validateDependencyGraph', () => {
    it('validates a valid linear dependency chain', () => {
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
          tier: 1,
          dependencies: [{ rpTitle: 'A', reason: 'Needs A' }],
          rationale: 'Builds on A',
          pbca_focus: [],
        },
        {
          title: 'C',
          description: 'Third',
          tier: 1,
          dependencies: [{ rpTitle: 'B', reason: 'Needs B' }],
          rationale: 'Builds on B',
          pbca_focus: [],
        },
      ];

      const result = validateDependencyGraph(proposals);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid reference', () => {
      const proposals: RPProposal[] = [
        {
          title: 'A',
          description: 'First',
          tier: 1,
          dependencies: [{ rpTitle: 'NonExistent', reason: 'Needs it' }],
          rationale: 'Base',
          pbca_focus: [],
        },
      ];

      const result = validateDependencyGraph(proposals);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('NonExistent');
    });

    it('detects cycles in dependency graph', () => {
      const proposals: RPProposal[] = [
        {
          title: 'A',
          description: 'First',
          tier: 1,
          dependencies: [{ rpTitle: 'B', reason: 'Needs B' }],
          rationale: 'Base',
          pbca_focus: [],
        },
        {
          title: 'B',
          description: 'Second',
          tier: 1,
          dependencies: [{ rpTitle: 'A', reason: 'Needs A' }],
          rationale: 'Circular',
          pbca_focus: [],
        },
      ];

      const result = validateDependencyGraph(proposals);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Dependency graph contains a cycle');
    });

    it('validates complex DAG with multiple dependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Data Model',
          description: 'Database schema',
          tier: 3,
          dependencies: [],
          rationale: 'Foundation',
          pbca_focus: [],
        },
        {
          title: 'API',
          description: 'REST API',
          tier: 2,
          dependencies: [{ rpTitle: 'Data Model', reason: 'Uses schema' }],
          rationale: 'Interface',
          pbca_focus: [],
        },
        {
          title: 'UI',
          description: 'Frontend',
          tier: 2,
          dependencies: [{ rpTitle: 'API', reason: 'Calls API' }],
          rationale: 'Presentation',
          pbca_focus: [],
        },
        {
          title: 'Auth',
          description: 'Authentication',
          tier: 3,
          dependencies: [
            { rpTitle: 'Data Model', reason: 'User table' },
            { rpTitle: 'API', reason: 'Auth endpoints' },
          ],
          rationale: 'Security',
          pbca_focus: [],
        },
      ];

      const result = validateDependencyGraph(proposals);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getBuildOrder', () => {
    it('returns correct order for linear chain', () => {
      const proposals: RPProposal[] = [
        {
          title: 'C',
          description: 'Third',
          tier: 1,
          dependencies: [{ rpTitle: 'B', reason: 'Needs B' }],
          rationale: 'Last',
          pbca_focus: [],
        },
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
          tier: 1,
          dependencies: [{ rpTitle: 'A', reason: 'Needs A' }],
          rationale: 'Middle',
          pbca_focus: [],
        },
      ];

      const order = getBuildOrder(proposals);

      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('returns valid order for DAG with multiple roots', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Utils',
          description: 'Utilities',
          tier: 1,
          dependencies: [],
          rationale: 'Helpers',
          pbca_focus: [],
        },
        {
          title: 'Data',
          description: 'Data layer',
          tier: 2,
          dependencies: [],
          rationale: 'Foundation',
          pbca_focus: [],
        },
        {
          title: 'API',
          description: 'API',
          tier: 2,
          dependencies: [
            { rpTitle: 'Data', reason: 'Uses data' },
            { rpTitle: 'Utils', reason: 'Uses utils' },
          ],
          rationale: 'Interface',
          pbca_focus: [],
        },
      ];

      const order = getBuildOrder(proposals);

      // Both Utils and Data should come before API
      const utilsIndex = order.indexOf('Utils');
      const dataIndex = order.indexOf('Data');
      const apiIndex = order.indexOf('API');

      expect(utilsIndex).toBeLessThan(apiIndex);
      expect(dataIndex).toBeLessThan(apiIndex);
    });

    it('handles single RP with no dependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Simple Task',
          description: 'One task',
          tier: 1,
          dependencies: [],
          rationale: 'Single',
          pbca_focus: [],
        },
      ];

      const order = getBuildOrder(proposals);

      expect(order).toEqual(['Simple Task']);
    });

    it('handles parallel RPs with no interdependencies', () => {
      const proposals: RPProposal[] = [
        {
          title: 'Task A',
          description: 'Independent A',
          tier: 1,
          dependencies: [],
          rationale: 'Standalone',
          pbca_focus: [],
        },
        {
          title: 'Task B',
          description: 'Independent B',
          tier: 1,
          dependencies: [],
          rationale: 'Standalone',
          pbca_focus: [],
        },
        {
          title: 'Task C',
          description: 'Independent C',
          tier: 1,
          dependencies: [],
          rationale: 'Standalone',
          pbca_focus: [],
        },
      ];

      const order = getBuildOrder(proposals);

      // All three should be in the order, exact sequence doesn't matter
      expect(order).toHaveLength(3);
      expect(order).toContain('Task A');
      expect(order).toContain('Task B');
      expect(order).toContain('Task C');
    });
  });
});
