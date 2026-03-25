/**
 * Check jobs for a specific project
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkJobs() {
  const projectName = process.argv[2] || 'Job Test';
  
  // Get project by name
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .eq('name', projectName)
    .single();

  if (projError || !projects) {
    console.log(`❌ Project "${projectName}" not found`);
    return;
  }

  console.log(`\n📋 Project: ${projects.name} (${projects.id})`);
  console.log(`   State: ${projects.state}`);

  // Get RPs
  const { data: rps } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', projects.id);

  if (!rps || rps.length === 0) {
    console.log('   No RPs found');
    return;
  }

  for (const rp of rps) {
    console.log(`\n   RP: ${rp.title} (${rp.id})`);
    console.log(`      State: ${rp.state}, Step: ${rp.step}, Status: ${rp.step_status}`);

    // Get jobs for this RP
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('rp_id', rp.id)
      .order('created_at', { ascending: true });

    if (!jobs || jobs.length === 0) {
      console.log(`      ❌ No jobs found for this RP`);
    } else {
      console.log(`      ✅ Jobs (${jobs.length}):`);
      jobs.forEach(job => {
        console.log(`         - ${job.type} [${job.status}] (${job.id})`);
      });
    }
  }
  
  console.log('');
}

checkJobs();
