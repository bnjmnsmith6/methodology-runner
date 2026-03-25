/**
 * Check all jobs in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkAllJobs() {
  console.log('\n🔍 Checking all jobs...\n');

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  for (const job of jobs) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Job: ${job.type} | ${job.status}`);
    console.log(`   ID: ${job.id}`);
    console.log(`   Created: ${job.created_at}`);
    console.log(`   Run After: ${job.run_after || 'immediate'}`);
    console.log(`   Executed: ${job.executed_at || 'Not yet'}`);
    console.log(`   Locked by: ${job.locked_by || 'No'}`);
    console.log(`   Lease expires: ${job.lease_expires_at || 'No lease'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

checkAllJobs();
