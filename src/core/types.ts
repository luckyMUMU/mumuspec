/**
 * Core type definitions — barrel re-export hub.
 * Sub-modules organized by domain:
 * - types-constraint: constraint strength, tree resolution, evaluation
 * - types-spec: spec/prd/tech/design/prohibitions parsed artifacts
 * - types-workflow: change lifecycle, state machine, guards, drift
 * - types-knowledge: knowledge pages, cognitive maps, page indices, feedback
 * - types-analysis: impact analysis, coverage, chat, dashboard, MCP, audit
 * - types-env: environment detection and tool spec
 * - types-contract: contract registry, boundary docs, drift detection
 *
 * All imports from this file remain fully backward compatible.
 */

export * from './types-constraint.js';
export * from './types-spec.js';
export * from './types-workflow.js';
export * from './types-knowledge.js';
export * from './types-analysis.js';
export * from './types-env.js';
export * from './types-contract.js';
export * from './types-team.js';
