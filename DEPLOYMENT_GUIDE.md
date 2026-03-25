# Methodology Runner - Deployment Guide

## 🔗 GitHub Repository

**Repository URL:** https://github.com/bnjmnsmith6/methodology-runner

---

## 🚀 Railway Deployment

### Prerequisites
- Railway account ([railway.app](https://railway.app))
- Supabase project ([supabase.com](https://supabase.com))
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))
- OpenAI API key (optional, for PBCA research)

### Steps

1. **Connect GitHub Repository**
   - Go to [railway.app/new](https://railway.app/new)
   - Click "Deploy from GitHub repo"
   - Select `methodology-runner`
   - Railway will auto-detect `Dockerfile` and `railway.json`

2. **Set Environment Variables**
   
   Required:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key-here
   ANTHROPIC_API_KEY=sk-ant-...
   NODE_ENV=production
   ```
   
   Optional (for real PBCA research):
   ```
   OPENAI_API_KEY=sk-...
   USE_REAL_PBCA=true
   ```
   
   **DO NOT SET** (defaults to false in production):
   ```
   USE_REAL_CODEPUPPY=false
   ```
   
   > ⚠️ **Important:** `USE_REAL_CODEPUPPY` MUST be `false` in production.
   > Claude Code CLI cannot run in containers. Builds will use mock adapter.
   > For real builds, run the worker locally with Claude Code CLI installed.

3. **Deploy**
   - Click "Deploy"
   - Railway will build the Docker image and start the service
   - App will be available at: `https://methodology-runner-production.up.railway.app` (or similar)

4. **Verify Deployment**
   - Check Railway logs for "🚀 Methodology Runner started"
   - Visit `https://your-app.railway.app` to see chat interface
   - Chat interface runs on port 3000

---

## 🏠 Local Development

### With Real Code Puppy (Claude Code CLI)

1. **Install Claude Code CLI**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Clone and setup**
   ```bash
   git clone https://github.com/bnjmnsmith6/methodology-runner.git
   cd methodology-runner
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - SUPABASE_URL
   # - SUPABASE_KEY
   # - ANTHROPIC_API_KEY
   # - OPENAI_API_KEY (optional)
   # - USE_REAL_CODEPUPPY=true  ← Enable real builds
   # - USE_REAL_PBCA=true (optional)
   ```

4. **Run**
   ```bash
   npm start
   # or
   npm run dev  # with auto-reload
   ```

5. **Access**
   - Chat interface: http://localhost:3000
   - Worker runs in same process

### With Mock Adapters (No Claude Code CLI)

1. **Clone and setup** (same as above)

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and set:
   # - SUPABASE_URL
   # - SUPABASE_KEY
   # - ANTHROPIC_API_KEY
   # - USE_REAL_CODEPUPPY=false  ← Use mock (default)
   # - USE_REAL_PBCA=false (or omit, default is false)
   ```

3. **Run** (same as above)

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | ✅ | - | Supabase project URL |
| `SUPABASE_KEY` | ✅ | - | Supabase anon key |
| `ANTHROPIC_API_KEY` | ✅ | - | Claude API key for Brain adapter |
| `OPENAI_API_KEY` | ❌ | - | OpenAI API key (only if USE_REAL_PBCA=true) |
| `USE_REAL_PBCA` | ❌ | `false` | Use real OpenAI API for PBCA research |
| `USE_REAL_CODEPUPPY` | ❌ | `false` | Use real Claude Code CLI for builds |
| `PORT` | ❌ | `3000` | Server port |
| `NODE_ENV` | ❌ | `development` | Environment (development/production) |
| `WORKER_POLL_INTERVAL_MS` | ❌ | `2000` | Job polling interval |

### Adapter Behavior

**PBCA (Research)**
- `USE_REAL_PBCA=false`: Mock adapter (instant, no API calls)
- `USE_REAL_PBCA=true`: Real OpenAI GPT-4o (~40s, ~$0.04/run)

**Claude Brain (Review, Spec, Debug)**
- Always uses real Anthropic API (Claude Sonnet 4)
- No mock available (this is the core orchestrator)

**Code Puppy (Build)**
- `USE_REAL_CODEPUPPY=false`: Mock adapter (instant, no builds)
- `USE_REAL_CODEPUPPY=true`: Real Claude Code CLI (~60s, ~$0.18/run)
  - ⚠️ **Requires Claude Code CLI installed locally**
  - ⚠️ **Cannot run in Docker/Railway containers**

---

## 📊 Deployment Tiers

### Production (Railway)
- PBCA: Real or Mock (your choice)
- Claude Brain: Real (always)
- Code Puppy: Mock (required, no CLI in container)
- Cost per RP: ~$0.02-0.04

### Local Development (Full Power)
- PBCA: Real
- Claude Brain: Real
- Code Puppy: Real
- Cost per RP: ~$0.20-0.26

### Local Development (Budget Mode)
- PBCA: Mock
- Claude Brain: Real
- Code Puppy: Mock
- Cost per RP: ~$0.02 (just Claude Brain)

---

## 🎯 Workflow Tiers

The system supports 3 tiers of workflow rigor:

### Tier 1: Full Rigor
Steps: VISION → DECOMPOSE → **RESEARCH** → **REVIEW** → SPEC → BUILD → SMOKE → TEST → APPROVE → SHIP

**When to use:**
- High-risk features
- New domain areas
- Customer-facing changes

**Cost:** ~$0.26/RP (with real adapters)

### Tier 2: Balanced
Steps: VISION → DECOMPOSE → **RESEARCH (abbreviated)** → SPEC → BUILD → SMOKE → TEST → APPROVE → SHIP

**When to use:**
- Medium complexity
- Known domains
- Internal tools

**Cost:** ~$0.22/RP (with real adapters)

### Tier 3: Fast Path
Steps: VISION → DECOMPOSE → SPEC → BUILD → SMOKE → TEST → APPROVE → SHIP

**When to use:**
- Small changes
- Well-understood patterns
- Low-risk features

**Cost:** ~$0.20/RP (with real adapters)

---

## 🐛 Troubleshooting

### Railway deployment fails

**Error: `Cannot find module 'tsx'`**
- ✅ Fixed in Dockerfile: `npm ci --production=false` installs dev dependencies

**Error: `SUPABASE_URL is not defined`**
- Set environment variables in Railway dashboard

**Error: `Code Puppy adapter failed`**
- This is expected if `USE_REAL_CODEPUPPY=true` in Railway
- Set `USE_REAL_CODEPUPPY=false` (or omit, it's the default)

### Local development issues

**Error: `Cannot find module 'tsx'`**
- Run `npm install`

**Error: `claude-code: command not found`**
- Install Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- Or set `USE_REAL_CODEPUPPY=false` to use mock

**Worker not picking up jobs**
- Check Supabase connection
- Check database schema (run migrations if needed)
- Check logs for errors

---

## 📚 Further Reading

- [README.md](./README.md) - Project overview
- [TIER1_TEST_RESULTS_ALL_BUGS_FIXED.md](./TIER1_TEST_RESULTS_ALL_BUGS_FIXED.md) - Test results
- [BUG_RESOLUTION_SUMMARY.md](./BUG_RESOLUTION_SUMMARY.md) - Bug fixes

---

## 🐶 Support

For issues or questions:
- GitHub Issues: https://github.com/bnjmnsmith6/methodology-runner/issues
- See docs in `/docs` directory for detailed specs

---

**Built with ❤️ by Code Puppy (NEMO)**  
**Production-ready as of 2026-03-24**
