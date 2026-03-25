/**
 * Agent adapter interface
 * 
 * All agent implementations (real or mock) must implement this interface.
 */

import { Job, ExecutionResult } from '../core/types.js';

export interface AgentAdapter {
  /**
   * Execute a job and return the result
   */
  execute(job: Job): Promise<ExecutionResult>;
}
