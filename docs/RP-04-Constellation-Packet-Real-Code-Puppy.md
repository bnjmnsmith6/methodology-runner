# Constellation Packet — RP-04: Real Code Puppy (Claude Code CLI) Integration
**Project:** The Methodology Runner
**Tier:** 1
**Date:** 2026-03-24
**Prepared by:** Claude (Orchestrator), incorporating PBCA R&D output

---

## Context Block

The Methodology Runner runs end-to-end with real PBCA research (OpenAI), real Claude Brain review/spec/debug (Anthropic), and mock builds. This RP replaces MockCodePuppyAdapter with real Claude Code CLI execution. When this ships, the entire pipeline — from chat message to real code changes — runs autonomously.

PBCA research confirmed: Claude Code supports headless print mode (`-p`), structured JSON output with schema validation (`--json-schema`), permission control (`dontAsk` + allow/deny rules), git worktree isolation, and hooks for telemetry and guardrails. The recommended approach is a thin CLI runner using `child_process.spawn()`, with heartbeat-based lease renewal for long builds.

**Tech Stack:** Node.js (TypeScript) + Claude Code CLI (local) + Git worktrees + Supabase
**Repo:** `~/Documents/Puppy Projects/methodology-runner`

---

## Implementation Spec

### What to Build

A Code Puppy adapter that:
1. Resolves the local Claude Code executable at startup
2. Creates/reuses git worktrees per RP build lineage
3. Writes Constellation Packet files into the worktree
4. Spawns Claude Code in headless mode with structured JSON output
5. Renews the job lease via heartbeat while the build runs
6. Captures raw logs to disk and parses the final JSON result
7. Normalizes the result to a reducer-compatible outcome
8. Surfaces `needs_human` results as decisions

### Build Order

**Step 1: Types**

Create `src/adapters/code-puppy/types.ts`:

```typescript
export type BuildTerminalStatus = 'success' | 'failed' | 'needs_human' | 'infrastructure_error';

export interface BuildRunContext {
  projectId: string;
  rpId: string;
  jobId: string;
  executable: string;         // resolved path to claude or code-puppy
  repoRoot: string;           // project's git repo root
  worktreePath: string;       // isolated worktree for this RP
  branchName: string;         // branch for this RP lineage
  sessionId?: string;         // for session continuation across debug cycles
  packetPath: string;         // path to constellation packet in worktree
}

export interface NormalizedBuildResult {
  status: BuildTerminalStatus;
  summary: string;
  changedFiles: string[];
  commandsRun?: string[];
  testsRun?: string[];
  questionForHuman?: string;
  optionsForHuman?: string[];
  assumptionsUsed?: string[];
  sessionId?: string;
  costUsd?: number;
  numTurns?: number;
  rawLogPath: string;
}

// The JSON schema Claude Code must return
export const BUILD_RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['success', 'failed', 'needs_human'] },
    summary: { type: 'string' },
    changed_files: { type: 'array', items: { type: 'string' } },
    tests_run: { type: 'array', items: { type: 'string' } },
    commands_run: { type: 'array', items: { type: 'string' } },
    question_for_human: { type: 'string' },
    options_for_human: { type: 'array', items: { type: 'string' } },
    assumptions_used: { type: 'array', items: { type: 'string' } }
  },
  required: ['status', 'summary', 'changed_files']
};
```

**Step 2: Executable probe**

Create `src/adapters/code-puppy/probe.ts`:

On startup, resolve the Claude Code executable:
1. Try `code-puppy --version` — if it works, use `code-puppy`
2. If not, try `claude --version` — if it works, use `claude`
3. If neither works, log a warning and fall back to mock adapter
4. Store the resolved executable path and version for logging

```typescript
async function probeExecutable(): Promise<{ executable: string; version: string } | null>
```

Run this once at adapter initialization, not per job.

**Step 3: Worktree manager**

Create `src/adapters/code-puppy/worktree-manager.ts`:

