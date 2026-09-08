/**
 * Change state persistence — load/save change YAML state files.
 *
 * Load path migrates legacy/unversioned state to the current schema
 * (in-memory only; the stamped version lands on disk at the next save).
 * Save path always writes the current schema version.
 */
import type { ChangeState } from '../core/types.js';
import { readYaml, writeYaml } from '../core/utils.js';
import { CURRENT_SCHEMA_VERSION } from '../core/schema-version.js';
import { migrateSchema } from '../core/migrations.js';
import { getChangeStatePath } from './paths.js';
import { join } from 'node:path';

/** Load a change state */
export function loadChangeState(projectRoot: string, changeName: string, scope?: string): ChangeState | undefined {
  const statePath = getChangeStatePath(projectRoot, changeName, scope);
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
  const statePath = getChangeStatePath(projectRoot, changeName, scope);
  writeYaml(statePath, { ...state, schema_version: CURRENT_SCHEMA_VERSION.changeState });
}
