/**
 * Handler-level tests for eval subcommands (init, list, run).
 *
 * Strategy: mock lower-level modules (eval/runner, core/utils),
 * register commands on a fresh Commander program, then invoke handlers
 * via parseAsync() to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ── Mocks ──

vi.mock('../../../src/core/utils.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/core/utils.js')>('../../../src/core/utils.js');
  return {
    ...actual,
    findProjectRoot: vi.fn(),
  };
});

vi.mock('../../../src/eval/runner.js', () => ({
  loadScenario: vi.fn(),
  runScenario: vi.fn(),
  runAllEvals: vi.fn(),
  discoverScenarios: vi.fn(),
  initEvalsDir: vi.fn(),
}));

const { findProjectRoot } = await import('../../../src/core/utils.js');
const {
  initEvalsDir,
  discoverScenarios,
  loadScenario,
  runScenario,
  runAllEvals,
} = await import('../../../src/eval/runner.js');

const mockedFindProjectRoot = vi.mocked(findProjectRoot);
const mockedInitEvalsDir = vi.mocked(initEvalsDir);
const mockedDiscoverScenarios = vi.mocked(discoverScenarios);
const mockedLoadScenario = vi.mocked(loadScenario);
const mockedRunScenario = vi.mocked(runScenario);
const mockedRunAllEvals = vi.mocked(runAllEvals);

// ── Helpers ──

let tempDir: string;

function setupTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumuspec-eval-test-'));
  mkdirSync(join(dir, '.mumuspec', 'evals'), { recursive: true });
  return dir;
}

async function createProgram() {
  const { registerEvalCommands } = await import('../../src/cli/commands/eval.js');
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
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    mockedFindProjectRoot.mockReturnValue(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── init subcommand ──

  describe('init handler', () => {
    it('should print created files on success', async () => {
      mockedInitEvalsDir.mockReturnValue({
        created: [
          join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml'),
          join(tempDir, '.mumuspec', 'evals', 'sample-drift.yaml'),
        ],
        errors: [],
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'init', '--workspace-path', tempDir], { from: 'user' });

      expect(mockedInitEvalsDir).toHaveBeenCalledWith(tempDir);
      expect(logSpy).toHaveBeenCalledWith('✓ Created eval scenarios:');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print errors and exit(1) when init fails', async () => {
      mockedInitEvalsDir.mockReturnValue({
        created: [],
        errors: ['Failed to create evals dir: EACCES'],
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'init', '--workspace-path', tempDir], { from: 'user' });

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to create evals dir: EACCES');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a project', async () => {
      mockedFindProjectRoot.mockReturnValue(undefined);

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'init', '--workspace-path', '/no/such/dir'], { from: 'user' });

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── list subcommand ──

  describe('list handler', () => {
    it('should print guidance when no scenarios found', async () => {
      mockedDiscoverScenarios.mockReturnValue([]);

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No eval scenarios found.');
      expect(logSpy).toHaveBeenCalledWith('  Run `mumuspec eval init` to create sample scenarios.');
    });

    it('should print each scenario name and type', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml');
      writeFileSync(scenarioFile, 'name: sample-compliance\ntype: compliance\n');

      mockedDiscoverScenarios.mockReturnValue([scenarioFile]);
      mockedLoadScenario.mockReturnValue({
        name: 'sample-compliance',
        description: 'Verify compliance',
        type: 'compliance',
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sample-compliance'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('compliance'));
    });

    it('should print error for unloadable scenario', async () => {
      const badFile = join(tempDir, '.mumuspec', 'evals', 'broken.yaml');
      writeFileSync(badFile, 'corrupted content');

      mockedDiscoverScenarios.mockReturnValue([badFile]);
      mockedLoadScenario.mockImplementation(() => {
        throw new Error('Invalid scenario: missing name');
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scenario: missing name')
      );
    });
  });

  // ── run subcommand ──

  describe('run handler', () => {
    it('should run all scenarios when no name given', async () => {
      mockedRunAllEvals.mockReturnValue({
        total: 2,
        passed: 2,
        failed: 0,
        results: [
          {
            scenario: 'test-1',
            passed: true,
            errors: [],
            warnings: [],
            details: 'ok',
            duration: 10,
          },
          {
            scenario: 'test-2',
            passed: true,
            errors: [],
            warnings: [],
            details: 'ok',
            duration: 20,
          },
        ],
        duration: 30,
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(mockedRunAllEvals).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2/2 passed'));
      expect(logSpy).toHaveBeenCalledWith('✓ All scenarios passed.');
    });

    it('should exit(1) and print failure when scenarios fail', async () => {
      mockedRunAllEvals.mockReturnValue({
        total: 2,
        passed: 1,
        failed: 1,
        results: [
          {
            scenario: 'good',
            passed: true,
            errors: [],
            warnings: [],
            details: 'ok',
            duration: 10,
          },
          {
            scenario: 'bad',
            passed: false,
            errors: ['Assertion failed'],
            warnings: [],
            details: 'fail',
            duration: 10,
          },
        ],
        duration: 20,
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(errorSpy).toHaveBeenCalledWith('✗ 1 scenario(s) failed.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run specific scenario when name provided', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'my-test.yaml');
      // Ensure file exists so existsSync passes
      writeFileSync(scenarioFile, 'name: my-test\ntype: compliance\n');

      mockedLoadScenario.mockReturnValue({
        name: 'my-test',
        type: 'compliance',
        projectRoot: tempDir,
      });
      mockedRunScenario.mockReturnValue({
        scenario: 'my-test',
        passed: true,
        errors: [],
        warnings: [],
        details: 'Compliance: 0 errors, 0 warnings',
        duration: 15,
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'run', 'my-test', '--workspace-path', tempDir], { from: 'user' });

      expect(mockedLoadScenario).toHaveBeenCalledWith(scenarioFile);
      expect(logSpy).toHaveBeenCalledWith('✓ my-test');
    });

    it('should exit(1) when specific scenario file not found', async () => {
      const program = await createProgram();
      await program.parseAsync(
        ['node', 'test', 'eval', 'run', 'nonexistent', '--workspace-path', tempDir],
        { from: 'user' }
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scenario "nonexistent" not found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show details in verbose mode', async () => {
      mockedRunAllEvals.mockReturnValue({
        total: 1,
        passed: 1,
        failed: 0,
        results: [
          {
            scenario: 'verbose-test',
            passed: true,
            errors: [],
            warnings: ['Some warning'],
            details: 'Detailed info here',
            duration: 5,
          },
        ],
        duration: 5,
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'run', '--verbose', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('    Detailed info here');
      expect(logSpy).toHaveBeenCalledWith('    ⚠ Some warning');
    });

    it('should print guidance when running all with zero scenarios', async () => {
      mockedRunAllEvals.mockReturnValue({
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
        duration: 0,
      });

      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        'No eval scenarios found. Run `mumuspec eval init` to get started.'
      );
    });
  });

  // ── default action (no subcommand) ──

  describe('default eval action', () => {
    it('should print usage information', async () => {
      const program = await createProgram();
      await program.parseAsync(['node', 'test', 'eval'], { from: 'user' });

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
