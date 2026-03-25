/**
 * Intake Module - Central Export
 * 
 * Re-exports all intake classifier, coverage model, and conversation manager functions
 */

// RP-2: Request Parser + Classifier + Coverage Model
export { parseRequest } from './parseRequest.js';
export type { ParsedRequest } from './parseRequest.js';
export { classifyPath } from './classifyPath.js';
export {
  initCoverage,
  updateCoverage,
  hasEnoughCoverage,
  getHighestValueUnknown,
  getCoverageSummary,
} from './coverageModel.js';

// RP-3: Conversation Manager
export {
  startSession,
  getSessionWithMessages,
  completeSession,
  abandonSession,
  getActiveSession,
  addMessage,
  updateSessionState,
} from './sessionManager.js';
export { generateNextTurn } from './nextQuestion.js';
export type { ConversationTurn } from './nextQuestion.js';
export { processUserReply } from './processReply.js';
export type { ProcessedReply } from './processReply.js';
export { shouldStopAsking, isLowInfoReply } from './stopDecision.js';
export type { StopReason, StopDecision } from './stopDecision.js';
export {
  handleNewIntake,
  handleIntakeReply,
  getActiveIntake,
} from './conversationOrchestrator.js';
export type { IntakeResponse } from './conversationOrchestrator.js';
export { buildFastPathVision } from './fastPathVision.js';
