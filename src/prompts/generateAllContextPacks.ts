/**
 * Batch Context Pack Generator
 * 
 * Generates and saves all context packs for all RPs in a project
 */

import { VisionDocument, RPProposal, ContextConsumer } from '../types/vision.js';
import { buildContextPack } from './buildContextPack.js';
import { renderContextForPrompt } from './renderContextPack.js';
import { saveContextPack } from './persistContextPack.js';

const CONSUMERS: ContextConsumer[] = ['pbca', 'review', 'spec', 'build'];

/**
 * Generate and save all context packs for all RPs in a project
 * 
 * @param projectId - The project ID
 * @param visionDoc - The Vision Document
 * @param rpProposals - Array of RP proposals
 * @param rpIdMap - Map of RP title to RP ID (from created RPs)
 */
export async function generateAndSaveContextPacks(
  projectId: string,
  visionDoc: VisionDocument,
  rpProposals: RPProposal[],
  rpIdMap: Record<string, string>
): Promise<void> {
  console.log('📦 Generating context packs for all RPs...');
  
  let totalPacks = 0;
  
  for (const rpProposal of rpProposals) {
    const rpId = rpIdMap[rpProposal.title];
    
    if (!rpId) {
      console.warn(`   ⚠️  No RP ID found for: ${rpProposal.title}`);
      continue;
    }
    
    console.log(`   🔧 Generating packs for RP: ${rpProposal.title}`);
    
    // Generate context pack for each consumer
    for (const consumer of CONSUMERS) {
      try {
        // Build the context pack
        const pack = buildContextPack(
          consumer,
          visionDoc,
          rpProposal,
          projectId,
          rpId
        );
        
        // Render as text
        const renderedText = renderContextForPrompt(pack);
        
        // Save to database
        await saveContextPack(projectId, rpId, consumer, pack, renderedText);
        
        totalPacks++;
      } catch (error) {
        console.error(`      ⚠️  Failed to generate ${consumer} pack:`, error);
      }
    }
  }
  
  console.log(`   ✅ Generated ${totalPacks} context packs`);
}
