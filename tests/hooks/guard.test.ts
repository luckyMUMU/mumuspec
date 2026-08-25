/**
 * Tests for src/hooks/guard.ts — hook installation and management utilities
 */

import { describe, it, expect } from 'vitest';
import {
  parseKnowledgeImpact,
} from '../../src/hooks/guard.js';

describe('hooks module', () => {
  describe('parseKnowledgeImpact', () => {
    it('returns null for empty message', () => {
      expect(parseKnowledgeImpact('')).toBeNull();
    });

    it('returns null for message without Knowledge-Impact block', () => {
      expect(parseKnowledgeImpact('feat: add new feature')).toBeNull();
    });

    it('parses Knowledge-Impact block with IMPLEMENTS', () => {
      const msg = 'feat: update feature\n\nKnowledge-Impact:\n  IMPLEMENTS: [KP-0001, KP-0002]';
      const result = parseKnowledgeImpact(msg);
      expect(result).not.toBeNull();
      expect(result!.implements).toContain('KP-0001');
      expect(result!.implements).toContain('KP-0002');
    });

    it('provides result with all required fields', () => {
      const msg = 'Knowledge-Impact:\n  IMPLEMENTS: [KP-0042]\n  AFFECTS: [KP-0043]\n  SUPERSEDES: [KP-0001]';
      const result = parseKnowledgeImpact(msg);
      expect(result).not.toBeNull();
      expect(result!).toHaveProperty('implements');
      expect(result!).toHaveProperty('affects');
      expect(result!).toHaveProperty('supersedes');
      expect(result!.implements).toBeInstanceOf(Array);
    });
  });
});
