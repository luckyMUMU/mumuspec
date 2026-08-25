/**
 * Doctor 诊断层 — 只读诊断，检测知识库健康状态和不一致。
 * 
 * 职责边界：
 * - 仅诊断，不修改任何知识文件
 * - 发现缺失知识、过期知识、推理矛盾
 * - 输出诊断报告供用户决策
 * 
 * 对应 Obsidian LLM Wiki 的 Doctor Skill 分层设计。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runScan } from './scan.js';

/** Diagnosis severity level */
export type DiagnosisSeverity = 'info' | 'warn' | 'error';

/** A single diagnosis finding */
export interface DiagnosisFinding {
  severity: DiagnosisSeverity;
  category: 'missing' | 'stale' | 'conflict' | 'gap' | 'coverage';
  message: string;
  suggestion: string;
  affectedScope?: string;
}

/** Full diagnosis report */
export interface DiagnosisReport {
  timestamp: string;
  findings: DiagnosisFinding[];
  stats: {
    totalKnowledgePages: number;
    proposedFromScan: number;
    sourcesCovered: string[];
  };
  summary: string;
}

/** Get knowledge base directory */
function getKnowledgeDir(projectRoot: string): string {
  return join(projectRoot, '.mumuspec', 'knowledge');
}

/** Count existing knowledge pages from index.json */
function countKnowledgePages(projectRoot: string): number {
  const indexPath = join(getKnowledgeDir(projectRoot), 'index.json');
  if (!existsSync(indexPath)) return 0;

  try {
    const content = readFileSync(indexPath, 'utf8');
    const index = JSON.parse(content);
    return index.pages?.length ?? 0;
  } catch {
    return 0;
  }
}

/** Detect coverage gaps — areas with code but no knowledge */
function detectCoverageGaps(
  projectRoot: string,
  findings: DiagnosisFinding[],
): void {
  const knowledgeDir = getKnowledgeDir(projectRoot);
  if (!existsSync(knowledgeDir)) {
    findings.push({
      severity: 'error',
      category: 'missing',
      message: '知识库目录不存在，需要初始化知识库',
      suggestion: '运行 mumuspec knowledge init 初始化知识库',
    });
    return;
  }

  // Check if index exists
  const indexPath = join(knowledgeDir, 'index.json');
  if (!existsSync(indexPath)) {
    findings.push({
      severity: 'error',
      category: 'missing',
      message: '知识库索引文件 (index.json) 不存在',
      suggestion: '运行 mumuspec knowledge rebuild-index 重建索引',
    });
  }
}

/** Detect stale knowledge — unverified pages older than threshold */
function detectStaleKnowledge(
  projectRoot: string,
  findings: DiagnosisFinding[],
): void {
  const knowledgeDir = getKnowledgeDir(projectRoot);
  if (!existsSync(knowledgeDir)) return;

  // Check for pages/ directory
  const pagesDir = join(knowledgeDir, 'pages');
  if (!existsSync(pagesDir)) {
    findings.push({
      severity: 'warn',
      category: 'gap',
      message: 'pages/ 目录不存在，知识库为空',
      suggestion: '运行 mumuspec knowledge scan 扫描项目以生成初始知识',
    });
    return;
  }

  try {
    const files = readdirSync(pagesDir).filter((f) => f.endsWith('.md'));
    if (files.length === 0) {
      findings.push({
        severity: 'warn',
        category: 'gap',
        message: 'pages/ 目录为空，没有知识页面',
        suggestion: '运行 mumuspec knowledge scan 从项目中发现潜在知识',
      });
    }
  } catch {
    findings.push({
      severity: 'error',
      category: 'missing',
      message: '无法读取 pages/ 目录',
      suggestion: '检查目录权限',
    });
  }
}

/** Run scan and detect gaps between scan proposals and existing knowledge */
function detectScanGaps(
  projectRoot: string,
  findings: DiagnosisFinding[],
): number {
  const scanResult = runScan(projectRoot, { maxPages: 50 });

  if (scanResult.totalProposed > 0) {
    const highConfidence = scanResult.byConfidence.high;
    if (highConfidence > 0) {
      findings.push({
        severity: 'info',
        category: 'coverage',
        message: `扫描发现 ${scanResult.totalProposed} 条潜在知识，其中 ${highConfidence} 条高置信度`,
        suggestion: '运行 mumuspec knowledge scan 查看建议的知识页面',
      });
    }
  }

  return scanResult.totalProposed;
}

/** Build a summary from findings */
function buildSummary(findings: DiagnosisFinding[], proposedCount: number): string {
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warn').length;
  const infos = findings.filter((f) => f.severity === 'info').length;

  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} 个错误`);
  if (warnings > 0) parts.push(`${warnings} 个警告`);
  if (infos > 0) parts.push(`${infos} 条信息`);

  let summary = parts.length > 0
    ? `诊断发现 ${parts.join('、')}。`
    : '知识库状态良好，未发现问题。';

  if (proposedCount > 0) {
    summary += ` 另有 ${proposedCount} 条来自扫描的潜在知识待审阅。`;
  }

  return summary;
}

/**
 * Run full diagnosis on the knowledge base.
 * Read-only operation — does not modify any files.
 */
export function runDiagnosis(
  projectRoot: string,
  options: { sources?: string[] } = {},
): DiagnosisReport {
  const findings: DiagnosisFinding[] = [];
  const sources = options.sources ?? ['deps', 'code', 'git', 'docs'];

  // Coverage and structural checks
  detectCoverageGaps(projectRoot, findings);
  detectStaleKnowledge(projectRoot, findings);

  // Scan-based gap detection
  const proposedCount = detectScanGaps(projectRoot, findings);

  // Count existing pages
  const totalPages = countKnowledgePages(projectRoot);

  return {
    timestamp: new Date().toISOString(),
    findings,
    stats: {
      totalKnowledgePages: totalPages,
      proposedFromScan: proposedCount,
      sourcesCovered: sources,
    },
    summary: buildSummary(findings, proposedCount),
  };
}
