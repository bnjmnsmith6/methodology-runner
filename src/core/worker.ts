/**
 * Worker loop - the heart of the orchestrator
 * 
 * Polls jobs, executes via adapters, advances state.
 */

import { reconcileExpiredLeases, pickJob, completeJob } from './leases.js';
import { next as reducerNext } from './reducer.js';
import { enqueueJobs } from './scheduler.js';
import { getRp, updateRpState, updateProjectState } from '../services/projects.js';
import { createDecision } from '../services/decisions.js';
import { getAdapter } from '../adapters/registry.js';
import { WORKER_CONFIG, JobStatus, ExecutionResult, Job, StepStatus, DecisionScope, RpState, DecisionStatus } from './types.js';
import { supabase } from '../db/client.js';

let isRunning = false;
let lastReconcileTime = 0;
let lastOrphanScanTime = 0;

/**
 * Start the worker loop
 */
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('⚠️  Worker is already running');
    return;
  }
  
  isRunning = true;
  console.log('🚀 Worker starting...\n');
  
  // Initial reconciliation
  await doReconciliation();
  
  // Initial orphan scan
  await scanForOrphanedRps();
  
  // Main loop
  while (isRunning) {
    try {
      // Periodic reconciliation (every 60 seconds)
      const now = Date.now();
      if (now - lastReconcileTime > WORKER_CONFIG.RECONCILE_INTERVAL_MS) {
        await doReconciliation();
      }
      
      // 🔥 Periodic orphan scan (every 10 seconds)
      if (now - lastOrphanScanTime > 10000) {
        await scanForOrphanedRps();
      }
      
      // Pick a job
      const job = await pickJob();
      
      if (!job) {
        // No jobs available, sleep and retry
        await sleep(WORKER_CONFIG.POLL_INTERVAL_MS);
        continue;
      }
      
      console.log(`\n📋 Picked job: ${job.type} (${job.id})`);
      console.log(`   RP: ${job.rp_id || 'none'}`);
      
      // Execute the job
      await executeJob(job);
      
    } catch (err) {
      console.error('❌ Worker loop error:', err);
      await sleep(5000); // Back off on error
    }
  }
  
  console.log('🛑 Worker stopped');
}

/**
 * Stop the worker loop
 */
export async function stopWorker(): Promise<void> {
  console.log('🛑 Stopping worker...');
  isRunning = false;
}

/**
 * Scan for orphaned RPs (safety net for resume-after-crash and step advancement)
 * 
 * An RP is "orphaned" if:
 * - Step status is NOT_STARTED
 * - State is READY or RUNNING (🔥 BUG FIX 2: NOT WAITING_DECISION)
 * - It has no QUEUED or RUNNING jobs
 * - 🔥 BUG FIX 2: It has no pending decisions
 * 
 * This catches:
 * - RPs in newly activated projects (READY state, step 3/5)
 * - RPs that completed a job and advanced to next step (RUNNING state, next step NOT_STARTED)
 * - RPs that crashed before enqueueing jobs
 * - RPs left behind after system restart
 */
async function scanForOrphanedRps(): Promise<void> {
  try {
    // 🔥 BUG FIX 2: Exclude WAITING_DECISION state (those RPs are waiting for human input, not orphaned)
    const { data: rps, error: rpError } = await supabase
      .from('rps')
      .select('*')
      .eq('step_status', StepStatus.NOT_STARTED)
      .in('state', [RpState.READY, RpState.RUNNING]); // Don't include WAITING_DECISION
    
    if (rpError || !rps || rps.length === 0) {
      lastOrphanScanTime = Date.now();
      return;
    }
    
    // Check each RP for existing jobs AND pending decisions
    for (const rp of rps) {
      // Check for existing jobs
      const { data: jobs, error: jobError } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('rp_id', rp.id)
        .in('status', [JobStatus.QUEUED, JobStatus.RUNNING]);
      
      if (jobError) {
        console.error(`   ❌ Failed to check jobs for RP ${rp.id}`);
        continue;
      }
      
      // If has QUEUED/RUNNING jobs, skip (not orphaned)
      if (jobs && jobs.length > 0) {
        continue;
      }
      
      // 🔥 BUG FIX 2: Check for pending decisions
      const { data: pendingDecisions, error: decisionError } = await supabase
        .from('decisions')
        .select('id')
        .eq('rp_id', rp.id)
        .eq('status', DecisionStatus.PENDING);
      
      if (decisionError) {
        console.error(`   ❌ Failed to check decisions for RP ${rp.id}`);
        continue;
      }
      
      // If has pending decisions, skip (not orphaned, waiting for human)
      if (pendingDecisions && pendingDecisions.length > 0) {
        continue;
      }
      
      // This RP is truly orphaned - no jobs, no pending decisions
      console.log(`🔍 Found orphaned RP: "${rp.title}" (${rp.state}, Step ${rp.step}, ${rp.step_status})`);
      console.log(`   Running reducer to enqueue jobs...`);
      
      // Run reducer to enqueue jobs
      await advanceWorkflow(rp.id);
    }
    
    lastOrphanScanTime = Date.now();
  } catch (err) {
    console.error('❌ Orphan scan error:', err);
    lastOrphanScanTime = Date.now();
  }
}

