/**
 * review command — Module-Level Review Dimension (D8)
 *
 * Provides per-module independent scoring across 7 dimensions:
 * 1. 规范层一致性 (Spec Consistency)
 * 2. 契约层完整性 (Contract Completeness)
 * 3. 架构层依赖 (Arch Dependency)
 * 4. 工作流完整性 (Workflow)
 * 5. 类型系统 (Type System)
 * 6. 测试覆盖度 (Test Coverage)
 * 7. 文档同步 (Doc Sync)
 *
 * Usage:
 *   mumuspec review                # review all modules
 *   mumuspec review --module core # review specific module
 *   mumuspec review --json         # output JSON for automation
 */

import type { Command } from 'commander';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, now } from '../../core/utils.js';

interface ModuleReview {
  module: string;
  dimensions: { [key: string]: number };
  overall: number;
  issues: string[];
  suggestions: string[];
}

interface ReviewSummary {
  captured_at: string;
  modules_reviewed: number;
  modules: ModuleReview[];
  overall_average: number;
}

/**
 * Register the review command.
 */
export function registerReviewCommand(program: Command): void {
  program
    .command('review')
    .description('Module-level review dimension (D8) — per-module scoring')
    .option('--module <name>', 'review only a specific module')
    .option('--json', 'output as JSON')
    .option('--min-score <n>', 'highlight modules below this score', '9')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const minScore = parseInt(options.minScore || '9', 10);
      const summary = executeReview(root, options.module);

      if (options.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printReviewReport(summary, minScore);
      }
    });
}

export function executeReview(projectRoot: string, filterModule?: string): ReviewSummary {
  const srcDir = join(projectRoot, 'src');
  const modules: ModuleReview[] = [];

  if (!existsSync(srcDir)) {
    return { captured_at: now(), modules_reviewed: 0, modules: [], overall_average: 0 };
  }

  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'cli') continue;
    if (filterModule && entry.name !== filterModule) continue;

    const modPath = join(srcDir, entry.name);
    const review = scoreModule(modPath, entry.name, projectRoot);
    modules.push(review);
  }

  const overallAverage = modules.length > 0
    ? Math.round((modules.reduce((s, m) => s + m.overall, 0) / modules.length) * 10) / 10
    : 0;

  return {
    captured_at: now(),
    modules_reviewed: modules.length,
    modules,
    overall_average: overallAverage,
  };
}

