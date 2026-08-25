/**
 * Supplementary tests for src/cli/helpers.ts.
 *
 * Focuses on executeChat (json + panel mode) and createAgentInstallSubcommand
 * branches not covered by tests/cli/helpers.test.ts.
 *
 * ui-helpers.ts and index.ts functions are intentionally NOT covered here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Hoisted mocks ──
const {
  mockAnswerQuery,
  mockGetManifest,
  mockSearchPackages,
  mockResolvePackage,
  mockInstallPackage,
  mockListInstalledAgentSkills,
  mockFormatAgentInstalledSkills,
} = vi.hoisted(() => ({
  mockAnswerQuery: vi.fn(),
  mockGetManifest: vi.fn(),
  mockSearchPackages: vi.fn(),
  mockResolvePackage: vi.fn(),
  mockInstallPackage: vi.fn(),
  mockListInstalledAgentSkills: vi.fn(),
  mockFormatAgentInstalledSkills: vi.fn(),
}));

vi.mock('../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

vi.mock('../../src/install/installer.js', () => ({
  getManifest: mockGetManifest,
  searchPackages: mockSearchPackages,
  resolvePackage: mockResolvePackage,
  installPackage: mockInstallPackage,
  listInstalledAgentSkills: mockListInstalledAgentSkills,
  formatAgentInstalledSkills: mockFormatAgentInstalledSkills,
}));

// Import after mocks
const {
  executeChat,
  createAgentInstallSubcommand,
} = await import('../../src/cli/helpers.js');

// ════════════════════════════════════════════════════════════════════
// Tests — executeChat
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > executeChat', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockAnswerQuery.mockReturnValue({
      query: 'How does TDD work?',
      confidence: 0.92,
      answer: 'TDD is test-driven development...',
      references: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs JSON when jsonMode is true', () => {
    executeChat('/root', {} as never, 'How does TDD work?', true);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('"query"');
    expect(output).toContain('"confidence"');
    expect(output).toContain('"answer"');
    // JSON mode should NOT output panel border
    expect(output).not.toContain('CHAT ANSWER');
  });

  it('outputs panel format when jsonMode is false', () => {
    executeChat('/root', {} as never, 'How does TDD work?', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('CHAT ANSWER');
    expect(output).toContain('Query: How does TDD work?');
    expect(output).toContain('Confidence: 0.92');
    expect(output).toContain('TDD is test-driven development...');
  });

  it('renders references when present in panel mode', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'ref-test',
      confidence: 0.8,
      answer: 'answer with refs',
      references: [
        { id: 'ref-1', title: 'Spec Guide', type: 'doc', relevance: 0.95 },
        { id: 'ref-2', title: 'Workflow', type: 'knowledge', relevance: 0.7 },
      ],
    });

    executeChat('/root', {} as never, 'ref-test', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('References:');
    expect(output).toContain('[ref-1] Spec Guide');
    expect(output).toContain('[ref-2] Workflow');
    expect(output).toContain('95%');
    expect(output).toContain('70%');
  });

  it('omits References section when empty in panel mode', () => {
    mockAnswerQuery.mockReturnValue({
      query: 'no-refs',
      confidence: 1,
      answer: 'no references here',
      references: [],
    });

    executeChat('/root', {} as never, 'no-refs', false);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).not.toContain('References:');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — createAgentInstallSubcommand
// ════════════════════════════════════════════════════════════════════

describe('helpers.ts > createAgentInstallSubcommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createInstallCmd(): Command {
    const program = new Command();
    const installCmd = program.command('install');
    createAgentInstallSubcommand(installCmd, 'claude', 'claude-type', 'Install Claude skills');
    return program;
  }

  it('--list shows available packages grouped by category', async () => {
    mockGetManifest.mockReturnValue([
      { name: 'mumuspec-workflow', description: 'Workflow skill', category: 'core' },
      { name: 'mumuspec-review', description: 'Review skill', category: 'quality' },
    ]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--list']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('claude');
    expect(output).toContain('mumuspec-workflow');
    expect(output).toContain('mumuspec-review');
    expect(output).toContain('[core]');
    expect(output).toContain('[quality]');
  });

  it('--list shows empty message when no packages', async () => {
    mockGetManifest.mockReturnValue([]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--list']);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No packages available'),
    );
  });

  it('--installed lists currently installed skills', async () => {
    mockListInstalledAgentSkills.mockReturnValue({
      success: true,
      skills: ['mumuspec-workflow'],
    });
    mockFormatAgentInstalledSkills.mockReturnValue('  - mumuspec-workflow (installed)');

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--installed']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Installed');
    expect(output).toContain('mumuspec-workflow');
  });

  it('--installed shows error on failure', async () => {
    mockListInstalledAgentSkills.mockReturnValue({
      success: false,
      error: 'Permission denied',
    });

    const program = createInstallCmd();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--installed']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied'),
    );
  });

  it('--search returns matching packages', async () => {
    mockSearchPackages.mockReturnValue([
      { name: 'mumuspec-workflow', description: 'The main workflow', category: 'core' },
    ]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--search', 'workflow']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('mumuspec-workflow');
    expect(output).toContain('The main workflow');
    expect(output).toContain('1 package(s) matching');
  });

  it('--search shows no results message', async () => {
    mockSearchPackages.mockReturnValue([]);

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', '--search', 'nonexistent']);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No packages match'),
    );
  });

  it('exits when no packages specified and flags not used', async () => {
    const program = createInstallCmd();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'install', 'claude']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No packages specified'),
    );
  });

  it('installs multiple packages and reports counts', async () => {
    mockResolvePackage.mockReturnValue({ name: 'pkg-a', description: '', category: 'core' });
    mockInstallPackage.mockReturnValue({ success: true, path: '/skills/pkg-a' });

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'pkg-a', 'pkg-a']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('2 succeeded');
    expect(output).toContain('0 failed');
    expect(output).toContain('Path: /skills/pkg-a');
  });

  it('reports failure count and exits when packages fail', async () => {
    mockResolvePackage.mockReturnValue(null);

    const program = createInstallCmd();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'unknown-pkg']),
    ).rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown package'),
    );

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('0 succeeded, 1 failed');
  });

  it('uses --force to trigger update mode', async () => {
    mockResolvePackage.mockReturnValue({ name: 'pkg-a', description: '', category: 'core' });
    mockInstallPackage.mockReturnValue({ success: true, path: '/skills/pkg-a' });

    const program = createInstallCmd();
    await program.parseAsync(['node', 'mumuspec', 'install', 'claude', 'pkg-a', '--force']);

    expect(mockInstallPackage).toHaveBeenCalledWith(
      'claude-type', 'pkg-a', 'user', undefined, 'update',
    );

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Updated');
  });
});
