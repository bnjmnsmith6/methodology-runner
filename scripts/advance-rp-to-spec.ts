/**
 * Manually advance an RP to step 5 (SPEC) to test job enqueuing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function advanceRp() {
  const rpName = process.argv[2] || 'Test Job Enqueue';
  
  // Get RP by title
  const { data: rps, error: rpError } = await supabase
    .from('rps')
    .select('*')
    .eq('title', rpName)
    .single();

  if (rpError || !rps) {
    console.log(`❌ RP "${rpName}" not found`);
    return;
  }

  console.log(`\n📋 RP: ${rps.title} (${rps.id})`);
  console.log(`   Current State: ${rps.state}, Step: ${rps.step}, Status: ${rps.step_status}`);

  // Advance to step 5 (SPEC) in READY state
  const { error: updateError } = await supabase
    .from('rps')
    .update({
      step: 5, // SPEC
      step_status: 'NOT_STARTED',
      state: 'READY',
    })
    .eq('id', rps.id);

  if (updateError) {
    console.log(`❌ Failed to update RP:`, updateError);
    return;
  }

  console.log(`   ✅ Advanced to Step 5 (SPEC), Status: NOT_STARTED, State: READY`);
  console.log(`\n   The worker should pick this up within 10 seconds and enqueue a CLAUDE_SPEC job.`);
  console.log(`   Run: npx tsx scripts/check-jobs.ts "Job Test" to verify.\n`);
}

advanceRp();
