import { handleToolCall } from '../src/chat/tools.js';
import { supabase } from '../src/db/client.js';

async function monitorAndAutoAnswer() {
  console.log('\n🔍 Monitoring workflow and auto-answering decisions...\n');
  
  const rpId = '5ba9307b-c942-49f2-94a4-81b353c85d33';
  let lastStep = 0;
  let lastState = '';
  let checkedDecisions = new Set<string>();
  
  for (let i = 0; i < 120; i++) { // Monitor for 2 minutes
    // Check RP status
    const { data: rp } = await supabase
      .from('rps')
      .select('*')
      .eq('id', rpId)
      .single();
    
    if (!rp) continue;
    
    // Log status changes
    if (rp.step !== lastStep || rp.state !== lastState) {
      console.log(`📊 RP Status: Step ${rp.step} (${rp.step_status}) - State: ${rp.state}`);
      lastStep = rp.step;
      lastState = rp.state;
    }
    
    // Check for pending decisions
    if (rp.state === 'WAITING_DECISION') {
      const { data: pendingDecisions } = await supabase
        .from('decisions')
        .select('*')
        .eq('rp_id', rpId)
        .eq('status', 'PENDING');
      
      if (pendingDecisions && pendingDecisions.length > 0) {
        for (const decision of pendingDecisions) {
          if (checkedDecisions.has(decision.id)) continue;
          checkedDecisions.add(decision.id);
          
          console.log(`\n🙋 Found pending decision: ${decision.title}`);
          console.log(`   Question: ${decision.prompt}`);
          
          // Auto-answer with first option (or a reasonable default)
          const answer = { choice: 0, comment: 'Auto-answered for test' };
          
          console.log(`   🤖 Auto-answering with option 0...`);
          await handleToolCall('answer_decision', {
            decision_id: decision.id,
            answer,
          });
          
          console.log(`   ✅ Decision answered!\n`);
        }
      }
    }
    
    // Check if we've reached WAITING_TEST or COMPLETED
    if (rp.state === 'WAITING_TEST' || rp.state === 'COMPLETED') {
      console.log(`\n🎯 RP reached ${rp.state} state. Stopping monitor.`);
      break;
    }
    
    await sleep(1000);
  }
  
  console.log('\n📋 Final status:');
  const { data: finalRp } = await supabase
    .from('rps')
    .select('*')
    .eq('id', rpId)
    .single();
  
  if (finalRp) {
    console.log(`   Step: ${finalRp.step}`);
    console.log(`   Step Status: ${finalRp.step_status}`);
    console.log(`   State: ${finalRp.state}`);
  }
  
  process.exit(0);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

monitorAndAutoAnswer().catch(err => {
  console.error('❌ Monitor failed:', err);
  process.exit(1);
});