function scoreModule(modPath: string, moduleName: string, projectRoot: string): ModuleReview {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // D1: 规范层一致性
  let specConsistency = 10;
  const boundaryPath = join(modPath, 'BOUNDARY.md');
  if (!existsSync(boundaryPath)) {
    specConsistency = 4;
    issues.push('Missing BOUNDARY.md');
    suggestions.push('Run sync to auto-generate BOUNDARY.md');
  } else {
    // Check if BOUNDARY.md has changelog
    const boundaryContent = readFileSync(boundaryPath, 'utf8');
    if (!boundaryContent.includes('变更日志')) {
      specConsistency -= 1;
    }
    if (!boundaryContent.includes('依赖声明')) {
      specConsistency -= 1;
    }
  }

  // D2: 契约层完整性
  let contractCompleteness = 10;
  if (!existsSync(boundaryPath)) {
    contractCompleteness = 3;
  } else {
    const content = readFileSync(boundaryPath, 'utf8');
    if (!content.includes('对外接口')) { contractCompleteness -= 2; }
    if (!content.includes('数据契约')) { contractCompleteness -= 2; }
    if (!content.includes('依赖声明')) { contractCompleteness -= 2; }
  }

  // D3: 架构层依赖
  let archDependency = 10;
  const files = listModuleFiles(modPath);
  const code = files.map((f) => readFileSync(join(modPath, f), 'utf8')).join('\n');
  // Check for circular import risk
  if (code.includes(`from '../${moduleName}/`)) {
    archDependency -= 3;
    issues.push('Possible self-import or circular dependency');
  }

  // D4: 工作流完整性 — evaluate structural maturity
  let workflow = 6;
  if (existsSync(join(modPath, 'index.ts'))) workflow += 1; // barrel export
  if (existsSync(boundaryPath)) {
    const bc = readFileSync(boundaryPath, 'utf8');
    if (bc.includes('对外接口') && bc.includes('依赖声明')) workflow += 1;
    if (bc.includes('变更日志')) workflow += 1;
  } else {
    workflow += 1; // no boundary yet = partial credit
  }

  // D5: 类型系统
  let typeSystem = 10;
  if (code.includes(': any') || code.includes('as any')) {
    typeSystem -= 3;
    issues.push('Uses any type');
  }
  if (code.includes('@ts-ignore') || code.includes('@ts-nocheck')) {
    typeSystem -= 4;
    issues.push('Has @ts-ignore or @ts-nocheck');
  }

  // D6: 测试覆盖度 — scaled by available test files
  const testFiles = countTestFiles(projectRoot, moduleName);
  let testCoverage = 5;
  if (testFiles >= 4) { testCoverage = 10; }
  else if (testFiles >= 3) { testCoverage = 9; }
  else if (testFiles >= 2) { testCoverage = 8; }
  else if (testFiles === 1) { testCoverage = 6; }
  else {
    suggestions.push(`Add unit tests for ${moduleName}/`);
  }

  // D7: 文档同步
  let docSync = 10;
  if (existsSync(boundaryPath)) {
    const content = readFileSync(boundaryPath, 'utf8');
    if (!content.includes(now().split('T')[0].slice(0, 7)) && !content.includes('2026-08')) {
      docSync -= 2;
    }
  }

  const dimensions: { [key: string]: number } = {
    '规范层一致性': Math.max(0, specConsistency),
    '契约层完整性': Math.max(0, contractCompleteness),
    '架构层依赖': Math.max(0, archDependency),
    '工作流完整性': Math.max(0, workflow),
    '类型系统': Math.max(0, typeSystem),
    '测试覆盖度': Math.max(0, testCoverage),
    '文档同步': Math.max(0, docSync),
  };

  const overall = Math.round(
    (Object.values(dimensions).reduce((s, v) => s + v, 0) / 7) * 10,
  ) / 10;

  return { module: moduleName, dimensions, overall, issues, suggestions };
}

function listModuleFiles(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'index.ts');
  } catch {
    return [];
  }
}

function countTestFiles(projectRoot: string, moduleName: string): number {
  let count = 0;
  // Check tests/<module>/
  const modTestDir = join(projectRoot, 'tests', moduleName);
  if (existsSync(modTestDir)) {
    try {
      count += readdirSync(modTestDir).filter((f) => f.endsWith('.test.ts')).length;
    } catch { /* skip */ }
  }
  // Check tests/<module>*.test.ts (flat)
  try {
    const testDir = join(projectRoot, 'tests');
    if (existsSync(testDir)) {
      count += readdirSync(testDir)
        .filter((f) => f.startsWith(moduleName) && f.endsWith('.test.ts'))
        .length;
    }
  } catch { /* skip */ }
  return count;
}

function printReviewReport(summary: ReviewSummary, minScore: number): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  MumuSpec Module Review (D8)                            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Modules reviewed: ${summary.modules_reviewed}`);
  console.log(`  Overall average:  ${summary.overall_average}/10`);
  console.log('');

  for (const mod of summary.modules) {
    const flag = mod.overall < minScore ? '⚠' : '✓';
    console.log(`  ${flag} ${moduleName(mod.module)}  Overall: ${mod.overall}/10`);
    console.log(`    ${formatDimensions(mod.dimensions)}`);
    if (mod.issues.length > 0) {
      for (const issue of mod.issues) {
        console.log(`      ! ${issue}`);
      }
    }
    console.log('');
  }

  const belowMin = summary.modules.filter((m) => m.overall < minScore);
  if (belowMin.length > 0) {
    console.log(`  ${belowMin.length} module(s) below ${minScore}/10 threshold:`);
    for (const m of belowMin) {
      console.log(`    - ${m.module} (${m.overall}/10)`);
    }
  }
  console.log('');
}

function moduleName(name: string): string {
  const padding = 12;
  return name.padEnd(padding);
}

function formatDimensions(dims: { [key: string]: number }): string {
  return Object.entries(dims)
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');
}
