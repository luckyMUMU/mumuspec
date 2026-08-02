/**
 * Change listing & query — discover and filter changes across scopes.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { ChangeState } from '../core/types.js';
import { readYaml } from '../core/utils.js';
import { getArchiveDir, getChangesDir } from './paths.js';
import { loadChangeState } from './state.js';

/** List active changes in a specific scope only */
function listActiveChangesInScope(projectRoot: string, scope: string): string[] {
  const changesDir = getChangesDir(projectRoot, scope);
  if (!existsSync(changesDir)) return [];

  const results: string[] = [];
  const entries = readdirSync(changesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'archive') {
      if (existsSync(join(changesDir, entry.name, '.mumuspec.yaml'))) {
        const state = readYaml<ChangeState>(join(changesDir, entry.name, '.mumuspec.yaml'));
        if (state && (state.phase === 'discarded' || state.phase === 'archive-completed')) {
          continue;
        }
        results.push(entry.name);
      }
    }
  }
  return results;
}

/** List all active changes (not archived, not in terminal state).
 *  Recursively scans all .mumuspec/changes/ directories for per-scope changes.
 */
export function listActiveChanges(projectRoot: string, scope?: string): string[] {
  if (scope) {
    return listActiveChangesInScope(projectRoot, scope);
  }

  const results: string[] = [];
  const seen = new Set<string>();

  // Root scope
  for (const name of listActiveChangesInScope(projectRoot, '.')) {
    const key = `.::${name}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(name);
    }
  }

  // Recursively find all .mumuspec/changes/ directories
  function scanForChangeDirs(dirPath: string, depth: number) {
    if (depth > 5) return;
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const subDir = join(dirPath, entry.name);
        const changesDir = join(subDir, '.mumuspec', 'changes');
        if (existsSync(changesDir)) {
          const relScope = relative(projectRoot, subDir).split(sep).join('/');
          for (const name of listActiveChangesInScope(projectRoot, relScope)) {
            const key = `${relScope}::${name}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push(name);
            }
          }
        }
        scanForChangeDirs(subDir, depth + 1);
      }
    } catch {
      // Ignore
    }
  }

  scanForChangeDirs(projectRoot, 0);
  return results;
}

/** List archived changes */
export function listArchivedChanges(projectRoot: string, scope?: string): string[] {
  const archiveDir = getArchiveDir(projectRoot, scope);
  if (!existsSync(archiveDir)) return [];

  const results: string[] = [];
  try {
    const entries = readdirSync(archiveDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(entry.name);
      }
    }
  } catch {
    // Ignore
  }
  return results;
}

/** Check if there's an active change (per-scope: only checks the given scope). */
export function getActiveChange(projectRoot: string, scope?: string): string | undefined {
  const active = listActiveChanges(projectRoot, scope);
  if (active.length === 0) return undefined;

  for (const name of active) {
    const state = loadChangeState(projectRoot, name, scope);
    if (state && state.phase !== 'archive-completed' && state.phase !== 'discarded') {
      return name;
    }
  }
  return undefined;
}
