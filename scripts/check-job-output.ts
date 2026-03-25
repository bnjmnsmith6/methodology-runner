import { supabase } from '../src/db/client.js';

async function main() {
  const jobId = process.argv[2];

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) {
    console.error('Error:', error);
  } else {
    console.log('Job:', data.id);
    console.log('Type:', data.type);
    console.log('Status:', data.status);
    console.log('\nOutput structure:');
    if (data.output) {
      const outputKeys = Object.keys(data.output);
      console.log('Keys:', outputKeys.join(', '));
      
      if (data.output.artifacts) {
        console.log('\nArtifacts array length:', data.output.artifacts.length);
        if (data.output.artifacts.length > 0) {
          const first = data.output.artifacts[0];
          console.log('\nFirst artifact:');
          console.log('  rp_id:', first.rp_id);
          console.log('  type:', first.type);
          console.log('  name:', first.name);
          console.log('  content length:', first.content?.length || 0);
          console.log('  metadata:', first.metadata);
        }
      }
    }
  }
}

main();
