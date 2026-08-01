import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  KnowledgePage,
  KnowledgePageFrontmatter,
  PageIndex,
  PageIndexEntry,
  KnowledgePage as KPage,
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
  ChatAnswer,
  ChatKnowledgeRef,
  DashboardData,
  ProjectGoal,
  RoadmapItem,
  KnowledgeOrganizeResult,
  KnowledgeIssue,
} from '../core/types.js';
import { readText, writeText, readYaml, writeYaml, parseFrontmatter, createFrontmatter, now, computeHash, moveFile } from '../core/utils.js';
import type { MumuSpecConfig } from '../core/config.js';

/** Get the knowledge directory */
export function getKnowledgeDir(projectRoot: string, config: MumuSpecConfig): string {
  return join(projectRoot, config.knowledge.wiki.dir);
}

/** List all knowledge pages */
export function listKnowledgePages(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { type?: string; scope?: string },
): KnowledgePage[] {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  if (!existsSync(knowledgeDir)) return [];

  const pages: KnowledgePage[] = [];
  const typeDirs = ['decisions', 'patterns', 'risks', 'rationale', 'lessons', 'imports'];

  for (const typeDir of typeDirs) {
    const dirPath = join(knowledgeDir, typeDir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = join(dirPath, file);
      const page = loadKnowledgePage(filePath);
      if (page) {
        // Filter by type
        if (options?.type && page.frontmatter.type !== options.type) continue;
        // Filter by scope
        if (options?.scope && !page.frontmatter.scope.includes(options.scope)) continue;
        pages.push(page);
      }
    }
  }

  return pages;
}

/** Load a knowledge page from file */
export function loadKnowledgePage(filePath: string): KnowledgePage | undefined {
  const content = readText(filePath);
  if (!content) return undefined;

  const { frontmatter, body } = parseFrontmatter<KnowledgePageFrontmatter>(content);
  if (!frontmatter) return undefined;

  return {
    path: filePath,
    frontmatter,
    content: body,
  };
}

/** Get a knowledge page by ID */
export function getKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  id: string,
): KnowledgePage | undefined {
  const pages = listKnowledgePages(projectRoot, config);
  return pages.find((p) => p.frontmatter.id === id);
}

/** Search knowledge pages by keyword or tag */
export function searchKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options: { keyword?: string; tag?: string; type?: string },
): KnowledgePage[] {
  let pages = listKnowledgePages(projectRoot, config, { type: options.type });

  if (options.tag) {
    pages = pages.filter((p) => p.frontmatter.tags?.includes(options.tag!));
  }

  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    pages = pages.filter(
      (p) =>
        p.frontmatter.title.toLowerCase().includes(keyword) ||
        p.content.toLowerCase().includes(keyword),
    );
  }

  return pages;
}

/** Get knowledge context for a path (progressive loading) */
export function getKnowledgeContext(
  projectRoot: string,
  config: MumuSpecConfig,
  targetPath: string,
): KnowledgePage[] {
  const pages = listKnowledgePages(projectRoot, config);

  // Filter by scope (matching or parent scope)
  const relPath = targetPath.replace(projectRoot, '').replace(/^[\\/]/, '');
  const scopedPages = pages.filter((p) => {
    const scope = p.frontmatter.scope;
    if (scope === '.' || scope === '') return true;
    return relPath.startsWith(scope) || scope === relPath;
  });

  // Sort by verified_at (most recent first)
  scopedPages.sort((a, b) => {
    const aTime = a.frontmatter.verified_at || a.frontmatter.created_at;
    const bTime = b.frontmatter.verified_at || b.frontmatter.created_at;
    return bTime.localeCompare(aTime);
  });

  // Limit per layer
  return scopedPages.slice(0, config.knowledge.progressive_disclosure.max_pages_per_layer);
}

/** Create a new knowledge page */
export function createKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  page: {
    id: string;
    title: string;
    type: KnowledgePageFrontmatter['type'];
    scope: string;
    content: string;
    tags?: string[];
    graph_bindings?: string[];
  },
): string {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const typeDir = join(knowledgeDir, `${page.type}s`);
  if (!existsSync(typeDir)) {
    mkdirSync(typeDir, { recursive: true });
  }

  const fileName = `${page.id}.md`;
  const filePath = join(typeDir, fileName);

  const frontmatter: KnowledgePageFrontmatter = {
    id: page.id,
    title: page.title,
    type: page.type,
    status: 'confirmed',
    scope: page.scope,
    created_at: now().split('T')[0],
    tags: page.tags || [],
    graph_bindings: page.graph_bindings || [],
  };

  const content = createFrontmatter(frontmatter as unknown as Record<string, unknown>) + page.content;
  writeText(filePath, content);

  // Update PageIndex
  updatePageIndex(projectRoot, config);

  return filePath;
}