Manages git worktrees for RP build isolation:

```typescript
async function ensureWorktree(repoRoot: string, rpId: string, rpTitle: string): Promise<string>
// Creates worktree at: <repoRoot>/.worktrees/rp-<rpId-short>
// Branch: methodology-runner/rp-<rpId-short>
// If worktree already exists (debug cycle reuse), return existing path
// If branch already exists, check it out in the worktree

async function cleanupWorktree(repoRoot: string, rpId: string): Promise<void>
// Only called on terminal success + artifacts archived, or explicit abandon
// Removes the worktree and optionally the branch
```

Naming convention:
- Worktree directory: `.worktrees/rp-<first 8 chars of rpId>`
- Branch name: `methodology-runner/rp-<first 8 chars of rpId>`

**Important:** The worktree needs a repo to work in. For v1, the "repo" is a target project directory that Ben specifies when creating the project. We need to add a `repo_path` field to the project or RP. For now, default to a directory under `~/Projects/methodology-runner-builds/<project-name>/`.

**Step 4: CLI runner**

Create `src/adapters/code-puppy/cli-runner.ts`:

The core subprocess execution:

```typescript
interface CliRunOptions {
  executable: string;
  worktreePath: string;
  prompt: string;
  schemaPath: string;
  systemPromptPath?: string;
  maxTurns?: number;           // default: 50
  maxBudgetUsd?: number;       // default: 2.00
  sessionId?: string;          // for debug cycle continuation
  allowedTools?: string[];
}

async function runClaude(options: CliRunOptions): Promise<{
  exitCode: number;
  rawLogPath: string;
  jsonResult: any | null;      // parsed JSON from stdout, or null if unparseable
  stderr: string;
}>
```

Implementation:
- Use `child_process.spawn()` — NOT `exec()` (exec buffers everything, spawn streams)
- Set `cwd` to the worktree path
- Build the command:
  ```bash
  <executable> -p \
    --output-format json \
    --json-schema <schemaPath> \
    --permission-mode dontAsk \
    --tools "Bash,Read,Edit,Write" \
    --allowedTools "Read,Edit,Write,Bash(git status *),Bash(git diff *),Bash(git add *),Bash(git commit *),Bash(npm install *),Bash(npm run *),Bash(npx *),Bash(pnpm *),Bash(yarn *),Bash(cat *),Bash(ls *),Bash(mkdir *)" \
    --max-turns <maxTurns> \
    --max-budget-usd <maxBudgetUsd> \
    <prompt>
  ```
- If `systemPromptPath` is provided, add `--append-system-prompt-file <path>`
- If `sessionId` is provided, add `--session-id <sessionId>` for debug continuation
- Stream stdout to a raw log file at: `<worktreePath>/.methodology/logs/build-<jobId>.log`
- Capture stderr separately
- On process exit, parse the final stdout as JSON
- If JSON parse fails, return `jsonResult: null`

**DO NOT use `--bare`** — it strips hooks, CLAUDE.md, and persona settings.
**DO NOT use `--dangerously-skip-permissions`** — use `dontAsk` with explicit allow rules.

**Step 5: Lease heartbeat**

Create `src/adapters/code-puppy/heartbeat.ts`:

While a build is running, renew the job's lease in Supabase:

```typescript
function startHeartbeat(jobId: string, intervalMs: number = 30000): { stop: () => void }
// Every intervalMs:
//   UPDATE jobs SET lease_expires_at = now() + interval '45 minutes'
//   WHERE id = jobId AND status = 'RUNNING'
// Stop when stop() is called or the job is no longer RUNNING
```

Also update the worker configuration: build jobs (`CODEPUPPY_BUILD`, `CODEPUPPY_FIX`) should have a lease duration of 45 minutes instead of the default 5 minutes.

**Step 6: Prompt assembler**

Create `src/adapters/code-puppy/prompt-assembler.ts`:

