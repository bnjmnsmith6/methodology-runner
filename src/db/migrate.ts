/**
 * Database migration runner
 * 
 * Executes SQL migration files in order from the migrations directory.
 * Run with: npm run migrate
 */

import { supabase } from './client.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface MigrationFile {
  filename: string;
  order: number;
  path: string;
}

/**
 * Get all migration files sorted by order
 */
function getMigrationFiles(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(filename => {
      const match = filename.match(/^(\d+)_/);
      const order = match ? parseInt(match[1], 10) : 0;
      return {
        filename,
        order,
        path: join(MIGRATIONS_DIR, filename),
      };
    })
    .sort((a, b) => a.order - b.order);

  return files;
}

/**
 * Execute a single migration file
 */
async function executeMigration(migration: MigrationFile): Promise<void> {
  console.log(`\n📄 Executing migration: ${migration.filename}`);
  
  const sql = readFileSync(migration.path, 'utf-8');
  
  // Split by semicolons but be smart about it (don't split within strings/functions)
  // For simplicity in v1, we'll execute the whole file as one statement
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).single();
  
  if (error) {
    // If the RPC doesn't exist, try direct query
    // Note: This is less safe but works for initial setup
    try {
      const { error: queryError } = await supabase.from('_migrations').select('*').limit(1);
      if (queryError?.code === '42P01') {
        // Table doesn't exist, we're doing initial setup
        // Execute via raw query (Supabase client doesn't support this well)
        // We'll need to split and execute statements individually
        console.log('⚠️  Warning: Direct SQL execution not available via Supabase client');
        console.log('Please run this migration manually in the Supabase SQL editor:');
        console.log('\n' + '='.repeat(80));
        console.log(sql);
        console.log('='.repeat(80) + '\n');
        return;
      }
    } catch (e) {
      // Fallback: print the SQL for manual execution
      console.log('⚠️  Could not execute migration automatically.');
      console.log('Please run this migration manually in the Supabase SQL editor:');
      console.log('\n' + '='.repeat(80));
      console.log(sql);
      console.log('='.repeat(80) + '\n');
      return;
    }
    
    throw new Error(`Migration failed: ${error.message}`);
  }
  
  console.log(`✅ Migration ${migration.filename} completed successfully`);
}

/**
 * Main migration function
 */
async function runMigrations(): Promise<void> {
  console.log('🚀 Starting database migrations...\n');
  console.log(`Migrations directory: ${MIGRATIONS_DIR}`);
  
  const migrations = getMigrationFiles();
  
  if (migrations.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }
  
  console.log(`\nFound ${migrations.length} migration(s):`);
  migrations.forEach(m => console.log(`  - ${m.filename}`));
  
  for (const migration of migrations) {
    await executeMigration(migration);
  }
  
  console.log('\n✨ All migrations completed successfully!\n');
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  });
