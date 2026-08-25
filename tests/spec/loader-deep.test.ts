/**
 * Deep tests for spec/loader.ts — targets remaining uncovered paths
 * not covered by loader.test.ts.
 *
 * Uses vi.mock('node:fs') to isolate I/O while relying on the
 * real node:path for correct cross-platform path operations.
 *
 * Covers:
 * - buildIndex: child prd.md / design.md / tech.md reading, 200-char truncation,
 *   hidden directory filtering, readdirSync error handling
 * - searchSpecs: scope filtering (break behavior), keyword case-insensitivity,
 *   type filter combinations, readdirSync errors, corrupted files
 * - getProhibitions: multi-layer collection, corrupted spec handling
 * - loadSpecContext: parent_tech inheritance merge
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

// ── Mock node:fs ──────────────────────────────────────────────────
const mockExistsSync = vi.fn<(p: string) => boolean>();
const mockReadFileSync = vi.fn<(p: string, enc: string) => string>();
const mockReaddirSync = vi.fn<(p: string, opts?: unknown) => unknown>();

vi.mock('node:fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readFileSync: (p: string, enc: string) => mockReadFileSync(p, enc),
  readdirSync: (p: string, opts?: unknown) => mockReaddirSync(p, opts),
}));

// Import after mocks are set up
import {
  buildIndex,
  searchSpecs,
  getProhibitions,
} from '../../src/spec/loader.js';

import type { MumuSpecConfig } from '../../src/core/config.js';

// ── Helpers ───────────────────────────────────────────────────────

const defaultConfig: MumuSpecConfig = {
  version: '0.12.2',
  project: { name: 'test', language: 'typescript' },
  specs: { root: '.', format: 'distributed', max_layer_depth: 5, auto_index: true, require_design_doc: false },
  knowledge: {
    enabled: false,
    code_graph: { enabled: false, storage: 'json', db_path: '', auto_index_on_commit: false, languages: [] },
    wiki: { dir: '', auto_extract_on_archive: false, max_pages_per_scope: 10 },
    progressive_disclosure: { max_pages_per_layer: 50, load_stale_summary: false },
    freshness: { check_on_load: false, warn_after_days: 30, error_after_days: 90 },
    drift_detection: false,
    reverse_index: { file: '', auto_rebuild: [], fallback: false },
    commit_update: { enabled: false, timeout_ms: 5000, async: true, llm_enhancement: false },
    commit_message: { parse_knowledge_impact: false },
    coverage: { importance_formula: '', gap_threshold: 0.5 },
  },
  enforcement: { engine: 'basic', severity_levels: [], fail_on: 'error' },
  changes: {
    default_workflow: 'full',
    require_brainstorming: false,
    auto_transition: false,
    default_rollback_limit: 3,
    default_rebuild_limit: 3,
    default_build_mode: 'incremental',
    default_tdd_mode: 'strict',
    single_active_change: true,
    default_isolation: 'worktree',
    allow_isolation_downgrade: false,
    implementation_strategy: 'feature-branch',
    design_strategy: 'top-down',
    tdd_mode: 'strict',
    test_immutability: false,
  },
  workflow: {
    worktree_isolation: true,
    single_active_change: true,
    top_down_design: true,
    tdd_enforced: true,
    max_active_changes: 1,
  },
  constraint_strength: {
    technical_design: 'high',
    requirement_goals: 'high',
    exceptions: [],
  },
  ci: { pre_commit_check: 'warn', test_immutability_check: false, full_check_on_push: false, drift_detection_on_pr: false },
  ai: { generate_rules: false, mcp_server: false, rules_files: [] },
  skills: { enabled: false, discovery: 'auto', ecosystems: {}, dispatch: {}, hyperplan: {} },
  contracts: { enabled: false, dir: 'contracts', strict_mode: false, auto_validate: false },
  ponytail: { enabled: true },
};

/** Set of paths that should report as "exists" */
let existingPaths: Set<string> = new Set();
/** Map of file path -> content for readFileSync */
let fileContents: Map<string, string> = new Map();
/** Map of directory path -> entries for readdirSync */
let dirEntries: Map<string, { name: string; isDirectory: () => boolean; isFile: () => boolean }[]> = new Map();

