/**
 * Conversation Orchestrator
 * 
 * High-level API that ties together all intake components
 */

import { IntakeDecision } from '../types/vision.js';
import { parseRequest } from './parseRequest.js';
import { classifyPath } from './classifyPath.js';
import { buildFastPathVision } from './fastPathVision.js';
import {
  startSession,
  getSessionWithMessages,
  completeSession,
  getActiveSession,
  addMessage,
  updateSessionState,
} from './sessionManager.js';
import { generateNextTurn } from './nextQuestion.js';
import { processUserReply } from './processReply.js';
import { shouldStopAsking, isLowInfoReply } from './stopDecision.js';
import { updateCoverage } from './coverageModel.js';

export interface IntakeResponse {
  type: 'question' | 'ready' | 'fast-path';
  sessionId?: string;
  message: string;            // the message to show the user
  quickOptions?: string[];    // suggested quick replies
  visionSessionComplete: boolean;
  metadata?: {
    summary?: string;
    turnNumber?: number;
    stopReason?: string;
    pivotDetected?: boolean;
  };
}

/**
 * Handle a new intake request (user's first message)
 */
export async function handleNewIntake(userMessage: string): Promise<IntakeResponse> {
  console.log('🎯 Starting new intake...');
  
  // 1. Parse the request
  const parsed = parseRequest(userMessage);
  console.log(`   📝 Parsed: artifact=${parsed.artifactType}, specificity=${parsed.specificity}, components=${parsed.componentCount}`);
  
  // 2. Classify the path
  const decision = classifyPath(parsed);
  console.log(`   🔀 Classified: path=${decision.path}, confidence=${decision.confidence}`);
  
  // 3. If fast-path: return immediately
  if (decision.path === 'fast-path') {
    console.log('   ⚡ Fast-path detected — starting immediately');
    
    // Build fast-path vision doc (will be saved by caller)
    const visionDoc = buildFastPathVision(parsed);
    
    return {
      type: 'fast-path',
      message: "Got it — starting now. I'll build exactly what you asked for.",
      visionSessionComplete: true,
      metadata: {
        summary: visionDoc.intent.one_sentence_brief,
      },
    };
  }
  
  // 4. Start a session
  const session = await startSession(userMessage, decision, parsed);
  console.log(`   ✅ Session created: ${session.id}`);
  
  // 5. Generate first question
  const { messages } = await getSessionWithMessages(session.id);
  const turn = await generateNextTurn(session, messages, session.coverage!);
  
  // 6. Save assistant message
  const assistantMessage = formatTurnMessage(turn);
  await addMessage(session.id, 'assistant', assistantMessage);
  
  // 7. Update session state
  await updateSessionState(session.id, {
    turn_count: turn.turnNumber,
    current_summary: turn.summary,
    last_question: turn.question,
  });
  
  console.log(`   ❓ Generated question (turn ${turn.turnNumber})`);
  
  return {
    type: 'question',
    sessionId: session.id,
    message: assistantMessage,
    quickOptions: turn.quickOptions,
    visionSessionComplete: false,
    metadata: {
      summary: turn.summary,
      turnNumber: turn.turnNumber,
    },
  };
}

/**
 * Handle a reply to an ongoing intake session
 */
