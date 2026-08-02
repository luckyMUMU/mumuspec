/**
 * Spec Scaffolder — 分布式规约推断引擎
 *
 * 基于项目分析和代码结构，自下而上生成 tech.md，自上而下生成 prd.md。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import type { ProjectAnalysis } from './project-analyzer.js';
import { writeText, ensureDir } from './utils.js';

// ════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════

export interface ModuleAnalysis {
  path: string;
  depth: number;
  codeFiles: string[];
  testFiles: string[];
  imports: string[];
  exports: string[];
  hasPonytailComments: boolean;
  comments: string[];
  responsibilities: string[];
}

export interface TechInference {
  constraints: string[];
  architectureDecisions: string[];
  testCoverage: number;
  dependencies: string[];
  responsibilities: string[];
}

export interface PrdInference {
  userScenarios: string[];
  acceptanceCriteria: string[];
  parentGoals: string[];
  responsibilities: string[];
}

// ════════════════════════════════════════════════════════════════════
// Directory Tree Builder
// ════════════════════════════════════════════════════════════════════

/**
 * Build directory tree sorted by depth (deepest first)
 * Bottom-up processing order
 */
export function buildDirectoryTree(projectRoot: string, maxDepth: number = 5): string[] {
  const result: Array<{ path: string; depth: number }> = [];

  function walkDir(dir: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const hasCode = entries.some(
        (e) => e.isFile() && /\.(ts|js|tsx|jsx)$/.test(e.name) && !e.name.endsWith('.d.ts'),
      );
      const hasSpec = entries.some((e) => e.isDirectory() && e.name === '.mumuspec');

      if (hasCode || hasSpec) {
        result.push({ path: dir, depth });
      }

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== 'build'
        ) {
          walkDir(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  walkDir(projectRoot, 0);

  // Sort by depth descending (deepest first) for bottom-up processing
  result.sort((a, b) => b.depth - a.depth);

  // Return unique paths
  return [...new Set(result.map((r) => r.path))];
}

// ════════════════════════════════════════════════════════════════════
// Module Analysis
// ════════════════════════════════════════════════════════════════════

export function analyzeModule(dirPath: string, _analysis: ProjectAnalysis): ModuleAnalysis {
  const codeFiles: string[] = [];
  const testFiles: string[] = [];
  const imports: string[] = [];
  const exports: string[] = [];
  const comments: string[] = [];
  let hasPonytailComments = false;

  function walk(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            entry.name !== 'dist'
          ) {
            walk(join(dir, entry.name));
          }
        } else if (entry.isFile()) {
          const fullPath = join(dir, entry.name);
          if (/\.(ts|js|tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
            if (/\.(test|spec)\.(ts|js|tsx|jsx)$/.test(entry.name)) {
              testFiles.push(fullPath);
            } else {
              codeFiles.push(fullPath);
              // Parse file for imports, exports, comments
              try {
                const content = readFileSync(fullPath, 'utf8');
                extractCodeStructure(content, imports, exports, comments);
                if (content.includes('ponytail:')) {
                  hasPonytailComments = true;
                }
              } catch {
                // Skip unreadable files
              }
            }
          }
        }
      }
    } catch {
      // Skip
    }
  }

  walk(dirPath);

  return {
    path: dirPath,
    depth: dirPath.split(sep).length,
    codeFiles,
    testFiles,
    imports: [...new Set(imports)],
    exports: [...new Set(exports)],
    hasPonytailComments,
    comments: [...new Set(comments)],
    responsibilities: inferResponsibilitiesFromPath(dirPath),
  };
}

/**
 * Infer module responsibilities from directory path name
 */
function inferResponsibilitiesFromPath(dirPath: string): string[] {
  const pathParts = dirPath.split(sep);
  const dirName = pathParts[pathParts.length - 1];
  if (!dirName || dirName.startsWith('.')) return [];

  // Map common directory names to responsibilities
  const commonMappings: Record<string, string> = {
    src: 'Source code root',
    core: 'Core business logic',
    cli: 'Command-line interface',
    commands: 'CLI command implementations',
    api: 'API layer',
    utils: 'Utility functions',
    helpers: 'Helper functions',
    types: 'Type definitions',
    interfaces: 'Interface contracts',
    config: 'Configuration management',
    test: 'Test files',
    tests: 'Test files',
    docs: 'Documentation',
    scripts: 'Build and utility scripts',
    templates: 'Template files',
  };

  const mapped = commonMappings[dirName.toLowerCase()];
  return mapped ? [mapped] : [`Module: ${dirName}`];
}

