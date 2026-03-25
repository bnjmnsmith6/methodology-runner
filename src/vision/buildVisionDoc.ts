/**
 * Vision Document Builder
 * 
 * Generates structured Vision Documents from completed conversation sessions
 */

import {
  VisionDocument,
  VisionSession,
  VisionMessage,
  CoverageState,
} from '../types/vision.js';
import { callAnthropic } from '../adapters/claude-brain/anthropic-client.js';
import { createVisionDocument } from '../db/vision-repo.js';

/**
 * Build a Vision Document from a completed conversation session
 */
export async function buildVisionDocument(
  session: VisionSession,
  messages: VisionMessage[],
  coverage: CoverageState
): Promise<VisionDocument> {
  console.log('📄 Building Vision Document from conversation...');
  
  // Format the conversation transcript
  const formattedTranscript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  
  // Format coverage state
  const coverageJSON = JSON.stringify(coverage, null, 2);
  
  // Build the system prompt
  const systemPrompt = buildVisionDocSystemPrompt();
  
  // Build the user message
  const userMessage = `
Coverage state (what we know vs. assume vs. don't know):
${coverageJSON}

Conversation transcript:
${formattedTranscript}

Generate the Vision Document JSON.
`.trim();
  
  // Call Claude
  let response: any;
  try {
    const result = await callAnthropic(systemPrompt, userMessage, 2000);
    response = result.text;
  } catch (error) {
    console.error('   ⚠️  Vision Doc generation failed:', error);
    throw new Error('Failed to generate Vision Document');
  }
  
  // Parse JSON response
  let visionDoc: VisionDocument;
  try {
    visionDoc = parseVisionDocResponse(response);
  } catch (error) {
    console.error('   ⚠️  JSON parsing failed, retrying...');
    
    // Retry once with explicit JSON-only reminder
    const retryPrompt = systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanatory text.';
    const retryResult = await callAnthropic(retryPrompt, userMessage, 2000);
    
    try {
      visionDoc = parseVisionDocResponse(retryResult.text);
    } catch (retryError) {
      console.error('   ❌ JSON parsing failed twice, returning fallback');
      // Fallback: create minimal Vision Doc
      visionDoc = buildFallbackVisionDoc(session, messages);
    }
  }
  
  // Add session metadata
  visionDoc.session_id = session.id;
  visionDoc.project_id = session.project_id || undefined;
  
  console.log('   ✅ Vision Document generated');
  console.log(`   📊 Confidence: ${visionDoc.confidence || 'N/A'}`);
  
  return visionDoc;
}

/**
 * Build the system prompt for Vision Document generation
 */
function buildVisionDocSystemPrompt(): string {
  return `
You are generating a Vision Document from a project intake conversation.

Read the conversation transcript below. Extract and organize the information into the required JSON structure.

Rules:
1. Only include information that was explicitly stated or clearly implied in the conversation.
2. For fields where information was not discussed, use null or empty arrays.
3. Mark assumptions explicitly in the risk_register.assumptions array.
4. The one_sentence_brief should be crisp and actionable — not a repeat of the conversation.
5. success_criteria should be testable statements, not vague goals.
6. non_goals should capture anything the user explicitly excluded or that's clearly out of scope.
7. decomposition_hints should suggest natural work boundaries — don't force them.

Return ONLY a valid JSON object matching this schema:

{
  "version": 1,
  "status": "draft",
  "confidence": 0.0-1.0,
  "source": {
    "initial_user_message": "string",
    "conversation_summary": "2-3 sentence summary of conversation"
  },
  "classification": {
    "path": "fast-path" | "micro-vision" | "full-vision",
    "complexity": "simple" | "standard" | "complex",
    "confidence": 0.0-1.0,
    "reasons": ["string"]
  },
  "intent": {
    "project_title": "string",
    "one_sentence_brief": "string",
    "job_story": "When I... I want... So that..." (optional),
    "primary_outcome": "string",
    "non_goals": ["string"]
  },
  "users": {
    "primary_user": "string" (optional),
    "secondary_users": ["string"] (optional),
    "stakeholders": ["string"] (optional)
  },
  "current_state": {
    "what_exists_now": "string" (optional),
    "pain_points": ["string"] (optional),
    "replaced_systems": ["string"] (optional)
  },
  "done_definition": {
    "success_criteria": ["testable statement"],
    "acceptance_examples": ["example scenario"],
    "out_of_scope": ["string"]
  },
  "constraints": {
    "tech": ["string"],
    "product": ["string"],
    "time": ["string"],
    "policy": ["string"],
    "ux": ["string"]
  },
  "decisions_made": {
    "fixed_choices": ["string"],
    "preferred_directions": ["string"],
    "rejected_directions": ["string"]
  },
  "risk_register": {
    "key_risks": ["string"],
    "assumptions": ["string"],
    "unknowns": ["string"]
  },
  "decomposition_hints": {
    "likely_workstreams": ["string"],
    "suspected_dependencies": ["string"],
    "suggested_rp_count": number
  },
  "downstream_context": {
    "review_focus": ["string"],
    "research_questions": ["string"],
    "build_constraints": ["string"]
  }
}

No markdown code blocks. No explanatory text. Only JSON.
`.trim();
}

