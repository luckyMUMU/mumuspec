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

/** Read and parse a YAML file */
export function readYaml<T = unknown>(filePath: string): T | undefined {
  if (!existsSync(filePath)) return undefined;
  const content = readFileSync(filePath, 'utf8');
  return parse(content) as T;
}

/** Write an object as YAML to a file */
export function writeYaml(filePath: string, data: unknown): void {
  ensureDir(dirname(filePath));
  const content = stringify(data, { indent: 2, lineWidth: 120 });
  writeFileSync(filePath, content, 'utf8');
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
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
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
