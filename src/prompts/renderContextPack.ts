/**
 * Context Pack Renderer
 * 
 * Renders context packs as text suitable for prompt injection
 */

import { ContextPack } from '../types/vision.js';

/**
 * Render a context pack as text for prompt injection
 * Skips empty sections to keep output compact
 */
export function renderContextForPrompt(pack: ContextPack): string {
  const sections: string[] = [];
  
  // Project Context
  sections.push('## Project Context');
  sections.push(pack.payload.projectSummary);
  sections.push('');
  
  // This RP's Objective
  sections.push('## This RP\'s Objective');
  sections.push(pack.payload.rpObjective);
  sections.push('');
  
  // Constraints
  if (pack.payload.relevantConstraints.length > 0) {
    sections.push('## Constraints');
    pack.payload.relevantConstraints.forEach(c => sections.push(`- ${c}`));
    sections.push('');
  }
  
  // Acceptance Criteria
  if (pack.payload.acceptanceCriteria.length > 0) {
    sections.push('## Acceptance Criteria');
    pack.payload.acceptanceCriteria.forEach((c, i) => sections.push(`${i + 1}. ${c}`));
    sections.push('');
  }
  
  // Assumptions
  if (pack.payload.assumptions.length > 0) {
    const label = pack.consumer === 'review' 
      ? '## Assumptions (verify or challenge these)'
      : '## Assumptions';
    sections.push(label);
    pack.payload.assumptions.forEach(a => sections.push(`- ${a}`));
    sections.push('');
  }
  
  // Dependencies
  if (pack.payload.dependencies.length > 0) {
    sections.push('## Dependencies');
    pack.payload.dependencies.forEach(d => sections.push(`- ${d}`));
    sections.push('');
  }
  
  // Out of Scope
  if (pack.payload.nonGoals.length > 0) {
    sections.push('## Out of Scope');
    pack.payload.nonGoals.forEach(ng => sections.push(`- ${ng}`));
    sections.push('');
  }
  
  // Open Questions
  if (pack.payload.openQuestions.length > 0) {
    sections.push('## Open Questions');
    pack.payload.openQuestions.forEach(q => sections.push(`- ${q}`));
    sections.push('');
  }
  
  return sections.join('\n');
}
