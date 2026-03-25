import { supabase } from '../src/db/client.js';

async function getProjectName() {
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (projects && projects.length > 0) {
    console.log('Latest project:');
    console.log(`  ID: ${projects[0].id}`);
    console.log(`  Name: ${projects[0].name}`);
  }
  
  process.exit(0);
}

getProjectName().catch(console.error);
