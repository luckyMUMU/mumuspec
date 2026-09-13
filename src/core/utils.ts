import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync, realpathSync, renameSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname, basename, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import type { AuditLogEntry } from './types.js';
import { MumuSpecError } from './errors.js';

export { existsSync, readdirSync, statSync };

/** Compute SHA-256 hash of content */
export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
}

/** Maximum allowed YAML file size (10 MB) — P0-8 Fix: prevents OOM from malicious specs */
const MAX_YAML_FILE_SIZE = 10 * 1024 * 1024;

/** Read and parse a YAML file */
export function readYaml<T = unknown>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined;
  // P0-8 Fix: Read file and check size to prevent OOM
  const content = readFileSync(filePath, 'utf8');
  if (content.length > MAX_YAML_FILE_SIZE) {
    throw new Error(`YAML file too large: ${filePath} (${content.length} bytes, max ${MAX_YAML_FILE_SIZE})`);
  }
  // P0-8 Fix: Use safe parse options to prevent YAML bomb attacks
  return parse(content, { maxAliasCount: 100 }) as T;
}

/** Write an object as YAML to a file */
/**
 * Atomic write: temp file + rename within the same directory (same volume,
 * so rename is atomic). Temp names are pid-suffixed to avoid cross-process
 * collisions; the temp file is cleaned up if the write or rename fails.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  try {
    writeFileSync(tmpPath, content, 'utf8');
    renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

export function writeYaml(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  atomicWrite(filePath, dumpYaml(data));
}

/** Serialize an object to a YAML string */
export function dumpYaml(data: unknown): string {
  return stringify(data, { indent: 2, lineWidth: 120 });
}

/** Read a text file */
export function readText(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  return readFileSync(filePath, 'utf8');
}

/** Write text to a file atomically, creating directories as needed */
export function writeText(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  atomicWrite(filePath, content);
}

/** Move a file from source to destination, creating directories as needed */
export function moveFile(srcPath: string, destPath: string): void {
  ensureDir(dirname(destPath));
  const { renameSync } = require('node:fs');
  renameSync(srcPath, destPath);
}

