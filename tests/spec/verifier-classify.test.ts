/**
 * Verifier semantics tests (P0, 2026-08-29).
 *
 * Covers proposal `review/proposal-verifier-semantics-2026-08-29.md` test cases:
 *   T1-T7, T13, T14 — classifier (four verifiability classes) + coverage + F8 fix
 *   + manual(...) parser round-trip.
 *
 * Design reference: proposal §3.1 (classification rules R1→R4), §3.2 (manual
 * reserved word), §3.6 (examples).
 */

import { describe, it, expect } from 'vitest';
import {
  classifyConstraint,
  classifyRequirements,
  computeEnforcementCoverage,
  isRegexCheckable,
  extractRegexPatterns,
  missingManualEvidence,
} from '../../src/spec/verifier-classify.js';
import { parseSpecFile, serializeSpecFile } from '../../src/spec/parser.js';
import { autoAnnotate } from '../../src/spec/annotation.js';
import type { Requirement } from '../../src/core/types-spec.js';
import type { ProhibitionAnnotation } from '../../src/core/types-spec.js';

// ── Helpers ──────────────────────────────────────────────────────────

function req(overrides: Partial<Requirement> & { name?: string }): Requirement {
  return {
    name: 'General',
    shall: [],
    shallNot: [],
    should: [],
    enforcement: [],
    ...overrides,
  } as Requirement;
}

const noAnnotations: ProhibitionAnnotation[] = [];

// ── T1-T4, T6: classifyConstraint polarity & channel rules ──────────

describe('classifyConstraint', () => {
  it('T1: SHALL NOT with non-custom annotation → enforced-strong', () => {
    const cls = classifyConstraint({
      requirement: '依赖管理',
      polarity: 'shall-not',
      text: '禁止引入未被请求的依赖',
      annotations: [{ text: '禁止引入未被请求的依赖', annotation: { type: 'no-new-dependency', scope: 'module' } }],
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).toBe('enforced-strong');
  });

  it('T1b: SHALL NOT with custom annotation → not strong (falls through)', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: '禁止某自由行为',
      annotations: [{ text: '禁止某自由行为', annotation: { type: 'custom' } }],
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).not.toBe('enforced-strong');
  });

  it('T1c: SHALL NOT with ast: prefix → enforced-strong', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: 'ast:no-mutable-state',
      annotations: [],
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).toBe('enforced-strong');
  });

  it('T2: SHALL NOT without annotation but with quoted term → enforced-weak', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: '禁止使用 `lodash` 等未请求依赖',
      annotations: noAnnotations,
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).toBe('enforced-weak');
  });

  it('T3: SHALL NOT free text without any channel → unverifiable', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: '禁止引入未被请求的抽象层与第三方依赖',
      annotations: noAnnotations,
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).toBe('unverifiable');
  });

  it('T4: SHALL NOT with explicit manual(...) enforcement → manual', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: '禁止引入未被请求的抽象层与第三方依赖',
      annotations: noAnnotations,
      enforcement: [{ id: 'ENF-1', description: '依赖清单人工核对', kind: 'manual', severity: 'ERROR' }],
      source: 'spec.md',
    });
    expect(cls).toBe('manual');
  });

  it('T5: SHALL without any enforcement → unverifiable', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall',
      text: '所有公开函数必须有 TSDoc',
      annotations: noAnnotations,
      enforcement: [],
      source: 'spec.md',
    });
    expect(cls).toBe('unverifiable');
  });

  it('T6: SHALL with legacy free-text enforcement → manual (implicit)', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall',
      text: '所有公开函数必须有 TSDoc',
      annotations: noAnnotations,
      enforcement: [{ id: 'ENF-1', description: 'code review 检查 TSDoc', kind: 'implicit-manual', severity: 'ERROR' }],
      source: 'spec.md',
    });
    expect(cls).toBe('manual');
  });

  it('R2 outranks R3: SHALL NOT with quoted term AND manual enforcement → enforced-weak', () => {
    const cls = classifyConstraint({
      requirement: 'X',
      polarity: 'shall-not',
      text: '禁止使用 `eval`',
      annotations: noAnnotations,
      enforcement: [{ id: 'ENF-1', description: '人工审查', kind: 'manual', severity: 'ERROR' }],
      source: 'spec.md',
    });
    expect(cls).toBe('enforced-weak');
  });
});

// ── T2/T3 channel predicate: isRegexCheckable ────────────────────────

