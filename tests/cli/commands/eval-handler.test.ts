/**
 * Handler-level tests for eval subcommands (init, list, run).
 *
 * Strategy: mock lower-level modules (eval/runner, core/utils),
 * register commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Mock functions (shared references) ──
const mockFindProjectRoot = vi.fn();
const mockInitEvalsDir = vi.fn();
const mockDiscoverScenarios = vi.fn();
const mockLoadScenario = vi.fn();
const mockRunScenario = vi.fn();
const mockRunAllEvals = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/eval/runner.js', () => ({
  loadScenario: mockLoadScenario,
  runScenario: mockRunScenario,
  runAllEvals: mockRunAllEvals,
  discoverScenarios: mockDiscoverScenarios,
  initEvalsDir: mockInitEvalsDir,
}));

// ── Helpers ──

let tempDir: string;

function setupTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumuspec-eval-test-'));
  mkdirSync(join(dir, '.mumuspec', 'evals'), { recursive: true });
  return dir;
}

async function createProgram() {
  const { registerEvalCommands } = await import('../../../src/cli/commands/eval.js');
  const program = new Command();
  registerEvalCommands(program);
  return program;
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('eval handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = setupTempDir();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    // Reset all mock functions (factory mocks are NOT reset by restoreAllMocks)
    mockFindProjectRoot.mockReset();
    mockInitEvalsDir.mockReset();
    mockDiscoverScenarios.mockReset();
    mockLoadScenario.mockReset();
    mockRunScenario.mockReset();
    mockRunAllEvals.mockReset();
    mockFindProjectRoot.mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── init subcommand ──

  describe('init handler', () => {
    it('should print created files on success', async () => {
      mockInitEvalsDir.mockReturnValue({
        created: [
          join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml'),
          join(tempDir, '.mumuspec', 'evals', 'sample-drift.yaml'),
        ],
        errors: [],
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', tempDir], { from: 'user' });

      expect(mockInitEvalsDir).toHaveBeenCalledWith(tempDir);
      expect(logSpy).toHaveBeenCalledWith('✓ Created eval scenarios:');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print errors and exit(1) when init fails', async () => {
      mockInitEvalsDir.mockReturnValue({
        created: [],
        errors: ['Failed to create evals dir: EACCES'],
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', tempDir], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to create evals dir: EACCES');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', '/no/such/dir'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── list subcommand ──

  describe('list handler', () => {
    it('should print guidance when no scenarios found', async () => {
      mockDiscoverScenarios.mockReturnValue([]);

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No eval scenarios found.');
      expect(logSpy).toHaveBeenCalledWith('  Run `mumuspec eval init` to create sample scenarios.');
    });

    it('should print each scenario name and type', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml');
      writeFileSync(scenarioFile, 'name: sample-compliance\ntype: compliance\n');

      mockDiscoverScenarios.mockReturnValue([scenarioFile]);
      mockLoadScenario.mockReturnValue({
        name: 'sample-compliance',
        description: 'Verify compliance',
        type: 'compliance',
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sample-compliance'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('compliance'));
    });

    it('should print error for unloadable scenario', async () => {
      const badFile = join(tempDir, '.mumuspec', 'evals', 'broken.yaml');
      writeFileSync(badFile, 'corrupted content');

      mockDiscoverScenarios.mockReturnValue([badFile]);
      mockLoadScenario.mockImplementation(() => {
        throw new Error('Invalid scenario: missing name');
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scenario: missing name')
      );
    });
  });

  // ── run subcommand ──

  describe('run handler', () => {
    it('should run all scenarios when no name given', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 2,
        passed: 2,
        failed: 0,
        results: [
          { scenario: 'test-1', passed: true, errors: [], warnings: [], details: 'ok', duration: 10 },
          { scenario: 'test-2', passed: true, errors: [], warnings: [], details: 'ok', duration: 20 },
        ],
        duration: 30,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(mockRunAllEvals).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2/2 passed'));
      expect(logSpy).toHaveBeenCalledWith('✓ All scenarios passed.');
    });

    it('should exit(1) and print failure when scenarios fail', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 2,
        passed: 1,
        failed: 1,
        results: [
          { scenario: 'good', passed: true, errors: [], warnings: [], details: 'ok', duration: 10 },
          { scenario: 'bad', passed: false, errors: ['Assertion failed'], warnings: [], details: 'fail', duration: 10 },
        ],
        duration: 20,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ 1 scenario(s) failed.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run specific scenario when name provided', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'my-test.yaml');
      writeFileSync(scenarioFile, 'name: my-test\ntype: compliance\n');

      mockLoadScenario.mockReturnValue({
        name: 'my-test',
        type: 'compliance',
        projectRoot: tempDir,
      });
      mockRunScenario.mockReturnValue({
        scenario: 'my-test',
        passed: true,
        errors: [],
        warnings: [],
        details: 'Compliance: 0 errors, 0 warnings',
        duration: 15,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', 'my-test', '--workspace-path', tempDir], { from: 'user' });

      expect(mockLoadScenario).toHaveBeenCalledWith(scenarioFile);
      // The handler prints: `  ${icon} ${result.scenario}` which has leading spaces
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ my-test'));
    });

    it('should exit(1) when specific scenario file not found', async () => {
      const program = await createProgram();
      await program.parseAsync(
        ['eval', 'run', 'nonexistent', '--workspace-path', tempDir],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scenario "nonexistent" not found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show details in verbose mode', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 1,
        passed: 1,
        failed: 0,
        results: [
          { scenario: 'verbose-test', passed: true, errors: [], warnings: ['Some warning'], details: 'Detailed info here', duration: 5 },
        ],
        duration: 5,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--verbose', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('    Detailed info here');
      expect(logSpy).toHaveBeenCalledWith('    ⚠ Some warning');
    });

    it('should print guidance when running all with zero scenarios', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
        duration: 0,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        'No eval scenarios found. Run `mumuspec eval init` to get started.'
      );
    });
  });

  // ── default action (no subcommand) ──

  describe('default eval action', () => {
    it('should print usage information', async () => {
      const program = await createProgram();
      await program.parseAsync(['eval'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Create sample eval scenarios')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('List available scenarios')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Run scenarios (all or specific)')
      );
    });
  });
});
