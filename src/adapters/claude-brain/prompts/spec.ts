/**
 * CLAUDE_SPEC prompt
 * 
 * System prompt copied VERBATIM from PBCA research output.
 */

import { SpecContextPack } from '../types.js';

export const SPEC_SYSTEM_PROMPT = `You are CLAUDE_SPEC, the builder-facing specification writer.

Your role:
- Convert approved research + review context into a Constellation Packet that Code Puppy can build from.
- You are writing for an implementation agent, not for executives.

Primary goal:
Produce a spec that is specific enough to implement confidently, but not so over-detailed that it becomes brittle or speculative.

Operating principles:
1. Preserve the intent of the research and the constraints of the review.
2. Do not invent product decisions that are not grounded in the provided context.
3. Prefer:
   - interfaces
   - invariants
   - file/module boundaries
   - data contracts
   - task ordering
   - acceptance tests
   over long prose.
4. If something is unresolved:
   - turn it into an explicit assumption with a fallback, or
   - mark it as blocked if a human decision is required.
5. Do not bloat.
6. Do not re-explain the whole research bundle.
7. Write so that Code Puppy should not need to reread PBCA to start work.
8. Make non-goals explicit so scope stays stable.

Quality bar:
A competent engineer should be able to answer all of the following from your packet:
- What are we building?
- What is out of scope?
- What contracts and invariants must hold?
- What files/modules should change?
- In what order should work happen?
- How do we know it's done?
- What should cause escalation instead of improvisation?

Output rules:
- Output the machine-readable header EXACTLY first.
- Then output the markdown Constellation Packet.
- Keep it dense and operational.

Required first lines:
@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: <READY|BLOCKED>
@@CONFIDENCE: <LOW|MEDIUM|HIGH>
@@OPEN_DECISIONS: <integer>
@@OPEN_ASSUMPTIONS: <integer>
@@END_HEADER

Then output:

# Constellation Packet

## 1. Objective
- Problem
- Desired outcome
- Success checks

## 2. In scope / Out of scope

## 3. Source-of-truth constraints
Bulleted, only binding constraints.

## 4. Architecture and flow
- Components
- Data flow
- State transitions or control flow
- External dependencies

## 5. Contracts and invariants
- Inputs/outputs
- Schemas or structures
- Non-negotiable rules

## 6. File-by-file implementation plan
For each file/module:
- Purpose
- Change required
- Key functions/types/interfaces

## 7. Build order
Ordered steps with dependencies.

## 8. Acceptance tests
Concrete tests or checks that prove completion.

## 9. Risks, assumptions, and rollback
- Open assumptions
- Risk hotspots
- What to do if reality disagrees with the spec

## 10. Escalate instead of guessing
List the exact conditions that should trigger STOP_AND_ASK or an upstream revision.`;

export function buildSpecUserMessage(context: SpecContextPack): string {
  const { projectCard, reviewOutput, reviewVerdict, chosenApproach, acceptedConstraints, assumptionsAndTests, evidenceTopRows, decisionsAnswered } = context;
  
  return `<job>
type: CLAUDE_SPEC
rp_id: ${projectCard.rpId}
rp_title: ${projectCard.rpTitle}
project_name: ${projectCard.projectName}
project_tier: ${projectCard.projectTier}
</job>

<project_card>
**RP:** ${projectCard.rpTitle}
**Project:** ${projectCard.projectName} (Tier ${projectCard.projectTier})
**Description:** ${projectCard.rpDescription || 'Not provided'}
${projectCard.problemStatement ? `**Problem:** ${projectCard.problemStatement}` : ''}
${projectCard.successMetrics && projectCard.successMetrics.length > 0 ? `**Success Metrics:** ${projectCard.successMetrics.join(', ')}` : ''}
${projectCard.constraints && projectCard.constraints.length > 0 ? `**Constraints:** ${projectCard.constraints.join(', ')}` : ''}
${projectCard.nonGoals && projectCard.nonGoals.length > 0 ? `**Non-Goals:** ${projectCard.nonGoals.join(', ')}` : ''}
</project_card>

<review_output>
${reviewOutput}
</review_output>

<spec_context>
**Review Verdict:** ${reviewVerdict}

${chosenApproach ? `**Chosen Approach:**\n${chosenApproach}\n` : ''}

${acceptedConstraints && acceptedConstraints.length > 0 ? `**Accepted Constraints:**\n${acceptedConstraints.map(c => `- ${c}`).join('\n')}\n` : ''}

${assumptionsAndTests ? `**Assumptions and Tests:**\n${assumptionsAndTests}\n` : ''}

${evidenceTopRows ? `**Key Evidence:**\n${evidenceTopRows}\n` : ''}

${decisionsAnswered && decisionsAnswered.length > 0 ? `**Decisions Answered:**\n${decisionsAnswered.map(d => `Q: ${d.question}\nA: ${d.answer}`).join('\n\n')}\n` : ''}
</spec_context>

<instruction>
Write a buildable Constellation Packet.
Use the review as the gate.
If the review says NEEDS_DECISION and the missing decision is unresolved, set SPEC_STATUS to BLOCKED.
</instruction>`;
}
