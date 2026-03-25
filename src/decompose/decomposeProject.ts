/**
 * Decomposition Orchestrator
 * 
 * Ties together all decomposition components
 */

import { VisionDocument, RPProposal } from '../types/vision.js';
import { proposeRPDecomposition } from './proposeRPs.js';
import { validateTierAssignments } from './assignTier.js';
import { validateDependencyGraph, getBuildOrder } from './detectDependencies.js';
import { formatDecompositionForUser, formatDecompositionSummary } from './explainDecomposition.js';

export interface DecompositionResult {
  proposals: RPProposal[];
  explanation: string;
  buildOrder: string[];
  userSummary: string;  // formatted for display
  validationErrors: string[];
}

/**
 * Decompose a project from its Vision Document
 */
export async function decomposeProject(
  visionDoc: VisionDocument
): Promise<DecompositionResult> {
  console.log('🧩 Decomposing project...');
  
  // Step 1: Propose RPs (may skip LLM for simple projects)
  const { proposals: rawProposals, explanation, suggestedBuildOrder } = 
    await proposeRPDecomposition(visionDoc);
  
  console.log(`   📊 Initial proposal: ${rawProposals.length} RPs`);
  
  // Step 2: Validate and adjust tier assignments
  const proposalsWithValidTiers = validateTierAssignments(rawProposals, visionDoc);
  
  // Step 3: Validate dependency graph
  const validation = validateDependencyGraph(proposalsWithValidTiers);
  
  if (!validation.valid) {
    console.error('   ❌ Dependency validation failed:');
    validation.errors.forEach(err => console.error(`      - ${err}`));
  }
  
  // Step 4: Get build order (topological sort)
  const buildOrder = validation.valid 
    ? getBuildOrder(proposalsWithValidTiers)
    : suggestedBuildOrder;
  
  // Step 5: Format explanation for user
  const userSummary = formatDecompositionForUser(
    proposalsWithValidTiers,
    explanation,
    buildOrder
  );
  
  // Log summary
  console.log('');
  console.log(formatDecompositionSummary(proposalsWithValidTiers));
  console.log('');
  
  return {
    proposals: proposalsWithValidTiers,
    explanation,
    buildOrder,
    userSummary,
    validationErrors: validation.errors,
  };
}
