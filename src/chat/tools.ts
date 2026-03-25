/**
 * Tool definitions and handlers for Claude orchestrator
 * 
 * These tools let Claude read/write the database to manage the workflow.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getAllProjects,
  getProjectStatus,
  getRp,
  createProject as createProjectService,
  createRp as createRpService,
  updateProjectState,
  updateRpState,
} from '../services/projects.js';
import {
  getPendingDecisions,
  getDecisionsForProject,
  getDecisionsForRp,
  answerDecision as answerDecisionService,
} from '../services/decisions.js';
import { ProjectState, RpState, StepStatus, Step } from '../core/types.js';
import { supabase } from '../db/client.js';
import { next as runReducer } from '../core/reducer.js';
import { enqueueJob } from '../core/scheduler.js';

/**
 * Tool definitions for Claude
 */
export const ORCHESTRATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_project_status',
    description: 'Get the status of all projects or a specific project, including all RPs and their current states',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional: specific project ID to get status for. If omitted, returns all projects.',
        },
      },
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project with a tier. Can optionally create the first RP in the same call to avoid chaining tools. ALWAYS use this to create project + RP in one call when possible.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name',
        },
        description: {
          type: 'string',
          description: 'Optional project description',
        },
        tier: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'Project tier: 1=full rigor, 2=standard, 3=fast track',
        },
        rp_title: {
          type: 'string',
          description: 'Optional: Create the first RP with this title in the same call. HIGHLY RECOMMENDED to avoid UUID juggling.',
        },
        rp_description: {
          type: 'string',
          description: 'Optional: Description for the first RP (only used if rp_title is provided)',
        },
      },
      required: ['name', 'tier'],
    },
  },
  {
    name: 'create_rp',
    description: 'Create a new RP (Research Project) within a project. Only use this if you need to add an RP to an existing project. For new projects, use create_project with rp_title instead.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'The project ID (UUID) to add this RP to. MUST be a UUID from a previous tool result, never generate this.',
        },
        title: {
          type: 'string',
          description: 'RP title',
        },
        description: {
          type: 'string',
          description: 'Optional RP description',
        },
        tier_override: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'Optional tier override for this specific RP',
        },
      },
      required: ['project_id', 'title'],
    },
  },
  {
    name: 'start_project',
    description: 'Activate a project and trigger the workflow. Accepts either project_id (UUID) or project_name (looks up by name). Prefer using project_name for clarity.',
    input_schema: {
      type: 'object',
      properties: {
        project_id: {
          type: 'string',
          description: 'Optional: The project UUID to start (from a previous tool result)',
        },
        project_name: {
          type: 'string',
          description: 'Optional: The project name to start (will look up the ID). Use this when you know the name.',
        },
      },
    },
  },
  {
    name: 'get_pending_decisions',
    description: 'Get all pending decisions and RPs waiting for test approval. Use this to answer what needs my attention queries.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'approve_test',
    description: 'Approve or reject a test for an RP that is in WAITING_TEST state. Accepts project name or RP ID.',
    input_schema: {
      type: 'object',
      properties: {
        rp_id: {
          type: 'string',
          description: 'Optional: The RP UUID to approve/reject. Use this if you have the exact ID.',
        },
        project_name: {
          type: 'string',
          description: 'Optional: Look up RP by project name. If multiple RPs exist, will use the most recent one in WAITING_TEST.',
        },
        approved: {
          type: 'boolean',
          description: 'true to approve (advance to SHIP), false to reject (trigger debug cycle)',
        },
        feedback: {
          type: 'string',
          description: 'Optional: Human feedback about the test (stored for context)',
        },
      },
      required: ['approved'],
    },
  },
  {
    name: 'answer_decision',
    description: 'Submit an answer to a pending decision',
    input_schema: {
      type: 'object',
      properties: {
        decision_id: {
          type: 'string',
          description: 'The decision ID to answer',
        },
        answer: {
          type: 'object',
          description: 'The answer object (typically contains selected_option and any other relevant data)',
        },
      },
      required: ['decision_id', 'answer'],
    },
  },
  {
    name: 'get_rp_detail',
    description: 'Get full details for a specific RP, including state, step, and history',
    input_schema: {
      type: 'object',
      properties: {
        rp_id: {
          type: 'string',
          description: 'The RP ID to get details for',
        },
      },
      required: ['rp_id'],
    },
  },
];

/**
 * Handle tool execution
 */
