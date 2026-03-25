/**
 * Context Pack Builder
 * 
 * Slices Vision Documents into role-specific context packs for downstream agents
 */

import { VisionDocument, ContextPack, ContextConsumer, RPProposal } from '../types/vision.js';

/**
 * Build a context pack for a specific consumer and RP
 */
export function buildContextPack(
  consumer: ContextConsumer,
  visionDoc: VisionDocument,
  rpProposal?: RPProposal,
  projectId: string = '',
  rpId: string = ''
): ContextPack {
  const projectSummary = visionDoc.intent.one_sentence_brief || visionDoc.intent.primary_outcome;
  const rpObjective = rpProposal?.description || visionDoc.intent.project_title;

  switch (consumer) {
    case 'pbca':
      return buildPBCAContext(visionDoc, rpProposal, projectSummary, rpObjective, projectId, rpId);
    
    case 'review':
      return buildReviewContext(visionDoc, rpProposal, projectSummary, rpObjective, projectId, rpId);
    
    case 'spec':
      return buildSpecContext(visionDoc, rpProposal, projectSummary, rpObjective, projectId, rpId);
    
    case 'build':
      return buildBuildContext(visionDoc, rpProposal, projectSummary, rpObjective, projectId, rpId);
    
    default:
      throw new Error(`Unknown context consumer: ${consumer}`);
  }
}

/**
 * Build PBCA (research) context pack
 * Focus: assumptions to validate, research questions, constraints
 */
function buildPBCAContext(
  visionDoc: VisionDocument,
  rpProposal: RPProposal | undefined,
  projectSummary: string,
  rpObjective: string,
  projectId: string,
  rpId: string
): ContextPack {
  // Gather research questions
  const openQuestions: string[] = [];
  
  if (visionDoc.risk_register.unknowns) {
    openQuestions.push(...visionDoc.risk_register.unknowns);
  }
  
  if (rpProposal?.pbca_focus) {
    openQuestions.push(...rpProposal.pbca_focus);
  }
  
  // Gather all constraints
  const constraints: string[] = [];
  if (visionDoc.constraints.tech) constraints.push(...visionDoc.constraints.tech);
  if (visionDoc.constraints.product) constraints.push(...visionDoc.constraints.product);
  if (visionDoc.constraints.policy) constraints.push(...visionDoc.constraints.policy);
  
  // Dependencies as strings
  const dependencies = rpProposal?.dependencies.map(
    d => `${d.rpTitle}: ${d.reason}`
  ) || [];
  
  // Non-goals
  const nonGoals: string[] = [];
  if (visionDoc.intent.non_goals) nonGoals.push(...visionDoc.intent.non_goals);
  if (visionDoc.done_definition.out_of_scope) nonGoals.push(...visionDoc.done_definition.out_of_scope);
  
  return {
    project_id: projectId,
    rp_id: rpId,
    consumer: 'pbca',
    payload: {
      projectSummary,
      rpObjective,
      relevantConstraints: constraints,
      acceptanceCriteria: visionDoc.done_definition.success_criteria || [],
      assumptions: visionDoc.risk_register.assumptions || [],
      dependencies,
      nonGoals,
      openQuestions,
    },
  };
}

/**
 * Build Review context pack
 * Focus: decisions to validate, risks to challenge, fixed choices
 */
