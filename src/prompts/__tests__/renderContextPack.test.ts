/**
 * Tests for context pack renderer
 */

import { describe, it, expect } from 'vitest';
import { renderContextForPrompt } from '../renderContextPack.js';
import { ContextPack } from '../../types/vision.js';

describe('Context Pack Renderer', () => {
  it('renders all non-empty sections', () => {
    const pack: ContextPack = {
      project_id: 'proj-1',
      rp_id: 'rp-1',
      consumer: 'pbca',
      payload: {
        projectSummary: 'Build a dashboard',
        rpObjective: 'Create the frontend',
        relevantConstraints: ['Must use React', 'Must be responsive'],
        acceptanceCriteria: ['Dashboard loads quickly', 'Shows metrics'],
        assumptions: ['API is ready'],
        dependencies: ['Backend API'],
        nonGoals: ['Mobile app'],
        openQuestions: ['How to handle errors?'],
      },
    };

    const rendered = renderContextForPrompt(pack);

    expect(rendered).toContain('## Project Context');
    expect(rendered).toContain('Build a dashboard');
    expect(rendered).toContain('## This RP\'s Objective');
    expect(rendered).toContain('Create the frontend');
    expect(rendered).toContain('## Constraints');
    expect(rendered).toContain('- Must use React');
    expect(rendered).toContain('## Acceptance Criteria');
    expect(rendered).toContain('1. Dashboard loads quickly');
    expect(rendered).toContain('## Assumptions');
    expect(rendered).toContain('- API is ready');
    expect(rendered).toContain('## Dependencies');
    expect(rendered).toContain('- Backend API');
    expect(rendered).toContain('## Out of Scope');
    expect(rendered).toContain('- Mobile app');
    expect(rendered).toContain('## Open Questions');
    expect(rendered).toContain('- How to handle errors?');
  });

  it('skips empty sections', () => {
    const pack: ContextPack = {
      project_id: 'proj-1',
      rp_id: 'rp-1',
      consumer: 'build',
      payload: {
        projectSummary: 'Build a dashboard',
        rpObjective: 'Create the frontend',
        relevantConstraints: ['Must use React'],
        acceptanceCriteria: ['Must work'],
        assumptions: [], // Empty
        dependencies: [], // Empty
        nonGoals: [], // Empty
        openQuestions: [], // Empty
      },
    };

    const rendered = renderContextForPrompt(pack);

    expect(rendered).toContain('## Constraints');
    expect(rendered).toContain('## Acceptance Criteria');
    expect(rendered).not.toContain('## Assumptions');
    expect(rendered).not.toContain('## Dependencies');
    expect(rendered).not.toContain('## Out of Scope');
    expect(rendered).not.toContain('## Open Questions');
  });

  it('uses special label for review assumptions', () => {
    const reviewPack: ContextPack = {
      project_id: 'proj-1',
      rp_id: 'rp-1',
      consumer: 'review',
      payload: {
        projectSummary: 'Build a dashboard',
        rpObjective: 'Create the frontend',
        relevantConstraints: [],
        acceptanceCriteria: [],
        assumptions: ['API is stable'],
        dependencies: [],
        nonGoals: [],
        openQuestions: [],
      },
    };

    const rendered = renderContextForPrompt(reviewPack);

    expect(rendered).toContain('## Assumptions (verify or challenge these)');
    expect(rendered).toContain('- API is stable');
  });

  it('numbers acceptance criteria', () => {
    const pack: ContextPack = {
      project_id: 'proj-1',
      rp_id: 'rp-1',
      consumer: 'spec',
      payload: {
        projectSummary: 'Build a dashboard',
        rpObjective: 'Create the frontend',
        relevantConstraints: [],
        acceptanceCriteria: ['Must load fast', 'Must be accessible', 'Must work offline'],
        assumptions: [],
        dependencies: [],
        nonGoals: [],
        openQuestions: [],
      },
    };

    const rendered = renderContextForPrompt(pack);

    expect(rendered).toContain('1. Must load fast');
    expect(rendered).toContain('2. Must be accessible');
    expect(rendered).toContain('3. Must work offline');
  });

  it('renders compact format suitable for prompts', () => {
    const pack: ContextPack = {
      project_id: 'proj-1',
      rp_id: 'rp-1',
      consumer: 'pbca',
      payload: {
        projectSummary: 'Build a dashboard',
        rpObjective: 'Create the frontend',
        relevantConstraints: ['React'],
        acceptanceCriteria: ['Must work'],
        assumptions: [],
        dependencies: [],
        nonGoals: [],
        openQuestions: [],
      },
    };

    const rendered = renderContextForPrompt(pack);

    // Should be reasonably compact (not overly verbose)
    const lineCount = rendered.split('\n').length;
    expect(lineCount).toBeLessThan(20);

    // Should have proper spacing
    expect(rendered).toContain('\n\n');
  });
});
