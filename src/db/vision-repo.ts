/**
 * Vision System Repository
 * 
 * CRUD operations for vision system tables.
 * Each function uses the existing Supabase client.
 */

import { supabase, extractSupabaseError } from './client.js';
import {
  VisionSession,
  VisionMessage,
  VisionDocument,
  RPDependency,
  ContextPack,
  DecompositionDecision,
  IntakePath,
  CoverageState,
  RPProposalGraph,
} from '../types/vision.js';

// ============================================================================
// VISION SESSIONS
// ============================================================================

/**
 * Create a new vision session
 */
export async function createVisionSession(
  initialMessage: string,
  path?: IntakePath
): Promise<VisionSession> {
  const defaultCoverage: CoverageState = {
    artifact_type: 'unknown',
    user_problem: 'unknown',
    target_user: 'unknown',
    current_state: 'unknown',
    done_state: 'unknown',
    constraints: 'unknown',
    must_not_do: 'unknown',
    integrations: 'unknown',
    data_auth_permissions: 'unknown',
    non_obvious_risks: 'unknown',
    decisions_already_made: 'unknown',
  };

  const { data, error } = await supabase
    .from('vision_sessions')
    .insert({
      initial_message: initialMessage,
      path: path || null,
      coverage: defaultCoverage,
      turn_count: 0,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create vision session: ${extractSupabaseError(error)}`);
  }

  return data as VisionSession;
}

/**
 * Get a vision session by ID
 */
export async function getVisionSession(id: string): Promise<VisionSession | null> {
  const { data, error } = await supabase
    .from('vision_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw new Error(`Failed to get vision session: ${extractSupabaseError(error)}`);
  }

  return data as VisionSession;
}

/**
 * Update a vision session
 */
export async function updateVisionSession(
  id: string,
  updates: Partial<Omit<VisionSession, 'id' | 'created_at' | 'updated_at'>>
): Promise<VisionSession> {
  const { data, error } = await supabase
    .from('vision_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update vision session: ${extractSupabaseError(error)}`);
  }

  return data as VisionSession;
}

/**
 * Get the active session for the current user
 * Note: This assumes single-user mode. For multi-user, add user_id to vision_sessions.
 */
export async function getActiveSessionForUser(): Promise<VisionSession | null> {
  const { data, error } = await supabase
    .from('vision_sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      console.log('   🔍 getActiveSessionForUser: No active sessions found (all completed/abandoned)');
      return null;
    }
    throw new Error(`Failed to get active session: ${extractSupabaseError(error)}`);
  }

  console.log(`   🔍 getActiveSessionForUser: Found active session ${data.id} (status: ${data.status})`);
  return data as VisionSession;
}

// ============================================================================
// VISION MESSAGES
// ============================================================================

/**
 * Add a message to a vision session
 */
export async function addVisionMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, any>
): Promise<VisionMessage> {
  const { data, error } = await supabase
    .from('vision_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add vision message: ${extractSupabaseError(error)}`);
  }

  return data as VisionMessage;
}

/**
 * Get all messages for a vision session
 */
export async function getVisionMessages(sessionId: string): Promise<VisionMessage[]> {
  const { data, error } = await supabase
    .from('vision_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get vision messages: ${extractSupabaseError(error)}`);
  }

  return data as VisionMessage[];
}

// ============================================================================
// VISION DOCUMENTS
// ============================================================================

/**
 * Create a new vision document
 */
export async function createVisionDocument(
  sessionId: string,
  doc: VisionDocument
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('vision_documents')
    .insert({
      session_id: sessionId,
      project_id: doc.project_id || null,
      version: doc.version,
      status: doc.status || 'draft',
      doc: doc,
      confidence: doc.confidence || null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create vision document: ${extractSupabaseError(error)}`);
  }

  return { id: data.id };
}

/**
 * Get a vision document by ID
 */
export async function getVisionDocument(id: string): Promise<VisionDocument | null> {
  const { data, error } = await supabase
    .from('vision_documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get vision document: ${extractSupabaseError(error)}`);
  }

  // The doc field contains the full VisionDocument structure
  return {
    ...data.doc,
    id: data.id,
    session_id: data.session_id,
    project_id: data.project_id,
    version: data.version,
    status: data.status,
    confidence: data.confidence,
    created_at: data.created_at,
  } as VisionDocument;
}

/**
 * Get the latest vision document for a project
 */
export async function getLatestVisionDocForProject(
  projectId: string
): Promise<VisionDocument | null> {
  const { data, error } = await supabase
    .from('vision_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get latest vision document: ${extractSupabaseError(error)}`);
  }

  return {
    ...data.doc,
    id: data.id,
    session_id: data.session_id,
    project_id: data.project_id,
    version: data.version,
    status: data.status,
    confidence: data.confidence,
    created_at: data.created_at,
  } as VisionDocument;
}

/**
 * Update vision document status
 */
