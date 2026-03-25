import { supabase } from '../src/db/client.js';

async function main() {
  const rpId = process.argv[2];
  
  const { error } = await supabase
    .from('rps')
    .update({ step_status: 'NOT_STARTED', state: 'RUNNING' })
    .eq('id', rpId);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ RP reset to NOT_STARTED, worker will retry');
  }
}

main();
