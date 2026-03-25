/**
 * Clean all data from Supabase for fresh testing
 */

import { supabase } from '../src/db/client.js';

async function cleanDatabase() {
  console.log('🧹 Cleaning Supabase database...\n');
  
  // Order matters: delete from tables with foreign keys first
  const tables = [
    'decisions',
    'jobs',
    'rps',
    'projects'
  ];
  
  for (const table of tables) {
    console.log(`   Deleting from ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');  // Delete all
    
    if (error) {
      console.error(`   ❌ Error deleting from ${table}:`, error);
    } else {
      console.log(`   ✅ Cleared ${table}`);
    }
  }
  
  console.log('\n✨ Database cleaned successfully!');
  process.exit(0);
}

cleanDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
