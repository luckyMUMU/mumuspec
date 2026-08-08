/**
 * Deep-coverage tests for knowledge-crud subcommands.
 *
 * Targets uncovered branches from knowledge-crud.ts:
 *  - requireRoot() early exit when findProjectRoot() returns null (lines 23-26)
 *  - show: verified_at branch (line 71)
 *  - show: tags branch (lines 72-74)
 *  - organize: error with auto_fixable=false → "Manual fix required" (lines 200-201)
 *  - organize: warning with auto_fixable=true → "Auto-fixable" (lines 210-212)
 *  - organize: info issues shown with --verbose (lines 216-221)
 *  - verify: default (no flags) falls back to --all (line 123)
 *  - organize: no auto-fixable issues, no --fix → no suggestion message (lines 226-229 negative)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock functions ──
const {
  mockListKnowledgePages,
  mockGetKnowledgePage,
  mockSearchKnowledge,
  mockGetKnowledgeContext,
  mockVerifyKnowledge,
  mockListStalePages,
  mockSupersedeKnowledge,
  mockRebuildPageIndex,
  mockOrganizeKnowledge,
} = vi.hoisted(() => ({
  mockListKnowledgePages: vi.fn(),
  mockGetKnowledgePage: vi.fn(),
  mockSearchKnowledge: vi.fn(),
  mockGetKnowledgeContext: vi.fn(),
  mockVerifyKnowledge: vi.fn(),
  mockListStalePages: vi.fn(),
  mockSupersedeKnowledge: vi.fn(),
  mockRebuildPageIndex: vi.fn(),
  mockOrganizeKnowledge: vi.fn(),
}));

vi.mock('../../../src/knowledge/manager.js', () => ({
  listKnowledgePages: mockListKnowledgePages,
  getKnowledgePage: mockGetKnowledgePage,
  searchKnowledge: mockSearchKnowledge,
  getKnowledgeContext: mockGetKnowledgeContext,
  verifyKnowledge: mockVerifyKnowledge,
  listStalePages: mockListStalePages,
  supersedeKnowledge: mockSupersedeKnowledge,
  rebuildPageIndex: mockRebuildPageIndex,
  organizeKnowledge: mockOrganizeKnowledge,
}));

const mockFindProjectRoot = vi.fn();
const mockLoadConfig = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return { ...actual, loadConfig: mockLoadConfig };
});

// Fixtures
function makePage(id: string, overrides: Record<string, unknown> = {}) {
  return {
    frontmatter: {
      id,
      title: `Title for ${id}`,
      type: 'decision',
      status: 'active',
      scope: 'global',
      created_at: '2024-01-01',
      ...overrides,
    },
    content: `# ${id}\nContent here.`,
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge-crud deep coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as (code?: number) => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ knowledge: {} });

    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 10,
        total_index_entries: 10,
        duplicate_ids: 0,
        missing_from_index: 0,
        orphaned_index_entries: 0,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [],
      fixed: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── requireRoot: project root not found ──────────────────────────

  it('should exit(1) with error when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    let caughtError: Error | null = null;
    try {
      await program.parseAsync(['knowledge', 'list'], { from: 'user' });
    } catch (e: unknown) {
      caughtError = e as Error;
    }

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(caughtError).not.toBeNull();
  });

  it('should exit(1) when show is called outside a project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    let caughtError: Error | null = null;
    try {
      await program.parseAsync(['knowledge', 'show', 'KP-0001'], { from: 'user' });
    } catch (e: unknown) {
      caughtError = e as Error;
    }

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(caughtError).not.toBeNull();
  });

  // ── show: verified_at branch ─────────────────────────────────────

  it('show: should print Verified line when verified_at is present', async () => {
    mockGetKnowledgePage.mockReturnValue(
      makePage('KP-0010', { verified_at: '2024-06-15' }),
    );

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-0010'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Verified:'));
    expect(logSpy).toHaveBeenCalledWith('Verified: 2024-06-15');
  });

  // ── show: tags branch ────────────────────────────────────────────

  it('show: should print Tags line when tags array is non-empty', async () => {
    mockGetKnowledgePage.mockReturnValue(
      makePage('KP-0011', { tags: ['architecture', 'saga'] }),
    );

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-0011'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('Tags: architecture, saga');
  });

  it('show: should NOT print Tags line when tags array is empty', async () => {
    mockGetKnowledgePage.mockReturnValue(
      makePage('KP-0012', { tags: [] }),
    );

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-0012'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('Tags:');
  });

  it('show: should NOT print Verified line when verified_at is absent', async () => {
    mockGetKnowledgePage.mockReturnValue(
      makePage('KP-0013', { verified_at: undefined }),
    );

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-0013'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('Verified:');
  });

  // ── verify: default (no --id, no --all) → all ────────────────────

  it('verify: with no flags should default to verifying all pages', async () => {
    mockVerifyKnowledge.mockReturnValue([]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'verify'], { from: 'user' });

    expect(mockVerifyKnowledge).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      { id: undefined, all: true },
    );
  });

  // ── verify: --id specific page ───────────────────────────────────

  it('verify: with --id should verify only that page', async () => {
    mockVerifyKnowledge.mockReturnValue([
      { id: 'KP-0001', status: 'fresh', days_since_verify: 0 },
    ]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'verify', '--id', 'KP-0001'], { from: 'user' });

    expect(mockVerifyKnowledge).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      { id: 'KP-0001', all: false },
    );
  });

  // ── organize: error auto_fixable=false → Manual fix required ─────

  it('organize: should print "Manual fix required" for non-auto-fixable errors', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 5,
        total_index_entries: 4,
        duplicate_ids: 1,
        missing_from_index: 1,
        orphaned_index_entries: 0,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'error' as const, type: 'duplicate_id', message: 'Duplicate KP-0001', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Manual fix required');
    expect(calls).toContain('Duplicate KP-0001');
  });

  // ── organize: warning auto_fixable=true → Auto-fixable hint ──────

  it('organize: should print "Auto-fixable (use --fix)" for auto-fixable warnings', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 5,
        total_index_entries: 4,
        duplicate_ids: 0,
        missing_from_index: 0,
        orphaned_index_entries: 1,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'warning' as const, type: 'orphaned_index', message: 'Orphaned entry KP-0009', auto_fixable: true },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Auto-fixable (use --fix)');
    expect(calls).toContain('Orphaned entry KP-0009');
  });

  // ── organize: info with --verbose ────────────────────────────────

  it('organize: should show info issues only with --verbose flag', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 5,
        total_index_entries: 5,
        duplicate_ids: 0,
        missing_from_index: 0,
        orphaned_index_entries: 0,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'info' as const, type: 'notice', message: 'Consider updating index format', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize', '--verbose'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Info (1)');
    expect(calls).toContain('Consider updating index format');
  });

  it('organize: should NOT show info issues without --verbose flag', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 5,
        total_index_entries: 5,
        duplicate_ids: 0,
        missing_from_index: 0,
        orphaned_index_entries: 0,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'info' as const, type: 'notice', message: 'Consider updating index format', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('Info (1)');
    expect(calls).not.toContain('Consider updating index format');
  });

  // ── organize: negative — no auto-fixable issues → no suggestion ──

  it('organize: should NOT suggest --fix when no issues are auto-fixable', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 5,
        total_index_entries: 4,
        duplicate_ids: 0,
        missing_from_index: 0,
        orphaned_index_entries: 1,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'warning' as const, type: 'orphaned_index', message: 'Orphaned entry KP-0009', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('Run with --fix');
  });

  // ── organize: mixed severity issue report ────────────────────────

  it('organize: should print errors, warnings, and infos when all exist', async () => {
    mockOrganizeKnowledge.mockReturnValue({
      stats: {
        total_files: 10,
        total_index_entries: 8,
        duplicate_ids: 1,
        missing_from_index: 1,
        orphaned_index_entries: 0,
        missing_required_fields: 0,
        type_mismatches: 0,
      },
      issues: [
        { severity: 'error' as const, type: 'duplicate_id', message: 'Duplicate KP-0001', auto_fixable: false },
        { severity: 'warning' as const, type: 'missing_field', message: 'Missing title on KP-0003', auto_fixable: true },
        { severity: 'info' as const, type: 'notice', message: 'Index is almost full', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize', '--verbose'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Errors (1)');
    expect(calls).toContain('Warnings (1)');
    expect(calls).toContain('Info (1)');
    expect(calls).toContain('Duplicate KP-0001');
    expect(calls).toContain('Missing title on KP-0003');
    expect(calls).toContain('Index is almost full');
  });

  // context: scope filtering with comma-separated values ─────────────

  it('context: should filter by multiple comma-separated scopes', async () => {
    mockGetKnowledgeContext.mockReturnValue([
      makePage('KP-0001', { scope: 'global' }),
      makePage('KP-0002', { scope: 'module' }),
      makePage('KP-0003', { scope: 'local' }),
    ]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(
      ['knowledge', 'context', '/some/path', '--scopes', 'global,local'],
      { from: 'user' },
    );

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('KP-0001');
    expect(calls).toContain('KP-0003');
    expect(calls).not.toContain('KP-0002');
  });

  // ── list: filtered output with mixed fields ──────────────────────

  it('list: should show page with line format [type] id: title (status)', async () => {
    mockListKnowledgePages.mockReturnValue([
      makePage('KP-0001', { type: 'pattern', status: 'active' }),
    ]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'list'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      '  [pattern] KP-0001: Title for KP-0001 (active)',
    );
  });

  // ── verify: with --all flag ──────────────────────────────────────

  it('verify: --all flag should be passed correctly', async () => {
    mockVerifyKnowledge.mockReturnValue([]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'verify', '--all'], { from: 'user' });

    expect(mockVerifyKnowledge).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      { id: undefined, all: true },
    );
  });

  // ── requireRoot: stale command outside project ───────────────────

  it('should exit(1) when stale is called outside a project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    let caughtError: Error | null = null;
    try {
      await program.parseAsync(['knowledge', 'stale'], { from: 'user' });
    } catch (e: unknown) {
      caughtError = e as Error;
    }

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(caughtError).not.toBeNull();
  });
});
