/**
 * sync command — Code State → Persistent Spec Sync
 *
 * Scans the actual code structure and synchronizes it into .mumuspec/:
 * - Validates/updates BOUNDARY.md exports for each module
 * - Validates index.yaml children coverage
 * - Records contract snapshots in contracts/schemas/
 * - Outputs a sync report with drift warnings
 *
 * Usage:
 *   mumuspec sync              # sync current state
 *   mumuspec sync --check      # dry-run, only report drift
 *   mumuspec sync --migrate    # detect old-format and suggest migration
 */

import type { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, ensureDir, now } from '../../core/utils.js';
import { resolveBoundaryPath } from '../../contract/loader.js';
import { MUMUSPEC_DIR, BOUNDARY_FILE } from '../../contract/constants.js';

interface SyncResult {
  modulesScanned: number;
  boundaryUpdated: number;
  indexAligned: number;
  issues: SyncIssue[];
}

interface SyncIssue {
  severity: 'error' | 'warning' | 'info';
  module: string;
  message: string;
}

interface ScannedModule {
  name: string;
  path: string;
  files: string[];
  hasBoundary: boolean;
  hasIndex: boolean;
  exports: string[];
}

interface ModuleSyncResult {
  updated: boolean;
  issues: SyncIssue[];
}

interface IndexValidationResult {
  aligned: number;
  issues: SyncIssue[];
}

/**
 * Register the sync command.
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync code state to persistent spec (BOUNDARY.md, index.yaml, contracts)')
    .option('--check', 'dry-run mode: report drift without writing')
    .option('--migrate', 'detect old-format structures and output migration plan')
    .option('--report <file>', 'write sync report to file (markdown format)')
    .option('--module <name>', 'sync only a specific module')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const result = executeSync(root, options);

      printReport(result);

      // Write report to file if --report specified
      if (options.report) {
        const reportContent = generateReportMarkdown(result, root);
        const reportPath = join(root, options.report);
        writeFileSync(reportPath, reportContent, 'utf8');
        console.log(`  ✓ Report written to ${options.report}`);
      }

      if (result.issues.filter((i) => i.severity === 'error').length > 0) {
        process.exit(1);
      }
    });
}

/**
 * Execute the sync operation.
 */
export function executeSync(
  projectRoot: string,
  options: { check?: boolean; migrate?: boolean; module?: string; report?: string },
): SyncResult {
  const result: SyncResult = {
    modulesScanned: 0,
    boundaryUpdated: 0,
    indexAligned: 0,
    issues: [],
  };

  const srcDir = join(projectRoot, 'src');
  if (!existsSync(srcDir)) {
    result.issues.push({ severity: 'error', module: 'src', message: 'src/ directory not found' });
    return result;
  }

  // Step 1: Scan modules in src/
  const modules = scanModules(srcDir, options.module);
  result.modulesScanned = modules.length;

  // Step 2: Sync each module's BOUNDARY.md
  for (const mod of modules) {
    const syncMod = syncModuleBoundary(projectRoot, mod, options.check || false);
    result.boundaryUpdated += syncMod.updated ? 1 : 0;
    result.issues.push(...syncMod.issues);
  }

  // Step 3: Validate index.yaml children
  const indexResult = validateIndexYaml(projectRoot, modules, options.check || false);
  result.indexAligned = indexResult.aligned;
  result.issues.push(...indexResult.issues);

  // Step 4: Record contract schemas (skip in dry-run/migrate)
  if (!options.check && !options.migrate) {
    recordContractSnapshots(projectRoot, modules);
  }

  // Step 5: Migration mode — detect old-format structures
  if (options.migrate) {
    const migrationIssues = detectOldFormatIssues(projectRoot, modules);
    result.issues.push(...migrationIssues);
  }

  return result;
}

