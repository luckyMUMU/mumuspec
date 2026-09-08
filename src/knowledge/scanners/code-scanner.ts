/**
 * Code Structure Scanner — infer design knowledge from directory structure and code organization.
 * 
 * Detects architectural patterns from:
 * - Directory structure (layered / feature-based / DDD)
 * - Module boundaries and coupling patterns
 * - Missing documentation or inconsistent organization
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { resolveWithinRoot, SKIP_DIRS } from '../../core/utils.js';
import type { ProposedKnowledgePage } from '../scan-types.js';

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `KS-CODE-${String(idCounter).padStart(4, '0')}`;
}

/** Directory entry for traversal */
interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: DirEntry[];
}

/** Recursively get directory tree (limited depth) */
function getDirTree(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): DirEntry[] {
  if (currentDepth >= maxDepth) return [];

  try {
    const entries = readdirSync(dirPath);
    const result: DirEntry[] = [];

    for (const entry of entries) {
      // Skip common non-source directories
      if (SKIP_DIRS.has(entry)) {
        continue;
      }

      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          result.push({
            name: entry,
            path: fullPath,
            isDir: true,
            children: getDirTree(fullPath, maxDepth, currentDepth + 1),
          });
        }
      } catch {
        // Skip inaccessible
      }
    }

    return result;
  } catch {
    return [];
  }
}

/** Count files by extension in a directory */
function countFilesByExtension(dirPath: string): Record<string, number> {
  const counts: Record<string, number> = {};

  function countRecursive(path: string): void {
    try {
      const entries = readdirSync(path);
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry)) {
          continue;
        }
        const fullPath = join(path, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            countRecursive(fullPath);
          } else {
            const ext = extname(entry).toLowerCase() || '(no-ext)';
            counts[ext] = (counts[ext] ?? 0) + 1;
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // Skip
    }
  }

  countRecursive(dirPath);
  return counts;
}

/** Detect architectural pattern from directory structure */
function detectArchitecturePattern(tree: DirEntry[], projectRoot: string): {
  pattern: string;
  scope: string;
  evidence: string;
} | null {
  const srcEntry = tree.find((e) => e.name === 'src' && e.isDir);
  if (!srcEntry?.children) return null;

  const srcChildren = srcEntry.children.map((c) => c.name);
  const srcPath = srcEntry.path;

  // DDD pattern: src/{domains}/{domain}/{application,domain,infrastructure}
  const dddIndicators = ['domains', 'aggregates', 'entities', 'value-objects', 'repositories'];
  if (dddIndicators.some((ind) => srcChildren.includes(ind))) {
    return {
      pattern: 'DDD (领域驱动设计)',
      scope: relative(projectRoot, srcPath),
      evidence: `src/ 下检测到 DDD 特征目录: ${srcChildren.filter((c) => dddIndicators.includes(c)).join(', ')}`,
    };
  }

  // MVC / Layered pattern: src/{controllers,services,models,repositories} or src/{routes,handlers,db}
  const mvcIndicators = ['controllers', 'services', 'models', 'routes', 'handlers', 'middleware'];
  const detectedMvc = srcChildren.filter((c) => mvcIndicators.includes(c));
  if (detectedMvc.length >= 2) {
    return {
      pattern: '分层架构 / MVC 模式',
      scope: relative(projectRoot, srcPath),
      evidence: `src/ 下检测到分层特征目录: ${detectedMvc.join(', ')}`,
    };
  }

  // Feature-based pattern: src/features/{feature}/...
  if (srcChildren.includes('features') || srcChildren.includes('modules')) {
    const featureDir = srcEntry.children.find((c) => (c.name === 'features' || c.name === 'modules') && c.isDir);
    const featureCount = featureDir?.children?.length ?? 0;
    return {
      pattern: 'Feature-Based 模块化架构',
      scope: relative(projectRoot, srcPath),
      evidence: `src/ 下检测到 Feature 模块化: ${featureCount} 个功能模块`,
    };
  }

  // API-centric pattern: src/{api,routes,schemas,validations}
  const apiIndicators = ['api', 'routes', 'endpoints', 'schemas', 'validators'];
  const detectedApi = srcChildren.filter((c) => apiIndicators.includes(c));
  if (detectedApi.length >= 2) {
    return {
      pattern: 'API-Centric 架构',
      scope: relative(projectRoot, srcPath),
      evidence: `src/ 下检测到 API 特征目录: ${detectedApi.join(', ')}`,
    };
  }

  // CLI pattern: src/{commands,utils,config}
  if (srcChildren.includes('commands') || srcChildren.includes('bin')) {
    return {
      pattern: 'CLI 工具架构',
      scope: relative(projectRoot, srcPath),
      evidence: `src/ 下检测到 CLI 特征目录: commands/bin`,
    };
  }

  // Default: no clear pattern
  return null;
}

