/**
 * Docs Scanner — inventory project documentation state.
 * 
 * Detects:
 * - Present documentation files
 * - Missing recommended documentation
 * - Potentially stale docs (old modification dates)
 * - Documentation structure gaps
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ProposedKnowledgePage, DocInventoryEntry } from '../scan-types.js';

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `KS-DOC-${String(idCounter).padStart(4, '0')}`;
}

/** Recommended documentation for any project */
const RECOMMENDED_DOCS = [
  { name: 'README.md', required: true, type: 'overview' },
  { name: 'docs/design/', required: true, type: 'design' },
  { name: 'CODE_OF_CONDUCT.md', required: false, type: 'community' },
  { name: 'SECURITY.md', required: false, type: 'security' },
  { name: 'docs/adr/', required: false, type: 'adr' },
  { name: 'CONTRIBUTING.md', required: false, type: 'contributing' },
  { name: 'CHANGELOG.md', required: false, type: 'changelog' },
  { name: 'LICENSE', required: false, type: 'license' },
];

/** Detect README presence and basic quality */
function detectReadmeState(projectRoot: string): DocInventoryEntry {
  const path = join(projectRoot, 'README.md');
  const exists = existsSync(path);
  let lineCount = 0;

  if (exists) {
    try {
      const content = readFileSync(path, 'utf8');
      lineCount = content.split('\n').length;
    } catch {
      // Read failed, treat as empty
    }
  }

  return {
    path: 'README.md',
    exists,
    completeness: exists ? (lineCount > 50 ? 'complete' : lineCount > 10 ? 'minimal' : 'minimal') : 'missing',
    lastModified: exists ? statSync(path).mtime.toISOString() : undefined,
  };
}

/** Scan docs/ directory for design documents */
function scanDocsDirectory(projectRoot: string): DocInventoryEntry[] {
  const results: DocInventoryEntry[] = [];
  const docsPath = join(projectRoot, 'docs');

  if (!existsSync(docsPath)) return results;

  try {
    const entries = readdirSync(docsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = join(docsPath, entry.name);
        const subEntries = readdirSync(subPath, { withFileTypes: true });
        const files = subEntries.filter((e) => e.isFile() && e.name.endsWith('.md'));

        results.push({
          path: `docs/${entry.name}/`,
          exists: true,
          completeness: files.length >= 3 ? 'complete' : files.length >= 1 ? 'minimal' : 'partial',
          lastModified: statSync(subPath).mtime.toISOString(),
        });
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push({
          path: `docs/${entry.name}`,
          exists: true,
          completeness: 'minimal',
          lastModified: statSync(join(docsPath, entry.name)).mtime.toISOString(),
        });
      }
    }
  } catch {
    // Directory read failed
  }

  return results;
}

/** Detect any markdown files in root that might be documentation */
function scanRootMarkdown(projectRoot: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(projectRoot);
    for (const entry of entries) {
      if (entry.endsWith('.md') && entry !== 'README.md') {
        results.push(entry);
      }
    }
  } catch {
    // Directory read failed
  }
  return results;
}