function scanModules(srcDir: string, filterModule?: string): ScannedModule[] {
  const modules: ScannedModule[] = [];
  const entries = readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'cli') continue;

    const modPath = join(srcDir, entry.name);
    const moduleName = entry.name;

    if (filterModule && moduleName !== filterModule) continue;

    const files = listTsFiles(modPath);
    const hasBoundary = resolveBoundaryPath(modPath) !== null;
    const hasIndex = existsSync(join(modPath, 'index.ts'));
    const exports = extractExports(modPath, files);

    modules.push({
      name: moduleName,
      path: modPath,
      files,
      hasBoundary,
      hasIndex,
      exports,
    });
  }

  return modules;
}

function listTsFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(entry.name);
      }
    }
  } catch {
    // Skip
  }
  return files;
}

/**
 * Extract exported function/type/class names from source files.
 * Simple regex-based extraction (not AST-based).
 */
function extractExports(modulePath: string, files: string[]): string[] {
  const exports: Set<string> = new Set();
  const exportPattern = /export\s+(?:function\*?|class|interface|type|const|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

  for (const file of files) {
    if (file === 'index.ts') continue; // skip barrel
    try {
      const content = readFileSync(join(modulePath, file), 'utf8');
      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        exports.add(match[1]);
      }
    } catch {
      // Skip unreadable files
    }
  }
  return [...exports];
}

/**
 * Symbols a BOUNDARY.md declares **as its interface**: backticked identifiers in
 * table rows under an interface-typed heading. Scoped by heading because the
 * other tables in the same file declare different kinds of things — the
 * dependency table names packages (`yaml`), the data-contract table names shapes
 * owned elsewhere (`Contract`) — and reading those as export promises would
 * manufacture findings instead of reporting drift.
 */
function extractDeclaredSymbols(content: string): string[] {
  const declared = new Set<string>();
  let inInterfaceSection = false;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      // Only top-level headings switch sections; a `###` sub-heading inside the
      // interface table's own section must not end the scope.
      if (heading[1].length <= 2) {
        inInterfaceSection = /对外接口|接口|对外符号|Exports?|API|Interface/.test(heading[2]);
      }
      continue;
    }
    if (!inInterfaceSection || !line.trimStart().startsWith('|')) continue;
    // Only the first cell names the interface symbol. Signature cells mention
    // shared types (`=> UserFeedback | undefined`) which this module neither
    // defines nor re-exports — reading them as promises invents drift.
    const firstCell = line.split('|')[1] ?? '';
    for (const m of firstCell.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)`/g)) declared.add(m[1]);
  }
  return [...declared];
}

/**
 * Every identifier the module subtree exports (barrel included). Subdirectories
 * are part of the module, so a symbol declared against `src/contract` and defined
 * in `src/contract/formatter` is real.
 */
function collectModuleSymbols(modulePath: string): Set<string> {
  const found = new Set<string>();
  const directPattern = /export\s+(?:function\*?|class|interface|type|const|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const reExportPattern = /export\s+(?:type\s+)?\{([^}]*)\}\s*(?:from|$)/g;
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === MUMUSPEC_DIR || entry.name === 'node_modules') continue;
        walk(p);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        try {
          // Comment lines are not declarations: `src/contract/ast-analyzer.ts`
          // carries `export interface IBar {}` inside an example comment, and
          // reading it as an export manufactured symbols no code owns.
          const text = readFileSync(p, 'utf8')
            .split(/\r?\n/)
            .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
            .join('\n');
          for (const m of text.matchAll(directPattern)) found.add(m[1]);
          // A module's interface also consists of what it re-exports; declaring
          // those phantom would punish the document for the scanner's blindness.
          for (const m of text.matchAll(reExportPattern)) {
            for (const raw of m[1].split(',')) {
              const name = raw.trim().split(/\s+as\s+/)[0].trim();
              if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) found.add(name);
            }
          }
        } catch {
          // Unreadable file contributes nothing; the read error is not a boundary finding
        }
      }
    }
  };
  walk(modulePath);
  return found;
}

/** Whole-tree symbol index, built once per run (the same facts repeat per module). */
let repositorySymbols: { root: string; symbols: Set<string> } | null = null;
function collectRepositorySymbols(srcRoot: string): Set<string> {
  if (!repositorySymbols || repositorySymbols.root !== srcRoot) {
    repositorySymbols = { root: srcRoot, symbols: collectModuleSymbols(srcRoot) };
  }
  return repositorySymbols.symbols;
}

function syncModuleBoundary(projectRoot: string, mod: ScannedModule, dryRun: boolean): ModuleSyncResult {
  const result: ModuleSyncResult = { updated: false, issues: [] };  const boundaryPath = resolveBoundaryPath(mod.path);

  if (!boundaryPath) {
    result.issues.push({
      severity: 'warning',
      module: mod.name,
      message: `Missing BOUNDARY.md — should be created`,
    });
    if (!dryRun) {
      const content = generateBoundarySection(mod);
      const mumuspecDir = join(mod.path, MUMUSPEC_DIR);
      mkdirSync(mumuspecDir, { recursive: true });
      writeFileSync(join(mumuspecDir, BOUNDARY_FILE), content, 'utf-8');
      result.updated = true;
    }
    return result;
  }

  // Boundary truth direction: **declaration ⊆ code**. Enumerating every export
  // and requiring it in the document inverted that — with 14 modules the check
  // reported several hundred undocumented symbols per run, so it stayed red
  // forever and stopped gate-keeping anything. What the code exports is derived
  // from the code; the document is only accountable for what it claims.
  //
  // Two ownership classes are separated so the warning channel stays actionable:
  // a symbol that exists nowhere in the tree is a phantom (a stale claim), while
  // a symbol owned by a sibling module is a misplaced interface row — real, but
  // not a broken promise about the codebase, so it reports as info.
  try {
    const content = readFileSync(boundaryPath, 'utf8');
    const symbols = collectModuleSymbols(mod.path);
    const elsewhere = collectRepositorySymbols(join(projectRoot, 'src'));
    const phantoms: string[] = [];
    const misplaced: string[] = [];
    for (const name of extractDeclaredSymbols(content)) {
      if (symbols.has(name)) continue;
      (elsewhere.has(name) ? misplaced : phantoms).push(name);
    }

    if (phantoms.length > 0) {
      result.issues.push({
        severity: 'warning',
        module: mod.name,
        message: `BOUNDARY.md 声明的符号在代码中不存在: ${phantoms.sort().join(', ')}`,
      });
    }
    if (misplaced.length > 0) {
      result.issues.push({
        severity: 'info',
        module: mod.name,
        message: `BOUNDARY.md 把兄弟模块的符号列为本模块接口: ${misplaced.sort().join(', ')}`,
      });
    }
  } catch {
    result.issues.push({ severity: 'error', module: mod.name, message: 'Cannot read BOUNDARY.md' });
  }

  return result;
}

function generateBoundarySection(mod: ScannedModule): string {
  return `# BOUNDARY: ${mod.name}/

