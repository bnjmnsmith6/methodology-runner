/**
 * Real Code Puppy adapter - Claude Code CLI integration
 */

import { AgentAdapter } from '../interface.js';
import { Job, ExecutionResult, JobType } from '../../core/types.js';
import { probeExecutable } from './probe.js';
import { ensureRepo, ensureWorktree } from './worktree-manager.js';
import { runHardGates } from '../../telemetry/hard-gates.js';
import { writeGradeBundle } from '../../telemetry/grade-writer.js';
import { writeGradeBundle } from '../../telemetry/grade-writer.js';
import { runClaude } from './cli-runner.js';
import { startHeartbeat } from './heartbeat.js';
import { assembleBuildPrompt } from './prompt-assembler.js';
import { normalizeBuildResult } from './normalize-result.js';
import { MockCodePuppyAdapter } from '../mock-codepuppy.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

export class RealCodePuppyAdapter implements AgentAdapter {
  private executable: string | null = null;
  private version: string | null = null;
  
  /**
   * Initialize - probe for executable at startup
   */
  async initialize(): Promise<void> {
    console.log('\n🐶 Code Puppy: Probing for Claude Code executable...');
    const probe = await probeExecutable();
    
    if (probe) {
      this.executable = probe.executable;
      this.version = probe.version;
      console.log(`✅ Code Puppy initialized: ${probe.executable} v${probe.version}`);
    } else {
      console.warn('⚠️  Claude Code not found — will fall back to mock adapter');
    }
  }
  
  /**
   * Execute a job
   */
  async execute(job: Job): Promise<ExecutionResult> {
    // If no executable found, fall back to mock
    if (!this.executable) {
      console.log('   ℹ️  Falling back to mock adapter (no Claude Code executable)');
      return new MockCodePuppyAdapter().execute(job);
    }
    
    switch (job.type) {
      case JobType.CODEPUPPY_BUILD:
      case JobType.CODEPUPPY_FIX:
        return this.runBuild(job);
      
      case JobType.SMOKE_RUN:
        return this.runSmoke(job);
      
      default:
        return {
          status: 'FAILED',
          error: {
            kind: 'UNSUPPORTED_JOB_TYPE',
            message: `Real Code Puppy adapter does not support job type: ${job.type}`,
            retryable: false
          }
        };
    }
  }
  
