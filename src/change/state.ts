/**
 * Change state persistence — load/save change YAML state files.
 */
import type { ChangeState } from '../core/types.js';
import { readYaml, writeYaml } from '../core/utils.js';
import { getChangeStatePath } from './paths.js';

/** Load a change state */
export function loadChangeState(projectRoot: string, changeName: string, scope?: string): ChangeState | undefined {
  const statePath = getChangeStatePath(projectRoot, changeName, scope);
  return readYaml<ChangeState>(statePath);
}

/** Save a change state */
export function saveChangeState(projectRoot: string, changeName: string, state: ChangeState, scope?: string): void {
  const statePath = getChangeStatePath(projectRoot, changeName, scope);
  writeYaml(statePath, state);
}
