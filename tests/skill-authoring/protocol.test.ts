/**
 * Tests for skill-authoring/protocol.ts — AUTHORING_PROTOCOL constant and validateSkill.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AUTHORING_PROTOCOL,
  validateSkill,
  generateAuthoringProtocol,
} from '../../src/skill-authoring/protocol.js';

const testRoot = join(tmpdir(), 'mumuspec-skill-proto-' + Date.now());

describe('skill-authoring/protocol', () => {
  it('AUTHORING_PROTOCOL has fields', () => {
    expect(AUTHORING_PROTOCOL.version).toBe('0.12.2');
    expect(AUTHORING_PROTOCOL.schema).toBe('mumuspec-skill-v1');
    expect(AUTHORING_PROTOCOL.subagents).toContain('skill-core-author');
    expect(AUTHORING_PROTOCOL.subagents).toContain('skill-reviewer');
    expect(AUTHORING_PROTOCOL.templates).toContain('analysis-skill');
  });

  it('validateSkill returns invalid for missing skill', () => {
    const result = validateSkill(testRoot, 'nonexistent');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validateSkill detects SKILL.md', () => {
    const skillDir = join(testRoot, '.mumuspec', 'skills', 'my-test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# My Test Skill\nSome content.');

    const result = validateSkill(testRoot, 'my-test-skill');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('validateSkill warns when SKILL.md has no heading', () => {
    const skillDir = join(testRoot, '.mumuspec', 'skills', 'no-heading-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'Just text without a heading.');

    const result = validateSkill(testRoot, 'no-heading-skill');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('generateAuthoringProtocol creates protocol file', () => {
    const result = generateAuthoringProtocol(testRoot);
    expect(result.created).toBe(true);
    expect(existsSync(result.path)).toBe(true);
  });

  it('generateAuthoringProtocol returns created: false on second call', () => {
    const result = generateAuthoringProtocol(testRoot);
    expect(result.created).toBe(false);
  });

  afterAll(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });
});
