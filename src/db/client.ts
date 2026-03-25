/**
 * Supabase client initialization
 * 
 * This module sets up the Supabase client with proper configuration
 * and exports it for use throughout the application.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing required environment variable: SUPABASE_URL');
}

if (!SUPABASE_KEY) {
  throw new Error('Missing required environment variable: SUPABASE_KEY');
}

/**
 * Global Supabase client instance
 */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
});

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').select('count').limit(1);
    if (error) {
      console.error('Database connection test failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err);
    return false;
  }
}

/**
 * Get the current database timestamp
 */
export async function getCurrentTimestamp(): Promise<Date> {
  const { data, error } = await supabase.rpc('now');
  if (error) {
    throw new Error(`Failed to get current timestamp: ${error.message}`);
  }
  return new Date(data);
}

/**
 * Helper to safely extract Supabase error messages
 */
export function extractSupabaseError(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error_description) return error.error_description;
  return 'Unknown database error';
}