> Auto-generated by mumuspec sync on ${now().split('T')[0]}

---

## 职责

(Manual update required — 本模块承担什么，以及为什么存在)

## 边界

| 议题 | 处置 |
|------|------|
| 归本模块 | (Manual update required) |
| 不归本模块 | (Manual update required) |

## 依赖声明

(Manual update required)

## 数据契约

(Manual update required)

## 变更日志

| 日期 | 变更 | 原因 |
|------|------|------|
| ${now().split('T')[0]} | Auto-generated by sync | Initial scan |
`;
}

function validateIndexYaml(projectRoot: string, modules: ScannedModule[], _dryRun: boolean): IndexValidationResult {
  const result: IndexValidationResult = { aligned: 0, issues: [] };
  const indexPath = join(projectRoot, '.mumuspec', 'index.yaml');

  if (!existsSync(indexPath)) {
    result.issues.push({ severity: 'error', module: '.', message: 'index.yaml not found' });
    return result;
  }

  try {
    const content = readFileSync(indexPath, 'utf8');
    for (const mod of modules) {
      if (!content.includes(mod.name)) {
        result.issues.push({
          severity: 'warning',
          module: mod.name,
          message: `Module '${mod.name}' not registered in index.yaml`,
        });
      } else {
        result.aligned++;
      }
    }
  } catch {
    result.issues.push({ severity: 'error', module: '.', message: 'Cannot read index.yaml' });
  }

  return result;
}

function recordContractSnapshots(projectRoot: string, modules: ScannedModule[]): void {
  const contractsDir = join(projectRoot, '.mumuspec', 'contracts', 'schemas');
  ensureDir(contractsDir);

  const snapshot = {
    captured_at: now(),
    modules: modules.map((m) => ({
      name: m.name,
      exports: m.exports,
      file_count: m.files.length,
    })),
  };

  const snapshotPath = join(contractsDir, `sync-snapshot-${now().split('T')[0]}.json`);
  try {
    writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  } catch {
    // Non-fatal
  }
}

function detectOldFormatIssues(projectRoot: string, _modules: ScannedModule[]): SyncIssue[] {
  const issues: SyncIssue[] = [];
  const mumuDir = join(projectRoot, '.mumuspec');

  // Old: check for pre-0.16 file names
  const oldFiles = ['spec.yaml', 'design.yaml', 'tech.yaml'];
  for (const oldFile of oldFiles) {
    if (existsSync(join(mumuDir, oldFile))) {
      issues.push({
        severity: 'info',
        module: '.',
        message: `Old-format file detected: ${oldFile} (migrate to .md format)`,
      });
    }
  }

  // Missing mandatory post-0.16 files
  const mandatory = ['design.md', 'spec.md', 'prohibitions.md'];
  for (const m of mandatory) {
    if (!existsSync(join(mumuDir, m))) {
      issues.push({
        severity: 'warning',
        module: '.',
        message: `Missing mandatory file: ${m}`,
      });
    }
  }

  return issues;
}

/**
 * Generate a markdown-formatted sync report for file output.
 */
function generateReportMarkdown(result: SyncResult, projectRoot: string): string {
  const lines: string[] = [];
  lines.push('# MumuSpec Sync Report');
  lines.push('');
  lines.push(`> Generated: ${now()}`);
  lines.push(`> Project: ${projectRoot}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Modules scanned | ${result.modulesScanned} |`);
  lines.push(`| BOUNDARY.md updated | ${result.boundaryUpdated} |`);
  lines.push(`| Index aligned | ${result.indexAligned} |`);
  lines.push('');

  if (result.issues.length > 0) {
    lines.push('## Issues');
    lines.push('');
    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    const infos = result.issues.filter((i) => i.severity === 'info');

    if (errors.length > 0) {
      lines.push(`### Errors (${errors.length})`);
      lines.push('');
      for (const e of errors) {
        lines.push(`- **[${e.module}]** ${e.message}`);
      }
      lines.push('');
    }
    if (warnings.length > 0) {
      lines.push(`### Warnings (${warnings.length})`);
      lines.push('');
      for (const w of warnings) {
        lines.push(`- **[${w.module}]** ${w.message}`);
      }
      lines.push('');
    }
    if (infos.length > 0) {
      lines.push(`### Info (${infos.length})`);
      lines.push('');
      for (const i of infos) {
        lines.push(`- **[${i.module}]** ${i.message}`);
      }
      lines.push('');
    }
  } else {
    lines.push('## Issues');
    lines.push('');
    lines.push('No issues detected. Code state matches persistent spec.');
    lines.push('');
  }

  return lines.join('\n');
}

function printReport(result: SyncResult): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  MumuSpec Sync Report                                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Modules scanned:  ${result.modulesScanned}`);
  console.log(`  BOUNDARY updated: ${result.boundaryUpdated}`);
  console.log(`  Index aligned:    ${result.indexAligned}`);
  console.log('');

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');

  if (errors.length > 0) {
    console.log(`  ✗ ${errors.length} error(s):`);
    for (const e of errors) console.log(`    - [${e.module}] ${e.message}`);
  }
  if (warnings.length > 0) {
    console.log(`  ⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`    - [${w.module}] ${w.message}`);
  }
  if (infos.length > 0) {
    console.log(`  ℹ ${infos.length} info:`);
    for (const i of infos) console.log(`    - [${i.module}] ${i.message}`);
  }
  if (result.issues.length === 0) {
    console.log('  ✓ All checks passed — code and persistence are in sync');
  }
  console.log('');
}
