/**
 * Extra coverage tests for constraints.ts — targeting uncovered branches.
 *
 * Goals:
 * - resolve: tree recursion with children (line 333)
 * - resolve: conflict output in full tree mode (lines 339-342)
 * - resolve: --scope navigation
 * - resolve: --conflicts-only with no conflicts
 * - resolve: --conflicts-only --json
 * - preset: hotfix and exploratory presets
 * - list: --type shall-not filter
 * - list: --dimension rg filter
 * - strength: both --td and --rg in one call
 * - strength: workflow rule with overrides.workflow
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockSaveConfig,
  mockGetMumuSpecDir,
  mockAppendAuditLog,
  mockLoadAllConstraints,
  mockResolveRootStrength,
  mockResolveConstraintTree,
  mockResolveWorkflowRule,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
  mockGetMumuSpecDir: vi.fn(),
  mockAppendAuditLog: vi.fn(),
  mockLoadAllConstraints: vi.fn(),
  mockResolveRootStrength: vi.fn(),
  mockResolveConstraintTree: vi.fn(),
  mockResolveWorkflowRule: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    getMumuSpecDir: mockGetMumuSpecDir,
    appendAuditLog: mockAppendAuditLog,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
    saveConfig: mockSaveConfig,
    resolveConstraintTree: mockResolveConstraintTree,
    resolveWorkflowRule: mockResolveWorkflowRule,
    STRENGTH_ACTION_MAP: { high: 'block', medium: 'warn', low: 'info' },
    WORKFLOW_RULE_DIMENSION: {
      worktree_isolation: 'technical_design',
      single_active_change: 'technical_design',
      top_down_design: 'requirement_goals',
      tdd_enforced: 'requirement_goals',
    },
    WORKFLOW_STRENGTH_MATRIX: {
      worktree_isolation: { high: true, medium: true, low: false },
      single_active_change: { high: true, medium: true, low: false },
      top_down_design: { high: true, medium: false, low: false },
      tdd_enforced: { high: true, medium: true, low: false },
    },
  };
});

vi.mock('../../../src/core/constraints-loader.js', () => ({
  loadAllConstraints: mockLoadAllConstraints,
  resolveRootStrength: mockResolveRootStrength,
}));

vi.mock('../../../src/core/constraint-evaluator.js', () => ({
  resolveWorkflowRule: mockResolveWorkflowRule,
}));

// Import after mocks
const { registerConstraintsCommands } = await import('../../../src/cli/commands/constraints.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerConstraintsCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';

function makeConfig(overrides?: Record<string, unknown>) {
  return {
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'medium',
      exceptions: [],
      overrides: overrides ?? {},
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('constraints extra coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(makeConfig());
    mockGetMumuSpecDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec`);
    mockLoadAllConstraints.mockReturnValue({ files: [], warnings: [] });
    mockResolveRootStrength.mockReturnValue({ technical_design: 'high', requirement_goals: 'medium' });
    mockResolveWorkflowRule.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── resolve: tree with children (recursive printNode) ──

  describe('resolve with children tree', () => {
    it('recursively prints child nodes in full tree mode', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'medium', requirement_goals: 'medium' },
        children: new Map(),
        forward: { technical_design: [{ id: 'TDC01', content: 'Child rule', min_strength: 'medium' }], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('core');
      expect(output).toContain('L1');
    });

    it('prints conflicts section in full tree mode', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [{
          dimension: 'technical_design',
          direction: 'forward',
          id: 'TD-CLASH',
          resolution: 'highest-min-strength',
          winner: { scope: '.', min_strength: 'high' },
          losers: [{ scope: 'src/api', min_strength: 'low' }],
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 conflict(s)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TD-CLASH'));
    });
  });

  // ── resolve: --scope navigation ──

  describe('resolve --scope', () => {
    it('navigates to a child scope', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'medium', requirement_goals: 'low' },
        children: new Map(),
        forward: {
          technical_design: [{ id: 'TD005', content: 'Use strong types', min_strength: 'medium', inherited: true, tightens: undefined }],
          requirement_goals: [],
        },
        reverse: {
          technical_design: [],
          requirement_goals: [{ id: 'RG003', content: 'No vague requirements', min_strength: 'low', inherited: false, tightens: undefined }],
        },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'core']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scope: core (layer 1)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TD005'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[inherited]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RG003'));
    });

    it('navigates to scope with leading ./', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'high', requirement_goals: 'high' },
        children: new Map(),
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', './core']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scope: core'));
    });

    it('navigates multi-segment scope path (deep tree)', async () => {
      const apiNode = {
        scope: 'core/api',
        layer: 2,
        strength: { technical_design: 'medium', requirement_goals: 'high' },
        children: new Map(),
        forward: {
          technical_design: [{ id: 'TD-DEEP', content: 'Deep rule', min_strength: 'high', inherited: false, tightens: undefined }],
          requirement_goals: [],
        },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      const coreNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'high', requirement_goals: 'medium' },
        children: new Map([['core/api', apiNode]]),
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', coreNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'core/api']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scope: core/api (layer 2)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TD-DEEP'));
    });

    it('navigates to scope with trailing /', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'high', requirement_goals: 'high' },
        children: new Map(),
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'core/']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scope: core'));
    });

    it('outputs scope as JSON with --scope --json', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'high', requirement_goals: 'high' },
        children: new Map(),
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'core', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"scope"') && call[0].includes('"layer"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('shows tightens attribute on constraint entry', async () => {
      const childNode = {
        scope: 'core',
        layer: 1,
        strength: { technical_design: 'high', requirement_goals: 'medium' },
        children: new Map(),
        forward: {
          technical_design: [{
            id: 'TD-TIGHT',
            content: 'Tightened constraint',
            min_strength: 'high',
            inherited: true,
            tightens: { scope: '.', min_strength: 'medium' },
          }],
          requirement_goals: [],
        },
        reverse: { technical_design: [], requirement_goals: [] },
      };
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map([['core', childNode]]),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'core']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[tightens @.]'));
    });

    it('exits when scope not found', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--scope', 'nonexistent']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });
  });

  // ── resolve: --conflicts-only variants ──

  describe('resolve --conflicts-only', () => {
    it('prints no conflicts message when empty', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--conflicts-only']);

      expect(logSpy).toHaveBeenCalledWith('✓ No conflicts detected.');
    });

    it('outputs conflicts-only as JSON', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [{
          dimension: 'technical_design',
          direction: 'forward',
          id: 'TD-JSON',
          resolution: 'highest-min-strength',
          winner: { scope: '.', min_strength: 'high' },
          losers: [],
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--conflicts-only', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('TD-JSON')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── preset: hotfix and exploratory ──

  describe('preset extra', () => {
    it('applies hotfix preset', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'hotfix']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Applied preset "hotfix"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('technical_design: low'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requirement_goals: high'));
    });

    it('applies exploratory preset', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'exploratory']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Applied preset "exploratory"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requirement_goals: low'));
    });
  });

  // ── list: filter variants ──

  describe('list filter variants', () => {
    it('filters by --type shall-not', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'Shall do', min_strength: 'high' }],
            requirement_goals: [],
          },
          reverse: {
            technical_design: [{ id: 'TD002', content: 'Shall not do', min_strength: 'medium' }],
            requirement_goals: [],
          },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list', '--type', 'shall-not']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('TD002');
      expect(output).toContain('SHALL-NOT');
      expect(output).not.toContain('TD001');
    });

    it('filters by --dimension rg', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'TD thing', min_strength: 'high' }],
            requirement_goals: [{ id: 'RG001', content: 'RG thing', min_strength: 'medium' }],
          },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list', '--dimension', 'rg']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 constraint(s)'));
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('RG001');
      expect(output).not.toContain('TD001');
    });

    it('combines --dimension td --type shall-not', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: {
            technical_design: [{ id: 'TD-REV', content: 'Reverse TD', min_strength: 'high' }],
            requirement_goals: [{ id: 'RG-REV', content: 'Reverse RG', min_strength: 'low' }],
          },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list', '--dimension', 'td', '--type', 'shall-not']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 constraint(s)'));
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('TD-REV');
      expect(output).not.toContain('RG-REV');
    });
  });

  // ── strength: combined setters and overrides ──

  describe('strength combined and overrides', () => {
    it('sets both --td and --rg simultaneously', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--td', 'low', '--rg', 'high']);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('technical_design: low'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requirement_goals: high'));
      expect(mockAppendAuditLog).toHaveBeenCalled();
    });

    it('shows workflow rule with override source', async () => {
      mockLoadConfig.mockReturnValue(makeConfig({
        workflow: { single_active_change: 'false' },
      }));
      mockResolveWorkflowRule.mockReturnValue(false);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('override');
      expect(output).toContain('relaxed');
    });
  });

  // ── resolve: not-in-project and empty constraints ──

  describe('resolve edge cases', () => {
    it('exits when not in a project for resolve command', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('shows message when no constraints files found for resolve', async () => {
      mockLoadAllConstraints.mockReturnValue({ files: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']);

      expect(logSpy).toHaveBeenCalledWith('No constraints.yaml files found. The constraint tree is empty.');
    });

    it('preset exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'strict']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('list exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'list']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── resolve: warns from both loadAllConstraints and resolution ──

  describe('resolve warnings combined', () => {
    it('shows warnings from both loader and tree resolution', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: ['Loader warning A'],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: ['Tree warning B'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Loader warning A'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Tree warning B'));
    });
  });
});
