/**
 * affected_scopes 归一化（legacy-cleanup-fix TC-01..03, TC-05）。
 * 锁定行为：字符串值按逗号切分为 scope 列表，不再被逐字符迭代。
 */
import { describe, it, expect } from 'vitest';
import { normalizeAffectedScopes } from '../../src/guard/phase-guard.js';

describe('normalizeAffectedScopes', () => {
  it('TC-01: 数组输入原样返回', () => {
    expect(normalizeAffectedScopes(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('TC-02: 字符串按逗号切分并修剪空白（含 / 不再逐字符迭代）', () => {
    expect(normalizeAffectedScopes('src/change, src/core')).toEqual(['src/change', 'src/core']);
  });

  it('TC-03: undefined / 空串 / 空数组 → 空列表', () => {
    expect(normalizeAffectedScopes(undefined)).toEqual([]);
    expect(normalizeAffectedScopes('')).toEqual([]);
    expect(normalizeAffectedScopes([])).toEqual([]);
  });

  it('TC-05: 含 / 的单字符串整条保留为单个 scope（不抛 E-SECURITY-001）', () => {
    expect(() => normalizeAffectedScopes('src/change,src/cli/commands')).not.toThrow();
    expect(normalizeAffectedScopes('src/change,src/cli/commands')).toEqual([
      'src/change',
      'src/cli/commands',
    ]);
  });
});
