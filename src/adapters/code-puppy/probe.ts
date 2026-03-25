/**
 * Executable probe - detects Claude Code CLI at startup
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecutableInfo {
  executable: string;
  version: string;
}

/**
 * Probe for Claude Code executable on system PATH
 * 
 * Tries in order:
 * 1. claude --version (official Anthropic Claude Code CLI - PREFERRED)
 * 2. code-puppy --version (fallback)
 * 
 * Returns null if neither is found.
 */
export async function probeExecutable(): Promise<ExecutableInfo | null> {
  // Try claude first (official Anthropic CLI with full feature set)
  try {
    const { stdout } = await execAsync('claude --version', { timeout: 5000 });
    const version = stdout.trim();
    console.log(`   🤖 Found claude: ${version}`);
    return { executable: 'claude', version };
  } catch (error) {
    // claude not found, try code-puppy
  }
  
  // Try code-puppy as fallback
  try {
    const { stdout } = await execAsync('code-puppy --version', { timeout: 5000 });
    const version = stdout.trim();
    console.log(`   🐶 Found code-puppy: ${version}`);
    console.warn('   ⚠️  code-puppy has limited CLI flags - some features may not work');
    return { executable: 'code-puppy', version };
  } catch (error) {
    // code-puppy not found either
  }
  
  console.warn('   ⚠️  Neither claude nor code-puppy found on PATH');
  console.warn('   ⚠️  Falling back to mock adapter');
  return null;
}
