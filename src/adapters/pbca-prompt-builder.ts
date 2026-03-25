/**
 * PBCA prompt builder
 * 
 * Constructs user prompts for PBCA research following the Methodology Playbook structure.
 */

export interface PbcaPromptInput {
  rpTitle: string;
  rpDescription: string;
  projectName: string;
  projectTier: number;
  projectDescription?: string;
  questionsToAnswer?: string[];
  constraints?: string[];
  stressTestItems?: string[];
  existingArtifacts?: string[];
}

/**
 * Build a structured PBCA user prompt from RP context
 */
export function buildPbcaUserPrompt(input: PbcaPromptInput): string {
  // Generate default questions if not provided
  const questions = input.questionsToAnswer || generateDefaultQuestions(input);

  // Generate default constraints if not provided
  const constraints = input.constraints || generateDefaultConstraints(input);

  // Generate default stress test items if not provided
  const stressTestItems = input.stressTestItems || generateDefaultStressTests(input);

  // Build the prompt
  return `# Research Request: ${input.rpTitle}

## Context

This is part of the **${input.projectName}** project (Tier ${input.projectTier}).

${input.projectDescription ? `**Project Background:** ${input.projectDescription}\n` : ''}
${input.existingArtifacts && input.existingArtifacts.length > 0 ? `**Existing Work:**\n${input.existingArtifacts.map(a => `- ${a}`).join('\n')}\n` : ''}

**This Research Project (RP):** ${input.rpDescription}

---

## The Problem

${input.rpDescription}

**Title:** ${input.rpTitle}

---

## Questions to Answer

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

---

## Constraints

${constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

---

## What to Stress-Test

Failure modes to actively probe:

${stressTestItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

---

## Deliverable Format

Output a **File Bundle** following the RND/ structure:

### Required Files:
1. **RND/00-problem-framing-contract.md** - Problem statement, success metrics, Commander's Intent
2. **RND/01-discovery-brief.md** - 8-phase First-Principles analysis
3. **RND/04-options-matrix.md** - 3+ options with IRAC reasoning for top decisions
4. **RND/06-red-team.md** - 10 failure modes + mitigations + premortem
5. **RND/07-simulation-report.md** - GO/CONDITIONAL GO/NO GO decision with rationale
6. **RND/08-teach-brief.md** - Teaching frame (HOOK → CHECK) with self-test
7. **RND/09-handoff-to-code-puppy.md** - Implementation backlog with top assumptions/decisions

### Format:
\`\`\`
### FILE: RND/[filename].md
[content in fenced markdown]
\`\`\`

---

## What Success Looks Like

- **Clarity:** A developer reading RND/09 can start coding immediately
- **Completeness:** All decision gates (DG1, DG2, DG3) are addressed
- **Rigor:** Critical claims have 2+ defense layers (Swiss Cheese Rule)
- **Honesty:** Assumptions are logged, not laundered as facts
- **Actionability:** Next steps are concrete and testable

Run the full PBCA pipeline. Be thorough, be rigorous, guard against failure modes.
`;
}

/**
 * Generate default questions based on RP context
 */
function generateDefaultQuestions(input: PbcaPromptInput): string[] {
  const tierLevel = input.projectTier === 1 ? 'full rigor' : input.projectTier === 2 ? 'standard' : 'fast track';
  
  return [
    `What is the core problem we're solving with "${input.rpTitle}"?`,
    `What are the fundamental constraints (technical, business, user experience)?`,
    `What approaches exist for solving this? What are 3+ diverse options?`,
    `What assumptions are we making? Which are most critical to validate?`,
    `What could go wrong? What are the top 5 failure modes?`,
    `What's the simplest version that would prove/disprove the approach?`,
    `What would success look like in concrete, measurable terms?`,
    `Given this is a Tier ${input.projectTier} (${tierLevel}) project, what level of validation is appropriate before proceeding?`,
  ];
}

/**
 * Generate default constraints based on project context
 */
function generateDefaultConstraints(input: PbcaPromptInput): string[] {
  return [
    `**Technical:** Must work within the ${input.projectName} architecture`,
    `**Time:** Solution should be implementable within a reasonable timeframe for Tier ${input.projectTier}`,
    `**Maintainability:** Code must be clear, tested, and documented`,
    `**Scope:** Focused on "${input.rpTitle}" - no scope creep`,
    `**Quality:** Must meet acceptance criteria before shipping`,
  ];
}

/**
 * Generate default stress test items (failure modes to probe)
 */
function generateDefaultStressTests(input: PbcaPromptInput): string[] {
  return [
    `**Scope Amnesia** - Are we drifting from the original problem statement?`,
    `**Assumption Burial** - Have we hidden critical assumptions?`,
    `**Premature Closure** - Did we explore 3+ diverse approaches before choosing?`,
    `**Single-Layer Defense** - Do critical claims have backup validation?`,
    `**Handoff Drift** - Can the next person (Code Puppy) actually build this from the spec?`,
    `**Stakeholder Veto** - Is this politically/emotionally feasible?`,
    `**Adoption Blind Spot** - Will users actually adopt this? What behavior change is required?`,
  ];
}
