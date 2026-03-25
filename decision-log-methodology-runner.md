# Decision Log — The Methodology Runner

## DL-001: Event Architecture
**Date:** 2026-03-23
**Context:** PBCA presented 3 options for the orchestration model.
**Options Considered:**
- Option A: DB-backed job queue (polling worker) + Realtime UI — simple, durable, debuggable with SQL
- Option B: Event-sourced workflow (append-only events + reducer) — best audit trail but heavier to build
- Option C: In-process queue + periodic checkpoints — fast but fragile on crash
**Decision:** Option A — DB-backed job queue
**Rationale:** Minimal infrastructure (Postgres only), naturally durable, easy to debug with SQL, and the PBCA's red team analysis confirmed it handles all our failure modes. Event-sourcing can be added later as v2 enhancement.
**Consequences:** Must implement lease management and SKIP LOCKED carefully. No external queue infra needed.
**Revisit When:** If job volume exceeds what a single polling worker can handle (unlikely at our scale).

## DL-002: v1 Interface Model
**Date:** 2026-03-23
**Context:** Needed to decide how Ben interacts with the system.
**Options Considered:**
- CLI inbox (terminal commands)
- Tiny web dashboard (React or HTML)
- Conversational chat interface (Ben talks to Claude, Claude has DB tools)
**Decision:** Conversational chat interface
**Rationale:** Ben said "I only want to talk to the orchestrator." This is the most natural interaction for his workflow — no separate dashboard to check, no terminal commands to remember. Claude API with tools IS the UI.
**Consequences:** Chat interface needs to be built as part of RP-01. Claude system prompt needs tools for all DB operations. No separate decision inbox or dashboard needed.
**Revisit When:** If the chat interface proves too slow for quick status checks, add a lightweight status endpoint.

## DL-003: Schema Scope for v1
**Date:** 2026-03-23
**Context:** PBCA designed 7 tables. Needed to decide how many to build first.
**Options Considered:**
- All 7 tables from day one (projects, rps, jobs, decisions, artifacts, agent_calls, events)
- 4 core tables first (projects, rps, jobs, decisions)
**Decision:** 4 core tables first
**Rationale:** Prove the workflow loop works before adding observability and artifact management. Fewer tables = fewer things for Code Puppy to get wrong on the first build. Artifacts and agent_calls tables are additive — they can be migrated in without touching the core logic.
**Consequences:** No artifact versioning or cost tracking in v1. Build logs stored in job output JSON for now.
**Revisit When:** Core loop is proven and we start RP-02/03/04 (real agent integrations).
