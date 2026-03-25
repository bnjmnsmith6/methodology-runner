/**
 * RP Decomposition Proposer
 * 
 * Uses Claude Sonnet to propose how to split a project into RPs
 */

import { VisionDocument, RPProposal } from '../types/vision.js';
import { callAnthropic } from '../adapters/claude-brain/anthropic-client.js';

export interface DecompositionProposal {
  proposals: RPProposal[];
  explanation: string;
  suggestedBuildOrder: string[];
}

/**
 * Propose RP decomposition from a Vision Document
 */
export async function proposeRPDecomposition(
  visionDoc: VisionDocument
): Promise<DecompositionProposal> {
  console.log('🔀 Proposing RP decomposition...');
  
  // For very simple projects, skip LLM and return single RP
  if (shouldSkipDecomposition(visionDoc)) {
    console.log('   ⚡ Simple project detected — returning single RP');
    return buildSingleRPProposal(visionDoc);
  }
  
  // Build the system prompt
  const systemPrompt = buildDecompositionSystemPrompt();
  
  // Build the user message
  const visionDocJSON = JSON.stringify(visionDoc, null, 2);
  const userMessage = `
Vision Document:
${visionDocJSON}

Propose the RP decomposition.
`.trim();
  
  // Call Claude
  let response: any;
  try {
    const result = await callAnthropic(systemPrompt, userMessage, 2000);
    response = result.text;
  } catch (error) {
    console.error('   ⚠️  Decomposition generation failed:', error);
    // Fallback to single RP
    return buildSingleRPProposal(visionDoc);
  }
  
  // Parse JSON response
  let proposal: DecompositionProposal;
  try {
    proposal = parseDecompositionResponse(response);
  } catch (error) {
    console.error('   ⚠️  JSON parsing failed, returning single RP');
    // Fallback to single RP
    proposal = buildSingleRPProposal(visionDoc);
  }
  
  console.log(`   ✅ Proposed ${proposal.proposals.length} RPs`);
  
  return proposal;
}

/**
 * Determine if we should skip LLM decomposition (simple project)
 */
function shouldSkipDecomposition(doc: VisionDocument): boolean {
  // Fast-path always gets single RP
  if (doc.classification.path === 'fast-path') {
    return true;
  }
  
  // If decomposition hints suggest 1 RP
  if (doc.decomposition_hints?.suggested_rp_count === 1) {
    return true;
  }
  
  // If complexity is simple and no integrations mentioned
  if (doc.classification.complexity === 'simple') {
    const hasIntegrations = doc.downstream_context?.research_questions?.some(
      q => q.toLowerCase().includes('integration') || q.toLowerCase().includes('api')
    );
    if (!hasIntegrations) {
      return true;
    }
  }
  
  return false;
}

/**
 * Build a single-RP proposal for simple projects
 */
function buildSingleRPProposal(doc: VisionDocument): DecompositionProposal {
  const tier = determineSingleRPTier(doc);
  
  const proposal: RPProposal = {
    title: doc.intent.project_title,
    description: buildSingleRPDescription(doc),
    tier,
    dependencies: [],
    rationale: 'Single cohesive unit of work with no natural decomposition boundaries',
    pbca_focus: buildPBCAFocus(doc),
  };
  
  return {
    proposals: [proposal],
    explanation: 'This is a single focused piece of work that doesn\'t benefit from decomposition.',
    suggestedBuildOrder: [proposal.title],
  };
}

/**
 * Determine tier for a single-RP project
 */
function determineSingleRPTier(doc: VisionDocument): 1 | 2 | 3 {
  // Check for tier 3 indicators
  const description = JSON.stringify(doc).toLowerCase();
  if (description.includes('auth') || 
      description.includes('security') ||
      description.includes('permission') ||
      description.includes('database') ||
      description.includes('migration')) {
    return 3;
  }
  
  // Check for tier 2 indicators
  if (doc.classification.complexity === 'complex' ||
      doc.classification.complexity === 'standard') {
    return 2;
  }
  
  // Default to tier 1 for simple
  return 1;
}

/**
 * Build description for single RP
 */
