import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import type { AuditLogEntry } from './types.js';

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
export function writeYaml(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, dumpYaml(data), 'utf8');
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

/** Write text to a file, creating directories as needed */
export function writeText(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf8');
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

/** List subdirectories that contain .mumuspec/ */
export function findSpecDirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  const results: string[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
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
