import { getRp } from '../src/services/projects.js';
import { next as reducerNext } from '../src/core/reducer.js';
import { enqueueJobs } from '../src/core/scheduler.js';
import { createDecision } from '../src/services/decisions.js';
import { updateRpState, updateProjectState } from '../src/services/projects.js';
import { supabase } from '../src/db/client.js';

async function main() {
  const rpId = process.argv[2];

  if (!rpId) {
    console.error('Usage: npm run trigger-reducer <rp-id>');
    process.exit(1);
  }

  console.log(`\n🔄 Running reducer for RP ${rpId}...\n`);

  // Load the RP
  const rp = await getRp(rpId);
  console.log(`📝 RP: ${rp.title}`);
  console.log(`   State: ${rp.state} | Step: ${rp.step} (${rp.step_status})\n`);

  // Load the project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', rp.project_id)
    .single();

  if (!project) {
    console.error('❌ Project not found');
    process.exit(1);
  }

  // Run the reducer
  const nextAction = reducerNext(rp, project);

  console.log('⚙️  Reducer output:');
  console.log(JSON.stringify(nextAction, null, 2));
  console.log();

  // Execute the actions
  if (nextAction.enqueueJobs && nextAction.enqueueJobs.length > 0) {
    console.log(`📋 Enqueueing ${nextAction.enqueueJobs.length} job(s)...`);
    await enqueueJobs(nextAction.enqueueJobs);
    console.log('✅ Jobs enqueued!');
  }

  if (nextAction.createDecision) {
    console.log('🙋 Creating decision...');
    await createDecision(nextAction.createDecision);
    console.log('✅ Decision created!');
  }

  if (nextAction.setRpState) {
    console.log('🔄 Updating RP state...');
    const updates: any = {};
    if (nextAction.setRpState.state !== undefined) {
      updates.state = nextAction.setRpState.state;
    }
    if (nextAction.setRpState.step !== undefined) {
      updates.step = nextAction.setRpState.step;
    }
    if (nextAction.setRpState.step_status !== undefined) {
      updates.step_status = nextAction.setRpState.step_status;
    }
    await updateRpState(rpId, updates);
    console.log('✅ RP state updated!');
  }

  if (nextAction.setProjectState) {
    console.log('🔄 Updating project state...');
    await updateProjectState(rp.project_id, nextAction.setProjectState.state);
    console.log('✅ Project state updated!');
  }

  console.log('\n🎉 Reducer executed! Worker will pick up jobs automatically.\n');
}

main().catch(console.error).finally(() => process.exit(0));
