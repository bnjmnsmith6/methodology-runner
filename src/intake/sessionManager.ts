/**
 * Vision Session Manager
 * 
 * Manages vision session lifecycle: create, update, complete, abandon
 */

import {
  VisionSession,
  VisionMessage,
  IntakeDecision,
  CoverageState,
} from '../types/vision.js';
import {
  createVisionSession,
  updateVisionSession,
  addVisionMessage,
  getVisionMessages,
  getVisionSession,
  getActiveSessionForUser,
} from '../db/vision-repo.js';
import { initCoverage } from './coverageModel.js';

/**
 * Start a new vision session from the classifier's decision
 */
export async function startSession(
  initialMessage: string,
  decision: IntakeDecision,
  parsed: any // ParsedRequest from parseRequest
): Promise<VisionSession> {
  // Initialize coverage from the parsed request
  const coverage = initCoverage(parsed);
  
  // Create the session
  const session = await createVisionSession(initialMessage, decision.path);
  
  // Update with classifier results and coverage
  const updatedSession = await updateVisionSession(session.id, {
    path: decision.path,
    classifier_confidence: decision.confidence,
    classifier_reasons: decision.reasons,
    coverage,
    current_summary: '',
    turn_count: 0,
  });
  
  // Add the initial user message to the transcript
  await addVisionMessage(session.id, 'user', initialMessage);
  
  return updatedSession;
}

/**
 * Get the current session state with all messages
 */
export async function getSessionWithMessages(sessionId: string): Promise<{
  session: VisionSession;
  messages: VisionMessage[];
}> {
  const session = await getVisionSession(sessionId);
  if (!session) {
    throw new Error(`Vision session ${sessionId} not found`);
  }
  
  const messages = await getVisionMessages(sessionId);
  
  return { session, messages };
}

/**
 * Get the active session for the current user
 */
export async function getActiveSession(): Promise<VisionSession | null> {
  return await getActiveSessionForUser();
}

/**
 * Update session with new coverage and summary
 */
export async function updateSessionState(
  sessionId: string,
  updates: {
    coverage?: CoverageState;
    current_summary?: string;
    turn_count?: number;
    last_question?: string;
  }
): Promise<VisionSession> {
  return await updateVisionSession(sessionId, updates);
}

/**
 * Mark session as completed
 */
export async function completeSession(sessionId: string): Promise<void> {
  console.log(`   🏁 Completing session: ${sessionId}`);
  await updateVisionSession(sessionId, {
    status: 'completed',
  });
  console.log(`   ✅ Session ${sessionId} marked as COMPLETED in database`);
}

/**
 * Mark session as abandoned
 */
export async function abandonSession(sessionId: string): Promise<void> {
  await updateVisionSession(sessionId, {
    status: 'abandoned',
  });
}

/**
 * Add a message to the session
 */
export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: Record<string, any>
): Promise<VisionMessage> {
  return await addVisionMessage(sessionId, role, content, metadata);
}
