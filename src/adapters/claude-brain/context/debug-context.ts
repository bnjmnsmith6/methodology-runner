/**
 * Build DebugContextPack from job data
 */

import { DebugContextPack, ProjectCard } from '../types.js';
import { Job, JobType, JobStatus } from '../../../core/types.js';
import { getPriorJobOutput, getAllJobsForRp } from './job-context.js';
import { supabase } from '../../../db/client.js';

export async function buildDebugContext(job: Job): Promise<DebugContextPack> {
  // Get spec output
  const specOutput = await getPriorJobOutput(job.rp_id!, JobType.CLAUDE_SPEC);
  
  if (!specOutput) {
    throw new Error(`No CLAUDE_SPEC output found for RP ${job.rp_id}`);
  }
  
  // Get RP and project data
  const { data: rp, error: rpError } = await supabase
    .from('rps')
    .select('*')
    .eq('id', job.rp_id)
    .single();
  
  if (rpError || !rp) {
    throw new Error(`Failed to load RP ${job.rp_id}`);
  }
  
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', rp.project_id)
    .single();
  
  if (projectError || !project) {
    throw new Error(`Failed to load project ${rp.project_id}`);
  }
  
  // Build project card
  const projectCard: ProjectCard = {
    rpId: rp.id,
    rpTitle: rp.title,
    rpDescription: rp.description || undefined,
    projectName: project.name,
    projectTier: project.tier,
  };
  
  // Get spec slice (full spec for now - could be trimmed later)
  let specSlice = "";
  if (specOutput.artifacts && specOutput.artifacts.length > 0) {
    specSlice = specOutput.artifacts[0].content;
  } else {
    specSlice = specOutput.text || specOutput.constellationPacket || specOutput.rawResponse || "";
  }
  
  // Get error logs from job input (passed by reducer when creating debug job)
  const errorLogs = job.input?.error_log || job.input?.errorLogs || 'No error logs provided';
  
  // Get recent debug attempt history
  const allJobs = await getAllJobsForRp(job.rp_id!);
  const priorDebugAttempts = allJobs.filter(j => 
    j.type === JobType.CLAUDE_DEBUG && 
    j.created_at < job.created_at
  );
  
  const recentAttempts = priorDebugAttempts.slice(-2); // last 2 attempts
  const recentAttemptHistory = recentAttempts.length > 0
    ? recentAttempts.map((attempt, i) => {
        const output = attempt.output || {};
        return `**Attempt ${i + 1} (${attempt.status}):**\n${output.text || output.rawResponse || 'No output'}`;
      }).join('\n\n')
    : 'No prior debug attempts';
  
  const attemptNumber = priorDebugAttempts.length + 1;
  
  // Changed files from job input if available
  const changedFiles = job.input?.changed_files || job.input?.changedFiles;
  
  return {
    projectCard,
    specSlice,
    errorLogs,
    recentAttemptHistory,
    changedFiles,
    attemptNumber,
  };
}
