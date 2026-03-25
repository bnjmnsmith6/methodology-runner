/**
 * Self-Grading Module
 * 
 * LLM-based quality assessment for pipeline step outputs
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface StepGrade {
  score: number;           // 1-5
  reasons: string[];       // what was good/bad
  rubricVersion: string;   // for tracking rubric changes
}

const GRADING_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 200;  // Keep grading cheap

/**
 * Grade a PBCA research output
 */
export async function gradePBCAOutput(
  rpTitle: string,
  rpDescription: string,
  pbcaOutput: string
): Promise<StepGrade> {
  const rubricVersion = 'pbca-v1';
  
  const prompt = `You are grading PBCA research output quality.

RP Title: ${rpTitle}
RP Description: ${rpDescription}

PBCA Research Output:
${pbcaOutput.slice(0, 3000)}

Rate this research output 1-5:
5: Specific to the RP, covers edge cases, identifies real risks, actionable recommendations
4: Good coverage, mostly specific, minor gaps
3: Generic but correct, missing RP-specific insights
2: Shallow, mostly restating the prompt
1: Wrong, irrelevant, or harmful

Respond with JSON: {"score": N, "reasons": ["reason1", "reason2"]}`;

  try {
    const response = await anthropic.messages.create({
      model: GRADING_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);
    
    return {
      score: result.score,
      reasons: result.reasons,
      rubricVersion,
    };
  } catch (error) {
    console.error('   ❌ Failed to grade PBCA output:', error);
    // Return neutral grade on error
    return {
      score: 3,
      reasons: ['Grading failed'],
      rubricVersion,
    };
  }
}

/**
 * Grade a Claude Review output
 */
export async function gradeReviewOutput(
  pbcaOutput: string,
  reviewOutput: string
): Promise<StepGrade> {
  const rubricVersion = 'review-v1';
  
  const prompt = `You are grading a Claude review of PBCA research.

PBCA Research (context):
${pbcaOutput.slice(0, 2000)}

Review Output:
${reviewOutput.slice(0, 3000)}

Rate this review 1-5:
5: Found real issues, specific blockers, useful decisions, didn't rubber-stamp
4: Good catches, some useful decisions
3: Surface-level review, didn't add much
2: Rubber-stamped or asked unnecessary questions
1: Wrong verdict or missed critical issues

Respond with JSON: {"score": N, "reasons": ["reason1", "reason2"]}`;

  try {
    const response = await anthropic.messages.create({
      model: GRADING_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);
    
    return {
      score: result.score,
      reasons: result.reasons,
      rubricVersion,
    };
  } catch (error) {
    console.error('   ❌ Failed to grade review output:', error);
    return {
      score: 3,
      reasons: ['Grading failed'],
      rubricVersion,
    };
  }
}

/**
 * Grade a Claude Spec output
 */
export async function gradeSpecOutput(
  reviewOutput: string,
  specOutput: string,
  visionDoc?: any
): Promise<StepGrade> {
  const rubricVersion = 'spec-v1';
  
  const prompt = `You are grading a specification document.

Review Output (context):
${reviewOutput.slice(0, 2000)}

Specification:
${specOutput.slice(0, 3000)}

Rate this spec 1-5:
5: Complete file-by-file plan, clear acceptance criteria, addresses review feedback
4: Good structure, mostly actionable
3: Generic template, missing specifics
2: Vague, not implementable
1: Wrong approach or missing critical requirements

Respond with JSON: {"score": N, "reasons": ["reason1", "reason2"]}`;

  try {
    const response = await anthropic.messages.create({
      model: GRADING_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);
    
    return {
      score: result.score,
      reasons: result.reasons,
      rubricVersion,
    };
  } catch (error) {
    console.error('   ❌ Failed to grade spec output:', error);
    return {
      score: 3,
      reasons: ['Grading failed'],
      rubricVersion,
    };
  }
}

/**
 * Grade a build output
 */
export async function gradeBuildOutput(
  specOutput: string,
  buildResult: any
): Promise<StepGrade> {
  const rubricVersion = 'build-v1';
  
  const buildSummary = JSON.stringify(buildResult, null, 2).slice(0, 2000);
  
  const prompt = `You are grading a build output against its specification.

Specification:
${specOutput.slice(0, 2000)}

Build Result:
${buildSummary}

Rate this build 1-5:
5: All acceptance criteria met, tests pass, clean code, matches spec
4: Most criteria met, minor issues
3: Partially works, significant gaps
2: Doesn't match spec, major issues
1: Broken or wrong

Respond with JSON: {"score": N, "reasons": ["reason1", "reason2"]}`;

  try {
    const response = await anthropic.messages.create({
      model: GRADING_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);
    
    return {
      score: result.score,
      reasons: result.reasons,
      rubricVersion,
    };
  } catch (error) {
    console.error('   ❌ Failed to grade build output:', error);
    return {
      score: 3,
      reasons: ['Grading failed'],
      rubricVersion,
    };
  }
}

/**
 * Compute overall grade from step grades
 */
export function computeOverallGrade(stepGrades: Record<string, number>): number {
  const values = Object.values(stepGrades);
  if (values.length === 0) return 0;
  
  return values.reduce((sum, grade) => sum + grade, 0) / values.length;
}

/**
 * Grade cost estimate
 * Each grade costs ~$0.01-0.02 (200 tokens @ Sonnet pricing)
 */
export function estimateGradingCost(numSteps: number): number {
  const COST_PER_GRADE = 0.015; // $0.015 per grade
  return numSteps * COST_PER_GRADE;
}
