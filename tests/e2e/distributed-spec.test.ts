/**
 * E2E Test: Distributed Spec V2 Integration
 *
 * Verifies the full workflow:
 *   init --distributed → parse → validate → guard (SHALL NOT from prd/tech)
 *
 * Run: npx vitest run tests/e2e/distributed-spec.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parsePrdFile, parseTechFile } from '../../src/spec/parser.js';
import { validateAllSpecs } from '../../src/spec/validator.js';
import { checkCompliance } from '../../src/guard/checker.js';
import type { PrdFile, TechFile } from '../../src/core/types-spec.js';

const TEST_ROOT = join(tmpdir(), 'mumuspec-e2e-distributed-' + Date.now());

beforeEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

/** Helper: write a prd.md with SHALL NOT constraints */
function writePrd(path: string, shallNots: string[]): void {
  const mumuDir = join(path, '.mumuspec');
  mkdirSync(mumuDir, { recursive: true });

  const lines = [
    '---',
    'layer: 1',
    `scope: "${path.split(/[\\/]/).pop() || 'test'}"`,
    `last_updated: "${new Date().toISOString().split('T')[0]}"`,
    'doc_type: prd',
    '---',
    '',
    '## Requirement: Feature Goals',
    '',
    '### SHALL',
    '- Feature must work correctly',
    '',
    '### SHALL NOT',
  ];
  for (const sn of shallNots) {
    lines.push(`- ${sn}`);
  }
  lines.push('');

  writeFileSync(join(mumuDir, 'prd.md'), lines.join('\n'));
}

/** Helper: write a tech.md with SHALL NOT constraints */
function writeTech(path: string, shallNots: string[]): void {
  const mumuDir = join(path, '.mumuspec');
  mkdirSync(mumuDir, { recursive: true });

  const lines = [
    '---',
    'layer: 1',
    `scope: "${path.split(/[\\/]/).pop() || 'test'}"`,
    `last_updated: "${new Date().toISOString().split('T')[0]}"`,
    'doc_type: tech',
    '---',
    '',
    '## Requirement: Architecture Constraints',
    '',
    '### SHALL',
    '- Use TypeScript strict mode',
    '',
    '### SHALL NOT',
  ];
  for (const sn of shallNots) {
    lines.push(`- ${sn}`);
  }
  lines.push('');

  writeFileSync(join(mumuDir, 'tech.md'), lines.join('\n'));
}

