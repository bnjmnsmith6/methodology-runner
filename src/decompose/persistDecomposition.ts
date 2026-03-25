/**
 * Decomposition Persistence
 * 
 * Saves decomposition results to Supabase
 */

import { supabase } from '../db/client.js';
import { DecompositionResult } from './decomposeProject.js';

/**
 * Save decomposition to the database
 */
export async function saveDecomposition(
  projectId: string,
  visionDocId: string,
  result: DecompositionResult
): Promise<{ decompositionId: string }> {
  console.log('💾 Saving decomposition to database...');
  
  const { data, error } = await supabase
    .from('decomposition_decisions')
    .insert({
      project_id: projectId,
      vision_doc_id: visionDocId,
      status: 'proposed',
      proposals: result.proposals,
      explanation: result.explanation,
      build_order: result.buildOrder,
      validation_errors: result.validationErrors,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('   ❌ Failed to save decomposition:', error);
    throw new Error(`Failed to save decomposition: ${error.message}`);
  }
  
  console.log(`   ✅ Decomposition saved: ${data.id}`);
  
  return { decompositionId: data.id };
}

/**
 * Get decomposition by ID
 */
export async function getDecomposition(decompositionId: string) {
  const { data, error } = await supabase
    .from('decomposition_decisions')
    .select('*')
    .eq('id', decompositionId)
    .single();
  
  if (error) {
    throw new Error(`Failed to get decomposition: ${error.message}`);
  }
  
  return data;
}

/**
 * Update decomposition status (proposed → approved → rejected)
 */
export async function updateDecompositionStatus(
  decompositionId: string,
  status: 'proposed' | 'approved' | 'rejected',
  notes?: string
) {
  const { error } = await supabase
    .from('decomposition_decisions')
    .update({ 
      status,
      ...(notes && { notes }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', decompositionId);
  
  if (error) {
    throw new Error(`Failed to update decomposition status: ${error.message}`);
  }
  
  console.log(`   ✅ Decomposition ${decompositionId} status → ${status}`);
}
