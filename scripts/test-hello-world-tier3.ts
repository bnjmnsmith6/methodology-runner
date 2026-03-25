/**
 * Test: Hello World end-to-end (Tier 3)
 * 
 * Tier 3 skips PBCA and REVIEW, goes straight to SPEC → BUILD → SMOKE → SHIP
 * Perfect for testing the BUILD step without the research overhead.
 */

import { supabase } from '../src/db/client.js';

async function runHelloWorldTier3Test() {
  console.log('🧪 Starting Hello World End-to-End Test (Tier 3 - Fast Path)\n');
  
  // Step 1: Create Tier 3 project
  console.log('1️⃣  Creating Tier 3 project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: 'Hello World Test (Tier 3)',
      tier: 3,
      state: 'DRAFT'
    })
    .select()
    .single();
  
  if (projectError || !project) {
    console.error('❌ Failed to create project:', projectError);
    process.exit(1);
  }
  
  console.log(`   ✅ Created project: ${project.id}`);
  
  // Step 2: Create RP starting at SPEC step
  console.log('\n2️⃣  Creating RP...');
  const { data: rp, error: rpError } = await supabase
    .from('rps')
    .insert({
      project_id: project.id,
      title: 'Create Hello World Script',
      description: `Create a simple Node.js script that prints "Hello, World!" to the console.

Requirements:
- File should be named hello.js
- Should use console.log()
- Should be runnable with "node hello.js"
- Output should be exactly "Hello, World!" followed by a newline

This is a simple task - no tests, no dependencies, just one file with one line of code.`,
      priority: 100,
      state: 'READY',
      step: 5,  // Start at SPEC step (Tier 3 skips RESEARCH and REVIEW)
      step_status: 'NOT_STARTED',
      debug_cycle_count: 0
    })
    .select()
    .single();
  
  if (rpError || !rp) {
    console.error('❌ Failed to create RP:', rpError);
    process.exit(1);
  }
  
  console.log(`   ✅ Created RP: ${rp.id}`);
  console.log(`   📝 Title: "${rp.title}"`);
  
  // Step 3: Activate project (triggers workflow)
  console.log('\n3️⃣  Activating project...');
  const { error: activateError } = await supabase
    .from('projects')
    .update({ state: 'ACTIVE' })
    .eq('id', project.id);
  
  if (activateError) {
    console.error('❌ Failed to activate project:', activateError);
    process.exit(1);
  }
  
  console.log('   ✅ Project activated!');
  
  // Step 4: Print monitoring instructions
  console.log('\n4️⃣  Test is running!');
  console.log('   📊 Monitor progress:');
  console.log(`   - Chat: http://localhost:3000`);
  console.log(`   - Project ID: ${project.id}`);
  console.log(`   - RP ID: ${rp.id}`);
  console.log('\n   Expected workflow (Tier 3 - Fast Path):');
  console.log('   ⏭️  RESEARCH - SKIPPED (Tier 3)');
  console.log('   ⏭️  REVIEW - SKIPPED (Tier 3)');
  console.log('   1. SPEC (Claude Brain) - ~10 seconds');
  console.log('   2. BUILD (Claude Code) - ~30-60 seconds ⭐ THIS IS WHAT WE\'RE TESTING');
  console.log('   3. SMOKE (Claude Code) - ~10 seconds');
  console.log('   4. SHIP (System) - instant');
  console.log('\n   ⏱️  Total estimated time: 1-2 minutes (much faster!)');
  console.log('\n   🔍 Watch server.log for live progress:');
  console.log('      tail -f server.log');
  console.log('\n   🎯 This test will hit the BUILD step directly!');
  
  console.log('\n✨ Test initialized successfully!');
  console.log('   The worker will pick up the RP within 2 seconds.');
  process.exit(0);
}

runHelloWorldTier3Test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
