/**
 * Loop Grill — Pre-loop Validation via Grill-Me Mechanism
 *
 * Before entering loop mode, the grill-me mechanism challenges the
 * goal, convergence criteria, and round strategy to ensure feasibility.
 *
 * This prevents entering loops with vague goals, unmeasurable criteria,
 * or unrealistic round limits.
 */

import type { LoopGrillQuestion } from './types-loop-grill.js';

// ════════════════════════════════════════════════════════════════════
// Grill Question Bank
// ════════════════════════════════════════════════════════════════════

const GOAL_QUESTIONS: LoopGrillQuestion[] = [
  {
    id: 'goal-specific',
    question: 'Goal 是否具体可验证？能否用一句话描述"完成"是什么样的状态？',
    check: (ctx) => ctx.goal.length >= 10 && /实现|完成|添加|修复|优化|重构/.test(ctx.goal),
    warning: 'Goal 过于模糊，建议描述具体的可交付物或行为变更',
    suggestion: '格式建议：实现 <具体功能>，使 <用户/系统> 能够 <具体行为>',
  },
  {
    id: 'goal-scope',
    question: 'Goal 的范围是否适合在有限轮次内完成？',
    check: (ctx) => {
      const scopeIndicators = ctx.goal.split(/[,，、]/).length;
      return scopeIndicators <= 3;
    },
    warning: 'Goal 包含多个并列目标，可能导致轮次不足',
    suggestion: '考虑拆分目标，每次 loop 聚焦一个核心交付',
  },
  {
    id: 'goal-granularity',
    question: '每个轮次是否有明确的子目标可以评估？',
    check: (ctx) => ctx.goal.length >= 15, // 足够长的 goal 通常暗示子目标可拆分
    warning: '缺少明确的轮次子目标规划',
    suggestion: '建议规划：Round 1 做什么 → Round 2 做什么 → Round 3 做什么',
  },
];

const CRITERIA_QUESTIONS: LoopGrillQuestion[] = [
  {
    id: 'criteria-exist',
    question: '是否有明确的收敛标准来判断"目标达成"？',
    check: (ctx) => ctx.criteria.length > 0,
    warning: '缺少收敛标准，无法判断何时应该停止循环',
    suggestion: '定义 1-3 个可验证的条件，例如：功能实现、测试通过、无类型错误',
  },
  {
    id: 'criteria-measurable',
    question: '每个收敛标准是否可以客观评判（是/否）？',
    check: (ctx) => ctx.criteria.every((c) => c.length >= 2 && c.length <= 30),
    warning: '收敛标准应该是简短的可判定条件',
    suggestion: '好的标准示例："函数实现完成"、"所有测试通过"、"构建无错误"',
  },
  {
    id: 'criteria-sufficient',
    question: '全部收敛标准达成后，是否真的满足 Goal？',
    check: (ctx) => ctx.criteria.length >= 1,
    warning: '收敛标准可能与 Goal 不对齐',
    suggestion: '逐一检查：每个标准是否对 Goal 有直接贡献？',
  },
];

const ROUND_QUESTIONS: LoopGrillQuestion[] = [
  {
    id: 'round-limit',
    question: `设定 ${3} 轮是否合理？每轮能否完成有意义的工作单元？`,
    check: (ctx) => ctx.maxRounds >= 1 && ctx.maxRounds <= 5,
    warning: '轮次过少可能无法完成，过多可能导致低效迭代',
    suggestion: '推荐 2-4 轮。每轮应该能完成一个可独立评估的子目标',
  },
  {
    id: 'round-stagnation',
    question: '如果连续 2 轮没有明显进展，是否有备选策略？',
    check: (_ctx) => true, // Always present
    warning: '',
    suggestion: '策略：(1) 调整 plan 方向 (2) 缩减 goal 范围 (3) 标记 blocked 请求人工介入',
  },
];

const RISK_QUESTIONS: LoopGrillQuestion[] = [
  {
    id: 'risk-unknown',
    question: 'Loop 执行中可能遇到哪些未知的未知（需要探索的部分）？',
    check: (_ctx) => true,
    warning: '',
    suggestion: '如果存在大量未知，考虑先用 1 轮做探索，再决定后续',
  },
  {
    id: 'risk-dependency',
    question: 'Loop 是否依赖外部服务、未确认的接口或他人工作？',
    check: (_ctx) => true,
    warning: '',
    suggestion: '如有依赖，建议作为 blocked 条件在 evaluate 中处理',
  },
];

// ════════════════════════════════════════════════════════════════════
// Grill Context
// ════════════════════════════════════════════════════════════════════

export interface GrillContext {
  goal: string;
  criteria: string[];
  maxRounds: number;
}

export interface GrillFinding {
  severity: 'info' | 'warning' | 'critical';
  questionId: string;
  message: string;
  detail: string;
}

