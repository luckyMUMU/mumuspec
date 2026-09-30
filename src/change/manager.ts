/**
 * Change Manager — public API hub.
 *
 * This module re-exports all change management functions from focused submodules:
 * - paths.ts     — path computation (pure, no I/O)
 * - state.ts     — YAML state load/save
 * - listing.ts   — discover and query changes
 * - lifecycle.ts — create, discard, escalate, snapshot, build-layers, test-cases
 * - archive.ts   — archive, version-bump, delta-merge, knowledge-extract
 * - decisions.ts — decisions log, status summary, feedback
 *
 * Import paths are preserved for backward compatibility.
 */

// ── Path utilities ──
export {
  getChangesDir,
  getArchiveDir,
  getArchivedChangeDir,
  getChangeDir,
  getChangeStatePath,
} from './paths.js';

// ── State persistence ──
export {
  loadChangeState,
  saveChangeState,
} from './state.js';

// ── Listing & querying ──
export {
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
} from './listing.js';

// ── Lifecycle operations ──
export {
  createChange,
  discardChange,
  escalateChange,
  saveSnapshot,
  validateScope,
  initTestCases,
  lockTestCases,
  verifyTestCases,
  computeTestCasesHash,
  initBuildLayers,
  updateBuildLayerStatus,
  getBuildLayerView,
  buildLayerView,
  lockTestSuite,
  getNextTask,
  ensureWorktreeIsolation,
} from './lifecycle.js';

export type { BuildLayerView } from './lifecycle.js';

// ── Design-build orthogonality (I3) — parallel group planning ──
export { planParallelGroups } from './parallel-planner.js';
export type { ParallelPlan, ScopeCoupling } from './parallel-planner.js';

// ── Archive sub-processes ──
export {
  archiveChange,
  bumpVersionForArchive,
  mergeDeltaSpecsToMain,
  extractKnowledgeToGlobal,
} from './archive.js';

// ── Decisions & status ──
export {
  appendDecision,
  getChangeStatusSummary,
  appendFeedbackToChange,
  getChangeFeedbacks,
} from './decisions.js';
