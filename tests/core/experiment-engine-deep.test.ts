/**
 * Deep coverage tests for experiment-engine.ts.
 *
 * Strategy: Use REAL filesystem for state persistence (readYaml, writeYaml, etc.)
 * and mock ONLY execSync (git) and runAllEvals (eval runner).
 * This avoids existsSync/mock readYaml mismatch issues.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Mock execSync (git) ────────────────────────────────────────────
const execSyncImpl = vi.fn(() => 'mock-output');
vi.mock('node:child_process', () => ({
  execSync: (cmd: string, _opts?: unknown) => execSyncImpl(cmd),
}));

// ── Mock eval runner ───────────────────────────────────────────────
const runAllEvalsImpl = vi.fn(() => ({
  total: 10,
  passed: 8,
  failed: 2,
  duration: 120,
  results: [],
}));

vi.mock('../../src/eval/runner.js', () => ({
  runAllEvals: (...args: unknown[]) => runAllEvalsImpl(...args),
}));

// ── Import after mocks ─────────────────────────────────────────────
import {
  generateDirections,
  initExperiment,
  compareArms,
  selectDirections,
  adoptImprovements,
  getExperimentStatus,
  listExperiments,
  cleanupExperiment,
  transitionPhase,
  loadExperimentState,
} from '../../src/core/experiment-engine.js';
import type {
  ExperimentConfig,
  ExperimentState,
  ExperimentDirection,
  ExperimentArm,
} from '../../src/core/types-experiment.js';

// ── Helpers ─────────────────────────────────────────────────────────

let testCounter = 0;
function freshRoot(): string {
  const id = `mumuspec-exp-deep-${Date.now()}-${testCounter++}`;
  const root = join(tmpdir(), id);
  mkdirSync(root, { recursive: true });
  return root;
}

function makeState(overrides: Partial<ExperimentState> = {}): ExperimentState {
  return {
    name: 'exp-test',
    goal: 'test goal',
    enabled: true,
    phase: 'init',
    maxMetaRounds: 2,
    currentMetaRound: 0,
    directionCount: 2,
    demoChangeName: 'demo-change',
    demoProjectPath: '/tmp/demo',
    directions: [],
    arms: [],
    comparison: null,
    selectedDirections: [],
    mergedBack: false,
    originalBranch: 'main',
    baseCommit: 'abc123',
    createdAt: '2025-01-01T00:00:00.000Z',
    notes: [],
    ...overrides,
  };
}

function makeArm(overrides: Partial<ExperimentArm> = {}): ExperimentArm {
  return {
    id: 'arm-dir-1',
    directionId: 'dir-1',
    worktreePath: '/tmp/wt',
    branch: 'experiment/exp-test/dir-1',
    status: 'pending',
    startedAt: undefined,
    completedAt: undefined,
    metrics: undefined,
    error: undefined,
    ...overrides,
  };
}

/** Write an experiment state to disk so loadExperimentState finds it. */
function saveState(root: string, state: ExperimentState): void {
  const dir = join(root, '.mumuspec', 'experiments', state.name);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'experiment.yaml');
  // Simple YAML serialization matching the project's yaml format
  const { stringify } = require('yaml') as { stringify: (d: unknown) => string };
  writeFileSync(filePath, stringify(state), 'utf8');
}

function makeDir(id: string, category: ExperimentDirection['category'], name?: string): ExperimentDirection {
  return {
    id,
    name: name ?? id,
    description: '',
    category,
    riskLevel: 1,
    affectedFiles: [],
    changeSummary: '',
    expectedBenefit: '',
    adopted: false,
  };
}

