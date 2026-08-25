import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { organizeKnowledge } from '../../src/knowledge/organize.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { KnowledgePageFrontmatter } from '../../src/core/types.js';

// ─── Helpers ───

function defaultConfig(knowledgeDir: string = '.mumuspec/knowledge'): MumuSpecConfig {
  return {
    project: { name: 'test', language: 'typescript' },
    knowledge: {
      wiki: { dir: knowledgeDir },
      freshness: { warn_after_days: 30, error_after_days: 90 },
      progressive_disclosure: { max_pages_per_layer: 10 },
      reverse_index: { file: '_reverse-index.yaml' },
    },
  } as unknown as MumuSpecConfig;
}

function createProject(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-org-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return { dir, config: defaultConfig() };
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writeKnowledgePage(
  dir: string,
  config: MumuSpecConfig,
  typeDir: string,
  id: string,
  overrides: Partial<KnowledgePageFrontmatter> = {},
): void {
  const typeDirPath = join(dir, config.knowledge.wiki.dir, typeDir);
  mkdirSync(typeDirPath, { recursive: true });

  const frontmatter: Record<string, unknown> = {
    id,
    title: `Test ${id}`,
    type: typeDir.replace(/s$/, ''),
    status: 'confirmed',
    scope: '.',
    created_at: '2026-01-01',
    verified_at: '2026-08-01',
    tags: ['test'],
    graph_bindings: [],
    ...overrides,
  };

  const yamlLines = Object.entries(frontmatter).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.join(', ')}]`;
    }
    return `${key}: ${value}`;
  });

  const content = `---\n${yamlLines.join('\n')}\n---\n\n# ${id}\n\nTest content.\n`;
  writeFileSync(join(typeDirPath, `${id}.md`), content);
}

function writeIndexYaml(dir: string, config: MumuSpecConfig, entries: Array<{ id: string; title: string; type: string; status: string; scope: string; file: string }>): void {
  const indexDir = join(dir, config.knowledge.wiki.dir);
  mkdirSync(indexDir, { recursive: true });
  const indexPath = join(indexDir, '_index.yaml');
  const yamlLines = entries.map((e) => [
    `  - id: ${e.id}`,
    `    title: ${e.title}`,
    `    type: ${e.type}`,
    `    status: ${e.status}`,
    `    scope: ${e.scope}`,
    `    file: ${e.file}`,
    '    tags: []',
  ].join('\n')).join('\n');

  writeFileSync(indexPath, `pages:\n${yamlLines}\n`);
}

function writeFileWithoutFrontmatter(dir: string, config: MumuSpecConfig, typeDir: string, fileName: string): void {
  const dirPath = join(dir, config.knowledge.wiki.dir, typeDir);
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, fileName), '# Just a markdown file\n\nNo frontmatter here.\n');
}

// ─── Tests ───

