/**
 * Tests for src/guard/phase-guard.ts — Phase guard checks for change lifecycle transitions.
 *
 * Covers runPhaseGuard() entry point with various targetPhase values,
 * mock dependencies, and error code verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';
import type { ConstraintStrengthField } from '../../src/core/config.js';

// ════════════════════════════════════════════════════════════════════
// Mocks
// ════════════════════════════════════════════════════════════════════

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

// Import after mocks are set up
import { runPhaseGuard } from '../../src/guard/phase-guard.js';

// ════════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════════

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: 'test-change',
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
    decisions_log: { counts: { open: 1 }, content_hash: 'abc123' },
    rollback_history: [],
    ...overrides,
  };
}

const PROJECT_ROOT = '/tmp/test-project';
const CHANGE_NAME = 'test-change';

function setupDefaultMocks(): void {
  mockGetChangeDir.mockReturnValue(`${PROJECT_ROOT}/.changes/${CHANGE_NAME}`);
  mockVerifyTestCases.mockReturnValue({ valid: true });
  mockExistsSync.mockReturnValue(true);
  mockReadText.mockReturnValue('# Some content\n\nMore text here for testing.');
  mockComputeHash.mockReturnValue('abc123');
  mockParseYaml.mockReturnValue({});
  // Default: applyStrength returns result as-is
  mockApplyStrengthToGuardResult.mockImplementation(
    (result: unknown) => result as { passed: boolean; errors: unknown[]; warnings: unknown[] },
  );
}

// ════════════════════════════════════════════════════════════════════
// Tests: runPhaseGuard — entry point & phase dispatch
// ════════════════════════════════════════════════════════════════════

describe('runPhaseGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Change not found ──

  it('should return error when change does not exist', () => {
    mockLoadChangeState.mockReturnValue(null);

    const result = runPhaseGuard(PROJECT_ROOT, 'nonexistent', 'design');

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-GUARD-001')).toBe(true);
    expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true);
  });

  it('should call loadChangeState with correct arguments', () => {
    mockLoadChangeState.mockReturnValue(null);

    runPhaseGuard('/my/project', 'my-change', 'build');

    expect(mockLoadChangeState).toHaveBeenCalledWith('/my/project', 'my-change');
  });

  // ── Phase: design → checkOpenToDesign ──

  describe('targetPhase: "design"', () => {
    it('should pass when proposal.md exists with sufficient content', () => {
      const state = makeChangeState({ phase: 'open' });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Proposal\n\nThis is a detailed proposal with enough content.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.passed).toBe(true);
    });

    it('should fail when proposal.md does not exist', () => {
      const state = makeChangeState({ phase: 'open' });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('proposal.md'));

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('proposal.md'))).toBe(true);
    });

    it('should fail when proposal.md content is too short', () => {
      const state = makeChangeState({ phase: 'open' });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('short');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('proposal.md'))).toBe(true);
    });

    it('should warn when delta-specs directory does not exist', () => {
      const state = makeChangeState({ phase: 'open', affected_scopes: ['src/core'] });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('delta-specs'));
      mockReadText.mockReturnValue('# Proposal\n\nThis is a detailed enough proposal.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.warnings.some((w) => w.message.includes('delta-specs'))).toBe(true);
    });

    it('should warn when affected_scopes is empty', () => {
      const state = makeChangeState({ phase: 'open', affected_scopes: [] });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Proposal\n\nThis is a detailed enough proposal.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.warnings.some((w) => w.message.includes('affected_scopes'))).toBe(true);
    });

    it('should detect decisions.md content_hash mismatch', () => {
      const state = makeChangeState({
        phase: 'open',
        decisions_log: { counts: { open: 1 }, content_hash: 'expected-hash' },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockComputeHash.mockReturnValue('actual-hash');
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('# Proposal\n\nThis is a detailed enough proposal.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.errors.some((e) => e.code === 'E-CHANGE-007')).toBe(true);
    });

    it('should warn when no decisions recorded in open phase', () => {
      const state = makeChangeState({
        phase: 'open',
        decisions_log: { counts: {}, content_hash: undefined },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Proposal\n\nThis is a detailed enough proposal.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design');

      expect(result.warnings.some((w) => w.message.includes('决策记录'))).toBe(true);
    });
  });

  // ── Phase: build → checkDesignToBuild (full workflow) ──

  describe('targetPhase: "build" (full workflow)', () => {
    it('should pass when design.md exists and all conditions met', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          design_content_hash: 'hash1',
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nThis is a detailed design document with layers.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(true);
    });

    it('should fail when design.md does not exist', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('design.md'));

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('design.md'))).toBe(true);
    });

    it('should fail when design.md content is empty', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('design.md'))).toBe(true);
    });

    it('should fail when build_layers is empty', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nSome detailed design content here.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('build_layers'))).toBe(true);
    });

    it('should fail when test_cases is not locked', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: false,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nSome detailed design content here.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('未锁定'))).toBe(true);
    });

    it('should fail when test-cases hash does not match', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          design_content_hash: 'expected-hash',
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nSome detailed design content here.');
      mockVerifyTestCases.mockReturnValue({
        valid: false,
        expectedHash: 'expected-hash',
        actualHash: 'actual-hash',
      });

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-GUARD-004')).toBe(true);
    });

    it('should fail when tdd_mode is not tdd', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        tdd_mode: 'optional',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nSome detailed design content here.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('tdd_mode'))).toBe(true);
    });

    it('should warn when constraints files are missing', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation(
        (p: string) => !p.includes('new-shall.md') && !p.includes('new-shall-not.md'),
      );
      mockReadText.mockReturnValue('# Design\n\nSome detailed design content here.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.warnings.some((w) => w.message.includes('constraints'))).toBe(true);
    });

    it('should fail with E-DESIGN-009 when design schema has missing required sections', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nSome limited content.');
      mockExistsSync.mockImplementation(
        (p: string) => p.includes('design.md') || p.includes('design-schema.yaml'),
      );
      mockParseYaml.mockReturnValue({
        sections: [
          {
            name: 'Tech Stack',
            patterns: ['## Tech Stack'],
            required_for: ['full'],
          },
        ],
      });

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-009')).toBe(true);
    });
  });

  // ── Phase: build (hotfix workflow → checkOpenToBuildHotfix) ──

  describe('targetPhase: "build" (hotfix workflow)', () => {
    it('should pass when hotfix conditions are met', () => {
      const state = makeChangeState({
        phase: 'open',
        workflow: 'hotfix',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        tdd_mode: 'tdd',
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation(
        (p: string) => p.includes('proposal.md') || p.includes('test-cases'),
      );

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(true);
    });

    it('should fail when proposal.md is missing for hotfix', () => {
      const state = makeChangeState({
        phase: 'open',
        workflow: 'hotfix',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        tdd_mode: 'tdd',
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('proposal.md'));

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('proposal.md'))).toBe(true);
    });

    it('should fail when test-cases dir is missing for hotfix', () => {
      const state = makeChangeState({
        phase: 'open',
        workflow: 'hotfix',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        tdd_mode: 'tdd',
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('test-cases'));

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('test-cases'))).toBe(true);
    });

    it('should fail when tdd_mode is not tdd for hotfix', () => {
      const state = makeChangeState({
        phase: 'open',
        workflow: 'hotfix',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        tdd_mode: 'optional',
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('tdd_mode'))).toBe(true);
    });

    it('should pass for tweak workflow', () => {
      const state = makeChangeState({
        phase: 'open',
        workflow: 'tweak',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        tdd_mode: 'tdd',
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.passed).toBe(true);
    });
  });

  // ── Phase: verify → checkBuildToVerify ──

  describe('targetPhase: "verify"', () => {
    it('should pass when all build layers are done', () => {
      const state = makeChangeState({
        phase: 'build',
        workflow: 'full',
        build_layers: [
          { layer: 1, scope: 'src/core', status: 'done' },
          { layer: 2, scope: 'src/cli', status: 'done' },
        ],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'verify');

      expect(result.passed).toBe(true);
    });

    it('should fail when build layers are not done', () => {
      const state = makeChangeState({
        phase: 'build',
        workflow: 'full',
        build_layers: [
          { layer: 1, scope: 'src/core', status: 'done' },
          { layer: 2, scope: 'src/cli', status: 'in-progress' },
        ],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'verify');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-GUARD-002')).toBe(true);
    });

    it('should fail when test cases design lock was reset', () => {
      const state = makeChangeState({
        phase: 'build',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: false,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'verify');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-GUARD-004')).toBe(true);
    });

    it('should warn when suites not locked', () => {
      const state = makeChangeState({
        phase: 'build',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      });
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'verify');

      expect(result.warnings.some((w) => w.message.includes('suites'))).toBe(true);
    });

    it('should return correct error with pending layer count', () => {
      const state = makeChangeState({
        phase: 'build',
        workflow: 'full',
        build_layers: [
          { layer: 1, scope: 'src/core', status: 'in-progress' },
          { layer: 2, scope: 'src/cli', status: 'pending' },
          { layer: 3, src: 'src/guard', status: 'done' },
        ],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      } as ChangeState);
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'verify');

      const buildError = result.errors.find((e) => e.code === 'E-GUARD-002');
      expect(buildError).toBeDefined();
      expect(buildError!.message).toContain('2');
    });
  });

  // ── Phase: archive-in-progress → checkVerifyToArchive ──

  describe('targetPhase: "archive-in-progress"', () => {
    it('should pass when all conditions met', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('# Verify\n\nAll SHALL and SHALL NOT verified.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(true);
    });

    it('should fail when verify.md does not exist', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockImplementation((p: string) => !p.includes('verify.md'));

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.message.includes('verify.md'))).toBe(true);
    });

    it('should fail when verify_result is not pass', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'fail',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-VERIFY-001')).toBe(true);
    });

    it('should fail when branch_status is not handled', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass',
        branch_status: 'pending',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-VERIFY-002')).toBe(true);
    });

    it('should fail when test immutability check fails', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockVerifyTestCases.mockReturnValue({ valid: false });

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-GUARD-004')).toBe(true);
    });

    it('should pass with pass-with-deviations verify_result', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass-with-deviations',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('# Verify\n\nSHALL verification complete.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.passed).toBe(true);
    });

    it('should warn when verify.md lacks SHALL/SHALL NOT', () => {
      const state = makeChangeState({
        phase: 'verify',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        verify_result: 'pass',
        branch_status: 'handled',
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('# Verify\n\nVerification summary without constraints.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'archive-in-progress');

      expect(result.warnings.some((w) => w.code === 'W-VERIFY-001')).toBe(true);
    });
  });

  // ── Unknown phase ──

  describe('unknown targetPhase', () => {
    it('should return E-CHANGE-006 for unknown phase', () => {
      const state = makeChangeState({ phase: 'open' });
      mockLoadChangeState.mockReturnValue(state);

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'unknown-phase');

      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.code === 'E-CHANGE-006')).toBe(true);
    });
  });

  // ── Strength application ──

  describe('strength option', () => {
    it('should pass strength to applyStrengthToGuardResult', () => {
      const state = makeChangeState({ phase: 'open' });
      mockLoadChangeState.mockReturnValue(null);

      const strength: ConstraintStrengthField = {
        technical_design: 'high',
        requirement_goals: 'medium',
      };

      runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'design', { strength });

      expect(mockApplyStrengthToGuardResult).toHaveBeenCalledWith(
        expect.any(Object),
        strength,
      );
    });
  });

  // ── Cognitive framework (full workflow) ──

  describe('cognitive framework checks (full workflow)', () => {
    it('should fail when cognitive_map_ref is missing', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: undefined,
          q1_count: 3,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 4,
          converged: true,
          rounds_completed: 5,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-001')).toBe(true);
    });

    it('should fail when Q1 is empty', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
          q1_count: 0,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 4,
          converged: true,
          rounds_completed: 5,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-002')).toBe(true);
    });

    it('should fail when Q2 has pending and rounds < 5', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
          q1_count: 3,
          q2_pending: 2,
          q3_pending: 0,
          q4_scans_completed: 4,
          converged: true,
          rounds_completed: 3,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-003')).toBe(true);
    });

    it('should fail when Q4 scans < 3', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
          q1_count: 3,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 1,
          converged: true,
          rounds_completed: 5,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-005')).toBe(true);
    });

    it('should fail when cognitive map not converged', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
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
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-006')).toBe(true);
    });

    it('should pass when cognitive framework fully complete', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: '.mumuspec/cognitive-map.yaml',
          q1_count: 3,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 4,
          converged: true,
          rounds_completed: 5,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      const cognitiveErrors = result.errors.filter((e) =>
        e.code.startsWith('E-DESIGN-00') && e.code !== 'E-DESIGN-009' && e.code !== 'E-DESIGN-010',
      );
      expect(cognitiveErrors.length).toBe(0);
    });
  });

  // ── Grill-me checks ──

  describe('grill-me result checks', () => {
    it('should fail when grill-me is not completed', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        grill_me_result: {
          completed: false,
          rounds: 2,
          max_rounds: 5,
          deferred_count: 0,
          consensus_reached: false,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-007')).toBe(true);
    });

    it('should fail when grill-me exceeds max rounds', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        grill_me_result: {
          completed: true,
          rounds: 7,
          max_rounds: 5,
          deferred_count: 0,
          consensus_reached: true,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-008')).toBe(true);
    });

    it('should warn when grill-me has deferred without consensus', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        grill_me_result: {
          completed: true,
          rounds: 3,
          max_rounds: 5,
          deferred_count: 2,
          consensus_reached: false,
        },
      });
      mockLoadChangeState.mockReturnValue(state);
      mockReadText.mockReturnValue('# Design\n\nDetailed design with layers and more content. Implementation Layers: Setup.');

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.warnings.some((w) => w.code === 'W-DESIGN-001')).toBe(true);
    });
  });

  // ── Cross-artifact consistency ──

  describe('cross-artifact consistency checks', () => {
    it('should detect E-DESIGN-010 when proposal Plan steps missing from design', () => {
      const state = makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        affected_scopes: ['src/core'],
      });
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);

      // Rejection: proposal has Plan section with steps that design doesn't reference
      mockReadText.mockImplementation((p: string) => {
        if (p.includes('proposal.md')) {
          return '# Proposal\n\n## Plan\n- Setup database\n- Create API layer\n- Build UI components\n- Write tests';
        }
        if (p.includes('design.md')) {
          return '# Design\n\n## Architecture\nOnly mentions Setup database.\n## Implementation Layers\nSetup database';
        }
        return '';
      });

      const result = runPhaseGuard(PROJECT_ROOT, CHANGE_NAME, 'build');

      expect(result.errors.some((e) => e.code === 'E-DESIGN-010')).toBe(true);
    });
  });
});
