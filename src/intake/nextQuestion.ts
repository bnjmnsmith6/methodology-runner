/**
 * Next Question Generator
 * 
 * Uses Claude Sonnet to generate natural, contextual questions based on coverage gaps
 */

import { VisionSession, VisionMessage, CoverageState } from '../types/vision.js';
import { getHighestValueUnknown, getCoverageSummary } from './coverageModel.js';
import { callAnthropic } from '../adapters/claude-brain/anthropic-client.js';

export interface ConversationTurn {
  summary: string;          // 1-2 sentence summary of current understanding
  question: string;         // the primary question
  quickOptions?: string[];  // 2-4 short answer suggestions (for future UI chips)
  escapeOption: string;     // always present: "start now with assumptions" phrasing
  turnNumber: number;
}

// Field descriptions for generating natural questions
const FIELD_DESCRIPTIONS: Record<string, string> = {
  target_user: "Who will use this? What role, team, or person?",
  done_state: "What does 'done' look like? How will you know it works?",
  current_state: "What exists today? Is this replacing something or starting fresh?",
  user_problem: "What problem does this solve? What pain point?",
  constraints: "Any technical, time, or business constraints?",
  data_auth_permissions: "Any database, auth, login, or permission requirements?",
  integrations: "Does this connect to external systems or APIs?",
  non_obvious_risks: "What's the riskiest or most uncertain part?",
  must_not_do: "Anything explicitly out of scope or off-limits?",
  decisions_already_made: "Any choices you've already locked in?",
  artifact_type: "What kind of thing should I build?",
};

/**
 * Generate the next conversation turn with a question
 */
export async function generateNextTurn(
  session: VisionSession,
  messages: VisionMessage[],
  coverage: CoverageState
): Promise<ConversationTurn> {
  // Determine what to ask about
  const fieldToAskAbout = getHighestValueUnknown(coverage, session.path!);
  
  // If no unknown fields, return a "ready" turn
  if (!fieldToAskAbout) {
    return {
      summary: "I think I have enough context to start building.",
      question: "Ready to proceed with what we've discussed?",
      escapeOption: "Say 'yes' to start, or add any final details.",
      turnNumber: session.turn_count + 1,
    };
  }
  
  // Build conversation history
  const conversationHistory = messages
    .slice(0, 10) // Keep last 10 messages to stay within token budget
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  
  // Coverage summary
  const coverageSummary = getCoverageSummary(coverage);
  const coverageText = `Known: ${coverageSummary.known}, Assumed: ${coverageSummary.assumed}, Unknown: ${coverageSummary.unknown}`;
  
  // Field description
  const fieldDescription = FIELD_DESCRIPTIONS[fieldToAskAbout] || fieldToAskAbout;
  
  // Build the system prompt
  const systemPrompt = buildQuestionSystemPrompt(fieldToAskAbout, fieldDescription);
  
  // Build the user message
  const userMessage = `
Conversation so far:
${conversationHistory}

Current understanding (coverage):
${coverageText}

Generate the next turn focusing on: ${fieldDescription}
`.trim();
  
  // Call Claude
  const response = await callAnthropic(systemPrompt, userMessage, 300);
  
  // Parse the response
  return parseQuestionResponse(response.text, session.turn_count + 1);
}

/**
 * Build the system prompt for question generation
 */
function buildQuestionSystemPrompt(fieldName: string, fieldDescription: string): string {
  return `
You are GUPPI's intake assistant. You're having a brief conversation to understand what the user wants to build before starting work.

Rules:
1. You've already classified this request as needing clarification.
2. Ask ONE question per turn. Never ask multiple questions.
3. Start each turn with a 1-2 sentence summary: "Here's my read so far: ..."
4. Then ask the ONE most important question.
5. Suggest 2-4 quick answers when the question has common responses.
6. Always end with an escape: "Or just say 'start now' and I'll begin with reasonable defaults."
7. Keep messages SHORT. The user is on mobile.
8. Never be condescending. Never ask obvious questions.
9. If the user gives a one-word answer, accept it and move on.
10. Be warm but efficient. Think smart colleague, not intake form.

The field you need to ask about: ${fieldName}
Field description: ${fieldDescription}

Respond in this format:
SUMMARY: [1-2 sentence summary]
QUESTION: [the one question]
OPTIONS: [optional: 2-4 comma-separated quick answer suggestions]
ESCAPE: [the "start now" phrasing]

Example:
SUMMARY: You want to build a dashboard for customer support.
QUESTION: Who's the main user — support agents, managers, or both?
OPTIONS: Agents only, Managers only, Both, Everyone in the company
ESCAPE: Or just say "start now" and I'll assume it's for everyone.
`.trim();
}

/**
 * Parse Claude's response into a ConversationTurn
 */
function parseQuestionResponse(responseText: string, turnNumber: number): ConversationTurn {
  const lines = responseText.split('\n').filter(line => line.trim());
  
  let summary = '';
  let question = '';
  let quickOptions: string[] | undefined;
  let escapeOption = "Or say 'start now' and I'll begin with reasonable assumptions.";
  
  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      summary = line.replace('SUMMARY:', '').trim();
    } else if (line.startsWith('QUESTION:')) {
      question = line.replace('QUESTION:', '').trim();
    } else if (line.startsWith('OPTIONS:')) {
      const optionsText = line.replace('OPTIONS:', '').trim();
      quickOptions = optionsText.split(',').map(o => o.trim()).filter(o => o.length > 0);
    } else if (line.startsWith('ESCAPE:')) {
      escapeOption = line.replace('ESCAPE:', '').trim();
    }
  }
  
  // Fallback if parsing failed
  if (!summary || !question) {
    summary = "Let me ask you one more thing.";
    question = responseText.split('\n')[0] || "What else should I know?";
  }
  
  return {
    summary,
    question,
    quickOptions,
    escapeOption,
    turnNumber,
  };
}