Prepares the build prompt and supporting files in the worktree:

```typescript
async function assembleBuildPrompt(
  worktreePath: string,
  constellationPacket: string,
  jobId: string
): Promise<{ prompt: string; schemaPath: string; systemPromptPath: string }>
```

This function:
1. Creates `.methodology/` directory in the worktree if it doesn't exist
2. Writes the Constellation Packet to `.methodology/constellation-packet.md`
3. Writes the result schema JSON to `.methodology/result-schema.json`
4. Writes a build system prompt to `.methodology/build-system-prompt.md`:
   ```
   You are Code Puppy, a build agent executing a Constellation Packet.

   Rules:
   1. Read the Constellation Packet at .methodology/constellation-packet.md
   2. Build EXACTLY what it specifies, in the order specified
   3. If anything is ambiguous and the choice matters, return status "needs_human"
      with your question — DO NOT guess silently
   4. Run any tests specified in the acceptance criteria
   5. When done, return your result as the required JSON schema

   Your result JSON MUST include:
   - status: "success" if all acceptance criteria pass, "failed" if tests/build fail,
     "needs_human" if you need clarification
   - summary: what you did
   - changed_files: list of files you created or modified
   - tests_run: list of test commands you ran and their results
   ```
5. Returns the CLI prompt: `"Read .methodology/constellation-packet.md and build what it specifies. Return the required JSON result when done."`

**Step 7: Result normalizer**

Create `src/adapters/code-puppy/normalize-result.ts`:

Takes the raw CLI output and produces a `NormalizedBuildResult`:

```typescript
function normalizeBuildResult(
  cliResult: { exitCode: number; rawLogPath: string; jsonResult: any | null; stderr: string },
  context: BuildRunContext
): NormalizedBuildResult
```

Logic:
- If `jsonResult` is not null and has a valid `status` field: use it directly
- If `jsonResult` is null (parse failed):
  - If exit code 0: return `infrastructure_error` with note "build appeared to succeed but no valid JSON result"
  - If exit code non-zero: return `failed` with stderr as summary
- If exit code non-zero but JSON says `success`: trust the JSON (Claude may have run successfully but the process had a non-zero exit for other reasons)
- Always include the `rawLogPath`
- Capture git diff stats after the run: `git diff --stat` in the worktree

**Step 8: Real Code Puppy adapter**

Create `src/adapters/code-puppy/real-codepuppy.ts`:

```typescript
class RealCodePuppyAdapter implements AgentAdapter {
  private executable: string | null = null;

  async initialize(): Promise<void> {
    const probe = await probeExecutable();
    if (probe) {
      this.executable = probe.executable;
      console.log(`🐶 Code Puppy: ${probe.executable} v${probe.version}`);
    } else {
      console.warn('⚠️ Claude Code not found — falling back to mock');
    }
  }

  async execute(job: Job): Promise<ExecutionResult> {
    if (!this.executable) {
      // Fall back to mock if executable not found
      return new MockCodePuppyAdapter().execute(job);
    }

    switch (job.type) {
      case 'CODEPUPPY_BUILD':
      case 'CODEPUPPY_FIX':
        return this.runBuild(job);
      case 'SMOKE_RUN':
        return this.runSmoke(job);
      default:
        return { status: 'FAILED', error: { kind: 'UNKNOWN', message: `Unknown job: ${job.type}`, retryable: false } };
    }
  }

  private async runBuild(job: Job): Promise<ExecutionResult> {
    // 1. Get the constellation packet from job.input
    const packet = job.input.constellation_packet;
    if (!packet) {
      return { status: 'FAILED', error: { kind: 'NO_SPEC', message: 'No constellation packet in job input', retryable: false } };
    }

    // 2. Determine repo root (from project config or default)
    const repoRoot = job.input.repo_path || `${process.env.HOME}/Projects/methodology-runner-builds/${job.input.project_name || 'default'}`;

    // 3. Ensure repo exists and has git init
    await ensureRepo(repoRoot);

    // 4. Create/reuse worktree
    const worktreePath = await ensureWorktree(repoRoot, job.rp_id!, job.input.rp_title || 'build');

    // 5. Assemble prompt files in worktree
    const { prompt, schemaPath, systemPromptPath } = await assembleBuildPrompt(worktreePath, packet, job.id);

    // 6. Start heartbeat
    const heartbeat = startHeartbeat(job.id);

    try {
      // 7. Run Claude Code
      const cliResult = await runClaude({
        executable: this.executable,
        worktreePath,
        prompt,
        schemaPath,
        systemPromptPath,
        sessionId: job.input.session_id,
        maxTurns: 50,
        maxBudgetUsd: 2.00
      });

      // 8. Normalize result
      const result = normalizeBuildResult(cliResult, {
        projectId: job.project_id,
        rpId: job.rp_id!,
        jobId: job.id,
        executable: this.executable,
        repoRoot,
        worktreePath,
        branchName: `methodology-runner/rp-${job.rp_id!.slice(0, 8)}`,
        packetPath: `${worktreePath}/.methodology/constellation-packet.md`
      });

      // 9. Map to ExecutionResult
      switch (result.status) {
        case 'success':
          return {
            status: 'SUCCEEDED',
            artifacts: [{
              type: 'BUILD_LOG',
              content: result.summary,
              metadata: {
                changedFiles: result.changedFiles,
                testsRun: result.testsRun,
                rawLogPath: result.rawLogPath,
                costUsd: result.costUsd,
                sessionId: result.sessionId
              }
            }]
          };

        case 'needs_human':
          return {
            status: 'STOP_AND_ASK',
            artifacts: [{
              type: 'BUILD_LOG',
              content: result.summary,
              metadata: { rawLogPath: result.rawLogPath }
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
              type: 'BUILD_LOG',
              content: result.summary,
              metadata: { rawLogPath: result.rawLogPath, changedFiles: result.changedFiles }
            }]
          };

        case 'infrastructure_error':
          return {
            status: 'FAILED',
            error: {
              kind: 'INFRA_ERROR',
              message: result.summary,
              retryable: true
            }
          };
      }
    } finally {
      // 10. Always stop heartbeat
      heartbeat.stop();
    }
  }

  private async runSmoke(job: Job): Promise<ExecutionResult> {
    // For SMOKE_RUN: run a simple verification command in the worktree
    // This could be `npm test`, `npm run build`, or a custom command from the spec
    // For v1: run `npm test` if package.json exists, otherwise return success
    // Use a short Claude Code run or just direct subprocess
    // Keep this simple — real smoke testing is a v2 enhancement
    const testCommand = job.input.test_command || 'npm test';
    // ... spawn the test command directly (not through Claude Code)
    // Return SUCCEEDED or FAILED based on exit code
  }
}
```

**Step 9: Adapter registry + env toggle**

Update `src/adapters/registry.ts`:
- Add `USE_REAL_CODEPUPPY` toggle from `.env`
- Import `RealCodePuppyAdapter`
- Route `CODEPUPPY_BUILD`, `CODEPUPPY_FIX`, `SMOKE_RUN` to real or mock
- Call `initialize()` on the real adapter at startup

Add to `.env`:
```
USE_REAL_CODEPUPPY=true
CODEPUPPY_MAX_TURNS=50
CODEPUPPY_MAX_BUDGET_USD=2.00
BUILD_LEASE_DURATION_MS=2700000  # 45 minutes
```

**Step 10: Reducer update for context chaining**

When CLAUDE_SPEC succeeds, the CODEPUPPY_BUILD job input must include:
```json
{
  "constellation_packet": "<the full spec text from CLAUDE_SPEC output>",
  "project_name": "...",
  "rp_title": "...",
  "repo_path": null,
  "session_id": null
}
```