function buildReviewContext(
  visionDoc: VisionDocument,
  rpProposal: RPProposal | undefined,
  projectSummary: string,
  rpObjective: string,
  projectId: string,
  rpId: string
): ContextPack {
  // Constraints = decisions and fixed choices
  const constraints: string[] = [];
  if (visionDoc.decisions_made.fixed_choices) {
    constraints.push(...visionDoc.decisions_made.fixed_choices);
  }
  if (visionDoc.decisions_made.rejected_directions) {
    constraints.push(...visionDoc.decisions_made.rejected_directions.map(r => `Rejected: ${r}`));
  }
  
  // Dependencies
  const dependencies = rpProposal?.dependencies.map(
    d => `${d.rpTitle}: ${d.reason}`
  ) || [];
  
  // Non-goals
  const nonGoals: string[] = [];
  if (visionDoc.intent.non_goals) nonGoals.push(...visionDoc.intent.non_goals);
  if (visionDoc.done_definition.out_of_scope) nonGoals.push(...visionDoc.done_definition.out_of_scope);
  
  // Review-specific focus areas
  const openQuestions = visionDoc.downstream_context?.review_focus || [];
  
  return {
    project_id: projectId,
    rp_id: rpId,
    consumer: 'review',
    payload: {
      projectSummary,
      rpObjective,
      relevantConstraints: constraints,
      acceptanceCriteria: visionDoc.done_definition.success_criteria || [],
      assumptions: visionDoc.risk_register.assumptions || [],
      dependencies,
      nonGoals,
      openQuestions,
    },
  };
}

/**
 * Build Spec context pack
 * Focus: acceptance criteria, examples, tech constraints, interface contracts
 */
function buildSpecContext(
  visionDoc: VisionDocument,
  rpProposal: RPProposal | undefined,
  projectSummary: string,
  rpObjective: string,
  projectId: string,
  rpId: string
): ContextPack {
  // Tech constraints only
  const constraints = visionDoc.constraints.tech || [];
  
  // Acceptance criteria + examples
  const acceptanceCriteria: string[] = [];
  if (visionDoc.done_definition.success_criteria) {
    acceptanceCriteria.push(...visionDoc.done_definition.success_criteria);
  }
  if (visionDoc.done_definition.acceptance_examples) {
    acceptanceCriteria.push(
      ...visionDoc.done_definition.acceptance_examples.map(ex => `Example: ${ex}`)
    );
  }
  
  // Only confirmed decisions (not assumptions)
  const assumptions = visionDoc.decisions_made.fixed_choices || [];
  
  // Dependencies with interface hints
  const dependencies = rpProposal?.dependencies.map(
    d => `${d.rpTitle}: ${d.reason}`
  ) || [];
  
  // Out of scope
  const nonGoals = visionDoc.done_definition.out_of_scope || [];
  
  // No open questions for spec (should be resolved)
  const openQuestions: string[] = [];
  
  return {
    project_id: projectId,
    rp_id: rpId,
    consumer: 'spec',
    payload: {
      projectSummary,
      rpObjective,
      relevantConstraints: constraints,
      acceptanceCriteria,
      assumptions,
      dependencies,
      nonGoals,
      openQuestions,
    },
  };
}

/**
 * Build Code (build) context pack
 * Focus: only concrete implementation requirements
 */
function buildBuildContext(
  visionDoc: VisionDocument,
  rpProposal: RPProposal | undefined,
  projectSummary: string,
  rpObjective: string,
  projectId: string,
  rpId: string
): ContextPack {
  // Only tech constraints
  const constraints = visionDoc.constraints.tech || [];
  
  // Only testable criteria
  const acceptanceCriteria = visionDoc.done_definition.success_criteria.filter(
    c => c.toLowerCase().includes('should') || 
         c.toLowerCase().includes('must') ||
         c.toLowerCase().includes('when') ||
         c.toLowerCase().includes('test')
  );
  
  // No assumptions (build from spec, not assumptions)
  const assumptions: string[] = [];
  
  // Dependencies in concrete terms
  const dependencies = rpProposal?.dependencies.map(
    d => `Depends on: ${d.rpTitle}`
  ) || [];
  
  // Out of scope
  const nonGoals = visionDoc.done_definition.out_of_scope || [];
  
  // No open questions for build
  const openQuestions: string[] = [];
  
  return {
    project_id: projectId,
    rp_id: rpId,
    consumer: 'build',
    payload: {
      projectSummary,
      rpObjective,
      relevantConstraints: constraints,
      acceptanceCriteria,
      assumptions,
      dependencies,
      nonGoals,
      openQuestions,
    },
  };
}
