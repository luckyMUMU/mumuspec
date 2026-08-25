/**
 * TDD tests for Understand-Anything style types
 * Layer 1 — Task 1.1: types.ts new interfaces
 */

import { describe, it, expect } from 'vitest';
import {
  ImpactAnalysis,
  ChangedFile,
  ImpactNode,
  KnowledgeWarning,
  ImpactRecommendation,
  LearningPath,
  LearningStep,
  CoverageReport,
  CoverageStats,
  CoverageGap,
  KnowledgeOverload,
} from '../src/core/types';

describe('UA-001: ImpactAnalysis types', () => {
  it('should accept valid ImpactAnalysis structure', () => {
    const analysis: ImpactAnalysis = {
      generated_at: '2026-07-30T10:00:00Z',
      diff_range: 'HEAD~1..HEAD',
      changed_files: [],
      direct_impact: [],
      indirect_impact: [],
      knowledge_warnings: [],
      recommendations: {
        regression_scope: [],
        review_focus: [],
        knowledge_pages_to_review: [],
      },
    };
    expect(analysis).toBeDefined();
    expect(analysis.changed_files).toBeInstanceOf(Array);
    expect(analysis.knowledge_warnings).toBeInstanceOf(Array);
  });

  it('should accept ChangedFile with all fields', () => {
    const file: ChangedFile = {
      path: 'src/services/payment.service.ts',
      change_type: 'modified',
      lines_changed: 45,
    };
    expect(file.path).toBe('src/services/payment.service.ts');
    expect(file.change_type).toBe('modified');
    expect(file.lines_changed).toBe(45);
  });

  it('should accept ImpactNode with distance', () => {
    const node: ImpactNode = {
      node_path: 'src/api/payment.routes.ts',
      node_type: 'File',
      distance: 1,
      dependents: ['src/services/payment.service.ts'],
      impacted_specs: [{ id: 'PAY-001', title: 'Payment spec' }],
      impacted_knowledge: [{ id: 'KP-0007', title: 'Saga decision' }],
    };
    expect(node.distance).toBe(1);
    expect(node.impacted_knowledge).toHaveLength(1);
  });

  it('should accept KnowledgeWarning with severity', () => {
    const warning: KnowledgeWarning = {
      knowledge_id: 'KP-0007',
      warning_type: 'SCOPE_OVERLAP',
      message: '本次修改范围与 Saga 决策重叠',
      suggestion: '确认不影响补偿事务完整性',
      severity: 'high',
    };
    expect(warning.severity).toBe('high');
    expect(warning.warning_type).toBe('SCOPE_OVERLAP');
  });

  it('should accept ImpactRecommendation', () => {
    const rec: ImpactRecommendation = {
      regression_scope: ['payment', 'order'],
      review_focus: ['补偿事务边界', '幂等性'],
      knowledge_pages_to_review: ['KP-0007', 'KP-0020'],
    };
    expect(rec.regression_scope).toContain('payment');
    expect(rec.knowledge_pages_to_review).toHaveLength(2);
  });
});

describe('UA-002: LearningPath types', () => {
  it('should accept valid LearningPath structure', () => {
    const path: LearningPath = {
      scope: 'src/payment',
      generated_at: '2026-07-30T10:00:00Z',
      generated_for: 'junior',
      steps: [],
      total_steps: 0,
      estimated_minutes: 30,
    };
    expect(path.scope).toBe('src/payment');
    expect(path.generated_for).toBe('junior');
  });

  it('should accept LearningStep with all fields', () => {
    const step: LearningStep = {
      order: 1,
      code_node: 'src/api/routes.ts',
      code_node_type: 'File',
      reason: 'HTTP 入口，理解请求如何进入系统',
      knowledge_pages: ['KP-0001'],
      learning_objectives: ['理解路由注册', '了解中间件链'],
      check_questions: ['POST /refund 经过哪些中间件？'],
    };
    expect(step.order).toBe(1);
    expect(step.knowledge_pages).toContain('KP-0001');
  });
});

describe('UA-003: CoverageReport types', () => {
  it('should accept valid CoverageReport structure', () => {
    const report: CoverageReport = {
      scope: 'src/payment',
      generated_at: '2026-07-30T10:00:00Z',
      coverage: {
        total_code_nodes: 100,
        covered_nodes: 60,
        coverage_ratio: 0.6,
        by_type: {
          Function: { total: 80, covered: 45 },
          Class: { total: 20, covered: 15 },
        },
      },
      gaps: [],
      overloads: [],
    };
    expect(report.coverage.coverage_ratio).toBe(0.6);
    expect(report.coverage.by_type.Function.total).toBe(80);
  });

  it('should accept CoverageGap with importance', () => {
    const gap: CoverageGap = {
      node: 'src/payment/reconciliateBatch',
      node_type: 'Function',
      importance: 9.2,
      suggested_type: 'rationale',
    };
    expect(gap.importance).toBe(9.2);
    expect(gap.suggested_type).toBe('rationale');
  });

  it('should accept KnowledgeOverload', () => {
    const overload: KnowledgeOverload = {
      node: 'src/api/routes.ts',
      pages_count: 7,
    };
    expect(overload.pages_count).toBe(7);
  });
});
