/**
 * Raw Artifact Logger
 * 
 * Saves prompts, responses, and artifacts to local filesystem for replay capability
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base telemetry directory (relative to project root)
const TELEMETRY_ROOT = path.join(__dirname, '../../.telemetry');

/**
 * Get the artifact directory for a pipeline run
 */
export function getArtifactDir(pipelineRunId: string): string {
  return path.join(TELEMETRY_ROOT, pipelineRunId);
}

/**
 * Ensure the telemetry directory exists
 */
async function ensureTelemetryDir(): Promise<void> {
  try {
    await fs.mkdir(TELEMETRY_ROOT, { recursive: true });
  } catch (error) {
    // Ignore if already exists
  }
}

/**
 * Save a raw artifact to local filesystem
 */
export async function saveRawArtifact(params: {
  pipelineRunId: string;
  stepName: string;
  type: 'prompt' | 'response' | 'artifact';
  content: string;
}): Promise<string> {
  await ensureTelemetryDir();

  // Create directory structure: .telemetry/<pipelineRunId>/<stepName>/
  const stepDir = path.join(TELEMETRY_ROOT, params.pipelineRunId, params.stepName);
  await fs.mkdir(stepDir, { recursive: true });

  // Generate filename: <type>-<timestamp>.txt
  const timestamp = Date.now();
  const filename = `${params.type}-${timestamp}.txt`;
  const filepath = path.join(stepDir, filename);

  // Write content
  await fs.writeFile(filepath, params.content, 'utf-8');

  // Return relative path for storage in database
  const relativePath = path.join(params.pipelineRunId, params.stepName, filename);
  
  console.log(`   📝 Saved artifact: ${relativePath}`);
  return relativePath;
}

/**
 * Save a JSON artifact
 */
export async function saveJsonArtifact(params: {
  pipelineRunId: string;
  stepName: string;
  type: string;
  data: any;
}): Promise<string> {
  const content = JSON.stringify(params.data, null, 2);
  return saveRawArtifact({
    pipelineRunId: params.pipelineRunId,
    stepName: params.stepName,
    type: params.type as 'prompt' | 'response' | 'artifact',
    content,
  });
}

/**
 * Read an artifact from disk
 */
export async function readArtifact(relativePath: string): Promise<string> {
  const filepath = path.join(TELEMETRY_ROOT, relativePath);
  return await fs.readFile(filepath, 'utf-8');
}

/**
 * List all artifacts for a pipeline run
 */
export async function listArtifacts(pipelineRunId: string): Promise<string[]> {
  const runDir = getArtifactDir(pipelineRunId);
  
  try {
    const artifacts: string[] = [];
    const steps = await fs.readdir(runDir);
    
    for (const step of steps) {
      const stepPath = path.join(runDir, step);
      const stat = await fs.stat(stepPath);
      
      if (stat.isDirectory()) {
        const files = await fs.readdir(stepPath);
        files.forEach(file => {
          artifacts.push(path.join(pipelineRunId, step, file));
        });
      }
    }
    
    return artifacts;
  } catch (error) {
    // Directory doesn't exist yet
    return [];
  }
}

/**
 * Create a replay bundle (exports all artifacts as a tarball/zip)
 * Future enhancement - not implemented in v1
 */
export async function createReplayBundle(pipelineRunId: string): Promise<string> {
  // TODO: Implement tarball creation
  throw new Error('Replay bundles not implemented yet');
}
