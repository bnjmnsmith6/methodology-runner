/**
 * Test: Hello World end-to-end
 * 
 * Creates a Tier 1 project with a simple build task and runs it through the full workflow.
 */

import { supabase } from '../src/db/client.js';

async function runHelloWorldTest() {
  console.log('🧪 Starting Hello World End-to-End Test\n');
  
  // Step 1: Create Tier 1 project
  console.log('1️⃣  Creating Tier 1 project...');
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: 'Hello World Test',
      tier: 1,
      state: 'DRAFT'
    })
    .select()
    .single();
  
  if (projectError || !project) {
    console.error('❌ Failed to create project:', projectError);
    process.exit(1);
  }
  
  console.log(`   ✅ Created project: ${project.id}`);
  
  // Step 2: Create RP with simple build task
  console.log('\n2️⃣  Creating RP...');
  const { data: rp, error: rpError } = await supabase
    .from('rps')
    .insert({
      project_id: project.id,
      title: 'Create Hello World Script',
      description: 'Create a simple Node.js script that prints "Hello, World!" to the console. The script should be named hello.js and should be runnable with "node hello.js".',
      priority: 100,
      state: 'READY',
      step: 3,
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
  console.log('\n   Expected workflow (Tier 1):');
  console.log('   1. RESEARCH (PBCA) - ~15 seconds');
  console.log('   2. REVIEW (Claude Brain) - ~10 seconds');
  console.log('   3. SPEC (Claude Brain) - ~15 seconds');
  console.log('   4. BUILD (Claude Code) - ~30-60 seconds');
  console.log('   5. SMOKE (Claude Code) - ~10 seconds');
  console.log('   6. SHIP (System) - instant');
  console.log('\n   ⏱️  Total estimated time: 2-3 minutes');
  console.log('\n   🔍 Watch server.log for live progress:');
  console.log('      tail -f server.log');
  
  console.log('\n✨ Test initialized successfully!');
  console.log('   The worker will pick up the RP within 2 seconds.');
  process.exit(0);
}

runHelloWorldTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
