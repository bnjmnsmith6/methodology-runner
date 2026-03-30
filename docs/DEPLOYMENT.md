# 🚀 Deployment Guide — Two-Server Architecture

**Date:** 2025-03-25  
**Architecture:** Split deployment (Railway + Hetzner VPS)  
**Status:** Production-ready  

---

## 🏗️ Architecture Overview

The Methodology Runner uses a **two-server split deployment**:

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Web Tier)                       │
│                                                             │
│  ✅ Chat Server (HTTP/WebSocket)                           │
│  ✅ GUPPI Brain (Claude orchestrator)                      │
│  ✅ Database access (Supabase)                             │
│  ❌ Worker DISABLED (WORKER_ENABLED=false)                 │
│                                                             │
│  Purpose: User-facing interface, always available          │
│  Cost: Railway hobby tier (~$5/mo)                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Database writes
                            ▼
                    ┌──────────────┐
                    │   Supabase   │
                    │  (Postgres)  │
                    └──────────────┘
                            ▲
                            │ Job polling
                            │
┌─────────────────────────────────────────────────────────────┐
│                 HETZNER VPS (Worker Tier)                   │
│                                                             │
│  ✅ Worker (job polling + execution)                       │
│  ✅ Claude Brain (spec/review/debug)                       │
│  ✅ Code Puppy (build/fix/test)                            │
│  ✅ PBCA Research (OpenAI API)                             │
│  ❌ Chat Server NOT NEEDED                                 │
│                                                             │
│  Purpose: Heavy compute, agent execution                    │
│  Cost: Hetzner CX11 (~$4/mo)                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Why Split Deployment?

### **Problem**
Railway's ephemeral filesystem conflicts with Code Puppy's need for persistent git worktrees.

### **Solution**
- **Railway:** Stateless chat server + GUPPI orchestration (worker disabled)
- **Hetzner VPS:** Stateful worker with persistent disk (runs Code Puppy builds)

