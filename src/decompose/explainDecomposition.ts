/**
 * Decomposition Explainer
 * 
 * Generates user-facing explanations of the decomposition
 */

import { RPProposal } from '../types/vision.js';

/**
 * Format decomposition for user display
 */
export function formatDecompositionForUser(
  proposals: RPProposal[],
  explanation: string,
  buildOrder: string[]
): string {
  const parts: string[] = [];
  
  // Header
  if (proposals.length === 1) {
    parts.push('This is a single focused piece of work:');
  } else {
    parts.push(`I've broken this into ${proposals.length} parts:`);
  }
  
  parts.push('');
  
  // List each RP
  proposals.forEach((proposal, index) => {
    const number = index + 1;
    const tierLabel = getTierLabel(proposal.tier);
    const title = `**${proposal.title}**`;
    
    parts.push(`${number}. ${title} (${tierLabel}) — ${extractFirstSentence(proposal.description)}`);
    
    // Show dependencies if any
    if (proposal.dependencies.length > 0) {
      const depTitles = proposal.dependencies.map(d => d.rpTitle).join(', ');
      parts.push(`   *Depends on: ${depTitles}*`);
    }
  });
  
  parts.push('');
  
  // Build order if more than one RP
  if (proposals.length > 1) {
    parts.push(`**Build order:** ${buildOrder.join(' → ')}`);
    parts.push('');
  }
  
  // Explanation
  parts.push(explanation);
  
  return parts.join('\n');
}

/**
 * Get human-readable tier label
 */
function getTierLabel(tier: number): string {
  switch (tier) {
    case 1:
      return 'Tier 1: Simple';
    case 2:
      return 'Tier 2: Standard';
    case 3:
      return 'Tier 3: Complex';
    default:
      return `Tier ${tier}`;
  }
}

/**
 * Extract first sentence from description
 */
function extractFirstSentence(description: string): string {
  const match = description.match(/^[^.!?]+[.!?]/);
  if (match) {
    return match[0];
  }
  
  // Fallback: first 80 characters
  if (description.length > 80) {
    return description.substring(0, 77) + '...';
  }
  
  return description;
}

/**
 * Generate a compact summary for logging/debugging
 */
export function formatDecompositionSummary(proposals: RPProposal[]): string {
  const lines = proposals.map(p => {
    const deps = p.dependencies.length > 0 
      ? ` (depends on: ${p.dependencies.map(d => d.rpTitle).join(', ')})`
      : '';
    return `  - ${p.title} [Tier ${p.tier}]${deps}`;
  });
  
  return [
    `Decomposition: ${proposals.length} RPs`,
    ...lines,
  ].join('\n');
}
