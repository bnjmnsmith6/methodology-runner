/**
 * Vision Document Renderer
 * 
 * Renders Vision Documents as human-readable summaries and markdown
 */

import { VisionDocument } from '../types/vision.js';

/**
 * Render a short summary for chat display (3-5 lines)
 */
export function renderShortSummary(doc: VisionDocument): string {
  const lines: string[] = [];
  
  // Project title
  lines.push(`📋 **Project:** ${doc.intent.project_title}`);
  
  // Goal
  lines.push(`🎯 **Goal:** ${doc.intent.one_sentence_brief || doc.intent.primary_outcome}`);
  
  // User
  if (doc.users?.primary_user) {
    lines.push(`👤 **For:** ${doc.users.primary_user}`);
  }
  
  // Success criteria (first 2)
  if (doc.done_definition.success_criteria.length > 0) {
    const criteria = doc.done_definition.success_criteria.slice(0, 2);
    lines.push(`✅ **Done when:** ${criteria.join('; ')}`);
  }
  
  // Key risk (first one)
  if (doc.risk_register.key_risks && doc.risk_register.key_risks.length > 0) {
    lines.push(`⚠️  **Key risk:** ${doc.risk_register.key_risks[0]}`);
  }
  
  return lines.join('\n');
}

/**
 * Render the full Vision Document as markdown
 */