When CLAUDE_DEBUG produces fix instructions, the CODEPUPPY_FIX job input must include:
```json
{
  "constellation_packet": "<original spec>",
  "fix_instructions": "<debug output fix instructions>",
  "project_name": "...",
  "rp_title": "...",
  "repo_path": "<same repo>",
  "session_id": "<previous session_id for continuity>"
}
```

### File Structure

```
src/adapters/code-puppy/
├── types.ts                   # BuildTerminalStatus, NormalizedBuildResult, schema
├── probe.ts                   # executable detection at startup
├── worktree-manager.ts        # create/reuse/cleanup git worktrees
├── cli-runner.ts              # spawn Claude Code with flags, capture output
├── heartbeat.ts               # lease renewal during long builds
├── prompt-assembler.ts        # write packet + schema + system prompt to worktree
├── normalize-result.ts        # CLI output → NormalizedBuildResult
├── real-codepuppy.ts          # adapter implementation
└── index.ts                   # exports

src/adapters/
├── registry.ts                # MODIFIED — add Code Puppy toggle
└── ...existing files unchanged

src/core/
├── reducer.ts                 # MODIFIED — pass spec to build, pass debug to fix
└── worker.ts                  # MODIFIED — longer lease for build jobs
```

---

## Constraints (What NOT to Do)

- DO NOT use `--bare` mode — it strips hooks, CLAUDE.md, and persona configuration
- DO NOT use `--dangerously-skip-permissions` or `bypassPermissions` — use `dontAsk` with explicit allow rules
- DO NOT use `child_process.exec()` — use `spawn()` for streaming
- DO NOT parse terminal prose to determine build outcome — use the JSON schema contract
- DO NOT run builds in the methodology-runner's own directory — use a separate builds directory with worktrees
- DO NOT allow Claude Code to write outside the worktree — use `--allowedTools` to restrict Bash commands
- DO NOT modify the PBCA or Claude Brain adapters
- DO NOT modify the database schema (job.output JSONB handles new fields)
- DO NOT build a full CI/CD system — this is a local build runner for one developer

---

## Stop and Ask List (This Build)

1. **Executable not found.** If neither `code-puppy` nor `claude` is available on Ben's PATH, stop. We need to know which command Ben uses.
2. **`--json-schema` flag not supported.** If the local Claude Code version doesn't support this flag, stop. We may need a different output strategy.
3. **`dontAsk` permission mode causes hangs.** If Claude Code hangs even in `dontAsk` mode, stop. The permission rules may need adjustment.
4. **Worktree creation fails.** If git worktree operations fail (not in a git repo, etc.), stop. The repo setup may need manual initialization.
5. **Build costs exceed $2 per run.** If a single build attempt costs more than the budget cap, stop and report before running more.

---

## Acceptance Criteria

- [ ] `USE_REAL_CODEPUPPY=true` causes real Claude Code CLI execution for BUILD and FIX jobs
- [ ] `USE_REAL_CODEPUPPY=false` falls back to mock adapter — no regressions
- [ ] At startup, the adapter probes for the executable and logs the version
- [ ] Build jobs run in isolated git worktrees (one per RP lineage)
- [ ] Debug cycle reuses the same worktree (no new worktree per attempt)
- [ ] Claude Code receives the Constellation Packet as a file in the worktree
- [ ] Claude Code returns structured JSON matching the result schema
- [ ] The JSON result is normalized to `success | failed | needs_human | infrastructure_error`
- [ ] `needs_human` results create decisions in the orchestrator
- [ ] Build jobs have a 45-minute lease with heartbeat renewal every 30 seconds
- [ ] Raw build logs are saved to disk at a known path
- [ ] Killing and restarting the worker mid-build does not leave zombie processes
- [ ] A successful build shows changed files in the job output
- [ ] All existing tests still pass
- [ ] A full Tier 1 project runs: real PBCA → real review → real spec → **real build** → test
