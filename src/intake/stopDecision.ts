/**
 * Stop Decision Logic
 * 
 * Determines when to stop asking questions and proceed to building
 */

import { VisionSession, CoverageState, IntakePath } from '../types/vision.js';
import { hasEnoughCoverage } from './coverageModel.js';

export type StopReason =
  | 'coverage_met'        // all required fields covered
  | 'user_requested'      // user said "start now"
  | 'max_turns_reached'   // hit turn limit
  | 'low_info_replies'    // user giving minimal answers, switch to assumptions
  | 'continue';           // keep asking

export interface StopDecision {
  shouldStop: boolean;
  reason: StopReason;
  assumptionMode: boolean;  // if true, fill remaining unknowns with assumptions
}

/**
 * Determine if we should stop asking questions
 */
export function shouldStopAsking(
  session: VisionSession,
  coverage: CoverageState,
  userWantsToStart: boolean,
  consecutiveLowInfoReplies: number
): StopDecision {
  // User explicitly requested to start
  if (userWantsToStart) {
    return {
      shouldStop: true,
      reason: 'user_requested',
      assumptionMode: true,
    };
  }
  
  // Coverage is complete
  if (session.path && hasEnoughCoverage(coverage, session.path)) {
    return {
      shouldStop: true,
      reason: 'coverage_met',
      assumptionMode: false,
    };
  }
  
  // Hit max turns for this path
  const maxTurns = getMaxTurns(session.path!);
  if (session.turn_count >= maxTurns) {
    return {
      shouldStop: true,
      reason: 'max_turns_reached',
      assumptionMode: true,
    };
  }
  
  // User giving low-info replies repeatedly
  if (consecutiveLowInfoReplies >= 3) {
    return {
      shouldStop: true,
      reason: 'low_info_replies',
      assumptionMode: true,
    };
  }
  
  // Continue asking
  return {
    shouldStop: false,
    reason: 'continue',
    assumptionMode: false,
  };
}

/**
 * Get max turns allowed for a given path
 */
function getMaxTurns(path: IntakePath): number {
  switch (path) {
    case 'fast-path':
      return 0;  // Should never enter conversation
    case 'micro-vision':
      return 3;
    case 'full-vision':
      return 8;
    default:
      return 5;
  }
}

/**
 * Check if a reply is low-information (short, vague, or deflecting)
 */
export function isLowInfoReply(message: string): boolean {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  
  // Check for vague or deflecting phrases FIRST
  const vaguePatterns = [
    'not sure',
    'don\'t know',
    'maybe',
    'whatever',
    'up to you',
    'you decide',
    'anything',
    'doesn\'t matter',
    'idk',
    'dunno',
  ];
  
  if (vaguePatterns.some(pattern => lower.includes(pattern))) {
    return true;
  }
  
  // Very short replies
  if (trimmed.length < 10) {
    // Exception: if it's a clear answer like "managers" or "admins", don't penalize
    const words = lower.split(/\s+/);
    if (words.length === 1 && words[0].length > 3) {
      return false; // single meaningful word is okay
    }
    return true;
  }
  
  return false;
}