/**
 * Execute a single job
 */
async function executeJob(job: Job): Promise<void> {
  try {
    // Get the adapter for this job type
    const adapter = getAdapter(job.type);
    
    // Execute via adapter
    console.log(`   ⚙️  Executing via adapter...`);
    const result: ExecutionResult = await adapter.execute(job);
    
    console.log(`   ✅ Result: ${result.status}`);
    
    // Handle the result
    await handleResult(job, result);
    
  } catch (err) {
    console.error(`   ❌ Job execution failed:`, err);
    
    // Mark job as failed
    await completeJob(
      job.id,
      JobStatus.FAILED,
      undefined,
      err instanceof Error ? err.message : String(err)
    );
    
    // Also update the RP step status to ERROR
    if (job.rp_id) {
      await updateRpState(job.rp_id, {
        step_status: StepStatus.ERROR,
        last_error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Handle job execution result and advance workflow
 */
async function handleResult(job: Job, result: ExecutionResult): Promise<void> {
  // Write artifacts if any
  if (result.artifacts && result.artifacts.length > 0) {
    console.log(`   💾 Would save ${result.artifacts.length} artifact(s) (artifacts not implemented in v1)`);
    // TODO: Save artifacts when implemented in v1.1
  }
  
  // Handle different result statuses
  if (result.status === 'SUCCEEDED') {
    // Mark job as succeeded
    await completeJob(job.id, JobStatus.SUCCEEDED, result as any);
    
    // Update RP step status to DONE
    if (job.rp_id) {
      await updateRpState(job.rp_id, { step_status: StepStatus.DONE });
      
      // Run the reducer to determine next action
      await advanceWorkflow(job.rp_id);
    }
    
  } else if (result.status === 'FAILED') {
    // Mark job as failed
    const errorMessage = result.error?.message || 'Unknown error';
    await completeJob(job.id, JobStatus.FAILED, result as any, errorMessage);
    
    // Update RP step status to ERROR
    if (job.rp_id) {
      await updateRpState(job.rp_id, {
        step_status: StepStatus.ERROR,
        last_error: errorMessage,
      });
      
      // Run the reducer to handle error (may create decision or enter debug loop)
      await advanceWorkflow(job.rp_id);
    }
    
  } else if (result.status === 'STOP_AND_ASK') {
    // Agent is asking for human input
    console.log(`   🙋 Agent is asking for human input`);
    
    // Mark job as succeeded (it did its job)
    await completeJob(job.id, JobStatus.SUCCEEDED, result as any);
    
    // Create a decision
    if (result.stopAndAsk && job.rp_id) {
      await createDecision({
        project_id: job.project_id,
        rp_id: job.rp_id,
        scope: DecisionScope.RP,
        title: `Agent question: ${result.stopAndAsk.question}`,
        prompt: result.stopAndAsk.question,
        options: result.stopAndAsk.options,
        context: {
          job_id: job.id,
          job_type: job.type,
        },
      });
    }
  }
}

/**
 * Run the reducer and execute the next action
 */
async function advanceWorkflow(rpId: string): Promise<void> {
  console.log(`   🔄 Advancing workflow for RP ${rpId}...`);
  
  // Load the current RP and project state
  const rp = await getRp(rpId);
  
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', rp.project_id)
    .single();
  
  if (error || !project) {
    console.error(`   ❌ Failed to load project for RP ${rpId}`);
    return;
  }
  
  // Run the reducer
  const nextAction = reducerNext(rp, project);
  
  // Execute the next action
  if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
    await enqueueJobs(nextAction.enqueueJobs);
  }
  
  if (nextAction.createDecision) {
    await createDecision(nextAction.createDecision);
  }
  
  if (nextAction.setRpState) {
    const updates: any = {};
    if (nextAction.setRpState.state !== undefined) {
      updates.state = nextAction.setRpState.state;
    }
    if (nextAction.setRpState.step !== undefined) {
      updates.step = nextAction.setRpState.step;
    }
    if (nextAction.setRpState.step_status !== undefined) {
      updates.step_status = nextAction.setRpState.step_status;
    }
    if (nextAction.setRpState.incrementDebugCycle) {
      updates.debug_cycle_count = rp.debug_cycle_count + 1;
    }
    
    await updateRpState(rpId, updates);
  }
  
  if (nextAction.setProjectState) {
    await updateProjectState(rp.project_id, nextAction.setProjectState.state);
  }
  
  console.log(`   ✅ Workflow advanced`);
}

/**
 * Reconcile expired leases
 */
async function doReconciliation(): Promise<void> {
  const count = await reconcileExpiredLeases();
  if (count > 0) {
    console.log(`✅ Reconciled ${count} expired lease(s)\n`);
  }
  lastReconcileTime = Date.now();
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
