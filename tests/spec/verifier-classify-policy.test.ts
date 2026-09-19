/**
 * 词法通道显式化（annotation-primary-r2）——分类策略层。
 *
 * TC-L0-01/02/03/05：legacy 默认兼容、legacy=false 回落、lex: 前缀显式入口、
 * 覆盖报告追加字段（legacy_weak / actionable_weak）。
 */

import { describe, it, expect } from 'vitest';
import {
  classifyConstraint,
  classifyRequirements,
  computeEnforcementCoverage,
} from '../../src/spec/verifier-classify.js';
import type { Requirement } from '../../src/core/types-spec.js';

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

const REGEX_ONLY_TEXT = '禁止使用 `eval`'; // 引号词可提取，无注解

describe('classifyConstraint lexical policy', () => {
  it('TC-L0-01: 缺省（legacyLexical 未传）→ 可提取 SHALL NOT 仍为 enforced-weak（兼容面不变）', () => {
    const cls = classifyConstraint({
      requirement: 'R', polarity: 'shall-not', text: REGEX_ONLY_TEXT, annotations: [], enforcement: [], source: 'spec.md',
    });
    expect(cls).toBe('enforced-weak');
  });

  it('TC-L0-02: legacyLexical=false → 无注解无前缀文本回落 unverifiable（不再静默走词法）', () => {
    const cls = classifyConstraint(
      { requirement: 'R', polarity: 'shall-not', text: REGEX_ONLY_TEXT, annotations: [], enforcement: [], source: 'spec.md' },
      { legacyLexical: false },
    );
    expect(cls).toBe('unverifiable');
  });

  it('TC-L0-03: lex: 前缀无条件进入 enforced-weak（legacy 两态一致），weakSource=lex', () => {
    const lexText = `lex:${REGEX_ONLY_TEXT}`;
    for (const legacy of [true, false]) {
      const items = classifyRequirements(
        [req({ shallNot: [lexText] })], [], 'spec.md', { legacyLexical: legacy },
      );
      expect(items[0].cls).toBe('enforced-weak');
      expect(items[0].weakSource).toBe('lex');
    }
  });

  it('TC-L0-02b: legacy=false 时由 legacy 兜底产生的 weak 不出现（weakSource=legacy 仅 legacy=true 有）', () => {
    const legacyOn = classifyRequirements([req({ shallNot: [REGEX_ONLY_TEXT] })], [], 'spec.md', { legacyLexical: true });
    expect(legacyOn[0].weakSource).toBe('legacy');
    const legacyOff = classifyRequirements([req({ shallNot: [REGEX_ONLY_TEXT] })], [], 'spec.md', { legacyLexical: false });
    expect(legacyOff[0].cls).toBe('unverifiable');
    expect(legacyOff[0].weakSource).toBeUndefined();
  });
});

describe('computeEnforcementCoverage 追加字段', () => {
  it('TC-L0-05: legacy_weak 仅统计 legacy 兜底项；actionable_weak 不含 lex: 项；unverifiable_items 语义不变', () => {
    const items = classifyRequirements(
      [req({
        name: 'R',
        shallNot: [
          REGEX_ONLY_TEXT,                              // legacy weak
          `lex:禁止使用 \`eval2\``,                      // lex weak
          'ast:no-mutable-state',                       // strong
          '禁止引入未被请求的抽象层',                       // unverifiable
        ],
      })],
      [], 'spec.md', { legacyLexical: true },
    );
    const coverage = computeEnforcementCoverage(items);
    expect(coverage.enforced_weak).toBe(2);
    expect(coverage.legacy_weak).toBe(1);
    expect(coverage.actionable_weak).toHaveLength(1);
    expect(coverage.actionable_weak![0].text).toBe(REGEX_ONLY_TEXT);
    expect(coverage.actionable_weak!.some((a) => a.text.includes('eval2'))).toBe(false);
    // unverifiable_items 保持原语义：仅 unverifiable 项，不掺入 weak
    expect(coverage.unverifiable_items).toHaveLength(1);
    expect(coverage.unverifiable_items![0].text).toBe('禁止引入未被请求的抽象层');
  });
});