describe('isRegexCheckable / extractRegexPatterns', () => {
  it('quoted terms are checkable and produce word-boundary patterns for short terms', () => {
    expect(isRegexCheckable('禁止使用 `htm` 模板')).toBe(true);
    const patterns = extractRegexPatterns('禁止使用 `htm` 模板');
    expect(patterns.length).toBe(1);
    expect(patterns[0].test('const x = htm`<div/>`;')).toBe(true);
    // word boundary: must not match inside longer words
    expect(patterns[0].test('text/html content')).toBe(false);
  });

  it('eval / 动态执行 / jsx keywords are checkable without quotes', () => {
    expect(isRegexCheckable('禁止动态执行代码')).toBe(true);
    expect(isRegexCheckable('禁止使用 JSX 语法')).toBe(true);
    expect(isRegexCheckable('禁止引入未被请求的抽象层')).toBe(false);
  });

  it('terms of length <= 2 are ignored (noise guard)', () => {
    expect(isRegexCheckable('禁止 `a` 与 `b` 混用')).toBe(false);
  });
});

// ── classifyRequirements + coverage (T7) ─────────────────────────────

describe('classifyRequirements + computeEnforcementCoverage', () => {
  it('T7: coverage counts five buckets and ratios exactly', () => {
    const reqs: Requirement[] = [
      req({
        name: 'A',
        shallNot: ['禁止使用 `eval`'], // enforced-weak
      }),
      req({
        name: 'B',
        shall: ['必须有 TSDoc'], // manual (implicit via free-text enforcement)
        enforcement: [{ id: 'ENF-1', description: 'review 检查', severity: 'ERROR' }],
      }),
      req({
        name: 'C',
        shallNot: ['禁止未被请求的抽象'], // unverifiable (no quotes, no annotation)
        shall: ['模块职责单一'], // unverifiable
      }),
      req({
        name: 'D',
        shallNot: ['禁止引入未请求依赖'], // enforced-strong via annotation
      }),
    ];
    const items = classifyRequirements(reqs, [
      { text: '禁止引入未请求依赖', annotation: { type: 'no-new-dependency', scope: 'module' } },
    ], 'spec.md');
    const coverage = computeEnforcementCoverage(items);
    expect(coverage.total).toBe(5);
    expect(coverage.enforced_strong).toBe(1);
    expect(coverage.enforced_weak).toBe(1);
    expect(coverage.manual).toBe(1);
    expect(coverage.unverifiable).toBe(2);
    expect(coverage.declared_ratio).toBeCloseTo(3 / 5);
    expect(coverage.strong_ratio).toBeCloseTo(1 / 5);
  });

  it('empty spec → zero coverage with ratios 0 (no NaN)', () => {
    const coverage = computeEnforcementCoverage([]);
    expect(coverage.total).toBe(0);
    expect(coverage.declared_ratio).toBe(0);
    expect(coverage.strong_ratio).toBe(0);
  });
});

// ── manual(...) parser round-trip (T4/T6 evidence) ───────────────────

describe('parser manual(...) reserved word', () => {
  it('parses `- ID: manual(reason)` into kind=manual with reason as description', () => {
    const md = [
      '---',
      'layer: 0',
      'scope: "."',
      '---',
      '',
      '## Requirement: 依赖管理',
      '',
      '### SHALL NOT',
      '- 禁止引入未被请求的抽象层',
      '',
      '### Enforcement',
      '- ENF-1: manual(依赖清单在 code review 逐项核对)',
      '',
    ].join('\n');
    const spec = parseSpecFile(md, 'spec.md');
    const enf = spec.requirements[0].enforcement[0];
    expect(enf.kind).toBe('manual');
    expect(enf.description).toBe('依赖清单在 code review 逐项核对');
  });

  it('legacy free-text enforcement lines parse as implicit-manual', () => {
    const md = [
      '---',
      'layer: 0',
      'scope: "."',
      '---',
      '',
      '## Requirement: R',
      '',
      '### SHALL',
      '- 必须有 TSDoc',
      '',
      '### Enforcement',
      '- ENF-1: code review 检查',
      '',
    ].join('\n');
    const spec = parseSpecFile(md, 'spec.md');
    expect(spec.requirements[0].enforcement[0].kind).toBe('implicit-manual');
  });

  it('serialization round-trips manual(...) marker', () => {
    const md = [
      '---',
      'layer: 0',
      'scope: "."',
      '---',
      '',
      '## Requirement: R',
      '',
      '### Enforcement',
      '- ENF-1: manual(人工核对)',
      '',
    ].join('\n');
    const spec = parseSpecFile(md, 'spec.md');
    const out = serializeSpecFile(spec);
    expect(out).toContain('ENF-1: manual(人工核对)');
    // round-trip stability
    const reparsed = parseSpecFile(out, 'spec.md');
    expect(reparsed.requirements[0].enforcement[0].kind).toBe('manual');
  });

  it('P0 fidelity fix: serialization preserves unknown frontmatter fields', () => {
    const md = [
      '---',
      'layer: 0',
      'scope: "."',
      'doc_type: spec',
      'parent_tech: "../tech.md"',
      'custom_flag: true',
      '---',
      '',
      '## Requirement: R',
      '',
      '### SHALL',
      '- 必须有 TSDoc',
      '',
    ].join('\n');
    const spec = parseSpecFile(md, 'spec.md');
    const out = serializeSpecFile(spec);
    // Extra fields must survive the round-trip (previously silently dropped)
    expect(out).toContain('doc_type: "spec"');
    expect(out).toContain('parent_tech: "../tech.md"');
    expect(out).toContain('custom_flag: true');
    const reparsed = parseSpecFile(out, 'spec.md');
    expect((reparsed.frontmatter as Record<string, unknown>).doc_type).toBe('spec');
    expect((reparsed.frontmatter as Record<string, unknown>).custom_flag).toBe(true);
    // Known fields keep their order at the top
    const fmLines = out.split('---')[1].split('\n').filter(Boolean);
    expect(fmLines[0]).toBe('layer: 0');
  });
});

