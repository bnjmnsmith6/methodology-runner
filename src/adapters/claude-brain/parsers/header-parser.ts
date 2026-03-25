/**
 * Header parser for Claude Brain responses
 * 
 * Parses @@KEY: VALUE marker headers for reliable verdict extraction.
 */

import { ParsedHeader } from '../types.js';

/**
 * Parse the @@KEY: VALUE header block
 * 
 * Expected format:
 * @@JOB_TYPE: CLAUDE_REVIEW
 * @@VERDICT: PROCEED
 * @@CONFIDENCE: MEDIUM
 * @@BLOCKER_COUNT: 0
 * @@DECISION_COUNT: 0
 * @@REDO_COUNT: 0
 * @@END_HEADER
 */
export function parseHeader(responseText: string): ParsedHeader | { parseError: true; rawResponse: string } {
  try {
    // Header must appear before first markdown heading
    const firstHeading = responseText.indexOf('#');
    const headerSection = firstHeading > 0 ? responseText.slice(0, firstHeading) : responseText;
    
    // Find END_HEADER marker
    const endHeaderIndex = headerSection.indexOf('@@END_HEADER');
    if (endHeaderIndex === -1) {
      return { parseError: true, rawResponse: responseText };
    }
    
    const headerText = headerSection.slice(0, endHeaderIndex);
    const headerLines = headerText.split('\n').filter(line => line.trim().startsWith('@@'));
    
    if (headerLines.length === 0) {
      return { parseError: true, rawResponse: responseText };
    }
    
    const header: ParsedHeader = { jobType: '' };
    const headerRegex = /^@@([A-Z_]+):\s*(.+)$/;
    
    for (const line of headerLines) {
      const match = line.trim().match(headerRegex);
      if (match) {
        const [, key, value] = match;
        header[key] = value.trim();
      }
    }
    
    // Validate required fields based on job type
    if (!header.JOB_TYPE) {
      return { parseError: true, rawResponse: responseText };
    }
    
    header.jobType = header.JOB_TYPE;
    
    // Validate enum values
    if (header.VERDICT && !['PROCEED', 'NEEDS_DECISION', 'REDO'].includes(header.VERDICT)) {
      return { parseError: true, rawResponse: responseText };
    }
    
    if (header.SPEC_STATUS && !['READY', 'BLOCKED'].includes(header.SPEC_STATUS)) {
      return { parseError: true, rawResponse: responseText };
    }
    
    if (header.ACTION && !['PATCH', 'PATCH_AND_RETEST', 'ESCALATE_SPEC', 'ESCALATE_RESEARCH', 'ASK_HUMAN'].includes(header.ACTION)) {
      return { parseError: true, rawResponse: responseText };
    }
    
    if (header.CONFIDENCE && !['LOW', 'MEDIUM', 'HIGH'].includes(header.CONFIDENCE)) {
      return { parseError: true, rawResponse: responseText };
    }
    
    if (header.SEVERITY && !['P1', 'P2', 'P3'].includes(header.SEVERITY)) {
      return { parseError: true, rawResponse: responseText };
    }
    
    // Validate counts parse as integers
    const countFields = ['BLOCKER_COUNT', 'DECISION_COUNT', 'REDO_COUNT', 'OPEN_DECISIONS', 'OPEN_ASSUMPTIONS'];
    for (const field of countFields) {
      if (header[field] !== undefined) {
        const parsed = parseInt(header[field], 10);
        if (isNaN(parsed)) {
          return { parseError: true, rawResponse: responseText };
        }
      }
    }
    
    return header;
    
  } catch (err) {
    return { parseError: true, rawResponse: responseText };
  }
}

/**
 * Extract markdown body (everything after @@END_HEADER)
 */
export function extractMarkdownBody(responseText: string): string {
  const endHeaderIndex = responseText.indexOf('@@END_HEADER');
  if (endHeaderIndex === -1) {
    return responseText;
  }
  
  return responseText.slice(endHeaderIndex + '@@END_HEADER'.length).trim();
}