/**
 * Parse Vision Document from Claude's response
 */
function parseVisionDocResponse(responseText: string): VisionDocument {
  // Try to find JSON in the response
  let jsonText = responseText.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
  }
  
  // Parse JSON
  const parsed = JSON.parse(jsonText);
  
  // Validate required fields
  if (!parsed.intent || !parsed.intent.project_title) {
    throw new Error('Missing required field: intent.project_title');
  }
  
  return parsed as VisionDocument;
}

/**
 * Build a fallback Vision Document when JSON parsing fails
 */
function buildFallbackVisionDoc(
  session: VisionSession,
  messages: VisionMessage[]
): VisionDocument {
  const initialMessage = session.initial_message || messages[0]?.content || 'Unknown request';
  
  return {
    version: 1,
    status: 'draft',
    confidence: 0.5,
    source: {
      initial_user_message: initialMessage,
      conversation_summary: 'Fallback document due to parsing error',
    },
    classification: {
      path: session.path || 'micro-vision',
      complexity: 'standard',
      confidence: 0.5,
      reasons: ['Fallback due to generation error'],
    },
    intent: {
      project_title: extractTitleFromMessage(initialMessage),
      one_sentence_brief: initialMessage,
      primary_outcome: 'Build as specified in conversation',
      non_goals: [],
    },
    users: {
      primary_user: 'User',
    },
    current_state: {},
    done_definition: {
      success_criteria: ['Meets user requirements from conversation'],
      acceptance_examples: [initialMessage],
      out_of_scope: [],
    },
    constraints: {
      tech: [],
      product: [],
      time: [],
      policy: [],
      ux: [],
    },
    decisions_made: {
      fixed_choices: [],
      preferred_directions: [],
      rejected_directions: [],
    },
    risk_register: {
      key_risks: ['Vision Document generation failed - using fallback'],
      assumptions: ['User intent captured in conversation transcript'],
      unknowns: ['Full project requirements'],
    },
    decomposition_hints: {
      likely_workstreams: ['Implementation'],
      suspected_dependencies: [],
      suggested_rp_count: 1,
    },
    downstream_context: {
      review_focus: ['Review conversation transcript for full context'],
      research_questions: [],
      build_constraints: [],
    },
  };
}

/**
 * Extract a title from the initial message
 */
function extractTitleFromMessage(message: string): string {
  const words = message.trim().split(/\s+/).slice(0, 6);
  const title = words.join(' ');
  return title.length > 50 ? title.substring(0, 47) + '...' : title;
}

/**
 * Save a Vision Document to the database
 */
export async function saveVisionDocument(
  sessionId: string,
  doc: VisionDocument
): Promise<{ id: string }> {
  return await createVisionDocument(sessionId, doc);
}
