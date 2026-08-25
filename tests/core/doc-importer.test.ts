/**
 * Tests for src/core/doc-importer.ts — detectExistingDocuments, importExistingDocuments.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectExistingDocuments,
  detectThirdPartySpecs,
  importExistingDocuments,
  importThirdPartySpecs,
  generateImportIndex,
} from '../../src/core/doc-importer.js';
import { getDefaultConfig } from '../../src/core/config.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { DetectedDocument, DetectedSpec } from '../../src/core/doc-importer.js';

function testConfig(): MumuSpecConfig {
  return getDefaultConfig('test-doc-import');
}

function createProject(): { dir: string; config: MumuSpecConfig } {
  const dir = join(tmpdir(), `mumuspec-docimp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  return { dir, config: testConfig() };
}

function cleanup(dir: string): void {
  try {
    // Ensure we can delete even if read-only files were created
    chmodSync(dir, 0o777);
    rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

describe('detectExistingDocuments', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createProject().dir;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty array for empty project', () => {
    // Arrange & Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result).toEqual([]);
  });

  it('detects README.md', () => {
    // Arrange
    writeFileSync(join(projectDir, 'README.md'), '# My Project\n\nThis is a test project.\n\n## Getting Started\n\nInstall deps.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].type).toBe('readme');
    expect(result[0].path).toBe('README.md');
    expect(result[0].title).toBe('My Project');
    expect(result[0].content).toContain('# My Project');
  });

  it('detects CONTRIBUTING.md', () => {
    // Arrange
    writeFileSync(join(projectDir, 'CONTRIBUTING.md'), '# Contributing\n\nPlease follow these guidelines.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    const contrib = result.find((d) => d.type === 'contributing');
    expect(contrib).toBeDefined();
    expect(contrib!.title).toBe('Contributing');
  });

  it('detects CHANGELOG.md', () => {
    // Arrange
    writeFileSync(join(projectDir, 'CHANGELOG.md'), '# Changelog\n\n## v1.0.0\n\nInitial release.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result.some((d) => d.type === 'changelog')).toBe(true);
  });

  it('detects LICENSE file', () => {
    // Arrange
    writeFileSync(join(projectDir, 'LICENSE'), 'MIT License\n\nCopyright (c) 2026\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result.some((d) => d.type === 'license')).toBe(true);
  });

  it('detects docs/ directory markdown files', () => {
    // Arrange
    const docsDir = join(projectDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'architecture.md'), '# Architecture\n\nSystem design overview.\n');
    writeFileSync(join(docsDir, 'api.md'), '# API Reference\n\nEndpoints.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    const docs = result.filter((d) => d.type === 'docs');
    expect(docs.length).toBe(2);
    expect(docs.some((d) => d.path === 'docs/architecture.md')).toBe(true);
    expect(docs.some((d) => d.path === 'docs/api.md')).toBe(true);
  });

  it('detects doc/ alternative directory', () => {
    // Arrange
    const docDir = join(projectDir, 'doc');
    mkdirSync(docDir, { recursive: true });
    writeFileSync(join(docDir, 'guide.md'), '# Guide\n\nUser guide.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    const docs = result.filter((d) => d.type === 'docs');
    expect(docs.some((d) => d.path === 'doc/guide.md')).toBe(true);
  });

  it('recursively finds nested docs', () => {
    // Arrange
    const nestedDir = join(projectDir, 'docs', 'deep', 'nested');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'detail.md'), '# Detail\n\nNested doc.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    const docs = result.filter((d) => d.type === 'docs');
    expect(docs.some((d) => d.path === 'docs/deep/nested/detail.md')).toBe(true);
  });

  it('extracts first paragraph as summary', () => {
    // Arrange
    writeFileSync(join(projectDir, 'README.md'), '# Title\n\nThis is the summary paragraph.\n\n## Next Section\n\nMore content.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result[0].summary).toContain('summary paragraph');
  });

  it('handles file without markdown title', () => {
    // Arrange
    writeFileSync(join(projectDir, 'README.md'), 'No title here.\nJust some content.\n');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('README.md');
  });

  it('handles empty README', () => {
    // Arrange
    writeFileSync(join(projectDir, 'README.md'), '');

    // Act
    const result = detectExistingDocuments(projectDir);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('README.md');
    expect(result[0].summary).toBe('');
  });
});

describe('detectThirdPartySpecs', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createProject().dir;
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('returns empty array when no specs exist', () => {
    // Arrange & Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result).toEqual([]);
  });

  it('detects OpenAPI spec', () => {
    // Arrange
    writeFileSync(join(projectDir, 'openapi.yaml'), 'openapi: 3.0.0\ninfo:\n  title: Test API\n');

    // Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result.some((s) => s.format === 'openapi')).toBe(true);
  });

  it('detects AsyncAPI spec', () => {
    // Arrange
    writeFileSync(join(projectDir, 'asyncapi.yaml'), 'asyncapi: 2.0.0\ninfo:\n  title: Test Events\n');

    // Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result.some((s) => s.format === 'asyncapi')).toBe(true);
  });

  it('detects GraphQL schema', () => {
    // Arrange
    writeFileSync(join(projectDir, 'schema.graphql'), 'type Query {\n  hello: String\n}\n');

    // Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result.some((s) => s.format === 'graphql')).toBe(true);
  });

  it('detects C4 model DSL', () => {
    // Arrange
    writeFileSync(join(projectDir, 'model.dsl'), 'workspace {\n  model {\n    user = person "User"\n  }\n}\n');

    // Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result.some((s) => s.format === 'c4-model')).toBe(true);
  });

  it('detects OpenSpec config', () => {
    // Arrange
    writeFileSync(join(projectDir, 'openspec.yaml'), 'name: test-change\nschema: proposal\n');

    // Act
    const result = detectThirdPartySpecs(projectDir);

    // Assert
    expect(result.some((s) => s.format === 'openspec')).toBe(true);
  });
});

describe('importExistingDocuments', () => {
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

  it('returns empty array for no documents', () => {
    // Arrange
    const documents: DetectedDocument[] = [];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result).toEqual([]);
  });

  it('creates knowledge files for each document', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: '# Project', title: 'Project', summary: 'A project.' },
      { path: 'docs/api.md', type: 'docs', content: '# API', title: 'API', summary: 'API docs.' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result.length).toBe(2);
    result.forEach((filePath) => {
      expect(filePath).toContain('imports');
      expect(filePath).toMatch(/\.md$/);
    });
  });

  it('generates valid YAML frontmatter in output', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: '# Title', title: 'My Title', summary: 'Summary.' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result.length).toBe(1);
    const content = readFileSync(result[0], 'utf8');
    expect(content).toContain('---');
    expect(content).toContain('id:');
    expect(content).toContain('title:');
    expect(content).toContain('type: pattern');
    expect(content).toContain('source: "README.md"');
  });

  it('sanitizes path into safe filename', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'docs/sub/deep/file.md', type: 'docs', content: 'test', title: 'File', summary: '' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result[0]).toContain('docs_sub_deep_file');
    expect(result[0]).not.toContain('/');
  });

  it('handles special characters in title', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: '# Title', title: "O'Brien's <Project> & More", summary: '' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result.length).toBe(1);
  });

  it('handles document with empty content', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: '', title: 'Empty', summary: '' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result.length).toBe(1);
  });

  it('handles document with very long content', () => {
    // Arrange
    const longContent = 'A'.repeat(100000);
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: longContent, title: 'Long', summary: '' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    expect(result.length).toBe(1);
  });

  it('includes source path in output', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'CONTRIBUTING.md', type: 'contributing', content: '# Guide', title: 'Guide', summary: '' },
    ];

    // Act
    const result = importExistingDocuments(projectDir, config, documents);

    // Assert
    const content = readFileSync(result[0], 'utf8');
    expect(content).toContain('CONTRIBUTING.md');
  });
});

describe('importThirdPartySpecs', () => {
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

  it('creates spec knowledge files', () => {
    // Arrange
    const specs: DetectedSpec[] = [
      { format: 'openapi', path: 'openapi.yaml', title: 'API Spec', description: 'REST API', rawContent: 'openapi: 3.0.0\n' },
    ];

    // Act
    const result = importThirdPartySpecs(projectDir, config, specs);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0]).toContain('external-specs');
  });

  it('truncates very long raw content', () => {
    // Arrange
    const longContent = 'x'.repeat(20000);
    const specs: DetectedSpec[] = [
      { format: 'openapi', path: 'spec.yaml', title: 'Big Spec', description: 'Large', rawContent: longContent },
    ];

    // Act
    const result = importThirdPartySpecs(projectDir, config, specs);

    // Assert
    const content = readFileSync(result[0], 'utf8');
    expect(content).toContain('truncated');
  });
});

describe('generateImportIndex', () => {
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

  it('creates index file', () => {
    // Arrange
    const documents: DetectedDocument[] = [
      { path: 'README.md', type: 'readme', content: '', title: 'Readme', summary: '' },
    ];
    const specs: DetectedSpec[] = [
      { format: 'openapi', path: 'openapi.yaml', title: 'API', description: '', rawContent: '' },
    ];

    // Act
    generateImportIndex(projectDir, config, documents, specs);

    // Assert
    const indexPath = join(projectDir, config.knowledge.wiki.dir, 'imports', '_import-index.yaml');
    expect(existsSync(indexPath)).toBe(true);
  });

  it('handles empty documents and specs', () => {
    // Arrange & Act
    generateImportIndex(projectDir, config, [], []);

    // Assert
    const indexPath = join(projectDir, config.knowledge.wiki.dir, 'imports', '_import-index.yaml');
    expect(existsSync(indexPath)).toBe(true);
  });
});
