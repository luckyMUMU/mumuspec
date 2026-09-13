/**
 * Structure lint tests (shall-structure-lint, 2026-09-13).
 *
 * TC1/TC2 — lintConstraintText word-list matching (unit).
 * TC3/TC4 — validator integration: W-SPEC-016 fires on SHALL/SHALL NOT with
 *           vague qualifiers, clean specs stay silent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VAGUE_QUALIFIERS, lintConstraintText } from '../../src/spec/structure-lint.js';
import { validateAllSpecs } from '../../src/spec/validator.js';
import type { MumuSpecConfig } from '../../src/core/types.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-structure-lint-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeConfig(): MumuSpecConfig {
  return {
    specs: { max_layer_depth: 5, require_design_doc: false },
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'high',
      exceptions: [],
      enforcement_strict: true,
    },
  } as unknown as MumuSpecConfig;
}

describe('lintConstraintText (unit)', () => {
  it('TC1: every word in VAGUE_QUALIFIERS is matched', () => {
    for (const q of VAGUE_QUALIFIERS) {
      const finding = lintConstraintText(`操作时须${q}处理`);
      expect(finding).not.toBeNull();
      expect(finding!.qualifiers).toContain(q);
    }
  });

  it('TC2: clean text returns null; multiple hits deduplicate in word-list order', () => {
    expect(lintConstraintText('必须输出 JSON 且字段齐全')).toBeNull();
    const finding = lintConstraintText('必要时适当合理地处理');
    expect(finding!.qualifiers).toEqual(['合理', '适当', '必要时']);
  });
});

describe('validator integration (W-SPEC-016)', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTmpProject();
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  });

  afterEach(() => cleanup(dir));

  it('TC3: SHALL with vague qualifier produces W-SPEC-016 warning with hit list', () => {
    const spec = [
      '---',
      'layer: 0',
      'scope: "."',
      '---',
      '',
      '## Requirement: 日志',
      '',
      '### SHALL',
      '- 系统须合理地记录操作日志',
      '',
    ].join('\n');
    writeFileSync(join(dir, '.mumuspec', 'spec.md'), spec);

    const result = validateAllSpecs(dir, makeConfig());
    const w016 = result.warnings.filter((w) => w.code === 'W-SPEC-016');
    expect(w016.length).toBe(1);
    expect(w016[0].message).toContain('日志');
    expect(w016[0].message).toContain('合理');
    expect(w016[0].detail).toContain('[命中: 合理]');
    // advisory: does not fail validation
    expect(result.passed).toBe(true);
  });

  it('TC4: SHALL NOT triggers too; clean spec stays silent', () => {
    const spec = [
      '---',
      'layer: 0',
      'scope: "."',
      '---',
      '',
      '## Requirement: 缓存',
      '',
      '### SHALL NOT',
      '- 禁止酌情跳过缓存失效',
      '',
      '## Requirement: 接口',
      '',
      '### SHALL',
      '- 所有公开接口必须声明返回类型',
      '',
    ].join('\n');
    writeFileSync(join(dir, '.mumuspec', 'spec.md'), spec);

    const result = validateAllSpecs(dir, makeConfig());
    const w016 = result.warnings.filter((w) => w.code === 'W-SPEC-016');
    expect(w016.length).toBe(1);
    expect(w016[0].message).toContain('酌情');
  });
});
