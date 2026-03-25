/**
 * Reply Processor
 * 
 * Uses Claude to extract structured information from user replies
 */

import { VisionSession, VisionMessage, CoverageState } from '../types/vision.js';
import { callAnthropic } from '../adapters/claude-brain/anthropic-client.js';

export interface ProcessedReply {
  updatedCoverage: CoverageState;
  detectedPivot: boolean;
  pivotDescription?: string;
  extractedInfo: Record<string, string>;  // field -> value extracted from reply
  userWantsToStart: boolean;              // detected "start now" / "just go" / "enough"
}

/**
 * Process a user's reply and extract structured information
 */
export async function processUserReply(
  session: VisionSession,
  messages: VisionMessage[],
  newMessage: string,
  currentCoverage: CoverageState
): Promise<ProcessedReply> {
  // Build conversation history (last 10 messages)
  const conversationHistory = messages
    .slice(-10)
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  
  // Build the system prompt
  const systemPrompt = buildReplyProcessingPrompt();
  
  // Build the user message
  const userMessage = `
Conversation history:
${conversationHistory}

New user message:
${newMessage}

Extract structured information from this reply.
`.trim();
  
  // Call Claude
  try {
    const response = await callAnthropic(systemPrompt, userMessage, 400);
    
    // Parse JSON response
    const parsed = parseReplyJson(response.text);
    
    // Update coverage with extracted info
    const updatedCoverage = applyFieldUpdates(currentCoverage, parsed.field_updates);
    
    return {
      updatedCoverage,
      detectedPivot: parsed.pivot.detected,
      pivotDescription: parsed.pivot.description,
      extractedInfo: parsed.field_updates,
      userWantsToStart: parsed.start_now.detected,
    };
    
  } catch (error) {
    console.error('   ⚠️  Reply processing failed, using fallback:', error);
    
    // Fallback: simple keyword detection
    return fallbackReplyProcessing(newMessage, currentCoverage);
  }
}

/**
 * Build the system prompt for reply processing
 */
function buildReplyProcessingPrompt(): string {
  return `
You are processing a user's reply in a project intake conversation.

Given the conversation history and the new message, extract:

1. FIELD_UPDATES: Which coverage fields does this message address? Return as JSON:
   {"field_name": "extracted value", ...}
   Valid fields: target_user, done_state, current_state, user_problem, constraints, 
   data_auth_permissions, integrations, non_obvious_risks, must_not_do, decisions_already_made, artifact_type

2. PIVOT: Did the user change direction from what was previously discussed? 
   Return: {"detected": true/false, "description": "what changed"}

3. START_NOW: Does the user want to skip further questions and start building?
   Return: {"detected": true/false}

Respond ONLY with JSON in this exact format:
{
  "field_updates": {},
  "pivot": {"detected": false, "description": ""},
  "start_now": {"detected": false}
}

Examples:

User says "For customer support agents"
Response: {"field_updates": {"target_user": "customer support agents"}, "pivot": {"detected": false, "description": ""}, "start_now": {"detected": false}}

User says "Just start now"
Response: {"field_updates": {}, "pivot": {"detected": false, "description": ""}, "start_now": {"detected": true}}

User says "Actually, nevermind the dashboard, let's build an API instead"
Response: {"field_updates": {"artifact_type": "API"}, "pivot": {"detected": true, "description": "Changed from dashboard to API"}, "start_now": {"detected": false}}
`.trim();
}

/**
 * Parse JSON response from Claude
 */
function parseReplyJson(responseText: string): {
  field_updates: Record<string, string>;
  pivot: { detected: boolean; description: string };
  start_now: { detected: boolean };
} {
  // Try to find JSON in the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  return {
    field_updates: parsed.field_updates || {},
    pivot: parsed.pivot || { detected: false, description: '' },
    start_now: parsed.start_now || { detected: false },
  };
}

/**
 * Apply field updates to coverage state
 */
function applyFieldUpdates(
  coverage: CoverageState,
  updates: Record<string, string>
): CoverageState {
  const updated = { ...coverage };
  
  for (const [field, value] of Object.entries(updates)) {
    if (field in updated && value && value.trim().length > 0) {
      updated[field as keyof CoverageState] = 'known';
    }
  }
  
  return updated;
}

/**
 * Fallback reply processing using simple keyword detection
 */
function fallbackReplyProcessing(
  message: string,
  currentCoverage: CoverageState
): ProcessedReply {
  const lower = message.toLowerCase();
  
  // Detect "start now" signals
  const startNowKeywords = ['start', 'go', 'build', 'enough', 'begin', 'just do it', 'proceed'];
  const userWantsToStart = startNowKeywords.some(kw => lower.includes(kw));
  
  // Detect pivot signals (changing direction)
  const pivotKeywords = ['actually', 'nevermind', 'instead', 'wait', 'change', 'different'];
  const detectedPivot = pivotKeywords.some(kw => lower.includes(kw));
  
  // Simple extraction: if message is short and direct, assume it answers the last question
  const extractedInfo: Record<string, string> = {};
  
  // Check for user mentions
  if (lower.includes('admin') || lower.includes('manager') || lower.includes('user')) {
    extractedInfo.target_user = message;
  }
  
  // Check for done state
  if (lower.includes('done') || lower.includes('success') || lower.includes('complete')) {
    extractedInfo.done_state = message;
  }
  
  // Check for constraints
  if (lower.includes('must') || lower.includes('should') || lower.includes('need')) {
    extractedInfo.constraints = message;
  }
  
  return {
    updatedCoverage: applyFieldUpdates(currentCoverage, extractedInfo),
    detectedPivot,
    pivotDescription: detectedPivot ? 'User changed direction' : undefined,
    extractedInfo,
    userWantsToStart,
  };
}
