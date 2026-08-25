/**
 * Deep coverage tests for knowledge-onboard command — init, start, next,
 * complete-step, progress, including role selection, edge cases, and error paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { join } from 'node:path';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockGenerateOnboardingPath,
  mockMkdirSync,
  mockWriteFileSync,
  mockDumpYaml,
  distCoreUtilsPath,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockGenerateOnboardingPath: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockDumpYaml: vi.fn(() => 'mocked-yaml-content'),
  distCoreUtilsPath: process.cwd().replace(/\\/g, '/') + '/dist/core/utils',
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: () => mockFindProjectRoot() };
});

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: () => mockLoadConfig(),
}));

vi.mock('../../../src/knowledge/manager.js', () => ({
  generateOnboardingPath: (...args: unknown[]) => mockGenerateOnboardingPath(...args),
}));

vi.mock('node:fs', () => ({
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
}));

// Runtime require('../../dist/core/utils') — source uses destructuring { dumpYaml }
// Provide multiple path-form variations since vitest relative resolution can differ
vi.mock('../../../dist/core/utils', () => ({
  dumpYaml: (...args: unknown[]) => mockDumpYaml(...args),
}));

vi.mock('../../../dist/core/utils.js', () => ({
  dumpYaml: (...args: unknown[]) => mockDumpYaml(...args),
}));

vi.mock(distCoreUtilsPath, () => ({
  dumpYaml: (...args: unknown[]) => mockDumpYaml(...args),
}));

// Windows path variant
vi.mock(distCoreUtilsPath.replace(/\\/g, '/'), () => ({
  dumpYaml: (...args: unknown[]) => mockDumpYaml(...args),
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge-onboard command — deep coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockMkdirSync.mockImplementation(() => undefined);
    mockWriteFileSync.mockImplementation(() => undefined);
    mockGenerateOnboardingPath.mockReturnValue({
      scope: 'src/core',
      generated_at: '2024-01-01T00:00:00Z',
      generated_for: 'junior',
      total_steps: 3,
      estimated_minutes: 30,
      steps: [
        {
          order: 1,
          code_node: 'src/core/utils.ts',
          code_node_type: 'File',
          reason: 'Foundational utility module',
          knowledge_pages: ['kp-001', 'kp-002'],
          learning_objectives: ['Understand utility patterns'],
          check_questions: ['What is findProjectRoot used for?'],
        },
        {
          order: 2,
          code_node: 'src/core/config.ts',
          code_node_type: 'File',
          reason: 'Configuration loading',
          knowledge_pages: [],
          learning_objectives: ['Learn config structure'],
          check_questions: [],
        },
      ],
    });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── init subcommand ──

  it('init: should call mkdirSync and generate path for scope with default role', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'init', '--scope', 'src/core'], { from: 'user' });
    expect(mockGenerateOnboardingPath).toHaveBeenCalledWith(
      '/fake/root',
      { project: { name: 'test' } },
      'src/core',
      'junior',
    );
    // mkdirSync is called before the require('dist/core/utils') that fails in test env
    expect(mockMkdirSync).toHaveBeenCalled();
  });

  it('init: should use --role option to override default role', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'init', '--scope', 'src/core', '--role', 'senior'], { from: 'user' });
    expect(mockGenerateOnboardingPath).toHaveBeenCalledWith(
      '/fake/root',
      { project: { name: 'test' } },
      'src/core',
      'senior',
    );
  });

  it('init: sanitized filename with path separators on Windows', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'init', '--scope', 'src\\core\\utils', '--role', 'mid'], { from: 'user' });
    expect(mockGenerateOnboardingPath).toHaveBeenCalledWith(
      '/fake/root',
      { project: { name: 'test' } },
      expect.stringMatching(/src.core.utils/),
      'mid',
    );
  });

  it('init: should fall back to console output on fs failure', async () => {
    mockMkdirSync.mockImplementation(() => { throw new Error('EACCES'); });
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'init', '--scope', 'src/core'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Generated path'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3 steps'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"scope":'));
  });

  it('init: should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'init', '--scope', 'src/core'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  // ── start subcommand ──

  it('start: should print first step details', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'start', '--scope', 'src/core'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Onboarding'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3 steps'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Step 1:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('src/core/utils.ts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Foundational utility module'));
  });

  it('start: should print knowledge pages for first step', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'start', '--scope', 'src/core'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('kp-001, kp-002'));
  });

  it('start: should show "no learning path" when total_steps is 0', async () => {
    mockGenerateOnboardingPath.mockReturnValue({
      scope: 'src/empty',
      generated_at: '2024-01-01T00:00:00Z',
      generated_for: 'junior',
      total_steps: 0,
      estimated_minutes: 0,
      steps: [],
    });
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'start', '--scope', 'src/empty'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No learning path available'));
  });

  it('start: should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'start', '--scope', 'src/core'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  // ── next subcommand ──

  it('next: should print learning path summary', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'next', '--scope', 'src/core'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Learning path:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3 steps'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Run \'onboard start\' to begin'));
  });

  it('next: should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'next', '--scope', 'src/core'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  // ── complete-step subcommand ──

  it('complete-step: should log confirmation message', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'complete-step', '--scope', 'src/core', '--step', '2'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Step 2 marked complete'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('src/core'));
  });

  // ── progress subcommand ──

  it('progress: should print progress report', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'progress', '--scope', 'src/core'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Progress for src/core'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('3 total steps'));
  });

  it('progress: should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    await program.parseAsync(['onboard', 'progress', '--scope', 'src/core'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  // ── command registration structure ──

  it('should register all 5 subcommands on program', async () => {
    const { registerOnboardCommands } = await import('../../../src/cli/commands/knowledge-onboard.js');
    const program = new Command();
    registerOnboardCommands(program);
    const onboardCmd = program.commands.find((c) => c.name() === 'onboard');
    expect(onboardCmd).toBeDefined();
    const subNames = onboardCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('init');
    expect(subNames).toContain('start');
    expect(subNames).toContain('next');
    expect(subNames).toContain('complete-step');
    expect(subNames).toContain('progress');
  });
});
