/**
 * CLI runner - spawns Claude Code with proper flags and captures output
 */

import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import path from 'path';

export interface CliRunOptions {
  executable: string;
  worktreePath: string;
  prompt: string;
  systemPromptPath?: string;
  maxTurns?: number;           // default: 50
  maxBudgetUsd?: number;       // default: 2.00
  sessionId?: string;          // for debug cycle continuation
  allowedTools?: string[];
}

export interface CliRunResult {
  exitCode: number;
  rawLogPath: string;
  jsonResult: any | null;      // parsed JSON from stdout, or null if unparseable
  stderr: string;
  sessionId?: string;          // extracted from Claude Code output
  totalCostUsd?: number;       // extracted from Claude Code output
}

/**
 * Run Claude Code CLI in headless mode with JSON output
 */
export async function runClaude(options: CliRunOptions): Promise<CliRunResult> {
  const {
    executable,
    worktreePath,
    prompt,
    systemPromptPath,
    maxTurns = 50,
    maxBudgetUsd = 2.00,
    sessionId,
    allowedTools
  } = options;
  
  // Ensure logs directory exists
  const logsDir = path.join(worktreePath, '.methodology', 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  
  // Create log file path
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rawLogPath = path.join(logsDir, `build-${timestamp}.log`);
  
  // Build command arguments
  const args = [
    '-p',                                    // print mode (headless)
    '--output-format', 'json',               // structured JSON output
    '--permission-mode', 'dontAsk',          // don't block on permissions
    '--tools', 'Bash,Read,Edit,Write',       // available tools
    '--max-turns', String(maxTurns),
    '--max-budget-usd', String(maxBudgetUsd)
  ];
  
  // Add system prompt if provided
  if (systemPromptPath) {
    args.push('--append-system-prompt-file', systemPromptPath);
  }
  
  // Add session ID for continuation
  if (sessionId) {
    args.push('--session-id', sessionId);
  }
  
  // Add allowed tools (permission whitelist)
  // Format: Single string with comma-separated tools and Bash patterns
  if (allowedTools && allowedTools.length > 0) {
    args.push('--allowedTools', allowedTools.join(','));
  } else {
    // Default whitelist - safe git/npm/file commands
    const defaultAllowed = [
      'Read',
      'Write',
      'Edit',
      'Bash(npm *)',
      'Bash(npx *)',
      'Bash(node *)',
      'Bash(git *)',
      'Bash(mkdir *)',
      'Bash(cat *)',
      'Bash(ls *)',
      'Bash(touch *)',
      'Bash(cp *)',
      'Bash(mv *)',
      'Bash(chmod *)'
    ];
    args.push('--allowedTools', defaultAllowed.join(','));
  }
  
  console.log(`   🚀 Spawning ${executable} in ${worktreePath}...`);
  console.log(`   📝 Logging to: ${rawLogPath}`);
  
  // Spawn the process with stdin piped (prompt goes via stdin, not as argument)
  const child = spawn(executable, args, {
    cwd: worktreePath,
    stdio: ['pipe', 'pipe', 'pipe']  // stdin piped, stdout/stderr piped
  });
  
  // Write prompt to stdin and close it
  child.stdin.write(prompt);
  child.stdin.end();
  
  // Create write stream for raw log
  const logStream = createWriteStream(rawLogPath);
  
  // Collect stdout and stderr
  let stdout = '';
  let stderr = '';
  
  // Pipe stdout to log file and collect for parsing
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    logStream.write(text);
    stdout += text;
  });
  
  // Collect stderr
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    logStream.write(`[STDERR] ${text}`);
  });
  
  // Wait for process to exit
  return new Promise((resolve) => {
    child.on('close', (exitCode) => {
      logStream.end();
      
      console.log(`   ✅ Claude Code exited with code: ${exitCode}`);
      
      // Parse Claude Code's JSON output
      // Format: { type: "result", result: "```json\n{...}\n```", session_id: "...", total_cost_usd: 0.074 }
      let jsonResult = null;
      let extractedSessionId: string | undefined = undefined;
      let extractedCostUsd: number | undefined = undefined;
      
      try {
        // Step 1: Parse the outer JSON wrapper
        const outerJson = JSON.parse(stdout.trim());
        
        // Step 2: Extract metadata from outer object
        extractedSessionId = outerJson.session_id;
        extractedCostUsd = outerJson.total_cost_usd;
        
        // Step 3: Extract the result field (contains markdown-wrapped JSON)
        let resultString = outerJson.result;
        
        if (typeof resultString === 'string') {
          // Step 4: Strip markdown code block markers (```json and ```)
          resultString = resultString.trim();
          
          // Try to extract JSON from code fence anywhere in the string
          var fenceMatch = resultString.match(/```json\s*\n?([\s\S]*?)```/);
          if (fenceMatch) {
            resultString = fenceMatch[1].trim();
          }

          // Remove opening ```json or ``` if present
          if (resultString.startsWith('```json')) {
            resultString = resultString.substring(7); // Remove ```json
          } else if (resultString.startsWith('```')) {
            resultString = resultString.substring(3); // Remove ```
          }
          
          // Remove closing ``` if present
          if (resultString.endsWith('```')) {
            resultString = resultString.substring(0, resultString.length - 3);
          }
          
          resultString = resultString.trim();
          
          // Step 5: Parse the inner JSON (the actual build result)
          jsonResult = JSON.parse(resultString);
          
          console.log(`   📊 Parsed build result successfully`);
          if (extractedSessionId) {
            console.log(`   🔑 Session ID: ${extractedSessionId.substring(0, 8)}...`);
          }
          if (extractedCostUsd !== undefined) {
            console.log(`   💰 Cost: $${extractedCostUsd.toFixed(4)}`);
          }
        } else {
          console.warn(`   ⚠️  'result' field is not a string, using as-is`);
          jsonResult = resultString;
        }
      } catch (error) {
        console.warn(`   ⚠️  Could not parse Claude Code JSON output`);
        console.warn(`   ⚠️  Error: ${error instanceof Error ? error.message : String(error)}`);
        console.warn(`   ⚠️  Raw output length: ${stdout.length} characters`);
      }
      
      resolve({
        exitCode: exitCode || 0,
        rawLogPath,
        jsonResult,
        stderr: stderr.trim(),
        sessionId: extractedSessionId,
        totalCostUsd: extractedCostUsd
      });
    });
  });
}