function buildSingleRPDescription(doc: VisionDocument): string {
  const parts: string[] = [];
  
  parts.push(doc.intent.one_sentence_brief || doc.intent.primary_outcome);
  
  if (doc.users?.primary_user) {
    parts.push(`For ${doc.users.primary_user}.`);
  }
  
  if (doc.done_definition.success_criteria.length > 0) {
    const criteria = doc.done_definition.success_criteria.slice(0, 2).join('; ');
    parts.push(`Success criteria: ${criteria}.`);
  }
  
  if (doc.constraints.tech.length > 0) {
    parts.push(`Technical constraints: ${doc.constraints.tech.join(', ')}.`);
  }
  
  return parts.join(' ');
}

/**
 * Build PBCA focus for single RP
 */
function buildPBCAFocus(doc: VisionDocument): string[] {
  const focus: string[] = [];
  
  if (doc.downstream_context?.research_questions) {
    focus.push(...doc.downstream_context.research_questions.slice(0, 3));
  }
  
  if (focus.length === 0) {
    focus.push('Validate technical approach');
    focus.push('Identify edge cases and error scenarios');
    focus.push('Determine testing strategy');
  }
  
  return focus;
}

/**
 * Build the system prompt for decomposition
 */
function buildDecompositionSystemPrompt(): string {
  return `
You are decomposing a project into Research Projects (RPs) — independent units of work that each go through research, review, spec, and build.

Read the Vision Document below and propose how to split this project.

Rules for splitting:
1. Split when work can be independently researched or validated
2. Split when work crosses a system boundary (data layer vs UI vs auth vs integrations)
3. Split when work has a different risk profile
4. Split when work blocks other work through an interface or contract
5. DO NOT split when tasks are tiny and tightly coupled
6. DO NOT split when the same acceptance test governs all of them
7. Default to FEWER RPs. Only split when there's a real boundary.
8. Soft cap: 6 RPs maximum unless the project truly warrants more.

For each RP, provide:
- title: clear, specific name
- description: 2-4 sentences with rich context pulled from the Vision Document. NOT just the user's original words — add relevant constraints, acceptance criteria, and context.
- tier: 1 (simple/bounded), 2 (moderate complexity), or 3 (architecture/security/data-heavy)
- dependencies: array of objects with {rpTitle: string, reason: string} for RPs that must complete first
- rationale: one sentence explaining why this is a separate RP
- pbca_focus: array of 2-3 specific research questions for the PBCA agent

Tier assignment:
- Tier 1: Bounded, reversible, low-risk. Single file or small component. Can be accepted by direct output inspection.
- Tier 2: Moderate ambiguity or integration. Multiple files/components. Some product judgment required.
- Tier 3: Architecture-heavy. Security/privacy/data/permissions. Significant reversibility cost. Needs full research + red-team.

Also provide:
- explanation: 2-3 sentences explaining your decomposition rationale to the user in plain English
- suggestedBuildOrder: array of RP titles in the order they should be built

Return ONLY a valid JSON object:
{
  "proposals": [
    {
      "title": "string",
      "description": "string",
      "tier": 1 | 2 | 3,
      "dependencies": [{"rpTitle": "string", "reason": "string"}],
      "rationale": "string",
      "pbca_focus": ["string"]
    }
  ],
  "explanation": "string",
  "suggestedBuildOrder": ["string"]
}

No markdown code blocks. No explanatory text. Only JSON.
`.trim();
}

/**
 * Parse decomposition response from Claude
 */
function parseDecompositionResponse(responseText: string): DecompositionProposal {
  // Try to find JSON in the response
  let jsonText = responseText.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
  }
  
  // Parse JSON
  const parsed = JSON.parse(jsonText);
  
  // Validate required fields
  if (!parsed.proposals || !Array.isArray(parsed.proposals)) {
    throw new Error('Missing or invalid proposals array');
  }
  
  if (!parsed.explanation || !parsed.suggestedBuildOrder) {
    throw new Error('Missing explanation or suggestedBuildOrder');
  }
  
  // Validate each proposal
  parsed.proposals.forEach((p: any, index: number) => {
    if (!p.title || !p.description || !p.tier) {
      throw new Error(`Proposal ${index} missing required fields`);
    }
    if (p.tier < 1 || p.tier > 3) {
      throw new Error(`Proposal ${index} has invalid tier: ${p.tier}`);
    }
  });
  
  return parsed as DecompositionProposal;
}
