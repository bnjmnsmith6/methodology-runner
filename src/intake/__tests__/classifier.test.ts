/**
 * Classifier Tests
 * 
 * Test cases for the intake classifier (parseRequest + classifyPath)
 */

import { describe, it, expect } from 'vitest';
import { parseRequest } from '../parseRequest.js';
import { classifyPath } from '../classifyPath.js';

describe('Intake Classifier', () => {
  describe('Fast-path cases', () => {
    it('should classify "Create hello.js that prints hello world" as fast-path', () => {
      const parsed = parseRequest('Create hello.js that prints hello world');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('fast-path');
      expect(decision.confidence).toBeGreaterThan(0.7);
      expect(parsed.specificArtifact).toBe('hello.js');
      expect(parsed.artifactType).toBe('file');
    });
    
    it('should classify "Rename the Save button to Publish" as fast-path or micro', () => {
      const parsed = parseRequest('Rename the Save button to Publish');
      const decision = classifyPath(parsed);
      
      // This is borderline - no specific file, but simple change
      expect(['fast-path', 'micro-vision']).toContain(decision.path);
      expect(parsed.componentCount).toBeLessThanOrEqual(2);
    });
    
    it('should classify "Add a console.log to server.ts line 42" as fast-path', () => {
      const parsed = parseRequest('Add a console.log to server.ts line 42');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('fast-path');
      expect(parsed.specificArtifact).toBe('server.ts');
    });
  });
  
  describe('Micro-vision cases', () => {
    it('should classify "Build a landing page for my app" as micro-vision', () => {
      const parsed = parseRequest('Build a landing page for my app');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('micro-vision');
      expect(parsed.artifactType).toBe('page');
    });
    
    it('should classify "Make me a dashboard" as micro-vision', () => {
      const parsed = parseRequest('Make me a dashboard');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('micro-vision');
      expect(parsed.artifactType).toBe('dashboard');
    });
    
    it('should classify "Create an API for user management" as micro-vision', () => {
      const parsed = parseRequest('Create an API for user management');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('micro-vision');
      expect(parsed.artifactType).toBe('api endpoint');
    });
  });
  
  describe('Full-vision cases', () => {
    it('should classify complex multi-component request as full-vision', () => {
      const parsed = parseRequest(
        'Build a customer success dashboard with alerts, permissions, and Slack integration'
      );
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('full-vision');
      expect(decision.confidence).toBeGreaterThan(0.6);
      expect(parsed.mentionsIntegrations).toBe(true);
      expect(parsed.componentCount).toBeGreaterThanOrEqual(3);
    });
    
    it('should classify "Rebuild the app onboarding and payment flow" as full-vision', () => {
      const parsed = parseRequest('Rebuild the app onboarding and payment flow');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('full-vision');
      expect(parsed.componentCount).toBeGreaterThan(1);
    });
    
    it('should classify multi-tenant SaaS request as full-vision', () => {
      const parsed = parseRequest(
        'Create a multi-tenant SaaS admin panel with role-based access'
      );
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('full-vision');
      expect(parsed.mentionsAuth).toBe(true);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle very long detailed message correctly', () => {
      const longMessage = `Create a comprehensive user authentication system with JWT tokens, 
        password reset via email, OAuth integration with Google and GitHub, rate limiting 
        on login attempts, session management with Redis, and a dashboard for admins to 
        manage users, view login history, and configure security settings. The system should 
        be built with Node.js and TypeScript, use PostgreSQL for user data, and follow 
        OWASP security best practices.`;
      
      const parsed = parseRequest(longMessage);
      const decision = classifyPath(parsed);
      
      // Should be full-vision despite high word count, because of complexity
      expect(decision.path).toBe('full-vision');
      expect(parsed.mentionsAuth).toBe(true);
      expect(parsed.mentionsIntegrations).toBe(true);
      expect(parsed.mentionsData).toBe(true);
    });
    
    it('should classify one-word "dashboard" as micro-vision', () => {
      const parsed = parseRequest('dashboard');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('micro-vision');
      expect(parsed.specificity).not.toBe('high');
    });
    
    it('should classify vague "just create something" as micro-vision', () => {
      const parsed = parseRequest('just create something');
      const decision = classifyPath(parsed);
      
      expect(decision.path).toBe('micro-vision');
      expect(parsed.specificity).toBe('low');
    });
    
    it('should never return fast-path when auth is mentioned', () => {
      const parsed = parseRequest('Create login.js with authentication');
      const decision = classifyPath(parsed);
      
      expect(decision.path).not.toBe('fast-path');
      expect(parsed.mentionsAuth).toBe(true);
    });
    
    it('should never return fast-path when integrations are mentioned', () => {
      const parsed = parseRequest('Create webhook.js that connects to Slack');
      const decision = classifyPath(parsed);
      
      expect(decision.path).not.toBe('fast-path');
      expect(parsed.mentionsIntegrations).toBe(true);
    });
  });
  
  describe('ParseRequest signal detection', () => {
    it('should detect file artifacts', () => {
      const parsed = parseRequest('Update server.ts');
      expect(parsed.artifactType).toBe('file');
      expect(parsed.specificArtifact).toBe('server.ts');
    });
    
    it('should detect endpoint artifacts', () => {
      const parsed = parseRequest('Add GET /api/users endpoint');
      expect(parsed.artifactType).toBe('api endpoint');
      expect(parsed.specificArtifact).toContain('/api/users');
    });
    
    it('should detect integrations', () => {
      const parsed = parseRequest('Connect to Stripe API');
      expect(parsed.mentionsIntegrations).toBe(true);
    });
    
    it('should detect auth mentions', () => {
      const parsed = parseRequest('Add login with JWT tokens');
      expect(parsed.mentionsAuth).toBe(true);
    });
    
    it('should detect data mentions', () => {
      const parsed = parseRequest('Set up PostgreSQL database');
      expect(parsed.mentionsData).toBe(true);
    });
    
    it('should detect UI mentions', () => {
      const parsed = parseRequest('Design a responsive dashboard');
      expect(parsed.mentionsMobileOrUI).toBe(true);
    });
    
    it('should extract user mentions', () => {
      const parsed = parseRequest('Build a tool for admins and managers');
      expect(parsed.statedUsers).toContain('admin');
      expect(parsed.statedUsers).toContain('manager');
    });
    
    it('should extract done state', () => {
      const parsed = parseRequest('Create report.js that outputs CSV files');
      expect(parsed.statedDoneState).toContain('CSV');
    });
  });
});