export interface GrillReport {
  findings: GrillFinding[];
  passed: boolean;
  criticalCount: number;
  warningCount: number;
  recommendations: string[];
  validatedContext: GrillContext;
}

// ════════════════════════════════════════════════════════════════════
// Grill Execution
// ════════════════════════════════════════════════════════════════════

/**
 * Run the loop grill-me validation.
 *
 * @param context User-provided loop parameters
 * @returns GrillReport with findings and pass/fail status
 */
export function runLoopGrill(context: GrillContext): GrillReport {
  const findings: GrillFinding[] = [];
  const recommendations: string[] = [];

  // Phase 1: Goal validation
  for (const q of GOAL_QUESTIONS) {
    const passed = q.check(context);
    if (!passed && q.warning) {
      findings.push({
        severity: 'warning',
        questionId: q.id,
        message: q.warning,
        detail: q.question,
      });
      if (q.suggestion) {
        recommendations.push(`[${q.id}] ${q.suggestion}`);
      }
    }
  }

  // Phase 2: Criteria validation
  for (const q of CRITERIA_QUESTIONS) {
    const passed = q.check(context);
    if (!passed && q.warning) {
      findings.push({
        severity: context.criteria.length === 0 ? 'critical' : 'warning',
        questionId: q.id,
        message: q.warning,
        detail: q.question,
      });
      if (q.suggestion) {
        recommendations.push(`[${q.id}] ${q.suggestion}`);
      }
    }
  }

  // Phase 3: Round validation
  for (const q of ROUND_QUESTIONS) {
    const passed = q.check(context);
    if (!passed && q.warning) {
      findings.push({
        severity: 'warning',
        questionId: q.id,
        message: q.warning,
        detail: q.question,
      });
    }
    if (q.suggestion && !passed) {
      recommendations.push(`[${q.id}] ${q.suggestion}`);
    }
  }

  // Phase 4: Risk awareness (informational)
  for (const q of RISK_QUESTIONS) {
    if (q.suggestion) {
      findings.push({
        severity: 'info',
        questionId: q.id,
        message: q.question,
        detail: q.suggestion,
      });
    }
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const warningCount = findings.filter((f) => f.severity === 'warning').length;
  const passed = criticalCount === 0;

  // Auto-fix: if no criteria provided, suggest defaults
  const validatedContext: GrillContext = {
    ...context,
    criteria:
      context.criteria.length > 0
        ? context.criteria
        : inferCriteriaFromGoal(context.goal),
  };

  return {
    findings,
    passed,
    criticalCount,
    warningCount,
    recommendations,
    validatedContext,
  };
}

/**
 * Infer default convergence criteria from the goal statement.
 */
function inferCriteriaFromGoal(goal: string): string[] {
  const criteria: string[] = [];

  if (/实现|添加|创建/.test(goal)) {
    criteria.push('功能实现完成');
  }
  if (/修复|解决/.test(goal)) {
    criteria.push('问题已修复');
  }
  if (/优化|提升/.test(goal)) {
    criteria.push('性能达标');
  }
  if (/重构/.test(goal)) {
    criteria.push('重构完成');
    criteria.push('测试仍然通过');
  }
  if (/测试|test/i.test(goal)) {
    criteria.push('测试覆盖目标');
  }
  if (/文档|doc/i.test(goal)) {
    criteria.push('文档完整');
  }

  // Fallback: generic criteria
  if (criteria.length === 0) {
    criteria.push('核心目标达成');
  }
  criteria.push('构建无错误');

  return [...new Set(criteria)].slice(0, 3);
}

/**
 * Format a grill report for CLI display.
 */
export function formatGrillReport(report: GrillReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║  Loop Grill-Me — 前置可行性验证                        ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  // Summary
  const status = report.passed ? '✓ 通过' : '✗ 需修正';
  lines.push(`状态: ${status} (${report.criticalCount} critical, ${report.warningCount} warning)`);
  lines.push('');

  // Findings
  if (report.findings.length > 0) {
    lines.push('发现:');
    for (const f of report.findings) {
      const icon = f.severity === 'critical' ? '✗' : f.severity === 'warning' ? '⚠' : 'ℹ';
      lines.push(`  ${icon} [${f.questionId}] ${f.message}`);
      if (f.detail) {
        lines.push(`     → ${f.detail}`);
      }
    }
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('建议:');
    for (const rec of report.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  // Validated context preview
  lines.push('验证后的 Loop 配置:');
  lines.push(`  Goal:     ${report.validatedContext.goal}`);
  lines.push(`  Criteria: ${report.validatedContext.criteria.join(', ')}`);
  lines.push(`  Rounds:   ${report.validatedContext.maxRounds}`);
  lines.push('');

  if (report.passed) {
    lines.push('✅ Loop 配置可行。使用 `mumuspec loop init` 时传入以上参数。');
  } else {
    lines.push('❌ 请先修正 critical 项，然后重新运行验证。');
  }
  lines.push('');

  return lines.join('\n');
}