export async function updateVisionDocStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('vision_documents')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update vision document status: ${extractSupabaseError(error)}`);
  }
}

// ============================================================================
// RP DEPENDENCIES
// ============================================================================

/**
 * Add a dependency between two RPs
 */
export async function addRPDependency(
  fromRpId: string,
  toRpId: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('rp_dependencies')
    .insert({
      from_rp_id: fromRpId,
      to_rp_id: toRpId,
      reason: reason || null,
    });

  if (error) {
    // Ignore duplicate key errors (dependency already exists)
    if (error.code !== '23505') {
      throw new Error(`Failed to add RP dependency: ${extractSupabaseError(error)}`);
    }
  }
}

/**
 * Get all dependencies for an RP (both incoming and outgoing)
 */
export async function getRPDependencies(rpId: string): Promise<RPDependency[]> {
  const { data, error } = await supabase
    .from('rp_dependencies')
    .select('*')
    .or(`from_rp_id.eq.${rpId},to_rp_id.eq.${rpId}`);

  if (error) {
    throw new Error(`Failed to get RP dependencies: ${extractSupabaseError(error)}`);
  }

  return data as RPDependency[];
}

/**
 * Get all RPs that depend on this RP (downstream dependencies)
 */
export async function getRPDependents(rpId: string): Promise<RPDependency[]> {
  const { data, error } = await supabase
    .from('rp_dependencies')
    .select('*')
    .eq('from_rp_id', rpId);

  if (error) {
    throw new Error(`Failed to get RP dependents: ${extractSupabaseError(error)}`);
  }

  return data as RPDependency[];
}

/**
 * Get all RPs that this RP depends on (upstream dependencies)
 */
export async function getRPPrerequisites(rpId: string): Promise<RPDependency[]> {
  const { data, error } = await supabase
    .from('rp_dependencies')
    .select('*')
    .eq('to_rp_id', rpId);

  if (error) {
    throw new Error(`Failed to get RP prerequisites: ${extractSupabaseError(error)}`);
  }

  return data as RPDependency[];
}

// ============================================================================
// CONTEXT PACKS
// ============================================================================

/**
 * Create a context pack for a downstream agent
 */
export async function createContextPack(pack: {
  project_id: string;
  rp_id?: string;
  consumer: string;
  payload: any;
  rendered_text?: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('context_packs')
    .insert({
      project_id: pack.project_id,
      rp_id: pack.rp_id || null,
      consumer: pack.consumer,
      payload: pack.payload,
      rendered_text: pack.rendered_text || null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create context pack: ${extractSupabaseError(error)}`);
  }

  return { id: data.id };
}

/**
 * Get a context pack for a specific consumer
 */
export async function getContextPack(
  projectId: string,
  rpId: string,
  consumer: string
): Promise<ContextPack | null> {
  const { data, error } = await supabase
    .from('context_packs')
    .select('*')
    .eq('project_id', projectId)
    .eq('rp_id', rpId)
    .eq('consumer', consumer)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get context pack: ${extractSupabaseError(error)}`);
  }

  return data as ContextPack;
}

/**
 * Get all context packs for a project
 */
export async function getProjectContextPacks(projectId: string): Promise<ContextPack[]> {
  const { data, error } = await supabase
    .from('context_packs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get project context packs: ${extractSupabaseError(error)}`);
  }

  return data as ContextPack[];
}

// ============================================================================
// DECOMPOSITION DECISIONS
// ============================================================================

/**
 * Create a decomposition decision (proposed RP graph)
 */
export async function createDecompositionDecision(
  projectId: string,
  visionDocId: string,
  proposedGraph: RPProposalGraph,
  explanation?: string
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('decomposition_decisions')
    .insert({
      project_id: projectId,
      vision_doc_id: visionDocId,
      proposed_graph: proposedGraph,
      status: 'proposed',
      explanation: explanation || null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create decomposition decision: ${extractSupabaseError(error)}`);
  }

  return { id: data.id };
}

/**
 * Approve a decomposition decision
 */
export async function approveDecomposition(
  decisionId: string,
  approvedGraph?: RPProposalGraph
): Promise<void> {
  const { error } = await supabase
    .from('decomposition_decisions')
    .update({
      status: 'approved',
      approved_graph: approvedGraph || null,
    })
    .eq('id', decisionId);

  if (error) {
    throw new Error(`Failed to approve decomposition: ${extractSupabaseError(error)}`);
  }
}

/**
 * Get a decomposition decision by ID
 */
export async function getDecompositionDecision(
  id: string
): Promise<DecompositionDecision | null> {
  const { data, error } = await supabase
    .from('decomposition_decisions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to get decomposition decision: ${extractSupabaseError(error)}`);
  }

  return data as DecompositionDecision;
}

/**
 * Get all decomposition decisions for a project
 */
export async function getProjectDecompositionDecisions(
  projectId: string
): Promise<DecompositionDecision[]> {
  const { data, error } = await supabase
    .from('decomposition_decisions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      `Failed to get project decomposition decisions: ${extractSupabaseError(error)}`
    );
  }

  return data as DecompositionDecision[];
}
