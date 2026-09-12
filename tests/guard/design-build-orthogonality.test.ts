/**
 * Design-build orthogonality — guard-side invariants I1 / I3.
 *
 * I1 (design closes upward): covering layer N without covering some lower
 * layer is a broken chain. The verdict must be a stored fact
 * (`state.design_coverage`), and the strength of `workflow.top_down_design`
 * decides block vs advisory — no new configuration.
 *
 * I3 (layers are parallel by default): same-layer scopes that call into each
 * other falsify the claim, surfaced as a forceable WARN.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChangeState } from '../../src/core/types.js';
import type { ConstraintStrengthField } from '../../src/core/config.js';

const mockPlanner = vi.fn(() => ({ coupled: [], groups: [], unmapped_scopes: [], graph_available: true, entries: [] }));

vi.mock('../../src/change/parallel-planner.js', () => ({
  planParallelGroups: (...args: unknown[]) => mockPlanner(...(args as [])),
  entryRef: (e: { layer: number; scope: string }) => `L${e.layer}:${e.scope}`,
}));

const savedStates: ChangeState[] = [];

vi.mock('../../src/change/manager.js', () => ({
  getChangeDir: vi.fn((root: string, name: string) => join(root, '.mumuspec', 'changes', name)),
  loadChangeState: vi.fn(),
  saveChangeState: vi.fn((_root: string, _name: string, state: ChangeState) => {
    savedStates.push(state);
  }),
  verifyTestCases: vi.fn(() => ({ valid: true, expectedHash: '', actualHash: '' })),
}));

import { runPhaseGuard } from '../../src/guard/phase-guard.js';
import { loadChangeState } from '../../src/change/manager.js';

const mockLoadState = vi.mocked(loadChangeState);
const CHANGE = 'orthogonality-tc';
const SIGNED_REF = '2026-09-12T00:00:00.000Z';

function makeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE,
    phase: 'design',
    workflow: 'full',
    created_at: SIGNED_REF,
    updated_at: SIGNED_REF,
    affected_scopes: ['src'],
    build_layers: [{ layer: 0, scope: 'src', status: 'pending' }],
    test_cases: { design_locked: true, suites_locked: true, suites_locked_layers: [0], suites_hash: { 0: 'x' } },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 5,
    build_mode: 'executing-plans',
    tdd_mode: 'tdd',
    isolation: 'branch',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: { design: 1 }, content_hash: '' },
    rollback_history: [],
    ...overrides,
  } as ChangeState;
}

/** TD=medium, no override → top_down_design resolves false (project default) */
const MEDIUM: ConstraintStrengthField = {
  technical_design: 'medium',
  requirement_goals: 'high',
} as ConstraintStrengthField;

/** Explicitly enabled rule → the same finding becomes blocking */
const ENABLED: ConstraintStrengthField = {
  technical_design: 'medium',
  requirement_goals: 'high',
  overrides: { workflow: { top_down_design: 'true' } },
} as ConstraintStrengthField;

let testRoot: string;

function writeArtifacts(): void {
  const dir = join(testRoot, '.mumuspec', 'changes', CHANGE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'design.md'),
    '# Design\n\n主体设计内容，超过十个字符。\n<!-- no-open-questions -->\n',
  );
  writeFileSync(join(dir, 'decisions.md'), `# Decision Log: ${CHANGE}\n\n## [design] ${SIGNED_REF}\n\n签收。\n`);
}

