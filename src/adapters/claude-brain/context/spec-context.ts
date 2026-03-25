/**
 * Build SpecContextPack from job data
 */

import { SpecContextPack, ProjectCard, ReviewVerdict } from '../types.js';
import { Job, JobType } from '../../../core/types.js';
import { getPriorJobOutput } from './job-context.js';
import { supabase } from '../../../db/client.js';
import { loadContextPack } from '../../../prompts/persistContextPack.js';

export async function buildSpecContext(job: Job): Promise<SpecContextPack> {
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
  
  // 🔥 BUG FIX 1: Check for answered decisions
  const { data: answeredDecisions, error: decisionsError } = await supabase
    .from('decisions')
    .select('*')
    .eq('rp_id', job.rp_id)
    .eq('status', 'ANSWERED')
    .order('created_at', { ascending: true });
  
  if (decisionsError) {
    console.warn(`   ⚠️  Error fetching decisions: ${decisionsError.message}`);
  }
  
  const decisionsAnswered: { question: string; answer: string }[] = [];
  if (answeredDecisions && answeredDecisions.length > 0) {
    console.log(`   ✅ Found ${answeredDecisions.length} answered decision(s) for this RP`);
    for (const decision of answeredDecisions) {
      decisionsAnswered.push({
        question: decision.prompt,
        answer: JSON.stringify(decision.answer, null, 2),
      });
    }
  }
  
  // Try to get review output (may not exist for Tier 3 projects)
  const reviewOutput = await getPriorJobOutput(job.rp_id!, JobType.CLAUDE_REVIEW);
  
  // If no review output (e.g., Tier 3 skipped REVIEW step)
  if (!reviewOutput) {
    console.log(`   ℹ️  No CLAUDE_REVIEW output found (likely Tier 3 - skipped RESEARCH/REVIEW)`);
    console.log(`   📝 Building spec context directly from RP title and description`);
    
    // Build spec context without review - use RP description as the primary input
    return {
      projectCard,
      reviewOutput: `# User Request\n\n**Title:** ${rp.title}\n\n**Description:**\n${rp.description || 'No description provided.'}\n\n---\n\n*Note: This is a Tier ${project.tier} project. No research or review was performed.*`,
      reviewVerdict: 'PROCEED', // Default verdict when no review exists
      chosenApproach: undefined,
      acceptedConstraints: [],
      assumptionsAndTests: undefined,
      evidenceTopRows: undefined,
      decisionsAnswered,
    };
  }
  
  // Review output exists - extract review data
  let fullReviewOutput = '';
  if (reviewOutput.artifacts && reviewOutput.artifacts.length > 0) {
    fullReviewOutput = reviewOutput.artifacts[0].content;
  } else if (reviewOutput.text) {
    fullReviewOutput = reviewOutput.text;
  }
  
  let reviewVerdict: ReviewVerdict = 'PROCEED';
  if (reviewOutput.artifacts && reviewOutput.artifacts[0]?.metadata?.verdict) {
    reviewVerdict = reviewOutput.artifacts[0].metadata.verdict as ReviewVerdict;
  } else if (reviewOutput.verdict) {
    reviewVerdict = reviewOutput.verdict as ReviewVerdict;
  }
  
  // 🔥 BUG FIX 1: If review verdict was NEEDS_DECISION but we have answered decisions, override to PROCEED
  if (reviewVerdict === 'NEEDS_DECISION' && decisionsAnswered.length > 0) {
    console.log(`   🔄 Review verdict was NEEDS_DECISION, but ${decisionsAnswered.length} decision(s) have been answered`);
    console.log(`   ✅ Overriding verdict to PROCEED`);
    reviewVerdict = 'PROCEED';
    
    // Append a note to the review output
    fullReviewOutput += `\n\n---\n\n## ✅ Decisions Resolved\n\nThe review identified decisions that needed to be made. These have now been answered by the user:\n\n`;
    for (let i = 0; i < decisionsAnswered.length; i++) {
      fullReviewOutput += `### Decision ${i + 1}\n**Question:** ${decisionsAnswered[i].question}\n\n**Answer:** ${decisionsAnswered[i].answer}\n\n`;
    }
    fullReviewOutput += `\nYou should proceed with the spec, incorporating these answered decisions into your design.\n`;
  }
  
  // TODO: Extract these from PBCA or review output
  // For now, leave undefined - the prompts will work without them
  const chosenApproach = undefined;
  const acceptedConstraints: string[] = [];
  const assumptionsAndTests = undefined;
  const evidenceTopRows = undefined;
  
  // Inject Vision Document context if available
  let visionContext = '';
  if (job.project_id && job.rp_id) {
    const contextPack = await loadContextPack(job.project_id, job.rp_id, 'spec');
    if (contextPack) {
      visionContext = '\n\n---\n\n## Vision Document Context\n\n' + contextPack.renderedText;
    }
  }
  
  return {
    projectCard,
    reviewOutput: fullReviewOutput + visionContext,
    reviewVerdict,
    chosenApproach,
    acceptedConstraints,
    assumptionsAndTests,
    evidenceTopRows,
    decisionsAnswered,
  };
}
