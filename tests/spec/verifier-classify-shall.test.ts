/**
 * SHALL 机读注解通道（shall-annotation-channel）——分类器极性中立性。
 *
 * TC-L0-01 及 SHALL 无词法 weak 层 / 注解透传。
 */

import { describe, it, expect } from 'vitest';
import { classifyConstraint, classifyRequirements } from '../../src/spec/verifier-classify.js';
import type { Requirement, ProhibitionAnnotation } from '../../src/core/types-spec.js';

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

describe('classifyConstraint polarity-neutral R1', () => {
  it('TC-L0-01: 同一非 custom 注解文本对 SHALL 与 SHALL NOT 均 → enforced-strong', () => {
    const annotations: ProhibitionAnnotation[] = [
      { text: '所有函数必须是纯函数', annotation: { type: 'pure-function', scope: 'function' } },
    ];
    expect(
      classifyConstraint({ requirement: 'R', polarity: 'shall', text: '所有函数必须是纯函数', annotations, enforcement: [], source: 'spec.md' }),
    ).toBe('enforced-strong');
    expect(
      classifyConstraint({ requirement: 'R', polarity: 'shall-not', text: '所有函数必须是纯函数', annotations, enforcement: [], source: 'spec.md' }),
    ).toBe('enforced-strong');
  });

  it('SHALL 带 ast: 前缀 → enforced-strong', () => {
    expect(
      classifyConstraint({ requirement: 'R', polarity: 'shall', text: 'ast:no-mutable-state', annotations: [], enforcement: [], source: 'spec.md' }),
    ).toBe('enforced-strong');
  });

  it('SHALL 带 custom 注解 → 非 strong（回落）', () => {
    expect(
      classifyConstraint({ requirement: 'R', polarity: 'shall', text: 'X', annotations: [{ text: 'X', annotation: { type: 'custom' } }], enforcement: [], source: 'spec.md' }),
    ).not.toBe('enforced-strong');
  });

  it('SHALL 无词法 weak 层：引号术语不使 SHALL 成为 enforced-weak（SHALL NOT 仍为 weak）', () => {
    const shallNot = classifyConstraint({ requirement: 'R', polarity: 'shall-not', text: '禁止使用 `eval`', annotations: [], enforcement: [], source: 'spec.md' });
    expect(shallNot).toBe('enforced-weak');
    const shall = classifyConstraint({ requirement: 'R', polarity: 'shall', text: '必须使用 `eval` 白名单机制', annotations: [], enforcement: [], source: 'spec.md' });
    expect(shall).toBe('unverifiable');
  });

  it('无注解 SHALL 带 enforcement → manual（R3 语义不变）', () => {
    expect(
      classifyConstraint({ requirement: 'R', polarity: 'shall', text: '必须有 TSDoc', annotations: [], enforcement: [{ id: 'ENF-1', description: 'review', kind: 'implicit-manual', severity: 'ERROR' }], source: 'spec.md' }),
    ).toBe('manual');
  });
});

describe('classifyRequirements 注解透传', () => {
  it('SHALL 命中 frontmatter 注解 → ClassifiedItem.annotation 填充', () => {
    const items = classifyRequirements(
      [req({ name: '纯函数', shall: ['所有函数必须是纯函数'] })],
      [{ text: '所有函数必须是纯函数', annotation: { type: 'pure-function', scope: 'function' } }],
      'spec.md',
    );
    expect(items[0].cls).toBe('enforced-strong');
    expect(items[0].annotation?.type).toBe('pure-function');
  });

  it('无注解匹配 → annotation 为空且 unverifiable', () => {
    const items = classifyRequirements([req({ name: 'X', shall: ['无注解 SHALL'] })], [], 'spec.md');
    expect(items[0].annotation).toBeUndefined();
    expect(items[0].cls).toBe('unverifiable');
  });
});