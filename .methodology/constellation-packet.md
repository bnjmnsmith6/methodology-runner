@@JOB_TYPE: CLAUDE_SPEC
@@SPEC_STATUS: READY
@@CONFIDENCE: MEDIUM
@@OPEN_DECISIONS: 0
@@OPEN_ASSUMPTIONS: 3
@@END_HEADER

# Constellation Packet

## 1. Objective
- **Problem**: Financial systems fail users with ADHD and post-abuse trauma during high-stress periods, leading to abandonment and financial instability
- **Desired outcome**: Research-backed UX safety framework with concrete design guidelines for stress-resilient financial interfaces
- **Success checks**: 
  - Documented failure modes with specific triggers
  - Actionable UX principles with measurable criteria
  - Design guidelines implementable by developers

## 2. In scope / Out of scope

**In scope:**
- ADHD-specific failure modes in financial UX
- Post-abuse behavioral patterns affecting financial decisions
- Stress-driven abandonment triggers and recovery paths
- UX principles for cognitive overload prevention
- Design guidelines for transaction entry, runway visibility, interface simplicity
- Stress-testing scenarios for high-cognitive-load states

**Out of scope:**
- Implementation of actual financial system
- Clinical diagnosis or therapy recommendations
- Legal compliance frameworks
- Integration with existing financial platforms
- Marketing or user acquisition strategies

## 3. Source-of-truth constraints
- Framework must be evidence-based with cited research sources
- Guidelines must be specific enough to inform implementation decisions
- Principles must account for cognitive impairment during crisis states
- Design recommendations must be testable and measurable
- Framework must distinguish between ADHD and trauma-specific needs

## 4. Architecture and flow
- **Research Phase**: Literature review → User pattern analysis → Failure mode documentation
- **Framework Phase**: Principle extraction → Guideline formulation → Testing criteria definition
- **Validation Phase**: Scenario mapping → Stress-case validation → Implementation guidance
- **Deliverable**: Structured markdown framework with implementation checklist

## 5. Contracts and invariants
- **Input**: Research sources, behavioral studies, UX failure case studies
- **Output**: Structured framework document with:
  - Categorized failure modes (ADHD vs trauma vs stress)
  - Ranked UX principles with implementation criteria
  - Component-specific design guidelines (transaction entry, runway display, navigation)
  - Stress-testing scenarios with pass/fail criteria
- **Invariant**: Every guideline must include both the principle and measurable implementation criteria

## 6. File-by-file implementation plan

**behavioral_research_framework.md**
- Purpose: Main framework document
- Structure: Executive summary, research findings, principles, guidelines, testing scenarios
- Key sections: Failure modes taxonomy, UX safety principles, implementation checklist

**research_sources.md**
- Purpose: Consolidated bibliography and source material
- Content: Categorized research citations with relevance notes
- Format: Structured references with applicability tags

**implementation_checklist.md**
- Purpose: Developer-facing validation tool
- Content: Step-by-step implementation verification
- Format: Checkbox list with acceptance criteria

**stress_scenarios.md**
- Purpose: Testing scenarios for high-stress usability
- Content: Realistic user scenarios with expected failure points
- Format: Scenario descriptions with testing protocols

## 7. Build order
1. Research gathering and source compilation
2. Failure mode analysis and categorization
3. UX principle extraction and ranking
4. Design guideline formulation with criteria
5. Stress scenario development
6. Implementation checklist creation
7. Framework validation against scenarios
8. Final documentation assembly

## 8. Acceptance tests
- Framework includes minimum 15 documented failure modes across ADHD/trauma/stress categories
- Each UX principle has measurable implementation criteria
- Design guidelines cover transaction entry, runway visibility, and navigation simplicity
- Stress scenarios include realistic high-cognitive-load situations
- Implementation checklist enables binary pass/fail validation
- All recommendations traceable to research sources

## 9. Risks, assumptions, and rollback
**Assumptions:**
- Research literature sufficient for evidence-based recommendations
- ADHD and trauma patterns distinguishable in financial contexts
- Stress-resilient design principles generalizable across financial tasks

**Risks:**
- Limited research on intersection of ADHD, trauma, and financial UX
- Framework too abstract for practical implementation
- Guidelines conflict with standard financial UX patterns

**Rollback:** If research insufficient, pivot to expert interview framework and preliminary guidelines pending future research validation.

## 10. Escalate instead of guessing
- If research reveals conflicting evidence on ADHD vs trauma patterns → STOP_AND_ASK for prioritization
- If stress-resilient principles conflict with accessibility standards → STOP_AND_ASK for resolution approach
- If implementation criteria cannot be made measurable → STOP_AND_ASK for validation approach
- If framework scope grows beyond individual contributor capacity → STOP_AND_ASK for resource allocation