  /**
   * Run a build job (CODEPUPPY_BUILD or CODEPUPPY_FIX)
   */
  private async runBuild(job: Job): Promise<ExecutionResult> {
    console.log(`\n🐶 Code Puppy: ${job.type}`);
    console.log(`   RP: ${job.rp_id}`);
    
    try {
      // 1. Get constellation packet from job input
      const packet = job.input.constellation_packet;
      if (!packet) {
        return {
          status: 'FAILED',
          error: {
            kind: 'NO_SPEC',
            message: 'No constellation packet in job input',
            retryable: false
          }
        };
      }
      
      // 2. Determine repo root
      const defaultRepoRoot = `${process.env.HOME}/Projects/methodology-runner-builds/${job.input.project_name || 'default'}`;
      const repoRoot = job.input.repo_path || defaultRepoRoot;
      
      console.log(`   📁 Repo root: ${repoRoot}`);
      
      // 3. Ensure repo exists
      await ensureRepo(repoRoot);
      
      // 4. Create/reuse worktree
      const worktreePath = await ensureWorktree(
        repoRoot,
        job.rp_id!,
        job.input.rp_title || 'build'
      );
      
      // 5. Assemble prompt files
      const { prompt, systemPromptPath } = await assembleBuildPrompt(
        worktreePath,
        packet,
        job.id,
        job.project_id,
        job.rp_id || undefined
      );
      
      // 6. Start heartbeat
      const heartbeat = startHeartbeat(job.id);
      
      try {
        // 7. Run Claude Code
        console.log(`   🚀 Starting Claude Code build...`);
        const cliResult = await runClaude({
          executable: this.executable!,
          worktreePath,
          prompt,
          systemPromptPath,
          sessionId: job.input.session_id,
          maxTurns: parseInt(process.env.CODEPUPPY_MAX_TURNS || '50', 10),
          maxBudgetUsd: parseFloat(process.env.CODEPUPPY_MAX_BUDGET_USD || '2.00')
        });
        
        // 8. Normalize result
        const result = normalizeBuildResult(cliResult, {
          projectId: job.project_id,
          rpId: job.rp_id!,
          jobId: job.id,
          executable: this.executable!,
          repoRoot,
          worktreePath,
          branchName: `methodology-runner/rp-${job.rp_id!.slice(0, 8)}`,
          sessionId: job.input.session_id,
          packetPath: `${worktreePath}/.methodology/constellation-packet.md`
        });
        
        console.log(`   📊 Build result: ${result.status}`);
        console.log(`   📝 Summary: ${result.summary.slice(0, 100)}...`);
        console.log(`   📁 Changed files: ${result.changedFiles.length}`);
        
        // 9. If build succeeded, generate README and commit before pushing
        let githubUrl: string | null = null;
        let branchName: string | null = null;
        
        let gateResult: any = null;
        if (result.status === 'success') {
          // Commit any uncommitted build artifacts first
          await this.commitBuildArtifacts(
            worktreePath,
            job.input.rp_title || 'Build'
          );
          
          // Run deterministic hard gates
          gateResult = runHardGates(worktreePath, result);
          console.log("   " + (gateResult.hard_gate_pass ? "PASS" : "FAIL") + " Hard gates: " + gateResult.summary);
          for (const check of gateResult.checks) {
            if (!check.passed) {
              console.log("      FAIL " + check.dimension + ": " + check.notes);
            }
          }

          // Generate and commit README
          await this.generateAndCommitReadme(
            worktreePath,
            packet,
            result,
            job.input.rp_title || 'Build',
            job.input.project_name || 'Project',
            parseInt(job.input.project_tier || '3', 10)
          );
          
          const pushResult = await this.pushToGitHub(
            worktreePath,
            `rp-${job.rp_id!.slice(0, 8)}`
          );
          
          if (pushResult) {
            githubUrl = pushResult.url;
            branchName = pushResult.branchName;
            console.log(`   🌐 Pushed to GitHub: ${githubUrl}`);
          }
        }
        
        // 10. Map to ExecutionResult
        switch (result.status) {
          case 'success':
            return {
              status: 'SUCCEEDED',
              artifacts: [{
                rp_id: job.rp_id!,
                type: 'BUILD_LOG',
                name: 'build-output.md',
                content: result.summary,
                metadata: {
                  changedFiles: result.changedFiles,
                  testsRun: result.testsRun,
                  commandsRun: result.commandsRun,
                  rawLogPath: result.rawLogPath,
                  costUsd: result.costUsd,
                  numTurns: result.numTurns,
                  sessionId: result.sessionId,
                  githubUrl,
                  branchName,
                  gateResult: {
                    hard_gate_pass: gateResult.hard_gate_pass,
                    checks: gateResult.checks,
                    summary: gateResult.summary
                  },
                  gateResult: {
                    hard_gate_pass: gateResult.hard_gate_pass,
                    checks: gateResult.checks,
                    summary: gateResult.summary
                  }
                }
              }]
            };
          
          case 'needs_human':
            return {
              status: 'STOP_AND_ASK',
              artifacts: [{
                rp_id: job.rp_id!,
                type: 'BUILD_LOG',
                name: 'build-output.md',
                content: result.summary,
                metadata: {
                  rawLogPath: result.rawLogPath,
                  changedFiles: result.changedFiles
                }
              }],
              stopAndAsk: {
                question: result.questionForHuman || 'Code Puppy needs clarification',
                options: result.optionsForHuman || ['Provide guidance', 'Abort build']
              }
            };
          
          case 'failed':
            return {
              status: 'FAILED',
              error: {
                kind: 'BUILD_FAILED',
                message: result.summary,
                retryable: true
              },
              artifacts: [{
                rp_id: job.rp_id!,
                type: 'BUILD_LOG',
                name: 'build-failure.md',
                content: result.summary,
                metadata: {
                  rawLogPath: result.rawLogPath,
                  changedFiles: result.changedFiles,
                  testsRun: result.testsRun
                }
              }]
            };
          
          case 'infrastructure_error':
            return {
              status: 'FAILED',
              error: {
                kind: 'INFRA_ERROR',
                message: result.summary,
                retryable: true
              },
              artifacts: [{
                rp_id: job.rp_id!,
                type: 'BUILD_LOG',
                name: 'infra-error.log',
                content: result.summary,
                metadata: {
                  rawLogPath: result.rawLogPath
                }
              }]
            };
        }
      } finally {
        // 11. Always stop heartbeat
        heartbeat.stop();
      }
    } catch (error: any) {
      console.error(`   ❌ Code Puppy error: ${error.message}`);
      return {
        status: 'FAILED',
        error: {
          kind: 'ADAPTER_ERROR',
          message: error.message,
          retryable: true
        }
      };
    }
  }
  


