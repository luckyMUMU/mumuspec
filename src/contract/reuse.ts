/**
 * Contract import planning (core-consolidation L4, R-0018).
 *
 * Importing a contract keeps the registry's own shape and audit path — no second
 * persistence form is introduced. The imported copy records where it came from,
 * so drift and compatibility checks against the upstream keep working.
 *
 * Pure planning; the caller performs I/O through the existing manager.
 */

import type { Contract, ContractRegistry } from '../core/types-contract.js';

import { REGISTRY_FILE } from './constants.js';

export interface ContractImportPlan {
  fromScope: string;
  items: Contract[];
  /** Requested ids that the source scope does not declare. */
  missing: string[];
  available: string[];
}

export function planContractImport(
  registry: ContractRegistry,
  opts: { fromScope: string; id?: string },
): ContractImportPlan {
  const sourcePath =
    opts.fromScope === '.'
      ? `.mumuspec/contracts/${REGISTRY_FILE}`
      : `${opts.fromScope}/.mumuspec/contracts/${REGISTRY_FILE}`;

  const all = registry.contracts ?? [];
  const available = all.map((c) => c.id);

  if (opts.id) {
    const hits = all.filter((c) => c.id === opts.id);
    return {
      fromScope: opts.fromScope,
      items: hits.map((c) => ({ ...c, source: `${sourcePath}#${c.id}` })),
      missing: hits.length === 0 ? [opts.id] : [],
      available,
    };
  }

  return {
    fromScope: opts.fromScope,
    items: all.map((c) => ({ ...c, source: `${sourcePath}#${c.id}` })),
    missing: [],
    available,
  };
}
