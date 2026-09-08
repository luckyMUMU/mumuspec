/**
 * P0-C: 分发层 ENF-3 — 生成产物 ≤ 32KiB 容量断言（此前全仓无实现）。
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_RULES_BYTES,
  assertRulesWithinBudget,
  renderRuleFiles,
  renderCanonicalRules,
} from '../../src/install/rules-generator.js';
import type { RuleGenContext } from '../../src/install/rules-generator.js';

const ctx = (over: Partial<RuleGenContext> = {}): RuleGenContext => ({
  specSummary: '- **Project**: demo',
  ponytail: 'SHALL: 最小可工作实现',
  cliCommands: 'mumuspec init',
  mcpEntry: 'MCP entry',
  ...over,
});

describe('Rules 容量预算（ENF-3, 32KiB）', () => {
  it('常量为 32 KiB', () => {
    expect(MAX_RULES_BYTES).toBe(32 * 1024);
  });

  it('正常内容通过', () => {
    expect(() => assertRulesWithinBudget(renderCanonicalRules(ctx()), 'AGENTS.md')).not.toThrow();
  });

  it('超限内容抛 E-RULES-001（fail-closed）', () => {
    const big = ctx({ specSummary: 'x'.repeat(40 * 1024) });
    expect(() => assertRulesWithinBudget(renderCanonicalRules(big), 'AGENTS.md')).toThrow(
      /E-RULES-001/,
    );
  });

  it('renderRuleFiles 对超限产物拒绝产出（不返回超限 content）', () => {
    const big = ctx({ specSummary: 'y'.repeat(40 * 1024) });
    expect(() => renderRuleFiles('claude', big)).toThrow(/E-RULES-001/);
  });

  it('刚好等于上限（32768 字节）视为通过', () => {
    // 构造恰好 32768 字节的内容：先算出基准长度再补齐
    const base = renderCanonicalRules(ctx());
    const pad = MAX_RULES_BYTES - Buffer.byteLength(base, 'utf8');
    const exact = base + 'z'.repeat(pad);
    expect(Buffer.byteLength(exact, 'utf8')).toBe(MAX_RULES_BYTES);
    expect(() => assertRulesWithinBudget(exact, 'AGENTS.md')).not.toThrow();
  });
});