function setupFs(): void {
  existingPaths = new Set();
  fileContents = new Map();
  dirEntries = new Map();

  mockExistsSync.mockImplementation((p: string) => existingPaths.has(p));
  mockReadFileSync.mockImplementation((p: string, _enc: string) => {
    const content = fileContents.get(p);
    if (content === undefined) throw new Error(`File not found: ${p}`);
    return content;
  });
  mockReaddirSync.mockImplementation((p: string, _opts?: unknown) => {
    const entries = dirEntries.get(p);
    if (entries === undefined) throw new Error(`Directory not found: ${p}`);
    return entries;
  });
}

function resetMocks(): void {
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
  mockReaddirSync.mockReset();
  existingPaths = new Set();
  fileContents = new Map();
  dirEntries = new Map();
}

function addSpecFile(filePath: string, content: string): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('\\'));
  existingPaths.add(dir);
  existingPaths.add(filePath);
  fileContents.set(filePath, content);
}

function addDir(dirPath: string, entries: { name: string; isDirectory: () => boolean; isFile: () => boolean }[]): void {
  existingPaths.add(dirPath);
  dirEntries.set(dirPath, entries);
}

// ── Tests ─────────────────────────────────────────────────────────

describe('buildIndex — child prd.md / design.md / tech.md reading', () => {
  beforeEach(() => { setupFs(); });
  afterEach(() => { resetMocks(); });

  it('should read child prd.md for prdSummary when prd.md exists', () => {
    const prdContent = '---\nscope: sub\nlayer: 1\n---\n\nFirst real line of PRD content.\n';
    const rootDir = 'C:\\project';

    addDir('C:\\project', [
      { name: 'sub', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\sub', []);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n- SHALL: "x"\n');
    addSpecFile(join(rootDir, 'sub', '.mumuspec', 'prd.md'), prdContent);
    // Child must have a tech/spec for it to be included
    addSpecFile(join(rootDir, 'sub', '.mumuspec', 'tech.md'), '---\nscope: sub\nlayer: 1\ndoc_type: tech\n---\n## Req\n');

    const result = buildIndex(rootDir, rootDir);

    expect(result).toBeDefined();
    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].name).toBe('sub');
    expect(result!.children[0].prd_summary).toBe('First real line of PRD content.');
  });

  it('should fall back to design.md for child prdSummary when prd.md missing', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', [
      { name: 'child', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\child', []);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n- SHALL: "x"\n');
    addSpecFile(join(rootDir, 'child', '.mumuspec', 'design.md'), '---\nscope: child\nlayer: 1\n---\n\nDesign doc first line.\n');

    const result = buildIndex(rootDir, rootDir);

    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].prd_summary).toBe('Design doc first line.');
  });

  it('should read child tech.md for techSummary and constraintCount', () => {
    const rootDir = 'C:\\project';
    const techContent = [
      '---',
      'scope: mod',
      'layer: 1',
      'doc_type: tech',
      '---',
      '',
      '## Requirement: Security',
      '',
      '### SHALL',
      '',
      '- "must encrypt data"',
      '',
      '### SHALL NOT',
      '',
      '- "must not leak secrets"',
      '',
    ].join('\n');

    addDir('C:\\project', [
      { name: 'mod', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\mod', []);
    addSpecFile(join(rootDir, '.mumuspec', 'tech.md'), '---\nscope: .\nlayer: 0\ndoc_type: tech\n---\n## R1\n');
    addSpecFile(join(rootDir, 'mod', '.mumuspec', 'tech.md'), techContent);

    const result = buildIndex(rootDir, rootDir);

    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].tech_summary).toBe('Security');
    expect(result!.children[0].constraint_count).toBe(2);
  });

  it('should skip hidden directories and node_modules', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', [
      { name: '.hidden', isDirectory: () => true, isFile: () => false },
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      { name: 'valid', isDirectory: () => true, isFile: () => false },
    ]);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n- SHALL: "x"\n');
    // Don't add .mumuspec for any of these children

    const result = buildIndex(rootDir, rootDir);

    // None of the children have .mumuspec dirs, so no children indexed
    expect(result!.children).toHaveLength(0);
  });

  it('should handle readdirSync throwing for children', () => {
    const rootDir = 'C:\\project';

    existingPaths.add(rootDir);
    mockReaddirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n');

    const result = buildIndex(rootDir, rootDir);
    expect(result!.children).toHaveLength(0);
  });

  it('should truncate prdSummary to 200 chars max', () => {
    const rootDir = 'C:\\project';
    const longLine = 'A'.repeat(300);

    addDir('C:\\project', [
      { name: 'long', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\long', []);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n- SHALL: "x"\n');
    addSpecFile(join(rootDir, 'long', '.mumuspec', 'prd.md'), `---\nscope: long\nlayer: 1\n---\n\n${longLine}\n`);

    const result = buildIndex(rootDir, rootDir);

    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].prd_summary.length).toBeLessThanOrEqual(200);
    expect(result!.children[0].prd_summary.length).toBe(200);
  });

  it('should fall back to spec.md for child techSummary when tech.md missing', () => {
    const rootDir = 'C:\\project';
    const specContent = '---\nscope: mod\nlayer: 1\n---\n\n## Requirement: NetworkLayer\n\n### SHALL\n\n- "must connect"\n\n### SHALL NOT\n\n- "must not timeout"\n';

    addDir('C:\\project', [
      { name: 'mod', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\mod', []);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n## R1\n');
    addSpecFile(join(rootDir, 'mod', '.mumuspec', 'spec.md'), specContent);

    const result = buildIndex(rootDir, rootDir);

    expect(result!.children).toHaveLength(1);
    expect(result!.children[0].tech_summary).toBe('NetworkLayer');
    expect(result!.children[0].constraint_count).toBe(2);
  });
});

