/**
 * Request Parser
 * 
 * Extracts signals from natural language messages using keyword detection
 * and heuristics. Does NOT call any LLM APIs.
 */

export interface ParsedRequest {
  rawMessage: string;
  
  // Extracted signals
  artifactType?: string;        // "file", "api endpoint", "dashboard", "script", etc.
  specificArtifact?: string;     // "hello.js", "GET /api/status", etc.
  statedUsers?: string[];        // who it's for, if mentioned
  statedConstraints?: string[];  // tech, time, policy constraints mentioned
  statedDoneState?: string;      // what "done" looks like, if mentioned
  mentionsIntegrations: boolean; // references external systems, APIs, databases
  mentionsAuth: boolean;         // references auth, permissions, roles, security
  mentionsData: boolean;         // references data migration, schemas, storage
  mentionsMobileOrUI: boolean;   // references UI, mobile, responsive, design
  
  // Complexity signals
  wordCount: number;
  sentenceCount: number;
  questionMarks: number;         // user asking questions = ambiguity
  specificity: 'high' | 'medium' | 'low';  // how precise is the request?
  componentCount: number;        // how many distinct things are being asked for?
}

// Keyword lists for detection
const KEYWORDS = {
  integrations: [
    'api', 'integrate', 'integration', 'connect', 'connection', 'webhook', 
    'third-party', 'external', 'import', 'export', 'sync', 'rest api',
    'graphql', 'endpoint', 'microservice'
  ],
  auth: [
    'auth', 'authentication', 'authorization', 'login', 'logout', 'signin',
    'signup', 'permission', 'permissions', 'role', 'roles', 'security',
    'password', 'token', 'oauth', 'session', 'user access', 'rbac',
    'access control', 'jwt', 'sso'
  ],
  data: [
    'database', 'db', 'migration', 'schema', 'storage', 'postgresql',
    'postgres', 'supabase', 'mongodb', 'mysql', 'data model', 'table',
    'tables', 'sql', 'nosql', 'redis', 'cache'
  ],
  ui: [
    'dashboard', 'ui', 'ux', 'mobile', 'responsive', 'frontend',
    'design', 'layout', 'screen', 'page', 'interface', 'component',
    'button', 'form', 'modal', 'menu', 'navigation'
  ],
  artifacts: {
    file: ['file', 'script', '.js', '.ts', '.py', '.tsx', '.jsx', 'component'],
    endpoint: ['endpoint', 'route', 'api', 'get ', 'post ', 'put ', 'delete ', 'patch '],
    dashboard: ['dashboard', 'admin panel', 'control panel'],
    page: ['page', 'screen', 'view'],
    service: ['service', 'microservice', 'worker', 'job'],
    database: ['database', 'schema', 'migration', 'table'],
  },
  components: [
    'auth', 'authentication', 'database', 'api', 'frontend', 'backend',
    'dashboard', 'admin', 'user management', 'notification', 'payment',
    'integration', 'webhook', 'search', 'analytics', 'reporting'
  ],
  complexity: {
    high: ['multi-tenant', 'enterprise', 'rebuild', 'redesign', 'migrate', 
           'overhaul', 'rewrite', 'architecture', 'infrastructure'],
    vague: ['maybe', 'something like', 'not sure', 'or maybe', 'possibly',
            'perhaps', 'kind of', 'sort of', 'improve', 'better', 'optimize']
  }
};

/**
 * Parse a user's initial message and extract signals
 */
export function parseRequest(message: string): ParsedRequest {
  const lower = message.toLowerCase();
  
  // Basic metrics
  const wordCount = message.trim().split(/\s+/).length;
  const sentenceCount = message.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const questionMarks = (message.match(/\?/g) || []).length;
  
  // Keyword detection
  const mentionsIntegrations = containsAny(lower, KEYWORDS.integrations);
  const mentionsAuth = containsAny(lower, KEYWORDS.auth);
  const mentionsData = containsAny(lower, KEYWORDS.data);
  const mentionsMobileOrUI = containsAny(lower, KEYWORDS.ui);
  
  // Artifact type detection
  const artifactType = detectArtifactType(lower);
  const specificArtifact = extractSpecificArtifact(message);
  
  // User mentions
  const statedUsers = extractUsers(message);
  
  // Constraints
  const statedConstraints = extractConstraints(message);
  
  // Done state
  const statedDoneState = extractDoneState(message);
  
  // Specificity
  const specificity = determineSpecificity(message, lower, specificArtifact);
  
  // Component count
  const componentCount = estimateComponentCount(lower);
  
  return {
    rawMessage: message,
    artifactType,
    specificArtifact,
    statedUsers,
    statedConstraints,
    statedDoneState,
    mentionsIntegrations,
    mentionsAuth,
    mentionsData,
    mentionsMobileOrUI,
    wordCount,
    sentenceCount,
    questionMarks,
    specificity,
    componentCount,
  };
}

/**
 * Check if text contains any of the keywords
 */
function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

/**
 * Detect artifact type from text
 */
function detectArtifactType(lower: string): string | undefined {
  // Check in priority order
  if (containsAny(lower, KEYWORDS.artifacts.endpoint)) {
    return 'api endpoint';
  }
  if (containsAny(lower, KEYWORDS.artifacts.dashboard)) {
    return 'dashboard';
  }
  if (containsAny(lower, KEYWORDS.artifacts.file)) {
    return 'file';
  }
  if (containsAny(lower, KEYWORDS.artifacts.page)) {
    return 'page';
  }
  if (containsAny(lower, KEYWORDS.artifacts.service)) {
    return 'service';
  }
  if (containsAny(lower, KEYWORDS.artifacts.database)) {
    return 'database';
  }
  
  return undefined;
}

