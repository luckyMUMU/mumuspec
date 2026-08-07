/**
 * Extra coverage for spec commands — targets branches not covered by spec-handler.test.ts:
 * - context: layer.design preview (incl. truncation)
 * - add-spec: parseSpecFile fallback on parse error
 * - validate: passed with warnings; --json with errors
 * - check: option flags (shall / shall-not / ponytail / test-immutability / staged-only);
 *          simultaneous errors + warnings
 * - drift: --change valid/invalid state; detect subcommand; --fix --json combo
 * - search: --scope / --type filters
 * - sync-specs: --fix missing scope auto-fix; auto-create prd.md / tech.md;
 *               empty dir list
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
  mockNormalizePath,
  mockCreateDefaultSpecContent,
  mockCreateDefaultPrdContent,
  mockCreateDefaultTechContent,
  mockParseSpecFile,
  mockSerializeSpecFile,
  mockParsePrdFile,
  mockParseTechFile,
  mockFormatError,
  mockLoadChangeState,
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
  mockNormalizePath: vi.fn(),
  mockCreateDefaultSpecContent: vi.fn(),
  mockCreateDefaultPrdContent: vi.fn(),
  mockCreateDefaultTechContent: vi.fn(),
  mockParseSpecFile: vi.fn(),
  mockSerializeSpecFile: vi.fn(),
  mockParsePrdFile: vi.fn(),
  mockParseTechFile: vi.fn(),
  mockFormatError: vi.fn(),
  mockLoadChangeState: vi.fn(),
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
    normalizePath: mockNormalizePath,
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

vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: mockLoadChangeState,
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

describe('spec extra coverage', () => {
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
    mockNormalizePath.mockImplementation((p: string) => p.replace(/\\/g, '/'));
    mockLoadChangeState.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ════════════════════════════════════════════════════════════════
  // context — layer.design branch with truncation
  // ════════════════════════════════════════════════════════════════

  describe('context: design layer preview', () => {
    it('shows design preview truncated when content >200 chars', async () => {
      longContent: {
      }
      const longContent = 'A'.repeat(250);
      mockLoadSpecContext.mockReturnValue({
        layers: [{
          level: 1, scope: '.', path: '/fake/project/.mumuspec/spec.md',
          design: { path: '/fake/project/.mumuspec/design.md', content: longContent },
        }],
        prohibitions: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'context', '.']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Design:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('...'));
    });

    it('shows design preview fully when content ≤200 chars', async () => {
      const shortContent = 'Short design content';
      mockLoadSpecContext.mockReturnValue({
        layers: [{
          level: 1, scope: '.', path: '/fake/project/.mumuspec/spec.md',
          design: { path: '/fake/project/.mumuspec/design.md', content: shortContent },
        }],
        prohibitions: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'context', '.']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Short design content'));
      // Should NOT contain truncation ellipsis
      const designCalls = logSpy.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].startsWith('  ')
          && !call[0].includes('===')
      );
      expect(designCalls.some(call => call[0].includes('...'))).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // add-spec — parseSpecFile fallback on error
  // ════════════════════════════════════════════════════════════════

  describe('add-spec: fallback on parse error', () => {
    it('creates fallback spec when parseSpecFile throws', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('---\nbroken frontmatter\n---\n');
      mockParseSpecFile.mockImplementation(() => {
        throw new Error('Malformed YAML');
      });
      mockSerializeSpecFile.mockReturnValue('---\nlayer: 1\nscope: "."\nlast_updated: "2024-01-15"\n---\n');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'add-spec', 'src/api', '--text', 'Must log errors']);

      expect(mockWriteText).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Added shall constraint'));
    });

    it('creates new requirement when none exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\n---\n');
      mockParseSpecFile.mockReturnValue({
        path: '/fake/project/.mumuspec/spec.md',
        frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' },
        requirements: [{ name: 'ExistingReq', shall: ['Do X'], shallNot: [], enforcement: [] }],
        raw: '',
      });
      mockSerializeSpecFile.mockReturnValue('# Test');

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'add-spec', 'src/api',
        '--requirement', 'BrandNewReq', '--text', 'New constraint',
      ]);

      expect(mockWriteText).toHaveBeenCalled();
      // Verify the parse returned the existing one and a new requirement was created
      expect(logSpy).toHaveBeenCalledWith('✓ Added shall constraint to src/api');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // validate — passed with warnings; --json with errors
  // ════════════════════════════════════════════════════════════════

  describe('validate: edge branches', () => {
    it('shows warnings when passed=true but warnings exist', async () => {
      mockValidateAllSpecs.mockReturnValue({
        passed: true,
        errors: [],
        warnings: [
          { code: 'OLD_FORMAT', message: 'Old format detected', detail: 'Use new format' },
          { code: 'DEPRECATED', message: 'Deprecated field' },
        ],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'validate']);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('warning(s)'));
      expect(warnSpy).toHaveBeenCalledWith('[OLD_FORMAT] Old format detected');
      expect(warnSpy).toHaveBeenCalledWith('  Use new format');
      expect(warnSpy).toHaveBeenCalledWith('[DEPRECATED] Deprecated field');
    });

    it('exits with 1 when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'validate']))
        .rejects.toThrow('process.exit called with code 1');
    });

    it('outputs JSON with errors', async () => {
      mockValidateAllSpecs.mockReturnValue({
        passed: false,
        errors: [{ code: 'E1', message: 'Parse fail', detail: 'line 3' }],
        warnings: [{ code: 'W1', message: 'Stale' }],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'validate', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"passed": false')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // check — option flags; simultaneous errors+warnings
  // ════════════════════════════════════════════════════════════════

  describe('check: option flags and combined outputs', () => {
    it('passes --shall option to checkCompliance', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--shall']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ shall: true }),
      );
    });

    it('passes --shall-not option to checkCompliance', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--shall-not']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ shallNot: true }),
      );
    });

    it('passes --ponytail option to checkCompliance', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--ponytail']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ ponytail: true }),
      );
    });

    it('passes --test-immutability option to checkCompliance', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--test-immutability']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ testImmutability: true }),
      );
    });

    it('passes --staged-only option to checkCompliance', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check', '--staged-only']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ stagedOnly: true }),
      );
    });

    it('passes strength from config', async () => {
      mockCheckCompliance.mockReturnValue({ passed: true, errors: [], warnings: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'check']);

      expect(mockCheckCompliance).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ strength: DEFAULT_CONFIG.constraint_strength }),
      );
    });

    it('shows errors and warnings together', async () => {
      mockCheckCompliance.mockReturnValue({
        passed: false,
        errors: [{ code: 'E1', message: 'Violation', detail: 'src/foo.ts' }],
        warnings: [{ code: 'W1', message: 'Watch out', detail: 'src/bar.ts' }],
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'check']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('1 error(s)'));
      expect(errorSpy).toHaveBeenCalledWith('[E1] Violation');
      expect(errorSpy).toHaveBeenCalledWith('  src/foo.ts');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1 warning(s)'));
      expect(warnSpy).toHaveBeenCalledWith('[W1] Watch out');
      expect(warnSpy).toHaveBeenCalledWith('  src/bar.ts');
    });

    it('exits 1 when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'check']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // drift — --change state; detect subcommand; --fix --json
  // ════════════════════════════════════════════════════════════════

  describe('drift: change-scoped detection and detect subcommand', () => {
    it('filters drift results by change prefix when --change state exists', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'design' });
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'Change file', severity: 'WARNING', file: '.mumuspec/changes/my-change/src/a.md' },
        { type: 'spec_drift', message: 'Other file', severity: 'WARNING', file: 'src/b.md' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', 'detect', '--change', 'my-change']);

      // The filter should keep only drift whose normalized file contains the change prefix
      // Since mockNormalizePath is identity-like (just replaces \ with /),
      // .mumuspec/changes/my-change/ appears only in the first file.
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 drift(s) detected'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Change file'));
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Other file'));
    });

    it('exits 1 when --change state cannot be loaded', async () => {
      mockLoadChangeState.mockReturnValue(undefined);
      mockDetectDrift.mockReturnValue([]);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'drift', 'detect', '--change', 'nonexistent']))
        .rejects.toThrow('process.exit called with code 1');
    });

    it('runs drift detect subcommand', async () => {
      mockDetectDrift.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', 'detect']);

      expect(logSpy).toHaveBeenCalledWith('✓ No drift detected');
    });

    it('drift detect --change with valid state', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'feat', phase: 'build' });
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'In scope', severity: 'WARNING', file: '.mumuspec/changes/feat/src/x.md' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', 'detect', '--change', 'feat']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 drift(s) detected'));
    });

    it('drift detect shows no drift matching change filter', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'feat', phase: 'build' });
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'Out of scope', severity: 'WARNING', file: 'other/src/x.md' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', 'detect', '--change', 'feat']);

      // All drift results filtered out because file path doesn't contain change prefix
      expect(logSpy).toHaveBeenCalledWith('✓ No drift detected');
    });

    it('drift detect --json outputs results as JSON', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'A drift', severity: 'WARNING', file: 'src/spec.md' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', 'detect', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('spec_drift')
      );
      expect(jsonCall).toBeDefined();
    });

    it('outputs fix JSON when --fix --json combined', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'Fixable', severity: 'WARNING', file: 'src/spec.md' },
      ]);
      mockAutoFixDrift.mockReturnValue({
        fixed: [{ type: 'spec_drift', message: 'Fixed it', file: 'src/spec.md' }],
        remaining: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', '--fix', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"fixed"') && call[0].includes('"remaining"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('shows remaining drift after partial fix', async () => {
      mockDetectDrift.mockReturnValue([
        { type: 'spec_drift', message: 'Fixable', severity: 'WARNING', file: 'src/a.md' },
        { type: 'spec_drift', message: 'Unfixable', severity: 'ERROR', file: 'src/b.md', hint: 'Manual fix' },
      ]);
      mockAutoFixDrift.mockReturnValue({
        fixed: [{ type: 'spec_drift', message: 'Fixable', file: 'src/a.md' }],
        remaining: [{ type: 'spec_drift', message: 'Unfixable', severity: 'ERROR', file: 'src/b.md', hint: 'Manual fix' }],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'drift', '--fix']);

      // Should show "Fixed 1 drift" + remaining count
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Fixed 1 drift'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 drift(s) detected'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Unfixable'));
    });
  });

  // ════════════════════════════════════════════════════════════════
  // search — --scope and --type filters
  // ════════════════════════════════════════════════════════════════

  describe('search: --scope and --type options', () => {
    it('passes --scope option to searchSpecs', async () => {
      mockSearchSpecs.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'search', 'pattern', '--scope', 'src/api']);

      expect(mockSearchSpecs).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ scope: 'src/api' }),
      );
    });

    it('passes --type option to searchSpecs', async () => {
      mockSearchSpecs.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'search', 'pattern', '--type', 'shall']);

      expect(mockSearchSpecs).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ type: 'shall' }),
      );
    });

    it('passes both --scope and --type together', async () => {
      mockSearchSpecs.mockReturnValue([
        { type: 'shall', requirement: 'Test', text: 'Do X', file: 'spec.md' },
      ]);

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'search', 'test', '--scope', 'src/', '--type', 'shall-not',
      ]);

      expect(mockSearchSpecs).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({ scope: 'src/', type: 'shall-not' }),
      );
    });

    it('exits 1 when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'search', 'anything']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // sync-specs — --fix auto-fix scope; auto-create files; empty dirs
  // ════════════════════════════════════════════════════════════════

  describe('sync-specs: --fix auto-fix and file generation', () => {
    it('auto-fixes missing scope field in frontmatter', async () => {
      const contentWithoutScope = '---\nlayer: 1\nlast_updated: "2024-01-15"\n---\n# Spec\n';
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['spec.md'] },
      ]);
      mockReadText.mockReturnValue(contentWithoutScope);
      mockParseSpecFile.mockReturnValue({ path: '', frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' }, requirements: [], raw: '' });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs', '--fix']);

      // Should have written the file with scope added
      expect(mockWriteText).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Fixed:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('added missing scope'));
    });

    it('auto-creates prd.md when tech.md exists but prd.md is missing', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['tech.md'] },
      ]);
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\n---\n');
      mockParseTechFile.mockReturnValue({ path: '', frontmatter: {}, sections: [], raw: '' });
      mockCreateDefaultPrdContent.mockReturnValue('# PRD Content');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs', '--fix']);

      // prd.md should be created
      expect(mockCreateDefaultPrdContent).toHaveBeenCalledWith(1, '.');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Created:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('prd.md'));
    });

    it('auto-creates tech.md when prd.md exists but tech.md is missing', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['prd.md'] },
      ]);
      mockReadText.mockReturnValue('---\nlayer: 1\nscope: "."\n---\n');
      mockParsePrdFile.mockReturnValue({ path: '', frontmatter: {}, sections: [], raw: '' });
      mockCreateDefaultTechContent.mockReturnValue('# Tech Content');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs', '--fix']);

      expect(mockCreateDefaultTechContent).toHaveBeenCalledWith(1, '.');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Created:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('tech.md'));
    });

    it('skips files with empty content', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['spec.md'] },
      ]);
      mockReadText.mockReturnValue('');  // empty content → continue at line 383
      mockExistsSync.mockReturnValue(true);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs']);

      // No parsing or fix should occur; clean sync
      expect(mockParseSpecFile).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Sync complete: 0 fixed, 0 errors'));
    });

    it('handles empty dir list from findAllDistributedSpecDirs', async () => {
      mockFindAllDistributedSpecDirs.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'sync-specs']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Sync complete: 0 fixed, 0 errors'));
    });

    it('exits 1 when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'sync-specs']))
        .rejects.toThrow('process.exit called with code 1');
    });

    it('does not auto-fix scope without --fix flag', async () => {
      const contentWithoutScope = '---\nlayer: 1\nlast_updated: "2024-01-15"\n---\n# Spec\n';
      mockFindAllDistributedSpecDirs.mockReturnValue([
        { dir: '/fake/project', files: ['spec.md'] },
      ]);
      mockReadText.mockReturnValue(contentWithoutScope);
      mockParseSpecFile.mockReturnValue({ path: '', frontmatter: { layer: 1, scope: '.', last_updated: '2024-01-15' }, requirements: [], raw: '' });

      const program = createProgram();
      // Run WITHOUT --fix
      await program.parseAsync(['node', 'mumuspec', 'sync-specs']);

      // Should NOT write any fix; only read for parsing
      // writeText should not be called for the scope fix path
      // (it may have been called by parseSpecFile internally, but not for fix)
      // Check that "Fixed" message was NOT logged
      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Fixed:'));
    });
  });
});
