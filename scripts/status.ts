import { supabase } from '../src/db/client.js';

async function showStatus() {
  console.log('📊 METHODOLOGY RUNNER STATUS\n');
  console.log('=' .repeat(50));

  // Check projects
  const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  console.log(`\n📁 PROJECTS (${projects?.length || 0}):`);
  projects?.forEach(p => {
    console.log(`  • ${p.name}`);
    console.log(`    ID: ${p.id}`);
    console.log(`    State: ${p.state} | Tier: ${p.tier}`);
    console.log(`    Created: ${new Date(p.created_at).toLocaleString()}`);
  });

  // Check RPs
  const { data: rps } = await supabase.from('rps').select('*').order('created_at', { ascending: false });
  console.log(`\n📝 RESEARCH PROJECTS (${rps?.length || 0}):`);
  rps?.forEach(rp => {
    console.log(`  • ${rp.title}`);
    console.log(`    ID: ${rp.id}`);
    console.log(`    Project: ${rp.project_id}`);
    console.log(`    State: ${rp.state} | Step: ${rp.step} (${rp.step_status})`);
    if (rp.last_error) {
      console.log(`    ⚠️  Error: ${rp.last_error}`);
    }
  });

  // Check jobs
  const { data: jobs } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(10);
  console.log(`\n⚙️  RECENT JOBS (last 10):`);
  if (jobs?.length === 0) {
    console.log('  (no jobs yet)');
  }
  jobs?.forEach(j => {
    console.log(`  • ${j.type} - ${j.status}`);
    console.log(`    ID: ${j.id}`);
    if (j.rp_id) console.log(`    RP: ${j.rp_id}`);
    if (j.error_message) console.log(`    Error: ${j.error_message}`);
  });

  // Check decisions
  const { data: decisions } = await supabase.from('decisions').select('*').eq('status', 'PENDING');
  console.log(`\n🙋 PENDING DECISIONS (${decisions?.length || 0}):`);
  if (decisions?.length === 0) {
    console.log('  (none pending)');
  }
  decisions?.forEach(d => {
    console.log(`  • ${d.title}`);
    console.log(`    ID: ${d.id}`);
    console.log(`    Scope: ${d.scope}`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Status check complete\n');
}

showStatus().catch(console.error).finally(() => process.exit(0));
