import { supabase } from '../lib/supabase.js';

const STAGE_ORDER = ['research', 'review', 'spec', 'build', 'test', 'ship'];

export async function getAllProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getProjectById(id) {
  const [projectResult, historyResult] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('stage_transitions')
      .select('*')
      .eq('project_id', id)
      .order('entered_at', { ascending: true }),
  ]);

  if (projectResult.error) throw projectResult.error;
  if (historyResult.error) throw historyResult.error;

  return {
    ...projectResult.data,
    stage_history: historyResult.data,
  };
}

export async function createProject(name) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({ name, current_stage: 'research' })
    .select()
    .single();

  if (projectError) throw projectError;

  const { error: transitionError } = await supabase
    .from('stage_transitions')
    .insert({ project_id: project.id, stage: 'research', entered_at: project.created_at });

  if (transitionError) throw transitionError;

  return project;
}

export async function updateProjectStage(id, nextStage) {
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('current_stage')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const currentIdx = STAGE_ORDER.indexOf(project.current_stage);
  const nextIdx = STAGE_ORDER.indexOf(nextStage);

  if (nextIdx !== currentIdx + 1) {
    const err = new Error(
      `Invalid stage transition from ${project.current_stage} to ${nextStage}. Stages must advance sequentially.`
    );
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();

  // Close current stage transition
  await supabase
    .from('stage_transitions')
    .update({ exited_at: now })
    .eq('project_id', id)
    .eq('stage', project.current_stage)
    .is('exited_at', null);

  // Advance project stage
  const { data: updated, error: updateError } = await supabase
    .from('projects')
    .update({ current_stage: nextStage })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Open new stage transition
  await supabase
    .from('stage_transitions')
    .insert({ project_id: id, stage: nextStage, entered_at: now });

  return updated;
}

export async function getStageHistory(projectId) {
  const { data, error } = await supabase
    .from('stage_transitions')
    .select('*')
    .eq('project_id', projectId)
    .order('entered_at', { ascending: true });

  if (error) throw error;
  return data;
}