### **Benefits**
1. ✅ **Chat always available** (Railway doesn't sleep during builds)
2. ✅ **Persistent git repos** (Hetzner has real disk)
3. ✅ **No file conflicts** (only VPS writes to worktrees)
4. ✅ **Cost-effective** (~$9/mo total vs. Railway Pro $20/mo)

---

## 🔧 Environment Variables

### **WORKER_ENABLED**

Controls whether the worker loop starts.

**Railway (Web Tier):**
```bash
WORKER_ENABLED=false
```
- Chat server starts ✅
- Worker loop skips startup ❌
- GUPPI can queue jobs via chat
- Jobs sit in database until VPS picks them up

**Hetzner VPS (Worker Tier):**
```bash
WORKER_ENABLED=true
# or omit entirely (defaults to true)
```
- Worker loop starts ✅
- Polls database for jobs
- Executes via adapters (PBCA, Claude, Code Puppy)
- Chat server can optionally start (not needed)

---

## 📋 Railway Setup (Chat Server Only)

### **1. Environment Variables**

Set these in Railway dashboard:

```bash
# === CORE CONFIGURATION ===
WORKER_ENABLED=false
NODE_ENV=production
PORT=3000

# === DATABASE ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# === AI PROVIDERS ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# === CODE PUPPY (not used on Railway, but required for imports) ===
CODE_PUPPY_REPO_PATH=/tmp/repos
CODE_PUPPY_CLI_PATH=/tmp/code-puppy
CODE_PUPPY_HEARTBEAT_INTERVAL=30000
CODE_PUPPY_WORKTREE_ROOT=/tmp/worktrees

# === OPTIONAL: REAL AGENTS ===
USE_REAL_PBCA=false
USE_REAL_CLAUDE=false
USE_REAL_CODEPUPPY=false
```

### **2. Build Configuration**

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run start:prod
```

### **3. Verify Chat Server**

```bash
# Check Railway logs
railway logs

# Should see:
# ⚠️  Worker disabled via WORKER_ENABLED=false — running chat server only
# 🚀 Chat server listening on http://localhost:3000
```

### **4. Test from Browser**

Visit: `https://your-app.railway.app`

Should see GUPPI chat interface. Test:
```
What's the status?
```

GUPPI should respond (reading from database), but no jobs will execute (worker is disabled).

---

## 🖥️ Hetzner VPS Setup (Worker Only)

### **1. Server Specs**

**Recommended:** Hetzner Cloud CX11
- 1 vCPU
- 2 GB RAM
- 20 GB SSD
- Cost: ~$4/mo
- Location: Choose closest to Ben's location

### **2. Initial Setup**

```bash
# SSH into VPS
ssh root@your-vps-ip

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Git
apt-get install -y git

# Create app user
useradd -m -s /bin/bash methodology-runner
su - methodology-runner

# Clone repo
git clone https://github.com/bnjmnsmith6/methodology-runner.git
cd methodology-runner
```

### **3. Environment Variables**

Create `.env` file:

```bash
# === CORE CONFIGURATION ===
WORKER_ENABLED=true
NODE_ENV=production

# === DATABASE ===
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# === AI PROVIDERS ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# === CODE PUPPY ===
CODE_PUPPY_REPO_PATH=/home/methodology-runner/repos
CODE_PUPPY_CLI_PATH=/home/methodology-runner/code-puppy
CODE_PUPPY_HEARTBEAT_INTERVAL=30000
CODE_PUPPY_WORKTREE_ROOT=/home/methodology-runner/worktrees

# === REAL AGENTS ===
USE_REAL_PBCA=true
USE_REAL_CLAUDE=true
USE_REAL_CODEPUPPY=true
```

### **4. Install Dependencies**

```bash
npm install
npm run build
```

### **5. Setup Systemd Service**

Create `/etc/systemd/system/methodology-runner.service`:

```ini
[Unit]
Description=Methodology Runner Worker
After=network.target

[Service]
Type=simple
User=methodology-runner
WorkingDirectory=/home/methodology-runner/methodology-runner
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
systemctl daemon-reload
systemctl enable methodology-runner
systemctl start methodology-runner
```

### **6. Verify Worker**

```bash
# Check logs
journalctl -u methodology-runner -f

# Should see:
# 🚀 Worker starting...
# ✅ Reconciled 0 expired lease(s)
# [polling for jobs...]
```

### **7. Test Job Execution**

From Railway chat interface:
```
Create a Tier 3 project called "Test Build" with one RP 
"Create hello.py script", and start it.
```

**Expected:**
- Railway: GUPPI queues jobs to database
- Hetzner VPS: Worker picks up jobs and executes
- Check VPS logs for:
  ```
  📋 Picked job: CLAUDE_SPEC (abc-123)
     RP: def-456
     📊 Telemetry: Started pipeline run xyz-789
     ⚙️  Executing via adapter...
     ✅ Result: SUCCEEDED
  ```

---

## 🔍 Monitoring

### **Railway (Chat Server)**

**Health Check:**
```bash
curl https://your-app.railway.app/health
# Should return 200 OK
```

**Logs:**
```bash
railway logs --tail 100
```

**Metrics:**
- Railway dashboard shows: uptime, memory, CPU
- Should be idle (no worker = low resource usage)

### **Hetzner VPS (Worker)**

**Health Check:**
```bash
systemctl status methodology-runner
```

**Logs:**
```bash
# Real-time
journalctl -u methodology-runner -f

# Last 100 lines
journalctl -u methodology-runner -n 100
```

**Metrics:**
```bash
# CPU/Memory
htop

# Disk usage
df -h /home/methodology-runner/worktrees
```

### **Database (Supabase)**

**Job Queue:**
```sql
SELECT 
  type, 
  status, 
  COUNT(*) as count 
FROM jobs 
GROUP BY type, status;
```

**Worker Health:**
```sql
-- Check for stuck jobs (leased but expired)
SELECT * FROM jobs 
WHERE status = 'RUNNING' 
  AND lease_expires_at < NOW();

-- Should be empty (worker reconciles these)
```

---

## 🚨 Troubleshooting

### **Railway: "Worker disabled" but jobs aren't executing**

**Cause:** VPS worker is down or not polling  
**Fix:**
```bash
# SSH to VPS
systemctl status methodology-runner
systemctl restart methodology-runner
```

### **Hetzner VPS: Worker crashes on Code Puppy build**

**Cause:** Disk full (worktrees accumulate)  
**Fix:**
```bash
# Clean old worktrees
cd /home/methodology-runner/worktrees
rm -rf */

# Or add cron job to clean weekly:
0 0 * * 0 find /home/methodology-runner/worktrees -type d -mtime +7 -exec rm -rf {} \;
```

### **Railway: "Error: Cannot connect to database"**

**Cause:** Supabase URL/key incorrect  
**Fix:**
1. Check Railway env vars
2. Verify Supabase project is active
3. Regenerate anon key if needed

### **Both servers: Jobs stuck in QUEUED state**

**Cause:** No worker is enabled  
**Check:**
- Railway: `WORKER_ENABLED` should be `false` ✅
- Hetzner VPS: `WORKER_ENABLED` should be `true` or unset ✅
- VPS systemd service: `systemctl status methodology-runner` should be running ✅

---

## 💰 Cost Breakdown

| Service | Tier | Cost/Month | Purpose |
|---------|------|------------|---------|
| Railway | Hobby | ~$5 | Chat server (always-on) |
| Hetzner | CX11 | ~$4 | Worker + Code Puppy |
| Supabase | Free | $0 | Database (500 MB limit) |
| **Total** | | **~$9/mo** | Full production setup |

**Compare to alternatives:**
- Railway Pro (worker + chat): $20/mo
- Vercel + background worker: $20+/mo
- AWS Lambda + RDS: $30+/mo

---

## 🔐 Security

### **Railway (Public-Facing)**

- ✅ HTTPS enforced automatically
- ✅ Environment variables encrypted at rest
- ✅ No sensitive files in repo
- ⚠️ No authentication on chat (add if needed)

### **Hetzner VPS (Internal)**

- ✅ Firewall: Block all inbound except SSH (port 22)
- ✅ SSH key-only authentication (disable password)
- ✅ Environment variables in `.env` file (not in repo)
- ⚠️ No public ports needed (worker polls database)

**Firewall rules:**
```bash
# Allow SSH only
ufw allow 22/tcp
ufw enable

# Verify
ufw status
```

---

## 🔄 Updates & Deployments

### **Railway (Auto-Deploy)**

Railway auto-deploys on `git push` to main branch.

**Manual deploy:**
```bash
railway up
```

### **Hetzner VPS (Manual Deploy)**

```bash
# SSH to VPS
ssh methodology-runner@your-vps-ip

# Pull latest code
cd ~/methodology-runner
git pull origin main

# Rebuild
npm install
npm run build

# Restart service
sudo systemctl restart methodology-runner

# Check logs
journalctl -u methodology-runner -f
```

**Automate with cron (optional):**
```bash
# Add to crontab
0 2 * * * cd ~/methodology-runner && git pull && npm install && npm run build && sudo systemctl restart methodology-runner
```

---

## 📊 Scaling Considerations

### **When to Scale Up**

**Railway (Chat Server):**
- If response time > 2s → Upgrade to Railway Pro ($20/mo)
- Currently: Hobby tier is sufficient (stateless, low traffic)

**Hetzner VPS (Worker):**
- If jobs queue up > 10 minutes → Add another VPS worker
- If builds fail due to OOM → Upgrade to CX21 (4 GB RAM, $8/mo)
- Currently: CX11 handles 1 concurrent build comfortably

### **Horizontal Scaling (Multiple Workers)**

The system supports **multiple workers** polling the same database (lease-based locking prevents duplicates).

**To add a second worker:**
1. Spin up another Hetzner VPS (CX11)
2. Same setup as first VPS
3. Both workers poll same database
4. Jobs distributed via lease mechanism

**Example with 2 workers:**
```
Railway (chat) → Supabase (jobs queue)
                      ↓
              ┌───────┴────────┐
              ▼                ▼
         VPS Worker 1    VPS Worker 2
```

---

## 🧪 Testing the Split Deployment

### **Step 1: Deploy Railway**

```bash
# Set WORKER_ENABLED=false in Railway dashboard
# Deploy via git push or Railway CLI
railway up
```

**Test:**
```
curl https://your-app.railway.app
# Should return chat interface HTML
```

### **Step 2: Deploy Hetzner VPS**

```bash
# SSH to VPS
# Setup as per "Hetzner VPS Setup" section above
# Start systemd service
systemctl start methodology-runner
```

**Test:**
```bash
journalctl -u methodology-runner -f
# Should see: 🚀 Worker starting...
```

### **Step 3: End-to-End Test**

**From Railway chat:**
```
Create a Tier 3 project "Split Test" with RP "Hello World", start it
```

**Expected behavior:**
1. Railway: GUPPI queues jobs to Supabase ✅
2. Hetzner VPS: Worker picks job within 2 seconds ✅
3. Hetzner VPS: Executes build ✅
4. Railway: GUPPI shows updated status ✅

**Check Railway logs:**
```
⚠️  Worker disabled via WORKER_ENABLED=false — running chat server only
🚀 Chat server listening on http://localhost:3000
```

**Check VPS logs:**
```
🚀 Worker starting...
📋 Picked job: CLAUDE_SPEC (abc-123)
✅ Result: SUCCEEDED
```

---

## ✅ Summary

The two-server architecture provides:
- ✅ **Always-available chat** (Railway never sleeps)
- ✅ **Persistent builds** (Hetzner has real disk)
- ✅ **Cost-effective** ($9/mo vs. $20+/mo)
- ✅ **Scalable** (add more VPS workers as needed)

**Railway:** User interface (WORKER_ENABLED=false)  
**Hetzner VPS:** Job execution (WORKER_ENABLED=true)  
**Supabase:** Job queue (both read/write)

**Ready for production!** 🚀
