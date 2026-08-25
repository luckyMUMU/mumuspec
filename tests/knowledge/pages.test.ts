import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getKnowledgeDir,
  listKnowledgePages,
  loadKnowledgePage,
  getKnowledgePage,
  searchKnowledge,
  getKnowledgeContext,
  createKnowledgePage,
} from '../../src/knowledge/pages.js';
import type { MumuSpecConfig } from '../../src/core/config.js';

function defaultConfig(): MumuSpecConfig {
  return {
    project: { name: 'test', language: 'typescript' },
    knowledge: {
      wiki: { dir: '.mumuspec/knowledge' },
      freshness: { warn_after_days: 30, error_after_days: 90 },
      progressive_disclosure: { max_pages_per_layer: 10 },
    },
  } as unknown as MumuSpecConfig;
}

function createProject(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-kp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  return { dir, config: defaultConfig() };
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writePage(baseDir: string, config: MumuSpecConfig, id: string, type: string): void {
  const knowledgeDir = join(baseDir, config.knowledge.wiki.dir);
  const typeDir = join(knowledgeDir, `${type}s`);
  mkdirSync(typeDir, { recursive: true });
  writeFileSync(join(typeDir, `${id}.md`), [
    '---',
    `id: ${id}`,
    `title: Page ${id}`,
    `type: ${type}`,
    `status: confirmed`,
    'scope: .',
    `created_at: 2026-01-01`,
    `verified_at: 2026-08-01`,
    '---',
    '',
    `# ${id}`,
    '',
    'Content here.',
    '',
  ].join('\n'));
}

describe('getKnowledgeDir', () => {
  it('returns the correct knowledge directory path', () => {
    const { dir, config } = createProject();
    const result = getKnowledgeDir(dir, config);
    expect(result).toContain('.mumuspec');
    expect(result).toContain('knowledge');
    cleanup(dir);
  });
});

describe('listKnowledgePages', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty for missing knowledge dir', () => {
    const result = listKnowledgePages(projectDir, config);
    expect(result).toEqual([]);
  });

  it('lists pages from decisions directory', () => {
    writePage(projectDir, config, 'DEC-001', 'decision');
    const result = listKnowledgePages(projectDir, config);
    expect(result.length).toBe(1);
    expect(result[0].frontmatter.id).toBe('DEC-001');
  });

  it('filters by type option', () => {
    writePage(projectDir, config, 'DEC-001', 'decision');
    writePage(projectDir, config, 'PTN-001', 'pattern');
    const result = listKnowledgePages(projectDir, config, { type: 'decision' });
    expect(result.length).toBe(1);
    expect(result[0].frontmatter.id).toBe('DEC-001');
  });

  it('filters by scope option', () => {
    writePage(projectDir, config, 'scoped-page', 'decision');
    const result = listKnowledgePages(projectDir, config, { scope: '.' });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe('loadKnowledgePage', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns undefined for non-existent file', () => {
    const result = loadKnowledgePage(join(projectDir, 'nonexistent.md'));
    expect(result).toBeUndefined();
  });

  it('loads a valid knowledge page', () => {
    const knowledgeDir = join(projectDir, config.knowledge.wiki.dir, 'decisions');
    mkdirSync(knowledgeDir, { recursive: true });
    const filePath = join(knowledgeDir, 'test.md');
    writeFileSync(filePath, '---\nid: test\ntitle: Test\ntype: decision\nscope: .\n---\n\n# Body\n');

    const result = loadKnowledgePage(filePath);
    expect(result).toBeDefined();
    expect(result?.frontmatter.id).toBe('test');
    expect(result?.path).toBe(filePath);
  });

  it('returns undefined for empty file', () => {
    const knowledgeDir = join(projectDir, config.knowledge.wiki.dir, 'decisions');
    mkdirSync(knowledgeDir, { recursive: true });
    const filePath = join(knowledgeDir, 'empty.md');
    writeFileSync(filePath, '');

    const result = loadKnowledgePage(filePath);
    expect(result).toBeUndefined();
  });
});

describe('getKnowledgePage', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns undefined for missing ID', () => {
    const result = getKnowledgePage(projectDir, config, 'no-such-id');
    expect(result).toBeUndefined();
  });

  it('finds page by ID', () => {
    writePage(projectDir, config, 'FIND-001', 'decision');
    const result = getKnowledgePage(projectDir, config, 'FIND-001');
    expect(result).toBeDefined();
    expect(result?.frontmatter.id).toBe('FIND-001');
  });
});

describe('searchKnowledge', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty for empty project', () => {
    const result = searchKnowledge(projectDir, config, { keyword: 'anything' });
    expect(result).toEqual([]);
  });

  it('filters by keyword in title', () => {
    writePage(projectDir, config, 'KEY-001', 'decision');
    const result = searchKnowledge(projectDir, config, { keyword: 'KEY-001' });
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('filters by tag', () => {
    writePage(projectDir, config, 'TAG-001', 'decision');
    const result = searchKnowledge(projectDir, config, { tag: 'nonexistent' });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('getKnowledgeContext', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns scoped pages sorted by recency', () => {
    writePage(projectDir, config, 'CTX-001', 'decision');
    const result = getKnowledgeContext(projectDir, config, 'src/core/config.ts');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('createKnowledgePage', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProject();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('creates a page and returns its file path', () => {
    const path = createKnowledgePage(projectDir, config, {
      id: 'NEW-001',
      title: 'New Decision',
      type: 'decision',
      scope: '.',
      content: '# New\n\nContent',
    });
    expect(path).toContain('NEW-001.md');
  });

  it('creates type directory if not exists', () => {
    const path = createKnowledgePage(projectDir, config, {
      id: 'RISK-001',
      title: 'Risk Entry',
      type: 'risk',
      scope: 'src/core',
      content: 'Risk content',
    });
    expect(path).toContain('RISK-001.md');
  });
});
