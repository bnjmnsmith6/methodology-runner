/**
 * Git worktree manager - isolates RP builds
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);
/**
 * Slugify a string for use in branch names
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric and hyphens)
 * - Truncate to 50 chars
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')      // Remove special characters
    .replace(/-+/g, '-')             // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')           // Remove leading/trailing hyphens
    .slice(0, 50);                   // Truncate to 50 chars
}


/**
 * Ensure a git repository exists at the given path
 */
export async function ensureRepo(repoRoot: string): Promise<void> {
  // Create directory if it doesn't exist
  if (!existsSync(repoRoot)) {
    mkdirSync(repoRoot, { recursive: true });
  }
  
  // Check if it's already a git repo
  try {
    await execAsync('git rev-parse --git-dir', { cwd: repoRoot });
    // Already a repo
    return;
  } catch (error) {
    // Not a repo yet, initialize
    console.log(`   📁 Initializing git repo at: ${repoRoot}`);
    await execAsync('git init', { cwd: repoRoot });
    
    // Create initial commit to establish main branch
    await execAsync('git config user.email "methodology-runner@local"', { cwd: repoRoot });
    await execAsync('git config user.name "Methodology Runner"', { cwd: repoRoot });
    await execAsync('echo "# Build Workspace" > README.md', { cwd: repoRoot });
    await execAsync('git add README.md', { cwd: repoRoot });
    await execAsync('git commit -m "Initial commit"', { cwd: repoRoot });
  }
}

/**
 * Create or reuse a git worktree for an RP
 * 
 * Branch name: guppi-builds/{slugified-title}
 * If branch exists, append short ID: guppi-builds/{slugified-title}-{shortid}
 * Worktree path: <repoRoot>/.worktrees/{branch-name-without-prefix}
 */
export async function ensureWorktree(
  repoRoot: string,
  rpId: string,
  rpTitle: string
): Promise<string> {
  const rpIdShort = rpId.slice(0, 8);
  const slugifiedTitle = slugify(rpTitle);
  
  // Try base branch name first
  let branchName = `guppi-builds/${slugifiedTitle}`;
  let branchExists = false;
  
  // Check if branch already exists
  try {
    await execAsync(`git rev-parse --verify ${branchName}`, { cwd: repoRoot });
    branchExists = true;
    // Branch exists, append short ID to make it unique
    branchName = `guppi-builds/${slugifiedTitle}-${rpIdShort}`;
    console.log(`   📝 Branch ${slugifiedTitle} exists, using ${branchName}`);
  } catch (error) {
    // Branch doesn't exist, use base name
    console.log(`   📝 Using branch name: ${branchName}`);
  }
  
  // Worktree name is branch name without the prefix
  const worktreeName = branchName.replace('guppi-builds/', '');
  const worktreePath = path.join(repoRoot, '.worktrees', worktreeName);
  
  // Check if worktree already exists
  if (existsSync(worktreePath)) {
    console.log(`   🔄 Reusing existing worktree: ${worktreePath}`);
    return worktreePath;
  }
  
  // Create .worktrees directory if needed
  const worktreesDir = path.join(repoRoot, '.worktrees');
  if (!existsSync(worktreesDir)) {
    mkdirSync(worktreesDir, { recursive: true });
  }
  
  // Check again if this specific branch exists (in case we changed it)
  branchExists = false;
  try {
    await execAsync(`git rev-parse --verify ${branchName}`, { cwd: repoRoot });
    branchExists = true;
  } catch (error) {
    // Branch doesn't exist
  }
  
  if (branchExists) {
    // Create worktree from existing branch
    console.log(`   🌿 Creating worktree from existing branch: ${branchName}`);
    await execAsync(`git worktree add ${worktreePath} ${branchName}`, { cwd: repoRoot });
  } else {
    // Create new worktree with new branch
    console.log(`   🌿 Creating new worktree and branch: ${branchName}`);
    await execAsync(`git worktree add -b ${branchName} ${worktreePath}`, { cwd: repoRoot });
  }
  
  console.log(`   ✅ Worktree ready at: ${worktreePath}`);
  return worktreePath;
}

/**
 * Clean up a worktree (called on terminal success or explicit abandon)
 */
export async function cleanupWorktree(repoRoot: string, rpId: string): Promise<void> {
  const rpIdShort = rpId.slice(0, 8);
  const worktreeName = `rp-${rpIdShort}`;
  const worktreePath = path.join(repoRoot, '.worktrees', worktreeName);
  const branchName = `methodology-runner/rp-${rpIdShort}`;
  
  if (!existsSync(worktreePath)) {
    console.log(`   ℹ️  Worktree already removed: ${worktreePath}`);
    return;
  }
  
  try {
    // Remove worktree
    console.log(`   🗑️  Removing worktree: ${worktreePath}`);
    await execAsync(`git worktree remove ${worktreePath}`, { cwd: repoRoot });
    
    // Optionally delete branch (for now, keep it for history)
    // await execAsync(`git branch -D ${branchName}`, { cwd: repoRoot });
    
    console.log(`   ✅ Worktree cleaned up`);
  } catch (error: any) {
    console.error(`   ❌ Failed to cleanup worktree: ${error.message}`);
  }
}
