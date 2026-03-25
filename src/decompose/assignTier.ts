/**
 * Tier Assignment Validator
 * 
 * Validates and potentially overrides LLM's tier assignments based on rules
 */

import { RPProposal, VisionDocument } from '../types/vision.js';

/**
 * Validate and adjust tier assignments based on content analysis
 */
export function validateTierAssignments(
  proposals: RPProposal[],
  visionDoc: VisionDocument
): RPProposal[] {
  return proposals.map(proposal => {
    let tier = proposal.tier;
    const descriptionLower = proposal.description.toLowerCase();
    const titleLower = proposal.title.toLowerCase();
    
    // Rule 1: Auth/security/permissions → Tier 3
    if (tier < 3) {
      const hasAuthSecurity = 
        descriptionLower.includes('auth') ||
        descriptionLower.includes('security') ||
        descriptionLower.includes('permission') ||
        descriptionLower.includes('rbac') ||
        descriptionLower.includes('access control') ||
        titleLower.includes('auth') ||
        titleLower.includes('security');
      
      if (hasAuthSecurity) {
        console.log(`   ⬆️  Upgrading "${proposal.title}" to Tier 3 (auth/security detected)`);
        tier = 3;
      }
    }
    
    // Rule 2: Data migration/schema → At least Tier 2
    if (tier < 2) {
      const hasDataSchema = 
        descriptionLower.includes('data migration') ||
        descriptionLower.includes('database') ||
        descriptionLower.includes('schema') ||
        descriptionLower.includes('migration') ||
        titleLower.includes('database') ||
        titleLower.includes('schema');
      
      if (hasDataSchema) {
        console.log(`   ⬆️  Upgrading "${proposal.title}" to Tier 2 (data/schema detected)`);
        tier = 2;
      }
    }
    
    // Rule 3: Single file with no dependencies → Cap at Tier 1
    if (proposal.dependencies.length === 0) {
      const isSingleFile = 
        descriptionLower.includes('single file') ||
        descriptionLower.includes('one file') ||
        titleLower.match(/\.(js|ts|py|tsx|jsx)$/);
      
      if (isSingleFile && tier > 1) {
        console.log(`   ⬇️  Capping "${proposal.title}" at Tier 1 (single file, no deps)`);
        tier = 1;
      }
    }
    
    // Rule 4: Simple complexity → Cap at Tier 2
    if (visionDoc.classification.complexity === 'simple' && tier > 2) {
      console.log(`   ⬇️  Capping "${proposal.title}" at Tier 2 (simple project)`);
      tier = 2;
    }
    
    return {
      ...proposal,
      tier,
    };
  });
}
