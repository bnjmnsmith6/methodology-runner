import { supabase } from '../src/db/client.js';

async function main() {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`\n📋 Pending Decisions (${data.length}):\n`);
  for (const decision of data) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`ID: ${decision.id.slice(0, 8)}...`);
    console.log(`RP: ${decision.rp_id?.slice(0, 8)}...`);
    console.log(`Title: ${decision.title}`);
    console.log(`Prompt: ${decision.prompt.slice(0, 100)}...`);
    console.log(`Options: ${decision.options.join(', ')}`);
    console.log(`Created: ${decision.created_at}`);
  }
}

main();
