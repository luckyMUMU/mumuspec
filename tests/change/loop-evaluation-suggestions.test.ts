/**
 * Tests — advisory suggestions pass-through (freedom-metrics-loop-closure ENF-1 / ENF-2).
 *
 * Regression guard for the dead-end output defect: `autoEvaluate` produced
 * `suggestions`, but the `LoopEvaluation` conversion layer in loop-engine
 * dropped them, so neither `loop evaluate` nor the persisted snapshot could
 * ever surface an advisory. These tests assert the full pass-through chain:
 * AutoEvaluateResult.suggestions → LoopEvaluation → saved state + metrics snapshot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn((): { stdout: string; status: number; stderr?: string } => ({
    stdout: 'mock-sha',
    status: 0,
  })),
}));

const mockChangeStates = new Map<string, any>();
let activeChangeName: string | null = null;
const mockRunPhaseGuard = vi.fn(() => ({ passed: true, errors: [], warnings: [] }));

vi.mock('../../src/change/manager.js', () => ({
  loadChangeState: vi.fn((_root: string, changeName: string) => mockChangeStates.get(changeName) ?? null),
  saveChangeState: vi.fn((_root: string, changeName: string, state: any) => {
    mockChangeStates.set(changeName, state);
  }),
  getActiveChange: vi.fn(() => activeChangeName),
}));

vi.mock('../../src/core/utils.js', () => ({
  now: vi.fn(() => '2026-09-10T12:00:00.000Z'),
  appendAuditLog: vi.fn(),
  getMumuSpecDir: vi.fn((root: string) => `${root}/.mumuspec`),
  computeHash: vi.fn(() => 'hash'),
  readYaml: vi.fn(),
  writeYaml: vi.fn(),
  readText: vi.fn(),
  writeText: vi.fn(),
  ensureDir: vi.fn(),
  isPathSafe: vi.fn(() => true),
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
  findProjectRoot: vi.fn(),
}));

// Auto-evaluate is mocked so the advisory content is deterministic; the code
// under test is the loop-engine conversion layer, not the metric collection.
const ADVISORY = '一次通过率 0.60 低于目标 0.80 且约束密度 0.90 高于 0.70 → 建议评估放宽约束强度（须人工签收后生效）';

vi.mock('../../src/core/metrics/auto-evaluate.js', () => ({
  registerBuiltInEvaluators: vi.fn(),
  getActiveEvaluatorCount: vi.fn(() => 0),
  autoEvaluate: vi.fn(async () => ({
    progress: 0.6,
    goalAchieved: false,
    metrics: [{ name: 'design-build-first-pass', value: 0.6, weight: 0.2, details: 'd' }],
    recommendation: 'continue',
    suggestions: [ADVISORY],
    history: [0.6],
  })),
  hybridEvaluate: vi.fn(),
}));

vi.mock('../../src/guard/phase-guard.js', () => ({
  runPhaseGuard: (...args: unknown[]) => mockRunPhaseGuard(...args),
}));

import { evaluateRound } from '../../src/change/loop-engine.js';
import type { LoopState } from '../../src/core/types-loop.js';

const PROJECT_ROOT = '/tmp/test-freedom-loop';

function seededState(suggestionsInRound?: string[]): LoopState {
  return {
    enabled: true,
    phase: 'act',
    max_rounds: 3,
    current_round: 1,
    rounds: [
      {
        round: 1,
        plan: 'plan',
        actions: [],
        evaluation: suggestionsInRound
          ? ({
              progress: 0.5,
              goal_achieved: false,
              issues: [],
              needs_user_input: false,
              suggestions: suggestionsInRound,
            } as any)
          : null,
      } as any,
    ],
    goal: 'goal',
    convergence_criteria: ['c'],
    auto_commit: false,
    merged_back: false,
    total_actions: 0,
    progress_trend: [],
  };
}

function seed(name: string): void {
  mockChangeStates.set(name, { name, phase: 'build', scope: '.', workflow: 'standard', loop_state: seededState() });
  activeChangeName = name;
}

const manualEvaluation = {
  progress: 0.5,
  goal_achieved: false,
  issues: [],
  needs_user_input: false,
};

beforeEach(() => {
  mockChangeStates.clear();
  activeChangeName = null;
});

describe('advisory suggestions pass-through (ENF-1)', () => {
  it('carries AutoEvaluateResult.suggestions into the recorded LoopEvaluation', async () => {
    seed('loop-a');
    await evaluateRound(PROJECT_ROOT, 'loop-a', manualEvaluation, { mode: 'auto' });

    const loop = mockChangeStates.get('loop-a').loop_state;
    const recorded = loop.rounds[loop.rounds.length - 1].evaluation;
    expect(recorded.suggestions).toEqual([ADVISORY]);
  });

  it('coerces missing suggestions to an empty array rather than dropping the field', async () => {
    const autoEval = await import('../../src/core/metrics/auto-evaluate.js');
    (autoEval.autoEvaluate as any).mockResolvedValueOnce({
      progress: 0.6,
      goalAchieved: false,
      metrics: [],
      recommendation: 'continue',
      history: [0.6],
    });

    seed('loop-b');
    await evaluateRound(PROJECT_ROOT, 'loop-b', manualEvaluation, { mode: 'auto' });

    const loop = mockChangeStates.get('loop-b').loop_state;
    const recorded = loop.rounds[loop.rounds.length - 1].evaluation;
    expect(recorded.suggestions).toEqual([]);
  });
});

describe('advisory suggestions persistence (ENF-2)', () => {
  it('persists this round\'s suggestions into the metrics snapshot', async () => {
    seed('loop-c');
    await evaluateRound(PROJECT_ROOT, 'loop-c', manualEvaluation, { mode: 'auto' });

    const snapshots = mockChangeStates.get('loop-c').loop_state.metrics_history;
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].suggestions).toEqual([ADVISORY]);
  });

  it('manual mode leaves the supplied evaluation untouched (no advisory injection)', async () => {
    seed('loop-d');
    await evaluateRound(PROJECT_ROOT, 'loop-d', manualEvaluation);

    const loop = mockChangeStates.get('loop-d').loop_state;
    expect(loop.rounds[loop.rounds.length - 1].evaluation.suggestions).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// P1-1 (E11): 信号带宽回填——issues 透传 + guard 失败事实采集
// ════════════════════════════════════════════════════════════════════

describe('P1-1 signal pass-through (E11)', () => {
  beforeEach(() => {
    mockRunPhaseGuard.mockReset();
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
  });

  it('auto mode passes through caller-supplied issues (no longer hardcoded to [])', async () => {
    seed('loop-e');
    await evaluateRound(PROJECT_ROOT, 'loop-e', {
      progress: 0.6,
      goal_achieved: false,
      issues: ['pre-existing issue'],
      needs_user_input: false,
    }, { mode: 'auto' });

    const loop = mockChangeStates.get('loop-e').loop_state;
    const recorded = loop.rounds[loop.rounds.length - 1].evaluation;
    expect(recorded.issues).toContain('pre-existing issue');
  });

  it('auto mode passes through needs_user_input (no longer hardcoded to false)', async () => {
    seed('loop-f');
    await evaluateRound(PROJECT_ROOT, 'loop-f', {
      progress: 0.6,
      goal_achieved: false,
      issues: [],
      needs_user_input: true,
      block_reason: 'needs approval',
    }, { mode: 'auto' });

    const loop = mockChangeStates.get('loop-f').loop_state;
    const recorded = loop.rounds[loop.rounds.length - 1].evaluation;
    expect(recorded.needs_user_input).toBe(true);
  });

  it('collects guard failure codes into issues ([guard:<code>] tagged, deduped)', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: false,
      errors: [
        { code: 'E-GUARD-001', message: 'proposal.md 不存在' },
        { code: 'E-GUARD-001', message: 'proposal.md 不存在' }, // duplicate code
      ],
      warnings: [],
    });

    seed('loop-g');
    await evaluateRound(PROJECT_ROOT, 'loop-g', {
      progress: 0.6,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    }, { mode: 'auto' });

    const loop = mockChangeStates.get('loop-g').loop_state;
    const recorded = loop.rounds[loop.rounds.length - 1].evaluation;
    const guardTags = recorded.issues.filter((i: string) => i.startsWith('[guard:'));
    expect(guardTags).toHaveLength(1); // deduped by code+message
    expect(guardTags[0]).toContain('E-GUARD-001');
    expect(guardTags[0]).toContain('proposal.md');
  });
});
