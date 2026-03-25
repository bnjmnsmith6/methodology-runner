/**
 * Build ReviewContextPack from job data
 */

import { ReviewContextPack, ProjectCard } from '../types.js';
import { Job, JobType } from '../../../core/types.js';
import { getPriorJobOutput } from './job-context.js';
import { supabase } from '../../../db/client.js';

export async function buildReviewContext(job: Job): Promise<ReviewContextPack> {
  // Get PBCA output
  const pbcaOutput = await getPriorJobOutput(job.rp_id!, JobType.PBCA_RESEARCH);
  
  if (!pbcaOutput) {
    throw new Error(`No PBCA_RESEARCH output found for RP ${job.rp_id}`);
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
  
  // Try to extract parsed PBCA slices from output
  const pbcaSlices: ReviewContextPack['pbcaSlices'] = {};
  
  if (pbcaOutput.artifacts && Array.isArray(pbcaOutput.artifacts)) {
    // PBCA output with artifacts array
    for (const artifact of pbcaOutput.artifacts) {
      const fileName = (artifact.name || '').toLowerCase();
      
      if (fileName.includes('problem-framing')) {
        pbcaSlices.problemFraming = artifact.content;
      } else if (fileName.includes('discovery-brief')) {
        pbcaSlices.discoveryBrief = artifact.content;
      } else if (fileName.includes('evidence-ledger')) {
        pbcaSlices.evidenceLedger = artifact.content;
      } else if (fileName.includes('options-matrix')) {
        pbcaSlices.optionsMatrix = artifact.content;
      } else if (fileName.includes('plan')) {
        pbcaSlices.plan = artifact.content;
      } else if (fileName.includes('red-team')) {
        pbcaSlices.redTeam = artifact.content;
      } else if (fileName.includes('simulation')) {
        pbcaSlices.simulation = artifact.content;
      } else if (fileName.includes('assumptions')) {
        pbcaSlices.assumptions = artifact.content;
      }
    }
  }
  
  // Fallback to raw output
  let rawPbcaOutput = '';
  if (pbcaOutput.artifacts) {
    rawPbcaOutput = pbcaOutput.artifacts.map((a: any) => `# ${a.name}\n\n${a.content}`).join('\n\n');
  } else {
    rawPbcaOutput = JSON.stringify(pbcaOutput);
  }
  
  return {
    projectCard,
    pbcaSlices,
    rawPbcaOutput,
  };
}
