/**
 * Tests for skill-authoring/protocol.ts — AUTHORING_PROTOCOL constant and validateSkill.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AUTHORING_PROTOCOL,
  validateSkill,
  generateAuthoringProtocol,
  listCustomSkills,
  scaffoldSkill,
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

// ─── Expanded tests for protocol.ts ───

describe('scaffoldSkill — all parameter combinations', () => {
  const scaffoldRoot = join(tmpdir(), 'mumuspec-scaffold-' + Date.now());

  afterEach(() => {
    rmSync(scaffoldRoot, { recursive: true, force: true });
  });

  it('creates skill with default type and description (empty options)', () => {
    const result = scaffoldSkill(scaffoldRoot, 'default-skill');
    expect(result.created.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.length).toBe(0);
    const skillFile = join(scaffoldRoot, '.mumuspec', 'skills', 'default-skill', 'SKILL.md');
    expect(existsSync(skillFile)).toBe(true);
    const content = readFileSync(skillFile, 'utf8');
    expect(content).toContain('# default-skill');
    expect(content).toContain('**Type**: custom');
    expect(content).toContain('[Describe what this skill does]');
  });

  it('creates skill with custom type only', () => {
    const result = scaffoldSkill(scaffoldRoot, 'typed-skill', { type: 'analysis-skill' });
    expect(result.errors.length).toBe(0);
    const skillFile = join(scaffoldRoot, '.mumuspec', 'skills', 'typed-skill', 'SKILL.md');
    const content = readFileSync(skillFile, 'utf8');
    expect(content).toContain('**Type**: analysis-skill');
    expect(content).toContain('[Describe what this skill does]');
  });

  it('creates skill with description only', () => {
    const result = scaffoldSkill(scaffoldRoot, 'desc-skill', { description: 'This skill does X, Y, Z.' });
    expect(result.errors.length).toBe(0);
    const skillFile = join(scaffoldRoot, '.mumuspec', 'skills', 'desc-skill', 'SKILL.md');
    const content = readFileSync(skillFile, 'utf8');
    expect(content).toContain('This skill does X, Y, Z.');
    expect(content).toContain('**Type**: custom');
  });

  it('creates skill with both type and description', () => {
    const result = scaffoldSkill(scaffoldRoot, 'full-skill', { type: 'phase-skill', description: 'Full description here.' });
    expect(result.errors.length).toBe(0);
    const skillFile = join(scaffoldRoot, '.mumuspec', 'skills', 'full-skill', 'SKILL.md');
    const content = readFileSync(skillFile, 'utf8');
    expect(content).toContain('**Type**: phase-skill');
    expect(content).toContain('Full description here.');
  });

  it('returns error when skill directory already exists', () => {
    scaffoldSkill(scaffoldRoot, 'dup-skill');
    const result = scaffoldSkill(scaffoldRoot, 'dup-skill');
    expect(result.created.length).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('already exists');
  });

  it('creates reference directory alongside SKILL.md', () => {
    const result = scaffoldSkill(scaffoldRoot, 'ref-skill');
    const refDir = join(scaffoldRoot, '.mumuspec', 'skills', 'ref-skill', 'reference');
    expect(result.created).toContain(refDir);
    expect(existsSync(refDir)).toBe(true);
  });

  it('SKILL.md contains all template sections', () => {
    scaffoldSkill(scaffoldRoot, 'template-skill');
    const skillFile = join(scaffoldRoot, '.mumuspec', 'skills', 'template-skill', 'SKILL.md');
    const content = readFileSync(skillFile, 'utf8');
    expect(content).toContain('## Description');
    expect(content).toContain('## Instructions');
    expect(content).toContain('## Input');
    expect(content).toContain('## Output');
    expect(content).toContain('## Examples');
  });
});

describe('generateAuthoringProtocol — output format validation', () => {
  const protoRoot = join(tmpdir(), 'mumuspec-proto-' + Date.now());

  afterEach(() => {
    rmSync(protoRoot, { recursive: true, force: true });
  });

  it('generates valid YAML header with version and schema', () => {
    const result = generateAuthoringProtocol(protoRoot);
    expect(result.created).toBe(true);
    const content = readFileSync(result.path, 'utf8');
    expect(content).toContain('version: 0.12.2');
    expect(content).toContain('schema: mumuspec-skill-v1');
  });

  it('includes all subagents in generated protocol', () => {
    const result = generateAuthoringProtocol(protoRoot);
    const content = readFileSync(result.path, 'utf8');
    for (const agent of AUTHORING_PROTOCOL.subagents) {
      expect(content).toContain(agent);
    }
  });

  it('includes all templates in generated protocol', () => {
    const result = generateAuthoringProtocol(protoRoot);
    const content = readFileSync(result.path, 'utf8');
    for (const tmpl of AUTHORING_PROTOCOL.templates) {
      expect(content).toContain(tmpl);
    }
  });

  it('does not overwrite existing file on second call', () => {
    generateAuthoringProtocol(protoRoot);
    const firstContent = readFileSync(join(protoRoot, '.mumuspec', 'skill-authoring', 'protocol.yaml'), 'utf8');
    const result = generateAuthoringProtocol(protoRoot);
    expect(result.created).toBe(false);
    const secondContent = readFileSync(join(protoRoot, '.mumuspec', 'skill-authoring', 'protocol.yaml'), 'utf8');
    expect(secondContent).toBe(firstContent);
  });

  it('protocol file is within project .mumuspec directory', () => {
    const result = generateAuthoringProtocol(protoRoot);
    expect(result.path).toContain(join(protoRoot, '.mumuspec', 'skill-authoring'));
  });
});

describe('listCustomSkills — various directory states', () => {
  const listRoot = join(tmpdir(), 'mumuspec-list-' + Date.now());

  afterEach(() => {
    rmSync(listRoot, { recursive: true, force: true });
  });

  it('returns empty when skills dir does not exist', () => {
    const result = listCustomSkills(listRoot);
    expect(result).toEqual([]);
  });

  it('returns empty when skills dir is empty', () => {
    mkdirSync(join(listRoot, '.mumuspec', 'skills'), { recursive: true });
    const result = listCustomSkills(listRoot);
    expect(result).toEqual([]);
  });

  it('skips hidden directories (dot-prefixed)', () => {
    const skillsDir = join(listRoot, '.mumuspec', 'skills');
    mkdirSync(join(skillsDir, '.hidden-dir'), { recursive: true });
    mkdirSync(join(skillsDir, 'visible-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'visible-skill', 'SKILL.md'), '# Visible Skill.');
    const result = listCustomSkills(listRoot);
    const names = result.map((s) => s.name);
    expect(names).not.toContain('.hidden-dir');
    expect(names).toContain('visible-skill');
  });

  it('skips locale directories (en, zh)', () => {
    const skillsDir = join(listRoot, '.mumuspec', 'skills');
    mkdirSync(join(skillsDir, 'en'), { recursive: true });
    mkdirSync(join(skillsDir, 'zh'), { recursive: true });
    mkdirSync(join(skillsDir, 'real-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'real-skill', 'SKILL.md'), '# Real Skill.');
    const result = listCustomSkills(listRoot);
    const names = result.map((s) => s.name);
    expect(names).not.toContain('en');
    expect(names).not.toContain('zh');
    expect(names).toContain('real-skill');
  });

  it('validates each skill and reports valid flag correctly', () => {
    const skillsDir = join(listRoot, '.mumuspec', 'skills');
    const validDir = join(skillsDir, 'valid-skill');
    mkdirSync(validDir, { recursive: true });
    writeFileSync(join(validDir, 'SKILL.md'), '# Valid Skill.');
    mkdirSync(join(skillsDir, 'invalid-skill'), { recursive: true });
    const result = listCustomSkills(listRoot);
    const validEntry = result.find((s) => s.name === 'valid-skill');
    const invalidEntry = result.find((s) => s.name === 'invalid-skill');
    expect(validEntry).toBeDefined();
    expect(validEntry!.valid).toBe(true);
    expect(invalidEntry).toBeDefined();
    expect(invalidEntry!.valid).toBe(false);
  });

  it('returns skill with correct path', () => {
    const skillsDir = join(listRoot, '.mumuspec', 'skills');
    const skillDir = join(skillsDir, 'path-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# Path Skill.');
    const result = listCustomSkills(listRoot);
    expect(result[0]!.path).toBe(skillDir);
  });
});

describe('validateSkill — extended correctness', () => {
  const validateRoot = join(tmpdir(), 'mumuspec-validate-' + Date.now());

  afterEach(() => {
    rmSync(validateRoot, { recursive: true, force: true });
  });

  it('returns valid when SKILL.md exists with heading', () => {
    const skillDir = join(validateRoot, '.mumuspec', 'skills', 'good-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# Good Skill\nContent here.');
    const result = validateSkill(validateRoot, 'good-skill');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns error when neither SKILL.md nor skillName.md exists', () => {
    const skillDir = join(validateRoot, '.mumuspec', 'skills', 'no-file-skill');
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, 'reference'), { recursive: true });
    const result = validateSkill(validateRoot, 'no-file-skill');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing'))).toBe(true);
  });

  it('accepts skillName.md as alternative to SKILL.md', () => {
    const skillDir = join(validateRoot, '.mumuspec', 'skills', 'alt-format');
    mkdirSync(skillDir, { recursive: true });
    const skillsDir = join(validateRoot, '.mumuspec', 'skills');
    writeFileSync(join(skillsDir, 'alt-format.md'), '# Alt Skill.');
    const result = validateSkill(validateRoot, 'alt-format');
    expect(result.valid).toBe(true);
  });

  it('warns when SKILL.md does not start with heading', () => {
    const skillDir = join(validateRoot, '.mumuspec', 'skills', 'no-heading-v');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'Plain text without heading.');
    const result = validateSkill(validateRoot, 'no-heading-v');
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('heading');
  });

  it('returns error when skill directory does not exist', () => {
    const result = validateSkill(validateRoot, 'nonexistent-v');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('not found');
  });
});

describe('AUTHORING_PROTOCOL — extended field validation', () => {
  it('has exactly 4 subagents', () => {
    expect(AUTHORING_PROTOCOL.subagents).toHaveLength(4);
  });

  it('has exactly 3 templates', () => {
    expect(AUTHORING_PROTOCOL.templates).toHaveLength(3);
  });

  it('contains required subagent names', () => {
    expect(AUTHORING_PROTOCOL.subagents).toContain('skill-core-author');
    expect(AUTHORING_PROTOCOL.subagents).toContain('reference-author');
    expect(AUTHORING_PROTOCOL.subagents).toContain('workflow-entry-author');
    expect(AUTHORING_PROTOCOL.subagents).toContain('skill-reviewer');
  });

  it('contains required template names', () => {
    expect(AUTHORING_PROTOCOL.templates).toContain('phase-skill');
    expect(AUTHORING_PROTOCOL.templates).toContain('analysis-skill');
    expect(AUTHORING_PROTOCOL.templates).toContain('custom-workflow');
  });

  it('version follows semver format', () => {
    expect(AUTHORING_PROTOCOL.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('schema matches expected format', () => {
    expect(AUTHORING_PROTOCOL.schema).toBe('mumuspec-skill-v1');
  });
});
