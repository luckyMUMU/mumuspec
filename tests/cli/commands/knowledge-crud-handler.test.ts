/**
 * Handler-level tests for knowledge-crud subcommands.
 *
 * Tests list, show, search, context, verify, stale, supersede, organize,
 * rebuild-index subcommand handlers by mocking knowledge/manager.js and
 * invoking handlers through commander's parseAsync().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock functions ──
const {
  mockListKnowledgePages,
  mockGetKnowledgePage,
  mockSearchKnowledge,
  mockKnowledgeSearch,
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
  mockKnowledgeSearch: vi.fn(),
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

vi.mock('../../../src/knowledge/search.js', () => ({
  knowledgeSearch: mockKnowledgeSearch,
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

describe('knowledge-crud subcommand handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ knowledge: {} });

    mockListKnowledgePages.mockReturnValue([
      makePage('KP-0001'),
      makePage('KP-0002'),
    ]);
    mockGetKnowledgePage.mockReturnValue(makePage('KP-0001'));
    mockSearchKnowledge.mockReturnValue([makePage('KP-0003')]);
    mockGetKnowledgeContext.mockReturnValue([makePage('KP-0004')]);
    mockVerifyKnowledge.mockReturnValue([
      { id: 'KP-0001', status: 'fresh', days_since_verify: 0 },
      { id: 'KP-0002', status: 'stale', days_since_verify: 45 },
    ]);
    mockListStalePages.mockReturnValue([
      { id: 'KP-0005', title: 'Old decision', days: 60 },
    ]);
    mockSupersedeKnowledge.mockReturnValue(undefined);
    mockRebuildPageIndex.mockReturnValue({ pages: [{ id: 'KP-0001' }, { id: 'KP-0002' }] });
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

  // ── list subcommand ──────────────────────────────────────────────

  it('list: should print count and page details', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'list'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 knowledge page(s)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KP-0001')
    );
  });

  it('list: should print "No knowledge pages found" when empty', async () => {
    mockListKnowledgePages.mockReturnValue([]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'list'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('No knowledge pages found.');
  });

  it('list: should pass type and scope filters', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'list', '--type', 'pattern', '--scope', 'global'], { from: 'user' });

    expect(mockListKnowledgePages).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      { type: 'pattern', scope: 'global' }
    );
  });

  // ── show subcommand ──────────────────────────────────────────────

  it('show: should print page details', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-0001'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ID:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Title:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('KP-0001'));
  });

  it('show: should exit(1) when page not found', async () => {
    mockGetKnowledgePage.mockReturnValue(null);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'show', 'KP-9999'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Knowledge page not found')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── search subcommand（2026-09-05 已合并 search2 增强引擎，relevance scoring）──

  it('search: should print scored results count and page ids', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    mockKnowledgeSearch.mockReturnValue([
      {
        score: 42,
        entry: { id: 'KP-0003', title: 'Title for KP-0003', type: 'pattern', scope: 'global' },
        matchedFields: ['title'],
        excerpt: 'Saga pattern content.',
      },
    ]);

    await program.parseAsync(['knowledge', 'search', 'saga'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 result(s)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KP-0003')
    );
  });

  it('search: should pass keyword and filters to enhanced engine', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    mockKnowledgeSearch.mockReturnValue([]);

    await program.parseAsync(
      ['knowledge', 'search', 'pattern', '--tag', 'architecture', '--type', 'pattern'],
      { from: 'user' }
    );

    expect(mockKnowledgeSearch).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      'pattern',
      expect.objectContaining({ type: ['pattern'], tags: ['architecture'] })
    );
  });

  // ── context subcommand ──────────────────────────────────────────

  it('context: should print pages for path', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'context', '/some/path'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('knowledge page(s) for /some/path')
    );
  });

  it('context: should filter by scopes when --scopes provided', async () => {
    mockGetKnowledgeContext.mockReturnValue([
      makePage('KP-0001', { scope: 'global' }),
      makePage('KP-0002', { scope: 'module' }),
    ]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(
      ['knowledge', 'context', '/some/path', '--scopes', 'global'],
      { from: 'user' }
    );

    // Only global-scoped page should appear
    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('KP-0001');
  });

  // ── verify subcommand ───────────────────────────────────────────

  it('verify: --all should verify all pages', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'verify', '--all'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 page(s) verified')
    );
  });

  it('verify: should print status icons for fresh/stale/missing', async () => {
    mockVerifyKnowledge.mockReturnValue([
      { id: 'KP-0001', status: 'fresh', days_since_verify: 0 },
      { id: 'KP-0002', status: 'stale', days_since_verify: 45 },
      { id: 'KP-0003', status: 'missing', days_since_verify: -1 },
    ]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'verify', '--all'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('KP-0001');
  });

  // ── stale subcommand ────────────────────────────────────────────

  it('stale: should print stale pages when found', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'stale'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 stale page(s)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Old decision')
    );
  });

  it('stale: should print "ok" message when no stale pages', async () => {
    mockListStalePages.mockReturnValue([]);

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'stale'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('ok - No stale knowledge pages');
  });

  // ── supersede subcommand ────────────────────────────────────────

  it('supersede: should call supersedeKnowledge and print confirmation', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'supersede', 'KP-0001', '--by', 'KP-0002'], { from: 'user' });

    expect(mockSupersedeKnowledge).toHaveBeenCalledWith(
      '/fake/root',
      expect.any(Object),
      'KP-0001',
      'KP-0002'
    );
    expect(logSpy).toHaveBeenCalledWith('Knowledge page KP-0001 superseded by KP-0002');
  });

  // ── organize subcommand ─────────────────────────────────────────

  it('organize: should print stats and "No issues" message when clean', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KNOWLEDGE BASE ORGANIZE')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No issues found')
    );
  });

  it('organize: should print issues by severity with auto-fix hints', async () => {
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
        { severity: 'error' as const, type: 'duplicate_id', message: 'Duplicate KP-0001', auto_fixable: true },
        { severity: 'warning' as const, type: 'missing_field', message: 'Missing title', auto_fixable: false },
      ],
      fixed: 0,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize'], { from: 'user' });

    const calls = logSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Errors (1)');
    expect(calls).toContain('Duplicate KP-0001');
    expect(calls).toContain('Run with --fix to auto-fix 1 issue(s).');
  });

  it('organize: --fix should print fixed count', async () => {
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
      issues: [],
      fixed: 3,
    });

    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'organize', '--fix'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fixed 3 issue(s)')
    );
  });

  // ── rebuild-index subcommand ────────────────────────────────────

  it('rebuild-index: should print rebuilt page count', async () => {
    const { registerKnowledgeCrud } = await import('../../../src/cli/commands/knowledge-crud.js');
    const program = new Command();
    const knowledgeCmd = program.command('knowledge');
    registerKnowledgeCrud(knowledgeCmd);

    await program.parseAsync(['knowledge', 'rebuild-index'], { from: 'user' });

    expect(mockRebuildPageIndex).toHaveBeenCalledWith('/fake/root', expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('PageIndex rebuilt with 2 entries')
    );
  });
});