export async function handleIntakeReply(
  sessionId: string,
  userMessage: string
): Promise<IntakeResponse> {
  console.log(`🎯 Processing reply for session ${sessionId}...`);
  
  // 1. Load session and messages
  const { session, messages } = await getSessionWithMessages(sessionId);
  
  // 2. Add user message to transcript
  await addMessage(sessionId, 'user', userMessage);
  messages.push({
    id: 'temp',
    session_id: sessionId,
    role: 'user',
    content: userMessage,
    created_at: new Date().toISOString(),
  });
  
  // 3. Process the reply
  const processed = await processUserReply(session, messages, userMessage, session.coverage!);
  console.log(`   📊 Extracted: ${Object.keys(processed.extractedInfo).length} fields`);
  
  if (processed.detectedPivot) {
    console.log(`   🔄 Pivot detected: ${processed.pivotDescription}`);
  }
  
  if (processed.userWantsToStart) {
    console.log('   ⏭️  User wants to start now');
  }
  
  // 4. Update coverage
  const updatedCoverage = processed.updatedCoverage;
  
  // 5. Track low-info replies by checking recent user messages
  const consecutiveLowInfoReplies = countConsecutiveLowInfoReplies(messages, userMessage);
  
  // 6. Check stop decision
  const stopDecision = shouldStopAsking(
    session,
    updatedCoverage,
    processed.userWantsToStart,
    consecutiveLowInfoReplies
  );
  
  console.log(`   🛑 Stop decision: ${stopDecision.reason} (should stop: ${stopDecision.shouldStop})`);
  
  // 7. If should stop: complete session and return ready
  if (stopDecision.shouldStop) {
    await completeSession(sessionId);
    
    let readyMessage = buildReadyMessage(stopDecision.reason, stopDecision.assumptionMode);
    
    return {
      type: 'ready',
      sessionId,
      message: readyMessage,
      visionSessionComplete: true,
      metadata: {
        stopReason: stopDecision.reason,
        summary: session.current_summary || 'Ready to proceed',
      },
    };
  }
  
  // 8. Otherwise: generate next question
  const turn = await generateNextTurn(session, messages, updatedCoverage);
  
  // 9. Save assistant message
  const assistantMessage = formatTurnMessage(turn);
  await addMessage(sessionId, 'assistant', assistantMessage);
  
  // 10. Update session state
  await updateSessionState(sessionId, {
    coverage: updatedCoverage,
    turn_count: turn.turnNumber,
    current_summary: turn.summary,
    last_question: turn.question,
  });
  
  console.log(`   ❓ Generated question (turn ${turn.turnNumber})`);
  
  return {
    type: 'question',
    sessionId,
    message: assistantMessage,
    quickOptions: turn.quickOptions,
    visionSessionComplete: false,
    metadata: {
      summary: turn.summary,
      turnNumber: turn.turnNumber,
      pivotDetected: processed.detectedPivot,
    },
  };
}

/**
 * Check if there's an active vision session
 */
export async function getActiveIntake(): Promise<{ active: boolean; sessionId?: string }> {
  const session = await getActiveSession();
  
  if (session) {
    return {
      active: true,
      sessionId: session.id,
    };
  }
  
  return {
    active: false,
  };
}

/**
 * Format a ConversationTurn into a user-facing message
 */
function formatTurnMessage(turn: { summary: string; question: string; escapeOption: string }): string {
  return `${turn.summary}\n\n${turn.question}\n\n${turn.escapeOption}`;
}

/**
 * Build a "ready to proceed" message based on stop reason
 */
function buildReadyMessage(reason: string, assumptionMode: boolean): string {
  switch (reason) {
    case 'user_requested':
      return "Perfect! I'll start with what you've told me and fill in reasonable defaults where needed.";
    
    case 'coverage_met':
      return "I think I have everything I need. Ready to start building!";
    
    case 'max_turns_reached':
      return "We've covered a lot. I'll proceed with what we've discussed and make reasonable assumptions for the rest.";
    
    case 'low_info_replies':
      return "I'll take it from here! I'll work with what you've shared and make smart defaults for anything unclear.";
    
    default:
      return "Let's get started!";
  }
}

/**
 * Count consecutive low-info replies from the end of message history
 */
function countConsecutiveLowInfoReplies(messages: any[], latestMessage: string): number {
  // Check if latest message is low-info
  if (!isLowInfoReply(latestMessage)) {
    return 0;
  }
  
  // Count backwards through user messages to find consecutive low-info replies
  let count = 1; // Latest message is already low-info
  
  for (let i = messages.length - 1; i >= 0 && count < 3; i--) {
    if (messages[i].role === 'user') {
      if (isLowInfoReply(messages[i].content)) {
        count++;
      } else {
        break; // Found a non-low-info reply, stop counting
      }
    }
  }
  
  return count;
}

