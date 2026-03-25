/**
 * Test the new chat tools programmatically
 */

import { handleToolCall } from '../src/chat/tools.js';

async function testChatTools() {
  console.log('🧪 Testing Chat Tools\n');
  
  // Test 1: get_pending_decisions (should show Hello World RP)
  console.log('1️⃣  Testing get_pending_decisions...');
  const pendingResult = await handleToolCall('get_pending_decisions', {});
  console.log('   Decisions:', pendingResult.decisions_count);
  console.log('   Waiting Test RPs:', pendingResult.waiting_test_count);
  console.log('   Total needing attention:', pendingResult.total_items_needing_attention);
  
  if (pendingResult.waiting_test_count > 0) {
    console.log(`   ✅ Found ${pendingResult.waiting_test_count} RP(s) waiting for test`);
    
    const rp = pendingResult.waiting_test_rps[0];
    console.log(`   📋 RP: "${rp.title}"`);
    console.log(`   📋 ID: ${rp.id}`);
    
    // Test 2: approve_test by RP ID
    console.log('\n2️⃣  Testing approve_test (by RP ID)...');
    const approveResult = await handleToolCall('approve_test', {
      rp_id: rp.id,
      approved: true,
      feedback: 'Looks good! Output is exactly "Hello, World!"',
    });
    
    if (approveResult.success) {
      console.log('   ✅ Test approved successfully!');
      console.log(`   📊 Message: ${approveResult.message}`);
      console.log('   📊 Workflow should advance to SHIP');
      
      // Wait a moment for async updates
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test 3: Verify advancement
      console.log('\n3️⃣  Checking status after approval...');
      const statusResult = await handleToolCall('get_rp_detail', {
        rp_id: rp.id,
      });
      console.log(`   RP State: ${statusResult.rp.state}`);
      console.log(`   RP Step: ${statusResult.rp.step}`);
      console.log(`   RP Step Status: ${statusResult.rp.step_status}`);
      
      if (statusResult.rp.step === 10) {
        console.log('   ✅ Successfully advanced to Step 10 (SHIP)!');
      } else if (statusResult.rp.step === 8) {
        console.log('   ⚠️  Still at step 8 - reducer may need manual trigger');
      } else {
        console.log(`   📊 Current step: ${statusResult.rp.step}`);
      }
    } else {
      console.log('   ❌ Approval failed:', approveResult.error);
    }
  } else {
    console.log('   ⚠️  No RPs waiting for test approval');
  }
  
  console.log('\n✨ Test complete!');
  process.exit(0);
}

testChatTools().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