/** Detect potential structural risks */
function detectStructuralRisks(tree: DirEntry[], _projectRoot: string): ProposedKnowledgePage[] {
  const risks: ProposedKnowledgePage[] = [];
  const srcEntry = tree.find((e) => e.name === 'src' && e.isDir);

  if (srcEntry?.children) {
    // Check for large directories (potential god modules)
    for (const child of srcEntry.children) {
      if (child.isDir && child.children) {
        const fileCount = countFilesInDir(child.path);
        if (fileCount > 50) {
          risks.push({
            id: generateId(),
            title: `模块 "${child.name}" 包含过多文件（${fileCount} 个），可能违反单一职责`,
            type: 'risk',
            scope: `src/${child.name}`,
            content: `src/${child.name} 目录包含 ${fileCount} 个文件，建议评估是否需要拆分为更小的子模块以提高可维护性。\n\n建议措施：\n1. 按职责拆分为 2-3 个子模块\n2. 提取共享逻辑到 common/utils\n3. 评估模块边界是否清晰`,
            tags: ['risk', 'coupling', 'module-design', 'maintainability'],
            graph_bindings: [`src/${child.name}`],
            confidence: 'medium',
            source: 'code',
            evidence: `文件计数: ${fileCount} (>50 阈值)`,
          });
        }
      }
    }

    // Check for potential circular dependency risk
    const totalSubdirs = srcEntry.children.filter((c) => c.isDir).length;
    if (totalSubdirs > 15) {
      risks.push({
        id: generateId(),
        title: `src/ 下子目录过多（${totalSubdirs} 个），模块边界可能模糊`,
        type: 'risk',
        scope: 'src',
        content: `src/ 下存在 ${totalSubdirs} 个子目录，建议检查模块划分是否合理，是否存在职责重叠。`,
        tags: ['risk', 'module-boundaries', 'architecture'],
        graph_bindings: ['src'],
        confidence: 'low',
        source: 'code',
        evidence: `子目录数量: ${totalSubdirs}`,
      });
    }
  }

  return risks;
}

/** Count all files in a directory (recursive) */
function countFilesInDir(dirPath: string): number {
  let count = 0;
  try {
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          count += countFilesInDir(fullPath);
        } else {
          count += 1;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return count;
}

/** Detect missing index/barrel files at module boundaries */
function findMissingBarrelFiles(tree: DirEntry[], projectRoot: string): ProposedKnowledgePage[] {
  const proposals: ProposedKnowledgePage[] = [];

  function checkBarrel(entry: DirEntry, depth: number): void {
    if (!entry.isDir || !entry.children || depth < 2) return;

    const hasIndexFile = entry.children.some(
      (f) => !f.isDir && (f.name === 'index.ts' || f.name === 'index.js' || f.name === '__init__.py'),
    );

    const hasSubFiles = entry.children.some((f) => !f.isDir && /\.(ts|js|tsx|jsx|py)$/.test(f.name));

    if (!hasIndexFile && hasSubFiles && entry.children.filter((c) => !c.isDir).length >= 3) {
      proposals.push({
        id: generateId(),
        title: `模块 ${relative(projectRoot, entry.path)} 缺少 barrel 文件（index.ts）`,
        type: 'pattern',
        scope: relative(projectRoot, entry.path),
        content: `模块目录 ${relative(projectRoot, entry.path)} 包含多个源文件但缺少 barrel/index 文件。建议创建 index.ts 统一导出，降低外部模块的导入耦合。`,
        tags: ['pattern', 'barrel-file', 'module-boundary', 'organization'],
        graph_bindings: [relative(projectRoot, entry.path).replace(/\\/g, '/')],
        confidence: 'low',
        source: 'code',
        evidence: `${entry.children.filter((c) => !c.isDir).length} 个文件但无 index.ts`,
      });
    }

    // Recurse
    for (const child of entry.children) {
      checkBarrel(child, depth + 1);
    }
  }

  const srcEntry = tree.find((e) => e.name === 'src' && e.isDir);
  if (srcEntry) {
    checkBarrel(srcEntry, 0);
  }

  return proposals;
}

/** Scan codebase structure and propose design knowledge */
export function scanCodeStructure(projectRoot: string, scope?: string): ProposedKnowledgePage[] {
  idCounter = 0;
  const targetDir = scope ? resolveWithinRoot(projectRoot, scope) : projectRoot;
  const proposed: ProposedKnowledgePage[] = [];

  // Get directory tree
  const tree = getDirTree(targetDir, 4);

  // Detect architecture pattern
  const archPattern = detectArchitecturePattern(tree, targetDir);
  if (archPattern) {
    proposed.push({
      id: generateId(),
      title: `检测到架构模式：${archPattern.pattern}`,
      type: 'decision',
      scope: archPattern.scope,
      content: `从目录结构推断项目采用 ${archPattern.pattern}。这是根据源代码组织方式得出的推断，建议与团队确认是否为有意识的设计选择。\n\n建议：\n1. 如果判断正确，补充架构决策文档\n2. 如果判断有误，说明实际架构模式`,
      tags: ['architecture', 'pattern-inference', archPattern.pattern.toLowerCase().replace(/\s+/g, '-')],
      graph_bindings: [archPattern.scope],
      confidence: 'medium',
      source: 'code',
      evidence: archPattern.evidence,
    });
  }

  // Detect structural risks
  proposed.push(...detectStructuralRisks(tree, targetDir));

  // Detect missing barrel files
  proposed.push(...findMissingBarrelFiles(tree, targetDir));

  // Detect file distribution
  const fileCounts = countFilesByExtension(targetDir);
  const totalFiles = Object.values(fileCounts).reduce((a, b) => a + b, 0);
  if (totalFiles > 0) {
    const dominantExt = Object.entries(fileCounts).sort(([, a], [, b]) => b - a)[0];
    if (dominantExt && dominantExt[1] / totalFiles > 0.7) {
      proposed.push({
        id: generateId(),
        title: `项目主要使用 ${dominantExt[0]} 文件（${dominantExt[1]}/${totalFiles} = ${((dominantExt[1] / totalFiles) * 100).toFixed(0)}%）`,
        type: 'rationale',
        scope: scope ?? '.',
        content: `项目中 ${dominantExt[0]} 文件占比超过 70%，表明这是一个 ${dominantExt[0]} 为主的项目。`,
        tags: ['language', 'file-distribution'],
        graph_bindings: [],
        confidence: 'high',
        source: 'code',
        evidence: `文件分布: ${JSON.stringify(fileCounts)}`,
      });
    }
  }

  return proposed;
}
