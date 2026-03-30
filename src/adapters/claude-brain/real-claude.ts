/**
 * Real Claude Brain adapter
 * 
 * Handles CLAUDE_REVIEW, CLAUDE_SPEC, and CLAUDE_DEBUG jobs via Anthropic API.
 */

import { AgentAdapter } from '../interface.js';
import { Job, ExecutionResult, JobType } from '../../core/types.js';
import { ReviewVerdict, SpecStatus, DebugAction, Confidence, Severity } from './types.js';
import { callAnthropic } from './anthropic-client.js';
import { parseHeader, extractMarkdownBody } from './parsers/header-parser.js';
import { extractDecisionCards } from './parsers/decision-cards.js';
import { buildReviewContext } from './context/review-context.js';
import { countJobsByType } from './context/job-context.js';
import { buildSpecContext } from './context/spec-context.js';
import { buildDebugContext } from './context/debug-context.js';
import { buildReviewSystemPrompt, buildReviewUserMessage } from './prompts/review.js';
import { SPEC_SYSTEM_PROMPT, buildSpecUserMessage } from './prompts/spec.js';
import { DEBUG_SYSTEM_PROMPT, buildDebugUserMessage } from './prompts/debug.js';

export class RealClaudeAdapter implements AgentAdapter {
  async execute(job: Job): Promise<ExecutionResult> {
    if (job.type === JobType.CLAUDE_REVIEW) {
      return this.runReview(job);
    } else if (job.type === JobType.CLAUDE_SPEC) {
      return this.runSpec(job);
    } else if (job.type === JobType.CLAUDE_DEBUG) {
      return this.runDebug(job);
    }
    
    return {
      status: 'FAILED',
      error: {
        kind: 'UNSUPPORTED_JOB_TYPE',
        message: `Real Claude adapter does not support job type: ${job.type}`,
        retryable: false,
      },
    };
  }
  
