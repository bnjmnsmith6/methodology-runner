/**
 * Anthropic client wrapper with retry and cost tracking
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_BRAIN_MODEL || 'claude-sonnet-4-20250514';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Cost rates for Claude Sonnet 4
const COST_PER_MILLION_INPUT_TOKENS = 3.00;
const COST_PER_MILLION_OUTPUT_TOKENS = 15.00;

export interface AnthropicResponse {
  text: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
  };
  costEstimateUsd: number;
}

/**
 * Call Anthropic API with retry logic
 */
export async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<AnthropicResponse> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`   🤖 Calling Anthropic API (${MODEL})... (attempt ${attempt}/${MAX_RETRIES})`);
      
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });
      
      // Extract text from response
      const textBlock = response.content.find(block => block.type === 'text');
      const text = textBlock && 'text' in textBlock ? textBlock.text : '';
      
      // Token usage
      const promptTokens = response.usage.input_tokens;
      const completionTokens = response.usage.output_tokens;
      
      // Cost estimate
      const costEstimateUsd = calculateCost(promptTokens, completionTokens);
      
      console.log(`   ✅ API call succeeded`);
      console.log(`   📊 Tokens: ${promptTokens} in, ${completionTokens} out`);
      console.log(`   💰 Estimated cost: $${costEstimateUsd.toFixed(4)}`);
      
      return {
        text,
        tokenUsage: { promptTokens, completionTokens },
        costEstimateUsd,
      };
      
    } catch (error: any) {
      lastError = error;
      
      // Retry on rate limit (429) or server errors (5xx)
      if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
        console.log(`   ⚠️  Attempt ${attempt} failed with ${error.status}, retrying...`);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // exponential backoff
          await sleep(delay);
          continue;
        }
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
  
  throw lastError || new Error('Anthropic API call failed after retries');
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_INPUT_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_OUTPUT_TOKENS;
  return inputCost + outputCost;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
