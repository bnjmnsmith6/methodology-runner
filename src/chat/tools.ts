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
import { handleNewIntake, handleIntakeReply, getActiveIntake, getSessionWithMessages } from '../intake/index.js';
import { buildVisionDocument } from '../vision/index.js';
import { decomposeProject } from '../decompose/index.js';
import { generateAndSaveContextPacks } from '../prompts/generateAllContextPacks.js';


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
    description: 'Create a new project with a tier (LEGACY). PREFER start_vision for new project requests instead - it runs the full vision conversation. Only use create_project when the user explicitly wants to skip vision or you already have a vision doc approved.',

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
  {
    name: 'start_vision',
    description: 'Start the vision conversation to understand what the user wants to build. Call this when the user describes a new project idea or says they want to build something.',
    input_schema: {
      type: 'object',
      properties: {
        user_message: {
          type: 'string',
          description: 'The user\'s project description or idea',
        },
      },
      required: ['user_message'],
    },
  },
  {
    name: 'continue_vision',
    description: 'Continue the vision conversation with the user\'s reply. Call this when there is an active vision session and the user is answering questions.',
    input_schema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The active vision session ID',
        },
        user_reply: {
          type: 'string',
          description: 'The user\'s reply to the vision question',
        },
      },
      required: ['session_id', 'user_reply'],
    },
  },
  {
    name: 'approve_vision',
    description: 'Create the project and RPs from the approved vision. Call this when the user confirms the vision summary with "yes", "approve", "looks good", etc. Automatically finds the most recent vision session.',
    input_schema: {
      type: 'object',
      properties: {
        project_name_override: {
          type: 'string',
          description: 'Optional: Override the project name if user wants to change it',
        },
      },
    },
  }];

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
      
      
      case 'start_vision':
        return await handleStartVision(toolInput);
      
      case 'continue_vision':
        return await handleContinueVision(toolInput);
      
      case 'approve_vision':
        return await handleApproveVision(toolInput);
      
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

/**
 * Vision conversation handlers
 */

async function handleStartVision(input: any) {
  console.log('🎯 Starting vision conversation...');
  const result = await handleNewIntake(input.user_message);
  
  if (result.type === 'fast-path') {
    // Fast-path: Simple request, skip conversation
    console.log('   ⚡ Fast-path detected - creating project immediately');
    
    // The vision doc and decomposition are already built in handleNewIntake
    // We need to load them and create the project
    const { data: session } = await supabase
      .from('intake_sessions')
      .select('vision_doc_id')
      .eq('id', result.sessionId)
      .single();
    
    if (!session?.vision_doc_id) {
      return {
        error: 'Fast-path session created but vision_doc_id not found',
      };
    }
    
    // Load vision doc
    const { data: visionDoc } = await supabase
      .from('vision_documents')
      .select('*')
      .eq('id', session.vision_doc_id)
      .single();
    
    if (!visionDoc) {
      return {
        error: 'Vision document not found',
      };
    }
    
    // Load decomposition
    const { data: decomposition } = await supabase
      .from('rp_proposals')
      .select('*')
      .eq('vision_doc_id', visionDoc.id);
    
    if (!decomposition || decomposition.length === 0) {
      return {
        error: 'No decomposition found for vision document',
      };
    }
    
    // Create project from vision doc
    const project = await createProjectService({
      name: visionDoc.intent.project_title,
      description: visionDoc.intent.one_sentence_brief,
      tier: Math.max(...decomposition.map((d: any) => d.tier || 3)) as 1 | 2 | 3,
    });
    
    // Create RPs
    const rpIdMap: Record<string, string> = {};
    for (const proposal of decomposition) {
      const rp = await createRpService({
        project_id: project.id,
        title: proposal.title,
        description: proposal.description,
        tier_override: proposal.tier,
      });
      rpIdMap[proposal.title] = rp.id;
      
      // Link RP to vision doc
      await supabase
        .from('rps')
        .update({ source_vision_doc_id: visionDoc.id })
        .eq('id', rp.id);
    }
    
    // Create RP dependencies (if supported by the database)
    // TODO: Add rp_dependencies table support if needed
    
    // Generate context packs
    await generateAndSaveContextPacks(
      project.id,
      visionDoc,
      decomposition,
      rpIdMap
    );
    
    // Update vision doc with project_id
    await supabase
      .from('vision_documents')
      .update({ project_id: project.id })
      .eq('id', visionDoc.id);
    
    // Start project
    await updateProjectState(project.id, ProjectState.ACTIVE);
    
    // Enqueue initial jobs (same logic as handleStartProject)
    const { data: readyRps } = await supabase
      .from('rps')
      .select('*')
      .eq('project_id', project.id)
      .eq('state', RpState.READY);
    
    if (readyRps && readyRps.length > 0) {
      for (const rp of readyRps) {
        const nextAction = runReducer(rp, project);
        
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
          await updateRpState(rp.id, updates);
        }
        
        if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
          for (const job of nextAction.enqueueJobs) {
            await enqueueJob(job);
          }
        }
      }
    }
    
    return {
      status: 'fast_path_created',
      projectId: project.id,
      projectName: project.name,
      rpCount: decomposition.length,
      message: `Fast-tracked! Created project "${project.name}" with ${decomposition.length} RP(s) and started it. The worker is now processing.`,
    };
  } else {
    // Conversation path: Ask first question
    return {
      status: 'asking',
      sessionId: result.sessionId,
      message: result.message,
      quickOptions: result.quickOptions,
    };
  }
}

