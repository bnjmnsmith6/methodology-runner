/**
 * Job scheduler
 * 
 * Enqueues jobs based on reducer output.
 */

import { supabase, extractSupabaseError } from '../db/client.js';
import { JobDraft, JobStatus, JobType } from './types.js';
import { getPriorJobOutput } from '../adapters/claude-brain/context/job-context.js';

/**
 * Enqueue a single job
 */
export async function enqueueJob(draft: JobDraft): Promise<void> {
  // Handle context enrichment before enqueuing
  const enrichedInput = await enrichJobInput(draft);
  
  const now = new Date().toISOString();
  const runAfter = draft.run_after ? draft.run_after.toISOString() : now;
  
  const { error } = await supabase
    .from('jobs')
    .insert({
      project_id: draft.project_id,
      rp_id: draft.rp_id || null,
      type: draft.type,
      status: JobStatus.QUEUED,
      priority: draft.priority || 100,
      run_after: runAfter,
      max_attempts: draft.max_attempts || 5,
      input: enrichedInput,
    });
  
  if (error) {
    throw new Error(`Failed to enqueue job: ${extractSupabaseError(error)}`);
  }
  
  console.log(`  📤 Enqueued job: ${draft.type} for RP ${draft.rp_id || 'none'}`);
}

/**
 * Enqueue multiple jobs in a batch
 */
export async function enqueueJobs(drafts: JobDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  
  const now = new Date().toISOString();
  
  // Enrich job inputs before inserting
  const jobs = await Promise.all(drafts.map(async (draft) => {
    const enrichedInput = await enrichJobInput(draft);
    
    return {
      project_id: draft.project_id,
      rp_id: draft.rp_id || null,
      type: draft.type,
      status: JobStatus.QUEUED,
      priority: draft.priority || 100,
      run_after: draft.run_after ? draft.run_after.toISOString() : now,
      max_attempts: draft.max_attempts || 5,
      input: enrichedInput,
    };
  }));
  
  const { error } = await supabase
    .from('jobs')
    .insert(jobs);
  
  if (error) {
    throw new Error(`Failed to enqueue jobs: ${extractSupabaseError(error)}`);
  }
  
  console.log(`  📤 Enqueued ${drafts.length} job(s)`);
}

/**
 * Enrich job input with context from prior jobs
 * 
 * For BUILD jobs: fetch constellation packet from CLAUDE_SPEC
 * For FIX jobs: fetch constellation packet + debug instructions
 */
async function enrichJobInput(draft: JobDraft): Promise<Record<string, any>> {
  const input = draft.input || {};
  
  // BUILD jobs need constellation packet from CLAUDE_SPEC
  if (draft.type === JobType.CODEPUPPY_BUILD && draft.rp_id) {
    const specOutput = await getPriorJobOutput(draft.rp_id, JobType.CLAUDE_SPEC);
    
    if (specOutput) {
      // Extract constellation packet from spec output
      let constellationPacket = '';
      if (specOutput.artifacts && specOutput.artifacts.length > 0) {
        constellationPacket = specOutput.artifacts[0].content;
      } else if (specOutput.text) {
        constellationPacket = specOutput.text;
      }
      
      return {
        ...input,
        constellation_packet: constellationPacket
      };
    } else {
      console.warn(`   ⚠️  No CLAUDE_SPEC output found for RP ${draft.rp_id} - BUILD will fail`);
    }
  }
  
  // FIX jobs need constellation packet + debug instructions
  if (draft.type === JobType.CODEPUPPY_FIX && draft.rp_id) {
    // Get original spec
    const specOutput = await getPriorJobOutput(draft.rp_id, JobType.CLAUDE_SPEC);
    
    // Get debug instructions
    const debugOutput = await getPriorJobOutput(draft.rp_id, JobType.CLAUDE_DEBUG);
    
    let constellationPacket = '';
    if (specOutput) {
      if (specOutput.artifacts && specOutput.artifacts.length > 0) {
        constellationPacket = specOutput.artifacts[0].content;
      } else if (specOutput.text) {
        constellationPacket = specOutput.text;
      }
    }
    
    let fixInstructions = '';
    if (debugOutput) {
      if (debugOutput.artifacts && debugOutput.artifacts.length > 0) {
        fixInstructions = debugOutput.artifacts[0].content;
      } else if (debugOutput.text) {
        fixInstructions = debugOutput.text;
      }
    }
    
    // Get session ID from prior build for continuation
    const priorBuildOutput = await getPriorJobOutput(draft.rp_id, JobType.CODEPUPPY_BUILD);
    const sessionId = priorBuildOutput?.metadata?.sessionId || priorBuildOutput?.session_id;
    
    return {
      ...input,
      constellation_packet: constellationPacket,
      fix_instructions: fixInstructions,
      session_id: sessionId
    };
  }
  
  return input;
}
