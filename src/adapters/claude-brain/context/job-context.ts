/**
 * Helper: Get prior job outputs for an RP
 */

import { supabase } from '../../../db/client.js';
import { JobType, JobStatus } from '../../../core/types.js';

export async function getPriorJobOutput(rpId: string, jobType: JobType): Promise<any | null> {
  console.log(`   🔍 Looking for ${jobType} job for RP ${rpId}...`);
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('rp_id', rpId)
    .eq('type', jobType)
    .eq('status', JobStatus.SUCCEEDED)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    console.log(`   ❌ Error querying job: ${error.message}`);
    console.log(`   📋 Error code: ${error.code}`);
    return null;
  }
  
  if (!data) {
    console.log(`   ❌ No ${jobType} job found`);
    return null;
  }
  
  console.log(`   ✅ Found job ${data.id}`);
  console.log(`   📦 Output keys: ${Object.keys(data.output || {}).join(', ')}`);
  
  return data.output;
}

export async function getAllJobsForRp(rpId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('rp_id', rpId)
    .order('created_at', { ascending: true });
  
  if (error || !data) {
    return [];
  }
  
  return data;
}

export async function countJobsByType(rpId: string, jobType: JobType): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('rp_id', rpId)
    .eq('type', jobType);
  
  if (error) {
    console.log(`   ❌ Error counting jobs: ${error.message}`);
    return 0;
  }
  
  return count || 0;
}
