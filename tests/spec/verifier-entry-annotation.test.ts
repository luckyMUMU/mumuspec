/**
 * enforcement-gap L1 — constraints.yaml 注解通道分类与投影（TC-L1-001/002/003）
 */
import { describe, it, expect } from 'vitest';
import {
  classifyConstraintEntry,
  constraintEntryToItem,
} from '../../src/spec/verifier-classify.js';

const ANNOT = { type: 'no-new-dependency' as const, scope: 'module' as const };

describe('classifyConstraintEntry — 判定序（TC-L1-001）', () => {
  it('R1: 带非 custom 注解 → enforced-strong（优先于 enforcement 声明）', () => {
    expect(classifyConstraintEntry({ id: 'A', content: 'x', enforcement: 'manual(a)', annotation: ANNOT }))
      .toBe('enforced-strong');
  });
  it('R1: ast: 前缀 → enforced-strong', () => {
    expect(classifyConstraintEntry({ id: 'A', content: 'ast: 纯函数', enforcement: '' }))
      .toBe('enforced-strong');
  });
  it('R2: 显式 lex: 前缀（无注解）→ enforced-weak，优先于 manual 声明', () => {
    expect(classifyConstraintEntry({ id: 'A', content: 'lex: 禁止 `eval()`', enforcement: 'manual(a)' }))
      .toBe('enforced-weak');
  });
  it('R3: enforcement 非空且无注解无前缀 → manual', () => {
    expect(classifyConstraintEntry({ id: 'A', content: '禁止 `eval()` 动态执行', enforcement: 'manual(评审)' }))
      .toBe('manual');
  });
  it('R2-legacy: enforcement 空 + 可提取文本 + legacyLexical 默认 → enforced-weak', () => {
    expect(classifyConstraintEntry({ id: 'A', content: '禁止 `dangerous()`', enforcement: '' }))
      .toBe('enforced-weak');
  });
  it('R4: enforcement 空 + 可提取文本 + legacyLexical=false → unverifiable', () => {
    expect(classifyConstraintEntry({ id: 'A', content: '禁止 `dangerous()`', enforcement: '' }, { legacyLexical: false }))
      .toBe('unverifiable');
  });
  it('R4: 全空声明 → unverifiable', () => {
    expect(classifyConstraintEntry({ id: 'A', content: '无锚点文本', enforcement: '' }))
      .toBe('unverifiable');
  });
});

describe('classifyConstraintEntry — 向后兼容（TC-L1-002）', () => {
  const cases: Array<[string, string, 'manual' | 'enforced-weak' | 'unverifiable']> = [
    ['带 enforcement 自由文本', '任何内容 `x`', 'manual'],
    ['空 enforcement + 可提取', '禁止 `eval()`', 'enforced-weak'],
    ['空 enforcement + 不可提取', '普通散文', 'unverifiable'],
  ];
  for (const [name, content, expected] of cases) {
    it(`${name} → ${expected}（与重写前一致）`, () => {
      expect(classifyConstraintEntry({ id: 'X', content, enforcement: expected === 'manual' ? 'V-1' : '' }))
        .toBe(expected);
    });
  }
});

describe('constraintEntryToItem — 投影（TC-L1-003）', () => {
  it('forward → polarity shall，source 指向条目', () => {
    const item = constraintEntryToItem(
      { id: 'TD-F-001', content: '必须使用 CLI', enforcement: '', annotation: ANNOT },
      'forward', 'root/.mumuspec/constraints.yaml',
    );
    expect(item.polarity).toBe('shall');
    expect(item.cls).toBe('enforced-strong');
    expect(item.requirement).toBe('constraints:TD-F-001');
    expect(item.source).toBe('root/.mumuspec/constraints.yaml');
    expect(item.annotation).toEqual(ANNOT);
  });
  it('reverse → polarity shall-not；weakSource 标记 lex 来源', () => {
    const item = constraintEntryToItem(
      { id: 'TD-R-001', content: 'lex: 禁止 `touch temp/`', enforcement: 'manual(a)' },
      'reverse', 'p/.mumuspec/constraints.yaml',
    );
    expect(item.polarity).toBe('shall-not');
    expect(item.cls).toBe('enforced-weak');
    expect(item.weakSource).toBe('lex');
    expect(item.enforcementId).toBe('TD-R-001');
    expect(item.explicitManual).toBeUndefined();
  });
  it('manual(…) 显式声明 → explicitManual true', () => {
    const item = constraintEntryToItem(
      { id: 'X', content: '散文约束', enforcement: 'manual(设计评审)' },
      'forward', 'p/.mumuspec/constraints.yaml',
    );
    expect(item.cls).toBe('manual');
    expect(item.explicitManual).toBe(true);
  });
});
