/**
 * Verify database schema
 * Quick check that all tables exist and are accessible
 */

import { supabase } from './client.js';

async function verifySchema() {
  console.log('🔍 Verifying database schema...\n');
  
  const tables = ['projects', 'rps', 'jobs', 'decisions'];
  const results: Record<string, boolean> = {};
  
  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        results[table] = false;
      } else {
        console.log(`✅ ${table}: accessible (${count ?? 0} rows)`);
        results[table] = true;
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err}`);
      results[table] = false;
    }
  }
  
  const allGood = Object.values(results).every(v => v);
  
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('✨ All tables verified successfully!');
  } else {
    console.log('⚠️  Some tables are missing or inaccessible');
  }
  console.log('='.repeat(50) + '\n');
  
  return allGood;
}

verifySchema()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
  });
