/**
 * Handler-level tests for constraints commands (strength, preset, list, resolve).
 *
 * Strategy: mock all dependencies, register constraints commands, then invoke
 * action handlers to test branch logic including validation, tree resolution,
 * and output formats.
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
let configMocks: { constraint_strength: { technical_design: string; requirement_goals: string; exceptions: string[]; overrides?: Record<string, Record<string, string>> } };

function initConfig() {
  configMocks = {
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'medium',
      exceptions: ['no-eval', 'no-child-process'],
      overrides: {},
    },
  };
  return configMocks;
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('constraints command handlers', () => {
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
    mockLoadConfig.mockReturnValue(initConfig());
    mockGetMumuSpecDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec`);
    mockLoadAllConstraints.mockReturnValue({ files: [], warnings: [] });
    mockResolveRootStrength.mockReturnValue({ technical_design: 'high', requirement_goals: 'medium' });
    mockResolveConstraintTree.mockReturnValue({
      root: {
        scope: '.',
        layer: 0,
        strength: { technical_design: 'high', requirement_goals: 'medium' },
        children: new Map(),
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
      conflicts: [],
    });
    mockResolveWorkflowRule.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── strength command ───────────────────────────────────

  describe('strength handler', () => {
    it('prints current strength when no options given', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength']);

      expect(logSpy).toHaveBeenCalledWith('\nConstraint Strength:');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('technical_design: high'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requirement_goals: medium'));
    });

    it('outputs JSON when --json flag is set', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--json']);

      // Check that JSON.stringify was called on the constraint_strength object
      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"technical_design"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('updates technical_design with --td', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--td', 'medium']);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(mockAppendAuditLog).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Constraint strength updated'));
    });

    it('updates requirement_goals with --rg', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--rg', 'low']);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Constraint strength updated'));
    });

    it('exits on invalid --td value', async () => {
      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--td', 'invalid']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--td must be one of'));
    });

    it('exits on invalid --rg value', async () => {
      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'strength', '--rg', 'extreme']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--rg must be one of'));
    });

    it('exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'strength']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── preset command ────────────────────────────────────

  describe('preset handler', () => {
    it('applies strict preset successfully', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'strict']);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Applied preset "strict"'));
    });

    it('applies balanced preset', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'balanced']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Applied preset "balanced"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('technical_design: medium'));
    });

    it('applies minimal preset', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'minimal']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Applied preset "minimal"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('technical_design: low'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('requirement_goals: low'));
    });

    it('exits on unknown preset', async () => {
      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'constraints', 'preset', 'unknown-preset']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown preset'));
    });
  });

  // ── list command ──────────────────────────────────────

  describe('list handler', () => {
    it('shows message when no constraints files found', async () => {
      mockLoadAllConstraints.mockReturnValue({ files: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No constraints.yaml files found'));
    });

    it('lists constraints from loaded files', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'Use TypeScript strict mode', min_strength: 'medium' }],
            requirement_goals: [{ id: 'RG001', content: 'All APIs must have tests', min_strength: 'high' }],
          },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 constraint(s)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[TD SHALL]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[RG SHALL]'));
    });

    it('filters by dimension with --dimension td', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'Test', min_strength: 'medium' }],
            requirement_goals: [{ id: 'RG001', content: 'Ignored', min_strength: 'high' }],
          },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list', '--dimension', 'td']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 constraint(s)'));
      // RG constraint should not be listed
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).not.toContain('RG001');
    });

    it('outputs as JSON with --json flag', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'Foo', min_strength: 'medium' }],
            requirement_goals: [],
          },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('scope')
      );
      expect(jsonCall).toBeDefined();
    });

    it('warns when constraint files have parse warnings', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [],
        warnings: ['Malformed constraint in line 5'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'list']);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Malformed constraint'));
    });
  });

  // ── resolve command ───────────────────────────────────

  describe('resolve handler', () => {
    it('shows full tree when no scope or conflicts-only flags', async () => {
      mockLoadAllConstraints.mockReturnValue({
        files: [{
          scope: '.',
          forward: {
            technical_design: [{ id: 'TD001', content: 'Foo', min_strength: 'medium' }],
            requirement_goals: [],
          },
          reverse: { technical_design: [], requirement_goals: [] },
        }],
        warnings: [],
      });
      mockResolveConstraintTree.mockReturnValue({
        root: {
          scope: '.', layer: 0,
          strength: { technical_design: 'high', requirement_goals: 'medium' },
          children: new Map(),
          forward: { technical_design: [{ id: 'TD001', content: 'Foo', min_strength: 'medium' }], requirement_goals: [] },
          reverse: { technical_design: [], requirement_goals: [] },
        },
        conflicts: [],
        warnings: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Constraint Tree'));
    });

    it('outputs JSON with --json flag', async () => {
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
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"root"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('shows conflicts-only with --conflicts-only', async () => {
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
        warnings: [],
        conflicts: [{
          dimension: 'technical_design',
          direction: 'forward',
          id: 'TD001',
          resolution: 'highest-min-strength',
          winner: { scope: '.', min_strength: 'high' },
          losers: [{ scope: 'src/api', min_strength: 'medium' }],
        }],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'constraints', 'resolve', '--conflicts-only']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 conflict(s)'));
    });
  });
});