export function renderFullMarkdown(doc: VisionDocument): string {
  const sections: string[] = [];
  
  // Header
  sections.push(`# Vision Document: ${doc.intent.project_title}`);
  sections.push('');
  sections.push(`**Version:** ${doc.version}`);
  sections.push(`**Status:** ${doc.status}`);
  sections.push(`**Path:** ${doc.classification.path}`);
  sections.push(`**Complexity:** ${doc.classification.complexity}`);
  sections.push(`**Confidence:** ${(doc.confidence || 0) * 100}%`);
  sections.push('');
  
  // Source
  sections.push('## Source');
  sections.push('');
  sections.push(`**Initial Request:**`);
  sections.push(`> ${doc.source.initial_user_message}`);
  sections.push('');
  sections.push(`**Conversation Summary:**`);
  sections.push(doc.source.conversation_summary);
  sections.push('');
  
  // Intent
  sections.push('## Intent');
  sections.push('');
  sections.push(`**Brief:** ${doc.intent.one_sentence_brief || doc.intent.primary_outcome}`);
  sections.push('');
  if (doc.intent.job_story) {
    sections.push(`**Job Story:** ${doc.intent.job_story}`);
    sections.push('');
  }
  sections.push(`**Primary Outcome:** ${doc.intent.primary_outcome}`);
  sections.push('');
  if (doc.intent.non_goals && doc.intent.non_goals.length > 0) {
    sections.push('**Non-Goals:**');
    doc.intent.non_goals.forEach(ng => sections.push(`- ${ng}`));
    sections.push('');
  }
  
  // Users
  sections.push('## Users');
  sections.push('');
  if (doc.users?.primary_user) {
    sections.push(`**Primary User:** ${doc.users.primary_user}`);
  }
  if (doc.users?.secondary_users && doc.users.secondary_users.length > 0) {
    sections.push(`**Secondary Users:** ${doc.users.secondary_users.join(', ')}`);
  }
  if (doc.users?.stakeholders && doc.users.stakeholders.length > 0) {
    sections.push(`**Stakeholders:** ${doc.users.stakeholders.join(', ')}`);
  }
  sections.push('');
  
  // Current State
  if (doc.current_state?.what_exists_now || 
      (doc.current_state?.pain_points && doc.current_state.pain_points.length > 0)) {
    sections.push('## Current State');
    sections.push('');
    if (doc.current_state.what_exists_now) {
      sections.push(`**What Exists Now:** ${doc.current_state.what_exists_now}`);
      sections.push('');
    }
    if (doc.current_state.pain_points && doc.current_state.pain_points.length > 0) {
      sections.push('**Pain Points:**');
      doc.current_state.pain_points.forEach(pp => sections.push(`- ${pp}`));
      sections.push('');
    }
    if (doc.current_state.replaced_systems && doc.current_state.replaced_systems.length > 0) {
      sections.push('**Replaced Systems:**');
      doc.current_state.replaced_systems.forEach(rs => sections.push(`- ${rs}`));
      sections.push('');
    }
  }
  
  // Definition of Done
  sections.push('## Definition of Done');
  sections.push('');
  sections.push('**Success Criteria:**');
  doc.done_definition.success_criteria.forEach(sc => sections.push(`- ${sc}`));
  sections.push('');
  if (doc.done_definition.acceptance_examples.length > 0) {
    sections.push('**Acceptance Examples:**');
    doc.done_definition.acceptance_examples.forEach(ae => sections.push(`- ${ae}`));
    sections.push('');
  }
  if (doc.done_definition.out_of_scope.length > 0) {
    sections.push('**Out of Scope:**');
    doc.done_definition.out_of_scope.forEach(oos => sections.push(`- ${oos}`));
    sections.push('');
  }
  
  // Constraints
  const hasConstraints = 
    doc.constraints.tech.length > 0 ||
    doc.constraints.product.length > 0 ||
    doc.constraints.time.length > 0 ||
    doc.constraints.policy.length > 0 ||
    doc.constraints.ux.length > 0;
  
  if (hasConstraints) {
    sections.push('## Constraints');
    sections.push('');
    if (doc.constraints.tech.length > 0) {
      sections.push('**Technical:**');
      doc.constraints.tech.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
    if (doc.constraints.product.length > 0) {
      sections.push('**Product:**');
      doc.constraints.product.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
    if (doc.constraints.time.length > 0) {
      sections.push('**Time:**');
      doc.constraints.time.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
    if (doc.constraints.policy.length > 0) {
      sections.push('**Policy:**');
      doc.constraints.policy.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
    if (doc.constraints.ux.length > 0) {
      sections.push('**UX:**');
      doc.constraints.ux.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
  }
  
  // Decisions Made
  const hasDecisions =
    doc.decisions_made.fixed_choices.length > 0 ||
    doc.decisions_made.preferred_directions.length > 0 ||
    doc.decisions_made.rejected_directions.length > 0;
  
  if (hasDecisions) {
    sections.push('## Decisions Made');
    sections.push('');
    if (doc.decisions_made.fixed_choices.length > 0) {
      sections.push('**Fixed Choices:**');
      doc.decisions_made.fixed_choices.forEach(fc => sections.push(`- ${fc}`));
      sections.push('');
    }
    if (doc.decisions_made.preferred_directions.length > 0) {
      sections.push('**Preferred Directions:**');
      doc.decisions_made.preferred_directions.forEach(pd => sections.push(`- ${pd}`));
      sections.push('');
    }
    if (doc.decisions_made.rejected_directions.length > 0) {
      sections.push('**Rejected Directions:**');
      doc.decisions_made.rejected_directions.forEach(rd => sections.push(`- ${rd}`));
      sections.push('');
    }
  }
  
  // Risk Register
  sections.push('## Risk Register');
  sections.push('');
  if (doc.risk_register.key_risks && doc.risk_register.key_risks.length > 0) {
    sections.push('**Key Risks:**');
    doc.risk_register.key_risks.forEach(kr => sections.push(`- ${kr}`));
    sections.push('');
  }
  if (doc.risk_register.assumptions && doc.risk_register.assumptions.length > 0) {
    sections.push('**Assumptions:**');
    doc.risk_register.assumptions.forEach(a => sections.push(`- ${a}`));
    sections.push('');
  }
  if (doc.risk_register.unknowns && doc.risk_register.unknowns.length > 0) {
    sections.push('**Unknowns:**');
    doc.risk_register.unknowns.forEach(u => sections.push(`- ${u}`));
    sections.push('');
  }
  
  // Decomposition Hints
  if (doc.decomposition_hints) {
    sections.push('## Decomposition Hints');
    sections.push('');
    sections.push(`**Suggested RP Count:** ${doc.decomposition_hints.suggested_rp_count}`);
    sections.push('');
    if (doc.decomposition_hints.likely_workstreams.length > 0) {
      sections.push('**Likely Workstreams:**');
      doc.decomposition_hints.likely_workstreams.forEach(lw => sections.push(`- ${lw}`));
      sections.push('');
    }
    if (doc.decomposition_hints.suspected_dependencies && 
        doc.decomposition_hints.suspected_dependencies.length > 0) {
      sections.push('**Suspected Dependencies:**');
      doc.decomposition_hints.suspected_dependencies.forEach(sd => sections.push(`- ${sd}`));
      sections.push('');
    }
  }
  
  // Downstream Context
  if (doc.downstream_context) {
    sections.push('## Downstream Context');
    sections.push('');
    if (doc.downstream_context.review_focus && doc.downstream_context.review_focus.length > 0) {
      sections.push('**Review Focus:**');
      doc.downstream_context.review_focus.forEach(rf => sections.push(`- ${rf}`));
      sections.push('');
    }
    if (doc.downstream_context.research_questions && 
        doc.downstream_context.research_questions.length > 0) {
      sections.push('**Research Questions:**');
      doc.downstream_context.research_questions.forEach(rq => sections.push(`- ${rq}`));
      sections.push('');
    }
    if (doc.downstream_context.build_constraints && 
        doc.downstream_context.build_constraints.length > 0) {
      sections.push('**Build Constraints:**');
      doc.downstream_context.build_constraints.forEach(bc => sections.push(`- ${bc}`));
      sections.push('');
    }
  }
  
  return sections.join('\n');
}
