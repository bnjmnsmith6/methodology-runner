import { supabase } from '../src/db/client.js';

async function checkRP() {
  const { data: rps } = await supabase
    .from('rps')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (rps && rps.length > 0) {
    const rp = rps[0];
    console.log('Latest RP:');
    console.log(`  ID: ${rp.id}`);
    console.log(`  Title: ${rp.title}`);
    console.log(`  State: ${rp.state}`);
    console.log(`  Step: ${rp.step}`);
    console.log(`  Step Status: ${rp.step_status}`);
    console.log(`  Shipped: ${rp.shipped_at || 'not shipped'}`);
  }
  
  process.exit(0);
}

checkRP().catch(console.error);
