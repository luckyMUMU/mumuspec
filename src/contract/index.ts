/**
 * Contract Layer — barrel export for all contract management modules.
 *
 * Modules:
 * - loader.ts:       Contract registry loading & boundary document parsing
 * - validator.ts:     Contract drift detection & boundary validation
 * - impact-analyzer.ts: Impact analysis for proposed contract changes
 * - manager.ts:       Write-path operations (create/update/delete/scaffold)
 */

export * from './loader.js';
export * from './validator.js';
export * from './impact-analyzer.js';
export * from './manager.js';
