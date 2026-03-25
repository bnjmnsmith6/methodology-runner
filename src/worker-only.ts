/**
 * Worker-only entry point
 * 
 * Runs just the worker process without the chat server.
 * Useful for distributed deployments or debugging.
 */

import { testConnection } from './db/client.js';
import { startWorker } from './core/worker.js';

console.log('🔧 Methodology Runner (Worker Only) starting...\n');

async function main() {
  // Test database connection
  console.log('Testing database connection...');
  const connected = await testConnection();
  
  if (!connected) {
    console.error('❌ Failed to connect to database. Check your .env configuration.');
    process.exit(1);
  }
  
  console.log('✅ Database connected successfully\n');
  
  // Start worker
  console.log('Starting worker...');
  await startWorker();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
  const { stopWorker } = await import('./core/worker.js');
  await stopWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
  const { stopWorker } = await import('./core/worker.js');
  await stopWorker();
  process.exit(0);
});

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
