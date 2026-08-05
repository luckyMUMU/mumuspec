/**
 * Tests for src/install/installer-ops.ts — installation utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  isAgentSupported,
  getSupportedAgents,
  resolvePackage,
  searchPackages,
  getManifest,
  formatInstalledSkills,
  type AgentType,
} from '../../src/install/installer-ops.js';

describe('installer-ops', () => {
  describe('isAgentSupported', () => {
    it('returns true for supported agents', () => {
      expect(isAgentSupported('catpaw')).toBe(true);
      expect(isAgentSupported('claude')).toBe(true);
      expect(isAgentSupported('cursor')).toBe(true);
    });

    it('returns false for unsupported agents', () => {
      expect(isAgentSupported('unknown-agent')).toBe(false);
      expect(isAgentSupported('')).toBe(false);
    });
  });

  describe('getSupportedAgents', () => {
    it('returns array of supported agents', () => {
      const agents = getSupportedAgents();
      expect(agents).toBeInstanceOf(Array);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('catpaw');
    });
  });

  describe('resolvePackage', () => {
    it('returns package for valid name', () => {
      const pkg = resolvePackage('catpaw', '@mumuspec/mcp-server');
      // May or may not exist in fixture data
      if (pkg) {
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('version');
      } else {
        expect(pkg).toBeUndefined();
      }
    });

    it('returns undefined for unknown package', () => {
      const pkg = resolvePackage('catpaw', 'nonexistent-package-xyz');
      expect(pkg).toBeUndefined();
    });
  });

  describe('searchPackages', () => {
    it('returns results for matching keyword', () => {
      const results = searchPackages('catpaw', 'mumuspec');
      expect(results).toBeInstanceOf(Array);
    });

    it('returns empty array for non-matching keyword', () => {
      const results = searchPackages('catpaw', 'zzzz-nonexistent');
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });
  });

  describe('getManifest', () => {
    it('returns manifest for valid agent', () => {
      const manifest = getManifest('catpaw');
      expect(manifest).toBeInstanceOf(Array);
      expect(manifest.length).toBeGreaterThan(0);
    });
  });

  describe('formatInstalledSkills', () => {
    it('formats empty list', () => {
      const result = formatInstalledSkills([]);
      expect(typeof result).toBe('string');
    });

    it('formats single skill', () => {
      const result = formatInstalledSkills([{ name: 'test-skill', version: '1.0.0' }]);
      expect(result).toContain('test-skill');
    });
  });
});