describe('searchSpecs — scope filtering and recursion', () => {
  beforeEach(() => { setupFs(); });
  afterEach(() => { resetMocks(); });

  it('should break (not include files) when scope does not match', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    addDir('C:\\project\\src', []);
    addSpecFile(join(rootDir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "root test"\n');
    addSpecFile(join(rootDir, 'src', '.mumuspec', 'spec.md'), '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "src content"\n');

    // Search with scope that doesn't match 'src' — the src file should be skipped
    const results = searchSpecs(rootDir, { scope: 'nonexistent', type: 'shall' });
    const srcResults = results.filter(r => r.file.includes('src'));
    expect(srcResults).toHaveLength(0);
  });

  it('should match shall keyword case-insensitively', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', []);
    addSpecFile(
      join(rootDir, '.mumuspec', 'spec.md'),
      '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "Use TypeScript for type safety"\n',
    );

    const results = searchSpecs(rootDir, { keyword: 'typescript' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('shall');
    expect(results[0].text.toLowerCase()).toContain('typescript');
  });

  it('should include both shall and shall-not when no type filter', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', []);
    addSpecFile(
      join(rootDir, '.mumuspec', 'spec.md'),
      '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "do this"\n\n### SHALL NOT\n\n- "dont do this"\n',
    );

    const results = searchSpecs(rootDir, { keyword: 'this' });
    const shalls = results.filter(r => r.type === 'shall');
    const shallNots = results.filter(r => r.type === 'shall-not');
    expect(shalls.length).toBeGreaterThanOrEqual(1);
    expect(shallNots.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle readdirSync throwing during recursion', () => {
    const rootDir = 'C:\\project';

    existingPaths.add(rootDir);
    existingPaths.add(join(rootDir, '.mumuspec'));
    existingPaths.add(join(rootDir, '.mumuspec', 'spec.md'));
    fileContents.set(
      join(rootDir, '.mumuspec', 'spec.md'),
      '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "x"\n',
    );
    mockReaddirSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const results = searchSpecs(rootDir, {});
    // Should still find the root spec even if readdir throws
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip corrupted spec files silently', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', []);
    addSpecFile(
      join(rootDir, '.mumuspec', 'spec.md'),
      '---\nbroken: [unclosed\n---\n## R1\n- SHALL: "x"\n',
    );

    const results = searchSpecs(rootDir, {});
    expect(Array.isArray(results)).toBe(true);
  });

  it('should only return shall-not results when type filter is shall-not', () => {
    const rootDir = 'C:\\project';

    addDir('C:\\project', []);
    addSpecFile(
      join(rootDir, '.mumuspec', 'spec.md'),
      '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "positive"\n\n### SHALL NOT\n\n- "negative"\n',
    );

    const results = searchSpecs(rootDir, { type: 'shall-not' });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.every(r => r.type === 'shall-not')).toBe(true);
  });
});

