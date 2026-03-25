/**
 * Decompose module exports
 */

export { proposeRPDecomposition } from './proposeRPs.js';
export { validateTierAssignments } from './assignTier.js';
export { validateDependencyGraph, getBuildOrder } from './detectDependencies.js';
export { formatDecompositionForUser, formatDecompositionSummary } from './explainDecomposition.js';
export { decomposeProject } from './decomposeProject.js';
export type { DecompositionResult } from './decomposeProject.js';
export { 
  saveDecomposition, 
  getDecomposition, 
  updateDecompositionStatus 
} from './persistDecomposition.js';
