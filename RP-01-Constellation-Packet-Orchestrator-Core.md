# Constellation Packet — RP-01: Orchestrator Core
**Project:** The Methodology Runner
**Tier:** 1
**Date:** 2026-03-23
**Prepared by:** Claude (Orchestrator)

---

## Context Block

The Methodology Runner is a workflow automation engine that replaces manual copy-paste routing between three AI agents (Claude API, OpenAI API, Claude Code CLI) with a stateful orchestrator. Ben talks to a single chat interface. The orchestrator decomposes work, calls agents, tracks state, and only surfaces decision points when human judgment is needed.

This Constellation Packet covers the **Orchestrator Core** — the workflow engine, database schema, job queue, decision system, and adapter interfaces. It does NOT implement the actual agent integrations (those are separate RPs). This build uses mock adapters that simulate agent responses so we can prove the workflow loop end-to-end.

**Tech Stack:** Node.js (TypeScript) + Supabase (Postgres) + local development on MacBook
**Repo:** Create fresh: `~/Projects/methodology-runner`

---

## Implementation Spec

### What to Build

A local Node.js application with three parts:

1. **Database layer** — Supabase Postgres schema with 4 core tables (projects, rps, jobs, decisions), plus a migrations system.

2. **Worker engine** — A process that polls the jobs table, picks work using row locks, executes via adapter interfaces, persists results, advances workflow state, and enqueues next steps. Handles lease expiration and reconciliation on startup.

3. **Reducer** — Pure logic module that takes current RP/project state and determines what should happen next: enqueue a job, create a decision, advance the step, or block.

4. **Adapter interfaces** — TypeScript interfaces for the three agents (Claude Brain, PBCA, Code Puppy) plus mock implementations that simulate realistic delays and responses. Real adapters are built in later RPs.

5. **Chat interface** — A simple Express server with a single chat endpoint. Ben sends a message, it goes to the Claude API with system prompt + tools. The tools let Claude read/write the database (check status, create projects, answer decisions, etc.). The Claude API IS the orchestrator brain — it uses the tools to manage the workflow. Responses stream back to a minimal browser-based chat UI.

### Build Order

**Phase 1: Foundation (build first, test in isolation)**

1. **Project scaffolding** — Initialize TypeScript project with `tsx` for running, `vitest` for testing. Set up Supabase client with environment variables.

2. **Database schema + migrations** — Create the 4 core tables in Supabase. Use a simple migration runner (raw SQL files executed in order). Tables:

```sql
-- projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  tier int not null check (tier in (1,2,3)),
  state text not null default 'DRAFT'
    check (state in ('DRAFT','ACTIVE','WAITING_DECISION','PAUSED','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- rps (research projects)
create table rps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  step int not null default 1 check (step between 1 and 10),
  step_status text not null default 'NOT_STARTED'
    check (step_status in ('NOT_STARTED','IN_PROGRESS','DONE','ERROR','SKIPPED')),
  state text not null default 'READY'
    check (state in ('READY','RUNNING','WAITING_DECISION','WAITING_TEST','COMPLETED','FAILED','CANCELED')),
  tier_override int null check (tier_override in (1,2,3)),
  priority int not null default 100,
  debug_cycle_count int not null default 0,
  max_debug_cycles int not null default 8,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- jobs (durable work queue)
create table jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rp_id uuid references rps(id) on delete cascade,
  type text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELED')),
  priority int not null default 100,
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5,
  locked_by text,
  locked_at timestamptz,
  lease_expires_at timestamptz,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- decisions (human-in-the-loop queue)
create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  rp_id uuid references rps(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING','ANSWERED','CANCELED','EXPIRED')),
  scope text not null check (scope in ('PROJECT','RP')),
  priority int not null default 100,
  title text not null,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  answered_at timestamptz,
  answer jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add indexes:
- `rps(project_id)`
- `rps(state, priority, updated_at)`
- `jobs(status, run_after, priority) where status='QUEUED'`
- `decisions(status, priority, created_at) where status='PENDING'`

3. **Core types** — Define TypeScript enums and types:

```typescript
// Step names mapped to numbers (canonical)
enum Step {
  VISION = 1,           // Ben describes what he wants
  DECOMPOSE = 2,        // Claude decomposes into RPs
  RESEARCH = 3,         // PBCA runs adversarial research
  REVIEW = 4,           // Claude reviews PBCA output
  SPEC = 5,             // Claude writes Constellation Packet
  BUILD = 6,            // Code Puppy builds from spec
  SMOKE = 7,            // Automated smoke test / verification
  TEST = 8,             // Ben acceptance test (loop target)
  DEBUG = 9,            // Claude + Code Puppy fix (loop partner)
  SHIP = 10             // Deploy, archive, close
}