export async function handleToolCall(toolName: string, toolInput: any): Promise<any> {
  try {
    switch (toolName) {
      case 'get_project_status':
        return await handleGetProjectStatus(toolInput);
      
      case 'create_project':
        return await handleCreateProject(toolInput);
      
      case 'create_rp':
        return await handleCreateRp(toolInput);
      
      case 'start_project':
        return await handleStartProject(toolInput);
      
      case 'get_pending_decisions':
        return await handleGetPendingDecisions(toolInput);
      
      case 'approve_test':
        return await handleApproveTest(toolInput);
      
      case 'answer_decision':
        return await handleAnswerDecision(toolInput);
      
      case 'get_rp_detail':
        return await handleGetRpDetail(toolInput);
      
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Tool handlers
 */

async function handleGetProjectStatus(input: any) {
  if (input.project_id) {
    const status = await getProjectStatus(input.project_id);
    return status;
  } else {
    const projects = await getAllProjects();
    return { projects };
  }
}

async function handleCreateProject(input: any) {
  // Create the project
  const project = await createProjectService({
    name: input.name,
    description: input.description,
    tier: input.tier,
  });
  
  // If rp_title provided, create the first RP inline
  if (input.rp_title) {
    const rp = await createRpService({
      project_id: project.id,
      title: input.rp_title,
      description: input.rp_description,
    });
    
    return {
      project,
      rp,
      message: `Created project "${project.name}" (${project.id}) with RP "${rp.title}" (${rp.id})`,
    };
  }
  
  return { project };
}

async function handleCreateRp(input: any) {
  const rp = await createRpService({
    project_id: input.project_id,
    title: input.title,
    description: input.description,
    tier_override: input.tier_override,
  });
  return { rp };
}

async function handleStartProject(input: any) {
  let projectId = input.project_id;
  
  // If project_name provided instead of project_id, look it up
  if (!projectId && input.project_name) {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .ilike('name', input.project_name)
      .limit(1);
    
    if (error || !projects || projects.length === 0) {
      return {
        error: `Project not found with name: ${input.project_name}`,
      };
    }
    
    projectId = projects[0].id;
  }
  
  if (!projectId) {
    return {
      error: 'Must provide either project_id or project_name',
    };
  }
  
  // Activate the project
  const project = await updateProjectState(projectId, ProjectState.ACTIVE);
  
  // 🔥 FIX: Enqueue initial jobs for all READY RPs
  const { data: readyRps, error: rpError } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', projectId)
    .eq('state', RpState.READY);
  
  if (!rpError && readyRps && readyRps.length > 0) {
    console.log(`🚀 Enqueuing initial jobs for ${readyRps.length} READY RPs...`);
    
    for (const rp of readyRps) {
      // Run reducer to get next jobs
      const nextAction = runReducer(rp, project);
      
      // 🔥 BUG FIX 4 (OPTION C): Apply RP state updates BEFORE enqueuing jobs
      // This marks the RP as IN_PROGRESS so orphan scanner never sees it as NOT_STARTED
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
        
        console.log(`  🔄 Updating RP state to ${updates.step_status || '(unchanged)'} before enqueueing jobs`);
        await updateRpState(rp.id, updates);
      }
      
      // Now enqueue jobs - RP is already marked as IN_PROGRESS
      if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
        for (const job of nextAction.enqueueJobs) {
          await enqueueJob(job);
          console.log(`  📤 Enqueued job: ${job.type} for RP ${rp.id}`);
        }
      }
    }
  }
  
  return {
    project,
    message: `Project "${project.name}" activated! The worker will begin processing RPs.`,
  };
}

async function handleGetPendingDecisions(input: any) {
  // Get pending decisions
  const decisions = await getPendingDecisions();
  
  // Also get RPs in WAITING_TEST state
  const { data: waitingTestRps, error } = await supabase
    .from('rps')
    .select('id, project_id, title, description, state, step, step_status, created_at')
    .eq('state', RpState.WAITING_TEST)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching WAITING_TEST RPs:', error);
  }
  
  return {
    decisions,
    decisions_count: decisions.length,
    waiting_test_rps: waitingTestRps || [],
    waiting_test_count: (waitingTestRps || []).length,
    total_items_needing_attention: decisions.length + (waitingTestRps || []).length,
  };
}

