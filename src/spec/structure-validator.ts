/**
 * Structure validator — enforces .mumuspec/ directory and file whitelist.
 *
 * Ensures that only defined directories and files exist under .mumuspec/,
 * preventing ad-hoc creation of undefined artifacts.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { GuardResult } from '../core/types.js';
import { Logger } from '../core/logger.js';
import { findSpecDirs } from '../core/utils.js';

/** Defined top-level directories under .mumuspec/ */
const DEFINED_DIRECTORIES = new Set([
  'changes',
  'knowledge',
  'contracts',
  'feedback',
  'roadmap',
  'adr',
  'designs-archive',
  // Drive-by fix (2026-08-29): `mumuspec init` creates .mumuspec/skills/ and
  // bundle packager consumes it — the whitelist omitted it (E-SPEC-013 false
  // positive on freshly-initialized projects).
  'skills',
  // Drive-by fix (2026-08-29): cognitive-map lookup reads
  // .mumuspec/templates/ (cognitive-map.ts, config custom_dir) — legit dir.
  'templates',
  // doc-governance-decisions (2026-09-06): temp/ is the designated scratch
  // area (root spec.md TEMP-1) — creating it must not trigger E-SPEC-013.
  'temp',
]);

/** Defined top-level files under .mumuspec/ */
const DEFINED_FILES = new Set([
  'config.yaml',
  'spec.md',
  'prd.md',
  'tech.md',
  'design.md',
  'prohibitions.md',
  'goal.md',
  'env-spec.md',
  'glossary.md',
  'index.yaml',
  'audit.log',
  'agents-hash.json',
  'constraints.yaml',
  'cognitive-map.yaml',
  'BOUNDARY.md',
  // CHG-6/7 (2026-09-05): project-level workflow override is a defined root
  // file (activateProjectWorkflow loads it at guard entry) — root spec.md
  // TEMP-4 whitelist already declares it legitimate.
  'workflow.yaml',
]);

/** Defined knowledge subdirectories */
const DEFINED_KNOWLEDGE_DIRS = new Set([
  'decisions',
  'patterns',
  'risks',
  'rationales',
  'lessons',
  'imports',
]);

/** Defined changes subdirectories */
const DEFINED_CHANGES_DIRS = new Set([
  'archive',
  // Drive-by fix (2026-08-29): `mumuspec discard` moves terminated changes to
  // changes/discarded/ — the whitelist omitted the feature's own destination.
  'discarded',
]);

/**
 * Validate .mumuspec/ directory structure across the entire project.
 * Checks every .mumuspec/ directory for undefined entries.
 */
export function validateMumuSpecStructure(projectRoot: string): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  const specDirs = findAllSpecDirs(projectRoot);

  for (const dirPath of specDirs) {
    const mumuDir = join(dirPath, '.mumuspec');
    if (!existsSync(mumuDir)) continue;

    validateSingleMumuSpecDir(mumuDir, dirPath, errors, warnings);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single .mumuspec/ directory for undefined entries.
 */
function validateSingleMumuSpecDir(
  mumuDir: string,
  parentDir: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(mumuDir);
  } catch (e) {
    Logger.debug('structure-validator', 'Failed to read .mumuspec directory', { path: mumuDir, error: (e as Error).message });
    return;
  }

  for (const entry of entries) {
    const entryPath = join(mumuDir, entry);
    let isDir = false;
    try {
      isDir = statSync(entryPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      // Check if directory is defined
      if (!DEFINED_DIRECTORIES.has(entry)) {
        errors.push({
          code: 'E-SPEC-013',
          message: `.mumuspec/ 下存在未定义的目录: "${entry}/"`,
          detail: entryPath,
        });
        continue;
      }

      // Validate knowledge subdirectories
      if (entry === 'knowledge') {
        validateKnowledgeSubdirs(entryPath, parentDir, errors, warnings);
      }

      // Validate changes subdirectories — active changes have dynamic names, only check 'archive'
      if (entry === 'changes') {
        validateChangesSubdirs(entryPath, parentDir, errors, warnings);
      }
    } else {
      // Check if file is defined
      if (!DEFINED_FILES.has(entry)) {
        errors.push({
          code: 'E-SPEC-014',
          message: `.mumuspec/ 下存在未定义的文件: "${entry}"`,
          detail: entryPath,
        });
      }
    }
  }
}

/**
 * Validate knowledge/ subdirectories — only defined type dirs and index files allowed.
 */
function validateKnowledgeSubdirs(
  knowledgeDir: string,
  _parentDir: string,
  errors: { code: string; message: string; detail?: string }[],
  _warnings: { code: string; message: string; detail?: string }[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(knowledgeDir);
  } catch {
    return;
  }

  const DEFINED_KNOWLEDGE_FILES = new Set([
    '_index.yaml',
    '_reverse-index.yaml',
    '_memory.yaml',
  ]);

  for (const entry of entries) {
    const entryPath = join(knowledgeDir, entry);
    let isDir = false;
    try {
      isDir = statSync(entryPath).isDirectory();
    } catch {
      continue;
    }

    if (isDir) {
      if (!DEFINED_KNOWLEDGE_DIRS.has(entry)) {
        errors.push({
          code: 'E-SPEC-013',
          message: `knowledge/ 下存在未定义的子目录: "${entry}/" (合法目录: ${[...DEFINED_KNOWLEDGE_DIRS].join(', ')})`,
          detail: entryPath,
        });
      }
    } else {
      if (!DEFINED_KNOWLEDGE_FILES.has(entry)) {
        errors.push({
          code: 'E-SPEC-014',
          message: `knowledge/ 下存在未定义的文件: "${entry}" (合法文件: ${[...DEFINED_KNOWLEDGE_FILES].join(', ')})`,
          detail: entryPath,
        });
      }
    }
  }
}

/**
 * Validate changes/ subdirectories — only 'archive' and active change dirs allowed.
 * Active change dirs are dynamic (named after the change), so we only flag
 * directories that are neither 'archive' nor valid change names (have .mumuspec.yaml).
 */
function validateChangesSubdirs(
  changesDir: string,
  _parentDir: string,
  errors: { code: string; message: string; detail?: string }[],
  _warnings: { code: string; message: string; detail?: string }[],
): void {
  let entries: string[];
  try {
    entries = readdirSync(changesDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = join(changesDir, entry);
    let isDir = false;
    try {
      isDir = statSync(entryPath).isDirectory();
    } catch {
      continue;
    }

    if (!isDir) continue;

    // 'archive' is a defined subdirectory
    if (DEFINED_CHANGES_DIRS.has(entry)) continue;

    // Active change dirs must contain .mumuspec.yaml
    const statePath = join(entryPath, '.mumuspec.yaml');
    if (!existsSync(statePath)) {
      errors.push({
        code: 'E-SPEC-013',
        message: `changes/ 下存在无效的目录: "${entry}/" (缺少 .mumuspec.yaml，非活跃变更)`,
        detail: entryPath,
      });
    }
  }
}

/** Find all directories with .mumuspec/ (shared core walker + root check) */
function findAllSpecDirs(projectRoot: string): string[] {
  const results = findSpecDirs(projectRoot);
  if (existsSync(join(projectRoot, '.mumuspec'))) results.unshift(projectRoot);
  return results;
}