afterAll(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// generateDirections — autoGen path
// ════════════════════════════════════════════════════════════════════

describe('generateDirections — autoGen branching', () => {
  it('returns empty when src dir does not exist', () => {
    const root = freshRoot();
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    // With no src/, analyzeSourceModules→[], countSourceFiles→0, avgFileSize→0.
    // No perf dir (avg<=300), no cli module, but robustness + test + feature
    // directions are always pushed.
    expect(Array.isArray(dirs)).toBe(true);
    expect(dirs.length).toBeGreaterThan(0);
  });

  it('filters by focusCategories', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
      focusCategories: ['robustness'],
    };
    const dirs = generateDirections(root, config);
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) {
      expect(d.category).toBe('robustness');
    }
  });

  it('respects directionCount limit', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
    const config: ExperimentConfig = {
      directionCount: 1,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.length).toBeLessThanOrEqual(1);
  });

  it('does NOT add perf direction when avgFileSize <= 300', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'small.ts'), 'export const x = 1;\n');
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.some((d) => d.category === 'performance')).toBe(false);
  });

  it('adds perf direction when avgFileSize > 300', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    let big = '';
    for (let i = 0; i < 400; i++) big += `export const f${i} = ${i};\n`;
    writeFileSync(join(root, 'src', 'big.ts'), big);
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.some((d) => d.category === 'performance')).toBe(true);
  });

  it('does NOT add CLI UX direction when no cli module', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.some((d) => d.category === 'usability')).toBe(false);
  });

  it('adds CLI UX direction when cli module exists', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src', 'cli'), { recursive: true });
    writeFileSync(join(root, 'src', 'cli', 'main.ts'), 'export {};\n');
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.some((d) => d.category === 'usability')).toBe(true);
  });

  it('finds files with error handling patterns', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'src', 'core', 'handler.ts'),
      'export function h() { throw new Error("fail"); }\n'
    );
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const robustDir = dirs.find((d) => d.category === 'robustness');
    expect(robustDir).toBeDefined();
  });

  it('findTestFilesWithPatterns returns paths from tests dir', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'tests', 'a.test.ts'), 'import { vi } from "vitest";\n');
    writeFileSync(join(root, 'tests', 'b.test.ts'), 'import { vi } from "vitest";\n');
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const maintDir = dirs.find((d) => d.category === 'maintainability');
    expect(maintDir).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// generateDirections — manual
// ════════════════════════════════════════════════════════════════════

describe('generateDirections — manual paths', () => {
  const baseConfig: ExperimentConfig = {
    directionCount: 5,
    maxMetaRounds: 2,
    demoChangeName: 'd',
    demoProjectPath: '/tmp/d',
    autoGenerate: false,
    manualDirections: [],
  };

  it('uses provided manualDirections verbatim for each field', () => {
    const config: ExperimentConfig = {
      ...baseConfig,
      manualDirections: [
        {
          id: 'custom-1',
          name: 'My Direction',
          description: 'Desc',
          category: 'security',
          riskLevel: 4,
          affectedFiles: ['src/x.ts'],
          changeSummary: 'CS',
          expectedBenefit: 'EB',
        },
      ],
    };
    const dirs = generateDirections('/tmp/nonexistent', config);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].id).toBe('custom-1');
    expect(dirs[0].name).toBe('My Direction');
    expect(dirs[0].adopted).toBe(false);
  });

  it('fills defaults for missing fields in manual entries', () => {
    const config: ExperimentConfig = {
      ...baseConfig,
      manualDirections: [{ id: 'manual-1' }],
    };
    const dirs = generateDirections('/tmp/nonexistent', config);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].name).toBe('Direction 1');
    expect(dirs[0].description).toBe('');
    expect(dirs[0].category).toBe('performance');
    expect(dirs[0].riskLevel).toBe(2);
    expect(dirs[0].affectedFiles).toEqual([]);
  });

  it('generates sequential IDs when not provided', () => {
    const config: ExperimentConfig = {
      ...baseConfig,
      manualDirections: [{}, {}, {}],
    };
    const dirs = generateDirections('/tmp/nonexistent', config);
    expect(dirs[0].id).toBe('dir-1');
    expect(dirs[1].id).toBe('dir-2');
    expect(dirs[2].id).toBe('dir-3');
  });
});

// ════════════════════════════════════════════════════════════════════
// initExperiment — real dir + mocked git
// ════════════════════════════════════════════════════════════════════

