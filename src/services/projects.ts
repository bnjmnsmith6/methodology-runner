/**
 * Project and RP management service
 * 
 * Functions for creating projects/RPs and reading their status.
 */

import { supabase, extractSupabaseError } from '../db/client.js';
import { Project, Rp, ProjectDraft, RpDraft, ProjectState, RpState, StepStatus, Step } from '../core/types.js';

/**
 * Create a new project
 */
export async function createProject(draft: ProjectDraft): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: draft.name,
      description: draft.description || null,
      tier: draft.tier,
      state: draft.state || ProjectState.DRAFT,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create project: ${extractSupabaseError(error)}`);
  }
  
  return data as Project;
}

/**
 * Create a new RP (Research Project)
 * 
 * Steps 1 (VISION) and 2 (DECOMPOSE) are conceptually done when Ben creates
 * the RP via chat - the description IS the vision, the title IS the decomposition.
 * 
 * So we start RPs at the first automated step:
 * - Tier 1/2: Step 3 (RESEARCH)
 * - Tier 3: Step 5 (SPEC) - skips research/review
 */
export async function createRp(draft: RpDraft): Promise<Rp> {
  // Get project to determine tier
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('tier')
    .eq('id', draft.project_id)
    .single();
  
  if (projectError) {
    throw new Error(`Failed to get project tier: ${extractSupabaseError(projectError)}`);
  }
  
  // Determine effective tier
  const effectiveTier = draft.tier_override ?? project.tier;
  
  // Determine starting step based on tier
  // Tier 1/2: Start at step 3 (RESEARCH)
  // Tier 3: Start at step 5 (SPEC) - skip research and review
  const initialStep = effectiveTier === 3 ? Step.SPEC : Step.RESEARCH;
  
  const { data, error } = await supabase
    .from('rps')
    .insert({
      project_id: draft.project_id,
      title: draft.title,
      description: draft.description || null,
      tier_override: draft.tier_override || null,
      priority: draft.priority || 100,
      step: initialStep,
      step_status: StepStatus.NOT_STARTED,
      state: RpState.READY,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create RP: ${extractSupabaseError(error)}`);
  }
  
  return data as Rp;
}

/**
 * Get full project status with all RPs
 */
export async function getProjectStatus(projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (projectError) {
    throw new Error(`Failed to get project: ${extractSupabaseError(projectError)}`);
  }
  
  const { data: rps, error: rpsError } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', projectId)
    .order('priority', { ascending: true });
  
  if (rpsError) {
    throw new Error(`Failed to get RPs: ${extractSupabaseError(rpsError)}`);
  }
  
  return {
    project: project as Project,
    rps: (rps || []) as Rp[],
  };
}

/**
 * Get all projects
 */
export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get projects: ${extractSupabaseError(error)}`);
  }
  
  return (data || []) as Project[];
}

/**
 * Get all RPs for a project
 */
export async function getRpsForProject(projectId: string): Promise<Rp[]> {
  const { data, error } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', projectId)
    .order('priority', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to get RPs: ${extractSupabaseError(error)}`);
  }
  
  return (data || []) as Rp[];
}

/**
 * Get a single RP by ID
 */
export async function getRp(rpId: string): Promise<Rp> {
  const { data, error } = await supabase
    .from('rps')
    .select('*')
    .eq('id', rpId)
    .single();
  
  if (error) {
    throw new Error(`Failed to get RP: ${extractSupabaseError(error)}`);
  }
  
  return data as Rp;
}

/**
 * Update RP state
 */
export async function updateRpState(
  rpId: string,
  updates: {
    state?: RpState;
    step?: number;
    step_status?: StepStatus;
    debug_cycle_count?: number;
    last_error?: string | null;
  }
): Promise<Rp> {
  const { data, error } = await supabase
    .from('rps')
    .update(updates)
    .eq('id', rpId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update RP state: ${extractSupabaseError(error)}`);
  }
  
  return data as Rp;
}

/**
 * Update project state
 */
export async function updateProjectState(
  projectId: string,
  state: ProjectState
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ state })
    .eq('id', projectId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update project state: ${extractSupabaseError(error)}`);
  }
  
  return data as Project;
}
