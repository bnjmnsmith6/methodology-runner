/**
 * Adapter registry
 * 
 * Maps job types to their adapter implementations.
 * Supports switching between mock and real adapters via environment variables.
 */

import { AgentAdapter } from './interface.js';
import { MockPbcaAdapter } from './mock-pbca.js';
import { MockClaudeAdapter } from './mock-claude.js';
import { MockCodePuppyAdapter } from './mock-codepuppy.js';
import { RealPbcaAdapter } from './real-pbca.js';
import { RealClaudeAdapter } from './claude-brain/index.js';
import { RealCodePuppyAdapter } from './code-puppy/index.js';
import { JobType } from '../core/types.js';

// Check environment variables for real adapter usage
const USE_REAL_PBCA = process.env.USE_REAL_PBCA === 'true';
const USE_REAL_CLAUDE = process.env.USE_REAL_CLAUDE === 'true';
const USE_REAL_CODEPUPPY = process.env.USE_REAL_CODEPUPPY === 'true';

// Singleton instances
const mockPbcaAdapter = new MockPbcaAdapter();
const realPbcaAdapter = new RealPbcaAdapter();
const mockClaudeAdapter = new MockClaudeAdapter();
const realClaudeAdapter = new RealClaudeAdapter();
const mockCodePuppyAdapter = new MockCodePuppyAdapter();
const realCodePuppyAdapter = new RealCodePuppyAdapter();

// Log adapter configuration on startup
if (USE_REAL_PBCA) {
  console.log('🔬 Using REAL PBCA adapter (OpenAI API)');
} else {
  console.log('🎭 Using MOCK PBCA adapter');
}

if (USE_REAL_CLAUDE) {
  console.log('🧠 Using REAL Claude Brain adapter (Anthropic API)');
} else {
  console.log('🎭 Using MOCK Claude Brain adapter');
}

if (USE_REAL_CODEPUPPY) {
  console.log('🐶 Using REAL Code Puppy adapter (Claude Code CLI)');
} else {
  console.log('🎭 Using MOCK Code Puppy adapter');
}

/**
 * Initialize adapters that need async setup
 */
export async function initializeAdapters(): Promise<void> {
  if (USE_REAL_CODEPUPPY) {
    await realCodePuppyAdapter.initialize();
  }
}

/**
 * Get the appropriate adapter for a job type
 */
export function getAdapter(jobType: JobType): AgentAdapter {
  switch (jobType) {
    case JobType.PBCA_RESEARCH:
      return USE_REAL_PBCA ? realPbcaAdapter : mockPbcaAdapter;
    
    case JobType.CLAUDE_REVIEW:
    case JobType.CLAUDE_SPEC:
    case JobType.CLAUDE_DEBUG:
      return USE_REAL_CLAUDE ? realClaudeAdapter : mockClaudeAdapter;
    
    case JobType.CODEPUPPY_BUILD:
    case JobType.CODEPUPPY_FIX:
    case JobType.SMOKE_RUN:
      return USE_REAL_CODEPUPPY ? realCodePuppyAdapter : mockCodePuppyAdapter;
    
    case JobType.SHIP:
      // Ship is a special job that doesn't need an agent
      return {
        async execute() {
          return {
            status: 'SUCCEEDED',
            artifacts: [],
          };
        },
      };
    
    default:
      throw new Error(`No adapter registered for job type: ${jobType}`);
  }
}
