/**
 * Meta-Evolution module — barrel re-export (R-0005).
 *
 * Provides:
 * - Effectiveness scoring engine
 * - Statistics persistence
 * - Knowledge layer evolution (R0)
 * - Skill recommendation (R1)
 */

export * from './types.js';
export * from './scoring.js';
export * from './knowledge-evolution.js';
export * from './skill-recommender.js';

// stats.ts uses async/await for file I/O — export individually
export { getStatsFilePath, resolveEvolutionRoot, recordCheck, readCheckRecords, rotateStatsIfNeeded, clearStats } from './stats.js';