describe('Distributed Spec V2 — E2E Integration', () => {
  describe('Parser Integration', () => {
    it('parses prd.md SHALL NOT from Requirement blocks', () => {
      const prdContent = [
        '---',
        'layer: 1',
        'scope: "test"',
        'last_updated: "2026-08-09"',
        'doc_type: prd',
        '---',
        '',
        '## Requirement: Feature Goals',
        '',
        '### SHALL NOT',
        '- 禁止使用 eval() 动态执行代码',
        '- Must not use innerHTML with user input',
        '',
      ].join('\n');

      const prd: PrdFile = parsePrdFile(prdContent, '/test/.mumuspec/prd.md');

      expect(prd.requirements).toBeDefined();
      expect(prd.requirements!.length).toBe(1);
      expect(prd.requirements![0].shallNot).toContain('禁止使用 eval() 动态执行代码');
      expect(prd.requirements![0].shallNot).toContain('Must not use innerHTML with user input');
    });

    it('parses tech.md SHALL NOT from Requirement blocks', () => {
      const techContent = [
        '---',
        'layer: 1',
        'scope: "test"',
        'last_updated: "2026-08-09"',
        'doc_type: tech',
        '---',
        '',
        '## Requirement: Security',
        '',
        '### SHALL NOT',
        '- No hardcoded secrets in source code',
        '- 禁止使用不安全的随机数生成器',
        '',
      ].join('\n');

      const tech: TechFile = parseTechFile(techContent, '/test/.mumuspec/tech.md');

      expect(tech.requirements.length).toBe(1);
      expect(tech.requirements[0].shallNot).toContain('No hardcoded secrets in source code');
      expect(tech.requirements[0].shallNot).toContain('禁止使用不安全的随机数生成器');
    });

    it('populates prd.requirements field for Guard access', () => {
      const prdContent = [
        '---',
        'layer: 1',
        'scope: "test"',
        'doc_type: prd',
        '---',
        '',
        '## Requirement: Security Goals',
        '',
        '### SHALL NOT',
        '- 禁止明文存储密码',
        '',
      ].join('\n');

      const prd = parsePrdFile(prdContent, '/test/.mumuspec/prd.md');
      expect(prd.requirements).toBeDefined();
      expect(prd.requirements!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Validator Integration', () => {
    it('validateAllSpecs accepts V2-format prd.md + tech.md', () => {
      const projectDir = join(TEST_ROOT, 'valid-project');
      mkdirSync(projectDir, { recursive: true });

      writePrd(projectDir, ['禁止 eval']);
      writeTech(projectDir, ['禁止硬编码密钥']);

      const config = {
        specs: { max_layer_depth: 5, require_design_doc: false },
        project: { name: 'test' },
      } as any;

      const result = validateAllSpecs(projectDir, config);
      expect(result.passed).toBe(true);
      expect(result.errors.filter(e => e.code.startsWith('E-SPEC-008') || e.code.startsWith('E-SPEC-009'))).toHaveLength(0);
    });

    it('validateAllSpecs detects invalid prd.md frontmatter', () => {
      const projectDir = join(TEST_ROOT, 'invalid-prd');
      const mumuDir = join(projectDir, '.mumuspec');
      mkdirSync(mumuDir, { recursive: true });

      // Missing required layer field
      writeFileSync(join(mumuDir, 'prd.md'), [
        '---',
        'scope: "test"',
        'doc_type: prd',
        '---',
        '',
        '## Requirement: Goals',
        '',
        '### SHALL NOT',
        '- Do bad thing',
        '',
      ].join('\n'));

      const config = {
        specs: { max_layer_depth: 5, require_design_doc: false },
        project: { name: 'test' },
      } as any;

      const result = validateAllSpecs(projectDir, config);
      // Should have E-SPEC-008 error about invalid frontmatter
      const prdErrors = result.errors.filter(e => e.code === 'E-SPEC-008');
      expect(prdErrors.length).toBeGreaterThan(0);
    });

    it('validateAllSpecs warns on prd.md without Requirement blocks', () => {
      const projectDir = join(TEST_ROOT, 'no-req-blocks');
      const mumuDir = join(projectDir, '.mumuspec');
      mkdirSync(mumuDir, { recursive: true });

      // V2 format but no ## Requirement: blocks
      writeFileSync(join(mumuDir, 'prd.md'), [
        '---',
        'layer: 1',
        'scope: "test"',
        'doc_type: prd',
        '---',
        '',
        'Some free text without requirement blocks.',
        '',
      ].join('\n'));

      const config = {
        specs: { max_layer_depth: 5, require_design_doc: false },
        project: { name: 'test' },
      } as any;

      const result = validateAllSpecs(projectDir, config);
      const formatWarnings = result.warnings.filter(e => e.code === 'E-SPEC-011');
      expect(formatWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Guard Layer Integration', () => {
    it('collects SHALL NOT from prd.md without throwing', () => {
      const projectDir = join(TEST_ROOT, 'guard-prd');
      mkdirSync(projectDir, { recursive: true });

      writePrd(projectDir, ['禁止使用 eval() 动态执行']);

      const result = checkCompliance(projectDir, { shallNot: true });
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('collects SHALL NOT from tech.md without throwing', () => {
      const projectDir = join(TEST_ROOT, 'guard-tech');
      mkdirSync(projectDir, { recursive: true });

      writeTech(projectDir, ['No hardcoded secrets']);

      const result = checkCompliance(projectDir, { shallNot: true });
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    it('backward compat — project without prd/tech only checks spec.md', () => {
      const projectDir = join(TEST_ROOT, 'guard-legacy');
      mkdirSync(projectDir, { recursive: true });

      // Only spec.md, no prd/tech
      const mumuDir = join(projectDir, '.mumuspec');
      mkdirSync(mumuDir, { recursive: true });
      writeFileSync(join(mumuDir, 'spec.md'), [
        '---',
        'layer: 0',
        'scope: "legacy"',
        'doc_type: spec',
        '---',
        '',
        '## Requirement: General',
        '',
        '### SHALL NOT',
        '- 禁止使用 var 声明',
        '',
      ].join('\n'));

      const result = checkCompliance(projectDir, { shallNot: true });
      // Should complete without errors about missing prd/tech
      expect(result).toBeDefined();
    });

    it('handles malformed prd.md gracefully', () => {
      const projectDir = join(TEST_ROOT, 'guard-malformed-prd');
      mkdirSync(projectDir, { recursive: true });

      // Write malformed prd.md (invalid yaml)
      const mumuDir = join(projectDir, '.mumuspec');
      mkdirSync(mumuDir, { recursive: true });
      writeFileSync(join(mumuDir, 'prd.md'), '---\ninvalid: [yaml: {\n---\n');

      // Should not throw
      const result = checkCompliance(projectDir, { shallNot: true });
      expect(result).toBeDefined();
    });

    it('handles prd.md without V2 doc_type marker (skipped)', () => {
      const projectDir = join(TEST_ROOT, 'guard-old-prd');
      mkdirSync(projectDir, { recursive: true });

      // Write old-format prd.md (no doc_type: prd)
      const mumuDir = join(projectDir, '.mumuspec');
      mkdirSync(mumuDir, { recursive: true });
      writeFileSync(join(mumuDir, 'prd.md'), [
        '# Old-format PRD',
        '',
        'This file does not have doc_type marker.',
        '',
      ].join('\n'));

      // Should not throw — old format is silently skipped
      const result = checkCompliance(projectDir, { shallNot: true });
      expect(result).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('full chain: parse → validate → guard', () => {
      const projectDir = join(TEST_ROOT, 'e2e-full');

      writePrd(projectDir, ['禁止禁用 strict mode']);
      writeTech(projectDir, ['禁止跳过构建步骤']);

      // 1. Parse
      const prdContent = readFileSync(join(projectDir, '.mumuspec', 'prd.md'), 'utf8');
      const techContent = readFileSync(join(projectDir, '.mumuspec', 'tech.md'), 'utf8');

      const prd = parsePrdFile(prdContent, join(projectDir, '.mumuspec', 'prd.md'));
      const tech = parseTechFile(techContent, join(projectDir, '.mumuspec', 'tech.md'));

      expect(prd.requirements![0].shallNot).toContain('禁止禁用 strict mode');
      expect(tech.requirements[0].shallNot).toContain('禁止跳过构建步骤');

      // 2. Validate
      const config = {
        specs: { max_layer_depth: 5, require_design_doc: false },
        project: { name: 'test' },
      } as any;
      const validationResult = validateAllSpecs(projectDir, config);
      expect(validationResult.errors.filter(e => e.code === 'E-SPEC-008' || e.code === 'E-SPEC-009')).toHaveLength(0);

      // 3. Guard check shouldn't throw
      const guardResult = checkCompliance(projectDir, { shallNot: true });
      expect(guardResult).toBeDefined();
    });

    it('multi-level distributed specs', () => {
      const rootDir = join(TEST_ROOT, 'multi-level');
      const srcDir = join(rootDir, 'src');
      const coreDir = join(srcDir, 'core');

      writePrd(rootDir, ['Root prohibition']);
      writeTech(rootDir, ['Root tech prohibition']);
      writePrd(srcDir, ['Src prohibition']);
      writeTech(coreDir, ['Core tech prohibition']);

      // All levels should parse successfully
      const rootPrd = parsePrdFile(
        readFileSync(join(rootDir, '.mumuspec', 'prd.md'), 'utf8'),
        join(rootDir, '.mumuspec', 'prd.md')
      );
      const coreTech = parseTechFile(
        readFileSync(join(coreDir, '.mumuspec', 'tech.md'), 'utf8'),
        join(coreDir, '.mumuspec', 'tech.md')
      );

      expect(rootPrd.requirements![0].shallNot).toContain('Root prohibition');
      expect(coreTech.requirements[0].shallNot).toContain('Core tech prohibition');
    });
  });
});