beforeEach(() => {
  testRoot = join(tmpdir(), `mumuspec-ortho-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  writeArtifacts();
  mockLoadState.mockReset();
  mockPlanner.mockClear();
  savedStates.length = 0;
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe('I1 — design coverage must have no broken chain', () => {
  it('covering L0 and L2 but not L1 is reported, and the verdict is persisted', () => {
    mockLoadState.mockReturnValue(
      makeState({
        build_layers: [
          { layer: 0, scope: 'a', status: 'pending' },
          { layer: 2, scope: 'b', status: 'pending' },
        ],
      }),
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build', { strength: MEDIUM });

    const warn = result.warnings.find((w) => w.code === 'W-GUARD-009');
    expect(warn).toBeDefined();
    expect(warn!.message).toContain('缺少 L1');
    expect(result.errors.find((e) => e.code === 'E-GUARD-009')).toBeUndefined();

    const coverage = savedStates.at(-1)?.design_coverage;
    expect(coverage).toBeDefined();
    expect(coverage!.covered_layers).toEqual([0, 2]);
    expect(coverage!.expected_layers).toEqual([0, 1, 2]);
    expect(coverage!.unreachable_from).toBe(1);
    expect(coverage!.enforced).toBe(false);
  });

  it('with the rule enabled the same gap blocks (E-GUARD-009)', () => {
    mockLoadState.mockReturnValue(
      makeState({
        build_layers: [
          { layer: 0, scope: 'a', status: 'pending' },
          { layer: 2, scope: 'b', status: 'pending' },
        ],
      }),
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build', { strength: ENABLED });

    expect(result.passed).toBe(false);
    expect(result.errors.find((e) => e.code === 'E-GUARD-009')).toBeDefined();
    expect(result.warnings.find((w) => w.code === 'W-GUARD-009')).toBeUndefined();
    expect(savedStates.at(-1)?.design_coverage?.enforced).toBe(true);
  });

  it('a closed chain produces no finding', () => {
    mockLoadState.mockReturnValue(
      makeState({
        build_layers: [
          { layer: 0, scope: 'a', status: 'pending' },
          { layer: 1, scope: 'b', status: 'pending' },
          { layer: 2, scope: 'c', status: 'pending' },
        ],
      }),
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build', { strength: MEDIUM });

    expect(result.warnings.find((w) => w.code === 'W-GUARD-009')).toBeUndefined();
    expect(savedStates.at(-1)?.design_coverage?.unreachable_from).toBeNull();
  });

  it('layer suites on disk count as coverage', () => {
    const dir = join(testRoot, '.mumuspec', 'changes', CHANGE, 'test-cases');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'layer-0-cases.md'), '# L0\n');
    writeFileSync(join(dir, 'layer-1-cases.md'), '# L1\n');
    mockLoadState.mockReturnValue(makeState({ build_layers: [{ layer: 1, scope: 'b', status: 'pending' }] }));

    const result = runPhaseGuard(testRoot, CHANGE, 'build', { strength: MEDIUM });

    expect(result.warnings.find((w) => w.code === 'W-GUARD-009')).toBeUndefined();
    expect(savedStates.at(-1)?.design_coverage?.covered_layers).toEqual([0, 1]);
  });
});

describe('I3 — same-layer coupling is surfaced at build_to_verify', () => {
  it('a coupled pair produces W-BUILD-001 with evidence', () => {
    mockLoadState.mockReturnValue(
      makeState({
        phase: 'build',
        build_layers: [
          { layer: 1, scope: 'src/guard', status: 'done' },
          { layer: 1, scope: 'src/spec', status: 'done' },
        ],
      }),
    );
    mockPlanner.mockReturnValue({
      coupled: [
        {
          from_scope: 'src/guard',
          to_scope: 'src/spec',
          evidence: ['src/guard/a.ts → src/spec/b.ts'],
          edge_count: 1,
        },
      ],
      groups: [],
      unmapped_scopes: [],
      graph_available: true,
      entries: [],
    });

    const result = runPhaseGuard(testRoot, CHANGE, 'verify');

    const warn = result.warnings.find((w) => w.code === 'W-BUILD-001');
    expect(warn).toBeDefined();
    expect(warn!.message).toContain('src/guard ⇄ src/spec');
    expect(warn!.detail).toContain('src/guard/a.ts → src/spec/b.ts');
    // A forceable WARN, never a hard block.
    expect(result.errors.find((e) => e.code === 'W-BUILD-001')).toBeUndefined();
  });

  it('single-scope layers skip the planner entirely', () => {
    mockLoadState.mockReturnValue(
      makeState({
        phase: 'build',
        build_layers: [
          { layer: 0, scope: 'src/core', status: 'done' },
          { layer: 1, scope: 'src/guard', status: 'done' },
        ],
      }),
    );

    runPhaseGuard(testRoot, CHANGE, 'verify');
    expect(mockPlanner).not.toHaveBeenCalled();
  });
});
