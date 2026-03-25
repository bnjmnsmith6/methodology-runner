/**
 * Context Pack Persistence
 * 
 * Save and load context packs from database
 */

import { ContextPack, ContextConsumer } from '../types/vision.js';
import { createContextPack, getContextPack } from '../db/vision-repo.js';

/**
 * Save a context pack to the database
 */
export async function saveContextPack(
  projectId: string,
  rpId: string,
  consumer: ContextConsumer,
  pack: ContextPack,
  renderedText: string
): Promise<{ id: string }> {
  return await createContextPack({
    project_id: projectId,
    rp_id: rpId,
    consumer,
    payload: pack.payload,
    rendered_text: renderedText,
  });
}

/**
 * Retrieve a context pack for a specific consumer
 * Returns null if no pack exists (backwards compatible)
 */
export async function loadContextPack(
  projectId: string,
  rpId: string,
  consumer: ContextConsumer
): Promise<{ pack: ContextPack; renderedText: string } | null> {
  try {
    const pack = await getContextPack(projectId, rpId, consumer);
    
    if (!pack) {
      return null;
    }
    
    return {
      pack,
      renderedText: pack.rendered_text || '',
    };
  } catch (error) {
    console.error(`   ⚠️  Failed to load context pack for ${consumer}:`, error);
    return null;
  }
}
