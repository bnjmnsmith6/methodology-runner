/**
 * PBCA response parser
 * 
 * Parses the File Bundle output from PBCA into structured artifacts.
 */

export interface PbcaOutput {
  runSummary: string;
  files: {
    path: string; // e.g., "RND/00-problem-framing-contract.md"
    content: string;
  }[];
  rawResponse: string;
  warnings: string[];
}

/**
 * Parse PBCA response into structured output
 */
export function parsePbcaResponse(response: string): PbcaOutput {
  const warnings: string[] = [];
  const files: { path: string; content: string }[] = [];
  let runSummary = '';

  // Try to extract Run Summary first
  const runSummaryMatch = response.match(/## Run Summary[\s\S]*?(?=###|$)/i);
  if (runSummaryMatch) {
    runSummary = runSummaryMatch[0].trim();
  } else {
    warnings.push('Run Summary section not found');
  }

  // Extract files using multiple patterns
  // Pattern 1: ### FILE: path
  const filePattern1 = /###\s*FILE:\s*([^\n]+)\n([\s\S]*?)(?=###\s*FILE:|$)/gi;
  let match;
  
  while ((match = filePattern1.exec(response)) !== null) {
    const path = match[1].trim();
    let content = match[2].trim();
    
    // Remove markdown code fences if present
    content = content.replace(/^```markdown?\n?/i, '').replace(/\n?```$/i, '');
    
    files.push({ path, content });
  }

  // Pattern 2: ## FILE: path (some variations use ##)
  if (files.length === 0) {
    const filePattern2 = /##\s*FILE:\s*([^\n]+)\n([\s\S]*?)(?=##\s*FILE:|$)/gi;
    
    while ((match = filePattern2.exec(response)) !== null) {
      const path = match[1].trim();
      let content = match[2].trim();
      
      // Remove markdown code fences if present
      content = content.replace(/^```markdown?\n?/i, '').replace(/\n?```$/i, '');
      
      files.push({ path, content });
    }
  }

  // Pattern 3: FILE: path (without heading markers)
  if (files.length === 0) {
    const filePattern3 = /FILE:\s*([^\n]+)\n([\s\S]*?)(?=FILE:|$)/gi;
    
    while ((match = filePattern3.exec(response)) !== null) {
      const path = match[1].trim();
      let content = match[2].trim();
      
      // Remove markdown code fences if present
      content = content.replace(/^```markdown?\n?/i, '').replace(/\n?```$/i, '');
      
      files.push({ path, content });
    }
  }

  // If no files found, try to extract RND/ paths generically
  if (files.length === 0) {
    warnings.push('No FILE: markers found - attempting generic RND/ path extraction');
    
    const rndPattern = /(RND\/[a-zA-Z0-9-]+\.md)/g;
    const paths = response.match(rndPattern);
    
    if (paths && paths.length > 0) {
      warnings.push(`Found ${paths.length} RND/ references but could not extract content properly`);
    }
  }

  // Validate that we got reasonable output
  if (files.length === 0) {
    warnings.push('CRITICAL: Could not parse any files from response');
    warnings.push('Response will be stored as raw output - manual parsing may be needed');
  }

  // Check for expected files
  const expectedFiles = [
    'RND/00-problem-framing-contract.md',
    'RND/01-discovery-brief.md',
    'RND/04-options-matrix.md',
    'RND/06-red-team.md',
    'RND/07-simulation-report.md',
    'RND/09-handoff-to-code-puppy.md',
  ];

  const foundPaths = files.map(f => f.path);
  const missingFiles = expectedFiles.filter(path => !foundPaths.includes(path));
  
  if (missingFiles.length > 0 && files.length > 0) {
    warnings.push(`Missing expected files: ${missingFiles.join(', ')}`);
  }

  return {
    runSummary,
    files,
    rawResponse: response,
    warnings,
  };
}

/**
 * Get a specific file from parsed output
 */
export function getFile(output: PbcaOutput, path: string): string | null {
  const file = output.files.find(f => f.path === path);
  return file ? file.content : null;
}

/**
 * Get all file paths from parsed output
 */
export function getFilePaths(output: PbcaOutput): string[] {
  return output.files.map(f => f.path);
}
