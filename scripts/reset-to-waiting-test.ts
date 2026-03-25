import { supabase } from '../src/db/client.js';

async function resetToWaitingTest() {
  const rpId = '080d1971-e4fa-48e7-aaaa-a1d2b32e2296';
  
  const { error } = await supabase
    .from('rps')
    .update({
      step: 8,
      step_status: 'NOT_STARTED',
      state: 'WAITING_TEST',
    })
    .eq('id', rpId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Reset RP to Step 8 (WAITING_TEST)');
  }
  
  process.exit(0);
}

resetToWaitingTest().catch(console.error);
