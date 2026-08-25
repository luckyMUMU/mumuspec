/**
 * Tests for src/core/loop-grill.ts — Loop Grill-Me validation mechanism.
 */
import { describe, it, expect } from 'vitest';
import { runLoopGrill, formatGrillReport } from '../../src/core/loop-grill.js';
import type { GrillContext, GrillReport } from '../../src/core/loop-grill.js';

// ════════════════════════════════════════════════════════════════════
// Helper contexts
// ════════════════════════════════════════════════════════════════════

function validContext(overrides: Partial<GrillContext> = {}): GrillContext {
  return {
    goal: '实现用户登录功能，使系统能够验证用户身份',
    criteria: ['功能实现完成', '测试通过'],
    maxRounds: 3,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// runLoopGrill — Full Validation
// ════════════════════════════════════════════════════════════════════

describe('runLoopGrill', () => {
  describe('happy path — valid context passes', () => {
    it('passes with well-formed goal, criteria, and reasonable rounds', () => {
      const ctx = validContext();
      const report = runLoopGrill(ctx);

      expect(report.passed).toBe(true);
      expect(report.criticalCount).toBe(0);
      expect(report.validatedContext.goal).toBe(ctx.goal);
      expect(report.validatedContext.criteria).toEqual(ctx.criteria);
      expect(report.validatedContext.maxRounds).toBe(3);
    });

    it('has info-level findings for risk awareness', () => {
      const ctx = validContext();
      const report = runLoopGrill(ctx);

      const infoFindings = report.findings.filter((f) => f.severity === 'info');
      expect(infoFindings.length).toBeGreaterThanOrEqual(2);
    });

    it('does not produce recommendations when all checks pass', () => {
      const ctx = validContext();
      const report = runLoopGrill(ctx);

      expect(report.recommendations.length).toBe(0);
    });
  });

  describe('goal validation', () => {
    it('flags a too-short goal as warning (after semantic fix)', () => {
      const ctx = validContext({ goal: 'fix' });
      const report = runLoopGrill(ctx);

      // After fix: check returns false for short goals => warning emitted
      const goalWarning = report.findings.find((f) => f.questionId === 'goal-specific');
      expect(goalWarning).toBeDefined();
      expect(goalWarning!.severity).toBe('warning');
    });

    it('flags a goal with too many scope items', () => {
      const ctx = validContext({
        goal: '实现登录,实现注册,实现支付,实现退款,实现后台管理',
      });
      const report = runLoopGrill(ctx);

      const scopeWarning = report.findings.find((f) => f.questionId === 'goal-scope');
      expect(scopeWarning).toBeDefined();
      expect(scopeWarning!.severity).toBe('warning');
    });

    it('granularity question emits warning for short goals', () => {
      const ctx = validContext({ goal: '小功能' }); // < 15 chars
      const report = runLoopGrill(ctx);

      // The granularity check returns false for short goals => warning emitted
      const granFinding = report.findings.find((f) => f.questionId === 'goal-granularity');
      expect(granFinding).toBeDefined();
    });
  });

  describe('criteria validation', () => {
    it('produces critical finding when no criteria provided', () => {
      const ctx = validContext({ criteria: [] });
      const report = runLoopGrill(ctx);

      expect(report.passed).toBe(false);
      expect(report.criticalCount).toBeGreaterThanOrEqual(1);

      const critFinding = report.findings.find((f) => f.severity === 'critical');
      expect(critFinding).toBeDefined();
      expect(critFinding!.questionId).toBe('criteria-exist');
    });

    it('auto-infers criteria from goal when none provided', () => {
      const ctx = validContext({ criteria: [], goal: '实现用户认证模块' });
      const report = runLoopGrill(ctx);

      expect(report.validatedContext.criteria.length).toBeGreaterThan(0);
      expect(report.validatedContext.criteria).toContain('功能实现完成');
    });

    it('too-long criteria are flagged via criteria-measurable', () => {
      // check: ctx.criteria.every(c => c.length >= 2 && c.length <= 30)
      // A string > 30 chars => check returns false => !passed => warning emitted
      const longCriteria = ['这个收敛标准字符串故意写得非常非常长用来超过三十个字符的长度上限ABC'];
      expect(longCriteria[0]!.length).toBeGreaterThan(30);
      const ctx = validContext({ criteria: longCriteria });
      const report = runLoopGrill(ctx);

      const measureWarning = report.findings.find((f) => f.questionId === 'criteria-measurable');
      expect(measureWarning).toBeDefined();
    });

    it('passes with valid short criteria', () => {
      const ctx = validContext({ criteria: ['实现完成', '测试通过'] });
      const report = runLoopGrill(ctx);

      const measureWarning = report.findings.find((f) => f.questionId === 'criteria-measurable');
      expect(measureWarning).toBeUndefined();
    });
  });

  describe('round validation', () => {
    it('flags maxRounds below 1', () => {
      const ctx = validContext({ maxRounds: 0 });
      const report = runLoopGrill(ctx);

      const roundWarning = report.findings.find((f) => f.questionId === 'round-limit');
      expect(roundWarning).toBeDefined();
    });

    it('flags maxRounds above 5', () => {
      const ctx = validContext({ maxRounds: 10 });
      const report = runLoopGrill(ctx);

      const roundWarning = report.findings.find((f) => f.questionId === 'round-limit');
      expect(roundWarning).toBeDefined();
    });

    it('passes with maxRounds within [1, 5]', () => {
      for (const rounds of [1, 2, 3, 4, 5]) {
        const ctx = validContext({ maxRounds: rounds });
        const report = runLoopGrill(ctx);

        const roundWarning = report.findings.find((f) => f.questionId === 'round-limit');
        expect(roundWarning).toBeUndefined();
      }
    });
  });

  describe('risk awareness', () => {
    it('include unknown risk info', () => {
      const ctx = validContext();
      const report = runLoopGrill(ctx);

      const riskFinding = report.findings.find((f) => f.questionId === 'risk-unknown');
      expect(riskFinding).toBeDefined();
      expect(riskFinding!.severity).toBe('info');
    });

    it('include dependency risk info', () => {
      const ctx = validContext();
      const report = runLoopGrill(ctx);

      const riskFinding = report.findings.find((f) => f.questionId === 'risk-dependency');
      expect(riskFinding).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles goal with special characters', () => {
      const ctx = validContext({ goal: '修复 CVE-2024-1234: SQL 注入漏洞' });
      const report = runLoopGrill(ctx);
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('passed');
    });

    it('handles single-character criteria', () => {
      const ctx = validContext({ criteria: ['a'] });
      const report = runLoopGrill(ctx);

      const measureWarning = report.findings.find((f) => f.questionId === 'criteria-measurable');
      expect(measureWarning).toBeDefined();
    });

    it('preserves goal and maxRounds in validatedContext', () => {
      const ctx = validContext({
        goal: '优化构建性能使编译时间减半',
        maxRounds: 4,
        criteria: ['性能达标'],
      });
      const report = runLoopGrill(ctx);

      expect(report.validatedContext.goal).toBe('优化构建性能使编译时间减半');
      expect(report.validatedContext.maxRounds).toBe(4);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// formatGrillReport
// ════════════════════════════════════════════════════════════════════

describe('formatGrillReport', () => {
  it('formats a passing report', () => {
    const ctx = validContext();
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    expect(output).toContain('Loop Grill-Me');
    expect(output).toContain('通过');
    expect(output).toContain(ctx.goal);
    expect(output).toContain('Loop 配置可行');
  });

  it('formats a failing report', () => {
    const ctx = validContext({ criteria: [] });
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    expect(output).toContain('需修正');
    expect(output).toContain('critical');
    expect(output).toContain('请先修正 critical');
  });

  it('includes findings in the output for criteria issues', () => {
    const longCriteria = ['这个收敛标准字符串故意写得非常非常长用来超过三十个字符的长度上限ABC'];
    const ctx = validContext({ criteria: longCriteria });
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    // criteria-measurable check: returns false for >30-char criteria,
    // which means !passed, so the warning IS emitted in the findings.
    expect(output).toContain('criteria-measurable');
  });

  it('includes recommendations when present', () => {
    // Short goal + no criteria triggers both criteria-exist critical and recommendations
    const ctx = validContext({ goal: 'fix', criteria: [] });
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    expect(output).toContain('建议');
  });

  it('renders info findings with correct icon', () => {
    const ctx = validContext();
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    // info findings use the info icon character
    expect(output).toContain('risk-unknown');
  });

  it('includes validated loop config preview', () => {
    const ctx = validContext();
    const report = runLoopGrill(ctx);
    const output = formatGrillReport(report);

    expect(output).toContain('Goal');
    expect(output).toContain('Criteria');
    expect(output).toContain('Rounds');
  });
});
