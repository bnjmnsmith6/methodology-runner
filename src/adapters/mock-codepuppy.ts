/**
 * Mock Code Puppy adapter
 * 
 * Simulates the Code Puppy CLI for build/fix tasks.
 * Occasionally returns STOP_AND_ASK to test decision flow.
 */

import { AgentAdapter } from './interface.js';
import { Job, ExecutionResult, JobType } from '../core/types.js';

export class MockCodePuppyAdapter implements AgentAdapter {
  private failureRate = 0.1; // 10% chance of failure (builds fail more often)
  private stopAndAskRate = 0.15; // 15% chance of asking for help
  
  async execute(job: Job): Promise<ExecutionResult> {
    // Validate job type
    const validTypes = [JobType.CODEPUPPY_BUILD, JobType.CODEPUPPY_FIX, JobType.SMOKE_RUN];
    if (!validTypes.includes(job.type)) {
      return {
        status: 'FAILED',
        error: {
          kind: 'WRONG_JOB_TYPE',
          message: `MockCodePuppyAdapter cannot handle job type ${job.type}`,
          retryable: false,
        },
      };
    }
    
    // Simulate realistic delay (Code Puppy works hard)
    const delay = this.getDelayForJobType(job.type);
    await this.sleep(delay);
    
    // Random STOP_AND_ASK (only for build/fix jobs, not smoke tests)
    if (job.type !== JobType.SMOKE_RUN && Math.random() < this.stopAndAskRate) {
      return this.generateStopAndAsk(job);
    }
    
    // Random failure simulation
    if (Math.random() < this.failureRate) {
      return {
        status: 'FAILED',
        error: {
          kind: 'BUILD_ERROR',
          message: 'Mock build failed: TypeScript compilation error',
          retryable: true,
        },
      };
    }
    
    // Route to appropriate handler
    switch (job.type) {
      case JobType.CODEPUPPY_BUILD:
        return this.handleBuild(job);
      case JobType.CODEPUPPY_FIX:
        return this.handleFix(job);
      case JobType.SMOKE_RUN:
        return this.handleSmokeTest(job);
      default:
        return {
          status: 'FAILED',
          error: {
            kind: 'UNKNOWN_JOB_TYPE',
            message: `Unknown job type: ${job.type}`,
            retryable: false,
          },
        };
    }
  }
  
  private handleBuild(job: Job): ExecutionResult {
    const input = job.input as any;
    
    const buildLog = `🐶 Code Puppy Build Log
==========================================

Repository: ${input.repo_path || '/tmp/unknown'}
Constellation Packet: Loaded ✅

Phase 1: Foundation
  ✅ Created project structure
  ✅ Installed dependencies
  ✅ Configured TypeScript

Phase 2: Features
  ✅ Implemented core logic
  ✅ Added error handling
  ✅ Input validation complete

Phase 3: Polish
  ✅ Added unit tests (12 passed)
  ✅ Documentation generated
  ✅ Linting passed

==========================================
Build Status: SUCCESS ✅
Files Changed: 15
Duration: ${this.getDelayForJobType(JobType.CODEPUPPY_BUILD)}ms
==========================================
`;
    
    return {
      status: 'SUCCEEDED',
      artifacts: [{
        rp_id: job.rp_id!,
        type: 'build_log',
        name: 'build.log',
        content: buildLog,
        metadata: {
          files_changed: 15,
          tests_passed: 12,
        },
      }],
    };
  }
  
  private handleFix(job: Job): ExecutionResult {
    const input = job.input as any;
    
    const fixLog = `🐶 Code Puppy Fix Log
==========================================

Repository: ${input.repo_path || '/tmp/unknown'}
Fix Instructions: Applied ✅

Fixes Applied:
  1. ✅ Added null check in validation
  2. ✅ Fixed data format validation
  3. ✅ Added await to async call

Tests Run:
  ✅ 12 unit tests passed
  ✅ 3 integration tests passed
  ✅ Edge cases covered

==========================================
Fix Status: SUCCESS ✅
Files Changed: 3
Duration: ${this.getDelayForJobType(JobType.CODEPUPPY_FIX)}ms
==========================================
`;
    
    return {
      status: 'SUCCEEDED',
      artifacts: [{
        rp_id: job.rp_id!,
        type: 'fix_log',
        name: 'fix.log',
        content: fixLog,
        metadata: {
          files_changed: 3,
          tests_passed: 15,
        },
      }],
    };
  }
  
  private handleSmokeTest(job: Job): ExecutionResult {
    const input = job.input as any;
    
    // Smoke tests have a 20% failure rate to test the debug loop
    const passed = Math.random() > 0.2;
    
    const testLog = `🐶 Smoke Test Results
==========================================

Repository: ${input.repo_path || '/tmp/unknown'}
Test Command: ${input.test_command || 'npm test'}

Tests Run: 12
Passed: ${passed ? '12' : '10'}
Failed: ${passed ? '0' : '2'}

${passed ? '✅ All tests passed!' : `❌ Tests failed:
  - test_edge_case_null: Expected null check
  - test_async_operation: Promise not awaited
`}

==========================================
Status: ${passed ? 'PASS' : 'FAIL'} ${passed ? '✅' : '❌'}
Duration: ${this.getDelayForJobType(JobType.SMOKE_RUN)}ms
==========================================
`;
    
    return {
      status: passed ? 'SUCCEEDED' : 'FAILED',
      artifacts: [{
        rp_id: job.rp_id!,
        type: 'test_results',
        name: 'smoke-test.log',
        content: testLog,
        metadata: {
          tests_run: 12,
          tests_passed: passed ? 12 : 10,
          tests_failed: passed ? 0 : 2,
        },
      }],
      error: passed ? undefined : {
        kind: 'TEST_FAILURE',
        message: '2 tests failed - see log for details',
        retryable: true,
      },
    };
  }
  
  private generateStopAndAsk(job: Job): ExecutionResult {
    const questions = [
      {
        question: 'I found ambiguity in the spec: should the API return 200 or 201 for successful creation?',
        options: ['Return 200 (OK)', 'Return 201 (Created)', 'Use 200 for updates, 201 for creates'],
      },
      {
        question: 'The constellation packet mentions "offline support" but doesn\'t specify the sync strategy. What approach should I take?',
        options: ['Optimistic sync (sync on reconnect)', 'Pessimistic sync (queue operations)', 'Skip offline support for v1'],
      },
      {
        question: 'Should I use TypeScript strict mode? It will require more explicit types.',
        options: ['Yes, use strict mode', 'No, use standard mode', 'Use strict for new files only'],
      },
    ];
    
    const question = questions[Math.floor(Math.random() * questions.length)];
    
    return {
      status: 'STOP_AND_ASK',
      stopAndAsk: question,
    };
  }
  
  private getDelayForJobType(jobType: JobType): number {
    switch (jobType) {
      case JobType.CODEPUPPY_BUILD:
        return 4000; // Building takes time
      case JobType.CODEPUPPY_FIX:
        return 2500; // Fixes are faster
      case JobType.SMOKE_RUN:
        return 1500; // Tests are quick
      default:
        return 2000;
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
