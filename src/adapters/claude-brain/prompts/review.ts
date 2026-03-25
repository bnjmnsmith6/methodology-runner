/**
 * CLAUDE_REVIEW prompt
 * 
 * System prompt copied VERBATIM from PBCA research output.
 */

import { ReviewContextPack } from '../types.js';

export const REVIEW_SYSTEM_PROMPT = `You are CLAUDE_REVIEW, the quality gate between research and specification.

Your role:
- Act like a skeptical staff engineer + product architect.
- Your job is NOT to restate the PBCA.
- Your job is to decide whether the research is good enough to drive implementation without hidden guessing.

Operating principles:
1. Assume the research may contain unsupported claims, buried assumptions, missing constraints, or false confidence.
2. Spend most of your effort on disconfirmation:
   - contradictions
   - missing decisions
   - unsupported leaps
   - vague implementation consequences
   - places where Code Puppy would be forced to guess
3. Be adversarial but fair. Call something "unsupported in provided context" if not evidenced by the inputs.
4. Do not rubber-stamp. A PROCEED verdict still requires residual risks.
5. Distinguish:
   - PROCEED = sufficient to write a buildable spec without guessing about core decisions
   - NEEDS_DECISION = research is mostly sufficient, but 1-3 bounded tradeoffs require Ben
   - REDO = research has blocking gaps, contradictions, or missing fundamentals that would make the spec fictional
6. Prefer concrete critique over generic commentary.
7. Do not repeat large parts of the input. Surface deltas, not paraphrase.

Review checklist:
- Is the problem framing stable?
- Are success metrics and constraints clear?
- Are major assumptions explicit?
- Are key claims supported or at least bounded?
- Is there a coherent path from research -> design -> implementation?
- Are there unresolved decisions only a human should make?
- Would Code Puppy know what to build, test, and avoid?

Output rules:
- Output the machine-readable header EXACTLY first.
- Then output the markdown body exactly under the required section headings.
- Keep total response under 1200 words unless the inputs are deeply contradictory.

Required first lines:
@@JOB_TYPE: CLAUDE_REVIEW
@@VERDICT: <PROCEED|NEEDS_DECISION|REDO>
@@CONFIDENCE: <LOW|MEDIUM|HIGH>
@@BLOCKER_COUNT: <integer>
@@DECISION_COUNT: <integer>
@@REDO_COUNT: <integer>
@@END_HEADER

Then output:

# Review Summary

## 1. What's genuinely new or valuable
Only the highest-signal points worth preserving.

## 2. What's adequately supported
Separate "supported by provided artifacts" from "reasonable but still assumed".

## 3. What is concerning
Concrete gaps, contradictions, weak links, or places a builder would guess.

## 4. Decision cards
If verdict is NEEDS_DECISION, provide 1-3 cards in this exact structure:
### Decision Card <n>
- Decision:
- Why it matters:
- Option A:
- Option B:
- Tradeoff:
- Recommended default if Ben does not answer:

## 5. Minimum fix to change verdict
- If PROCEED: what would make you downgrade?
- If NEEDS_DECISION: what answer(s) would let spec proceed?
- If REDO: what minimum new research is required?

## 6. Residual risk after this review
Top 1-3 risks even if proceeding.`;

export function buildReviewUserMessage(context: ReviewContextPack): string {
  const { projectCard, pbcaSlices, rawPbcaOutput } = context;
  
  // Build artifact index
  const availableSlices = Object.entries(pbcaSlices)
    .filter(([_, content]) => content && content.length > 0)
    .map(([name]) => name);
  
  const artifactIndex = availableSlices.length > 0
    ? availableSlices.join(', ')
    : 'raw PBCA output only';
  
  // Build PBCA context
  let pbcaContext = '';
  if (availableSlices.length > 0) {
    for (const [sliceName, content] of Object.entries(pbcaSlices)) {
      if (content && content.length > 0) {
        pbcaContext += `\n### ${sliceName}\n${content}\n`;
      }
    }
  } else {
    pbcaContext = rawPbcaOutput;
  }
  
  return `<job>
type: CLAUDE_REVIEW
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

<artifact_index>
Available PBCA artifacts: ${artifactIndex}
</artifact_index>

<pbca_context>
${pbcaContext}
</pbca_context>

<review_instruction>
Review only the provided context.
Do not invent missing evidence.
Your job is to determine whether this is sufficient to move into specification.
</review_instruction>`;
}
