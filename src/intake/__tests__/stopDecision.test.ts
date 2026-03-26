/**
 * Stop Decision Tests
 * 
 * Test cases for the stop decision logic
 */

import { describe, it, expect } from 'vitest';
import { shouldStopAsking, isLowInfoReply } from '../stopDecision.js';
import { VisionSession, CoverageState } from '../../types/vision.js';

describe('Stop Decision', () => {
  const baseCoverage: CoverageState = {
    artifact_type: 'known',
    user_problem: 'assumed',
    target_user: 'unknown',
    current_state: 'unknown',
    done_state: 'unknown',
    constraints: 'unknown',
    must_not_do: 'unknown',
    integrations: 'unknown',
    data_auth_permissions: 'unknown',
    non_obvious_risks: 'unknown',
    decisions_already_made: 'unknown',
  };
  
  const microVisionSession: VisionSession = {
    id: 'test-session',
    status: 'active',
    path: 'micro-vision',
    turn_count: 1,
    initial_message: 'Build a dashboard',
    coverage: baseCoverage,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  describe('shouldStopAsking', () => {
    it('should stop when user explicitly requests it', () => {
      const decision = shouldStopAsking(
        microVisionSession,
        baseCoverage,
        true, // userWantsToStart
        0
      );
      
      expect(decision.shouldStop).toBe(true);
      expect(decision.reason).toBe('user_requested');
      expect(decision.assumptionMode).toBe(true);
    });
    
    it('should stop when coverage is met', () => {
      const completeCoverage: CoverageState = {
        ...baseCoverage,
        target_user: 'known',
        done_state: 'known',
        current_state: 'known',
        constraints: 'known',
      };
      
      const decision = shouldStopAsking(
        microVisionSession,
        completeCoverage,
        false,
        0
      );
      
      expect(decision.shouldStop).toBe(true);
      expect(decision.reason).toBe('coverage_met');
      expect(decision.assumptionMode).toBe(false);
    });
    
    it('should stop when max turns reached', () => {
      const maxTurnSession: VisionSession = {
        ...microVisionSession,
        turn_count: 3, // micro-vision max is 3
      };
      
      const decision = shouldStopAsking(
        maxTurnSession,
        baseCoverage,
        false,
        0
      );
      
      expect(decision.shouldStop).toBe(true);
      expect(decision.reason).toBe('max_turns_reached');
      expect(decision.assumptionMode).toBe(true);
    });
    
    it('should stop after 3 consecutive low-info replies', () => {
      const decision = shouldStopAsking(
        microVisionSession,
        baseCoverage,
        false,
        3 // consecutiveLowInfoReplies
      );
      
      expect(decision.shouldStop).toBe(true);
      expect(decision.reason).toBe('low_info_replies');
      expect(decision.assumptionMode).toBe(true);
    });
    
    it('should continue when conditions not met', () => {
      const decision = shouldStopAsking(
        microVisionSession,
        baseCoverage,
        false,
        0
      );
      
      expect(decision.shouldStop).toBe(false);
      expect(decision.reason).toBe('continue');
      expect(decision.assumptionMode).toBe(false);
    });
    
    it('should have different max turns for different paths', () => {
      const fullVisionSession: VisionSession = {
        ...microVisionSession,
        path: 'full-vision',
        turn_count: 5,
      };
      
      // 5 turns should not stop full-vision (max is 8)
      const decision = shouldStopAsking(
        fullVisionSession,
        baseCoverage,
        false,
        0
      );
      
      expect(decision.shouldStop).toBe(false);
      
      // But 8 turns should stop
      const maxTurnSession: VisionSession = {
        ...fullVisionSession,
        turn_count: 8,
      };
      
      const decision2 = shouldStopAsking(
        maxTurnSession,
        baseCoverage,
        false,
        0
      );
      
      expect(decision2.shouldStop).toBe(true);
      expect(decision2.reason).toBe('max_turns_reached');
    });
  });
  
  describe('isLowInfoReply', () => {
    it('should detect very short replies as low-info', () => {
      expect(isLowInfoReply('ok')).toBe(true);
      expect(isLowInfoReply('idk')).toBe(true);
      expect(isLowInfoReply('maybe')).toBe(true);
    });
    
    it('should allow single meaningful words', () => {
      expect(isLowInfoReply('managers')).toBe(false);
      expect(isLowInfoReply('admins')).toBe(false);
      expect(isLowInfoReply('developers')).toBe(false);
    });
    
    it('should detect vague phrases', () => {
      expect(isLowInfoReply('not sure')).toBe(true);
      expect(isLowInfoReply("don't know")).toBe(true);
      expect(isLowInfoReply('whatever you think')).toBe(true);
      expect(isLowInfoReply('up to you')).toBe(true);
      expect(isLowInfoReply("doesn't matter")).toBe(true);
    });
    
    it('should not penalize substantive replies', () => {
      expect(isLowInfoReply('For customer support agents to track tickets')).toBe(false);
      expect(isLowInfoReply('It should show real-time metrics')).toBe(false);
      expect(isLowInfoReply('We need it to load in under 2 seconds')).toBe(false);
    });
  });
});
