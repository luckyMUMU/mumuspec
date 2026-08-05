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
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, ensureDir, now } from '../../core/utils.js';

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
    .option('--module <name>', 'sync only a specific module')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const result = executeSync(root, options);

      printReport(result);

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
  options: { check?: boolean; migrate?: boolean; module?: string },
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
    const hasBoundary = existsSync(join(modPath, 'BOUNDARY.md'));
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
  const exportPattern = /export\s+(?:function|class|interface|type|const|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/g;

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

function syncModuleBoundary(_projectRoot: string, mod: ScannedModule, dryRun: boolean): ModuleSyncResult {
  const result: ModuleSyncResult = { updated: false, issues: [] };
  const boundaryPath = join(mod.path, 'BOUNDARY.md');

  if (!mod.hasBoundary) {
    result.issues.push({
      severity: 'warning',
      module: mod.name,
      message: `Missing BOUNDARY.md — should be created`,
    });
    if (!dryRun) {
      const content = generateBoundarySection(mod);
      writeFileSync(boundaryPath, content);
      result.updated = true;
    }
    return result;
  }

  // Validate existing BOUNDARY.md exports against actual code
  try {
    const content = readFileSync(boundaryPath, 'utf8');
    const missingExports = mod.exports.filter((exp) => !content.includes(exp));

    if (missingExports.length > 0) {
      result.issues.push({
        severity: 'warning',
        module: mod.name,
        message: `BOUNDARY.md missing exports: ${missingExports.join(', ')}`,
      });
    }
  } catch {
    result.issues.push({ severity: 'error', module: mod.name, message: 'Cannot read BOUNDARY.md' });
  }

  return result;
}

function generateBoundarySection(mod: ScannedModule): string {
  const exportRows = mod.exports.map((e) => `| \`${e}\` | (description pending) |`).join('\n');
  return `# BOUNDARY: ${mod.name}/

> Auto-generated by mumuspec sync on ${now().split('T')[0]}

---

## 对外接口

| 接口 | 类型 | 说明 |
|------|------|------|
${exportRows}

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