// ── T13: F8 auto-annotation mismatch fix ─────────────────────────────

describe('autoAnnotate (F8 fix)', () => {
  it('boilerplate/DRY prohibition no longer maps to no-side-effect', () => {
    expect(autoAnnotate('禁止生成未被请求的样板代码（boilerplate）')).toBeNull();
    expect(autoAnnotate('禁止重复代码，遵守 DRY 原则')).toBeNull();
  });

  it('dependency and mutable-state prohibitions still auto-annotate', () => {
    expect(autoAnnotate('禁止引入未被请求的依赖')?.type).toBe('no-new-dependency');
    expect(autoAnnotate('禁止引入可变状态')?.type).toBe('no-mutable-state');
  });
});

// ── T14: constraints.yaml entry classification ────────────────────────

describe('classifyConstraintEntry (constraints.yaml)', () => {
  it('empty enforcement on reverse (SHALL NOT) entry → unverifiable', async () => {
    const { classifyConstraintEntry } = await import('../../src/spec/verifier-classify.js');
    const cls = classifyConstraintEntry({
      id: 'TD-SHALL-NOT-001',
      content: '禁止引入未被请求的抽象层',
      min_strength: 'high',
      enforcement: '',
    });
    expect(cls).toBe('unverifiable');
  });

  it('manual(...) enforcement string → manual', async () => {
    const { classifyConstraintEntry } = await import('../../src/spec/verifier-classify.js');
    const cls = classifyConstraintEntry({
      id: 'TD-001',
      content: '模块职责单一',
      min_strength: 'high',
      enforcement: 'manual(架构评审核对)',
    });
    expect(cls).toBe('manual');
  });
});

// ── T10/T11: manual evidence matching (pure function) ────────────────

describe('missingManualEvidence', () => {
  const items = [
    {
      requirement: 'R1',
      polarity: 'shall' as const,
      text: '必须有 TSDoc',
      cls: 'manual' as const,
      enforcementId: 'ENF-1',
      enforcementDescription: 'review 检查',
      source: 'spec.md',
    },
    {
      requirement: 'R2',
      polarity: 'shall-not' as const,
      text: '禁止引入未被请求的抽象层',
      cls: 'manual' as const,
      enforcementId: 'ENF-2',
      enforcementDescription: '人工核对',
      source: 'spec.md',
    },
    {
      requirement: 'R3',
      polarity: 'shall' as const,
      text: '自动化项',
      cls: 'enforced-strong' as const,
      source: 'spec.md',
    },
  ];

  it('T10: manual constraints without evidence in verify.md are reported', () => {
    const missing = missingManualEvidence('# Verify\n\n测试全绿。\n', items);
    expect(missing).toHaveLength(2);
    expect(missing.map((m) => m.requirement)).toEqual(['R1', 'R2']);
  });

  it('T11: evidence anchored by enforcement id or constraint text satisfies the check', () => {
    const withId = missingManualEvidence('# Verify\n\nENF-1 已由 code review 覆盖。\n', items);
    expect(withId.map((m) => m.requirement)).toEqual(['R2']);

    const withText = missingManualEvidence(
      '# Verify\n\nSHALL NOT 校验记录：禁止引入未被请求的抽象层 — 已人工核对。\n',
      items,
    );
    expect(withText.map((m) => m.requirement)).toEqual(['R1']);
  });

  it('non-manual classes never require evidence', () => {
    const missing = missingManualEvidence('# Verify\n', [items[2]]);
    expect(missing).toHaveLength(0);
  });
});
