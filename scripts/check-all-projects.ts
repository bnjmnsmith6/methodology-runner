/**
 * Check all projects
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function checkAllProjects() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !projects || projects.length === 0) {
    console.log('No projects found');
    return;
  }

  console.log(`\n📋 Projects (${projects.length}):\n`);
  for (const project of projects) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`${project.name} (${project.state})`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Tier: ${project.tier}`);
    console.log(`   Created: ${project.created_at}`);
    
    // Get RPs
    const { data: rps } = await supabase
      .from('rps')
      .select('*')
      .eq('project_id', project.id);
    
    if (rps && rps.length > 0) {
      console.log(`   RPs: ${rps.length}`);
      rps.forEach(rp => {
        console.log(`      - ${rp.title} (${rp.state}, Step ${rp.step})`);
      });
    }
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

checkAllProjects();
