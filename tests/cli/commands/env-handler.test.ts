/**
 * Handler-level tests for env subcommands (detect, validate, diff).
 *
 * Strategy: mock lower-level modules (core/utils, core/env-detector, cli/helpers),
 * register env commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockDetectEnvironment,
  mockSaveEnvSpec,
  mockValidateEnv,
  mockDiffEnv,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockDetectEnvironment: vi.fn(),
  mockSaveEnvSpec: vi.fn(),
  mockValidateEnv: vi.fn(),
  mockDiffEnv: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/core/env-detector.js', () => ({
  detectEnvironment: mockDetectEnvironment,
  saveEnvSpec: mockSaveEnvSpec,
  validateEnv: mockValidateEnv,
  diffEnv: mockDiffEnv,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('env command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const mockDetection = {
    timestamp: '2026-01-15T10:00:00Z',
    os: { type: 'Windows', version: '10.0', arch: 'x64' },
    tools: [
      { name: 'node', ecosystem: 'build', status: 'ok' as const, version: '22.0.0', location: 'C:\\nodejs' },
      { name: 'git', ecosystem: 'build', status: 'ok' as const, version: '2.40.0' },
      { name: 'python', ecosystem: 'python', status: 'missing' as const, version: 'unknown' },
    ],
    missing: ['python'],
    warnings: [],
  };

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockDetectEnvironment.mockReset();
    mockSaveEnvSpec.mockReset();
    mockValidateEnv.mockReset();
    mockDiffEnv.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockDetectEnvironment.mockResolvedValue(mockDetection);
    mockSaveEnvSpec.mockResolvedValue('/fake/root/.mumuspec/env-spec.md');
    mockValidateEnv.mockResolvedValue({ exitCode: 0, messages: [], suggestions: [] });
    mockDiffEnv.mockResolvedValue('Environment Diff Result');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── detect subcommand ──

  describe('env detect handler', () => {
    it('should display environment detection output', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Environment Detection'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Windows'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('node'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('git'));
    });

    it('should output JSON when --json flag is set', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect', '--json'], { from: 'user' });

      const calls = logSpy.mock.calls.flat();
      const jsonOutput = calls.find((c) => typeof c === 'string' && c.includes('"os"'));
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.os.type).toBe('Windows');
    });

    it('should save to env-spec.md when --save flag is set', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect', '--save'], { from: 'user' });

      expect(mockSaveEnvSpec).toHaveBeenCalledWith('/fake/root', mockDetection);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Saved to .mumuspec/env-spec.md'),
      );
    });

    it('should pass ecosystem filter to detectEnvironment', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect', '--ecosystem', 'node'], { from: 'user' });

      expect(mockDetectEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({ ecosystems: ['node'], projectRoot: '/fake/root' }),
      );
    });

    it('should display missing count when tools are missing', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('1 missing'),
      );
    });

    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle detection errors gracefully', async () => {
      mockDetectEnvironment.mockRejectedValue(new Error('detection failed'));

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment detection failed: detection failed'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── validate subcommand ──

  describe('env validate handler', () => {
    it('should call validateEnv and exit with returned code', async () => {
      mockValidateEnv.mockResolvedValue({ exitCode: 0, messages: ['OK'], suggestions: [] });

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate'], { from: 'user' }).catch(() => {});

      expect(mockValidateEnv).toHaveBeenCalledWith('/fake/root', { strict: undefined });
    });

    it('should show suggestions when --fix is given and exit code is 0', async () => {
      mockValidateEnv.mockResolvedValue({
        exitCode: 0,
        messages: [],
        suggestions: ['Install node', 'Update git'],
      });

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate', '--fix'], { from: 'user' }).catch(() => {});

      expect(logSpy).toHaveBeenCalledWith('Suggestions:');
      expect(logSpy).toHaveBeenCalledWith('  • Install node');
      expect(logSpy).toHaveBeenCalledWith('  • Update git');
    });

    it('should pass strict option to validateEnv', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate', '--strict'], { from: 'user' }).catch(() => {});

      expect(mockValidateEnv).toHaveBeenCalledWith('/fake/root', { strict: true });
    });

    it('should exit(3) on validation error', async () => {
      mockValidateEnv.mockRejectedValue(new Error('Spec corrupted'));

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed: Spec corrupted'),
      );
      expect(exitSpy).toHaveBeenCalledWith(3);
    });
  });

  // ── diff subcommand ──

  describe('env diff handler', () => {
    it('should display diff output', async () => {
      mockDiffEnv.mockResolvedValue('Diff: node v22 vs v20');

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'diff'], { from: 'user' });

      expect(mockDiffEnv).toHaveBeenCalledWith('/fake/root', undefined);
      expect(logSpy).toHaveBeenCalledWith('Diff: node v22 vs v20');
    });

    it('should pass --against option to diffEnv', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'diff', '--against', '/path/to/spec.md'], { from: 'user' });

      expect(mockDiffEnv).toHaveBeenCalledWith('/fake/root', '/path/to/spec.md');
    });

    it('should exit(1) on diff error', async () => {
      mockDiffEnv.mockRejectedValue(new Error('File not found'));

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'diff'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Diff failed: File not found'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'diff'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