/** Verify knowledge page freshness */
export function verifyKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { id?: string; all?: boolean },
): { id: string; status: 'fresh' | 'stale' | 'unverified'; days_since_verify: number }[] {
  const pages = options?.id
    ? [getKnowledgePage(projectRoot, config, options.id)].filter(Boolean) as KnowledgePage[]
    : listKnowledgePages(projectRoot, config);

  const results: { id: string; status: 'fresh' | 'stale' | 'unverified'; days_since_verify: number }[] = [];
  const now = new Date();
  const warnDays = config.knowledge.freshness.warn_after_days;
  const errorDays = config.knowledge.freshness.error_after_days;

  for (const page of pages) {
    const verifiedAt = page.frontmatter.verified_at || page.frontmatter.created_at;
    const verifyDate = new Date(verifiedAt);
    const daysSince = Math.floor((now.getTime() - verifyDate.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'fresh' | 'stale' | 'unverified' = 'fresh';
    if (daysSince > errorDays) {
      status = 'unverified';
    } else if (daysSince > warnDays) {
      status = 'stale';
    }

    results.push({ id: page.frontmatter.id, status, days_since_verify: daysSince });
  }

  return results;
}

/** List stale knowledge pages */
export function listStalePages(
  projectRoot: string,
  config: MumuSpecConfig,
): { id: string; title: string; status: string; days: number }[] {
  const results = verifyKnowledge(projectRoot, config, { all: true });
  const pages = listKnowledgePages(projectRoot, config);

  return results
    .filter((r) => r.status !== 'fresh')
    .map((r) => {
      const page = pages.find((p) => p.frontmatter.id === r.id);
      return {
        id: r.id,
        title: page?.frontmatter.title || r.id,
        status: r.status,
        days: r.days_since_verify,
      };
    });
}

/** Supersede a knowledge page */
export function supersedeKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  oldId: string,
  newId: string,
): void {
  const oldPage = getKnowledgePage(projectRoot, config, oldId);
  const newPage = getKnowledgePage(projectRoot, config, newId);

  if (!oldPage) throw new Error(`Knowledge page not found: ${oldId}`);
  if (!newPage) throw new Error(`Knowledge page not found: ${newId}`);

  // Update old page status
  const updatedFrontmatter: KnowledgePageFrontmatter = {
    ...oldPage.frontmatter,
    status: 'superseded',
    superseded_by: newId,
  };

  const content = createFrontmatter(updatedFrontmatter as unknown as Record<string, unknown>) + oldPage.content;
  writeText(oldPage.path, content);

  // Update new page
  const newFrontmatter: KnowledgePageFrontmatter = {
    ...newPage.frontmatter,
    supersedes: oldId,
  };
  const newContent = createFrontmatter(newFrontmatter as unknown as Record<string, unknown>) + newPage.content;
  writeText(newPage.path, newContent);

  // Update PageIndex
  updatePageIndex(projectRoot, config);
}

/** Load or build PageIndex */
export function loadPageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): PageIndex {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const indexPath = join(knowledgeDir, '_index.yaml');

  const existing = readYaml<PageIndex>(indexPath);
  if (existing) return existing;

  // Build from scratch
  return rebuildPageIndex(projectRoot, config);
}

/** Rebuild PageIndex from actual files */
export function rebuildPageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): PageIndex {
  const pages = listKnowledgePages(projectRoot, config);
  const entries: PageIndexEntry[] = pages.map((p) => ({
    id: p.frontmatter.id,
    title: p.frontmatter.title,
    type: p.frontmatter.type,
    status: p.frontmatter.status,
    scope: p.frontmatter.scope,
    file: p.path.replace(projectRoot + '/', '').replace(projectRoot + '\\', ''),
    tags: p.frontmatter.tags || [],
    verified_at: p.frontmatter.verified_at,
  }));

  const index: PageIndex = { pages: entries };

  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const indexPath = join(knowledgeDir, '_index.yaml');
  writeYaml(indexPath, index);

  // Also update reverse index
  rebuildReverseIndex(projectRoot, config);

  return index;
}