/** Ensure a directory exists */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/** Check if a path is within the project root */
export function isPathSafe(inputPath: string, projectRoot: string): boolean {
  const resolved = resolve(projectRoot, inputPath);
  const rel = relative(projectRoot, resolved);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Resolve a user-controlled path strictly within projectRoot.
 * Defends against three escape vectors:
 *  1. `..` traversal (lexical containment via resolve + relative)
 *  2. Absolute paths outside root
 *  3. Symlink/junction escapes (realpath of the nearest existing ancestor)
 * Throws E-SECURITY-001 on any escape; returns the resolved absolute path.
 */
export function resolveWithinRoot(root: string, userPath: string): string {
  if (typeof userPath !== 'string' || !userPath.trim()) {
    throw new MumuSpecError('E-SECURITY-001', { path: String(userPath) });
  }
  const resolved = resolve(root, userPath);
  if (!isPathSafe(resolved, root)) {
    throw new MumuSpecError('E-SECURITY-001', { path: userPath });
  }
  // Symlink containment: resolve the real path of the nearest existing
  // ancestor (the full path may not exist yet for to-be-created scopes).
  let probe = resolved;
  const suffix: string[] = [];
  while (probe !== dirname(probe) && !existsSync(probe)) {
    suffix.unshift(basename(probe));
    probe = dirname(probe);
  }
  let realProbe: string;
  try {
    realProbe = realpathSync(probe);
  } catch {
    // Probe vanished or is unreadable — fall back to the lexical path;
    // lexical containment has already passed at this point.
    realProbe = probe;
  }
  const realTarget = suffix.length ? join(realProbe, ...suffix) : realProbe;
  if (!isPathSafe(realTarget, root)) {
    throw new MumuSpecError('E-SECURITY-001', { path: userPath });
  }
  return resolved;
}

/** Get the .mumuspec directory path */
export function getMumuSpecDir(projectRoot: string): string {
  return join(projectRoot, '.mumuspec');
}

/** Find the project root by searching for .mumuspec directory */
export function findProjectRoot(startPath: string = process.cwd()): string | undefined {
  let current = resolve(startPath);
  while (current !== dirname(current)) {
    if (existsSync(join(current, '.mumuspec'))) {
      return current;
    }
    current = dirname(current);
  }
  // Check the start path itself
  if (existsSync(join(startPath, '.mumuspec'))) {
    return resolve(startPath);
  }
  return undefined;
}

/** Get current ISO timestamp */
export function now(): string {
  return new Date().toISOString();
}

/**
 * W3 (CHG 2026-09-09-review-followup-hardening): the single module-registration
 * predicate. A directory counts as a registered spec module iff it contains a
 * `.mumuspec` directory holding a prd.md OR a tech.md.
 * Consumers: guard/checker.ts (index_drift detection) and
 * cli/commands/finalize-archive.ts (rebuildIndexYaml) — both must use THIS
 * function; do not re-implement the criterion locally.
 */
export function isRegisteredSpecModule(dirPath: string): boolean {
  const mumuDir = join(dirPath, '.mumuspec');
  if (!existsSync(mumuDir)) return false;
  return existsSync(join(mumuDir, 'prd.md')) || existsSync(join(mumuDir, 'tech.md'));
}

/** Append to audit log (JSONL format) */
export function appendAuditLog(
  mumuSpecDir: string,
  entry: Omit<AuditLogEntry, 'ts'>,
): void {
  const logPath = join(mumuSpecDir, 'audit.log');
  const fullEntry: AuditLogEntry = { ts: now(), ...entry } as AuditLogEntry;
  const line = JSON.stringify(fullEntry) + '\n';
  ensureDir(mumuSpecDir);
  appendFileSync(logPath, line, 'utf8');
}

/** Parse YAML frontmatter from markdown content */
export function parseFrontmatter<T = Record<string, unknown>>(
  content: string,
): { frontmatter: T | undefined; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: undefined, body: content };
  }
  const frontmatter = parse(match[1]) as T;
  const body = match[2];
  return { frontmatter, body };
}

/** Create YAML frontmatter string */
export function createFrontmatter(data: Record<string, unknown>): string {
  const yamlStr = stringify(data, { indent: 2, lineWidth: 120 }).trim();
  return `---\n${yamlStr}\n---\n`;
}

/** Normalize a path to use forward slashes */
export function normalizePath(p: string): string {
  return p.split(sep).join('/');
}

/** Validate change name — ponytail: 单行正则，覆盖路径穿越风险 */
export function validateChangeName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

/** Get the layer number for a directory relative to project root */
export function getLayerLevel(dirPath: string, projectRoot: string): number {
  const rel = relative(projectRoot, dirPath);
  if (!rel || rel === '.') return 0;
  return rel.split(sep).filter(Boolean).length;
}

/**
 * Canonical noise-directory skip set for all tree walkers.
 * Union of every previously duplicated local SKIP_DIRS
 * (constraints-loader / graph-builder / glossary-checker / trace /
 * code-scanner / ponytail-linter). Shared via Phase 3.4.
 */
export const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'target',
  'tmp',
  'temp',
  'coverage',
  '__pycache__',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.vercel',
  '.mumuspec',
  '.workbuddy',
  '.omo',
  '.meituan-catpaw',
]);

/** List subdirectories that contain .mumuspec/ */
export function findSpecDirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  const results: string[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      // legacy-cleanup-fix：对齐共享 SKIP_DIRS 集合（temp/dist 等非规范目录
      // 下的 .mumuspec 不计入扫描面），消灭与 code-scanner 等的独立排除实现。
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        const childPath = join(dirPath, entry.name);
        if (existsSync(join(childPath, '.mumuspec'))) {
          results.push(childPath);
        }
        // Recurse into subdirectories
        results.push(...findSpecDirs(childPath));
      }
    }
  } catch {
    // Ignore permission errors
  }

  return results;
}