describe('initExperiment', () => {
  it('creates state with git branch and commit info', () => {
    const root = freshRoot();
    execSyncImpl.mockReset();
    execSyncImpl.mockReturnValueOnce('main\n');       // git branch --show-current
    execSyncImpl.mockReturnValueOnce('deadbeef\n');    // git rev-parse HEAD

    const state = initExperiment(root, {
      name: 'exp-1',
      goal: 'improve coverage',
      config: {
        directionCount: 3,
        maxMetaRounds: 2,
        demoChangeName: 'demo',
        demoProjectPath: '/tmp/demo',
        autoGenerate: true,
      },
    });

    expect(state.name).toBe('exp-1');
    expect(state.goal).toBe('improve coverage');
    expect(state.enabled).toBe(true);
    expect(state.phase).toBe('init');
    expect(state.maxMetaRounds).toBe(2);
    expect(state.originalBranch).toBe('main');
    expect(state.baseCommit).toBe('deadbeef');
  });

  it('uses default maxMetaRounds when config omits it', () => {
    const root = freshRoot();
    execSyncImpl.mockReset();
    execSyncImpl.mockReturnValueOnce('main\n');
    execSyncImpl.mockReturnValueOnce('abc123\n');

    const state = initExperiment(root, {
      name: 'exp-default',
      goal: 'test',
      config: {
        directionCount: 1,
        maxMetaRounds: undefined as unknown as number,
        demoChangeName: 'demo',
        demoProjectPath: '/tmp/demo',
        autoGenerate: false,
        manualDirections: [{ id: 'd1' }],
      },
    });

    // DEFAULT_META_ROUNDS = 2
    expect(state.maxMetaRounds).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// loadExperimentState & getExperimentStatus (real disk)
// ════════════════════════════════════════════════════════════════════

describe('state management', () => {
  it('loadExperimentState returns null when file does not exist', () => {
    const result = loadExperimentState('/tmp/does-not-exist-xyz', 'nope');
    expect(result).toBeNull();
  });

  it('loadExperimentState returns state when file exists', () => {
    const root = freshRoot();
    const state = makeState();
    saveState(root, state);

    const loaded = loadExperimentState(root, 'exp-test');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('exp-test');
    expect(loaded!.goal).toBe('test goal');
  });

  it('getExperimentStatus returns null for missing experiment', () => {
    const result = getExperimentStatus('/tmp/missing-xyz', 'nope');
    expect(result).toBeNull();
  });

  it('getExperimentStatus returns null when disabled', () => {
    const root = freshRoot();
    const state = makeState({ enabled: false });
    saveState(root, state);

    const result = getExperimentStatus(root, 'exp-test');
    expect(result).toBeNull();
  });

  it('getExperimentStatus computes arm counts correctly', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
      arms: [
        makeArm({ id: 'arm-a', status: 'completed' }),
        makeArm({ id: 'arm-b', status: 'failed' }),
        makeArm({ id: 'arm-c', status: 'pending' }),
      ],
    });
    saveState(root, state);

    const summary = getExperimentStatus(root, 'exp-test');
    expect(summary).not.toBeNull();
    expect(summary!.name).toBe('exp-test');
    expect(summary!.armsTotal).toBe(3);
    expect(summary!.armsCompleted).toBe(1);
    expect(summary!.armsFailed).toBe(1);
    expect(summary!.directionCount).toBe(1);
    expect(summary!.comparisonReady).toBe(false);
    expect(summary!.selectedCount).toBe(0);
    expect(summary!.mergedBack).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// listExperiments (real disk)
// ════════════════════════════════════════════════════════════════════

describe('listExperiments', () => {
  it('returns empty array when experiments dir does not exist', () => {
    const result = listExperiments('/tmp/no-such-dir-xyz-123');
    expect(result).toEqual([]);
  });

  it('returns summaries for each experiment directory', () => {
    const root = freshRoot();
    const expDir = join(root, '.mumuspec', 'experiments');
    mkdirSync(expDir, { recursive: true });
    mkdirSync(join(expDir, 'exp-one'), { recursive: true });
    mkdirSync(join(expDir, 'exp-two'), { recursive: true });

    // Save actual state files so loadExperimentState finds them
    saveState(root, makeState({ name: 'exp-one', goal: 'goal-1' }));
    saveState(root, makeState({ name: 'exp-two', goal: 'goal-2' }));

    const results = listExperiments(root);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name).sort();
    expect(names).toEqual(['exp-one', 'exp-two']);
  });
});

// ════════════════════════════════════════════════════════════════════
// selectDirections (real disk)
// ════════════════════════════════════════════════════════════════════

describe('selectDirections', () => {
  it('marks selected directions as adopted', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [
        makeDir('dir-1', 'performance'),
        makeDir('dir-2', 'robustness'),
      ],
    });
    saveState(root, state);

    const updated = selectDirections(root, 'exp-test', ['dir-1']);

    expect(updated.selectedDirections).toEqual(['dir-1']);
    expect(updated.directions[0].adopted).toBe(true);
    expect(updated.directions[1].adopted).toBe(false);
    expect(updated.directions[1].rejectionReason).toBe('Not selected in comparison phase');
    expect(updated.notes.length).toBeGreaterThan(0);

    // Verify persistence
    const reloaded = loadExperimentState(root, 'exp-test');
    expect(reloaded!.selectedDirections).toEqual(['dir-1']);
  });

  it('handles empty selection (all rejected)', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const updated = selectDirections(root, 'exp-test', []);

    expect(updated.selectedDirections).toEqual([]);
    expect(updated.directions[0].adopted).toBe(false);
    expect(updated.directions[0].rejectionReason).toBeDefined();
  });

  it('throws when experiment not found', () => {
    expect(() => selectDirections('/tmp/missing', 'nope', ['dir-1'])).toThrow('Experiment not found');
  });
});

