/**
 * 约束来源闭合 — 「下层受上层约束」的可判定形式。
 *
 * 自由度边界把自由度定义为区间：上游给约束（下界），界内自由。推论是——一条约束
 * 若没有可解析的上游来源，它就不属于任何层级（越权约束）。`source_specs` 此前是
 * 零消费者字段，本组用例锁定它被真正核对。
 *
 * 三态：无来源 / 悬空来源 / 锚点漂移；加一态反面：来源正确必须静默。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  normalizeHeading,
  collectHeadings,
  resolveSourceSpec,
  iterateConstraintEntries,
  detectConstraintSourceDrift,
} from '../../src/spec/constraint-provenance.js';
import { loadAllConstraints } from '../../src/core/constraints-loader.js';
import { ERROR_CODES } from '../../src/core/errors.js';

/** 写入一份 constraints.yaml，条目按 [id, sourceRefs] 给出。 */
function writeConstraints(
  dir: string,
  entries: { id: string; sources?: string[] }[],
): void {
  const body = entries
    .map((e) => {
      const lines = [
        `    - id: ${e.id}`,
        `      content: "夹具约束 ${e.id}"`,
        `      min_strength: high`,
        `      enforcement: "none"`,
      ];
      if (e.sources) lines.push(`      source_specs: [${e.sources.map((s) => `"${s}"`).join(', ')}]`);
      return lines.join('\n');
    })
    .join('\n');
  writeFileSync(
    join(dir, '.mumuspec', 'constraints.yaml'),
    `version: "0.2.0"\nlast_updated: "2026-09-12"\nforward:\n  technical_design:\n${body || '    []'}\n  requirement_goals: []\nreverse:\n  technical_design: []\n  requirement_goals: []\n`,
  );
}

describe('normalizeHeading', () => {
  it('忽略大小写与空白、连字符、下划线、间隔号', () => {
    expect(normalizeHeading('Verifier 语义与可验证性（0.20）')).toBe('verifier语义与可验证性（0.20）');
    expect(normalizeHeading('verifier-语义与可验证性')).toBe('verifier语义与可验证性');
  });

  it('使两种写法归一后互为子串', () => {
    const heading = normalizeHeading('Verifier 语义与可验证性（0.20）');
    expect(heading.includes(normalizeHeading('verifier-语义与可验证性'))).toBe(true);
  });
});

describe('resolveSourceSpec / collectHeadings', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-cp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(dir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n# Spec\n\n## Requirement: 项目结构规范\n\n内容。\n\n### SHALL\n\n- 甲 SHALL 乙。\n',
    );
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('collectHeadings 读取全部层级标题', () => {
    expect(collectHeadings(join(dir, '.mumuspec', 'spec.md'))).toEqual([
      'Spec',
      'Requirement: 项目结构规范',
      'SHALL',
    ]);
  });

  it('文件不存在 → file-missing', () => {
    expect(resolveSourceSpec(dir, '.mumuspec/nope.md#x')).toEqual({
      ok: false,
      reason: 'file-missing',
    });
  });

  it('只指文件（无锚点）→ 校验文件存在即可', () => {
    expect(resolveSourceSpec(dir, '.mumuspec/spec.md')).toEqual({ ok: true });
  });

  it('锚点命中标题 → ok', () => {
    expect(resolveSourceSpec(dir, '.mumuspec/spec.md#项目结构规范')).toEqual({ ok: true });
  });

  it('锚点仅在归一化后命中 → ok（真实场景：带后缀括号 / 连字符写法）', () => {
    writeFileSync(
      join(dir, '.mumuspec', 'tech.md'),
      '## Requirement: Verifier 语义与可验证性（0.20）\n',
    );
    expect(resolveSourceSpec(dir, '.mumuspec/tech.md#verifier-语义与可验证性')).toEqual({ ok: true });
  });

  it('锚点不存在 → anchor-missing', () => {
    expect(resolveSourceSpec(dir, '.mumuspec/spec.md#根本不存在的标题')).toEqual({
      ok: false,
      reason: 'anchor-missing',
    });
  });
});

