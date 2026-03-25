/**
 * Check job status
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkJob(rpId: string) {
  console.log(`\n🔍 Checking jobs for RP ${rpId}...\n`);

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found for this RP.');
    return;
  }

  for (const job of jobs) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Job: ${job.type}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Created: ${job.created_at}`);
    console.log(`   Executed: ${job.executed_at || 'Not yet'}`);
    console.log(`   Leased: ${job.leased_until || 'No'}`);
    
    if (job.output) {
      console.log(`\n   📦 Output:`);
      if (job.output.artifacts) {
        console.log(`      Artifacts: ${job.output.artifacts.length}`);
        job.output.artifacts.forEach((a: any, i: number) => {
          console.log(`        ${i + 1}. ${a.name} (${a.type})`);
        });
      }
      if (job.output.token_usage) {
        console.log(`      Token usage: ${job.output.token_usage.total_tokens} tokens`);
      }
      if (job.output.cost_estimate_usd) {
        console.log(`      Cost: $${job.output.cost_estimate_usd.toFixed(4)}`);
      }
    }
    
    if (job.error) {
      console.log(`\n   ❌ Error: ${JSON.stringify(job.error, null, 2)}`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

const rpId = process.argv[2];
if (!rpId) {
  console.error('Usage: npx tsx scripts/check-job.ts <rp-id>');
  process.exit(1);
}

checkJob(rpId);
