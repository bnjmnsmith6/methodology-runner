# Methodology Runner

> **Status:** ✅ FULLY OPERATIONAL (All phases complete!)

Workflow orchestration engine for multi-agent methodology execution. Autonomously manages Ben's 10-step development workflow across multiple AI agents.

## Quick Start

```bash
# Install dependencies (already done)
npm install

# Start worker + chat server
npm start
```

Then open: **http://localhost:3000**

## What It Does

- 🤖 **Autonomous Workflow** — Executes the 10-step methodology automatically
- 🎯 **Tier-Based** — Tier 1 (full rigor), Tier 2 (standard), Tier 3 (fast track)
- 💬 **Chat Interface** — Talk naturally with Claude as your orchestrator
- 🔄 **Crash Recovery** — Lease-based job management with auto-recovery
- 🙋 **Human-in-the-Loop** — Surfaces decisions when needed

## The 10-Step Workflow

1. **VISION** — Ben describes what he wants
2. **DECOMPOSE** — Break work into Research Projects (RPs)
3. **RESEARCH** — PBCA runs adversarial research
4. **REVIEW** — Claude reviews PBCA output
5. **SPEC** — Claude writes Constellation Packet
6. **BUILD** — Code Puppy builds from spec
7. **SMOKE** — Automated smoke testing
8. **TEST** — Ben acceptance test
9. **DEBUG** — Fix issues (loops to step 8)
10. **SHIP** — Deploy and archive

## Example Commands

Try these in the chat:
- `What's the status?`
- `Start a new project for adding authentication, tier 2`
- `What needs my attention?`
- `Show me details for that RP`

## Build Status

✅ **Phase 1: Foundation** — Database, types, scaffolding  
✅ **Phase 2: Worker Engine** — Job polling, reducer, state machine  
✅ **Phase 3: Adapters** — Mock implementations for all agents  
✅ **Phase 4: Chat Interface** — Express server + Claude orchestrator  

**Tests:** 12/12 passing  
**Type Safety:** No errors  
**System Startup:** Verified

## Architecture

```
Chat UI (Browser) 
    ↓ 
Express + Claude API (Orchestrator Brain)
    ↓
Supabase (Postgres) - 4 tables
    ↑
Worker Process (Job Polling)
    ↓
Mock Adapters (PBCA, Claude, Code Puppy)
```

## Current Implementation

**Using mock adapters** that simulate:
- PBCA research (1-2 second delays)
- Claude Brain (review/spec/debug)
- Code Puppy (build/fix/test with occasional STOP_AND_ASK)

Future RPs will replace mocks with real agent integrations.

## Documentation

- **BUILD_COMPLETE.md** — Comprehensive build report
- **SESSION_COMPLETE.md** — Session summary
- **RP-01-Constellation-Packet-Orchestrator-Core.md** — Original spec

## Project Structure

```
methodology-runner/
├── src/
│   ├── db/          # Database layer
│   ├── core/        # Worker engine & state machine
│   ├── services/    # Business logic
│   ├── adapters/    # Agent interfaces (mocks)
│   ├── chat/        # Orchestrator UI
│   └── index.ts     # Entry point
├── public/          # Chat UI
├── tests/           # Unit tests
└── ...
```

## Development

```bash
npm run dev          # Dev mode with auto-reload
npm run worker       # Worker only
npm test            # Run tests
npm run typecheck   # Type checking
```

## Environment Variables

```
SUPABASE_URL=...
SUPABASE_KEY=...
ANTHROPIC_API_KEY=...
PORT=3000
```

## License

MIT

---

**Built with:** TypeScript, Node.js, Supabase, Claude API, Express  
**Built by:** NEMO 🐶 following Constellation Packet RP-01  
**Status:** Ready for testing with mock adapters!
