/**
 * Dependency Graph Validator
 * 
 * Validates dependency graphs and performs topological sort
 */

import { RPProposal } from '../types/vision.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate the dependency graph for cycles and invalid references
 */
export function validateDependencyGraph(proposals: RPProposal[]): ValidationResult {
  const errors: string[] = [];
  const titles = proposals.map(p => p.title);
  
  // Check for invalid references
  proposals.forEach(proposal => {
    proposal.dependencies.forEach(dep => {
      if (!titles.includes(dep.rpTitle)) {
        errors.push(`"${proposal.title}" depends on non-existent RP: "${dep.rpTitle}"`);
      }
    });
  });
  
  // Check for cycles using DFS
  const hasCycle = detectCycle(proposals);
  if (hasCycle) {
    errors.push('Dependency graph contains a cycle');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect cycles in the dependency graph using DFS
 */
function detectCycle(proposals: RPProposal[]): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  // Build adjacency list
  const graph = new Map<string, string[]>();
  proposals.forEach(p => {
    graph.set(p.title, p.dependencies.map(d => d.rpTitle));
  });
  
  // DFS from each node
  for (const proposal of proposals) {
    if (!visited.has(proposal.title)) {
      if (dfs(proposal.title, graph, visited, recursionStack)) {
        return true; // Cycle detected
      }
    }
  }
  
  return false;
}

/**
 * DFS helper for cycle detection
 */
function dfs(
  node: string,
  graph: Map<string, string[]>,
  visited: Set<string>,
  recursionStack: Set<string>
): boolean {
  visited.add(node);
  recursionStack.add(node);
  
  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    if (!visited.has(neighbor)) {
      if (dfs(neighbor, graph, visited, recursionStack)) {
        return true;
      }
    } else if (recursionStack.has(neighbor)) {
      return true; // Back edge = cycle
    }
  }
  
  recursionStack.delete(node);
  return false;
}

/**
 * Get the build order using topological sort
 */
export function getBuildOrder(proposals: RPProposal[]): string[] {
  // Build adjacency list and in-degree map
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  
  // Initialize
  proposals.forEach(p => {
    graph.set(p.title, []);
    inDegree.set(p.title, 0);
  });
  
  // Build graph
  proposals.forEach(p => {
    p.dependencies.forEach(dep => {
      const neighbors = graph.get(dep.rpTitle) || [];
      neighbors.push(p.title);
      graph.set(dep.rpTitle, neighbors);
      
      inDegree.set(p.title, (inDegree.get(p.title) || 0) + 1);
    });
  });
  
  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  const result: string[] = [];
  
  // Add all nodes with in-degree 0
  inDegree.forEach((degree, node) => {
    if (degree === 0) {
      queue.push(node);
    }
  });
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    
    const neighbors = graph.get(node) || [];
    neighbors.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  // If result doesn't include all nodes, there's a cycle
  if (result.length !== proposals.length) {
    console.error('   ⚠️  Topological sort failed (cycle detected)');
    // Fallback: return titles in original order
    return proposals.map(p => p.title);
  }
  
  return result;
}
