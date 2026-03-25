/**
 * Coverage Model Tests
 * 
 * Test cases for the coverage tracking and stop decision logic
 */

import { describe, it, expect } from 'vitest';
import { parseRequest } from '../parseRequest.js';
import {
  initCoverage,
  updateCoverage,
  hasEnoughCoverage,
  getHighestValueUnknown,
  getCoverageSummary,
} from '../coverageModel.js';
import { IntakePath } from '../../types/vision.js';

describe('Coverage Model', () => {
  describe('initCoverage', () => {
    it('should mark artifact_type and done_state as known for clear request', () => {
      const parsed = parseRequest('Create hello.js that prints hello world');
      const coverage = initCoverage(parsed);
      
      expect(coverage.artifact_type).toBe('known');
      expect(coverage.done_state).toBe('known');
      expect(coverage.user_problem).toBe('assumed');
    });
    
    it('should mark most fields as unknown for vague request', () => {
      const parsed = parseRequest('Build me a dashboard');
      const coverage = initCoverage(parsed);
      
      expect(coverage.artifact_type).toBe('known');
      expect(coverage.target_user).toBe('unknown');
      expect(coverage.done_state).toBe('unknown');
      expect(coverage.current_state).toBe('unknown');
    });
    
    it('should detect integrations from request', () => {
      const parsed = parseRequest('Create API that connects to Slack');
      const coverage = initCoverage(parsed);
      
      expect(coverage.integrations).toBe('known');
    });
    
    it('should detect auth mentions', () => {
      const parsed = parseRequest('Build login system with JWT');
      const coverage = initCoverage(parsed);
      
      expect(coverage.data_auth_permissions).toBe('known');
    });
    
    it('should detect stated users', () => {
      const parsed = parseRequest('Make a tool for admins');
      const coverage = initCoverage(parsed);
      
      expect(coverage.target_user).toBe('known');
    });
  });
  
  describe('hasEnoughCoverage', () => {
    it('should return true for fast-path with artifact + done_state', () => {
      const parsed = parseRequest('Create hello.js that prints hello world');
      const coverage = initCoverage(parsed);
      
      expect(hasEnoughCoverage(coverage, 'fast-path')).toBe(true);
    });
    
    it('should return false for micro-vision missing target_user', () => {
      const parsed = parseRequest('Build a dashboard');
      const coverage = initCoverage(parsed);
      
      // Has artifact_type but missing other required fields
      expect(hasEnoughCoverage(coverage, 'micro-vision')).toBe(false);
    });
    
    it('should return false for full-vision with minimal info', () => {
      const parsed = parseRequest('Build a dashboard');
      const coverage = initCoverage(parsed);
      
      // Missing many required fields for full-vision
      expect(hasEnoughCoverage(coverage, 'full-vision')).toBe(false);
    });
  });
  
  describe('getHighestValueUnknown', () => {
    it('should prioritize target_user when unknown', () => {
      const parsed = parseRequest('Build a dashboard');
      const coverage = initCoverage(parsed);
      
      const nextField = getHighestValueUnknown(coverage, 'micro-vision');
      expect(nextField).toBe('target_user');
    });
    
    it('should return done_state after target_user is known', () => {
      const parsed = parseRequest('Build a dashboard for admins');
      const coverage = initCoverage(parsed);
      
      // target_user is known, next should be done_state
      const nextField = getHighestValueUnknown(coverage, 'micro-vision');
      expect(nextField).toBe('done_state');
    });
    
    it('should return null when all required fields are covered', () => {
      const parsed = parseRequest('Create hello.js that prints hello world');
      const coverage = initCoverage(parsed);
      
      // Fast-path only needs artifact + done_state, both known
      const nextField = getHighestValueUnknown(coverage, 'fast-path');
      expect(nextField).toBe(null);
    });
  });
  
  describe('updateCoverage', () => {
    it('should mark field as known when info provided', () => {
      const parsed = parseRequest('Build a dashboard');
      let coverage = initCoverage(parsed);
      
      expect(coverage.target_user).toBe('unknown');
      
      coverage = updateCoverage(coverage, {
        target_user: 'customer success managers',
      });
      
      expect(coverage.target_user).toBe('known');
    });
    
    it('should handle multiple fields at once', () => {
      const parsed = parseRequest('Build a tool');
      let coverage = initCoverage(parsed);
      
      coverage = updateCoverage(coverage, {
        target_user: 'developers',
        done_state: 'can export reports',
        constraints: 'must use React',
      });
      
      expect(coverage.target_user).toBe('known');
      expect(coverage.done_state).toBe('known');
      expect(coverage.constraints).toBe('known');
    });
    
    it('should ignore empty values', () => {
      const parsed = parseRequest('Build a dashboard');
      let coverage = initCoverage(parsed);
      
      const before = coverage.target_user;
      
      coverage = updateCoverage(coverage, {
        target_user: '',
      });
      
      expect(coverage.target_user).toBe(before);
    });
  });
  
  describe('getCoverageSummary', () => {
    it('should count known, assumed, and unknown fields', () => {
      const parsed = parseRequest('Create hello.js that prints hello world');
      const coverage = initCoverage(parsed);
      
      const summary = getCoverageSummary(coverage);
      
      expect(summary.total).toBe(11); // All coverage fields
      expect(summary.known).toBeGreaterThan(0);
      expect(summary.unknown).toBeGreaterThan(0);
    });
    
    it('should show high known count for detailed request', () => {
      const parsed = parseRequest(
        'Create auth.js for admins with JWT tokens that connects to PostgreSQL and logs to Slack'
      );
      const coverage = initCoverage(parsed);
      
      const summary = getCoverageSummary(coverage);
      
      expect(summary.known).toBeGreaterThanOrEqual(4);
    });
  });
  
  describe('Coverage flow for typical conversations', () => {
    it('should track micro-vision conversation to completion', () => {
      // Initial message
      const parsed = parseRequest('Build a dashboard');
      let coverage = initCoverage(parsed);
      
      expect(hasEnoughCoverage(coverage, 'micro-vision')).toBe(false);
      expect(getHighestValueUnknown(coverage, 'micro-vision')).toBe('target_user');
      
      // User answers: who is it for?
      coverage = updateCoverage(coverage, {
        target_user: 'customer success team',
      });
      
      expect(getHighestValueUnknown(coverage, 'micro-vision')).toBe('done_state');
      
      // User answers: what does done look like?
      coverage = updateCoverage(coverage, {
        done_state: 'shows ticket metrics and SLA compliance',
      });
      
      expect(getHighestValueUnknown(coverage, 'micro-vision')).toBe('current_state');
      
      // User answers: what exists today?
      coverage = updateCoverage(coverage, {
        current_state: 'manual spreadsheets',
      });
      
      // User answers: any constraints?
      coverage = updateCoverage(coverage, {
        constraints: 'must load in under 2 seconds',
      });
      
      // Now should have enough coverage
      expect(hasEnoughCoverage(coverage, 'micro-vision')).toBe(true);
      expect(getHighestValueUnknown(coverage, 'micro-vision')).toBe(null);
    });
  });
});