function extractCodeStructure(
  content: string,
  imports: string[],
  exports: string[],
  comments: string[],
): void {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Extract comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      const commentText = trimmed.replace(/^\/\/\s*/, '').replace(/^\/\*\s*/, '').replace(/\*\/$/, '').replace(/^\*\s*/, '').trim();
      if (commentText && commentText.length > 5 && commentText.length < 200) {
        comments.push(commentText);
      }
    }

    // Extract imports
    const importMatch = trimmed.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      imports.push(importMatch[1]);
    }

    // Extract exports
    const exportMatch = trimmed.match(/export\s+(?:default\s+)?(?:class|function|interface|type|const)\s+(\w+)/);
    if (exportMatch) {
      exports.push(exportMatch[1]);
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// Tech Inference
// ════════════════════════════════════════════════════════════════════

export function inferTechConstraints(module: ModuleAnalysis): TechInference {
  const constraints: string[] = [];
  const architectureDecisions: string[] = [];
  const responsibilities: string[] = [];

  // Infer from exports
  if (module.exports.length > 0) {
    architectureDecisions.push(`Public API: ${module.exports.slice(0, 5).join(', ')}`);
  }

  // Infer from imports
  const internalImports = module.imports.filter((i) => i.startsWith('.'));
  const externalImports = module.imports.filter((i) => !i.startsWith('.') && !i.startsWith('node:'));
  if (externalImports.length > 0) {
    const uniqueDeps = [...new Set(externalImports.map((i) => i.startsWith('@') ? i.split('/').slice(0, 2).join('/') : i.split('/')[0]))];
    constraints.push(`Dependencies: ${uniqueDeps.slice(0, 8).join(', ')}`);
  }
  if (internalImports.length > 0) {
    architectureDecisions.push(`Internal coupling: ${internalImports.length} local dependencies`);
  }

  // Infer from comments
  const todoComments = module.comments.filter((c) => c.toLowerCase().includes('todo') || c.toLowerCase().includes('fixme'));
  if (todoComments.length > 0) {
    constraints.push(`Known issues: ${todoComments.length} TODO/FIXME items`);
  }

  // Infer responsibilities from path
  const pathParts = module.path.split(sep);
  const dirName = pathParts[pathParts.length - 1];
  if (dirName && !dirName.startsWith('.')) {
    responsibilities.push(`Module: ${dirName}`);
  }

  // Calculate test coverage (rough estimate)
  const testCoverage = module.codeFiles.length > 0
    ? Math.min(100, Math.round((module.testFiles.length / module.codeFiles.length) * 100))
    : 0;
  if (module.testFiles.length > 0) {
    architectureDecisions.push(`Test coverage: ${module.testFiles.length} test files for ${module.codeFiles.length} source files (~${testCoverage}%)`);
  } else if (module.codeFiles.length > 0) {
    constraints.push('No tests detected — consider adding unit tests');
  }

  return {
    constraints,
    architectureDecisions,
    testCoverage,
    dependencies: module.imports,
    responsibilities,
  };
}

// ════════════════════════════════════════════════════════════════════
// Prd Inference
// ════════════════════════════════════════════════════════════════════

export function inferPrdContent(module: ModuleAnalysis, parentPrd?: string): PrdInference {
  const userScenarios: string[] = [];
  const acceptanceCriteria: string[] = [];

  // Infer user scenarios from module responsibilities
  if (module.responsibilities.length > 0) {
    for (const resp of module.responsibilities) {
      userScenarios.push(`User interacts with ${resp}`);
    }
  }

  // Infer from public API
  if (module.exports.length > 0) {
    for (const exp of module.exports.slice(0, 5)) {
      acceptanceCriteria.push(`${exp} is accessible and functional`);
    }
  }

  // Infer from comments about user-facing behavior
  const userComments = module.comments.filter(
    (c) => c.toLowerCase().includes('user') || c.toLowerCase().includes('should') || c.toLowerCase().includes('must'),
  );
  for (const comment of userComments.slice(0, 5)) {
    userScenarios.push(comment);
  }

  // Inherit from parent if provided
  const parentGoals: string[] = [];
  if (parentPrd) {
    parentGoals.push('Inherits parent module goals');
    // Extract goals from parent
    const goalMatches = parentPrd.match(/^##[^\n]*goal[^\n]*$/gim);
    if (goalMatches) {
      for (const g of goalMatches) {
        parentGoals.push(g.replace(/^#+\s*/, ''));
      }
    }
  }

  return {
    userScenarios,
    acceptanceCriteria,
    parentGoals,
    responsibilities: module.responsibilities,
  };
}

// ════════════════════════════════════════════════════════════════════
// Markdown Generation
// ════════════════════════════════════════════════════════════════════

export function generateTechMd(inference: TechInference, childSummaries: string[] = []): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`scope: "."`);
  lines.push(`type: tech`);
  lines.push('---');
  lines.push('');
  lines.push('# Technical Specification');
  lines.push('');

  // Responsibilities
  if (inference.responsibilities.length > 0) {
    lines.push('## Responsibilities');
    lines.push('');
    for (const resp of inference.responsibilities) {
      lines.push(`- ${resp}`);
    }
    lines.push('');
  }

  // Architecture Decisions
  if (inference.architectureDecisions.length > 0) {
    lines.push('## Architecture Decisions');
    lines.push('');
    for (const decision of inference.architectureDecisions) {
      lines.push(`- ${decision}`);
    }
    lines.push('');
  }

  // Constraints
  if (inference.constraints.length > 0) {
    lines.push('## Constraints');
    lines.push('');
    lines.push('### SHALL');
    lines.push('');
    for (const constraint of inference.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push('');
  }

  // Child Summaries (for parent directories)
  if (childSummaries.length > 0) {
    lines.push('## Sub-Modules');
    lines.push('');
    for (const summary of childSummaries) {
      lines.push(`- ${summary}`);
    }
    lines.push('');
  }

  // Test Coverage
  if (inference.testCoverage > 0) {
    lines.push('## Test Coverage');
    lines.push('');
    lines.push(`Estimated coverage: ~${inference.testCoverage}%`);
    lines.push('');
  }

  // ponytail: intentionally omitting enforcement section for initial scaffold
  lines.push('---');
  lines.push('');
  lines.push('> Generated by `mumuspec init`. Customize as needed.');

  return lines.join('\n');
}

export function generatePrdMd(inference: PrdInference): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`scope: "."`);
  lines.push(`type: prd`);
  lines.push('---');
  lines.push('');
  lines.push('# Product Specification');
  lines.push('');

  // Parent Goals
  if (inference.parentGoals.length > 0) {
    lines.push('## Parent Goals');
    lines.push('');
    for (const goal of inference.parentGoals) {
      lines.push(`- ${goal}`);
    }
    lines.push('');
  }

  // User Scenarios
  if (inference.userScenarios.length > 0) {
    lines.push('## User Scenarios');
    lines.push('');
    for (const scenario of inference.userScenarios) {
      lines.push(`- As a user, ${scenario}`);
    }
    lines.push('');
  }

  // Acceptance Criteria
  if (inference.acceptanceCriteria.length > 0) {
    lines.push('## Acceptance Criteria');
    lines.push('');
    for (const criteria of inference.acceptanceCriteria) {
      lines.push(`- [ ] ${criteria}`);
    }
    lines.push('');
  }

  // Responsibilities
  if (inference.responsibilities.length > 0) {
    lines.push('## Responsibilities');
    lines.push('');
    lines.push('This module is responsible for:');
    lines.push('');
    for (const resp of inference.responsibilities) {
      lines.push(`- ${resp}`);
    }
    lines.push('');
  }

  // ponytail: intentionally minimal for initial scaffold
  lines.push('---');
  lines.push('');
  lines.push('> Generated by `mumuspec init`. Customize as needed.');

  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════
// High-Level API (for init command integration)
// ════════════════════════════════════════════════════════════════════

/**
 * Scaffold all module directories with prd.md + tech.md
 * Returns list of created file paths
 */
export function scaffoldDistributedSpecs(
  projectRoot: string,
  analysis: ProjectAnalysis,
  options: { force?: boolean } = {},
): string[] {
  const created: string[] = [];
  const directories = buildDirectoryTree(projectRoot);

  // Phase A: Bottom-up tech.md generation
  const techSummaries = new Map<string, string[]>();

  for (const dir of directories) {
    const moduleAnalysis = analyzeModule(dir, analysis);
    const techInference = inferTechConstraints(moduleAnalysis);

    // Collect child summaries
    const childSummaries: string[] = [];
    for (const [childPath, summaries] of techSummaries) {
      if (childPath.startsWith(dir + sep)) {
        childSummaries.push(...summaries);
      }
    }

    const techMd = generateTechMd(techInference, childSummaries);
    const techPath = join(dir, '.mumuspec', 'tech.md');

    if (!existsSync(techPath) || options.force) {
      ensureDir(dirname(techPath));
      writeText(techPath, techMd);
      created.push(techPath);
    }

    // Store summary for parent aggregation
    techSummaries.set(dir, [
      `${relative(projectRoot, dir) || '.'}: ${techInference.responsibilities.join(', ') || 'module'}`,
    ]);
  }

  // Phase B: Top-down prd.md generation
  const dirDepthSorted = [...directories].sort((a, b) => a.split(sep).length - b.split(sep).length);

  for (const dir of dirDepthSorted) {
    const moduleAnalysis = analyzeModule(dir, analysis);

    // Read parent prd.md if exists
    const parentDir = dirname(dir);
    const parentPrdPath = join(parentDir, '.mumuspec', 'prd.md');
    const parentPrd = existsSync(parentPrdPath) ? readFileSync(parentPrdPath, 'utf8') : undefined;

    const prdInference = inferPrdContent(moduleAnalysis, parentPrd);
    const prdMd = generatePrdMd(prdInference);
    const prdPath = join(dir, '.mumuspec', 'prd.md');

    if (!existsSync(prdPath) || options.force) {
      ensureDir(dirname(prdPath));
      writeText(prdPath, prdMd);
      created.push(prdPath);
    }
  }

  return created;
}
