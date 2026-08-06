/**
 * Handler-level tests for spec commands (context, add-spec, validate, check, drift, search, sync-specs).
 *
 * Strategy: mock all dependencies, register spec commands, then invoke handlers
 * to test branch logic: context loading, validation, compliance checking,
 * drift detection, and spec synchronization.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockLoadSpecContext,
  mockSearchSpecs,
  mockFindAllDistributedSpecDirs,
  mockValidateAllSpecs,
  mockCheckCompliance,
  mockDetectDrift,
  mockAutoFixDrift,
  mockExistsSync,
  mockEnsureDir,
  mockWriteText,
  mockReadText,
  mockNow,
  mockCreateDefaultSpecContent,
  mockCreateDefaultPrdContent,
  mockCreateDefaultTechContent,
  mockParseSpecFile,
  mockSerializeSpecFile,
  mockParsePrdFile,
  mockParseTechFile,
  mockFormatError,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockLoadSpecContext: vi.fn(),
  mockSearchSpecs: vi.fn(),
  mockFindAllDistributedSpecDirs: vi.fn(),
  mockValidateAllSpecs: vi.fn(),
  mockCheckCompliance: vi.fn(),
  mockDetectDrift: vi.fn(),
  mockAutoFixDrift: vi.fn(),
  mockExistsSync: vi.fn(),
  mockEnsureDir: vi.fn(),
  mockWriteText: vi.fn(),
  mockReadText: vi.fn(),
  mockNow: vi.fn(),
  mockCreateDefaultSpecContent: vi.fn(),
  mockCreateDefaultPrdContent: vi.fn(),
  mockCreateDefaultTechContent: vi.fn(),
  mockParseSpecFile: vi.fn(),
  mockSerializeSpecFile: vi.fn(),
  mockParsePrdFile: vi.fn(),
  mockParseTechFile: vi.fn(),
  mockFormatError: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    ensureDir: mockEnsureDir,
    writeText: mockWriteText,
    readText: mockReadText,
    now: mockNow,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../../src/core/errors.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/errors.js')>();
  return {
    ...actual,
    formatError: mockFormatError,
  };
});

vi.mock('../../../src/spec/parser.js', () => ({
  createDefaultSpecContent: mockCreateDefaultSpecContent,
  createDefaultPrdContent: mockCreateDefaultPrdContent,
  createDefaultTechContent: mockCreateDefaultTechContent,
  parseSpecFile: mockParseSpecFile,
  serializeSpecFile: mockSerializeSpecFile,
  parsePrdFile: mockParsePrdFile,
  parseTechFile: mockParseTechFile,
}));

vi.mock('../../../src/spec/loader.js', () => ({
  loadSpecContext: mockLoadSpecContext,
  searchSpecs: mockSearchSpecs,
  findAllDistributedSpecDirs: mockFindAllDistributedSpecDirs,
}));

vi.mock('../../../src/spec/validator.js', () => ({
  validateAllSpecs: mockValidateAllSpecs,
}));

vi.mock('../../../src/guard/checker.js', () => ({
  checkCompliance: mockCheckCompliance,
  detectDrift: mockDetectDrift,
  autoFixDrift: mockAutoFixDrift,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

// Import after mocks
const { registerSpecCommands } = await import('../../../src/cli/commands/spec.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerSpecCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';

const DEFAULT_CONFIG = { constraint_strength: { technical_design: 'high', requirement_goals: 'high' } };

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('spec command handlers', () => {
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
    mockLoadConfig.mockReturnValue(DEFAULT_CONFIG);
    mockNow.mockReturnValue('2024-01-15T10:00:00Z');
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('');
    mockParseSpecFile.mockReturnValue({ path: '/spec.md', frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' }, requirements: [], raw: '' });
    mockSerializeSpecFile.mockReturnValue('---\nlayer: 1\nscope: "."\nlast_updated: "2024-01-15"\n---\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── context command ───────────────────────────────────

  describe('context handler', () => {
    it('shows spec context for a path', async () => {
      mockLoadSpecContext.mockReturnValue({
        layers: [{
          level: 1, scope: '.', path: '/fake/project/spec.md',
          spec: { requirements: [{ name: 'Auth', shall: ['Use JWT'], shallNot: [], enforcement: [] }] },
        }],
        prohibitions: ['No eval'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'context', 'src/api']);

      expect(mockLoadSpecContext).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Spec Context for'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SHALL:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Prohibitions'));
    });

    it('outputs JSON with --json flag', async () => {
      mockLoadSpecContext.mockReturnValue({ layers: [], prohibitions: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'context', 'src/', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"layers"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'context', 'src/api']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── add-spec command ──────────────────────────────────

  describe('add-spec handler', () => {
    it('adds a shall constraint', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\nlast_updated: "2024-01-15"\n---\n');
      mockParseSpecFile.mockReturnValue({
        path: '/fake/project/.mumuspec/spec.md',
        frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' },
        requirements: [{ name: 'Security', shall: ['Use HTTPS'], shallNot: [], enforcement: [] }],
        raw: '',
      });
      mockSerializeSpecFile.mockReturnValue('# Test');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'add-spec', 'src/api', '--type', 'shall', '--text', 'Must validate input']);

      expect(mockWriteText).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Added shall constraint'));
    });

    it('adds a shall-not constraint', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\n---\n');
      mockParseSpecFile.mockReturnValue({
        path: '/fake/project/.mumuspec/spec.md',
        frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' },
        requirements: [{ name: 'Security', shall: [], shallNot: [], enforcement: [] }],
        raw: '',
      });
      mockSerializeSpecFile.mockReturnValue('# Test');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'add-spec', 'src/api', '--type', 'shall-not', '--text', 'No eval']);

      expect(mockWriteText).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Added shall-not constraint'));
    });

    it('creates spec dir if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockCreateDefaultSpecContent.mockReturnValue('# New Spec');
      mockParseSpecFile.mockReturnValue({
        path: '/fake/project/.mumuspec/spec.md',
        frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' },
        requirements: [],
        raw: '',
      });
      mockSerializeSpecFile.mockReturnValue('# Test');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'add-spec', 'src/api', '--text', 'Test constraint']);

      expect(mockEnsureDir).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledTimes(2); // Once for default spec, once for updated
    });

    it('exits when --text not provided', async () => {
      mockExistsSync.mockReturnValue(true);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'add-spec', 'src/api']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: --text is required');
    });
  });

  // ── validate command ──────────────────────────────────

  describe('validate handler', () => {
    it('shows success when all specs valid', async () => {
      mockValidateAllSpecs.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'validate']);

      expect(logSpy).toHaveBeenCalledWith('✓ All specs are valid');
    });

    it('shows errors and warnings', async () => {
      mockValidateAllSpecs.mockReturnValue({
        passed: false,
        errors: [{ code: 'PARSE_ERROR', message: 'Bad syntax', detail: 'line 5' }],
        warnings: [{ code: 'STALE', message: 'Old format' }],
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'validate']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('1 error(s)'));
    });

    it('suppresses warnings with --quiet', async () => {
      mockValidateAllSpecs.mockReturnValue({
        passed: true,
        errors: [],
        warnings: [{ code: 'STALE', message: 'Old format' }],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'validate', '--quiet']);

      // Should not show warnings
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('warning'));
    });

    it('outputs JSON with --json flag', async () => {
      mockValidateAllSpecs.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'validate', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"passed": true')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── check command ─────────────────────────────────────

  describe('check handler', () => {
    it('passes when all checks pass', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check']);

      expect(logSpy).toHaveBeenCalledWith('✓ All checks passed');
    });

    it('shows errors and exits non-zero', async () => {
      mockCheckCompliance.mockReturnValue({
        passed: false,
        errors: [{ code: 'SHALL_VIOLATION', message: 'Missing test', detail: 'src/api.ts' }],
        warnings: [],
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'check']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('1 error(s)'));
    });

    it('outputs as JSON with --json flag', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"passed": true')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── drift command ─────────────────────────────────────

  describe('drift handler', () => {
    it('shows no drift when clean', async () => {
      mockDetectDrift.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift']);

      expect(logSpy).toHaveBeenCalledWith('✓ No drift detected');
    });

    it('shows drift count and details', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'missing_spec', message: 'No spec for handler.ts', file: 'src/handler.ts', severity: 'ERROR', fixHint: 'Add spec.md' },
        { type: 'outdated', message: 'Old format', file: 'src/old.ts', severity: 'WARNING' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 drift(s) detected'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[missing_spec]'));
    });

    it('auto-fixes drift with --fix', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'missing_spec', message: 'Add spec', file: 'src/handler.ts', severity: 'ERROR', fixHint: 'Create spec.md' },
      ]);
      mockAutoFixDrift.mockReturnValue({
        fixed: [{ type: 'missing_spec', message: 'Created spec.md', file: 'src/spec.md' }],
        remaining: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', '--fix']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Fixed 1 drift(s)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ [missing_spec]'));
    });

    it('shows dry-run preview with --fix --dry-run', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'outdated', message: 'Update format', file: 'src/old.ts', severity: 'WARNING' },
      ]);
      mockAutoFixDrift.mockReturnValue({
        fixed: [{ type: 'outdated', message: 'Would fix', file: 'src/old.ts' }],
        remaining: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', '--fix', '--dry-run']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN] Would fix'));
    });

    it('outputs JSON with --json flag', async () => {
      mockDetectDrift.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('[]')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── search command ────────────────────────────────────

  describe('search handler', () => {
    it('shows search results', async () => {
      mockSearchSpecs.mockReturnValue([
        { type: 'shall', requirement: 'Auth', text: 'Use JWT tokens', file: 'spec.md' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'search', 'JWT']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 result(s)'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[shall] Auth'));
    });

    it('shows no results message', async () => {
      mockSearchSpecs.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'search', 'nonexistent']);

      expect(logSpy).toHaveBeenCalledWith('No results found.');
    });
  });

  // ── sync-specs command ────────────────────────────────

  describe('sync-specs handler', () => {
    it('syncs all distributed spec dirs', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['spec.md', 'prd.md', 'tech.md'] },
      ]);
      mockParseSpecFile.mockReturnValue({ path: '', frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' }, requirements: [], raw: '' });
      mockParsePrdFile.mockReturnValue({ path: '', frontmatter: {}, sections: [], raw: '' });
      mockParseTechFile.mockReturnValue({ path: '', frontmatter: {}, sections: [], raw: '' });
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\nlast_updated: "2024-01-15"\n---\n');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sync complete: 0 fixed, 0 errors'));
    });

    it('reports errors when parsing fails', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['spec.md'] },
      ]);
      mockReadText.mockReturnValue('invalid content');
      mockParseSpecFile.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'sync-specs']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('✗'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('errors'));
    });
  });
});
