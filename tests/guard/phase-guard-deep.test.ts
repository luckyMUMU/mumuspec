/**
 * Deep tests for src/guard/phase-guard.ts — schema-required sections,
 * applyStrength output transforms, FR cross-artifact checks, and edge cases.
 *
 * Goal: increase src/guard/phase-guard.ts coverage beyond current ~88.88%.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLoadChangeState = vi.fn();
const mockGetChangeDir = vi.fn();
const mockVerifyTestCases = vi.fn();
const mockApplyStrengthToGuardResult = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReadText = vi.fn();
const mockComputeHash = vi.fn();
const mockParseYaml = vi.fn();

vi.mock('../../src/change/manager.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
  verifyTestCases: (...args: unknown[]) => mockVerifyTestCases(...args),
}));

// Completeness gate validator is mocked out in these hermetic phase-guard
// unit tests — the real gate chain (validator + fs) is covered by
// tests/guard/completeness-gate.test.ts (goal-p0-dispatch-gate).
vi.mock('../../src/change/artifact-validator.js', () => ({
  validateArtifact: vi.fn(() => ({
    exists: true,
    isValid: true,
    errors: [],
    openItemIds: [],
    items: [{ id: 'OQ-1', status: 'resolved' }],
  })),
  extractDecisionRefs: vi.fn(() => []),
}));

vi.mock('../../src/guard/checker.js', () => ({
  applyStrengthToGuardResult: (result: unknown, strength?: unknown) =>
    mockApplyStrengthToGuardResult(result, strength),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: vi.fn(() => []),
}));

vi.mock('../../src/core/utils.js', () => ({
  readText: (...args: unknown[]) => mockReadText(...args),
  computeHash: (...args: unknown[]) => mockComputeHash(...args),
}));

vi.mock('yaml', () => ({
  parse: (...args: unknown[]) => mockParseYaml(...args),
}));

import { runPhaseGuard } from '../../src/guard/phase-guard.js';
import type { ChangeState } from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Constants & helpers
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-pg-deep';
const CHANGE_NAME = 'deep-change';

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE_NAME,
    phase: 'open',
    workflow: 'full',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    affected_scopes: ['src/core'],
    build_layers: [],
    test_cases: {
      design_locked: false,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'incremental',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: { open: 1 }, content_hash: undefined },
    rollback_history: [],
    ...overrides,
  };
}

function setupDefaultMocks(): void {
  mockGetChangeDir.mockReturnValue(`${PROJECT_ROOT}/.changes/${CHANGE_NAME}`);
  mockVerifyTestCases.mockReturnValue({ valid: true });
  mockExistsSync.mockReturnValue(true);
  mockReadText.mockReturnValue('# Some content\n\nMore text here for testing.');
  mockComputeHash.mockReturnValue('abc');
  mockParseYaml.mockReturnValue({});
  mockApplyStrengthToGuardResult.mockImplementation(
    (result: unknown) => result as { passed: boolean; errors: unknown[]; warnings: unknown[] },
  );
}

// ════════════════════════════════════════════════════════════════════
// Test suite
// ════════════════════════════════════════════════════════════════════

describe('phase-guard-deep: schema-required sections edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should not throw when templates/design-schema.yaml exists but has empty sections array', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    });
    mockLoadChangeState.mockReturnValue(state);

    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('# Design\n\nWell-formed design doc with enough content to pass check.');

    mockReadFileSync.mockReturnValue('sections: []\n');
    mockParseYaml.mockReturnValue({ sections: [] });

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.passed).toBe(true);
  });

  it('should skip schema check when templates/design-schema.yaml does not exist', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    });
    mockLoadChangeState.mockReturnValue(state);

    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('design-schema.yaml')) return false;
      return true;
    });
    mockReadText.mockReturnValue('# Design\n\nWell-formed design doc with enough content to pass check.');

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.passed).toBe(true);
  });

  it('should skip section validation for schema entries where required_for does not match workflow', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'hotfix',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    });
    mockLoadChangeState.mockReturnValue(state);

    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('# Design\n\nHotfix with concise design.');

    mockReadFileSync.mockReturnValue(`
sections:
  - name: Deep Analysis
    patterns:
      - "## Deep Analysis"
    required_for:
      - full
`);
    mockParseYaml.mockReturnValue({
      sections: [
        {
          name: 'Deep Analysis',
          patterns: ['## Deep Analysis'],
          required_for: ['full'],
        },
      ],
    });

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.passed).toBe(true);
  });
});

describe('phase-guard-deep: applyStrength transforms result', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should return the transformed result when applyStrength downgrades warnings', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      cognitive_framework: {
        enabled: true,
        cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
        q1_count: 3,
        q2_pending: 0,
        q3_pending: 0,
        q4_scans_completed: 4,
        converged: false,
        rounds_completed: 5,
      },
    });
    mockLoadChangeState.mockReturnValue(state);
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('# Design\n\nDetailed design with layers. Implementation Layers: Setup, Build, Test.');

    mockApplyStrengthToGuardResult.mockImplementation((rawResult: unknown) => {
      const r = rawResult as { passed: boolean; errors: unknown[]; warnings: unknown[] };
      return {
        ...r,
        warnings: r.warnings.filter((w: any) => w.code !== 'W-DESIGN-006'),
      };
    });

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.warnings.some((w: any) => w.code === 'W-DESIGN-006')).toBe(false);
  });

  it('should pass through when applyStrength returns identity', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      cognitive_framework: {
        enabled: true,
        cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
        q1_count: 3,
        q2_pending: 0,
        q3_pending: 0,
        q4_scans_completed: 4,
        converged: false,
        rounds_completed: 5,
      },
    });
    mockLoadChangeState.mockReturnValue(state);
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('# Design\n\nDetailed design with layers. Implementation Layers: Setup, Build, Test.');

    mockApplyStrengthToGuardResult.mockImplementation((r: unknown) => r as any);

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.warnings.some((w: any) => w.code === 'W-DESIGN-006')).toBe(true);
  });
});

describe('phase-guard-deep: FR cross-artifact proposal tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should detect proposal FR- references missing from design', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    });
    mockLoadChangeState.mockReturnValue(state);

    mockExistsSync.mockReturnValue(true);

    mockReadText.mockImplementation((p: string) => {
      if (p.includes('proposal.md')) {
        return '# Proposal\n\n## Requirements\n- FR-1: user login\n- FR-2: data export\n- FR-3: dashboard\n';
      }
      if (p.includes('design.md')) {
        return '# Design\n\n## Architecture\nFR-1 is handled.\n## Implementation Layers\nStep 1, Step 2';
      }
      return '';
    });

    mockReadFileSync.mockReturnValue('sections: []\n');
    mockParseYaml.mockReturnValue({ sections: [] });

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    expect(result.warnings.some((w: any) => w.code === 'W-DESIGN-010')).toBe(true);
  });
});

describe('phase-guard-deep: E-DESIGN-009 with partial section match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should fire E-DESIGN-009 when some sections match but one does not', () => {
    const state = makeChangeState({
      phase: 'design',
      workflow: 'full',
      build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    });
    mockLoadChangeState.mockReturnValue(state);

    mockExistsSync.mockReturnValue(true);
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('design.md')) {
        return '# Design\n\n## Tech Stack\nUses TypeScript\n\n(but no Data Model section)';
      }
      return '';
    });

    mockReadFileSync.mockReturnValue(`
sections:
  - name: Tech Stack
    patterns:
      - "## Tech Stack"
    required_for:
      - full
  - name: Data Model
    patterns:
      - "## Data Model"
    required_for:
      - full
`);
    mockParseYaml.mockReturnValue({
      sections: [
        { name: 'Tech Stack', patterns: ['## Tech Stack'], required_for: ['full'] },
        { name: 'Data Model', patterns: ['## Data Model'], required_for: ['full'] },
      ],
    });

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');
    // CHG-5 (0.20): design template check downgraded from error to warning
    expect(result.passed).toBe(true);
    expect(result.warnings.some((w: any) => w.code === 'W-DESIGN-009')).toBe(true);
  });
});

describe('phase-guard-deep: open_to_design — boundary and unchecked paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('should pass design guard with proposal.md content exactly at 10 char minimum', () => {
    const state = makeChangeState({ phase: 'open' });
    mockLoadChangeState.mockReturnValue(state);
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('1234567890'); // exactly 10 chars

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');
    expect(result.passed).toBe(true);
  });

  it('should fail when proposal.md has only 9 chars (below min)', () => {
    const state = makeChangeState({ phase: 'open' });
    mockLoadChangeState.mockReturnValue(state);
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('123456789'); // 9 chars

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');
    expect(result.passed).toBe(false);
  });

  it('should pass when decisions.md has no content_hash set', () => {
    const state = makeChangeState({
      phase: 'open',
      decisions_log: { counts: { open: 1 }, content_hash: undefined },
    });
    mockLoadChangeState.mockReturnValue(state);
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('# Proposal\n\nThis is a long enough proposal.');
    mockComputeHash.mockReturnValue('irrelevant-hash');

    const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');
    expect(result.errors.some((e: any) => e.code === 'E-CHANGE-007')).toBe(false);
  });
});
