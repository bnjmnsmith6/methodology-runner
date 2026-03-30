# 🌐 GitHub Push Integration — Built Code Visibility

**Date:** 2025-03-25  
**Status:** ✅ IMPLEMENTED  
**Feature:** Automatic push of built code to GitHub after successful builds

---

## 🎯 Problem

After a successful `CODEPUPPY_BUILD`, the built code sits in `/tmp/rp-<uuid>/.worktrees/rp-<shortid>/` on the VPS with **no way for Ben to see it**.

The code exists only on the VPS filesystem:
- ❌ Not visible on GitHub
- ❌ Not accessible remotely
- ❌ No easy way to review or share
- ❌ Lost if VPS is recreated

---

## ✅ Solution

After every successful build, **automatically push the worktree branch to GitHub**.

**Flow:**
```
Build succeeds
    ↓
Code Puppy adapter pushes branch to GitHub
    ↓
GUPPI shows Ben a clickable GitHub URL
    ↓
Ben can review code in browser
```

---

## 🔧 Implementation

### **Location**
`src/adapters/code-puppy/real-codepuppy.ts`

### **New Method: `pushToGitHub()`**

```typescript
private async pushToGitHub(
  worktreePath: string,
  branchName: string
): Promise<{ url: string; branchName: string } | null>
```

**Called:** After successful build, before returning ExecutionResult  
**Branch name:** `rp-<shortid>` (e.g., `rp-9d4e1a5f`)  
**GitHub URL:** `https://github.com/bnjmnsmith6/methodology-runner/tree/<branch-name>`

### **Authentication**

Uses **HTTPS token authentication** (same approach as git operations).

**Environment variable:** `GITHUB_TOKEN`

**Setup:**
```bash
# Generate token at: https://github.com/settings/tokens
# Required permissions: repo (full control)

export GITHUB_TOKEN=ghp_your_token_here
```

**How it works:**
1. Update remote URL with token: `https://username:token@github.com/...`
2. Push the branch: `git push origin <branch-name> --force`
3. Reset remote URL to public version (remove token from git config)

---

## 📊 Behavior

### **Success (with GITHUB_TOKEN)**

```
🐶 Code Puppy: CODEPUPPY_BUILD
   RP: 9d4e1a5f-...
   📁 Repo root: /home/methodology-runner/repos/project-name
   🚀 Starting Claude Code build...
   📊 Build result: success
   📝 Summary: Built successfully...
   📁 Changed files: 15
   🌐 Pushing branch rp-9d4e1a5f to GitHub...
   ✅ Branch pushed successfully
   🌐 Pushed to GitHub: https://github.com/bnjmnsmith6/methodology-runner/tree/rp-9d4e1a5f
```

**Result:**
- ✅ Branch `rp-9d4e1a5f` pushed to GitHub
- ✅ Build metadata includes `githubUrl` and `branchName`
- ✅ GUPPI can show Ben: "View code: [GitHub link]"

### **Success (without GITHUB_TOKEN)**

```
🐶 Code Puppy: CODEPUPPY_BUILD
   RP: 9d4e1a5f-...
   📁 Repo root: /home/methodology-runner/repos/project-name
   🚀 Starting Claude Code build...
   📊 Build result: success
   📝 Summary: Built successfully...
   📁 Changed files: 15
   ⚠️  GITHUB_TOKEN not set — skipping push to GitHub
      Set GITHUB_TOKEN to enable automatic push
```

**Result:**
- ✅ Build succeeds
- ❌ Branch NOT pushed to GitHub
- ℹ️ Code exists only on VPS filesystem
- ℹ️ Warning logged, but build not failed

### **Push Failure (network/permissions error)**

```
🐶 Code Puppy: CODEPUPPY_BUILD
   RP: 9d4e1a5f-...
   📁 Repo root: /home/methodology-runner/repos/project-name
   🚀 Starting Claude Code build...
   📊 Build result: success
   📝 Summary: Built successfully...
   📁 Changed files: 15
   🌐 Pushing branch rp-9d4e1a5f to GitHub...
   ⚠️  Failed to push to GitHub: fatal: unable to access '...': Connection timeout
      Build succeeded, but code is only available locally
```

**Result:**
- ✅ Build succeeds (not failed due to push error)
- ❌ Branch NOT pushed to GitHub
- ⚠️ Warning logged
- ℹ️ Build metadata has `githubUrl: null`

---

## 🔐 Security

### **Token Handling**

**✅ Safe:**
- Token loaded from environment variable (not hardcoded)
- Token used only in memory (never written to disk)
- Remote URL reset after push (token removed from git config)