/** Calculate stale threshold — docs not updated in 90 days */
function isStale(lastModified?: string): boolean {
  if (!lastModified) return false;
  const modified = new Date(lastModified);
  const now = new Date();
  const daysSinceModified = (now.getTime() - modified.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceModified > 90;
}

/** Scan documentation inventory */
export function scanDocs(projectRoot: string): ProposedKnowledgePage[] {
  idCounter = 0;
  const proposed: ProposedKnowledgePage[] = [];

  const readme = detectReadmeState(projectRoot);
  const docsEntries = scanDocsDirectory(projectRoot);
  const rootMarkdowns = scanRootMarkdown(projectRoot);

  // Check for missing critical docs
  const missingRequired: string[] = [];
  for (const rec of RECOMMENDED_DOCS) {
    if (!rec.required) continue;
    const fullPath = join(projectRoot, rec.name);
    if (!existsSync(fullPath)) {
      missingRequired.push(rec.name);
    }
  }

  if (!readme.exists) {
    missingRequired.unshift('README.md');
  }

  if (missingRequired.length > 0) {
    proposed.push({
      id: generateId(),
      title: `缺少推荐文档：${missingRequired.join(', ')}`,
      type: 'risk',
      scope: '.',
      content: `项目缺少以下推荐文档：\n${missingRequired.map((m) => `- ${m}`).join('\n')}\n\n缺少文档的风险：\n1. 新贡献者不了解项目结构\n2. 设计决策未被记录\n3. 上手成本增加\n\n建议优先补齐 README.md 和 docs/design/ 目录。`,
      tags: ['documentation', 'missing', 'onboarding'],
      graph_bindings: [],
      confidence: 'high',
      source: 'docs',
      evidence: `缺失: ${missingRequired.length} 个推荐文档`,
    });
  }

  // Check README quality
  if (readme.exists && readme.completeness === 'minimal') {
    proposed.push({
      id: generateId(),
      title: 'README.md 内容不完整，缺少关键章节',
      type: 'risk',
      scope: '.',
      content: 'README.md 存在但内容较少。建议补充以下章节：\n- 项目简介 (What & Why)\n- 安装与运行 (Installation)\n- 使用示例 (Usage)\n- 贡献指南 (Contributing)\n- 协议 (License)',
      tags: ['documentation', 'readme', 'quality'],
      graph_bindings: ['README.md'],
      confidence: 'medium',
      source: 'docs',
      evidence: `README.md 存在但标注为 ${readme.completeness}`,
    });
  }

  // Check for potentially stale documentation
  const allDocs: DocInventoryEntry[] = [readme, ...docsEntries];
  const staleDocs = allDocs.filter((d) => d.exists && isStale(d.lastModified));
  if (staleDocs.length > 0) {
    const staleList = staleDocs.map((d) => `- ${d.path}`).join('\n');
    proposed.push({
      id: generateId(),
      title: `${staleDocs.length} 个文档可能已过时（超过90天未更新）`,
      type: 'risk',
      scope: '.',
      content: `以下文档超过 90 天未修改，可能已与实际实现不同步：\n${staleList}\n\n过时文档的风险：\n1. 新人按文档操作失败\n2. 信任度下降，无人参考文档\n3. 文档维护成本反而高于没有文档\n\n建议定期审查文档时效性，或在 CI 中增加文档新鲜度检查。`,
      tags: ['documentation', 'stale', 'maintenance'],
      graph_bindings: staleDocs.map((d) => d.path),
      confidence: 'medium',
      source: 'docs',
      evidence: `过时文档数: ${staleDocs.length}`,
    });
  }

  // Propose knowledge based on overall doc state
  const totalDocCount = allDocs.filter((d) => d.exists).length;
  if (totalDocCount === 0) {
    proposed.push({
      id: generateId(),
      title: '项目无结构化文档，知识传递依赖口头沟通',
      type: 'risk',
      scope: '.',
      content: '项目目录中未发现任何结构化文档（README、docs/ 目录等）。这意味着：\n1. 设计决策完全存储在个人脑中\n2. 新人上手需要口头传授\n3. 难以追溯历史原因\n\n建议从创建 README.md 和 docs/design/ 目录开始积累知识。',
      tags: ['documentation', 'missing', 'knowledge-silo'],
      graph_bindings: [],
      confidence: 'high',
      source: 'docs',
      evidence: '扫描结果：未发现任何 markdown 文档',
    });
  }

  // Acknowledge root-level markdown files as potential knowledge sources
  if (rootMarkdowns.length > 0) {
    proposed.push({
      id: generateId(),
      title: `发现 ${rootMarkdowns.length} 个项目根目录文档可作为知识来源`,
      type: 'pattern',
      scope: '.',
      content: `项目根目录有以下文档：\n${rootMarkdowns.map((f) => `- ${f}`).join('\n')}\n\n这些文档可能包含：\n- 设计决策记录\n- 技术规范\n- 开发指南\n\n建议审查这些文档的内容，考虑将其提炼为正式知识页。`,
      tags: ['documentation', 'inventory', 'discovery'],
      graph_bindings: rootMarkdowns,
      confidence: 'high',
      source: 'docs',
      evidence: `发现 ${rootMarkdowns.length} 个根目录文档文件`,
    });
  }

  return proposed;
}