// Job types that the worker can execute
enum JobType {
  PBCA_RESEARCH = 'PBCA_RESEARCH',
  CLAUDE_REVIEW = 'CLAUDE_REVIEW',
  CLAUDE_SPEC = 'CLAUDE_SPEC',
  CODEPUPPY_BUILD = 'CODEPUPPY_BUILD',
  SMOKE_RUN = 'SMOKE_RUN',
  CLAUDE_DEBUG = 'CLAUDE_DEBUG',
  CODEPUPPY_FIX = 'CODEPUPPY_FIX',
  SHIP = 'SHIP'
}

// What an adapter returns after execution
interface ExecutionResult {
  status: 'SUCCEEDED' | 'FAILED' | 'STOP_AND_ASK';
  artifacts?: ArtifactDraft[];
  error?: { kind: string; message: string; retryable: boolean };
  stopAndAsk?: { question: string; options: string[] };
}

// What the reducer outputs
interface NextAction {
  enqueueJobs?: JobDraft[];
  createDecision?: DecisionDraft;
  setRpState?: { state: string; step?: number; step_status?: string };
  setProjectState?: { state: string };
}
```

**Phase 2: Worker Engine (the core loop)**

4. **Lease management** — Functions:
   - `reconcileExpiredLeases()` — On startup and periodically: find jobs with `status='RUNNING'` and `lease_expires_at < now()`, set them back to `QUEUED` with `attempts + 1`. If attempts >= max_attempts, set to `FAILED` and create escalation decision.
   - `pickJob()` — Single transaction: `SELECT ... FROM jobs WHERE status='QUEUED' AND run_after <= now() ORDER BY priority ASC, created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`, then update to `RUNNING` with `locked_by`, `locked_at`, `lease_expires_at` (5 min default). Return the job.
   - `completeJob(id, result)` — Update job status, write output, clear lease fields.

5. **Worker loop** — A single async loop:
   ```
   while running:
     reconcileExpiredLeases()  // only on first iteration + every 60s
     job = pickJob()
     if no job: sleep 2s, continue
     adapter = getAdapter(job.type)
     result = adapter.execute(job)
     completeJob(job.id, result)
     handleResult(job, result)  // advance RP state, enqueue next, create decisions
   ```

   The `handleResult` function calls the Reducer to determine what happens next.

6. **Reducer** — Pure function, no side effects, fully testable:
   ```
   reducer.next(rp, project) -> NextAction
   ```

   Core logic (pseudocode):
   ```
   if rp.state == 'WAITING_DECISION': return blocked
   if rp.state == 'COMPLETED' or 'FAILED': return done

   current_step = rp.step
   tier = rp.tier_override ?? project.tier

   // Tier-based skipping
   if tier == 3 and current_step in [3, 4]:
     return { setRpState: { step: 5, step_status: 'NOT_STARTED' } }

   if tier == 2 and current_step == 3:
     // Light research — still runs but with abbreviated prompt
     return { enqueueJobs: [{ type: PBCA_RESEARCH, input: { abbreviated: true } }] }

   // Step completion -> advance
   if rp.step_status == 'DONE':
     if current_step == 10: return { setRpState: { state: 'COMPLETED' } }
     if current_step == 8 and test_failed:
       if rp.debug_cycle_count >= rp.max_debug_cycles:
         return { createDecision: escalation_decision }
       return { setRpState: { step: 9, step_status: 'NOT_STARTED' },
                increment debug_cycle_count }
     if current_step == 9:
       return { setRpState: { step: 8, step_status: 'NOT_STARTED' } }
     // Normal advance
     return { setRpState: { step: current_step + 1, step_status: 'NOT_STARTED' } }

   // Step not started -> enqueue appropriate job
   if rp.step_status == 'NOT_STARTED':
     job_type = STEP_TO_JOB_MAP[current_step]
     return { enqueueJobs: [{ type: job_type }],
              setRpState: { step_status: 'IN_PROGRESS', state: 'RUNNING' } }
   ```

7. **Decision service** — Functions:
   - `createDecision(draft)` — Insert into decisions table, set RP/Project to `WAITING_DECISION`
   - `answerDecision(id, answer)` — Update decision to `ANSWERED`, unblock RP/Project (set state to `READY`), enqueue a resume job if applicable
   - `getPendingDecisions()` — Return all `PENDING` decisions ordered by priority

**Phase 3: Adapter Interfaces + Mocks**

8. **Adapter interface** — Single interface all agents implement:
   ```typescript
   interface AgentAdapter {
     execute(job: Job): Promise<ExecutionResult>;
   }
   ```

9. **Mock adapters** — For each agent, create a mock that:
   - Waits a realistic delay (1-3 seconds)
   - Returns a plausible response shape
   - Sometimes returns errors (configurable failure rate)
   - Code Puppy mock occasionally returns `STOP_AND_ASK`

   These mocks let us test the entire workflow loop without spending API credits.

**Phase 4: Chat Interface**

10. **Express server** — Simple HTTP server with:
    - `POST /chat` — Accepts a message from Ben, calls Claude API with system prompt + tools, streams response back
    - `GET /` — Serves a minimal HTML chat page (single file, no framework)
    - WebSocket or SSE for streaming responses

11. **Claude system prompt for orchestrator** — The system prompt tells Claude it IS the orchestrator. It has access to tools that read/write the database:
    - `get_project_status` — Returns all projects, their RPs, states, pending decisions
    - `create_project` — Creates a new project with tier assignment
    - `create_rp` — Adds an RP to a project
    - `answer_decision` — Submits Ben's answer to a pending decision
    - `get_pending_decisions` — Lists what's waiting for Ben
    - `get_rp_detail` — Shows full state, artifacts, and history for an RP
    - `start_project` — Sets project to ACTIVE and triggers the workflow

    Claude uses these tools conversationally. Ben says "start a new project for auth on Mirror Mind, tier 2." Claude calls create_project + create_rp tools, confirms with Ben, and the worker picks it up.

12. **Minimal chat UI** — A single HTML file with:
    - A text input and send button
    - A message history area
    - Streaming response display
    - That's it. No framework. No components. Just functional.

### File Structure

```
methodology-runner/
├── package.json
├── tsconfig.json
├── .env                          # SUPABASE_URL, SUPABASE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY
├── src/
│   ├── db/
│   │   ├── client.ts             # Supabase client init
│   │   └── migrations/
│   │       └── 001_core_tables.sql
│   ├── core/
│   │   ├── types.ts              # All enums, interfaces, type definitions
│   │   ├── reducer.ts            # Pure logic: given state, what's next?
│   │   ├── scheduler.ts          # Enqueues jobs based on reducer output
│   │   ├── worker.ts             # Job pickup loop + execution
│   │   └── leases.ts             # Lease management + reconciliation
│   ├── services/
│   │   ├── decisions.ts          # Create, answer, list decisions
│   │   ├── artifacts.ts          # Write, version, query artifacts (stub for v1)
│   │   └── projects.ts           # Create projects/RPs, read status
│   ├── adapters/
│   │   ├── interface.ts          # AgentAdapter interface definition
│   │   ├── mock-pbca.ts          # Mock PBCA adapter
│   │   ├── mock-claude.ts        # Mock Claude Brain adapter
│   │   └── mock-codepuppy.ts     # Mock Code Puppy adapter
│   ├── chat/
│   │   ├── server.ts             # Express server + Claude API chat endpoint
│   │   ├── system-prompt.ts      # Orchestrator system prompt for Claude
│   │   └── tools.ts              # Tool definitions for Claude (DB read/write)
│   └── index.ts                  # Entry point: starts worker + chat server
├── public/
│   └── index.html                # Minimal chat UI (single file)
└── tests/
    ├── reducer.test.ts           # Unit tests for state machine logic
    ├── worker.test.ts            # Integration tests for job pickup/completion
    └── decisions.test.ts         # Tests for decision flow
