/**
 * Tests for src/knowledge/analysis.ts — answerQuery, analyzeCoverage, generateOnboardingPath.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import {
  answerQuery,
  analyzeCoverage,
  generateOnboardingPath,
} from '../../src/knowledge/analysis.js';
import { getDefaultConfig } from '../../src/core/config.js';
import type { MumuSpecConfig } from '../../src/core/config.js';

function testConfig(): MumuSpecConfig {
  return getDefaultConfig('test-analysis');
}

function createProject(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  return { dir, config: testConfig() };
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writeKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  id: string,
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson',
  title: string,
  opts?: { tags?: string[]; bindings?: string[]; scope?: string },
): void {
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);
  const typeDir = join(knowledgeDir, `${type}s`);
  mkdirSync(typeDir, { recursive: true });

  const tags = opts?.tags ?? [];
  const bindings = opts?.bindings ?? [];
  const scope = opts?.scope ?? '.';

  const yml = [
    '---',
    `id: "${id}"`,
    `title: "${title}"`,
    `type: ${type}`,
    `status: confirmed`,
    `scope: "${scope}"`,
    `created_at: "2026-01-01"`,
    `verified_at: "2026-06-01"`,
    tags.length > 0 ? `tags:\n${tags.map((t) => `  - ${t}`).join('\n')}` : null,
    bindings.length > 0 ? `graph_bindings:\n${bindings.map((b) => `  - ${b}`).join('\n')}` : null,
    '---',
  ].filter(Boolean).join('\n');

  writeFileSync(join(typeDir, `${id}.md`), `${yml}\n\n# ${title}\n\nKnowledge content for ${id}.\n`);
}

function writeReverseIndex(
  projectRoot: string,
  config: MumuSpecConfig,
  entries: Array<{ code_node: string; knowledge_pages: string[] }>,
): void {
  const knowledgeDir = join(projectRoot, config.knowledge.wiki.dir);
  mkdirSync(knowledgeDir, { recursive: true });
  const indexPath = join(knowledgeDir, config.knowledge.reverse_index.file);
  const data = entries.map((e) => ({
    code_node: e.code_node,
    knowledge_pages: e.knowledge_pages,
  }));
  writeFileSync(indexPath, stringify(data));
}

describe('answerQuery', () => {
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

  it('returns fallback when knowledge base is empty', () => {
    // Arrange
    const query = 'authentication flow';

    // Act
    const result = answerQuery(projectDir, config, query);

    // Assert
    expect(result.query).toBe(query);
    expect(result.references).toEqual([]);
    expect(result.confidence).toBe('low');
    expect(result.answer).toContain('No relevant information found');
  });

  it('returns fallback for empty string query', () => {
    // Arrange
    const query = '';

    // Act
    const result = answerQuery(projectDir, config, query);

    // Assert
    expect(result.references).toEqual([]);
    expect(result.confidence).toBe('low');
  });

  it('returns fallback for special character query', () => {
    // Arrange
    const query = '@#$%^&*()';

    // Act
    const result = answerQuery(projectDir, config, query);

    // Assert
    expect(result.references).toEqual([]);
    expect(result.confidence).toBe('low');
  });

  it('matches pages by exact ID', () => {
    // Arrange
    writeKnowledgePage(projectDir, config, 'DEC-001', 'decision', 'Auth Decision', {
      tags: ['security'],
    });

    // Act
    const result = answerQuery(projectDir, config, 'DEC-001');

    // Assert
    expect(result.references.length).toBe(1);
    expect(result.references[0].id).toBe('DEC-001');
    expect(result.confidence).toBe('high');
  });

  it('matches pages by title keyword', () => {
    // Arrange
    writeKnowledgePage(projectDir, config, 'DEC-002', 'decision', 'Database Indexing Strategy');

    // Act
    const result = answerQuery(projectDir, config, 'Indexing');

    // Assert
    expect(result.references.length).toBeGreaterThanOrEqual(1);
    expect(result.references[0].id).toBe('DEC-002');
    expect(result.confidence).toBe('high');
  });

  it('ranks multiple matches by relevance', () => {
    // Arrange
    writeKnowledgePage(projectDir, config, 'PTN-001', 'pattern', 'Caching Pattern', {
      tags: ['performance', 'caching'],
    });
    writeKnowledgePage(projectDir, config, 'PTN-002', 'pattern', 'General Pattern', {
      tags: ['basic'],
    });

    // Act
    const result = answerQuery(projectDir, config, 'caching');

    // Assert
    expect(result.references.length).toBeGreaterThanOrEqual(1);
    expect(result.references[0].relevance).toBeGreaterThanOrEqual(result.references[1]?.relevance ?? 0);
  });

  it('limits results to top 5', () => {
    // Arrange
    for (let i = 0; i < 10; i++) {
      writeKnowledgePage(projectDir, config, `PAGE-${i.toString().padStart(3, '0')}`, 'decision', `Decision ${i}`, {
        tags: ['queryable'],
      });
    }

    // Act
    const result = answerQuery(projectDir, config, 'Decision');

    // Assert
    expect(result.references.length).toBeLessThanOrEqual(5);
  });

  it('handles very long query input', () => {
    // Arrange
    const query = 'a'.repeat(10000);

    // Act
    const result = answerQuery(projectDir, config, query);

    // Assert
    expect(result.query).toBe(query);
    expect(result.references).toEqual([]);
    expect(result.confidence).toBe('low');
  });
});

describe('analyzeCoverage', () => {
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

  it('returns zero-coverage stats with no reverse index', () => {
    // Arrange & Act
    const result = analyzeCoverage(projectDir, config);

    // Assert
    expect(result.scope).toBe('.');
    expect(result.coverage.total_code_nodes).toBe(0);
    expect(result.coverage.coverage_ratio).toBe(0);
    expect(result.gaps).toEqual([]);
    expect(result.overloads).toEqual([]);
  });

  it('returns full coverage when all nodes have pages', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
      { code_node: 'src/api/users', knowledge_pages: ['DEC-002'] },
    ]);

    // Act
    const result = analyzeCoverage(projectDir, config);

    // Assert
    expect(result.coverage.total_code_nodes).toBe(2);
    expect(result.coverage.coverage_ratio).toBe(1);
    expect(result.gaps).toEqual([]);
    expect(result.generated_at).toBeTruthy();
  });

  it('detects gaps for uncovered nodes', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
      { code_node: 'src/api/legacy', knowledge_pages: [] },
    ]);

    // Act
    const result = analyzeCoverage(projectDir, config);

    // Assert
    expect(result.coverage.total_code_nodes).toBe(2);
    expect(result.coverage.covered_nodes).toBe(1);
    expect(result.coverage.coverage_ratio).toBeCloseTo(0.5, 1);
    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0].node).toBe('src/api/legacy');
    expect(result.gaps[0].suggested_type).toBe('rationale');
  });

  it('detects overloads for nodes with too many pages', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/core/hub', knowledge_pages: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] },
    ]);

    // Act
    const result = analyzeCoverage(projectDir, config);

    // Assert
    expect(result.overloads.length).toBe(1);
    expect(result.overloads[0].node).toBe('src/core/hub');
    expect(result.overloads[0].pages_count).toBe(6);
  });

  it('filters by scope prefix', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
      { code_node: 'src/db/schema', knowledge_pages: [] },
    ]);

    // Act
    const result = analyzeCoverage(projectDir, config, 'src/api');

    // Assert
    expect(result.scope).toBe('src/api');
    expect(result.coverage.total_code_nodes).toBe(1);
    expect(result.coverage.coverage_ratio).toBe(1);
  });

  it('limits gaps to gap_threshold', () => {
    // Arrange
    const entries = Array.from({ length: 10 }, (_, i) => ({
      code_node: `src/module-${i}`,
      knowledge_pages: [] as string[],
    }));
    writeReverseIndex(projectDir, config, entries);

    // Act
    const result = analyzeCoverage(projectDir, config);

    // Assert
    expect(result.gaps.length).toBeLessThanOrEqual(config.knowledge.coverage.gap_threshold);
  });
});

describe('generateOnboardingPath', () => {
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

  it('returns empty path when reverse index is empty', () => {
    // Arrange & Act
    const result = generateOnboardingPath(projectDir, config, '.', 'junior');

    // Assert
    expect(result.steps).toEqual([]);
    expect(result.total_steps).toBe(0);
    expect(result.estimated_minutes).toBe(0);
    expect(result.generated_for).toBe('junior');
  });

  it('generates ordered steps for scoped nodes', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001', 'DEC-002'] },
      { code_node: 'src/api/users', knowledge_pages: ['PTN-001'] },
    ]);

    // Act
    const result = generateOnboardingPath(projectDir, config, 'src/api', 'mid');

    // Assert
    expect(result.total_steps).toBe(2);
    expect(result.steps[0].order).toBe(1);
    expect(result.steps[1].order).toBe(2);
    expect(result.steps[0].knowledge_pages.length).toBeGreaterThanOrEqual(result.steps[1].knowledge_pages.length);
  });

  it('estimates time based on role', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
      { code_node: 'src/api/users', knowledge_pages: ['PTN-001'] },
      { code_node: 'src/db/schema', knowledge_pages: ['RTL-001'] },
    ]);

    // Act
    const junior = generateOnboardingPath(projectDir, config, 'src', 'junior');
    const senior = generateOnboardingPath(projectDir, config, 'src', 'senior');

    // Assert
    expect(junior.estimated_minutes).toBeGreaterThan(senior.estimated_minutes);
  });

  it('includes learning objectives for each step', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/core/parser', knowledge_pages: ['DEC-001'] },
    ]);

    // Act
    const result = generateOnboardingPath(projectDir, config, 'src/core', 'mid');

    // Assert
    expect(result.steps[0].learning_objectives.length).toBeGreaterThanOrEqual(1);
    expect(result.steps[0].learning_objectives[0]).toContain('src/core/parser');
  });

  it('filters steps outside scope', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
      { code_node: 'src/db/schema', knowledge_pages: ['RTL-001'] },
    ]);

    // Act
    const result = generateOnboardingPath(projectDir, config, 'src/api', 'mid');

    // Assert
    expect(result.total_steps).toBe(1);
    expect(result.steps[0].code_node).toBe('src/api/auth');
  });

  it('renders check questions when pages exist', () => {
    // Arrange
    writeReverseIndex(projectDir, config, [
      { code_node: 'src/api/auth', knowledge_pages: ['DEC-001'] },
    ]);

    // Act
    const result = generateOnboardingPath(projectDir, config, 'src/api', 'mid');

    // Assert
    expect(result.steps[0].check_questions.length).toBeGreaterThanOrEqual(1);
  });
});
