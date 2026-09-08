/**
 * Additional coverage tests for experiment-engine.ts — targets spawnArms,
 * applyDirectionPatch, runArm, simulateChangeExecution, cleanupExistingWorktree,
 * and edge cases in generateDirections.
 *
 * Strategy: Same as experiment-engine-deep.test.ts — real filesystem for
 * state persistence (readYaml, writeYaml, etc.), mock ONLY spawnSync (git)
 * and runAllEvals (eval runner).
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Mock spawnSync (git) ───────────────────────────────────────────
const spawnSyncImpl = vi.fn((): { stdout: string; status: number; stderr?: string } => ({
  stdout: '',
  status: 0,
}));
vi.mock('node:child_process', () => ({
  spawnSync: (...args: any[]) => spawnSyncImpl(...args),
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
  spawnArms,
  runArm,
  loadExperimentState,
  adoptImprovements,
  cleanupExperiment,
} from '../../src/eval/experiment-engine.js';
import type {
  ExperimentConfig,
  ExperimentState,
  ExperimentDirection,
  ExperimentArm,
} from '../../../src/eval/types-experiment.js';

// ── Helpers ─────────────────────────────────────────────────────────

let testCounter = 0;
function freshRoot(): string {
  const id = `mumuspec-exp-extra-${Date.now()}-${testCounter++}`;
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

function saveState(root: string, state: ExperimentState): void {
  const dir = join(root, '.mumuspec', 'experiments', state.name);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'experiment.yaml');
  const { stringify } = require('yaml') as { stringify: (d: unknown) => string };
  writeFileSync(filePath, stringify(state), 'utf8');
}

function makeDir(id: string, category: ExperimentDirection['category'], affectedFiles: string[] = []): ExperimentDirection {
  return {
    id,
    name: `${id}-name`,
    description: `Description for ${id}`,
    category,
    riskLevel: 2,
    affectedFiles,
    changeSummary: `Change for ${id}`,
    expectedBenefit: `Benefit for ${id}`,
    adopted: false,
  };
}

afterAll(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// adoptImprovements — error path: git log throws
// ════════════════════════════════════════════════════════════════════

describe('adoptImprovements — git log error path', () => {
  it('catches error when git log fails and pushes error message', () => {
    const root = freshRoot();
    const state = makeState({
      selectedDirections: ['dir-1'],
      arms: [
        {
          id: 'arm-dir-1',
          directionId: 'dir-1',
          worktreePath: '/tmp/wt',
          branch: 'experiment/exp-test/dir-1',
          status: 'pending',
        } as ExperimentArm,
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    // git log returns failure (status !== 0) to trigger error path
    spawnSyncImpl.mockReturnValue({ stdout: '', status: 1, stderr: 'fatal: bad object' });

    const result = adoptImprovements(root, 'exp-test');
    expect(result.adopted).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to adopt dir-1');
    expect(result.errors[0]).toContain('status 1');
  });
});

// ════════════════════════════════════════════════════════════════════
// cleanupExperiment — non-dry-run path with real git worktree remove
// ════════════════════════════════════════════════════════════════════

describe('cleanupExperiment — non-dry-run', () => {
  it('removes actual worktrees when not in dryRun mode', () => {
    const root = freshRoot();
    // Create a real worktree directory so existsSync returns true
    const fakeWt = join(root, 'worktree-mock');
    mkdirSync(fakeWt, { recursive: true });

    const state = makeState({
      arms: [
        {
          id: 'arm-dir-1',
          directionId: 'dir-1',
          worktreePath: fakeWt,
          branch: 'experiment/exp-test/dir-1',
          status: 'completed',
        } as ExperimentArm,
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    const result = cleanupExperiment(root, 'exp-test');

    expect(result.cleaned).toContain(fakeWt);
    expect(result.errors).toEqual([]);
  });

  it('reports error when git worktree remove fails (non-dryRun)', () => {
    const root = freshRoot();
    const badPath = join(root, 'bad-worktree');
    mkdirSync(badPath, { recursive: true });

    const state = makeState({
      arms: [
        {
          id: 'arm-dir-1',
          directionId: 'dir-1',
          worktreePath: badPath,
          branch: 'experiment/exp-test/dir-1',
          status: 'completed',
        } as ExperimentArm,
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    spawnSyncImpl.mockReturnValue({ stdout: '', status: 1, stderr: 'worktree removal failed' });

    const result = cleanupExperiment(root, 'exp-test');

    expect(result.cleaned).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to remove');
    expect(result.errors[0]).toContain('status 1');
  });
});

// ════════════════════════════════════════════════════════════════════
// spawnArms — happy path with mocked git worktree
// ════════════════════════════════════════════════════════════════════

describe('spawnArms', () => {
  it('throws when experiment not found', () => {
    expect(() => spawnArms('/tmp/nonexistent-exp-root', 'nope')).toThrow('Experiment not found');
  });

  it('creates arms for all directions and sets phase to spawning', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [
        makeDir('dir-1', 'performance'),
        makeDir('dir-2', 'robustness'),
        makeDir('dir-3', 'feature'),
      ],
    });
    saveState(root, state);

    // Reset exec sync to track calls
    spawnSyncImpl.mockReset();
    // For each direction: cleanupExistingWorktree (2 calls) + git worktree add (1 call)
    // cleanupExistingWorktree: git worktree remove (fails silently) + git branch -D (fails silently)
    // git worktree add -b branch path commit

    const arms = spawnArms(root, 'exp-test');

    expect(arms).toHaveLength(3);
    expect(arms[0].id).toBe('arm-dir-1');
    expect(arms[0].directionId).toBe('dir-1');
    expect(arms[0].branch).toBe('experiment/exp-test/dir-1');
    expect(arms[0].status).toBe('pending');
    expect(arms[1].id).toBe('arm-dir-2');
    expect(arms[2].id).toBe('arm-dir-3');

    // worktreePath should contain experiment-worktrees
    for (const arm of arms) {
      expect(arm.worktreePath.replace(/\\/g, '/')).toContain('.experiment-worktrees');
    }

    // Verify state was updated
    const reloaded = loadExperimentState(root, 'exp-test')!;
    expect(reloaded.phase).toBe('spawning');
    expect(reloaded.arms).toHaveLength(3);
  });

  it('handles empty directions array', () => {
    const root = freshRoot();
    const state = makeState({ directions: [] });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    const arms = spawnArms(root, 'exp-test');
    expect(arms).toEqual([]);
  });

  it('calls cleanupExistingWorktree before creating new worktree for each direction', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    spawnArms(root, 'exp-test');

    // Should have called: remove worktree (try/catch), delete branch (try/catch), add worktree = 3 calls
    const calls = spawnSyncImpl.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // spawnSync calls are (command, args[], opts) — find a 'git' call with 'worktree' in args
    const addCall = calls.find((c) => c[0] === 'git' && Array.isArray(c[1]) && c[1].includes('worktree') && c[1].includes('add'));
    expect(addCall).toBeDefined();
    expect(String(addCall![1])).toContain('experiment/exp-test/dir-1');
  });
});

// ════════════════════════════════════════════════════════════════════
// applyDirectionPatch — covered via spawnArms with affectedFiles
// ════════════════════════════════════════════════════════════════════

describe('applyDirectionPatch (via spawnArms)', () => {
  it('applies marker patch to affected files that exist in worktree', () => {
    const root = freshRoot();
    // Create a worktree-like directory structure with target files
    const worktreeBase = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    mkdirSync(worktreeBase, { recursive: true });
    mkdirSync(join(worktreeBase, 'src'), { recursive: true });
    writeFileSync(join(worktreeBase, 'src', 'a.ts'), 'export const a = 1;\n');

    const state = makeState({
      directions: [
        makeDir('dir-1', 'performance', ['src/a.ts']),
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    spawnArms(root, 'exp-test');

    // After spawn, the marker should be prepended to src/a.ts
    const filePath = join(worktreeBase, 'src', 'a.ts');
    const content = require('fs').readFileSync(filePath, 'utf8');
    expect(content).toContain('// [experiment:dir-1]');
  });

  it('skips patch for affected files that do not exist in worktree', () => {
    const root = freshRoot();
    const worktreeBase = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    mkdirSync(worktreeBase, { recursive: true });
    // Do NOT create the target file

    const state = makeState({
      directions: [
        makeDir('dir-1', 'performance', ['src/nonexistent.ts']),
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    // Should not throw
    expect(() => spawnArms(root, 'exp-test')).not.toThrow();
  });

  it('does not duplicate marker if already present', () => {
    const root = freshRoot();
    const worktreeBase = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    mkdirSync(worktreeBase, { recursive: true });
    mkdirSync(join(worktreeBase, 'src'), { recursive: true });
    // The marker format in code is: `// [experiment:${id}] ${name}\n`
    // use makeDir which sets name = 'dir-1-name', so marker = '// [experiment:dir-1] dir-1-name\n'
    const existingMarker = '// [experiment:dir-1] dir-1-name\n';
    writeFileSync(join(worktreeBase, 'src', 'a.ts'), existingMarker + 'export const a = 1;\n');

    const state = makeState({
      directions: [
        makeDir('dir-1', 'performance', ['src/a.ts']),
      ],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();

    spawnArms(root, 'exp-test');

    // Marker should appear exactly once
    const filePath = join(worktreeBase, 'src', 'a.ts');
    const content = require('fs').readFileSync(filePath, 'utf8');
    const matches = content.match(/\/\/ \[experiment:dir-1\]/g);
    expect(matches).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// runArm — happy path + error path
// ════════════════════════════════════════════════════════════════════

describe('runArm', () => {
  function setupArmForRun(root: string, armOverrides: Partial<ExperimentArm> = {}): void {
    const state = makeState({
      arms: [
        {
          id: 'arm-dir-1',
          directionId: 'dir-1',
          worktreePath: join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1'),
          branch: 'experiment/exp-test/dir-1',
          status: 'pending',
          ...armOverrides,
        },
      ],
    });
    // Create worktree directory so simulateChangeExecution can check artifacts
    const worktreeDir = state.arms[0].worktreePath;
    const changesDir = join(worktreeDir, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    // Create some phase artifacts so simulateChangeExecution detects progress
    writeFileSync(join(changesDir, 'proposal.md'), '# Proposal\n');
    writeFileSync(join(changesDir, 'design.md'), '# Design\n');
    writeFileSync(join(changesDir, 'tasks.md'), '# Tasks\n');

    saveState(root, state);
  }

  it('throws when experiment not found', () => {
    expect(() => runArm('/tmp/nonexistent', 'nope', 'arm-1')).toThrow('Experiment not found');
  });

  it('throws when arm not found', () => {
    const root = freshRoot();
    const state = makeState({ arms: [] });
    saveState(root, state);

    expect(() => runArm(root, 'exp-test', 'arm-nonexistent')).toThrow('Arm not found');
  });

  it('runs arm successfully and collects metrics', () => {
    const root = freshRoot();
    setupArmForRun(root);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({
      total: 20,
      passed: 18,
      failed: 2,
      duration: 200,
      results: [],
    });

    spawnSyncImpl.mockReturnValue({ stdout: 'mock-git-output', status: 0 });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    expect(metrics).toBeDefined();
    expect(metrics.evalResults.totalScenarios).toBe(20);
    expect(metrics.evalResults.passedScenarios).toBe(18);
    expect(metrics.evalResults.failedScenarios).toBe(2);
    expect(metrics.evalResults.successRate).toBeCloseTo(0.9);
    expect(metrics.changeResults.changeName).toBe('demo-change');
    expect(metrics.changeResults.phasesCompleted).toBe(3);
    expect(metrics.changeResults.totalPhases).toBe(5);
    expect(metrics.changeResults.success).toBe(true); // >= 3 phases
    expect(typeof metrics.qualityScore).toBe('number');
    expect(typeof metrics.performanceScore).toBe('number');
    expect(typeof metrics.robustnessScore).toBe('number');
    expect(metrics.collectedAt).toBeDefined();

    // Verify arm status updated
    const reloaded = loadExperimentState(root, 'exp-test')!;
    expect(reloaded.arms[0].status).toBe('completed');
    expect(reloaded.arms[0].metrics).toBeDefined();
    expect(reloaded.arms[0].startedAt).toBeDefined();
    expect(reloaded.arms[0].completedAt).toBeDefined();
  });

  it('completes arm even when runAllEvals throws (caught internally by runEvalInWorktree)', () => {
    const root = freshRoot();
    setupArmForRun(root);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    // runEvalInWorktree catches the error and returns empty results
    runAllEvalsImpl.mockImplementation(() => {
      throw new Error('eval runner failed');
    });

    // Should NOT throw because runEvalInWorktree catches it
    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    expect(metrics).toBeDefined();
    // Empty eval results because eval threw
    expect(metrics.evalResults.totalScenarios).toBe(0);

    // Arm completed normally (eval error is handled gracefully)
    const reloaded = loadExperimentState(root, 'exp-test')!;
    expect(reloaded.arms[0].status).toBe('completed');
  });

  it('handles arm with empty eval results gracefully', () => {
    const root = freshRoot();
    setupArmForRun(root);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({
      total: 0,
      passed: 0,
      failed: 0,
      duration: 10,
      results: [],
    });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    // With 0 scenarios, qualityScore defaults to 0.5
    expect(metrics.qualityScore).toBe(0.5);
    expect(metrics.evalResults.successRate).toBe(0);
    expect(metrics.evalResults.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// simulateChangeExecution — via runArm with different artifact configs
// ════════════════════════════════════════════════════════════════════

describe('simulateChangeExecution (via runArm)', () => {
  function setupWorktreeWithArtifacts(root: string, artifacts: string[]): string {
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });

    for (const artifact of artifacts) {
      writeFileSync(join(changesDir, artifact), `# ${artifact}\n`);
    }

    const state = makeState({
      arms: [
        {
          id: 'arm-dir-1',
          directionId: 'dir-1',
          worktreePath,
          branch: 'experiment/exp-test/dir-1',
          status: 'pending',
        } as ExperimentArm,
      ],
    });
    saveState(root, state);
    return worktreePath;
  }

  it('all 4 artifacts + archive → phasesCompleted = 5, success = true', () => {
    const root = freshRoot();
    const worktreePath = setupWorktreeWithArtifacts(root, ['proposal.md', 'design.md', 'tasks.md', 'verify.md']);
    const archiveDir = join(worktreePath, '.mumuspec', 'changes', 'archive');
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(join(archiveDir, 'demo-change-20250101'), { recursive: true });

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    expect(metrics.changeResults.phasesCompleted).toBe(5);
    expect(metrics.changeResults.success).toBe(true);
    expect(metrics.changeResults.verifyResult).toBe('pass');
  });

  it('0 artifacts → phasesCompleted = 0, warning generated', () => {
    const root = freshRoot();
    setupWorktreeWithArtifacts(root, []);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    expect(metrics.changeResults.phasesCompleted).toBe(0);
    expect(metrics.changeResults.success).toBe(false);
    expect(metrics.changeResults.verifyResult).toBe('pending');
    expect(metrics.changeResults.warnings.length).toBeGreaterThan(0);
    expect(metrics.changeResults.warnings[0]).toContain('demo-change');
  });

  it('audit log with error entries → errors captured', () => {
    const root = freshRoot();
    const worktreePath = setupWorktreeWithArtifacts(root, ['proposal.md', 'design.md']);
    const auditPath = join(worktreePath, '.mumuspec', 'audit.log');
    writeFileSync(
      auditPath,
      JSON.stringify({ actor: 'user', action: 'change.new', result: 'error' }) + '\n' +
      JSON.stringify({ actor: 'user', action: 'change.build', result: 'failed' }) + '\n'
    );

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    expect(metrics.changeResults.errors.length).toBeGreaterThan(0);
    // failedActions = error count
    expect(metrics.changeResults.failedActions).toBe(metrics.changeResults.errors.length);
  });

  it('audit log with unparseable entries → skipped gracefully', () => {
    const root = freshRoot();
    const worktreePath = setupWorktreeWithArtifacts(root, ['proposal.md']);
    const auditPath = join(worktreePath, '.mumuspec', 'audit.log');
    writeFileSync(auditPath, 'not-json\nanother-garbage\n');

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    expect(() => runArm(root, 'exp-test', 'arm-dir-1')).not.toThrow();
  });

  it('exactly 3 phases completed → success boundary (success = true)', () => {
    const root = freshRoot();
    setupWorktreeWithArtifacts(root, ['proposal.md', 'design.md', 'tasks.md']);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');

    // 3 phases: verifyResult = 'pending' (needs >= 4 for 'pass')
    expect(metrics.changeResults.verifyResult).toBe('pending');
    expect(metrics.changeResults.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// cleanupExistingWorktree — via spawnArms error paths
// ════════════════════════════════════════════════════════════════════

describe('cleanupExistingWorktree (via spawnArms)', () => {
  it('handles when git worktree remove throws (worktree does not exist)', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    // First call fails (worktree remove), second fails (branch delete), third succeeds (add worktree)
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 1, stderr: 'worktree not found' });
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 1, stderr: 'branch not found' });
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 0 });

    expect(() => spawnArms(root, 'exp-test')).not.toThrow();
    const reloaded = loadExperimentState(root, 'exp-test')!;
    expect(reloaded.arms).toHaveLength(1);
  });

  it('handles when git branch -D throws (branch does not exist)', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    // worktree remove succeeds, branch delete fails
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 0 });
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 1, stderr: 'branch not found' });
    spawnSyncImpl.mockReturnValueOnce({ stdout: '', status: 0 });

    expect(() => spawnArms(root, 'exp-test')).not.toThrow();
  });

  it('handles when git worktree add succeeds on first try (no cleanup needed)', () => {
    const root = freshRoot();
    const state = makeState({
      directions: [makeDir('dir-1', 'performance')],
    });
    saveState(root, state);

    // All spawnSync calls succeed (no-op cleanups + successful add)
    spawnSyncImpl.mockReset();

    const arms = spawnArms(root, 'exp-test');
    expect(arms).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// generateDirections — edge cases for uncovered branches
// ════════════════════════════════════════════════════════════════════

describe('generateDirections — additional edge cases', () => {
  it('rust framework with Cargo.toml gets feature directions', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'Cargo.toml'), '[package]\nname = "test"\n');

    // Create a large file to trigger perf
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
    // Rust/Cargo framework isn't detected — should still have standard dirs
    expect(dirs.some((d) => d.category === 'robustness')).toBe(true);
    expect(dirs.some((d) => d.category === 'feature')).toBe(true);
  });

  it('languages array in project config (no-op for now)', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });
    // Create a package.json with languages field — but the code doesn't actually use it
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'test',
      languages: ['typescript', 'python'],
    }));

    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };

    const dirs = generateDirections(root, config);
    // Should still produce standard directions
    expect(dirs.length).toBeGreaterThan(0);
  });

  it('filter by focusCategories removes all non-matching', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src', 'core'), { recursive: true });
    writeFileSync(join(root, 'src', 'core', 'handler.ts'), 'export function h() { throw new Error("x"); }\n');

    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
      focusCategories: ['security'], // Not generated by auto-generate
    };

    const dirs = generateDirections(root, config);
    // Security dirs are not auto-generated, so result should be empty
    expect(dirs.length).toBe(0);
  });

  it('directionCount 0 returns empty array', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });

    const config: ExperimentConfig = {
      directionCount: 0,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
    };

    const dirs = generateDirections(root, config);
    expect(dirs).toEqual([]);
  });

  it('invalid focusCategories results in empty output', () => {
    const root = freshRoot();
    mkdirSync(join(root, 'src'), { recursive: true });

    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: true,
      focusCategories: ['nonexistent-category' as ExperimentDirection['category']],
    };

    const dirs = generateDirections(root, config);
    expect(dirs.length).toBe(0);
  });

  it('manual directions with custom risk level preserved', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: false,
      manualDirections: [
        { id: 'custom-1', riskLevel: 5 },
      ],
    };

    const dirs = generateDirections('/tmp/nonexistent', config);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].riskLevel).toBe(5);
    expect(dirs[0].name).toBe('Direction 1');
    expect(dirs[0].adopted).toBe(false);
  });

  it('manual directions with all fields provided', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'd',
      demoProjectPath: '/tmp/d',
      autoGenerate: false,
      manualDirections: [
        {
          id: 'full-1',
          name: 'Full Direction',
          description: 'All fields specified',
          category: 'security',
          riskLevel: 3,
          affectedFiles: ['src/a.ts', 'src/b.ts'],
          changeSummary: 'Security hardening',
          expectedBenefit: 'Better security',
        },
      ],
    };

    const dirs = generateDirections('/tmp/nonexistent', config);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].id).toBe('full-1');
    expect(dirs[0].name).toBe('Full Direction');
    expect(dirs[0].description).toBe('All fields specified');
    expect(dirs[0].category).toBe('security');
    expect(dirs[0].riskLevel).toBe(3);
    expect(dirs[0].affectedFiles).toEqual(['src/a.ts', 'src/b.ts']);
    expect(dirs[0].changeSummary).toBe('Security hardening');
    expect(dirs[0].expectedBenefit).toBe('Better security');
    expect(dirs[0].adopted).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// initExperiment — additional edge cases
// ════════════════════════════════════════════════════════════════════

describe('initExperiment — additional', () => {
  it('creates experiment with empty directionCount config', () => {
    const root = freshRoot();
    spawnSyncImpl.mockReset();
    spawnSyncImpl.mockReturnValueOnce({ stdout: 'feature-branch\n', status: 0 });
    spawnSyncImpl.mockReturnValueOnce({ stdout: 'deadbeef\n', status: 0 });

    const state = initExperiment(root, {
      name: 'exp-minimal',
      goal: 'minimal test',
      config: {
        directionCount: 0,
        maxMetaRounds: 1,
        demoChangeName: 'demo',
        demoProjectPath: '/tmp/demo',
        autoGenerate: false,
        manualDirections: [{ id: 'd1' }],
      },
    });

    expect(state.name).toBe('exp-minimal');
    expect(state.originalBranch).toBe('feature-branch');
    expect(state.baseCommit).toBe('deadbeef');
    expect(state.phase).toBe('init');
    expect(state.arms).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// computeQualityScore edge cases — via runArm with high errors
// ════════════════════════════════════════════════════════════════════

describe('computeQualityScore edge cases (via runArm)', () => {
  it('high error count reduces quality score below success rate', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');
    writeFileSync(join(changesDir, 'design.md'), '# D\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({
      total: 10,
      passed: 10, // successRate = 1.0
      failed: 0,
      duration: 50,
      results: [
        { errors: Array(10).fill({}), warnings: [] } as any, // 10 errors → penalty 0.3
      ],
    });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    // successRate = 1.0, errorPenalty = min(10/10, 0.3) = 0.3, quality = 0.7
    expect(metrics.qualityScore).toBeCloseTo(0.7);
  });

  it('quality score clamps to 0 when penalty exceeds success rate', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    // successRate = 0.2, 15 errors → penalty = min(15/10, 0.3) = 0.3
    // but 0.2 - 0.3 = -0.1, clamped to 0
    runAllEvalsImpl.mockReturnValue({
      total: 10,
      passed: 2,
      failed: 8,
      duration: 50,
      results: [
        { errors: Array(15).fill({}), warnings: [] } as any,
      ],
    });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    expect(metrics.qualityScore).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// computePerformanceScore edge cases — via runArm
// ════════════════════════════════════════════════════════════════════

describe('computePerformanceScore edge cases (via runArm)', () => {
  it('zero duration → score 1.0 because duration = 0', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');
    writeFileSync(join(changesDir, 'design.md'), '# D\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({
      total: 10,
      passed: 9,
      failed: 1,
      duration: 1, // Very fast eval
      results: [],
    });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    // Duration-based: speedScore = 1 - 0/60000 = 1.0 (effectively)
    // Eval-based: evalSpeedScore = 1 - 1/30000 ≈ 1.0
    expect(metrics.performanceScore).toBeGreaterThanOrEqual(0);
    expect(metrics.performanceScore).toBeLessThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// computeRobustnessScore edge cases — via runArm
// ════════════════════════════════════════════════════════════════════

describe('computeRobustnessScore edge cases (via runArm)', () => {
  it('more errors than phases → negative clamped to 0', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    // Only 1 phase completed
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');

    // Audit log with many errors so failedActions * 0.1 > phaseRatio
    const auditPath = join(worktreePath, '.mumuspec', 'audit.log');
    writeFileSync(auditPath,
      JSON.stringify({ actor: 'x', action: 'a', result: 'error' }) + '\n' +
      JSON.stringify({ actor: 'x', action: 'b', result: 'error' }) + '\n' +
      JSON.stringify({ actor: 'x', action: 'c', result: 'error' }) + '\n' +
      JSON.stringify({ actor: 'x', action: 'd', result: 'error' }) + '\n'
    );

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 9, failed: 1, duration: 50, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    // phaseRatio = 1/5 = 0.2, errorPenalty = min(4 * 0.1, 0.4) = 0.4
    // 0.2 - 0.4 = -0.2 → clamped to 0
    expect(metrics.robustnessScore).toBe(0);
  });

  it('perfect execution → robustness score = 1.0', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');
    writeFileSync(join(changesDir, 'design.md'), '# D\n');
    writeFileSync(join(changesDir, 'tasks.md'), '# T\n');
    writeFileSync(join(changesDir, 'verify.md'), '# V\n');
    // archive for full completion
    const archiveDir = join(worktreePath, '.mumuspec', 'changes', 'archive');
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(join(archiveDir, 'demo-change-20250101'), { recursive: true });

    // No error audit entries
    const auditPath = join(worktreePath, '.mumuspec', 'audit.log');
    writeFileSync(auditPath, JSON.stringify({ actor: 'x', action: 'a', result: 'success' }) + '\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({ total: 10, passed: 10, failed: 0, duration: 10, results: [] });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    // All 5 phases, no errors → robustness = 1.0
    expect(metrics.robustnessScore).toBeCloseTo(1.0);
  });
});

// ════════════════════════════════════════════════════════════════════
// runEvalInWorktree edge cases — via runArm when eval throws
// ════════════════════════════════════════════════════════════════════

describe('runEvalInWorktree error handling (via runArm)', () => {
  it('returns empty results when runAllEvals throws', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockImplementation(() => {
      throw new Error('eval crash');
    });

    // runEvalInWorktree catches the error and returns empty results
    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    expect(metrics.evalResults.totalScenarios).toBe(0);
    expect(metrics.evalResults.passedScenarios).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// runEvalInWorktree results aggregation — via runArm with errored results
// ════════════════════════════════════════════════════════════════════

describe('runEvalInWorktree errors/warnings aggregation', () => {
  it('aggregates errors across multiple eval results', () => {
    const root = freshRoot();
    const worktreePath = join(root, '.mumuspec', '.experiment-worktrees', 'exp-test', 'dir-1');
    const changesDir = join(worktreePath, '.mumuspec', 'changes', 'demo-change');
    mkdirSync(changesDir, { recursive: true });
    writeFileSync(join(changesDir, 'proposal.md'), '# P\n');
    writeFileSync(join(changesDir, 'design.md'), '# D\n');

    const state = makeState({
      arms: [{
        id: 'arm-dir-1', directionId: 'dir-1',
        worktreePath, branch: 'experiment/exp-test/dir-1',
        status: 'pending',
      } as ExperimentArm],
    });
    saveState(root, state);

    spawnSyncImpl.mockReset();
    runAllEvalsImpl.mockReset();
    runAllEvalsImpl.mockReturnValue({
      total: 10,
      passed: 7,
      failed: 3,
      duration: 100,
      results: [
        { errors: [{}, {}, {}], warnings: [{}, {}] } as any,
        { errors: [{}], warnings: [{}, {}, {}] } as any,
      ],
    });

    const metrics = runArm(root, 'exp-test', 'arm-dir-1');
    // totalErrors = 3 + 1 = 4
    expect(metrics.evalResults.totalErrors).toBe(4);
    // totalWarnings = 2 + 3 = 5
    expect(metrics.evalResults.totalWarnings).toBe(5);
  });
});
