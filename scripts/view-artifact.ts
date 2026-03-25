/**
 * View artifact content from a job
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function viewArtifact(rpId: string, artifactName: string) {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !jobs || jobs.length === 0) {
    console.error('No jobs found');
    process.exit(1);
  }

  const job = jobs[0];
  const artifact = job.output?.artifacts?.find((a: any) => a.name === artifactName);

  if (!artifact) {
    console.log(`Artifact "${artifactName}" not found.`);
    console.log('Available artifacts:');
    job.output?.artifacts?.forEach((a: any) => console.log(`  - ${a.name}`));
    process.exit(1);
  }

  console.log(`\n📄 ${artifact.name}\n`);
  console.log(artifact.content);
  console.log('');
}

const [rpId, artifactName] = process.argv.slice(2);
if (!rpId || !artifactName) {
  console.error('Usage: npx tsx scripts/view-artifact.ts <rp-id> <artifact-name>');
  process.exit(1);
}

viewArtifact(rpId, artifactName);