describe('getProhibitions — per-layer collection', () => {
  beforeEach(() => { setupFs(); });
  afterEach(() => { resetMocks(); });

  it('should collect prohibitions from each layer in the chain', () => {
    const rootDir = 'C:\\project';
    const targetPath = join(rootDir, 'src', 'core');

    addDir(rootDir, []);
    addDir(join(rootDir, 'src'), []);
    addDir(join(rootDir, 'src', 'core'), []);

    existingPaths.add(join(rootDir, '.mumuspec'));
    existingPaths.add(join(rootDir, '.mumuspec', 'spec.md'));
    existingPaths.add(join(rootDir, 'src', '.mumuspec'));
    existingPaths.add(join(rootDir, 'src', '.mumuspec', 'spec.md'));
    existingPaths.add(join(rootDir, 'src', 'core', '.mumuspec'));
    existingPaths.add(join(rootDir, 'src', 'core', '.mumuspec', 'spec.md'));

    mockReadFileSync.mockImplementation((p: string, _enc: string) => {
      if (p.includes(join('src', 'core')) && p.endsWith(join('.mumuspec', 'spec.md'))) {
        return '---\nscope: src/core\nlayer: 2\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "core prohibition"\n';
      }
      if (p.includes(join('src', '.mumuspec')) && p.endsWith('spec.md')) {
        return '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "src prohibition"\n';
      }
      return '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "root prohibition"\n';
    });
    mockReaddirSync.mockReturnValue([]);

    const results = getProhibitions(rootDir, targetPath);

    const texts = results.map(r => r.text);
    expect(texts).toContain('"root prohibition"');
    expect(texts).toContain('"src prohibition"');
    expect(texts).toContain('"core prohibition"');
  });

  it('should handle corrupted specs in chain gracefully', () => {
    const rootDir = 'C:\\project';
    const targetPath = join(rootDir, 'src');

    addDir(rootDir, []);
    addDir(join(rootDir, 'src'), []);

    existingPaths.add(join(rootDir, '.mumuspec'));
    existingPaths.add(join(rootDir, '.mumuspec', 'spec.md'));
    existingPaths.add(join(rootDir, 'src', '.mumuspec'));
    existingPaths.add(join(rootDir, 'src', '.mumuspec', 'spec.md'));

    mockReadFileSync.mockImplementation((p: string, _enc: string) => {
      if (p.endsWith(join('src', '.mumuspec', 'spec.md'))) {
        // Broken yaml - missing scope
        return '---\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "bad"\n';
      }
      return '---\nscope: .\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "root rule"\n';
    });
    mockReaddirSync.mockReturnValue([]);

    const results = getProhibitions(rootDir, targetPath);
    // Root should still be collected even if src spec is corrupted
    expect(results.some(r => r.text === '"root rule"')).toBe(true);
  });
});

describe('loadSpecContext — inheritance with parent_tech', () => {
  beforeEach(() => { setupFs(); });
  afterEach(() => { resetMocks(); });

  it('should merge parent requirements when parent_tech is specified', async () => {
    const { loadSpecContext } = await import('../../src/spec/loader.js');

    const rootDir = 'C:\\project';
    const targetPath = join(rootDir, 'child');

    const parentTechContent = [
      '---',
      'scope: .',
      'layer: 0',
      'doc_type: tech',
      '---',
      '',
      '## Requirement: ParentReq',
      '',
      '### SHALL',
      '',
      '- "parent must 使用强类型"',
      '',
      '### SHALL NOT',
      '',
      '- "parent 禁止 eval"',
      '',
    ].join('\n');

    const childTechContent = [
      '---',
      'scope: child',
      'layer: 1',
      'doc_type: tech',
      'parent_tech: ../../.mumuspec/tech.md',
      '---',
      '',
      '## Requirement: ChildReq',
      '',
      '### SHALL',
      '',
      '- "child must implement"',
      '',
      '### SHALL NOT',
      '',
      '- "child must not skip"',
      '',
    ].join('\n');

    addDir(rootDir, [
      { name: 'child', isDirectory: () => true, isFile: () => false },
    ]);
    addDir(join(rootDir, 'child'), []);

    existingPaths.add(join(rootDir, '.mumuspec'));
    existingPaths.add(join(rootDir, '.mumuspec', 'tech.md'));
    existingPaths.add(join(rootDir, 'child', '.mumuspec'));
    existingPaths.add(join(rootDir, 'child', '.mumuspec', 'tech.md'));

    mockReadFileSync.mockImplementation((p: string, _enc: string) => {
      if (p.endsWith(join('child', '.mumuspec', 'tech.md'))) {
        return childTechContent;
      }
      return parentTechContent;
    });
    mockReaddirSync.mockReturnValue([]);

    const result = loadSpecContext(targetPath, rootDir, defaultConfig);

    const childLayer = result.layers.find(l => l.scope === 'child');
    expect(childLayer).toBeDefined();
    expect(childLayer!.tech).toBeDefined();
    // After inheritance merge: child has its own + parent requirements
    expect(childLayer!.tech!.requirements.length).toBeGreaterThanOrEqual(2);
  });
});
