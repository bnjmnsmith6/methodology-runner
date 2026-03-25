/**
 * Prompt assembler - prepares build files in worktree
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { loadContextPack } from '../../prompts/persistContextPack.js';

const BUILD_SYSTEM_PROMPT = `You are Code Puppy, a build agent executing a Constellation Packet.

Rules:
1. Read the Constellation Packet at .methodology/constellation-packet.md
2. Build EXACTLY what it specifies, in the order specified
3. If anything is ambiguous and the choice matters, return status "needs_human"
   with your question — DO NOT guess silently
4. Run any tests specified in the acceptance criteria
5. When done, return your result as JSON

Your result JSON MUST include:
- status: "success" if all acceptance criteria pass, "failed" if tests/build fail,
  "needs_human" if you need clarification
- summary: what you did
- changed_files: list of files you created or modified
- tests_run: list of test commands you ran and their results

Additional guidance:
- If the spec says "create a REST API", build the actual endpoints, not stubs
- If the spec says "add tests", write real tests that verify behavior
- If the spec is vague about naming, file structure, or implementation approach,
  and your choice would significantly affect the design, ask for clarification
- If the spec is clear, proceed with confidence
- Always run tests if they exist or are specified
- Commit your changes when the build succeeds
`;

export interface PromptAssemblyResult {
  prompt: string;
  systemPromptPath: string;
}

/**
 * Assemble build prompt and write supporting files to worktree
 */
export async function assembleBuildPrompt(
  worktreePath: string,
  constellationPacket: string,
  jobId: string,
  projectId?: string,
  rpId?: string
): Promise<PromptAssemblyResult> {
  // Ensure .methodology directory exists
  const methodologyDir = path.join(worktreePath, '.methodology');
  if (!existsSync(methodologyDir)) {
    mkdirSync(methodologyDir, { recursive: true });
  }
  
  // Write constellation packet
  const packetPath = path.join(methodologyDir, 'constellation-packet.md');
  writeFileSync(packetPath, constellationPacket, 'utf-8');
  console.log(`   📄 Wrote constellation packet to: ${packetPath}`);
  
  // Inject Vision Document context if available
  let finalSystemPrompt = BUILD_SYSTEM_PROMPT;
  if (projectId && rpId) {
    const contextPack = await loadContextPack(projectId, rpId, 'build');
    if (contextPack) {
      console.log('   📦 Injecting Vision Document context');
      finalSystemPrompt = BUILD_SYSTEM_PROMPT + '\n\n---\n\n## Project Context\n\n' + contextPack.renderedText;
    }
  }
  
  // Write system prompt
  const systemPromptPath = path.join(methodologyDir, 'build-system-prompt.md');
  writeFileSync(systemPromptPath, finalSystemPrompt, 'utf-8');
  console.log(`   📝 Wrote system prompt to: ${systemPromptPath}`);
  
  // Build the CLI prompt with JSON format requirements embedded
  const prompt = `Read .methodology/constellation-packet.md and build what it specifies.

When complete, return a JSON object with these keys:
- status: "success", "failed", or "needs_human"
- summary: brief description of what you did
- changed_files: array of files you created or modified
- tests_run: array of test commands you ran (if any)
- commands_run: array of other commands you ran (optional)
- question_for_human: your question if status is "needs_human" (optional)
- options_for_human: array of options if you need a choice (optional)

Return ONLY the JSON object, nothing else.`;
  
  return {
    prompt,
    systemPromptPath
  };
}
