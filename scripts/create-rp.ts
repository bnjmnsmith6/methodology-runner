import { createRp } from '../src/services/projects.js';

async function main() {
  const projectId = process.argv[2];
  const title = process.argv[3];
  const description = process.argv[4];

  if (!projectId || !title) {
    console.error('Usage: npm run create-rp <project-id> <title> [description]');
    process.exit(1);
  }

  console.log(`Creating RP: "${title}" for project ${projectId}...\n`);

  const rp = await createRp({
    project_id: projectId,
    title: title,
    description: description || null,
  });

  console.log('✅ RP Created Successfully!');
  console.log('   ID:', rp.id);
  console.log('   Title:', rp.title);
  console.log('   State:', rp.state);
  console.log('   Step:', rp.step, '(' + rp.step_status + ')');
  console.log('   Priority:', rp.priority);
  console.log('\n🔄 Worker will pick this up automatically!\n');
}

main().catch(console.error).finally(() => process.exit(0));