/** Build reverse index (code node -> knowledge pages) */
export function rebuildReverseIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): void {
  const pages = listKnowledgePages(projectRoot, config);
  const reverseMap = new Map<string, string[]>();

  for (const page of pages) {
    const bindings = page.frontmatter.graph_bindings;
    if (bindings && Array.isArray(bindings)) {
      for (const node of bindings) {
        if (!reverseMap.has(node)) {
          reverseMap.set(node, []);
        }
        reverseMap.get(node)!.push(page.frontmatter.id);
      }
    }
  }

  const reverseIndex = Array.from(reverseMap.entries()).map(([code_node, knowledge_pages]) => ({
    code_node,
    knowledge_pages,
  }));

  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const reversePath = join(knowledgeDir, '_reverse-index.yaml');
  writeYaml(reversePath, reverseIndex);
}

/** Update PageIndex (incremental) */
export function updatePageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): void {
  rebuildPageIndex(projectRoot, config);
}

// ========== Understand-A Style Functions (0.13.0+) ==========

/** Read reverse index from disk */
export function readReverseIndex(projectRoot: string, config: MumuSpecConfig): Array<{ code_node: string; knowledge_pages: string[] }> {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const reversePath = join(knowledgeDir, config.knowledge.reverse_index.file);
  try {
    return readYaml<Array<{ code_node: string; knowledge_pages: string[] }>>(reversePath) ?? [];
  } catch {
    return [];
  }
}

