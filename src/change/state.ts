/**
 * Change state persistence — load/save change YAML state files.
 *
 * Load path migrates legacy/unversioned state to the current schema
 * (in-memory only; the stamped version lands on disk at the next save).
 * Save path always writes the current schema version.
 */
import type { ChangeState } from '../core/types.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readYaml, writeYaml } from '../core/utils.js';
import { CURRENT_SCHEMA_VERSION } from '../core/schema-version.js';
import { migrateSchema } from '../core/migrations.js';
import { getChangeStatePath, getArchivedChangeDir } from './paths.js';

/**
 * Resolve the authoritative state file path for a change.
 *
 * The active path is derived from the change name, but that derivation stops
 * holding after archiving moves the change directory: writing through it
 * recreates the moved directory and leaves a stale copy behind, while the copy
 * that travels with the change keeps the pre-archive phase. Resolution order:
 * active directory first, archived directory as fallback.
 */
export function resolveChangeStatePath(
  projectRoot: string,
  changeName: string,
  scope?: string,
): string {
  const activePath = getChangeStatePath(projectRoot, changeName, scope);
  if (existsSync(activePath)) return activePath;

  const archivedDir = getArchivedChangeDir(projectRoot, changeName);
  if (archivedDir) {
    const archivedPath = join(archivedDir, '.mumuspec.yaml');
    if (existsSync(archivedPath)) return archivedPath;
  }

  return activePath;
}

/** Load a change state */
export function loadChangeState(projectRoot: string, changeName: string, scope?: string): ChangeState | undefined {
  const statePath = resolveChangeStatePath(projectRoot, changeName, scope);
  const raw = readYaml<ChangeState>(statePath);
  if (!raw) return undefined;
  const result = migrateSchema<ChangeState>('changeState', raw, {
    filePath: statePath,
    backupDir: join(projectRoot, '.mumuspec', 'temp', 'migrations'),
  });
  return result.data;
}

/** Save a change state */
export function saveChangeState(projectRoot: string, changeName: string, state: ChangeState, scope?: string): void {
  const statePath = resolveChangeStatePath(projectRoot, changeName, scope);
  writeStateTo(statePath, state);
}

/**
 * Save a change state into an explicit directory.
 *
 * Used by archiving: the state must travel with the change into the archive
 * directory, not be written back through the name-derived active path that the
 * move just invalidated.
 */
export function saveChangeStateInDir(dirPath: string, state: ChangeState): void {
  writeStateTo(join(dirPath, '.mumuspec.yaml'), state);
}

function writeStateTo(statePath: string, state: ChangeState): void {
  writeYaml(statePath, { ...state, schema_version: CURRENT_SCHEMA_VERSION.changeState });
}