async function handleContinueVision(input: any) {
  console.log(`🎯 Continuing vision conversation (session: ${input.session_id})...`);
  
  const result = await handleIntakeReply(input.session_id, input.user_reply);
  
  if (result.visionSessionComplete) {
    // Session complete - build vision doc and decompose
    console.log('   ✅ Vision conversation complete - building vision doc...');
    
    const { session, messages } = await getSessionWithMessages(input.session_id);
    
    // Build vision document
    const visionDoc = await buildVisionDocument(session, messages, session.coverage);
    
    // Save vision doc
    const { data: savedVisionDoc, error: visionError } = await supabase
      .from('vision_documents')
      .insert({
        session_id: session.id,
        version: visionDoc.version,
        status: visionDoc.status,
        confidence: visionDoc.confidence,
        source: visionDoc.source,
        classification: visionDoc.classification,
        intent: visionDoc.intent,
        users: visionDoc.users,
        current_state: visionDoc.current_state,
        done_definition: visionDoc.done_definition,
        constraints: visionDoc.constraints,
        decisions_made: visionDoc.decisions_made,
        risk_register: visionDoc.risk_register,
        decomposition_hints: visionDoc.decomposition_hints,
        downstream_context: visionDoc.downstream_context,
      })
      .select()
      .single();
    
    if (visionError || !savedVisionDoc) {
      return {
        error: `Failed to save vision document: ${visionError?.message}`,
      };
    }
    
    // Link session to vision doc
    await supabase
      .from('intake_sessions')
      .update({ vision_doc_id: savedVisionDoc.id })
      .eq('id', session.id);
    
    // Decompose project
    console.log('   🔍 Decomposing into RPs...');
    const decomposition = await decomposeProject(savedVisionDoc);
    
    // Save RP proposals
    const savedProposals = [];
    for (const proposal of decomposition.proposals) {
      const { data: savedProposal, error: proposalError } = await supabase
        .from('rp_proposals')
        .insert({
          vision_doc_id: savedVisionDoc.id,
          title: proposal.title,
          description: proposal.description,
          tier: proposal.tier,
          dependencies: proposal.dependencies,
          rationale: proposal.rationale,
          pbca_focus: proposal.pbca_focus,
        })
        .select()
        .single();
      
      if (!proposalError && savedProposal) {
        savedProposals.push(savedProposal);
      }
    }
    
    // Format summary for user
    const summary = `## ${savedVisionDoc.intent.project_title}

${savedVisionDoc.intent.one_sentence_brief}

**Complexity:** ${savedVisionDoc.classification.complexity}
**Confidence:** ${Math.round(savedVisionDoc.confidence * 100)}%

### What Success Looks Like
${savedVisionDoc.done_definition.success_criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}

### What's Out of Scope
${savedVisionDoc.done_definition.out_of_scope.map((s: string) => `- ${s}`).join('\n')}`;
    
    const decompositionText = decomposition.userSummary;
    
    return {
      status: 'ready_to_create',
      visionDocId: savedVisionDoc.id,
      summary,
      decomposition: decompositionText,
      proposalCount: savedProposals.length,
      message: `${summary}\n\n---\n\n${decompositionText}\n\nLooks good? Say "yes" or "approve" to create the project, or tell me what to change.`,
    };
  } else {
    // More questions
    return {
      status: 'asking',
      sessionId: input.session_id,
      message: result.message,
      quickOptions: result.quickOptions,
    };
  }
}

