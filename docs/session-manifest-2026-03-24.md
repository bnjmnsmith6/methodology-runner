# Session Manifest — 2026-03-24

## Session Focus
Build The Methodology Runner from zero to working autonomous pipeline across two sessions.

## What Shipped
- RP-01: Orchestrator Core (Supabase, worker, reducer, decisions, chat UI)
- RP-02: Real PBCA Integration (OpenAI GPT-4o API)
- RP-03: Real Claude Brain Integration (Anthropic Sonnet — review, spec, debug)
- RP-04: Real Code Puppy Integration (Claude Code CLI v2.1.81 — headless builds)
- 10 bug fixes (chat tool-calling, REDO loop, decision-to-spec flow, orphan scanner, step advancement, race condition, JSON parser, CLI flags, Tier 3 spec context, model string)

## What's Working
- Full Tier 1 pipeline: chat → real PBCA research → real Claude review → real Claude spec → real Claude Code build → smoke → test approval → ship
- Full Tier 3 pipeline: chat → spec → real build → smoke → test approval → ship
- Decision surfacing and resolution via chat
- Git worktree isolation per RP
- Heartbeat lease renewal for long builds
- Crash recovery via lease reconciliation
- Cost: ~$0.25/RP

## Projects Completed Through Pipeline
1. Hello World (Tier 3) — hello.js written, tested, committed, shipped
2. Status API (Tier 1) — Flask API, 7 files, 5 tests, full methodology run

## Decisions Made
- DL-001: DB-backed job queue (not event-sourcing or in-process)
- DL-002: Conversational chat interface (not CLI inbox or dashboard)
- DL-003: 4 core tables first (not all 7)
- Claude Sonnet for all brain calls (not Opus)
- GPT-4o for PBCA (not o1)
- dontAsk permission mode for Claude Code (not bypassPermissions)
- Marker header parsing for review verdicts (not JSON mode)
- Stdin pipe for Claude Code prompts (not positional args)
- No --json-schema flag (prompt-based JSON instead)

## Known Debt
- Decision card extraction doesn't populate options properly (shows generic text)
- Chat UI doesn't render markdown (shows raw ** instead of bold)
- Fake ID generation by Sonnet (self-corrects but wastes a tool call)
- PBCA automated prompts lack rich context (need vision conversation mode)
- Artifacts not stored persistently (in job output JSON only)
- SMOKE_RUN is mocked (passes automatically)
- SHIP step doesn't do anything real (no merge, no deploy)
- Builds go to /tmp (lost on reboot)
- System only runs while laptop is open

## Next Session Priorities (Ordered)
1. Deploy to Railway/VPS ($5/mo) so it runs 24/7
2. Chat UI formatting (markdown rendering, visual hierarchy for ADHD/dyslexia)
3. Vision conversation mode (intelligent questioning before project creation)
4. Live dashboard (real-time project status view)
5. Mobile PWA

## Active Project Tiers
- The Methodology Runner: Tier 1 — v1 SHIPPED, polish and deployment next
