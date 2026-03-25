/**
 * Real PBCA adapter
 * 
 * Calls the OpenAI API to replicate Ben's PBCA R&D Orchestrator.
 */

import { AgentAdapter } from './interface.js';
import { Job, ExecutionResult, JobType, ArtifactDraft } from '../core/types.js';
import { callChatCompletion } from './openai-client.js';
import { PBCA_SYSTEM_PROMPT } from './pbca-system-prompt.js';
import { buildPbcaUserPrompt, type PbcaPromptInput } from './pbca-prompt-builder.js';
import { parsePbcaResponse } from './pbca-response-parser.js';

export class RealPbcaAdapter implements AgentAdapter {
  async execute(job: Job): Promise<ExecutionResult> {
    // Validate job type
    if (job.type !== JobType.PBCA_RESEARCH) {
      return {
        status: 'FAILED',
        error: {
          kind: 'WRONG_JOB_TYPE',
          message: `RealPbcaAdapter cannot handle job type ${job.type}`,
          retryable: false,
        },
      };
    }

    console.log(`\n🔬 PBCA Research: ${job.input.rp_title}`);
    console.log(`   Project: ${job.input.project_name} (Tier ${job.input.project_tier})`);

    try {
      // Build the prompt
      const promptInput: PbcaPromptInput = {
        rpTitle: job.input.rp_title,
        rpDescription: job.input.rp_description || job.input.rp_title,
        projectName: job.input.project_name,
        projectTier: job.input.project_tier,
        projectDescription: job.input.project_description,
        questionsToAnswer: job.input.questions_to_answer,
        constraints: job.input.constraints,
        stressTestItems: job.input.stress_test_items,
        existingArtifacts: job.input.existing_artifacts,
      };

      const userPrompt = buildPbcaUserPrompt(promptInput);

      console.log(`   Prompt length: ${userPrompt.length} characters`);

      // Call OpenAI API
      const response = await callChatCompletion({
        messages: [
          { role: 'system', content: PBCA_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 16000,
        temperature: 0.7,
      });

      console.log(`   Response length: ${response.content.length} characters`);

      // Parse the response
      const parsedOutput = parsePbcaResponse(response.content);

      console.log(`   Parsed ${parsedOutput.files.length} file(s)`);
      if (parsedOutput.warnings.length > 0) {
        console.log(`   ⚠️  Warnings:`);
        parsedOutput.warnings.forEach(w => console.log(`      - ${w}`));
      }

      // Estimate cost
      const costEstimate = estimateCost(response.usage.total_tokens);
      console.log(`   Estimated cost: $${costEstimate.toFixed(4)}`);

      // If parsing failed completely, still return success but with warnings
      if (parsedOutput.files.length === 0) {
        console.log(`   ⚠️  No files parsed - storing raw response`);
        
        return {
          status: 'SUCCEEDED',
          artifacts: [{
            rp_id: job.rp_id!,
            type: 'pbca_research',
            name: 'raw-output.md',
            content: response.content,
            metadata: {
              parse_warnings: parsedOutput.warnings,
              token_usage: response.usage,
              cost_estimate_usd: costEstimate,
              model: response.model,
            },
          }],
        };
      }

      // Convert parsed files to artifacts
      const artifacts: ArtifactDraft[] = parsedOutput.files.map(file => ({
        rp_id: job.rp_id!,
        type: 'pbca_research',
        name: file.path,
        content: file.content,
        metadata: {
          file_path: file.path,
        },
      }));

      // Also include the run summary as a separate artifact
      if (parsedOutput.runSummary) {
        artifacts.unshift({
          rp_id: job.rp_id!,
          type: 'pbca_research',
          name: 'run-summary.md',
          content: parsedOutput.runSummary,
          metadata: {
            is_summary: true,
          },
        });
      }

      // Include raw response and metadata
      artifacts.push({
        rp_id: job.rp_id!,
        type: 'pbca_research',
        name: '_metadata.json',
        content: JSON.stringify({
          token_usage: response.usage,
          cost_estimate_usd: costEstimate,
          model: response.model,
          warnings: parsedOutput.warnings,
          file_count: parsedOutput.files.length,
        }, null, 2),
        metadata: {
          is_metadata: true,
        },
      });

      console.log(`   ✅ PBCA research complete - ${artifacts.length} artifact(s)`);

      return {
        status: 'SUCCEEDED',
        artifacts,
      };

    } catch (error: any) {
      console.error(`   ❌ PBCA research failed:`, error.message);

      // Check if it's a retryable error
      const isRetryable = error.status === 429 || // Rate limit
                          error.status === 503 || // Service unavailable
                          error.code === 'ECONNRESET' ||
                          error.code === 'ETIMEDOUT';

      return {
        status: 'FAILED',
        error: {
          kind: error.status === 429 ? 'RATE_LIMIT' : 'API_ERROR',
          message: error.message || 'OpenAI API call failed',
          retryable: isRetryable,
        },
      };
    }
  }
}

/**
 * Estimate cost in USD
 */
function estimateCost(tokens: number): number {
  // GPT-4o pricing (approximate): $0.005/1K input, $0.015/1K output
  // Assume 70% input, 30% output
  const inputTokens = tokens * 0.7;
  const outputTokens = tokens * 0.3;
  
  return (inputTokens * 0.005 / 1000) + (outputTokens * 0.015 / 1000);
}