```

### Contracts & Interfaces

**Job input/output shapes by type:**

```typescript
// PBCA_RESEARCH
input: { rp_title: string, rp_description: string, project_context: string, abbreviated?: boolean }
output: { research_output: string, key_findings: string[] }

// CLAUDE_REVIEW
input: { pbca_output: string, rp_context: string }
output: { review_summary: string, concerns: string[], validated: string[], changes: string[] }

// CLAUDE_SPEC
input: { review_output: string, rp_context: string, decisions_made: object[] }
output: { constellation_packet: string }

// CODEPUPPY_BUILD
input: { constellation_packet: string, repo_path: string }
output: { build_log: string, files_changed: string[], status: string }

// SMOKE_RUN
input: { repo_path: string, test_command?: string }
output: { passed: boolean, log: string }

// CLAUDE_DEBUG
input: { error_log: string, build_context: string }
output: { diagnosis: string, fix_instructions: string }

// CODEPUPPY_FIX
input: { fix_instructions: string, repo_path: string }
output: { build_log: string, files_changed: string[], status: string }
```

**Worker lease constants:**
```typescript
const LEASE_DURATION_MS = 5 * 60 * 1000;  // 5 minutes
const POLL_INTERVAL_MS = 2 * 1000;         // 2 seconds
const RECONCILE_INTERVAL_MS = 60 * 1000;   // 1 minute
const BACKOFF_BASE_MS = 5 * 1000;          // 5 second base for retry backoff
const BACKOFF_MAX_MS = 5 * 60 * 1000;      // 5 minute max backoff
```

---

## Constraints (What NOT to Do)

- DO NOT implement real agent integrations. Use mock adapters only. Real Claude/OpenAI/CLI adapters are separate RPs.
- DO NOT build a React app or any frontend framework. The chat UI is a single HTML file with vanilla JS.
- DO NOT add authentication, user management, or multi-tenant logic.
- DO NOT use an ORM. Use the Supabase JS client with raw queries or the query builder.
- DO NOT add Redis, Kafka, BullMQ, or any external queue infrastructure. Postgres IS the queue.
- DO NOT optimize for scale. This serves one user on one machine.
- DO NOT create the artifacts or agent_calls tables yet. Those are v1.1 additions after the core loop is proven.

---

## Stop and Ask List (This Build)

In addition to the Universal Rules, stop and report back if:

1. **Supabase connection issues.** If the Supabase client can't connect or the migration fails, stop. Don't try to work around it.
2. **Claude API streaming.** If streaming responses from the Claude API to the chat UI proves more complex than expected (CORS, SSE issues, etc.), stop and describe the problem. Don't build a workaround.
3. **Reducer ambiguity.** If any state transition in the reducer could go two ways and the spec doesn't clarify, stop. Don't guess.
4. **TypeScript config hell.** If ESM/CJS issues or tsconfig problems take more than 15 minutes, stop and describe the setup. Don't keep fighting it.

---

## Acceptance Criteria

- [ ] Running `npm run migrate` creates the 4 tables in Supabase
- [ ] Running `npm run worker` starts the job polling loop, reconciles expired leases, and picks/executes mock jobs
- [ ] Creating a Tier 1 project via the chat interface triggers the full 10-step workflow with mock adapters
- [ ] Creating a Tier 3 project via the chat interface skips steps 3-4 and goes straight to spec/build
- [ ] When a mock Code Puppy returns `STOP_AND_ASK`, the RP blocks and a decision appears in the chat when Ben asks "what needs my attention?"
- [ ] Answering a decision via chat unblocks the RP and the worker resumes
- [ ] The debug loop (steps 8-9) cycles correctly and escalates after max_debug_cycles
- [ ] Killing and restarting the worker process does not cause duplicate job execution or lost state
- [ ] The reducer has unit tests covering: normal step advancement, tier 3 skipping, debug loop, debug escalation, and decision blocking
- [ ] Ben can have a natural conversation with the orchestrator: "start a new project", "what's the status", "what needs my attention", "answer that decision with option B"

---

## Reference Material

- PBCA Research Output: RND/20 (state machine), RND/21 (schema), RND/05 (recommended approach), RND/09 (handoff spec)
- Methodology Playbook v1.0 (project tiering, workflow steps, Constellation Packet format)
- Mirror Mind Methodology Handoff (original 4-role description and workflow)