/** Get changed files from git diff or mock */
function getChangedFiles(projectRoot: string, options?: { mockChangedFiles?: ChangedFile[]; diffRange?: string }): ChangedFile[] {
  // For testing: support mock changed files
  if (options?.mockChangedFiles) {
    return options.mockChangedFiles;
  }

  // In production: use git diff
  try {
    const { execSync } = require('node:child_process');
    const range = options?.diffRange ?? '';
    const cmd = range
      ? `git diff --name-only ${range}`
      : `git diff --name-only`;
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf8' }) as string;
    return output
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
  // Convert "src/payment/processPayment.ts" → "src/payment/processPayment" (strip extension)
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
    mockChangedFiles?: ChangedFile[];
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

  // For each changed file, look up reverse index
  for (const file of changedFiles) {
    const normalizedPath = normalizePathForLookup(file.path);
    const scopeFilter = options?.scope;

    // Find matching reverse index entries
    const matches = reverseIndex.filter((entry) => {
      // Match if code_node is in the changed file's path or vice versa
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

      // Generate knowledge warnings if enabled
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

  // Build recommendations
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

  // Sort by knowledge page count (more knowledge = more important to learn first)
  const sortedEntries = [...scopedEntries].sort(
    (a, b) => b.knowledge_pages.length - a.knowledge_pages.length,
  );

  // Build learning steps
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

  // Estimate time based on role and steps
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

  // Filter by scope
  const entries = scope
    ? reverseIndex.filter((e) => e.code_node.startsWith(scope))
    : reverseIndex;

  // Covered nodes: those with at least one knowledge page
  const coveredNodes = entries.filter((e) => e.knowledge_pages.length > 0);

  // Total nodes: all entries in reverse index (approximation of all code nodes)
  const totalNodes = entries.length;
  const coveredCount = coveredNodes.length;

  // Coverage ratio
  const ratio = totalNodes > 0 ? coveredCount / totalNodes : 0;

  // Coverage stats by type (simplified - all are 'File' type for now)
  const byType: Record<string, { total: number; covered: number }> = {
    File: { total: totalNodes, covered: coveredCount },
  };

  // Gaps: entries with no knowledge coverage
  // Importance = backwardRefCount (we approximate with position in reverse index)
  const gaps: CoverageGap[] = entries
    .filter((e) => e.knowledge_pages.length === 0)
    .map((e, idx) => ({
      node: e.code_node,
      node_type: 'File',
      importance: totalNodes - idx, // Earlier entries are more "important"
      suggested_type: 'rationale' as const,
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, config.knowledge.coverage.gap_threshold);

  // Overloads: nodes with too many knowledge pages (>5)
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

// ─── Chat Feature (Understand-A Style) ───

/**
 * Answer a query using the knowledge base.
 * Searches knowledge pages by keyword and returns relevant references.
 * ponytail: keyword matching only, no LLM dependency
 */
export function answerQuery(
  projectRoot: string,
  config: MumuSpecConfig,
  query: string,
): ChatAnswer {
  const pages = listKnowledgePages(projectRoot, config);
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);

  // Score each knowledge page by relevance
  const scored: Array<{ page: KnowledgePage; score: number }> = pages.map((page) => {
    let score = 0;
    const titleLower = page.frontmatter.title.toLowerCase();
    const contentLower = page.content.toLowerCase();
    const idLower = page.frontmatter.id.toLowerCase();

    // Exact ID match gets highest score
    if (idLower === queryLower) {
      score += 100;
    } else if (idLower.includes(queryLower)) {
      score += 50;
    }

    // Title match
    if (titleLower === queryLower) {
      score += 80;
    } else if (titleLower.includes(queryLower)) {
      score += 40;
    }

    // Term frequency in title
    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 10;
    }

    // Content match
    if (contentLower.includes(queryLower)) {
      score += 20;
    }

    // Term frequency in content
    for (const term of queryTerms) {
      const regex = new RegExp(term, 'gi');
      const matches = contentLower.match(regex);
      if (matches) score += matches.length * 2;
    }

    // Tag match
    for (const tag of page.frontmatter.tags ?? []) {
      if (queryTerms.some((t) => tag.toLowerCase().includes(t))) {
        score += 15;
      }
    }

    return { page, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top relevant results (score > 0)
  const relevant = scored.filter((s) => s.score > 0).slice(0, 5);

  // Build references
  const references: ChatKnowledgeRef[] = relevant.map(({ page, score }) => {
    const maxScore = scored[0]?.score || 1;
    return {
      id: page.frontmatter.id,
      title: page.frontmatter.title,
      type: page.frontmatter.type,
      relevance: Math.min(score / maxScore, 1),
    };
  });

  // Build answer text
  let answer: string;
  let confidence: 'high' | 'medium' | 'low';

  if (references.length === 0) {
    answer = `No relevant information found in the knowledge base for "${query}".\nTry different keywords or check the available pages with: mumuspec knowledge list`;
    confidence = 'low';
  } else if (references.length === 1) {
    const ref = references[0];
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

// ─── Dashboard Feature (Enhanced Status) ───

/**
 * Build enhanced dashboard data including project status, roadmap, and goals.
 * ponytail: reads from knowledge base only, no external dependencies
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

  // Extract goals from knowledge pages tagged with 'goal' or 'vision'
  const goals: ProjectGoal[] = knowledgePages
    .filter((p) => (p.frontmatter.tags ?? []).some((t) => ['goal', 'vision', 'milestone'].includes(t)))
    .map((p) => ({
      id: p.frontmatter.id,
      title: p.frontmatter.title,
      description: p.content.substring(0, 100),
      status: (p.frontmatter.status as ProjectGoal['status']) ?? 'planned',
      related_pages: p.frontmatter.related_pages ?? [],
    }));

  // Extract roadmap items from knowledge pages tagged with 'roadmap'
  const roadmap: RoadmapItem[] = knowledgePages
    .filter((p) => (p.frontmatter.tags ?? []).includes('roadmap'))
    .map((p) => ({
      id: p.frontmatter.id,
      title: p.frontmatter.title,
      milestone: p.frontmatter.scope || 'Unscheduled',
      status: (p.frontmatter.status as RoadmapItem['status']) ?? 'planned',
      related_changes: p.frontmatter.related_pages ?? [],
    }));

  // Build alerts
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

/**
 * Scan knowledge base for issues and optionally fix them.
 * Detects duplicate IDs, missing index entries, orphaned index entries, and missing required fields.
 */
export function organizeKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { dryRun?: boolean; fix?: boolean; verbose?: boolean },
): KnowledgeOrganizeResult {
  const issues: KnowledgeIssue[] = [];
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const typeDirs = ['decisions', 'patterns', 'risks', 'rationale', 'lessons', 'imports'];
  const typeDirSet = new Set(typeDirs);

  // Collect all files from filesystem
  const allFiles: Array<{ path: string; typeDir: string; fileName: string }> = [];
  for (const typeDir of typeDirs) {
    const dirPath = join(knowledgeDir, typeDir);
    if (!existsSync(dirPath)) continue;
    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      allFiles.push({ path: join(dirPath, file), typeDir, fileName: file });
    }
  }

  // Load all pages
  const allPages: KnowledgePage[] = [];
  for (const file of allFiles) {
    const page = loadKnowledgePage(file.path);
    if (page) allPages.push(page);
  }

  // Load PageIndex
  const indexPath = join(knowledgeDir, '_index.yaml');
  const index = loadPageIndex(projectRoot, config);
  const indexEntries = index.pages || [];

  // Stats
  const stats = {
    total_files: allPages.length,
    total_index_entries: indexEntries.length,
    duplicate_ids: 0,
    missing_from_index: 0,
    orphaned_index_entries: 0,
    missing_required_fields: 0,
    type_mismatches: 0,
  };

  let fixed = 0;

  // === Check 1: Duplicate IDs ===
  const idToFileMap = new Map<string, string[]>();
  for (const page of allPages) {
    const id = page.frontmatter.id;
    if (!idToFileMap.has(id)) idToFileMap.set(id, []);
    idToFileMap.get(id)!.push(page.path);
  }
  for (const [id, paths] of idToFileMap.entries()) {
    if (paths.length > 1) {
      stats.duplicate_ids++;
      issues.push({
        severity: 'error',
        type: 'duplicate_id',
        page_id: id,
        message: `Duplicate ID "${id}" found in ${paths.length} files: ${paths.join(', ')}`,
        auto_fixable: false,
      });
    }
  }

  // === Check 2: Missing from index ===
  const indexedIds = new Set(indexEntries.map((e) => e.id));
  for (const page of allPages) {
    const id = page.frontmatter.id;
    if (!indexedIds.has(id)) {
      stats.missing_from_index++;
      issues.push({
        severity: 'warning',
        type: 'missing_from_index',
        page_id: id,
        file: page.path,
        message: `Page "${id}" (${page.frontmatter.title}) exists in filesystem but missing from _index.yaml`,
        auto_fixable: true,
      });
      if (options?.fix) {
        // Auto-fix: rebuild index from all files
        rebuildPageIndex(projectRoot, config);
        fixed++;
      }
    }
  }

  // === Check 3: Orphaned index entries (in index but no file) ===
  const fileIds = new Set(allPages.map((p) => p.frontmatter.id));
  for (const entry of indexEntries) {
    if (!fileIds.has(entry.id)) {
      stats.orphaned_index_entries++;
      issues.push({
        severity: 'warning',
        type: 'orphaned_index',
        page_id: entry.id,
        file: entry.file,
        message: `Index entry "${entry.id}" (${entry.title}) references file "${entry.file}" which does not exist`,
        auto_fixable: true,
      });
      if (options?.fix) {
        rebuildPageIndex(projectRoot, config);
        fixed++;
      }
    }
  }

  // === Check 4: Missing required fields ===
  const requiredFields: Array<keyof KnowledgePageFrontmatter> = ['id', 'title', 'type', 'status', 'scope'];
  for (const page of allPages) {
    const missingFields: string[] = [];
    for (const field of requiredFields) {
      const value = page.frontmatter[field];
      if (value === undefined || value === null || value === '') {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      stats.missing_required_fields++;
      issues.push({
        severity: 'warning',
        type: 'missing_field',
        page_id: page.frontmatter.id,
        file: page.path,
        message: `Page "${page.frontmatter.id}" is missing required fields: ${missingFields.join(', ')}`,
        auto_fixable: false,
      });
    }
  }

  // === Check 5: Type-directory mismatch (skip imports/ - it's an archive dir) ===
  const typeToDirMap: Record<string, string> = {
    decision: 'decisions',
    pattern: 'patterns',
    risk: 'risks',
    rationale: 'rationale',
    lesson: 'lessons',
  };
  for (const page of allPages) {
    const actualDir = page.path.replace(knowledgeDir + '/', '').replace(knowledgeDir + '\\', '').split(/[/\\]/)[0];
    // Skip imports/ directory - it's an archive for imported docs, type mismatch is expected
    if (actualDir === 'imports') continue;
    const expectedDir = typeToDirMap[page.frontmatter.type];
    if (expectedDir) {
      if (actualDir && actualDir !== expectedDir && typeDirSet.has(actualDir)) {
        stats.type_mismatches++;
        issues.push({
          severity: 'warning',
          type: 'type_mismatch',
          page_id: page.frontmatter.id,
          file: page.path,
          message: `Page "${page.frontmatter.id}" has type "${page.frontmatter.type}" but is in "${actualDir}/" (expected "${expectedDir}/")`,
          auto_fixable: true,
        });
        if (options?.fix) {
          const destPath = join(knowledgeDir, expectedDir, page.path.split(/[/\\]/).pop()!);
          if (!existsSync(destPath)) {
            moveFile(page.path, destPath);
            fixed++;
          }
        }
      }
    }
  }

  // === Check 6: Files without valid frontmatter ===
  for (const file of allFiles) {
    const content = readText(file.path);
    if (content) {
      const parsed = parseFrontmatter(content);
      if (!parsed.frontmatter || !parsed.frontmatter.id) {
        issues.push({
          severity: 'error',
          type: 'missing_field',
          file: file.path,
          message: `File "${file.fileName}" in "${file.typeDir}/" has no valid frontmatter with ID`,
          auto_fixable: false,
        });
      }
    }
  }

  // Rebuild index at end if fixes were applied
  if (options?.fix && fixed > 0) {
    rebuildPageIndex(projectRoot, config);
  }

  return { issues, stats, fixed };
}