// ════════════════════════════════════════════════════════════════════
// compareArms (real disk)
// ════════════════════════════════════════════════════════════════════

describe('compareArms', () => {
  it('throws when experiment not found', () => {
    expect(() => compareArms('/tmp/missing', 'nope')).toThrow('Experiment not found');
  });

  it('ranks completed arms by composite score (desc)', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:05.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 9, failedScenarios: 1, successRate: 0.9, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 0.9, performanceScore: 0.95, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
        makeArm({
          id: 'arm-b',
          directionId: 'dir-2',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:01:00.000Z',  // 60s = slow
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 5, failedScenarios: 5, successRate: 0.5, totalErrors: 0, totalWarnings: 0, durationMs: 50000 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 3, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.5, performanceScore: 0.0, robustnessScore: 0.6,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
        makeArm({ id: 'arm-c', directionId: 'dir-3', status: 'failed' }),
      ],
      directions: [
        makeDir('dir-1', 'performance', 'Fast Dir'),
        makeDir('dir-2', 'robustness', 'Slow Dir'),
        makeDir('dir-3', 'feature', 'Fail Dir'),
      ],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');

    expect(comp.totalArms).toBe(3);
    expect(comp.successfulArms).toBe(2);
    expect(comp.failedArms).toBe(1);
    expect(comp.rankings).toHaveLength(2);
    expect(comp.rankings[0].rank).toBe(1);
    expect(comp.rankings[0].armId).toBe('arm-a');
    expect(comp.rankings[1].rank).toBe(2);
    // arm-a strengths: high eval, fast, clean, near-complete
    expect(comp.rankings[0].strengths.length).toBeGreaterThan(0);
    // arm-b weaknesses: slow performance triggers at least one weakness
    expect(comp.rankings[1].weaknesses.length).toBeGreaterThan(0);
    // Performance variance >0.3 triggers performance insight
    const perfInsight = comp.insights.find((i) => i.category === 'performance');
    expect(perfInsight).toBeDefined();
  });

  it('handles no completed arms', () => {
    const root = freshRoot();
    const state = makeState({
      arms: [makeArm({ id: 'arm-a', status: 'failed' })],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');

    expect(comp.rankings).toEqual([]);
    expect(comp.insights).toEqual([]);
    expect(comp.successfulArms).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// scoring edge cases (real disk)
// ════════════════════════════════════════════════════════════════════

describe('scoring edge cases', () => {
  it('arm with no timestamps yields zero performance score', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: undefined,
          completedAt: undefined,
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 8, failedScenarios: 2, successRate: 0.8, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 4, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 0.8, performanceScore: 0.0, robustnessScore: 0.8,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    // 0.8*0.35 + 0*0.35 + 0.8*0.30 = 0.28 + 0 + 0.24 = 0.52 → 52
    expect(comp.rankings).toHaveLength(1);
    expect(comp.rankings[0].compositeScore).toBe(52);
  });

  it('composite score: quality 0.5 + perf 1.0 + robust 0.0 = 52', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 0, passedScenarios: 0, failedScenarios: 0, successRate: 0, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: false, phasesCompleted: 0, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.5, performanceScore: 1.0, robustnessScore: 0.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    // 0.5*0.35 + 1.0*0.35 + 0.0*0.30 = 0.175 + 0.35 + 0 = 0.525 → Math.round(52.5)=52
    expect(comp.rankings[0].compositeScore).toBe(52);
  });

  it('composite score: quality 1.0 + perf 1.0 + robust 0.0 = 70', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 10, failedScenarios: 0, successRate: 1.0, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: false, phasesCompleted: 0, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 1.0, performanceScore: 1.0, robustnessScore: 0.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    // 1.0*0.35 + 1.0*0.35 + 0.0*0.30 = 0.70 → 70
    expect(comp.rankings[0].compositeScore).toBe(70);
  });
});

// ════════════════════════════════════════════════════════════════════
// identifyStrengths & identifyWeaknesses thresholds (real disk)
// ════════════════════════════════════════════════════════════════════

describe('strength/weakness identification', () => {
  it('arm with low successRate and many errors has all weaknesses', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 5, failedScenarios: 5, successRate: 0.5, totalErrors: 6, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 2, totalPhases: 5, totalActions: 0, failedActions: 1, durationMs: 5, errors: ['err'], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.5, performanceScore: 0.5, robustnessScore: 0.4,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    const r = comp.rankings[0];
    expect(r.weaknesses).toContain('Low eval pass rate');
    expect(r.weaknesses).toContain('1 failed actions');
    expect(r.weaknesses).toContain('Incomplete workflow');
    expect(r.weaknesses).toContain('High error count');
    expect(r.strengths).toEqual([]);
  });

  it('arm with error-free execution has Clean execution strength', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 3, failedScenarios: 7, successRate: 0.3, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: false, phasesCompleted: 2, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.3, performanceScore: 0.5, robustnessScore: 0.3,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    expect(comp.rankings[0].strengths).toContain('Clean execution');
  });

  it('arm with 4+ phases has Near-complete workflow strength', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 4, failedScenarios: 6, successRate: 0.4, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 4, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.4, performanceScore: 0.5, robustnessScore: 0.8,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    expect(comp.rankings[0].strengths).toContain('Near-complete workflow');
  });

  it('arm with all-max metrics gets all 4 strengths', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a',
          directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z',
          completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 10, failedScenarios: 0, successRate: 1.0, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 1.0, performanceScore: 1.0, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    const s = comp.rankings[0].strengths;
    expect(s).toContain('High eval pass rate');
    expect(s).toContain('Fast execution');
    expect(s).toContain('Clean execution');
    expect(s).toContain('Near-complete workflow');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateInsights thresholds (real disk)
// ════════════════════════════════════════════════════════════════════

describe('generateInsights thresholds', () => {
  it('generates performance variance insight when spread > 0.3', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a', directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 8, failedScenarios: 2, successRate: 0.8, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 0.8, performanceScore: 0.95, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
        makeArm({
          id: 'arm-b', directionId: 'dir-2',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:01:00.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 8, failedScenarios: 2, successRate: 0.8, totalErrors: 0, totalWarnings: 0, durationMs: 50000 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 0.8, performanceScore: 0.0, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance', 'Fast'), makeDir('dir-2', 'robustness', 'Slow')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    const perfInsight = comp.insights.find((i) => i.category === 'performance');
    expect(perfInsight).toBeDefined();
    expect(perfInsight!.importance).toBe(4);
  });

  it('generates quality insight when bestQuality > 0.8', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a', directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 8, failedScenarios: 2, successRate: 0.8, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 0.9, performanceScore: 0.95, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance', 'Best')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    const qInsight = comp.insights.find((i) => i.category === 'quality');
    expect(qInsight).toBeDefined();
    expect(qInsight!.importance).toBe(5);
  });

  it('generates general insight when 3+ arms complete', () => {
    const root = freshRoot();
    const mkArm = (idx: number): ExperimentArm => makeArm({
      id: `arm-${idx}`, directionId: `dir-${idx}`,
      status: 'completed',
      startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:00:01.000Z',
      metrics: {
        evalResults: { totalScenarios: 10, passedScenarios: 8, failedScenarios: 2, successRate: 0.8, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
        changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
        qualityScore: 0.5, performanceScore: 0.5, robustnessScore: 0.5,
        collectedAt: '2025-01-01T00:00:05.000Z',
      },
    });

    const state = makeState({
      demoChangeName: 'demo',
      arms: [mkArm(0), mkArm(1), mkArm(2)],
      directions: [makeDir('dir-0', 'performance'), makeDir('dir-1', 'robustness'), makeDir('dir-2', 'feature')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    const gInsight = comp.insights.find((i) => i.category === 'general');
    expect(gInsight).toBeDefined();
    expect(gInsight!.importance).toBe(3);
    expect(gInsight!.description).toContain('3 arms completed');
  });
});

// ════════════════════════════════════════════════════════════════════
// recommendations (compositeScore >= 60)
// ════════════════════════════════════════════════════════════════════

describe('recommendations threshold', () => {
  it('only recommends arms with composite score >= 60', () => {
    const root = freshRoot();
    const state = makeState({
      demoChangeName: 'demo',
      arms: [
        makeArm({
          id: 'arm-a', directionId: 'dir-1',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 7, failedScenarios: 3, successRate: 0.7, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: false, phasesCompleted: 2, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pending' },
            qualityScore: 0.3, performanceScore: 0.3, robustnessScore: 0.3,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
        makeArm({
          id: 'arm-b', directionId: 'dir-2',
          status: 'completed',
          startedAt: '2025-01-01T00:00:00.000Z', completedAt: '2025-01-01T00:00:01.000Z',
          metrics: {
            evalResults: { totalScenarios: 10, passedScenarios: 10, failedScenarios: 0, successRate: 1.0, totalErrors: 0, totalWarnings: 0, durationMs: 5 },
            changeResults: { changeName: 'demo', success: true, phasesCompleted: 5, totalPhases: 5, totalActions: 0, failedActions: 0, durationMs: 5, errors: [], warnings: [], verifyResult: 'pass' },
            qualityScore: 1.0, performanceScore: 1.0, robustnessScore: 1.0,
            collectedAt: '2025-01-01T00:00:05.000Z',
          },
        }),
      ],
      directions: [makeDir('dir-1', 'performance', 'Low'), makeDir('dir-2', 'robustness', 'High')],
    });
    saveState(root, state);

    const comp = compareArms(root, 'exp-test');
    expect(comp.recommendations).toContain('dir-2');
    expect(comp.recommendations).not.toContain('dir-1');
  });
});

// ════════════════════════════════════════════════════════════════════
// adoptImprovements (real disk + mocked git)
// ════════════════════════════════════════════════════════════════════

describe('adoptImprovements', () => {
  it('throws when experiment not found', () => {
    expect(() => adoptImprovements('/tmp/missing', 'nope')).toThrow('Experiment not found');
  });

  it('handles empty selection', () => {
    const root = freshRoot();
    const state = makeState({ selectedDirections: [] });
    saveState(root, state);

    const result = adoptImprovements(root, 'exp-test');
    expect(result.adopted).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('reports error when arm not found for selected direction', () => {
    const root = freshRoot();
    const state = makeState({ selectedDirections: ['dir-missing'], arms: [] });
    saveState(root, state);

    const result = adoptImprovements(root, 'exp-test');
    expect(result.adopted).toEqual([]);
    expect(result.errors).toContain('Arm for direction dir-missing not found');
  });

  it('cherry-picks commit when git log succeeds', () => {
    const root = freshRoot();
    const state = makeState({
      selectedDirections: ['dir-1'],
      arms: [makeArm({ id: 'arm-dir-1', directionId: 'dir-1', branch: 'experiment/exp-test/dir-1' })],
    });
    saveState(root, state);
    execSyncImpl.mockReset();
    execSyncImpl.mockReturnValueOnce('abc123 feat: improvement\n');  // git log
    execSyncImpl.mockReturnValueOnce('');                          // git cherry-pick

    const result = adoptImprovements(root, 'exp-test');

    expect(result.adopted).toEqual(['dir-1']);
    expect(result.errors).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// cleanupExperiment (real disk)
// ════════════════════════════════════════════════════════════════════

describe('cleanupExperiment', () => {
  it('returns error when experiment not found', () => {
    const result = cleanupExperiment('/tmp/missing', 'nope');
    expect(result.errors).toContain('Experiment not found: nope');
    expect(result.cleaned).toEqual([]);
  });

  it('dryRun mode reports paths without removing', () => {
    const root = freshRoot();
    const fakePath = join(tmpdir(), 'fake-wt-' + Date.now());
    mkdirSync(fakePath, { recursive: true });
    const state = makeState({
      arms: [makeArm({ worktreePath: fakePath })],
    });
    saveState(root, state);

    const result = cleanupExperiment(root, 'exp-test', { dryRun: true });

    expect(result.cleaned).toContain(fakePath);
    expect(result.errors).toEqual([]);
    rmSync(fakePath, { recursive: true, force: true });
  });

  it('skips worktrees that dont exist on disk', () => {
    const root = freshRoot();
    const state = makeState({
      arms: [makeArm({ worktreePath: '/tmp/nonexistent-path-xyz-12345' })],
    });
    saveState(root, state);

    const result = cleanupExperiment(root, 'exp-test', { dryRun: true });

    expect(result.cleaned).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// transitionPhase (lines 1035-1042)
// ════════════════════════════════════════════════════════════════════

describe('transitionPhase', () => {
  it('is a no-op (exists for interface compatibility)', () => {
    // transitionPhase at lines 1035-1042 is currently a stub.
    expect(() => transitionPhase('/tmp/root', 'exp-test', 'converged')).not.toThrow();
    expect(() => transitionPhase('', '', '' as never)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// Additional branching: findLargeFiles, calculateAvgFileSize,
// findTestFilesWithPatterns, findFilesWithErrorHandling coverage
// ════════════════════════════════════════════════════════════════════

describe('helper branching coverage', () => {
  it('findLargeFiles: finds files above 500-line threshold', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    let big = '';
    for (let i = 0; i < 600; i++) big += `export const f${i} = ${i};\n`;
    writeFileSync(join(root, 'src', 'big.ts'), big);

    const config: ExperimentConfig = {
      directionCount: 5, maxMetaRounds: 2,
      demoChangeName: 'd', demoProjectPath: '/tmp/d', autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const perfDir = dirs.find((d) => d.id === 'dir-perf-1');
    expect(perfDir).toBeDefined();
    expect(perfDir!.affectedFiles.length).toBeGreaterThan(0);
    // Path should use forward slashes (Windows compat)
    for (const f of perfDir!.affectedFiles) {
      expect(f).not.toContain('\\');
    }
  });

  it('findLargeFiles: no files below 500-line threshold', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    let small = '';
    for (let i = 0; i < 100; i++) small += `export const f${i} = ${i};\n`;
    writeFileSync(join(root, 'src', 'small.ts'), small);

    const config: ExperimentConfig = {
      directionCount: 5, maxMetaRounds: 2,
      demoChangeName: 'd', demoProjectPath: '/tmp/d', autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const perfDir = dirs.find((d) => d.id === 'dir-perf-1');
    expect(perfDir).toBeUndefined();
  });

  it('calculateAvgFileSize returns 0 when fileCount is 0', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'readme.md'), '# Readme\n');

    const config: ExperimentConfig = {
      directionCount: 5, maxMetaRounds: 2,
      demoChangeName: 'd', demoProjectPath: '/tmp/d', autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    expect(dirs.some((d) => d.category === 'performance')).toBe(false);
  });

  it('findTestFilesWithPatterns: no tests dir means empty affectedFiles', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    // No tests directory at all

    const config: ExperimentConfig = {
      directionCount: 5, maxMetaRounds: 2,
      demoChangeName: 'd', demoProjectPath: '/tmp/d', autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const maintDir = dirs.find((d) => d.category === 'maintainability');
    expect(maintDir).toBeDefined();
    expect(maintDir!.affectedFiles).toEqual([]);
  });

  it('findFilesWithErrorHandling: only files with throw or catch', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src', 'core'), { recursive: true });
    writeFileSync(
      join(root, 'src', 'core', 'handler.ts'),
      'export function h() { try {} catch (e) { console.error(e); } }\n'
    );
    writeFileSync(
      join(root, 'src', 'core', 'plain.ts'),
      'export const x = 1;\n'
    );

    const config: ExperimentConfig = {
      directionCount: 5, maxMetaRounds: 2,
      demoChangeName: 'd', demoProjectPath: '/tmp/d', autoGenerate: true,
    };
    const dirs = generateDirections(root, config);
    const robustDir = dirs.find((d) => d.category === 'robustness');
    expect(robustDir).toBeDefined();
  });
});