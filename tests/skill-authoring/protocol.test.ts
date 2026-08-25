/**
 * Unit tests for src/skill-authoring/protocol.ts — skill validation, listing, and scaffolding.
 *
 * Improves skill-authoring test coverage (D8 dimension).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  validateSkill,
  listCustomSkills,
  scaffoldSkill,
  AUTHORING_PROTOCOL,
} from '../../src/skill-authoring/protocol.js';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), `mumuspec-skill-${Date.now()}-${Math.random().toString(36).slice(2)}`));
}

function safeRemove(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('skill-authoring/protocol.ts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    safeRemove(tempDir);
  });

  // ── validateSkill ──

  describe('validateSkill', () => {
    it('returns invalid when skill directory does not exist', () => {
      const result = validateSkill(tempDir, 'nonexistent');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns valid when SKILL.md exists in skill directory', () => {
      const skillDir = join(tempDir, '.mumuspec', 'skills', 'my-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), '# My Skill\n\nContent');

      const result = validateSkill(tempDir, 'my-skill');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns valid when skill file exists directly in skills/', () => {
      // validateSkill checks skillDir exists first, so we need the directory
      const skillDir = join(tempDir, '.mumuspec', 'skills', 'my-skill');
      mkdirSync(skillDir, { recursive: true });
      // Also place a direct file
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      writeFileSync(join(skillsDir, 'my-skill.md'), '# My Skill');

      const result = validateSkill(tempDir, 'my-skill');
      expect(result.valid).toBe(true);
    });

    it('returns invalid when neither SKILL.md nor direct file exists', () => {
      const skillDir = join(tempDir, '.mumuspec', 'skills', 'empty-skill');
      mkdirSync(skillDir, { recursive: true });

      const result = validateSkill(tempDir, 'empty-skill');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing'))).toBe(true);
    });

    it('warns when SKILL.md does not start with # heading', () => {
      const skillDir = join(tempDir, '.mumuspec', 'skills', 'bad-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), 'Some text without heading');

      const result = validateSkill(tempDir, 'bad-skill');
      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('title'))).toBe(true);
    });
  });

  // ── listCustomSkills ──

  describe('listCustomSkills', () => {
    it('returns empty array when skills directory does not exist', () => {
      const result = listCustomSkills(tempDir);
      expect(result).toEqual([]);
    });

    it('lists skill directories', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(join(skillsDir, 'skill-a', 'reference'), { recursive: true });
      writeFileSync(join(skillsDir, 'skill-a', 'SKILL.md'), '# Skill A');
      mkdirSync(join(skillsDir, 'skill-b'), { recursive: true });
      writeFileSync(join(skillsDir, 'skill-b', 'SKILL.md'), '# Skill B');

      const result = listCustomSkills(tempDir);
      expect(result.length).toBe(2);
      const names = result.map(s => s.name).sort();
      expect(names).toEqual(['skill-a', 'skill-b']);
    });

    it('skips locale directories (en, zh)', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(join(skillsDir, 'en'), { recursive: true });
      mkdirSync(join(skillsDir, 'zh'), { recursive: true });
      mkdirSync(join(skillsDir, 'my-skill'), { recursive: true });
      writeFileSync(join(skillsDir, 'my-skill', 'SKILL.md'), '# My Skill');

      const result = listCustomSkills(tempDir);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('my-skill');
    });

    it('skips dot-directories', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(join(skillsDir, '.hidden'), { recursive: true });
      mkdirSync(join(skillsDir, 'visible'), { recursive: true });
      writeFileSync(join(skillsDir, 'visible', 'SKILL.md'), '# Visible');

      const result = listCustomSkills(tempDir);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('visible');
    });

    it('marks invalid skills correctly', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(join(skillsDir, 'valid-skill'), { recursive: true });
      writeFileSync(join(skillsDir, 'valid-skill', 'SKILL.md'), '# Valid');
      mkdirSync(join(skillsDir, 'invalid-skill'), { recursive: true });
      // No SKILL.md

      const result = listCustomSkills(tempDir);
      const validSkill = result.find(s => s.name === 'valid-skill');
      const invalidSkill = result.find(s => s.name === 'invalid-skill');
      expect(validSkill?.valid).toBe(true);
      expect(invalidSkill?.valid).toBe(false);
    });
  });

  // ── scaffoldSkill ──

  describe('scaffoldSkill', () => {
    it('creates skill directory with SKILL.md and reference dir', () => {
      const result = scaffoldSkill(tempDir, 'new-skill', {
        type: 'custom',
        description: 'A test skill',
      });

      expect(result.errors).toEqual([]);
      expect(result.created.length).toBe(3); // dir + SKILL.md + reference dir

      const skillDir = join(tempDir, '.mumuspec', 'skills', 'new-skill');
      expect(existsSync(skillDir)).toBe(true);
      expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(join(skillDir, 'reference'))).toBe(true);
    });

    it('returns error when skill already exists', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills', 'existing');
      mkdirSync(skillsDir, { recursive: true });

      const result = scaffoldSkill(tempDir, 'existing');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('already exists');
    });

    it('SKILL.md contains skill name and description', () => {
      scaffoldSkill(tempDir, 'described-skill', {
        description: 'Custom description here',
      });

      const skillFile = join(tempDir, '.mumuspec', 'skills', 'described-skill', 'SKILL.md');
      const content = require('node:fs').readFileSync(skillFile, 'utf8');
      expect(content).toContain('described-skill');
      expect(content).toContain('Custom description here');
    });
  });

  // ── AUTHORING_PROTOCOL ──

  describe('AUTHORING_PROTOCOL', () => {
    it('has version string', () => {
      expect(AUTHORING_PROTOCOL.version).toBeTruthy();
    });

    it('has schema identifier', () => {
      expect(AUTHORING_PROTOCOL.schema).toBeTruthy();
    });

    it('has subagents array', () => {
      expect(Array.isArray(AUTHORING_PROTOCOL.subagents)).toBe(true);
      expect(AUTHORING_PROTOCOL.subagents.length).toBeGreaterThan(0);
    });

    it('has templates array', () => {
      expect(Array.isArray(AUTHORING_PROTOCOL.templates)).toBe(true);
    });
  });
});
