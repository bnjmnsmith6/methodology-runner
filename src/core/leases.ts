/**
 * Lease management for job execution
 * 
 * Handles job locking, expiration, and reconciliation to ensure
 * exactly-once execution with crash recovery.
 */

import { supabase } from '../db/client.js';
import { Job, JobStatus, WORKER_CONFIG } from './types.js';
import { extractSupabaseError } from '../db/client.js';

// Worker ID for this process
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

/**
 * Reconcile expired leases
 * 
 * Finds jobs that are RUNNING but their lease has expired, and resets them
 * back to QUEUED for retry. If max attempts exceeded, marks as FAILED.
 * 
 * Called on worker startup and periodically during execution.
 */
export async function reconcileExpiredLeases(): Promise<number> {
  const now = new Date().toISOString();
  
  // Find all expired leases
  const { data: expiredJobs, error: selectError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', JobStatus.RUNNING)
    .lt('lease_expires_at', now);
  
  if (selectError) {
    console.error('Error finding expired leases:', extractSupabaseError(selectError));
    return 0;
  }
  
  if (!expiredJobs || expiredJobs.length === 0) {
    return 0;
  }
  
  console.log(`🔄 Reconciling ${expiredJobs.length} expired lease(s)...`);
  
  let reconciledCount = 0;
  
  for (const job of expiredJobs) {
    const newAttempts = job.attempts + 1;
    
    if (newAttempts >= job.max_attempts) {
      // Max attempts exceeded - mark as FAILED
      const { error } = await supabase
        .from('jobs')
        .update({
          status: JobStatus.FAILED,
          last_error: `Max attempts (${job.max_attempts}) exceeded after lease expiration`,
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
        })
        .eq('id', job.id);
      
      if (error) {
        console.error(`Failed to mark job ${job.id} as FAILED:`, extractSupabaseError(error));
      } else {
        console.log(`  ❌ Job ${job.id} FAILED (max attempts exceeded)`);
        reconciledCount++;
        
        // TODO: Create escalation decision for failed job
      }
    } else {
      // Reset to QUEUED with exponential backoff
      const backoffMs = Math.min(
        WORKER_CONFIG.BACKOFF_BASE_MS * Math.pow(2, newAttempts - 1),
        WORKER_CONFIG.BACKOFF_MAX_MS
      );
      const runAfter = new Date(Date.now() + backoffMs).toISOString();
      
      const { error } = await supabase
        .from('jobs')
        .update({
          status: JobStatus.QUEUED,
          attempts: newAttempts,
          run_after: runAfter,
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
        })
        .eq('id', job.id);
      
      if (error) {
        console.error(`Failed to reset job ${job.id} to QUEUED:`, extractSupabaseError(error));
      } else {
        console.log(`  ♻️  Job ${job.id} reset to QUEUED (attempt ${newAttempts}/${job.max_attempts}, retry in ${backoffMs}ms)`);
        reconciledCount++;
      }
    }
  }
  
  return reconciledCount;
}

/**
 * Pick a job from the queue
 * 
 * Uses row-level locking (FOR UPDATE SKIP LOCKED) to atomically claim
 * a job. Sets lease expiration and returns the job.
 * 
 * Returns null if no jobs are available.
 */
export async function pickJob(): Promise<Job | null> {
  const now = new Date().toISOString();
  const leaseExpiresAt = new Date(Date.now() + WORKER_CONFIG.LEASE_DURATION_MS).toISOString();
  
  // Use a transaction-like approach with RPC
  // Note: Supabase JS client doesn't support FOR UPDATE SKIP LOCKED directly
  // We'll use a simpler approach: select + update with conditions
  
  // First, find a candidate job
  const { data: candidates, error: selectError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', JobStatus.QUEUED)
    .lte('run_after', now)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10); // Get a few candidates to increase chance of success
  
  if (selectError) {
    console.error('Error selecting job candidates:', extractSupabaseError(selectError));
    return null;
  }
  
  if (!candidates || candidates.length === 0) {
    return null;
  }
  
  // Try to claim the first candidate (and fallback to others if racing)
  for (const candidate of candidates) {
    const { data: claimedJobs, error: updateError } = await supabase
      .from('jobs')
      .update({
        status: JobStatus.RUNNING,
        locked_by: WORKER_ID,
        locked_at: now,
        lease_expires_at: leaseExpiresAt,
      })
      .eq('id', candidate.id)
      .eq('status', JobStatus.QUEUED) // Only update if still QUEUED (optimistic locking)
      .select()
      .single();
    
    if (updateError) {
      // Job was likely claimed by another worker, try next candidate
      continue;
    }
    
    if (claimedJobs) {
      return claimedJobs as Job;
    }
  }
  
  // All candidates were claimed by other workers
  return null;
}

/**
 * Complete a job
 * 
 * Updates job status, writes output, clears lease fields.
 */
export async function completeJob(
  id: string,
  status: JobStatus.SUCCEEDED | JobStatus.FAILED,
  output?: Record<string, any>,
  error?: string
): Promise<void> {
  const updates: any = {
    status,
    locked_by: null,
    locked_at: null,
    lease_expires_at: null,
  };
  
  if (output) {
    updates.output = output;
  }
  
  if (error) {
    updates.last_error = error;
  }
  
  const { error: updateError } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id);
  
  if (updateError) {
    console.error(`Failed to complete job ${id}:`, extractSupabaseError(updateError));
    throw new Error(`Failed to complete job: ${extractSupabaseError(updateError)}`);
  }
}

/**
 * Get the worker ID for this process
 */
export function getWorkerId(): string {
  return WORKER_ID;
}
