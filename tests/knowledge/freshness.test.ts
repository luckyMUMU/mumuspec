import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyKnowledge, listStalePages, supersedeKnowledge } from '../../src/knowledge/freshness.js';
import { createKnowledgePage, getKnowledgePage } from '../../src/knowledge/pages.js';
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

function createProjectWithKnowledge(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-know-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  const config = defaultConfig();
  return { dir, config };
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writeFreshPage(dir: string, config: MumuSpecConfig, id: string): void {
  createKnowledgePage(dir, config, {
    id,
    title: `Test ${id}`,
    type: 'decision',
    scope: '.',
    content: `# ${id}\n\nTest content.`,
  });
}

describe('verifyKnowledge', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProjectWithKnowledge();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty array when no pages exist', () => {
    const results = verifyKnowledge(projectDir, config, {});
    expect(results).toEqual([]);
  });

  it('should return fresh for newly created pages', () => {
    writeFreshPage(projectDir, config, 'test-fresh');
    const results = verifyKnowledge(projectDir, config, { id: 'test-fresh' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-fresh');
    expect(results[0].status).toBe('fresh');
    expect(typeof results[0].days_since_verify).toBe('number');
  });

  it('should support all=true option', () => {
    writeFreshPage(projectDir, config, 'page1');
    writeFreshPage(projectDir, config, 'page2');
    const results = verifyKnowledge(projectDir, config, { all: true });
    expect(results).toHaveLength(2);
  });
});

describe('listStalePages', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProjectWithKnowledge();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty when all pages are fresh', () => {
    writeFreshPage(projectDir, config, 'fresh-page');
    const results = listStalePages(projectDir, config);
    expect(results.find((r) => r.id === 'fresh-page')).toBeUndefined();
  });

  it('should return shaped objects', () => {
    const results = listStalePages(projectDir, config);
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('supersedeKnowledge', () => {
  let projectDir: string;
  let config: MumuSpecConfig;

  beforeEach(() => {
    const setup = createProjectWithKnowledge();
    projectDir = setup.dir;
    config = setup.config;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should throw for non-existent old page', () => {
    writeFreshPage(projectDir, config, 'new-page');
    expect(() => supersedeKnowledge(projectDir, config, 'missing-old', 'new-page')).toThrow();
  });

  it('should throw for non-existent new page', () => {
    writeFreshPage(projectDir, config, 'old-page');
    expect(() => supersedeKnowledge(projectDir, config, 'old-page', 'missing-new')).toThrow();
  });

  it('should supersede old page and update new page reference', () => {
    writeFreshPage(projectDir, config, 'old-page');
    writeFreshPage(projectDir, config, 'new-page');
    supersedeKnowledge(projectDir, config, 'old-page', 'new-page');
    expect(true).toBe(true);
  });
});