/**
 * Extract specific artifact name (filename, endpoint path, etc.)
 */
function extractSpecificArtifact(message: string): string | undefined {
  // Match file names with extensions
  const fileMatch = message.match(/\b[\w-]+\.(js|ts|py|tsx|jsx|css|html|json|sql)\b/);
  if (fileMatch) {
    return fileMatch[0];
  }
  
  // Match HTTP endpoints
  const endpointMatch = message.match(/\b(GET|POST|PUT|DELETE|PATCH)\s+\/[\w\/-]+/i);
  if (endpointMatch) {
    return endpointMatch[0];
  }
  
  // Match paths like /api/status
  const pathMatch = message.match(/\/[\w\/-]+/);
  if (pathMatch && pathMatch[0].length > 2) {
    return pathMatch[0];
  }
  
  return undefined;
}

/**
 * Extract user mentions
 */
function extractUsers(message: string): string[] | undefined {
  const users: string[] = [];
  const lower = message.toLowerCase();
  
  // Look for "for <user>" patterns
  const forMatch = message.match(/\bfor\s+([\w\s]+?)(?:\s+to\s+|\s+and\s+|,|\.|\s*$)/i);
  if (forMatch && forMatch[1]) {
    users.push(forMatch[1].trim());
  }
  
  // Look for role keywords
  const roles = ['admin', 'user', 'customer', 'manager', 'developer', 'team', 
                 'client', 'stakeholder', 'end user', 'internal', 'external'];
  roles.forEach(role => {
    if (lower.includes(role)) {
      users.push(role);
    }
  });
  
  return users.length > 0 ? [...new Set(users)] : undefined;
}

/**
 * Extract constraints
 */
function extractConstraints(message: string): string[] | undefined {
  const constraints: string[] = [];
  const lower = message.toLowerCase();
  
  // Tech constraints
  const techKeywords = ['react', 'vue', 'angular', 'typescript', 'python', 'node',
                        'postgres', 'supabase', 'tailwind', 'nextjs', 'express'];
  techKeywords.forEach(tech => {
    if (lower.includes(tech)) {
      constraints.push(`Tech: ${tech}`);
    }
  });
  
  // Time constraints
  if (lower.includes('urgent') || lower.includes('asap') || lower.includes('quickly')) {
    constraints.push('Time: urgent');
  }
  if (lower.match(/\d+\s*(hour|day|week)/)) {
    constraints.push('Time: deadline mentioned');
  }
  
  // Policy constraints
  if (lower.includes('gdpr') || lower.includes('hipaa') || lower.includes('compliance')) {
    constraints.push('Policy: compliance required');
  }
  
  return constraints.length > 0 ? constraints : undefined;
}

/**
 * Extract done state
 */
function extractDoneState(message: string): string | undefined {
  const lower = message.toLowerCase();
  
  // Look for clear done criteria
  if (lower.includes('prints') || lower.includes('outputs') || lower.includes('displays')) {
    const match = message.match(/(prints?|outputs?|displays?)\s+(.+?)(?:\.|$)/i);
    if (match && match[2]) {
      return match[2].trim();
    }
  }
  
  // Look for "that does X" patterns
  const thatMatch = message.match(/\bthat\s+([\w\s]+?)(?:\s+and\s+|,|\.|\s*$)/i);
  if (thatMatch && thatMatch[1] && thatMatch[1].length > 5) {
    return thatMatch[1].trim();
  }
  
  // Look for "to X" patterns
  const toMatch = message.match(/\bto\s+([\w\s]+?)(?:\s+for\s+|,|\.|\s*$)/i);
  if (toMatch && toMatch[1] && toMatch[1].length > 5) {
    return toMatch[1].trim();
  }
  
  return undefined;
}

/**
 * Determine specificity level
 */
function determineSpecificity(
  message: string,
  lower: string,
  specificArtifact?: string
): 'high' | 'medium' | 'low' {
  // High specificity: names exact files, endpoints, or technologies with clear criteria
  if (specificArtifact) {
    return 'high';
  }
  
  // Check for vague language
  if (containsAny(lower, KEYWORDS.complexity.vague)) {
    return 'low';
  }
  
  // Check for specific tech or patterns
  const hasSpecificTech = /\b(react|vue|angular|postgres|supabase|nextjs|express|typescript|python)\b/i.test(lower);
  const hasSpecificPattern = /\b(crud|rest|graphql|oauth|jwt|webhook)\b/i.test(lower);
  
  if (hasSpecificTech && hasSpecificPattern) {
    return 'high';
  }
  
  // Medium: describes a category but not exact implementation
  if (lower.includes('dashboard') || lower.includes('page') || lower.includes('api')) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Estimate component count
 */
function estimateComponentCount(lower: string): number {
  let count = 1; // Default: one thing requested
  
  // Count distinct components mentioned
  KEYWORDS.components.forEach(comp => {
    if (lower.includes(comp)) {
      count++;
    }
  });
  
  // Count "and" connectors (rough heuristic)
  const andCount = (lower.match(/\band\b/g) || []).length;
  count += Math.floor(andCount / 2);
  
  // Count comma-separated items in lists
  const commas = (lower.match(/,/g) || []).length;
  if (commas > 2) {
    count += Math.floor(commas / 2);
  }
  
  // Cap at reasonable maximum
  return Math.min(count, 10);
}
