import { handleToolCall } from '../src/chat/tools.js';

async function runTier1Test() {
  console.log('🧪 Starting Tier 1 Status API Test\n');
  
  // Step 1: Create Tier 1 project with RP
  console.log('1️⃣  Creating Tier 1 project "Status API Test" with RP...');
  const createResult = await handleToolCall('create_project', {
    name: 'Status API Test',
    tier: 1,
    rp_title: 'Build Status Endpoint',
    rp_description: 'Add GET /api/status returning nested JSON with projects, RPs, steps, decisions, jobs. No auth, no caching.',
  });
  
  console.log(`   ✅ Created project: ${createResult.project.name} (${createResult.project.id})`);
  console.log(`   ✅ Created RP: ${createResult.rp.title} (${createResult.rp.id})`);
  
  // Step 2: Start the project immediately
  console.log('\n2️⃣  Starting project immediately...');
  const startResult = await handleToolCall('start_project', {
    project_name: 'Status API Test',
  });
  
  console.log(`   ✅ ${startResult.message}`);
  
  console.log('\n✨ Tier 1 test initiated!');
  console.log('\n📊 Monitor progress:');
  console.log('   - Watch server.log: tail -f server.log');
  console.log('   - Chat: http://localhost:3000');
  console.log(`   - Project ID: ${createResult.project.id}`);
  console.log(`   - RP ID: ${createResult.rp.id}`);
  console.log('\n   Expected workflow (Tier 1 - Full Rigor):');
  console.log('   1. RESEARCH (PBCA) - ~30-60 seconds');
  console.log('   2. REVIEW (Claude Brain) - ~20 seconds');
  console.log('      → May create decisions (NEEDS_DECISION)');
  console.log('      → Test will answer decisions programmatically');
  console.log('   3. SPEC (Claude Brain) - ~20 seconds (after decisions answered)');
  console.log('   4. BUILD (Claude Code) - ~60-120 seconds');
  console.log('   5. SMOKE (Auto) - ~10 seconds');
  console.log('   6. TEST (Manual) - Waits for approval');
  console.log('\n   ⏱️  Total estimated time: 3-5 minutes (automated steps)');
  
  process.exit(0);
}

runTier1Test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
