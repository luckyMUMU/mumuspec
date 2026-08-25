/**
 * Handler-level tests for install subcommands (catpaw, mcp, command, claude, etc.).
 *
 * Strategy: mock lower-level modules (core/utils, install/installer),
 * register install commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockGetManifest,
  mockSearchPackages,
  mockResolvePackage,
  mockInstallPackage,
  mockInstallCatpawMcp,
  mockListInstalledMcp,
  mockInstallCatpawCommand,
  mockGetMcpPresets,
  mockGetCommandPresets,
  mockListInstalledCatpaw,
  mockFormatInstalledSkills,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetManifest: vi.fn(),
  mockSearchPackages: vi.fn(),
  mockResolvePackage: vi.fn(),
  mockInstallPackage: vi.fn(),
  mockInstallCatpawMcp: vi.fn(),
  mockListInstalledMcp: vi.fn(),
  mockInstallCatpawCommand: vi.fn(),
  mockGetMcpPresets: vi.fn(),
  mockGetCommandPresets: vi.fn(),
  mockListInstalledCatpaw: vi.fn(),
  mockFormatInstalledSkills: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/install/installer.js', () => ({
  getManifest: mockGetManifest,
  searchPackages: mockSearchPackages,
  resolvePackage: mockResolvePackage,
  installPackage: mockInstallPackage,
  installCatpawMcp: mockInstallCatpawMcp,
  listInstalledMcp: mockListInstalledMcp,
  installCatpawCommand: mockInstallCatpawCommand,
  getMcpPresets: mockGetMcpPresets,
  getCommandPresets: mockGetCommandPresets,
  listInstalledCatpaw: mockListInstalledCatpaw,
  formatInstalledSkills: mockFormatInstalledSkills,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('install command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockGetManifest.mockReset();
    mockSearchPackages.mockReset();
    mockResolvePackage.mockReset();
    mockInstallPackage.mockReset();
    mockInstallCatpawMcp.mockReset();
    mockListInstalledMcp.mockReset();
    mockInstallCatpawCommand.mockReset();
    mockGetMcpPresets.mockReset();
    mockGetCommandPresets.mockReset();
    mockListInstalledCatpaw.mockReset();
    mockFormatInstalledSkills.mockReset();
    mockExistsSync.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockExistsSync.mockReturnValue(true);
    mockGetManifest.mockReturnValue([
      { name: 'browser', category: 'web', description: 'Browser automation', skillId: '123' },
      { name: 'pdf', category: 'docs', description: 'PDF tools' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── install catpaw --list ──

  describe('install catpaw --list handler', () => {
    it('should print available packages grouped by category', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--list'], { from: 'user' });

      expect(mockGetManifest).toHaveBeenCalledWith('catpaw');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[web]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('browser'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[docs]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('pdf'));
    });

    it('should print "No packages available" when manifest is empty', async () => {
      mockGetManifest.mockReturnValue([]);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No packages available for CatPaw in the manifest.');
    });
  });

  // ── install catpaw --search ──

  describe('install catpaw --search handler', () => {
    it('should print matching packages', async () => {
      mockSearchPackages.mockReturnValue([
        { name: 'browser', category: 'web', description: 'Browser automation', skillId: '123' },
      ]);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--search', 'browser'], { from: 'user' });

      expect(mockSearchPackages).toHaveBeenCalledWith('catpaw', 'browser');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('browser'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Browser automation'));
    });

    it('should print "No packages match" when search returns empty', async () => {
      mockSearchPackages.mockReturnValue([]);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--search', 'nonexistent'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No packages match "nonexistent".');
    });
  });

  // ── install catpaw --installed ──

  describe('install catpaw --installed handler', () => {
    it('should print installed skills on success', async () => {
      mockListInstalledCatpaw.mockReturnValue({
        success: true,
        skills: [{ name: 'browser', version: '1.0.0', path: '/skills/browser' }],
      });
      mockFormatInstalledSkills.mockReturnValue('browser (v1.0.0)');

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--installed'], { from: 'user' });

      expect(mockListInstalledCatpaw).toHaveBeenCalledWith(undefined);
      expect(logSpy).toHaveBeenCalledWith('\nInstalled CatPaw Skills:');
      expect(logSpy).toHaveBeenCalledWith('browser (v1.0.0)');
    });

    it('should exit(1) when listing installed skills fails', async () => {
      mockListInstalledCatpaw.mockReturnValue({
        success: false,
        skills: [],
        error: 'CLI not found',
      });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', '--installed'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error listing installed skills: CLI not found');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── install catpaw <packages> ──

  describe('install catpaw <packages> handler', () => {
    it('should install packages successfully', async () => {
      mockResolvePackage.mockReturnValue({ name: 'browser', category: 'web', description: 'Browser automation', skillId: '123' });
      mockInstallPackage.mockReturnValue({ success: true, path: '/skills/browser' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', 'browser'], { from: 'user' });

      expect(mockResolvePackage).toHaveBeenCalledWith('catpaw', 'browser');
      expect(mockInstallPackage).toHaveBeenCalledWith('catpaw', 'browser', 'user', undefined, 'install');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Installed "browser"'));
      expect(logSpy).toHaveBeenCalledWith('  Path: /skills/browser');
    });

    it('should exit(1) when no packages specified', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: No packages specified. Use --list to see available packages, or provide package names.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should skip unknown packages and count failures', async () => {
      mockResolvePackage.mockReturnValue(null);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', 'unknown-pkg'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Unknown package: "unknown-pkg" (use --list to see available packages)');
      expect(logSpy).toHaveBeenCalledWith('\nDone: 0 succeeded, 1 failed.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when --target workspace but no --workspace-path', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', 'browser', '--target', 'workspace'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: --workspace-path is required when --target workspace');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when workspace path does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(
        ['install', 'catpaw', 'browser', '--target', 'workspace', '--workspace-path', '/nonexistent'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Workspace path does not exist: /nonexistent');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle install failure and report error message', async () => {
      mockResolvePackage.mockReturnValue({ name: 'browser', category: 'web', description: 'Browser automation', skillId: '123' });
      mockInstallPackage.mockReturnValue({ success: false, error: 'Network error', path: '' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', 'browser'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to install "browser": Network error');
      expect(logSpy).toHaveBeenCalledWith('\nDone: 0 succeeded, 1 failed.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should use --force mode for update', async () => {
      mockResolvePackage.mockReturnValue({ name: 'pdf', category: 'docs', description: 'PDF tools' });
      mockInstallPackage.mockReturnValue({ success: true, path: '/skills/pdf' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'catpaw', 'pdf', '--force'], { from: 'user' });

      expect(mockInstallPackage).toHaveBeenCalledWith('catpaw', 'pdf', 'user', undefined, 'update');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Updated "pdf"'));
    });
  });

  // ── install mcp ──

  describe('install mcp handler', () => {
    it('should print MCP presets on --list', async () => {
      mockGetMcpPresets.mockReturnValue([
        { name: 'mumuspec', description: 'MumuSpec MCP', config: { command: 'npx', args: ['-y', '@mumuspec/mcp-server'] } },
      ]);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'mcp', '--list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mumuspec'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('npx'));
    });

    it('should list installed MCP configs', async () => {
      mockListInstalledMcp.mockReturnValue({ installed: ['mumuspec'], available: ['mumuspec', 'other'] });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'mcp', '--installed'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('  ✓ mumuspec');
    });

    it('should install MCP server successfully', async () => {
      mockInstallCatpawMcp.mockReturnValue({ success: true, serverName: 'mumuspec', path: '/workspace/.mcp.json' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'mcp', 'mumuspec', '--workspace-path', '.'], { from: 'user' });

      expect(mockInstallCatpawMcp).toHaveBeenCalledWith('mumuspec', '.');
      expect(logSpy).toHaveBeenCalledWith('✓ Installed MCP config: mumuspec');
      expect(logSpy).toHaveBeenCalledWith('  Config file: /workspace/.mcp.json');
    });

    it('should exit(1) when MCP install fails', async () => {
      mockInstallCatpawMcp.mockReturnValue({ success: false, serverName: '', path: '', error: 'Preset not found' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'mcp', 'nonexistent', '--workspace-path', '.'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to install MCP server: Preset not found');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when no MCP server specified', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'mcp', '--workspace-path', '.'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: No MCP server specified. Use --list to see presets.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── install command ──

  describe('install command handler', () => {
    it('should print command presets on --list', async () => {
      mockGetCommandPresets.mockReturnValue([
        { name: '/mumuspec', description: 'MumuSpec workflow' },
      ]);

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'command', '--list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('/mumuspec'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MumuSpec workflow'));
    });

    it('should install custom command successfully', async () => {
      mockInstallCatpawCommand.mockReturnValue({ success: true, commandName: '/mumuspec', path: '/commands/mumuspec.md' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'command', '/mumuspec'], { from: 'user' });

      expect(mockInstallCatpawCommand).toHaveBeenCalledWith('/mumuspec', 'user', undefined, 'install');
      expect(logSpy).toHaveBeenCalledWith('✓ Installed command: /mumuspec');
      expect(logSpy).toHaveBeenCalledWith('  Command file: /commands/mumuspec.md');
    });

    it('should exit(1) when command install fails', async () => {
      mockInstallCatpawCommand.mockReturnValue({ success: false, commandName: '', path: '', error: 'Preset not found' });

      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'command', '/unknown'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to install command: Preset not found');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when no command specified', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'command'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: No command specified. Use --list to see presets.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when --target workspace but no --workspace-path for command', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install', 'command', '/mumuspec', '--target', 'workspace'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: --workspace-path is required when --target workspace');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── default action (no subcommand) ──

  describe('install default action', () => {
    it('should print usage information', async () => {
      const { registerInstallCommands } = await import('../../../src/cli/commands/install.js');
      const program = new Command();
      registerInstallCommands(program);

      await program.parseAsync(['install'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Install skills, MCP servers, and commands for AI coding agents.\n');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec install catpaw [packages...]        Install CatPaw skills');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec install mcp <server>                Install MCP server config to workspace');
    });
  });
});