  /**
   * CLAUDE_REVIEW: Review PBCA output
   */
  private async runReview(job: Job): Promise<ExecutionResult> {
    try {
      console.log(`\n🧠 Claude Brain: CLAUDE_REVIEW`);
      console.log(`   RP: ${job.rp_id}`);
      
      console.log(`   📋 Building review context...`);
      const contextPack = await buildReviewContext(job);
      
      // Build user message
      const userMessage = buildReviewUserMessage(contextPack);
      
      // Build tier-aware system prompt
      const projectTier = contextPack.projectCard.projectTier;
      const systemPrompt = buildReviewSystemPrompt(projectTier);
      
      console.log(`   ⚙️  Calling Anthropic API for review (Tier ${projectTier})...`);
      const response = await callAnthropic(systemPrompt, userMessage);
      
      // Parse header
      const header = parseHeader(response.text);
      
      // Handle parse errors
      if ('parseError' in header && header.parseError) {
        console.log(`   ⚠️  Review header could not be parsed`);
        return {
          status: 'STOP_AND_ASK',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'REVIEW_OUTPUT',
            name: 'review-output.md',
            content: response.text,
            metadata: { parseError: true, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
          }],
          stopAndAsk: {
            question: 'Review output could not be parsed. Please review manually and decide.',
            options: ['PROCEED to spec', 'REDO research', 'Requires decisions'],
          },
        };
      }
      
      // Extract verdict (safe to access properties now)
      const verdict = (header as any).VERDICT as ReviewVerdict;
      const confidence = ((header as any).CONFIDENCE || 'MEDIUM') as Confidence;
      const blockerCount = parseInt((header as any).BLOCKER_COUNT || '0', 10);
      const decisionCount = parseInt((header as any).DECISION_COUNT || '0', 10);
      const redoCount = parseInt((header as any).REDO_COUNT || '0', 10);
      
      const markdownBody = extractMarkdownBody(response.text);
      
      console.log(`   ✅ Review verdict: ${verdict} (${confidence} confidence)`);
      console.log(`   📊 Blockers: ${blockerCount}, Decisions: ${decisionCount}, Redo: ${redoCount}`);
      
      // Handle NEEDS_DECISION
      if (verdict === 'NEEDS_DECISION') {
        const decisionCards = extractDecisionCards(response.text);
        console.log(`   🙋 Extracted ${decisionCards.length} decision card(s)`);
        
        return {
          status: 'STOP_AND_ASK',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'REVIEW_OUTPUT',
            name: 'review-output.md',
            content: response.text,
            metadata: {
              verdict,
              confidence,
              blockerCount,
              decisionCount,
              redoCount,
              tokenUsage: response.tokenUsage,
              cost: response.costEstimateUsd,
            },
          }],
          stopAndAsk: {
            question: `Review found ${decisionCount} decision(s) needed before spec can proceed. See decision cards in the review output.`,
            options: decisionCards.map(d => d.decision),
          },
        };
      }
      
      // Handle REDO with safeguard against infinite loops
      if (verdict === 'REDO') {
        console.log(`   ↩️  Review recommends re-running research`);
        
        // Safeguard: Check how many PBCA attempts we've already made
        const pbcaAttempts = await countJobsByType(job.rp_id!, JobType.PBCA_RESEARCH);
        console.log(`   📊 PBCA attempts so far: ${pbcaAttempts}`);
        
        if (pbcaAttempts >= 2) {
          // 2nd REDO = escalate to human decision
          console.log(`   ⚠️  PBCA has run ${pbcaAttempts} times - escalating to human decision`);
          
          return {
            status: 'STOP_AND_ASK',
            artifacts: [{
              rp_id: job.rp_id!,
              type: 'REVIEW_OUTPUT',
              name: 'review-output.md',
              content: response.text,
              metadata: {
                verdict: 'NEEDS_DECISION', // Convert REDO to decision
                confidence,
                pbcaAttempts,
                tokenUsage: response.tokenUsage,
                cost: response.costEstimateUsd,
              },
            }],
            stopAndAsk: {
              question: `Research quality is below the review threshold after ${pbcaAttempts} attempts. The review found: ${markdownBody.slice(0, 200)}...\n\nWhat would you like to do?`,
              options: [
                'Proceed with spec writing anyway',
                'Let me provide more context (will re-run research)',
                'Cancel this RP',
              ],
            },
          };
        }
        
        // First REDO = retry normally
        return {
          status: 'FAILED',
          error: {
            kind: 'REVIEW_REDO',
            message: `Review recommends re-running research: ${markdownBody.slice(0, 200)}...`,
            retryable: true,
          },
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'REVIEW_OUTPUT',
            name: 'review-output.md',
            content: response.text,
            metadata: { verdict, confidence, pbcaAttempts, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
          }],
        };
      }
      
      // PROCEED
      console.log(`   ✅ Review passed - proceeding to spec`);
      return {
        status: 'SUCCEEDED',
        artifacts: [{
          rp_id: job.rp_id!,
          type: 'REVIEW_OUTPUT',
          name: 'review-output.md',
          content: response.text,
          metadata: { verdict, confidence, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
        }],
      };
      
    } catch (error: any) {
      console.error(`   ❌ Claude Brain error: ${error.message}`);
      return {
        status: 'FAILED',
        error: {
          kind: 'ADAPTER_ERROR',
          message: error.message,
          retryable: true,
        },
      };
    }
  }
  
  /**
   * CLAUDE_SPEC: Write Constellation Packet
   */
  private async runSpec(job: Job): Promise<ExecutionResult> {
    try {
      console.log(`\n🧠 Claude Brain: CLAUDE_SPEC`);
      console.log(`   RP: ${job.rp_id}`);
      
      console.log(`   📋 Building spec context...`);
      const contextPack = await buildSpecContext(job);
      
      const userMessage = buildSpecUserMessage(contextPack);
      
      console.log(`   ⚙️  Calling Anthropic API for spec...`);
      const response = await callAnthropic(SPEC_SYSTEM_PROMPT, userMessage);
      
      // Parse header
      const header = parseHeader(response.text);
      
      if ('parseError' in header && header.parseError) {
        console.log(`   ⚠️  Spec header could not be parsed`);
        return {
          status: 'STOP_AND_ASK',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'SPEC_OUTPUT',
            name: 'constellation-packet.md',
            content: response.text,
            metadata: { parseError: true, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
          }],
          stopAndAsk: {
            question: 'Spec output could not be parsed. Please review manually.',
            options: ['Accept spec as-is', 'Regenerate spec', 'Manual edit required'],
          },
        };
      }
      
      const status = ((header as any).STATUS || 'COMPLETE') as SpecStatus;
      const confidence = ((header as any).CONFIDENCE || 'MEDIUM') as Confidence;
      
      console.log(`   ✅ Spec status: ${status} (${confidence} confidence)`);
      
      // Extract markdown body
      const markdownBody = extractMarkdownBody(response.text);
      
      // For now, always succeed (v1 doesn't validate spec structure)
      return {
        status: 'SUCCEEDED',
        artifacts: [{
          rp_id: job.rp_id!,
          type: 'SPEC_OUTPUT',
          name: 'constellation-packet.md',
          content: response.text,
          metadata: { status, confidence, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
        }],
      };
      
    } catch (error: any) {
      console.error(`   ❌ Claude Brain error: ${error.message}`);
      return {
        status: 'FAILED',
        error: {
          kind: 'ADAPTER_ERROR',
          message: error.message,
          retryable: true,
        },
      };
    }
  }
  
  /**
   * CLAUDE_DEBUG: Analyze test failure and propose fix
   */
  private async runDebug(job: Job): Promise<ExecutionResult> {
    try {
      console.log(`\n🧠 Claude Brain: CLAUDE_DEBUG`);
      console.log(`   RP: ${job.rp_id}`);
      
      console.log(`   📋 Building debug context...`);
      const contextPack = await buildDebugContext(job);
      
      const userMessage = buildDebugUserMessage(contextPack);
      
      console.log(`   ⚙️  Calling Anthropic API for debug...`);
      const response = await callAnthropic(DEBUG_SYSTEM_PROMPT, userMessage);
      
      // Parse header
      const header = parseHeader(response.text);
      
      if ('parseError' in header && header.parseError) {
        console.log(`   ⚠️  Debug header could not be parsed`);
        return {
          status: 'STOP_AND_ASK',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'DEBUG_OUTPUT',
            name: 'debug-analysis.md',
            content: response.text,
            metadata: { parseError: true, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
          }],
          stopAndAsk: {
            question: 'Debug output could not be parsed. Please review manually.',
            options: ['Try again', 'Manual fix required', 'Abort debugging'],
          },
        };
      }
      
      const action = ((header as any).ACTION || 'FIX_AND_RETRY') as DebugAction;
      const confidence = ((header as any).CONFIDENCE || 'MEDIUM') as Confidence;
      const severity = ((header as any).SEVERITY || 'MEDIUM') as Severity;
      
      console.log(`   ✅ Debug action: ${action} (${confidence} confidence, ${severity} severity)`);
      
      const markdownBody = extractMarkdownBody(response.text);
      
      // Handle ESCALATE
      if (action === 'ESCALATE_SPEC' || action === 'ESCALATE_RESEARCH' || action === 'ASK_HUMAN') {
        console.log(`   🚨 Debug recommends human intervention`);
        return {
          status: 'STOP_AND_ASK',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'DEBUG_OUTPUT',
            name: 'debug-analysis.md',
            content: response.text,
            metadata: { action, confidence, severity, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
          }],
          stopAndAsk: {
            question: `Debug analysis recommends human intervention (${severity} severity). See analysis for details.`,
            options: ['I\'ll fix it manually', 'Skip this test', 'Abort RP'],
          },
        };
      }
      
      // FIX_AND_RETRY or NEED_MORE_INFO
      return {
        status: 'SUCCEEDED',
        artifacts: [{
          rp_id: job.rp_id!,
          type: 'DEBUG_OUTPUT',
          name: 'debug-analysis.md',
          content: response.text,
          metadata: { action, confidence, severity, tokenUsage: response.tokenUsage, cost: response.costEstimateUsd },
        }],
      };
      
    } catch (error: any) {
      console.error(`   ❌ Claude Brain error: ${error.message}`);
      return {
        status: 'FAILED',
        error: {
          kind: 'ADAPTER_ERROR',
          message: error.message,
          retryable: true,
        },
      };
    }
  }
}