  /**
   * Commit build artifacts before README generation
   */
  private async commitBuildArtifacts(worktreePath: string, rpTitle: string): Promise<void> {
    try {
      console.log('   📦 Committing build artifacts...');
      
      // Ensure .gitignore exists to prevent committing node_modules etc
      const gitignorePath = worktreePath + '/.gitignore';
      if (!fs.existsSync(gitignorePath)) {
        await fs.promises.writeFile(gitignorePath, [
          'node_modules/',
          '.env',
          'dist/',
          'coverage/',
          '*.log',
          '.DS_Store',
          'package-lock.json',
        ].join('\n') + '\n', 'utf8');
        console.log('   📝 Created .gitignore');
      }

      // Stage all files
      await execAsync('git add -A', { cwd: worktreePath });

      // Check if there are changes to commit
      try {
        await execAsync('git diff --cached --quiet', { cwd: worktreePath });
        console.log('   ℹ️  No uncommitted build artifacts (Claude Code already committed)');
      } catch {
        // Exit code 1 = changes exist, commit them
        const safeTitle = rpTitle.replace(/"/g, '\\"');
        await execAsync(
          `git commit -m "Build: ${safeTitle} [GUPPI autonomous build]"`,
          { cwd: worktreePath }
        );
        console.log('   ✅ Build artifacts committed');
      }
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to commit build artifacts: ${error.message}`);
    }
  }

  /**
   * Generate README.md and commit it to worktree
   */
  private async generateAndCommitReadme(
    worktreePath: string,
    packet: any,
    buildResult: any,
    rpTitle: string,
    projectName: string,
    projectTier: number
  ): Promise<void> {
    try {
      console.log(`   📝 Generating README.md...`);
      
      // Extract vision context from constellation packet
      const visionContext = (() => {
        if (typeof packet !== 'string') return 'See .methodology/constellation-packet.md for full context';
        const lines = packet.split('\n');
        const objIdx = lines.findIndex((l: string) => l.match(/^#+\s*\d*\.?\s*Objective/i));
        if (objIdx >= 0) {
          const endIdx = lines.findIndex((l: string, i: number) => i > objIdx && l.match(/^#+\s/));
          const section = lines.slice(objIdx + 1, endIdx > 0 ? endIdx : objIdx + 15)
            .filter((l: string) => !l.startsWith('@@'))
            .join('\n').trim();
          if (section) return section;
        }
        return lines.filter((l: string) => !l.startsWith('@@') && l.trim()).slice(0, 10).join('\n');
      })();
      
      // Determine "how to run" instructions
      const changedFiles = buildResult.changedFiles || [];
      let howToRun = 'See files for usage instructions.';
      
      if (changedFiles.some((f: string) => f.includes('index.html'))) {
        howToRun = 'Open `index.html` in a web browser.';
      } else if (changedFiles.some((f: string) => f.includes('package.json'))) {
        howToRun = `\`\`\`bash
npm install
npm start
\`\`\``;
      } else if (changedFiles.some((f: string) => f.endsWith('.py'))) {
        const mainFile = changedFiles.find((f: string) => f.includes('main') || f.includes('app')) || changedFiles[0];
        howToRun = `\`\`\`bash
python ${mainFile}
\`\`\``;
      }
      
      // Generate README content
      const readme = `# ${rpTitle}

**Project:** ${projectName}  
**Tier:** ${projectTier}  
**Built by:** GUPPI (autonomous AI development pipeline)  
**Build cost:** ${buildResult.costUsd?.toFixed(2) || '0.00'}  
**Build date:** ${new Date().toISOString().split('T')[0]}

## What was requested

${visionContext}

## What was built

${buildResult.summary || 'Build completed successfully.'}

## Files changed

${changedFiles.map((f: string) => `- ${f}`).join('\n')}

## How to run

${howToRun}

---

*This project was built autonomously by GUPPI using Claude Code, PBCA Research, and the 10-step methodology.*
`;
      
      // Write README.md
      const readmePath = `${worktreePath}/README.md`;
      await fs.promises.writeFile(readmePath, readme, 'utf8');
      console.log(`   ✅ README.md written`);
      
      // Stage and commit README
      await execAsync('git add README.md', { cwd: worktreePath });
      await execAsync(
        'git commit -m "docs: Add README generated by GUPPI"',
        { cwd: worktreePath }
      );
      console.log(`   ✅ README.md committed`);
      
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to generate README: ${error.message}`);
      // Non-blocking: Don't fail the build if README generation fails
    }
  }

  /**
   * Push worktree branch to GitHub
  /**
   * Push worktree branch to GitHub
   * 
   * Non-blocking: Logs warnings but doesn't fail the build if push fails.
   */
  private async pushToGitHub(
    worktreePath: string,
    branchName: string
  ): Promise<{ url: string; branchName: string } | null> {
    const githubToken = process.env.GITHUB_TOKEN;
    
    // If no token, skip push
    if (!githubToken) {
      console.log(`   ⚠️  GITHUB_TOKEN not set — skipping push to GitHub`);
      console.log(`      Set GITHUB_TOKEN to enable automatic push`);
      return null;
    }
    
    // GitHub repo info (hardcoded for methodology-runner)
    const owner = 'bnjmnsmith6';
    const repo = 'methodology-runner';
    // GitHub URL will be constructed after we get the actual branch name
    
    try {
      // Get the actual current branch name (don't trust passed parameter)
      const { stdout: branchOutput } = await execAsync(
        'git branch --show-current',
        { cwd: worktreePath }
      );
      const actualBranch = branchOutput.trim();
      
      console.log(`   🌐 Pushing branch ${actualBranch} to GitHub...`);
      
      // Setup remote URL with token for authentication
      const remoteUrlWithToken = `https://${owner}:${githubToken}@github.com/${owner}/${repo}.git`;
      const remoteUrlPublic = `https://github.com/${owner}/${repo}.git`;
      
      // Check if origin remote exists (worktrees don't inherit remotes)
      let remoteExists = false;
      try {
        await execAsync('git remote get-url origin', { cwd: worktreePath });
        remoteExists = true;
        console.log(`   📡 Remote 'origin' exists, updating URL...`);
      } catch {
        console.log(`   📡 Remote 'origin' not found, adding it...`);
      }
      
      // Add or update the remote
      if (remoteExists) {
        await execAsync(
          `git remote set-url origin "${remoteUrlWithToken}"`,
          { cwd: worktreePath }
        );
      } else {
        await execAsync(
          `git remote add origin "${remoteUrlWithToken}"`,
          { cwd: worktreePath }
        );
      }
      
      // Push the branch
      await execAsync(
        `git push origin ${actualBranch} --force`,
        { cwd: worktreePath }
      );
      
      // Reset remote URL to non-authenticated version (remove token from git config)
      await execAsync(
        `git remote set-url origin "${remoteUrlPublic}"`,
        { cwd: worktreePath }
      ).catch(() => {
        // Don't fail if we can't reset the URL
      });
      
      console.log(`   ✅ Branch pushed successfully`);
      
      // Construct GitHub URL with actual branch name
      const githubUrl = `https://github.com/${owner}/${repo}/tree/${actualBranch}`;
      return { url: githubUrl, branchName: actualBranch };
      
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to push to GitHub: ${error.message}`);
      console.warn(`      Build succeeded, but code is only available locally`);
      return null;
    }
  }

  /**
   * Run smoke test
   */
  private async runSmoke(job: Job): Promise<ExecutionResult> {
    console.log(`\n🐶 Code Puppy: SMOKE_RUN`);
    console.log(`   RP: ${job.rp_id}`);
    
    // For v1: Simple smoke test - just verify the worktree exists and has files
    // Full smoke testing with test commands is a v2 enhancement
    try {
      const testCommand = job.input.test_command || 'npm test';
      console.log(`   ⚠️  SMOKE_RUN not fully implemented - would run: ${testCommand}`);
      
      // For now, return success
      return {
        status: 'SUCCEEDED',
        artifacts: [{
          rp_id: job.rp_id!,
          type: 'TEST_RESULTS',
          name: 'smoke-test.log',
          content: `Smoke test placeholder - would run: ${testCommand}`,
          metadata: { placeholder: true }
        }]
      };
    } catch (error: any) {
      return {
        status: 'FAILED',
        error: {
          kind: 'TEST_FAILED',
          message: error.message,
          retryable: true
        }
      };
    }
  }
}
