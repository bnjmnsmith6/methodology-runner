/**
 * Main entry point for Methodology Runner
 * 
 * Starts both the worker process and the chat server.
 */

import { testConnection } from './db/client.js';
import { initializeAdapters } from './adapters/registry.js';
import { startWorker } from './core/worker.js';
import { startChatServer } from './chat/server.js';

console.log('🐶 Methodology Runner starting...\n');

async function main() {
  // Test database connection
  console.log('Testing database connection...');
  const connected = await testConnection();
  
  if (!connected) {
    console.error('❌ Failed to connect to database. Check your .env configuration.');
    process.exit(1);
  }
  
  console.log('✅ Database connected successfully\n');
  
  // Start worker in background
  // Initialize adapters
  await initializeAdapters();
  
  console.log('Starting worker...');
  startWorker().catch(err => {
    console.error('Worker error:', err);
    process.exit(1);
  });
  
  // Give worker a moment to initialize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Start chat server
  const port = parseInt(process.env.PORT || '3000', 10);
  await startChatServer(port);
  
  console.log('✨ All systems operational!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
