/**
 * OpenAI client wrapper with retry logic and rate limit handling
 */

import OpenAI from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get model from env, fallback to gpt-4o
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

interface ChatCompletionOptions {
  model?: string;
  messages: ChatCompletionCreateParamsNonStreaming['messages'];
  max_tokens?: number;
  temperature?: number;
}

interface ChatCompletionResult {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Call OpenAI chat completion with exponential backoff retry
 */
export async function callChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🤖 Calling OpenAI API (${options.model || MODEL})... (attempt ${attempt}/${maxRetries})`);

      const response = await openai.chat.completions.create({
        model: options.model || MODEL,
        messages: options.messages,
        max_tokens: options.max_tokens || 16000,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new Error('OpenAI returned empty response');
      }

      const usage = response.usage;
      if (!usage) {
        throw new Error('OpenAI did not return usage data');
      }

      // Log token usage and cost estimate
      const costEstimate = estimateCost(usage.total_tokens, options.model || MODEL);
      console.log(`✅ OpenAI call succeeded:`);
      console.log(`   Tokens: ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total`);
      console.log(`   Estimated cost: $${costEstimate.toFixed(4)}`);

      return {
        content: choice.message.content,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        },
        model: response.model,
      };
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      if (error.status === 429 || error.code === 'rate_limit_exceeded') {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`⏳ Rate limited. Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // Check if it's a transient error (5xx)
      if (error.status >= 500 && error.status < 600) {
        const backoffMs = Math.min(500 * Math.pow(2, attempt), 10000);
        console.log(`⚠️  Server error (${error.status}). Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      // For other errors, don't retry
      console.error(`❌ OpenAI API error (not retryable):`, error.message);
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('OpenAI API call failed after retries');
}

/**
 * Estimate cost in USD based on token count and model
 */
function estimateCost(tokens: number, model: string): number {
  // Pricing as of 2024 (approximate - check OpenAI pricing page for latest)
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 0.005 / 1000, output: 0.015 / 1000 },
    'gpt-4o-mini': { input: 0.00015 / 1000, output: 0.0006 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
  };

  // Find matching model pricing (handle model variants)
  let modelPricing = pricing['gpt-4o']; // default
  for (const [key, value] of Object.entries(pricing)) {
    if (model.includes(key)) {
      modelPricing = value;
      break;
    }
  }

  // Rough estimate: assume 70% input, 30% output
  const inputTokens = tokens * 0.7;
  const outputTokens = tokens * 0.3;

  return inputTokens * modelPricing.input + outputTokens * modelPricing.output;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