**❌ Never do:**
- Don't commit GITHUB_TOKEN to repository
- Don't log the token in console output
- Don't store token in git config permanently

### **Token Permissions**

**Minimum required:** `repo` (full control of private repositories)

**How to generate:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "Methodology Runner VPS"
4. Expiration: No expiration (or 1 year)
5. Scopes: Check `repo` (this includes push access)
6. Click "Generate token"
7. Copy token immediately (can't view again)

### **Revoking Access**

If token is compromised:
1. Go to https://github.com/settings/tokens
2. Find "Methodology Runner VPS"
3. Click "Delete"
4. Generate new token
5. Update `GITHUB_TOKEN` on VPS

---

## 📁 Build Metadata

### **Before (no GitHub visibility)**

```typescript
{
  status: 'SUCCEEDED',
  artifacts: [{
    rp_id: '9d4e1a5f-...',
    type: 'BUILD_LOG',
    name: 'build-output.md',
    content: 'Build succeeded...',
    metadata: {
      changedFiles: [...],
      testsRun: 12,
      commandsRun: ['npm install', 'npm test'],
      rawLogPath: '/tmp/build-9d4e1a5f.log',
      costUsd: 0.42,
      numTurns: 15,
      sessionId: 'abc-123'
    }
  }]
}
```

### **After (with GitHub URL)**

```typescript
{
  status: 'SUCCEEDED',
  artifacts: [{
    rp_id: '9d4e1a5f-...',
    type: 'BUILD_LOG',
    name: 'build-output.md',
    content: 'Build succeeded...',
    metadata: {
      changedFiles: [...],
      testsRun: 12,
      commandsRun: ['npm install', 'npm test'],
      rawLogPath: '/tmp/build-9d4e1a5f.log',
      costUsd: 0.42,
      numTurns: 15,
      sessionId: 'abc-123',
      githubUrl: 'https://github.com/bnjmnsmith6/methodology-runner/tree/rp-9d4e1a5f',  // NEW
      branchName: 'rp-9d4e1a5f'  // NEW
    }
  }]
}
```

**GUPPI can now show:**
```
✅ Build succeeded!
📦 Changed 15 files
🌐 View code: https://github.com/bnjmnsmith6/methodology-runner/tree/rp-9d4e1a5f
```

---

## 🚨 Error Handling

### **Non-Blocking Design**

**Core principle:** Push failures should **NEVER fail the build**.

**Why:**
- Build succeeded → code is valid
- GitHub is external dependency (network, permissions)
- Push can be done manually later if needed

### **Error Scenarios**

| Error | Behavior | Build Status |
|-------|----------|--------------|
| No GITHUB_TOKEN | Log warning, skip push | ✅ SUCCEEDED |
| Network timeout | Log warning, skip push | ✅ SUCCEEDED |
| Invalid token | Log warning, skip push | ✅ SUCCEEDED |
| Permission denied | Log warning, skip push | ✅ SUCCEEDED |
| Branch already exists | Force push (--force flag) | ✅ SUCCEEDED |

**All errors:**
- ⚠️ Logged as warnings (not errors)
- 📝 Build still marked as SUCCEEDED
- 💾 Code still exists on VPS filesystem
- 🔧 Can be manually pushed later

---

## 🧪 Testing

### **Test 1: Successful Push**

```bash
# Setup
export GITHUB_TOKEN=ghp_your_token_here
export USE_REAL_CODEPUPPY=true

# Run a Tier 3 build
npm run chat
# In chat: "Create Tier 3 project 'Test' with RP 'Hello World', start it"

# Expected output:
# ✅ Build succeeded
# 🌐 Pushed to GitHub: https://github.com/bnjmnsmith6/methodology-runner/tree/rp-<id>

# Verify:
# 1. Check GitHub: branch should exist
# 2. Check job metadata: githubUrl should be populated
```

### **Test 2: Missing Token**

```bash
# Setup
unset GITHUB_TOKEN
export USE_REAL_CODEPUPPY=true

# Run build (same as above)

# Expected output:
# ✅ Build succeeded
# ⚠️  GITHUB_TOKEN not set — skipping push to GitHub

# Verify:
# 1. Build status: SUCCEEDED
# 2. GitHub: no new branch
# 3. Job metadata: githubUrl = null
```

### **Test 3: Invalid Token**

```bash
# Setup
export GITHUB_TOKEN=invalid_token
export USE_REAL_CODEPUPPY=true

# Run build (same as above)

# Expected output:
# ✅ Build succeeded
# 🌐 Pushing branch...
# ⚠️  Failed to push to GitHub: ...authentication failed...

# Verify:
# 1. Build status: SUCCEEDED (not failed!)
# 2. Warning logged
# 3. Job metadata: githubUrl = null
```

### **Test 4: Manual Push After Failure**

If automatic push fails, you can manually push later:

```bash
# SSH to VPS
cd /home/methodology-runner/worktrees/rp-<shortid>

# Check branch
git branch
# Should show: * rp-<shortid>

# Push manually
git push origin rp-<shortid> --force
```

---

## 🔄 Branch Lifecycle

### **Creation**

- **When:** During `ensureWorktree()` in worktree-manager.ts
- **Name:** `rp-<shortid>` (first 8 chars of RP UUID)
- **Parent:** `main` branch
- **Commits:** All build changes committed by Code Puppy

### **Push**

- **When:** After successful build in real-codepuppy.ts
- **Method:** `git push origin <branch-name> --force`
- **Force flag:** Overwrites previous pushes (idempotent)

### **Cleanup**

**Current:** Branches persist indefinitely  
**Future (v2):** Add cleanup logic:
- Delete local worktree after RP completes
- Optionally delete remote branch after X days
- Or convert to PR automatically

---

## 📋 Environment Variables

### **GITHUB_TOKEN**

**Purpose:** Authenticate git push to GitHub  
**Required:** No (optional, but recommended for visibility)  
**Format:** `ghp_...` (GitHub personal access token)  
**Where to set:**
- Hetzner VPS: Add to `.env` file
- Railway: Not needed (worker disabled)

**Example:**
```bash
# In .env file
GITHUB_TOKEN=ghp_abcdef1234567890abcdef1234567890abcd
```

**Permissions needed:** `repo` (full control)

---

## 🎯 Benefits

### **Before (no push)**

- ❌ Code hidden on VPS filesystem
- ❌ Ben can't review without SSH
- ❌ No version control for built code
- ❌ Lost if VPS is recreated

### **After (with push)**

- ✅ Code visible on GitHub
- ✅ Ben can review in browser
- ✅ Persistent even if VPS is destroyed
- ✅ Can compare branches across RPs
- ✅ Easy to share with others
- ✅ GitHub Actions can run tests (future)

---

## 🚀 Future Enhancements

### **Automatic PR Creation (v2)**

Instead of just pushing a branch, automatically create a PR:

```typescript
// After push succeeds
await createPullRequest({
  owner: 'bnjmnsmith6',
  repo: 'methodology-runner',
  title: `[RP] ${rpTitle}`,
  head: branchName,
  base: 'main',
  body: `
    ## Automated Build
    
    RP: ${rpId}
    Project: ${projectName}
    
    ${buildSummary}
    
    ---
    *Generated by Methodology Runner*
  `
});
```

**Benefits:**
- Ben gets GitHub notification
- Can review in PR interface
- Can merge with one click
- CI/CD runs automatically

### **Branch Cleanup (v2)**

Add cleanup logic to prevent branch bloat:

```typescript
// After RP completes
if (rpState === 'COMPLETED' && buildSucceeded) {
  // Delete local worktree
  await deleteWorktree(rpId);
  
  // Optionally delete remote branch (after X days or if merged)
  if (shouldCleanupRemote(rpId)) {
    await deleteRemoteBranch(branchName);
  }
}
```

### **Diff Links (v2)**

Include a diff link in the metadata:

```typescript
metadata: {
  githubUrl: 'https://github.com/.../tree/rp-abc123',
  githubDiffUrl: 'https://github.com/.../compare/main...rp-abc123',  // NEW
}
```

GUPPI can show:
```
🌐 View code: [GitHub]
📊 View changes: [Diff]
```

---

## ✅ Summary

**What:** Automatic push of built code to GitHub after successful builds  
**Where:** `src/adapters/code-puppy/real-codepuppy.ts`  
**When:** After build succeeds, before returning result  
**How:** HTTPS token authentication via GITHUB_TOKEN env var  
**Safety:** Non-blocking (push failures don't fail the build)  

**Benefits:**
- ✅ Built code visible on GitHub
- ✅ Ben can review without SSH
- ✅ Persistent across VPS restarts
- ✅ Easy sharing and collaboration

**Setup:**
```bash
# Generate token: https://github.com/settings/tokens
# Add to VPS .env:
GITHUB_TOKEN=ghp_your_token_here
```

**Result:**
Every successful build now includes a clickable GitHub URL! 🚀
