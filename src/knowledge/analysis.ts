/**
 * Analysis — impact analysis, coverage, onboarding, chat answers, and dashboards.
 */
import type {
  ImpactAnalysis,
  ChangedFile as TChangedFile,
  ImpactNode,
  KnowledgeWarning,
  ImpactRecommendation,
  LearningPath,
  LearningStep,
  ChatAnswer,
  ChatKnowledgeRef,
  CoverageReport,
  CoverageGap,
  KnowledgeOverload,
  DashboardData,
  ProjectGoal,
  RoadmapItem,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { spawnSync } from 'node:child_process';
import { listKnowledgePages } from './pages.js';
import { readReverseIndex } from './index.js';
import { listStalePages } from './freshness.js';

/** Get changed files from git diff or mock */
function getChangedFiles(
  projectRoot: string,
  options?: { mockChangedFiles?: TChangedFile[]; diffRange?: string },
): TChangedFile[] {
  if (options?.mockChangedFiles) {
    return options.mockChangedFiles;
  }

  try {
    const range = options?.diffRange ?? '';
    // ponytail: spawnSync with arg array — range validated by caller (MCP isPathSafe regex)
    const args = ['diff', '--name-only'];
    if (range) {
      // Validate diffRange to prevent command injection
      if (!/^[a-zA-Z0-9^~:.\-/]+$/.test(range)) {
        return [];
      }
      args.push(range);
    }
    const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
    return (result.stdout ?? '')
      .split('\n')
      .filter(Boolean)
      .map((path) => ({
        path,
        change_type: 'modified' as const,
        lines_changed: 0,
      }));
  } catch {
    return [];
  }
}

/** Normalize file path for reverse index lookup */
function normalizePathForLookup(filePath: string): string {
  // ponytail: strip extension only, no complex path parsing
  return filePath.replace(/\.(ts|js|tsx|jsx|py|go|rs|java|cs|cpp|c|h|hpp)$/, '');
}

/** Analyze impact of changes with knowledge correlation */
export function analyzeImpact(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: {
    diffRange?: string;
    scope?: string;
    withKnowledge?: boolean;
    maxDepth?: number;
    mockChangedFiles?: TChangedFile[];
  },
): ImpactAnalysis {
  const reverseIndex = readReverseIndex(projectRoot, config);
  const changedFiles = getChangedFiles(projectRoot, {
    mockChangedFiles: options?.mockChangedFiles,
    diffRange: options?.diffRange,
  });

  const directImpact: ImpactNode[] = [];
  const indirectImpact: ImpactNode[] = [];
  const knowledgeWarnings: KnowledgeWarning[] = [];

  for (const file of changedFiles) {
    const normalizedPath = normalizePathForLookup(file.path);
    const scopeFilter = options?.scope;

    const matches = reverseIndex.filter((entry) => {
      const codeNodeMatches =
        normalizedPath.includes(entry.code_node) || entry.code_node.includes(normalizedPath);
      if (!codeNodeMatches) return false;
      if (scopeFilter && !entry.code_node.startsWith(scopeFilter)) return false;
      return true;
    });

    for (const match of matches) {
      const impactNode: ImpactNode = {
        node_path: match.code_node,
        node_type: 'File',
        distance: 1,
        dependents: [],
        impacted_knowledge: match.knowledge_pages.map((id) => ({
          id,
          title: '',
        })),
      };
      directImpact.push(impactNode);

      if (options?.withKnowledge) {
        for (const kpId of match.knowledge_pages) {
          knowledgeWarnings.push({
            knowledge_id: kpId,
            warning_type: 'SCOPE_OVERLAP',
            message: `变更范围与知识页面 ${kpId} 重叠`,
            suggestion: '确认不影响已有决策',
            severity: 'medium',
          });
        }
      }
    }
  }

  const recommendations: ImpactRecommendation = {
    regression_scope: [...new Set(directImpact.map((n) => n.node_path.split('/')[0] ?? '')).values()],
    review_focus: knowledgeWarnings.length > 0 ? ['检查知识页面关联'] : [],
    knowledge_pages_to_review: [...new Set(knowledgeWarnings.map((w) => w.knowledge_id))],
  };

  return {
    generated_at: new Date().toISOString(),
    diff_range: options?.diffRange ?? 'working-tree',
    changed_files: changedFiles,
    direct_impact: directImpact,
    indirect_impact: indirectImpact,
    knowledge_warnings: knowledgeWarnings,
    recommendations,
  };
}

/** Generate onboarding learning path for a scope */
export function generateOnboardingPath(
  projectRoot: string,
  config: MumuSpecConfig,
  scope: string,
  role: 'junior' | 'mid' | 'senior' | 'pm',
): LearningPath {
  const reverseIndex = readReverseIndex(projectRoot, config);

  // Filter reverse index entries within scope
  const scopedEntries = reverseIndex.filter((entry) => entry.code_node.startsWith(scope));

  const sortedEntries = [...scopedEntries].sort(
    (a, b) => b.knowledge_pages.length - a.knowledge_pages.length,
  );

  const steps: LearningStep[] = sortedEntries.map((entry, index) => ({
    order: index + 1,
    code_node: entry.code_node,
    code_node_type: 'File',
    reason: index === 0 ? '核心入口，关联知识最多' : `依赖上级模块，关联 ${entry.knowledge_pages.length} 个知识页面`,
    knowledge_pages: entry.knowledge_pages,
    learning_objectives: [`理解 ${entry.code_node} 的设计和功能`],
    check_questions: entry.knowledge_pages.length > 0
      ? [`${entry.code_node} 与哪些知识决策相关？`]
      : [],
  }));

  const minutesPerStep: Record<string, number> = { junior: 15, mid: 10, senior: 5, pm: 8 };

  return {
    scope,
    generated_at: new Date().toISOString(),
    generated_for: role,
    steps,
    total_steps: steps.length,
    estimated_minutes: steps.length * (minutesPerStep[role] ?? 10),
  };
}

/** Analyze knowledge coverage for a scope */
export function analyzeCoverage(
  projectRoot: string,
  config: MumuSpecConfig,
  scope?: string,
): CoverageReport {
  const reverseIndex = readReverseIndex(projectRoot, config);

  const entries = scope
    ? reverseIndex.filter((e) => e.code_node.startsWith(scope))
    : reverseIndex;

  const coveredNodes = entries.filter((e) => e.knowledge_pages.length > 0);
  const totalNodes = entries.length;
  const coveredCount = coveredNodes.length;
  const ratio = totalNodes > 0 ? coveredCount / totalNodes : 0;

  const byType: Record<string, { total: number; covered: number }> = {
    File: { total: totalNodes, covered: coveredCount },
  };

  const gaps: CoverageGap[] = entries
    .filter((e) => e.knowledge_pages.length === 0)
    .map((e, idx) => ({
      node: e.code_node,
      node_type: 'File',
      importance: totalNodes - idx,
      suggested_type: 'rationale' as const,
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, config.knowledge.coverage.gap_threshold);

  const overloads: KnowledgeOverload[] = entries
    .filter((e) => e.knowledge_pages.length > 5)
    .map((e) => ({
      node: e.code_node,
      pages_count: e.knowledge_pages.length,
    }));

  return {
    scope: scope ?? '.',
    generated_at: new Date().toISOString(),
    coverage: {
      total_code_nodes: totalNodes,
      covered_nodes: coveredCount,
      coverage_ratio: ratio,
      by_type: byType,
    },
    gaps,
    overloads,
  };
}

/**
 * Answer a query using the knowledge base.
 * Searches knowledge pages by keyword and returns relevant references.
 * ponytail: keyword matching only, no LLM dependency
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- child_process only used here
export function answerQuery(
  projectRoot: string,
  config: MumuSpecConfig,
  query: string,
): ChatAnswer {
  const pages = listKnowledgePages(projectRoot, config);
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);

  const scored: Array<{ page: KnowledgePage; score: number }> = pages.map((page) => {
    let score = 0;
    const titleLower = page.frontmatter.title.toLowerCase();
    const contentLower = page.content.toLowerCase();
    const idLower = page.frontmatter.id.toLowerCase();

    if (idLower === queryLower) {
      score += 100;
    } else if (idLower.includes(queryLower)) {
      score += 50;
    }

    if (titleLower === queryLower) {
      score += 80;
    } else if (titleLower.includes(queryLower)) {
      score += 40;
    }

    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 10;
    }

    if (contentLower.includes(queryLower)) {
      score += 20;
    }

    for (const term of queryTerms) {
      // 安全计数：用 split 代替 new RegExp——查询词含正则元字符（如 * (a+)+ ）时
      // 不会触发 SyntaxError 或灾难性回溯（ReDoS）
      const occurrences = contentLower.split(term).length - 1;
      if (occurrences > 0) score += occurrences * 2;
    }

    for (const tag of page.frontmatter.tags ?? []) {
      if (queryTerms.some((t) => tag.toLowerCase().includes(t))) {
        score += 15;
      }
    }

    return { page, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0).slice(0, 5);

  const references: ChatKnowledgeRef[] = relevant.map(({ page, score }) => {
    const maxScore = scored[0]?.score || 1;
    return {
      id: page.frontmatter.id,
      title: page.frontmatter.title,
      type: page.frontmatter.type,
      relevance: Math.min(score / maxScore, 1),
    };
  });

  let answer: string;
  let confidence: 'high' | 'medium' | 'low';

  if (references.length === 0) {
    answer = `No relevant information found in the knowledge base for "${query}".\nTry different keywords or check the available pages with: mumuspec knowledge list`;
    confidence = 'low';
  } else if (references.length === 1) {
    const ref = references[0]!;
    const page = relevant[0]!.page;
    answer = `Found in [${ref.id}] ${ref.title} (${ref.type}):\n${page.content.substring(0, 200)}${page.content.length > 200 ? '...' : ''}`;
    confidence = 'high';
  } else {
    const topRef = references[0]!;
    answer = `Found ${references.length} relevant knowledge pages. Top match: [${topRef.id}] ${topRef.title} (${topRef.type}).\n\nReferences:\n${references.map((r) => `  - [${r.id}] ${r.title} (${r.type}, relevance: ${(r.relevance * 100).toFixed(0)}%)`).join('\n')}`;
    confidence = references[0]!.relevance > 0.7 ? 'high' : references[0]!.relevance > 0.4 ? 'medium' : 'low';
  }

  return {
    query,
    generated_at: new Date().toISOString(),
    answer,
    references,
    confidence,
  };
}

/**
 * Build enhanced dashboard data including project status, roadmap, and goals.
 * ponytail: reads from knowledge base only
 */
export function getDashboardData(
  projectRoot: string,
  config: MumuSpecConfig,
  options: {
    activeChange: string | null;
    hookStatus: { available: string[]; installed: string[] };
    changePhase?: string;
    changeWorkflow?: string;
    changeSummary?: string;
  },
): DashboardData {
  const knowledgePages = listKnowledgePages(projectRoot, config);
  const stalePages = listStalePages(projectRoot, config);
  const report = analyzeCoverage(projectRoot, config);

  const goals: ProjectGoal[] = knowledgePages
    .filter((p) => (p.frontmatter.tags ?? []).some((t) => ['goal', 'vision', 'milestone'].includes(t)))
    .map((p) => ({
      id: p.frontmatter.id,
      title: p.frontmatter.title,
      description: p.content.substring(0, 100),
      status: (p.frontmatter.status as ProjectGoal['status']) ?? 'planned',
      related_pages: p.frontmatter.related_pages ?? [],
    }));

  const roadmap: RoadmapItem[] = knowledgePages
    .filter((p) => (p.frontmatter.tags ?? []).includes('roadmap'))
    .map((p) => ({
      id: p.frontmatter.id,
      title: p.frontmatter.title,
      milestone: p.frontmatter.scope || 'Unscheduled',
      status: (p.frontmatter.status as RoadmapItem['status']) ?? 'planned',
      related_changes: p.frontmatter.related_pages ?? [],
    }));

  const alerts: string[] = [];
  if (stalePages.length > 0) {
    alerts.push(`${stalePages.length} stale knowledge page(s) need review`);
  }
  if (report.gaps.length > 0) {
    alerts.push(`${report.gaps.length} coverage gap(s) found`);
  }
  if (options.hookStatus.installed.length === 0) {
    alerts.push('No hooks installed — run `mumuspec hooks install`');
  }

  return {
    project: config.project.name,
    projectRoot,
    activeChange: options.activeChange
      ? {
          name: options.activeChange,
          phase: options.changePhase ?? 'unknown',
          workflow: options.changeWorkflow ?? 'unknown',
          summary: options.changeSummary ?? '',
          hookInstalled: options.hookStatus.installed.length > 0,
          knowledgePages: knowledgePages.length,
          stalePages: stalePages.length,
        }
      : null,
    hooks: options.hookStatus,
    coverage: {
      totalPages: knowledgePages.length,
      stalePages: stalePages.length,
      coverageRatio: report.coverage.coverage_ratio,
    },
    goals,
    roadmap,
    alerts,
  };
}

// Re-export for backward compatibility (KnowledgePage is used in answerQuery return)
import type { KnowledgePage } from '../core/types.js';
