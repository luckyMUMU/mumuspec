/**
 * Handler-level tests for bundle subcommands (create, validate, install, list, publish).
 *
 * Strategy: mock lower-level modules (core/utils, bundle/packager),
 * register bundle commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockCreateBundle,
  mockValidateBundle,
  mockInstallBundle,
  mockPublishBundle,
  mockListBundles,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockCreateBundle: vi.fn(),
  mockValidateBundle: vi.fn(),
  mockInstallBundle: vi.fn(),
  mockPublishBundle: vi.fn(),
  mockListBundles: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/bundle/packager.js', () => ({
  createBundle: mockCreateBundle,
  validateBundle: mockValidateBundle,
  installBundle: mockInstallBundle,
  publishBundle: mockPublishBundle,
  listBundles: mockListBundles,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('bundle command handlers', () => {
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
    mockCreateBundle.mockReset();
    mockValidateBundle.mockReset();
    mockInstallBundle.mockReset();
    mockPublishBundle.mockReset();
    mockListBundles.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── create subcommand ──

  describe('bundle create handler', () => {
    it('should print success message with file count on success', async () => {
      mockCreateBundle.mockReturnValue({
        success: true,
        outputPath: '/fake/root/.mumuspec/bundles/my-bundle.zip',
        fileCount: 42,
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'create', 'my-bundle'], { from: 'user' });

      expect(mockCreateBundle).toHaveBeenCalledWith('/fake/root', expect.objectContaining({
        name: 'my-bundle',
      }));
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bundle created: /fake/root/.mumuspec/bundles/my-bundle.zip')
      );
      expect(logSpy).toHaveBeenCalledWith('  Files: 42');
    });

    it('should pass undefined name when no name argument given', async () => {
      mockCreateBundle.mockReturnValue({
        success: true,
        outputPath: '/fake/root/.mumuspec/bundles/mumuspec-skills.zip',
        fileCount: 10,
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'create'], { from: 'user' });

      expect(mockCreateBundle).toHaveBeenCalledWith('/fake/root', expect.objectContaining({
        name: undefined,
      }));
    });

    it('should pass includeEvals and includeAuthoring from options', async () => {
      mockCreateBundle.mockReturnValue({
        success: true,
        outputPath: '/fake/root/.mumuspec/bundles/all.zip',
        fileCount: 100,
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(
        ['bundle', 'create', '--include-evals', '--include-authoring'],
        { from: 'user' }
      );

      expect(mockCreateBundle).toHaveBeenCalledWith('/fake/root', expect.objectContaining({
        includeEvals: true,
        includeAuthoring: true,
      }));
    });

    it('should exit(1) and print error on bundle creation failure', async () => {
      mockCreateBundle.mockReturnValue({
        success: false,
        error: 'No .mumuspec/skills/ directory found',
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'create'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bundle failed: No .mumuspec/skills/ directory found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(
        ['bundle', 'create', '--workspace-path', '/no/project'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── validate subcommand ──

  describe('bundle validate handler', () => {
    it('should print valid bundle result', async () => {
      mockValidateBundle.mockReturnValue({ valid: true, errors: [] });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'validate', '/path/to/bundle.zip'], { from: 'user' });

      expect(mockValidateBundle).toHaveBeenCalledWith('/path/to/bundle.zip');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Valid:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
    });

    it('should print errors and exit(1) for invalid bundle', async () => {
      mockValidateBundle.mockReturnValue({
        valid: false,
        errors: ['Missing manifest', 'Invalid file hash'],
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'validate', '/bad/bundle.zip'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('  ✗ Missing manifest');
      expect(errorSpy).toHaveBeenCalledWith('  ✗ Invalid file hash');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── install subcommand ──

  describe('bundle install handler', () => {
    it('should print installed file count on success', async () => {
      mockInstallBundle.mockReturnValue({
        success: true,
        installed: ['file1.md', 'file2.yaml', 'file3.txt'],
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'install', '/path/to/bundle.zip'], { from: 'user' });

      expect(mockInstallBundle).toHaveBeenCalledWith('/path/to/bundle.zip', '.');
      expect(logSpy).toHaveBeenCalledWith('✓ Installed 3 file(s)');
    });

    it('should use --target option for install destination', async () => {
      mockInstallBundle.mockReturnValue({ success: true, installed: ['a.md'] });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(
        ['bundle', 'install', '/bundle.zip', '--target', '/workspace'],
        { from: 'user' }
      );

      expect(mockInstallBundle).toHaveBeenCalledWith('/bundle.zip', '/workspace');
    });

    it('should exit(1) on install failure', async () => {
      mockInstallBundle.mockReturnValue({
        success: false,
        error: 'Target directory not writable',
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'install', '/bundle.zip'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Install failed: Target directory not writable');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── list subcommand ──

  describe('bundle list handler', () => {
    it('should print "No bundles found" when list is empty', async () => {
      mockListBundles.mockReturnValue([]);

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'list'], { from: 'user' });

      expect(mockListBundles).toHaveBeenCalledWith('/fake/root');
      expect(logSpy).toHaveBeenCalledWith('No bundles found.');
    });

    it('should print each bundle name when bundles exist', async () => {
      mockListBundles.mockReturnValue(['bundle-1.0.0.zip', 'bundle-2.0.0.zip']);

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\n2 bundle(s):');
      expect(logSpy).toHaveBeenCalledWith('  bundle-1.0.0.zip');
      expect(logSpy).toHaveBeenCalledWith('  bundle-2.0.0.zip');
    });
  });

  // ── publish subcommand ──

  describe('bundle publish handler', () => {
    it('should print success with registry placeholder', async () => {
      mockPublishBundle.mockReturnValue({
        success: true,
        bundlePath: '/path/to/bundle.zip',
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'publish', '/path/to/bundle.zip'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bundle ready for publishing: /path/to/bundle.zip')
      );
      expect(logSpy).toHaveBeenCalledWith('  (Registry integration coming soon)');
    });

    it('should exit(1) on publish failure', async () => {
      mockPublishBundle.mockReturnValue({
        success: false,
        error: 'Bundle not found',
      });

      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle', 'publish', '/nonexistent.zip'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Publish failed: Bundle not found');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── default action (no subcommand) ──

  describe('bundle default action', () => {
    it('should print usage information', async () => {
      const { registerBundleCommands } = await import('../../../src/cli/commands/bundle.js');
      const program = new Command();
      registerBundleCommands(program);

      await program.parseAsync(['bundle'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Bundle, validate, and publish skills.\n');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec bundle create [name]   Create skill bundle');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec bundle list            List project bundles');
    });
  });
});
