/**
 * Quick script to activate a project
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function activateProject(projectId: string) {
  console.log(`Setting project ${projectId} to ACTIVE...`);

  const { data, error } = await supabase
    .from('projects')
    .update({ state: 'ACTIVE' })
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('✅ Project activated:', data);
}

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: tsx scripts/activate-project.ts <project-id>');
  process.exit(1);
}

activateProject(projectId);