async function handleApproveVision(input: any) {
  console.log(`✅ Approving vision from most recent session...`);
  
  // Find the most recent completed vision session
  const { data: completedSessions, error: sessionError } = await supabase
    .from('vision_sessions')
    .select('*')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1);
  
  if (sessionError || !completedSessions || completedSessions.length === 0) {
    return {
      error: 'No completed vision session found. Please complete a vision conversation first.',
    };
  }
  
  const session = completedSessions[0];
  console.log(`   📝 Found completed session: ${session.id}`);
  
  // Load vision doc linked to this session
  const { data: visionDocs, error: visionError } = await supabase
    .from('vision_documents')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (visionError || !visionDocs || visionDocs.length === 0) {
    return {
      error: `No vision document found for session ${session.id}`,
    };
  }
  
  const visionDoc = visionDocs[0];
  console.log(`   📄 Found vision doc: ${visionDoc.id}`);
  
  // Load RP proposals
  const { data: proposals, error: proposalsError } = await supabase
    .from('rp_proposals')
    .select('*')
    .eq('vision_doc_id', visionDoc.id);
  
  if (proposalsError || !proposals || proposals.length === 0) {
    return {
      error: 'No RP proposals found for this vision document',
    };
  }
  
  // Determine max tier
  const maxTier = Math.max(...proposals.map((p: any) => p.tier || 3)) as 1 | 2 | 3;
  
  // Create project
  const projectName = input.project_name_override || visionDoc.intent.project_title;
  const project = await createProjectService({
    name: projectName,
    description: visionDoc.intent.one_sentence_brief,
    tier: maxTier,
  });
  
  console.log(`   📦 Created project: ${project.name} (${project.id})`);
  
  // Create RPs
  const rpIdMap: Record<string, string> = {};
  for (const proposal of proposals) {
    const rp = await createRpService({
      project_id: project.id,
      title: proposal.title,
      description: proposal.description,
      tier_override: proposal.tier,
    });
    
    rpIdMap[proposal.title] = rp.id;
    
    // Link RP to vision doc
    await supabase
      .from('rps')
      .update({ source_vision_doc_id: visionDoc.id })
      .eq('id', rp.id);
    
    console.log(`   📝 Created RP: ${proposal.title} (Tier ${proposal.tier})`);
  }
  
  // TODO: Create RP dependencies when rp_dependencies table is available
  
  // Generate context packs for all RPs
  console.log(`   📦 Generating context packs...`);
  await generateAndSaveContextPacks(project.id, visionDoc, proposals, rpIdMap);
  
  // Update vision doc with project_id
  await supabase
    .from('vision_documents')
    .update({ project_id: project.id })
    .eq('id', visionDoc.id);
  
  // Start the project
  console.log(`   🚀 Starting project...`);
  await updateProjectState(project.id, ProjectState.ACTIVE);
  
  // Enqueue initial jobs for all READY RPs
  const { data: readyRps } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', project.id)
    .eq('state', RpState.READY);
  
  if (readyRps && readyRps.length > 0) {
    for (const rp of readyRps) {
      const nextAction = runReducer(rp, project);
      
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
        await updateRpState(rp.id, updates);
      }
      
      if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
        for (const job of nextAction.enqueueJobs) {
          await enqueueJob(job);
        }
      }
    }
  }
  
  return {
    status: 'created',
    projectId: project.id,
    projectName: project.name,
    rpCount: proposals.length,
    message: `✅ Created project "${project.name}" with ${proposals.length} RP(s). The worker is now processing. I'll notify you when decisions need your input.`,
  };
}
