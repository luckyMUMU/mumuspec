/**
 * Change path utilities — pure path computation for change directories.
 *
 * All functions here are side-effect free (no I/O).
 */
import { join, relative, sep } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { getMumuSpecDir, validateChangeName, resolveWithinRoot } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';

/** Get the changes directory for a given scope.
 *  If scope is "." or undefined, returns root .mumuspec/changes/.
 *  Otherwise returns <scope>/.mumuspec/changes/.
 *  Scope escapes the project root → E-SECURITY-001.
 */
export function getChangesDir(projectRoot: string, scope?: string): string {
  if (!scope || scope === '.') {
    return join(getMumuSpecDir(projectRoot), 'changes');
  }
  return join(resolveWithinRoot(projectRoot, scope), '.mumuspec', 'changes');
}

/** Get the archive directory for a given scope */
export function getArchiveDir(projectRoot: string, scope?: string): string {
  return join(getChangesDir(projectRoot, scope), 'archive');
}

/**
 * Find archived change directory by change name.
 * Searches archive/ directory for entries matching the change name pattern.
 * Returns the full path or undefined if not found.
 */
export function getArchivedChangeDir(projectRoot: string, changeName: string): string | undefined {
  if (!validateChangeName(changeName)) {
    throw new MumuSpecError('E-SECURITY-002', { changeName });
  }
  const archiveDir = join(getMumuSpecDir(projectRoot), 'changes', 'archive');
  if (!existsSync(archiveDir)) return undefined;

  try {
    const entries = readdirSync(archiveDir);
    for (const entry of entries) {
      // Archive entries follow pattern: YYYY-MM-DD-<changeName>
      if (entry === changeName || entry.endsWith(`-${changeName}`)) {
        const fullPath = join(archiveDir, entry);
        if (existsSync(join(fullPath, '.mumuspec.yaml'))) {
          return fullPath;
        }
      }
    }
  } catch {
    // Non-fatal
  }
  return undefined;
}

/** Get a change directory path for a given scope */
export function getChangeDir(projectRoot: string, changeName: string, scope?: string): string {
  if (!validateChangeName(changeName)) {
    throw new MumuSpecError('E-SECURITY-002', { changeName });
  }
  return join(getChangesDir(projectRoot, scope), changeName);
}

/** Get the discarded directory path for a change */
export function getDiscardedDir(projectRoot: string, changeName: string, scope?: string): string {
  if (!validateChangeName(changeName)) {
    throw new MumuSpecError('E-SECURITY-002', { changeName });
  }
  return join(getArchiveDir(projectRoot, scope), 'discarded', changeName);
}

/** Get the .mumuspec.yaml path for a change in a given scope */
export function getChangeStatePath(projectRoot: string, changeName: string, scope?: string): string {
  return join(getChangeDir(projectRoot, changeName, scope), '.mumuspec.yaml');
}

/**
 * Resolve a scope string relative to projectRoot.
 * Used by callers that need an absolute path from a scope.
 * Scope escaping the project root → E-SECURITY-001.
 */
export function scopeToPath(projectRoot: string, scope: string): string {
  return scope === '.' ? projectRoot : resolveWithinRoot(projectRoot, scope);
}

// Re-export for backward compat with any direct importer
export { relative, sep };
