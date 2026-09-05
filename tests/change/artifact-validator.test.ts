/**
 * Tests for src/change/artifact-validator.ts — completeness gate artifacts.
 * Locked test cases: TC-B1 / TC-B1x / TC-B3 / TC-B3x (layer-0-cases.md).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateArtifactData,
  validateArtifact,
  validateArtifactSchema,
  validateArtifactSemantics,
  extractDecisionRefs,
  ARTIFACT_SCHEMA_VERSION,
} from '../../src/change/artifact-validator.js';

const CHANGE = 'test-change';

const DECISIONS = `# Decision Log: ${CHANGE}

## [open] 2026-09-01T14:27:28.783Z

D1/C2 裁决：标记分路。

## [design] 2026-09-01T15:00:00.000Z

D9 裁决：示例条目。
`;

function validOqYaml(): string {
  return [
    'version: 1',
    `change: ${CHANGE}`,
    'items:',
    '  - id: OQ-1',
    '    question: 冲突策略用哪种？',
    '    status: resolved',
    '    resolution:',
    '      decision_ref: "2026-09-01T14:27:28.783Z"',
    '  - id: OQ-2',
    '    question: 是否需要迁移命令？',
    '    status: accepted',
    '    resolution:',
    '      decision_ref: "2026-09-01T15:00:00.000Z"',
    '  - id: OQ-3',
    '    question: 旧变更如何处置？',
    '    status: deferred',
    '    resolution:',
    '      decision_ref: "2026-09-01T14:27:28.783Z"',
    '      note: 归档至 W1 收尾',
    '  - id: OQ-4',
    '    question: 还有别的问题吗？',
    '    status: open',
  ].join('\n');
}

function validAssumptionsYaml(): string {
  return [
    'version: 1',
    `change: ${CHANGE}`,
    'items:',
    '  - id: AS-1',
    '    assumption: 用户已授权 --confirm 放行',
    '    status: resolved',
    '    resolution:',
    '      decision_ref: "2026-09-01T14:27:28.783Z"',
  ].join('\n');
}

describe('TC-B1: schema 非法 → E-CHANGE-020', () => {
  const cases: Array<[string, string, string]> = [
    ['缺 version 字段', `change: ${CHANGE}\nitems: []`, 'version'],
    ['version 非法值 2', `version: 2\nchange: ${CHANGE}\nitems: []`, 'version'],
    ['缺 items 字段', `version: 1\nchange: ${CHANGE}`, 'items'],
    ['items 非数组', `version: 1\nchange: ${CHANGE}\nitems: "all good"`, 'items'],
    [
      'item 缺 id',
      `version: 1\nchange: ${CHANGE}\nitems:\n  - question: q?\n    status: open`,
      'items[0].id',
    ],
    [
      'item 缺 question（open-questions）',
      `version: 1\nchange: ${CHANGE}\nitems:\n  - id: OQ-1\n    status: open`,
      'items[0].question',
    ],
    [
      'status 非法枚举',
      `version: 1\nchange: ${CHANGE}\nitems:\n  - id: OQ-1\n    question: q?\n    status: done`,
      'items[0].status',
    ],
    [
      'status=resolved 但缺 resolution 对象',
      `version: 1\nchange: ${CHANGE}\nitems:\n  - id: OQ-1\n    question: q?\n    status: resolved`,
      'items[0].resolution',
    ],
    [
      'resolution.decision_ref 类型非法',
      `version: 1\nchange: ${CHANGE}\nitems:\n  - id: OQ-1\n    question: q?\n    status: resolved\n    resolution:\n      decision_ref: 123`,
      'items[0].resolution.decision_ref',
    ],
  ];

  for (const [name, yaml, expectedPath] of cases) {
    it(`${name} → E-CHANGE-020（path=${expectedPath}）`, () => {
      const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
      expect(result.exists).toBe(true);
      expect(result.isValid).toBe(false);
      const e20 = result.errors.filter((e) => e.code === 'E-CHANGE-020');
      expect(e20.length).toBeGreaterThan(0);
      expect(e20.some((e) => e.path === expectedPath)).toBe(true);
    });
  }

  it('change 与当前变更不匹配 → E-CHANGE-020', () => {
    const yaml = `version: 1\nchange: other-change\nitems: []`;
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-020' && e.path === 'change')).toBe(true);
  });

  it('YAML 语法错误 → fail-closed（E-CHANGE-020，绝不静默通过）', () => {
    const result = validateArtifactData('version: 1\nitems: [unclosed', 'open-questions', CHANGE, DECISIONS);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('E-CHANGE-020');
    expect(result.errors[0].path).toBe('(document)');
  });

  it('全 open 工件结构合法（isValid=true）——block 判定属 guard 层，依据 openItemIds', () => {
    // 双轨制分层：校验器只判结构/链完整性；"存在未消解项"的 block 由 guard 依据 openItemIds 决定（TC-B2a）
    const result = validateArtifactData(
      `version: 1\nchange: ${CHANGE}\nitems:\n  - id: OQ-1\n    question: q?\n    status: open`,
      'open-questions',
      CHANGE,
      DECISIONS
    );
    expect(result.isValid).toBe(true);
    expect(result.openItemIds).toEqual(['OQ-1']);
  });
});

describe('TC-B1x: 合法工件通过校验（正向基线）', () => {
  it('open-questions：open + resolved + accepted + deferred 混合 → isValid=true', () => {
    const result = validateArtifactData(validOqYaml(), 'open-questions', CHANGE, DECISIONS);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
    expect(result.openItemIds).toEqual(['OQ-4']);
    expect(result.items.length).toBe(4);
  });

  it('assumptions 同构（assumption 字段 + AS- 前缀）→ isValid=true', () => {
    const result = validateArtifactData(validAssumptionsYaml(), 'assumptions', CHANGE, DECISIONS);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('advisory 自由字段被忽略（不进入判定路径，向前兼容）', () => {
    const yaml = `version: 1\nchange: ${CHANGE}\ncompleteness: complete\nitems:\n  - id: OQ-1\n    question: q?\n    status: open\n    llm_opinion: 完备无疑`;
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    expect(result.isValid).toBe(true);
  });

  it('ARTIFACT_SCHEMA_VERSION === 1（C4 契约冻结）', () => {
    expect(ARTIFACT_SCHEMA_VERSION).toBe(1);
  });
});

describe('TC-B3: decision_ref 指向不存在条目 → E-CHANGE-021', () => {
  it('decision_ref 无命中 → E-CHANGE-021，诊断含未命中值', () => {
    const yaml = [
      'version: 1',
      `change: ${CHANGE}`,
      'items:',
      '  - id: OQ-1',
      '    question: q?',
      '    status: resolved',
      '    resolution:',
      '      decision_ref: "2026-09-01T00:00:00Z"',
    ].join('\n');
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    expect(result.isValid).toBe(false);
    const e21 = result.errors.filter((e) => e.code === 'E-CHANGE-021');
    expect(e21.length).toBe(1);
    expect(e21[0].path).toBe('items[0].resolution.decision_ref');
    expect(e21[0].message).toContain('2026-09-01T00:00:00Z');
  });

  it('decision_ref 命中 decisions.md 实存条目（跨 phase 头）→ 通过', () => {
    const yaml = [
      'version: 1',
      `change: ${CHANGE}`,
      'items:',
      '  - id: OQ-1',
      '    question: q?',
      '    status: resolved',
      '    resolution:',
      '      decision_ref: "2026-09-01T15:00:00.000Z"',
    ].join('\n');
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    expect(result.isValid).toBe(true);
  });
});

describe('TC-B3x: deferred 缺 note → E-CHANGE-021', () => {
  it('deferred 无 note → E-CHANGE-021', () => {
    const yaml = [
      'version: 1',
      `change: ${CHANGE}`,
      'items:',
      '  - id: OQ-1',
      '    question: q?',
      '    status: deferred',
      '    resolution:',
      '      decision_ref: "2026-09-01T14:27:28.783Z"',
    ].join('\n');
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    const e21 = result.errors.filter((e) => e.code === 'E-CHANGE-021');
    expect(e21.length).toBe(1);
    expect(e21[0].path).toBe('items[0].resolution.note');
  });

  it('deferred 有 note → 通过', () => {
    const yaml = [
      'version: 1',
      `change: ${CHANGE}`,
      'items:',
      '  - id: OQ-1',
      '    question: q?',
      '    status: deferred',
      '    resolution:',
      '      decision_ref: "2026-09-01T14:27:28.783Z"',
      '      note: W2 再议',
    ].join('\n');
    const result = validateArtifactData(yaml, 'open-questions', CHANGE, DECISIONS);
    expect(result.isValid).toBe(true);
  });
});

describe('extractDecisionRefs（机械锚点）', () => {
  it('提取所有 ## [<phase>] <时间戳> 条目', () => {
    expect(extractDecisionRefs(DECISIONS)).toEqual([
      '2026-09-01T14:27:28.783Z',
      '2026-09-01T15:00:00.000Z',
    ]);
  });

  it('空内容 / 无条目 → 空数组', () => {
    expect(extractDecisionRefs('')).toEqual([]);
    expect(extractDecisionRefs('# 标题\n正文，无条目')).toEqual([]);
  });
});

describe('validateArtifact（IO 壳）', () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-artifact-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testRoot, '.mumuspec', 'changes', CHANGE), { recursive: true });
    writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'decisions.md'), DECISIONS);
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('工件缺失 → exists=false（缺失分支策略由 guard 决定）', () => {
    const result = validateArtifact(testRoot, CHANGE, 'open-questions');
    expect(result.exists).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([]);
  });

  it('合法工件落盘 → isValid=true', () => {
    writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'), validOqYaml());
    const result = validateArtifact(testRoot, CHANGE, 'open-questions');
    expect(result.exists).toBe(true);
    expect(result.isValid).toBe(true);
  });

  it('非法工件落盘 → E-CHANGE-020', () => {
    writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'assumptions.yaml'), 'items: []');
    const result = validateArtifact(testRoot, CHANGE, 'assumptions');
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-020')).toBe(true);
  });
});

describe('分层校验（schema 与语义独立可测）', () => {
  it('validateArtifactSchema 只报 020；validateArtifactSemantics 只报 021', () => {
    const data = {
      version: 1,
      change: CHANGE,
      items: [
        {
          id: 'OQ-1',
          question: 'q?',
          status: 'resolved',
          resolution: { decision_ref: 'nonexistent-ref' },
        },
      ],
    };
    const schemaErrors = validateArtifactSchema(data, 'open-questions', CHANGE);
    expect(schemaErrors).toEqual([]);
    const semanticErrors = validateArtifactSemantics(data, DECISIONS);
    expect(semanticErrors.length).toBe(1);
    expect(semanticErrors[0].code).toBe('E-CHANGE-021');
  });
});