describe('organizeKnowledge', () => {
  describe('basic flow', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('returns a result with issues, stats, and fixed fields', () => {
      const result = organizeKnowledge(projectDir, config);
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('fixed');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.fixed).toBe('number');
    });

    it('returns zero issues for clean empty knowledge base', () => {
      const result = organizeKnowledge(projectDir, config);
      expect(result.issues).toEqual([]);
    });

    it('has correct stats shape', () => {
      const result = organizeKnowledge(projectDir, config);
      expect(result.stats).toHaveProperty('total_files');
      expect(result.stats).toHaveProperty('total_index_entries');
      expect(result.stats).toHaveProperty('duplicate_ids');
      expect(result.stats).toHaveProperty('missing_from_index');
      expect(result.stats).toHaveProperty('orphaned_index_entries');
      expect(result.stats).toHaveProperty('missing_required_fields');
      expect(result.stats).toHaveProperty('type_mismatches');
    });
  });

  describe('duplicate ID detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports error for duplicate IDs across directories', () => {
      writeKnowledgePage(projectDir, config, 'decisions', 'DUP-001');
      writeKnowledgePage(projectDir, config, 'patterns', 'DUP-001');
      writeIndexYaml(projectDir, config, [
        { id: 'DUP-001', title: 'First', type: 'decision', status: 'confirmed', scope: '.', file: 'decisions/DUP-001.md' },
        { id: 'DUP-001', title: 'Second', type: 'pattern', status: 'confirmed', scope: '.', file: 'patterns/DUP-001.md' },
      ]);

      const result = organizeKnowledge(projectDir, config);
      const dupIssue = result.issues.find((i) => i.type === 'duplicate_id');
      expect(dupIssue).toBeDefined();
      expect(dupIssue!.severity).toBe('error');
      expect(result.stats.duplicate_ids).toBe(1);
    });
  });

  describe('missing from index detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports warning for page not in index', () => {
      writeKnowledgePage(projectDir, config, 'decisions', 'IDX-001');
      writeIndexYaml(projectDir, config, []);

      const result = organizeKnowledge(projectDir, config);
      const missingIssue = result.issues.find((i) => i.type === 'missing_from_index');
      expect(missingIssue).toBeDefined();
      expect(missingIssue!.auto_fixable).toBe(true);
      expect(result.stats.missing_from_index).toBe(1);
    });
  });

  describe('orphaned index entry detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports warning for index entry with missing file', () => {
      writeIndexYaml(projectDir, config, [
        { id: 'ORPHAN-001', title: 'Orphaned', type: 'decision', status: 'confirmed', scope: '.', file: 'decisions/ORPHAN-001.md' },
      ]);

      const result = organizeKnowledge(projectDir, config);
      const orphanIssue = result.issues.find((i) => i.type === 'orphaned_index');
      expect(orphanIssue).toBeDefined();
      expect(result.stats.orphaned_index_entries).toBe(1);
    });
  });

  describe('missing required fields detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports warning for page missing title', () => {
      writeKnowledgePage(projectDir, config, 'decisions', 'FIELD-001', { title: '' });
      writeIndexYaml(projectDir, config, [
        { id: 'FIELD-001', title: '', type: 'decision', status: 'confirmed', scope: '.', file: 'decisions/FIELD-001.md' },
      ]);

      const result = organizeKnowledge(projectDir, config);
      const fieldIssue = result.issues.find((i) => i.page_id === 'FIELD-001' && i.type === 'missing_field');
      expect(fieldIssue).toBeDefined();
    });
  });

  describe('type-directory mismatch detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports warning when decision page is in patterns directory', () => {
      writeKnowledgePage(projectDir, config, 'patterns', 'TYPE-001', { type: 'decision' });
      writeIndexYaml(projectDir, config, [
        { id: 'TYPE-001', title: 'Type Mismatch', type: 'decision', status: 'confirmed', scope: '.', file: 'patterns/TYPE-001.md' },
      ]);

      const result = organizeKnowledge(projectDir, config);
      const mismatchIssue = result.issues.find((i) => i.type === 'type_mismatch');
      expect(mismatchIssue).toBeDefined();
      expect(mismatchIssue!.auto_fixable).toBe(true);
    });
  });

  describe('invalid frontmatter detection', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('reports error for file without valid frontmatter', () => {
      writeFileWithoutFrontmatter(projectDir, config, 'decisions', 'BAD-001.md');

      const result = organizeKnowledge(projectDir, config);
      const badIssue = result.issues.find((i) => i.file && i.file.includes('BAD-001'));
      expect(badIssue).toBeDefined();
    });
  });

  describe('fix mode', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('applies fixes when fix option is true', () => {
      writeKnowledgePage(projectDir, config, 'decisions', 'FIX-001');
      writeIndexYaml(projectDir, config, []);

      const result = organizeKnowledge(projectDir, config, { fix: true });
      expect(typeof result.fixed).toBe('number');
    });
  });

  describe('options handling', () => {
    let projectDir: string;
    let config: MumuSpecConfig;

    beforeEach(() => {
      const setup = createProject();
      projectDir = setup.dir;
      config = setup.config;
    });

    afterEach(() => { cleanup(projectDir); });

    it('runs without options', () => {
      const result = organizeKnowledge(projectDir, config);
      expect(result).toBeDefined();
    });

    it('runs with dryRun option', () => {
      writeKnowledgePage(projectDir, config, 'decisions', 'DRY-001');
      const result = organizeKnowledge(projectDir, config, { dryRun: true });
      expect(result).toBeDefined();
    });

    it('runs with verbose option', () => {
      const result = organizeKnowledge(projectDir, config, { verbose: true });
      expect(result).toBeDefined();
    });
  });
});
