/**
 * Check the latest created project
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkLatestProject() {
  // Get latest project
  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (projError || !projects || projects.length === 0) {
    console.log('No projects found');
    return;
  }

  const project = projects[0];
  console.log('\n📋 Latest Project:');
  console.log(`   Name: ${project.name}`);
  console.log(`   ID: ${project.id}`);
  console.log(`   Tier: ${project.tier}`);
  console.log(`   State: ${project.state}`);
  console.log(`   Created: ${project.created_at}`);

  // Get RPs for this project
  const { data: rps, error: rpError } = await supabase
    .from('rps')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (rpError || !rps || rps.length === 0) {
    console.log('\n   ⚠️  No RPs found for this project');
    return;
  }

  console.log(`\n   RPs (${rps.length}):`);
  for (const rp of rps) {
    console.log(`   - ${rp.title} (${rp.id})`);
    console.log(`     State: ${rp.state} | Step: ${rp.step} (${rp.step_status})`);
  }

  console.log('');
}

checkLatestProject();
