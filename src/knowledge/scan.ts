/**
 * Autonomous Knowledge Scan Orchestrator
 * 
 * Unifies four scanner sources (deps, code, git, docs) into a single
 * scan operation. Proposes confidence-tagged knowledge pages that can be
 * registered into the knowledge base after user review.
 */
import { scanDeps } from './scanners/dep-scanner.js';
import { scanCodeStructure } from './scanners/code-scanner.js';
import { scanGitHistory } from './scanners/git-scanner.js';
import { scanDocs } from './scanners/docs-scanner.js';
import type {
  ScanSource,
  ScanResult,
  ScanSourceResult,
  ScanOptions,
  ProposedKnowledgePage,
} from './scan-types.js';

/** Map of source to scanner function */
const SCANNERS: Record<ScanSource, (projectRoot: string) => ProposedKnowledgePage[]> = {
  deps: scanDeps,
  code: scanCodeStructure,
  git: scanGitHistory,
  docs: scanDocs,
};

/** Map of source to a description for display */
const SOURCE_DESCRIPTIONS: Record<ScanSource, string> = {
  deps: '依赖扫描 (package.json / requirements.txt)',
  code: '代码结构扫描 (目录/架构/风险)',
  git: 'Git 历史挖掘 (回退/热点/模式)',
  docs: '文档盘点 (缺失/过时/质量)',
};

/** Run scan for a single source */
function scanSource(
  source: ScanSource,
  projectRoot: string,
): ScanSourceResult {
  const start = Date.now();
  const pages = SCANNERS[source](projectRoot);
  return {
    source,
    proposedPages: pages,
    scannedCount: pages.length,
    durationMs: Date.now() - start,
  };
}

/** Filter pages by minimum confidence and max limit */
function filterPages(
  pages: ProposedKnowledgePage[],
  options: ScanOptions,
): ProposedKnowledgePage[] {
  const confidenceOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const minLevel = options.minConfidence ? confidenceOrder[options.minConfidence] : 0;

  let filtered = pages.filter(
    (p) => confidenceOrder[p.confidence] >= minLevel,
  );

  if (options.maxPages && options.maxPages > 0) {
    filtered = filtered.slice(0, options.maxPages);
  }

  return filtered;
}

/**
 * Run autonomous knowledge scan across specified sources.
 * Proposes knowledge pages that can be accepted or rejected by the user.
 */
export function runScan(
  projectRoot: string,
  options: ScanOptions = {},
): ScanResult {
  const sources = options.sources ?? (['deps', 'code', 'git', 'docs'] as ScanSource[]);
  const totalStart = Date.now();

  const sourceResults: ScanSourceResult[] = [];
  for (const source of sources) {
    sourceResults.push(scanSource(source, projectRoot));
  }

  // Gather all proposed pages
  const allPages = sourceResults.flatMap((r) => r.proposedPages);

  // Apply filters
  const filtered = filterPages(allPages, options);

  // Recalculate per-source counts after filtering
  for (const result of sourceResults) {
    const filteredFromSource = filtered.filter(
      (p) => result.proposedPages.includes(p),
    );
    result.proposedPages = filteredFromSource;
    result.scannedCount = filteredFromSource.length;
  }

  // Count by confidence
  const byConfidence = { high: 0, medium: 0, low: 0 };
  for (const page of filtered) {
    byConfidence[page.confidence]++;
  }

  // Count by type
  const byType: Record<string, number> = {};
  for (const page of filtered) {
    byType[page.type] = (byType[page.type] ?? 0) + 1;
  }

  return {
    sources: sourceResults,
    totalProposed: filtered.length,
    byConfidence,
    byType,
    totalDurationMs: Date.now() - totalStart,
  };
}

/** Get display description for a scan source */
export function getSourceDescription(source: ScanSource): string {
  return SOURCE_DESCRIPTIONS[source];
}

/** List available scan sources */
export function listScanSources(): ScanSource[] {
  return ['deps', 'code', 'git', 'docs'];
}
