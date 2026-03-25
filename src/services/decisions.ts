/**
 * Decision management service
 * 
 * Functions for creating, answering, and listing decisions.
 */

import { supabase, extractSupabaseError } from '../db/client.js';
import { Decision, DecisionDraft, DecisionStatus, StepStatus } from '../core/types.js';
import { updateRpState, updateProjectState, getRp } from './projects.js';
import { RpState, ProjectState, DecisionScope } from '../core/types.js';

/**
 * Create a new decision
 * 
 * Also sets the associated RP/Project to WAITING_DECISION state.
 */
export async function createDecision(draft: DecisionDraft): Promise<Decision> {
  // Insert the decision
  const { data, error } = await supabase
    .from('decisions')
    .insert({
      project_id: draft.project_id,
      rp_id: draft.rp_id || null,
      status: DecisionStatus.PENDING,
      scope: draft.scope,
      priority: draft.priority || 100,
      title: draft.title,
      prompt: draft.prompt,
      options: draft.options,
      context: draft.context || {},
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create decision: ${extractSupabaseError(error)}`);
  }
  
  // Update RP or Project state to WAITING_DECISION
  if (draft.scope === DecisionScope.RP && draft.rp_id) {
    await updateRpState(draft.rp_id, { state: RpState.WAITING_DECISION });
  } else if (draft.scope === DecisionScope.PROJECT) {
    await updateProjectState(draft.project_id, ProjectState.WAITING_DECISION);
  }
  
  return data as Decision;
}

/**
 * Answer a pending decision
 * 
 * 🔥 BUG FIX 3 (PROPER): Interprets the decision context and answer to take appropriate action.
 * 
 * For step failure decisions:
 * - Choice 0 ("Retry the step") → Reset step_status to NOT_STARTED
 * - Choice 1 ("Skip this step") → Advance to next step
 * - Choice 2 ("Cancel the RP") → Set state to CANCELLED
 * 
 * For NEEDS_DECISION decisions from CLAUDE_REVIEW:
 * - Advance to next step (SPEC) with NOT_STARTED
 */
export async function answerDecision(id: string, answer: Record<string, any>): Promise<Decision> {
  const now = new Date().toISOString();
  
  // First, get the decision to know what to unblock
  const { data: decision, error: getError } = await supabase
    .from('decisions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (getError) {
    throw new Error(`Failed to get decision: ${extractSupabaseError(getError)}`);
  }
  
  if (!decision) {
    throw new Error(`Decision ${id} not found`);
  }
  
  if (decision.status !== DecisionStatus.PENDING) {
    throw new Error(`Decision ${id} is not pending (status: ${decision.status})`);
  }
  
  // Update the decision
  const { data: updatedDecision, error: updateError } = await supabase
    .from('decisions')
    .update({
      status: DecisionStatus.ANSWERED,
      answer,
      answered_at: now,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (updateError) {
    throw new Error(`Failed to answer decision: ${extractSupabaseError(updateError)}`);
  }
  
  // 🔥 BUG FIX 3 (PROPER): Interpret the decision and take appropriate action
  if (decision.scope === 'RP' && decision.rp_id) {
    const rp = await getRp(decision.rp_id);
    const choice = answer.choice !== undefined ? answer.choice : 0;
    
    // Check if this is a step failure decision (from reducer's ERROR handling)
    const isStepFailureDecision = decision.title.includes('failed') && decision.context?.step;
    
    if (isStepFailureDecision) {
      const failedStep = decision.context.step;
      
      console.log(`   🔄 Decision answered for step ${failedStep} failure with choice ${choice}`);
      
      if (choice === 0) {
        // Retry the step
        console.log(`   ♻️  Retrying step ${failedStep}`);
        await updateRpState(decision.rp_id, {
          state: RpState.READY,
          step_status: StepStatus.NOT_STARTED,
          // Keep the same step number
        });
      } else if (choice === 1) {
        // Skip this step
        console.log(`   ⏭️  Skipping step ${failedStep}, advancing to step ${failedStep + 1}`);
        await updateRpState(decision.rp_id, {
          state: RpState.READY,
          step: failedStep + 1,
          step_status: StepStatus.NOT_STARTED,
        });
      } else if (choice === 2) {
        // Cancel the RP
        console.log(`   ❌ Cancelling RP`);
        await updateRpState(decision.rp_id, {
          state: RpState.CANCELED,
        });
      }
    } else {
      // For other decisions (like NEEDS_DECISION from CLAUDE_REVIEW), advance to next step
      console.log(`   🔄 Decision answered - advancing RP from step ${rp.step} to step ${rp.step + 1}`);
      await updateRpState(decision.rp_id, {
        state: RpState.READY,
        step: rp.step + 1,
        step_status: StepStatus.NOT_STARTED,
      });
    }
  } else if (decision.scope === 'PROJECT') {
    await updateProjectState(decision.project_id, ProjectState.ACTIVE);
  }
  
  return updatedDecision as Decision;
}

/**
 * Get all pending decisions
 */
export async function getPendingDecisions(): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('status', DecisionStatus.PENDING)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to get pending decisions: ${extractSupabaseError(error)}`);
  }
  
  return (data || []) as Decision[];
}

/**
 * Get all decisions for a project
 */
export async function getDecisionsForProject(projectId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get decisions for project: ${extractSupabaseError(error)}`);
  }
  
  return (data || []) as Decision[];
}

/**
 * Get all decisions for an RP
 */
export async function getDecisionsForRp(rpId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get decisions for RP: ${extractSupabaseError(error)}`);
  }
  
  return (data || []) as Decision[];
}
