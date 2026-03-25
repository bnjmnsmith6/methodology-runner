import { supabase } from '../src/db/client.js';

async function main() {
  const rpId = process.argv[2];
  
  if (!rpId) {
    console.error('Usage: npx tsx scripts/check-rp-jobs.ts <rp_id>');
    process.exit(1);
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`\n📋 Jobs for RP ${rpId.slice(0, 8)}...:\n`);
  for (const job of data) {
    console.log(`   - ${job.type} [${job.status}] (${job.id.slice(0, 8)}...)`);
    console.log(`     Created: ${job.created_at}`);
  }
}

main();