describe('detectConstraintSourceDrift', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-cpd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    writeFileSync(join(dir, '.mumuspec', 'spec.md'), '## Requirement: 项目结构规范\n\n内容。\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('来源齐备 → 零 drift（越权约束的反面）', () => {
    writeConstraints(dir, [{ id: 'TD-F-001', sources: ['.mumuspec/spec.md#项目结构规范'] }]);
    expect(detectConstraintSourceDrift(dir)).toEqual([]);
  });

  it('缺少 source_specs → E-CONSTRAINT-001 ERROR（越权约束）', () => {
    writeConstraints(dir, [{ id: 'TD-F-001' }]);
    const drifts = detectConstraintSourceDrift(dir);
    expect(drifts).toHaveLength(1);
    expect(drifts[0]).toMatchObject({
      code: 'E-CONSTRAINT-001',
      severity: 'ERROR',
      file: '.mumuspec/constraints.yaml',
    });
  });

  it('来源文件不存在 → E-CONSTRAINT-002 ERROR（悬空来源）', () => {
    writeConstraints(dir, [{ id: 'TD-F-001', sources: ['.mumuspec/nope.md#x'] }]);
    const drifts = detectConstraintSourceDrift(dir);
    expect(drifts).toHaveLength(1);
    expect(drifts[0]).toMatchObject({ code: 'E-CONSTRAINT-002', severity: 'ERROR' });
  });

  it('来源锚点未命中标题 → W-CONSTRAINT-003 WARN（锚点漂移）', () => {
    writeConstraints(dir, [{ id: 'TD-F-001', sources: ['.mumuspec/spec.md#查无此标题'] }]);
    const drifts = detectConstraintSourceDrift(dir);
    expect(drifts).toHaveLength(1);
    expect(drifts[0]).toMatchObject({ code: 'W-CONSTRAINT-003', severity: 'WARN' });
  });

  it('多来源逐条核验：一条坏来源只报一条', () => {
    writeConstraints(dir, [
      { id: 'TD-F-001', sources: ['.mumuspec/spec.md#项目结构规范', '.mumuspec/nope.md#x'] },
    ]);
    const drifts = detectConstraintSourceDrift(dir);
    expect(drifts).toHaveLength(1);
    expect(drifts[0].code).toBe('E-CONSTRAINT-002');
  });

  it('iterateConstraintEntries 覆盖 forward/reverse × 两维度', () => {
    writeConstraints(dir, []);
    writeFileSync(
      join(dir, '.mumuspec', 'constraints.yaml'),
      [
        'version: "0.2.0"',
        'forward:',
        '  technical_design:',
        '    - { id: TD-F-001, content: "a", min_strength: high, enforcement: none }',
        '  requirement_goals:',
        '    - { id: RG-F-001, content: "b", min_strength: high, enforcement: none }',
        'reverse:',
        '  technical_design:',
        '    - { id: TD-R-001, content: "c", min_strength: high, enforcement: none }',
        '  requirement_goals: []',
        '',
      ].join('\n'),
    );
    const ids = [...iterateConstraintEntries(loadAllConstraints(dir).files)].map((x) => x.entry.id);
    expect(ids.sort()).toEqual(['RG-F-001', 'TD-F-001', 'TD-R-001']);
  });
});

describe('本仓库自我 dogfooding', () => {
  it('仓库自身的约束条目全部有可解析来源（非空且无 ERROR）', () => {
    const { files } = loadAllConstraints(process.cwd());
    const entries = [...iterateConstraintEntries(files)].map((x) => x.entry);
    // 非空性：避免"零条目"让断言空洞地通过
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => (e.source_specs?.length ?? 0) > 0)).toBe(true);

    const errors = detectConstraintSourceDrift(process.cwd()).filter((d) => d.severity === 'ERROR');
    expect(errors).toEqual([]);
  });
});

describe('错误码已注册（与 error-code-registry 同纪律）', () => {
  it('三个码在册且 severity 与 drift 一致', () => {
    expect(ERROR_CODES['E-CONSTRAINT-001']?.severity).toBe('ERROR');
    expect(ERROR_CODES['E-CONSTRAINT-002']?.severity).toBe('ERROR');
    expect(ERROR_CODES['W-CONSTRAINT-003']?.severity).toBe('WARN');
  });
});
