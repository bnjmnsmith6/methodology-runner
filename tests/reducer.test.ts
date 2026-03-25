/**
 * Unit tests for the reducer state machine
 */

import { describe, it, expect } from 'vitest';
import { next } from '../src/core/reducer.js';
import { Project, Rp, Step, StepStatus, RpState, ProjectState } from '../src/core/types.js';

// Helper to create test project
function createTestProject(tier: 1 | 2 | 3): Project {
  return {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'A test project',
    tier,
    state: ProjectState.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Helper to create test RP
function createTestRp(overrides?: Partial<Rp>): Rp {
  return {
    id: 'test-rp-id',
    project_id: 'test-project-id',
    title: 'Test RP',
    description: 'A test RP',
    step: 1,
    step_status: StepStatus.NOT_STARTED,
    state: RpState.READY,
    tier_override: null,
    priority: 100,
    debug_cycle_count: 0,
    max_debug_cycles: 8,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('Reducer - Normal Step Advancement', () => {
  it('should advance to next step when current step is DONE', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ step: 3, step_status: StepStatus.DONE });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step).toBe(4);
    expect(action.setRpState?.step_status).toBe(StepStatus.NOT_STARTED);
  });
  
  it('should complete RP when step 10 (SHIP) is DONE', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ step: 10, step_status: StepStatus.DONE });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.state).toBe(RpState.COMPLETED);
  });
});

describe('Reducer - Tier-Based Skipping', () => {
  it('should skip research and review for Tier 3 projects', () => {
    const project = createTestProject(3);
    const rp = createTestRp({ step: 2, step_status: StepStatus.DONE });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step).toBe(5); // Skip to SPEC
    expect(action.setRpState?.step_status).toBe(StepStatus.NOT_STARTED);
  });
  
  it('should NOT skip research for Tier 1 projects', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ step: 2, step_status: StepStatus.DONE });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step).toBe(3); // Advance to RESEARCH normally
  });
  
  it('should mark Tier 3 research step as SKIPPED when starting it', () => {
    const project = createTestProject(3);
    const rp = createTestRp({ step: 3, step_status: StepStatus.NOT_STARTED });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step_status).toBe(StepStatus.SKIPPED);
  });
});

describe('Reducer - Debug Loop', () => {
  it('should enter debug loop when TEST (step 8) has ERROR status', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ 
      step: 8, 
      step_status: StepStatus.ERROR,
      debug_cycle_count: 2,
      max_debug_cycles: 8,
    });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step).toBe(9); // Go to DEBUG
    expect(action.setRpState?.step_status).toBe(StepStatus.NOT_STARTED);
    expect(action.setRpState?.incrementDebugCycle).toBe(true);
  });
  
  it('should loop back to TEST after DEBUG is DONE', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ step: 9, step_status: StepStatus.DONE });
    
    const action = next(rp, project);
    
    expect(action.setRpState).toBeDefined();
    expect(action.setRpState?.step).toBe(8); // Loop back to TEST
    expect(action.setRpState?.step_status).toBe(StepStatus.NOT_STARTED);
  });
});

describe('Reducer - Debug Escalation', () => {
  it('should create decision when max debug cycles exceeded', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ 
      step: 8, 
      step_status: StepStatus.ERROR,
      debug_cycle_count: 8,
      max_debug_cycles: 8,
      last_error: 'Test failed repeatedly',
    });
    
    const action = next(rp, project);
    
    expect(action.createDecision).toBeDefined();
    expect(action.createDecision?.title).toContain('max debug cycles');
    expect(action.setRpState?.state).toBe(RpState.WAITING_DECISION);
  });
});

describe('Reducer - Decision Blocking', () => {
  it('should do nothing when RP is WAITING_DECISION', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ state: RpState.WAITING_DECISION });
    
    const action = next(rp, project);
    
    expect(action).toEqual({});
  });
  
  it('should do nothing when RP is COMPLETED', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ state: RpState.COMPLETED });
    
    const action = next(rp, project);
    
    expect(action).toEqual({});
  });
});

describe('Reducer - Job Enqueueing', () => {
  it('should enqueue job when step is NOT_STARTED', () => {
    const project = createTestProject(1);
    const rp = createTestRp({ step: 3, step_status: StepStatus.NOT_STARTED });
    
    const action = next(rp, project);
    
    expect(action.enqueueJobs).toBeDefined();
    expect(action.enqueueJobs?.length).toBeGreaterThan(0);
    expect(action.enqueueJobs?.[0].type).toBe('PBCA_RESEARCH');
    expect(action.setRpState?.step_status).toBe(StepStatus.IN_PROGRESS);
  });
  
  it('should include abbreviated flag for Tier 2 research', () => {
    const project = createTestProject(2);
    const rp = createTestRp({ step: 3, step_status: StepStatus.NOT_STARTED });
    
    const action = next(rp, project);
    
    expect(action.enqueueJobs).toBeDefined();
    expect(action.enqueueJobs?.[0].input.abbreviated).toBe(true);
  });
});
