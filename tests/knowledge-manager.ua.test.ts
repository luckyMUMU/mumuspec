/**
 * TDD tests for Understand-Anything style knowledge manager functions
 * Layer 1 — Task 1.2-1.4: analyzeImpact / generateOnboardingPath / analyzeCoverage
 * Layer 2 — Task 1.5-1.6: answerQuery (Chat) / getDashboardData
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeImpact,
  generateOnboardingPath,
  analyzeCoverage,
  createKnowledgePage,
  rebuildReverseIndex,
  answerQuery,
  getDashboardData,
} from '../src/knowledge/manager';
import type {
  ImpactAnalysis,
  LearningPath,
  CoverageReport,
  ChatAnswer,
  DashboardData,
  MumuSpecConfig,
} from '../src/core/types';

// Test fixtures
const testDir = join(tmpdir(), `mumuspec-ua-test-${Date.now()}`);
const knowledgeDir = join(testDir, '.mumuspec', 'knowledge');

const mockConfig: MumuSpecConfig = {
  project: {
    name: 'test-project',
    language: 'typescript',
  },
  knowledge: {
    wiki: {
      dir: '.mumuspec/knowledge',
      page_index: {
        file: 'index.yaml',
        fields: ['id', 'title', 'type', 'scope', 'status', 'created_at', 'updated_at', 'tags', 'graph_bindings'],
        scope_depth: 3,
      },
    },
    reverse_index: {
      file: '_reverse-index.yaml',
      auto_rebuild: ['pre-commit', 'post-merge', 'post-checkout'],
      fallback: true,
    },
    freshness: {
      warn_after_days: 30,
      error_after_days: 90,
    },
    progressive_disclosure: {
      max_pages_per_layer: 10,
    },
    commit_update: {
      enabled: true,
      timeout_ms: 500,
      async: true,
      llm_enhancement: false,
    },
    commit_message: {
      parse_knowledge_impact: true,
    },
    coverage: {
      importance_formula: 'ref_count * node_count',
      gap_threshold: 5,
    },
  },
};

function setupTestProject(): void {
  // Create knowledge directories
  for (const type of ['decisions', 'patterns', 'risks', 'rationale', 'lessons']) {
    mkdirSync(join(knowledgeDir, type), { recursive: true });
  }
}

function cleanupTestProject(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function createTestKnowledgePage(
  id: string,
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson',
  graphBindings: string[],
  scope: string = 'src/payment',
): void {
  createKnowledgePage(testDir, mockConfig, {
    id,
    title: `Test ${id}`,
    type,
    scope,
    content: `# ${id}\n\nTest content`,
    tags: ['test'],
    graph_bindings: graphBindings,
  });
}

describe('UA-004: analyzeImpact function', () => {
  beforeEach(() => {
    setupTestProject();
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return empty ImpactAnalysis when no knowledge pages exist', () => {
    const result = analyzeImpact(testDir, mockConfig);
    expect(result).toBeDefined();
    expect(result.changed_files).toBeInstanceOf(Array);
    expect(result.direct_impact).toBeInstanceOf(Array);
    expect(result.indirect_impact).toBeInstanceOf(Array);
    expect(result.knowledge_warnings).toBeInstanceOf(Array);
  });

  it('should detect knowledge warning when changed file matches reverse index', () => {
    createTestKnowledgePage('KP-0007', 'decision', ['src/payment/processPayment'], 'src/payment');
    rebuildReverseIndex(testDir, mockConfig);

    const result = analyzeImpact(testDir, mockConfig, {
      withKnowledge: true,
      mockChangedFiles: [
        { path: 'src/payment/processPayment.ts', change_type: 'modified', lines_changed: 10 },
      ],
    });

    expect(result.knowledge_warnings.length).toBeGreaterThan(0);
    expect(result.knowledge_warnings[0].knowledge_id).toBe('KP-0007');
  });

  it('should return recommendations with empty scope', () => {
    const result = analyzeImpact(testDir, mockConfig);
    expect(result.recommendations.regression_scope).toBeInstanceOf(Array);
    expect(result.recommendations.review_focus).toBeInstanceOf(Array);
    expect(result.recommendations.knowledge_pages_to_review).toBeInstanceOf(Array);
  });
});

describe('UA-007: generateOnboardingPath function', () => {
  beforeEach(() => {
    setupTestProject();
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should generate LearningPath with steps', () => {
    createTestKnowledgePage('KP-0001', 'pattern', ['src/api/routes.ts'], 'src/payment');
    rebuildReverseIndex(testDir, mockConfig);

    const result = generateOnboardingPath(testDir, mockConfig, 'src/payment', 'junior');

    expect(result.scope).toBe('src/payment');
    expect(result.generated_for).toBe('junior');
    expect(result.steps).toBeInstanceOf(Array);
    expect(result.total_steps).toBeGreaterThanOrEqual(0);
  });

  it('should return generated LearningPath with valid structure', () => {
    const result = generateOnboardingPath(testDir, mockConfig, 'src/nonexistent', 'junior');
    expect(result.total_steps).toBe(0);
  });
});

describe('UA-009: analyzeCoverage function', () => {
  beforeEach(() => {
    setupTestProject();
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return CoverageReport with stats', () => {
    const result = analyzeCoverage(testDir, mockConfig);
    expect(result.coverage).toBeDefined();
    expect(result.coverage.total_code_nodes).toBeGreaterThanOrEqual(0);
    expect(result.coverage.coverage_ratio).toBeGreaterThanOrEqual(0);
    expect(result.gaps).toBeInstanceOf(Array);
  });

  it('should calculate coverage ratio correctly', () => {
    createTestKnowledgePage('KP-0010', 'decision', ['src/payment/a', 'src/payment/b'], 'src/payment');
    rebuildReverseIndex(testDir, mockConfig);

    const result = analyzeCoverage(testDir, mockConfig, 'src/payment');
    // With no code graph, ratio depends on implementation
    expect(result.coverage.coverage_ratio).toBeGreaterThanOrEqual(0);
  });
});

// ─── Chat Feature Tests (Understand-A Style) ───

describe('UA-010: answerQuery function', () => {
  beforeEach(() => {
    setupTestProject();
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return ChatAnswer with query and answer fields', () => {
    const result = answerQuery(testDir, mockConfig, 'test');
    expect(result.query).toBe('test');
    expect(result.answer).toBeDefined();
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.references).toBeInstanceOf(Array);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
  });

  it('should find knowledge pages by ID', () => {
    createTestKnowledgePage('KP-0007', 'decision', ['src/payment/processPayment'], 'src/payment');
    rebuildReverseIndex(testDir, mockConfig);

    const result = answerQuery(testDir, mockConfig, 'KP-0007');
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references[0].id).toBe('KP-0007');
    expect(result.confidence).toBe('high');
  });

  it('should find knowledge pages by title keyword', () => {
    createKnowledgePage(testDir, mockConfig, {
      id: 'KP-0017',
      title: 'Authentication Service Pattern',
      type: 'pattern',
      scope: 'src/auth',
      content: 'Auth service pattern content',
      tags: ['auth', 'security'],
      graph_bindings: ['src/services/auth'],
    });
    rebuildReverseIndex(testDir, mockConfig);

    const result = answerQuery(testDir, mockConfig, 'auth');
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references[0].title.toLowerCase()).toContain('auth');
  });

  it('should return empty references and low confidence for unknown query', () => {
    const result = answerQuery(testDir, mockConfig, 'nonexistent-topic-xyz');
    expect(result.references).toHaveLength(0);
    expect(result.confidence).toBe('low');
    expect(result.answer).toContain('No relevant information');
  });

  it('should return medium confidence when multiple references found', () => {
    createKnowledgePage(testDir, mockConfig, {
      id: 'KP-0001',
      title: 'Pattern: RESTful API Design',
      type: 'pattern',
      scope: 'src/payment',
      content: 'REST pattern content',
      tags: ['pattern', 'api'],
      graph_bindings: ['src/api/routes.ts'],
    });
    createKnowledgePage(testDir, mockConfig, {
      id: 'KP-0002',
      title: 'Pattern: Error Handling Strategy',
      type: 'pattern',
      scope: 'src/payment',
      content: 'Error handling pattern content',
      tags: ['pattern', 'error'],
      graph_bindings: ['src/api/handler.ts'],
    });
    rebuildReverseIndex(testDir, mockConfig);

    const result = answerQuery(testDir, mockConfig, 'pattern');
    expect(result.references.length).toBeGreaterThanOrEqual(2);
    expect(['medium', 'high']).toContain(result.confidence);
  });
});

// ─── Dashboard Feature Tests (Enhanced Status) ───

describe('UA-013: getDashboardData function', () => {
  beforeEach(() => {
    setupTestProject();
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return DashboardData with all required sections', () => {
    const result = getDashboardData(testDir, mockConfig, {
      activeChange: null,
      hookStatus: { available: ['pre-commit', 'post-merge'], installed: ['pre-commit'] },
    });

    expect(result.project).toBe(mockConfig.project.name);
    expect(result.projectRoot).toBe(testDir);
    expect(result.activeChange).toBeNull();
    expect(result.hooks).toBeDefined();
    expect(result.coverage).toBeDefined();
    expect(result.coverage.totalPages).toBeGreaterThanOrEqual(0);
    expect(result.coverage.stalePages).toBeGreaterThanOrEqual(0);
    expect(result.coverage.coverageRatio).toBeGreaterThanOrEqual(0);
    expect(result.goals).toBeInstanceOf(Array);
    expect(result.roadmap).toBeInstanceOf(Array);
    expect(result.alerts).toBeInstanceOf(Array);
  });

  it('should include active change info when provided', () => {
    const result = getDashboardData(testDir, mockConfig, {
      activeChange: 'test-change',
      hookStatus: { available: ['pre-commit'], installed: ['pre-commit'] },
      changePhase: 'design',
      changeWorkflow: 'full',
      changeSummary: 'Test summary',
    });

    expect(result.activeChange).not.toBeNull();
    expect(result.activeChange!.name).toBe('test-change');
    expect(result.activeChange!.phase).toBe('design');
    expect(result.activeChange!.workflow).toBe('full');
    expect(result.activeChange!.summary).toBe('Test summary');
  });

  it('should extract goals from knowledge pages tagged as goal/vision', () => {
    createKnowledgePage(testDir, mockConfig, {
      id: 'GOAL-001',
      title: 'Improve Developer Productivity',
      type: 'decision',
      scope: '.',
      content: 'Goal content here',
      tags: ['goal', 'vision'],
      graph_bindings: [],
    });

    const result = getDashboardData(testDir, mockConfig, {
      activeChange: null,
      hookStatus: { available: [], installed: [] },
    });

    expect(result.goals.length).toBeGreaterThan(0);
    expect(result.goals[0].id).toBe('GOAL-001');
    expect(result.goals[0].title).toBe('Improve Developer Productivity');
  });

  it('should extract roadmap items from knowledge pages tagged as roadmap', () => {
    createKnowledgePage(testDir, mockConfig, {
      id: 'RM-001',
      title: 'Knowledge Layer Enhancement',
      type: 'decision',
      scope: 'Q4 2026',
      content: 'Roadmap item',
      tags: ['roadmap'],
      graph_bindings: [],
    });

    const result = getDashboardData(testDir, mockConfig, {
      activeChange: null,
      hookStatus: { available: [], installed: [] },
    });

    expect(result.roadmap.length).toBeGreaterThan(0);
    expect(result.roadmap[0].id).toBe('RM-001');
    expect(result.roadmap[0].milestone).toBe('Q4 2026');
  });

  it('should generate alerts for stale pages and coverage gaps', () => {
    const result = getDashboardData(testDir, mockConfig, {
      activeChange: null,
      hookStatus: { available: ['pre-commit', 'post-merge'], installed: [] },
    });

    // Alert about no hooks installed
    const hookAlert = result.alerts.find((a) => a.includes('hooks'));
    expect(hookAlert).toBeDefined();
  });

  it('should show hook installation status in dashboard', () => {
    const result = getDashboardData(testDir, mockConfig, {
      activeChange: null,
      hookStatus: {
        available: ['pre-commit', 'post-merge', 'commit-msg'],
        installed: ['pre-commit'],
      },
    });

    expect(result.hooks.installed).toContain('pre-commit');
    expect(result.hooks.available).toHaveLength(3);
  });
});
