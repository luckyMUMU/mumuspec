import { describe, it, expect } from 'vitest';
import { computeSkillSet } from '../src/core/skill-loader.js';
import type { TaskCharacteristics } from '../src/core/types-workflow.js';

function makeChars(overrides: Partial<TaskCharacteristics> = {}): TaskCharacteristics {
  return {
    involves_concurrency: false,
    involves_new_dependency: false,
    involves_api_change: false,
    involves_database_schema: false,
    involves_ui: false,
    involves_config: false,
    ecosystems: [],
    ...overrides,
  };
}

describe('skill-loader', () => {
  describe('computeSkillSet — required skills always loaded', () => {
    it('should always include brainstorming as required', () => {
      const chars = makeChars();
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('brainstorming');
    });

    it('should always include gitnexus-exploring as required', () => {
      const chars = makeChars();
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('gitnexus-exploring');
    });

    it('should mark required skills with required=true', () => {
      const chars = makeChars();
      const skills = computeSkillSet(chars);
      const brainstorming = skills.find(s => s.name === 'brainstorming');
      expect(brainstorming?.required).toBe(true);
    });
  });

  describe('computeSkillSet — conditional skill loading', () => {
    it('should load concurrency-patterns when involves_concurrency', () => {
      const chars = makeChars({ involves_concurrency: true });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('concurrency-patterns');
    });

    it('should load dependency-management when involves_new_dependency', () => {
      const chars = makeChars({ involves_new_dependency: true });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('dependency-management');
    });

    it('should load api-design when involves_api_change', () => {
      const chars = makeChars({ involves_api_change: true });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('api-design');
    });

    it('should load migration-patterns when involves_database_schema', () => {
      const chars = makeChars({ involves_database_schema: true });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('migration-patterns');
    });

    it('should load component-patterns when involves_ui', () => {
      const chars = makeChars({ involves_ui: true });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('component-patterns');
    });
  });

  describe('computeSkillSet — no false positives', () => {
    it('should not load concurrency-patterns when not concurrent', () => {
      const chars = makeChars({ involves_concurrency: false });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).not.toContain('concurrency-patterns');
    });

    it('should not load api-design when no API change', () => {
      const chars = makeChars({ involves_api_change: false });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).not.toContain('api-design');
    });
  });

  describe('computeSkillSet — combined characteristics', () => {
    it('should load multiple skills for complex changes', () => {
      const chars = makeChars({
        involves_concurrency: true,
        involves_api_change: true,
        involves_new_dependency: true,
      });
      const skills = computeSkillSet(chars);
      const names = skills.map(s => s.name);
      expect(names).toContain('concurrency-patterns');
      expect(names).toContain('api-design');
      expect(names).toContain('dependency-management');
      // Required still present
      expect(names).toContain('brainstorming');
    });

    it('should set triggered_by on conditional skills', () => {
      const chars = makeChars({ involves_concurrency: true });
      const skills = computeSkillSet(chars);
      const concurrency = skills.find(s => s.name === 'concurrency-patterns');
      expect(concurrency?.required).toBe(false);
      expect(concurrency?.triggered_by).toBe('involves_concurrency');
    });
  });
});
