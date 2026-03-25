/**
 * Database Layer - Central Export
 * 
 * Re-exports all database access functions.
 */

// Supabase client
export { supabase, testConnection, getCurrentTimestamp, extractSupabaseError } from './client.js';

// Vision system repository
export * from './vision-repo.js';

// Other repositories can be added here as they are created
// For now, services like projects.ts and decisions.ts are imported directly