async function handleApproveTest(input: any) {
  let rpId = input.rp_id;
  
  // If project_name provided instead of rp_id, look up the RP
  if (!rpId && input.project_name) {
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .ilike('name', input.project_name)
      .limit(1);
    
    if (projectError || !projects || projects.length === 0) {
      return {
        error: `Project not found with name: ${input.project_name}`,
      };
    }
    
    // Find the most recent RP in WAITING_TEST state for this project
    const { data: rps, error: rpError } = await supabase
      .from('rps')
      .select('*')
      .eq('project_id', projects[0].id)
      .eq('state', RpState.WAITING_TEST)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (rpError || !rps || rps.length === 0) {
      return {
        error: `No RP in WAITING_TEST state found for project: ${input.project_name}`,
      };
    }
    
    rpId = rps[0].id;
  }
  
  if (!rpId) {
    return {
      error: 'Must provide either rp_id or project_name',
    };
  }
  
  // Get the RP and project
  const { data: rp, error: rpError } = await supabase
    .from('rps')
    .select('*')
    .eq('id', rpId)
    .single();
  
  if (rpError || !rp) {
    return {
      error: `RP not found: ${rpId}`,
    };
  }
  
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', rp.project_id)
    .single();
  
  if (projectError || !project) {
    return {
      error: `Project not found for RP: ${rp.project_id}`,
    };
  }
  
  // Verify RP is in WAITING_TEST state and step 8
  if (rp.state !== RpState.WAITING_TEST || rp.step !== Step.TEST) {
    return {
      error: `RP is not in WAITING_TEST state at step 8. Current state: ${rp.state}, step: ${rp.step}`,
    };
  }
  
  // Handle approval or rejection
  if (input.approved) {
    // APPROVED: Mark step 8 as DONE
    console.log(`✅ Test approved for RP "${rp.title}"`);
    if (input.feedback) {
      console.log(`   💬 Feedback: ${input.feedback}`);
    }
    
    const { error: updateError } = await supabase
      .from('rps')
      .update({
        step_status: StepStatus.DONE,
        state: RpState.RUNNING,
      })
      .eq('id', rpId);
    
    if (updateError) {
      return { error: `Failed to update RP: ${updateError.message}` };
    }
    
    // Run reducer to advance workflow
    const nextAction = runReducer({ ...rp, step_status: StepStatus.DONE, state: RpState.RUNNING }, project);
    
    // Apply state changes
    if (nextAction.setRpState) {
      await supabase
        .from('rps')
        .update(nextAction.setRpState)
        .eq('id', rpId);
    }
    
    // Enqueue any jobs
    if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
      for (const job of nextAction.enqueueJobs) {
        await enqueueJob(job);
      }
    }
    
    return {
      success: true,
      message: `Test approved for RP "${rp.title}". Workflow advancing to next step (likely SHIP).`,
      rp_id: rpId,
      next_action: nextAction,
    };
  } else {
    // REJECTED: Trigger debug cycle (go to step 9)
    console.log(`❌ Test rejected for RP "${rp.title}"`);
    if (input.feedback) {
      console.log(`   💬 Feedback: ${input.feedback}`);
    }
    
    const { error: updateError } = await supabase
      .from('rps')
      .update({
        step: Step.DEBUG,
        step_status: StepStatus.NOT_STARTED,
        state: RpState.RUNNING,
        last_error: input.feedback || 'Test rejected by user',
        debug_cycle_count: (rp.debug_cycle_count || 0) + 1,
      })
      .eq('id', rpId);
    
    if (updateError) {
      return { error: `Failed to update RP: ${updateError.message}` };
    }
    
    // Run reducer to enqueue DEBUG job
    const nextAction = runReducer({ 
      ...rp, 
      step: Step.DEBUG, 
      step_status: StepStatus.NOT_STARTED, 
      state: RpState.RUNNING,
      debug_cycle_count: (rp.debug_cycle_count || 0) + 1,
    }, project);
    
    // Apply state changes
    if (nextAction.setRpState) {
      await supabase
        .from('rps')
        .update(nextAction.setRpState)
        .eq('id', rpId);
    }
    
    // Enqueue any jobs
    if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
      for (const job of nextAction.enqueueJobs) {
        await enqueueJob(job);
      }
    }
    
    return {
      success: true,
      message: `Test rejected for RP "${rp.title}". Entering debug cycle (step 9).`,
      rp_id: rpId,
      debug_cycle: (rp.debug_cycle_count || 0) + 1,
      next_action: nextAction,
    };
  }
}

async function handleAnswerDecision(input: any) {
  const decision = await answerDecisionService(input.decision_id, input.answer);
  return {
    decision,
    message: 'Decision answered successfully. Workflow will resume.',
  };
}

async function handleGetRpDetail(input: any) {
  const rp = await getRp(input.rp_id);
  const decisions = await getDecisionsForRp(input.rp_id);
  
  return {
    rp,
    decisions,
  };
}
