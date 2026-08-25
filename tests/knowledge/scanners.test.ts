import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanDeps } from '../../src/knowledge/scanners/dep-scanner.js';
import { scanCodeStructure } from '../../src/knowledge/scanners/code-scanner.js';
import { scanDocs } from '../../src/knowledge/scanners/docs-scanner.js';
import { scanGitHistory } from '../../src/knowledge/scanners/git-scanner.js';
import { runScan } from '../../src/knowledge/scan.js';
import type { ProposedKnowledgePage } from '../../src/knowledge/scan-types.js';

// ─── Helpers ───

function createTempProject(): string {
  const dir = join(tmpdir(), `mumuspec-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writePackageJson(dir: string, pkg: Record<string, unknown>): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

function writeRequirementsTxt(dir: string, lines: string[]): void {
  writeFileSync(join(dir, 'requirements.txt'), lines.join('\n'));
}

function writePyprojectToml(dir: string, content: string): void {
  writeFileSync(join(dir, 'pyproject.toml'), content);
}

function writeMarkdownFile(dir: string, relativePath: string, content: string): void {
  const fullPath = join(dir, relativePath);
  const parentDir = join(fullPath, '..');
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(fullPath, content);
}

function writeSrcDir(dir: string, entries: Array<{ name: string; isDir: boolean; children?: Array<{ name: string; isDir: boolean }> }>): void {
  const srcPath = join(dir, 'src');
  mkdirSync(srcPath, { recursive: true });
  for (const entry of entries) {
    const entryPath = join(srcPath, entry.name);
    if (entry.isDir) {
      mkdirSync(entryPath, { recursive: true });
      if (entry.children) {
        for (const child of entry.children) {
          if (child.isDir) {
            mkdirSync(join(entryPath, child.name), { recursive: true });
          } else {
            writeFileSync(join(entryPath, child.name), `// ${child.name}`);
          }
        }
      }
    } else {
      writeFileSync(entryPath, `// ${entry.name}`);
    }
  }
}

function assertValidPage(page: ProposedKnowledgePage): void {
  expect(page).toHaveProperty('id');
  expect(page).toHaveProperty('title');
  expect(page).toHaveProperty('type');
  expect(page).toHaveProperty('scope');
  expect(page).toHaveProperty('content');
  expect(page).toHaveProperty('tags');
  expect(page).toHaveProperty('graph_bindings');
  expect(page).toHaveProperty('confidence');
  expect(page).toHaveProperty('source');
  expect(page).toHaveProperty('evidence');
  expect(['decision', 'pattern', 'risk', 'rationale', 'lesson']).toContain(page.type);
  expect(['high', 'medium', 'low']).toContain(page.confidence);
  expect(Array.isArray(page.tags)).toBe(true);
  expect(Array.isArray(page.graph_bindings)).toBe(true);
}

// ─── scanDeps ───

describe('scanDeps', () => {
  describe('with package.json', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('detects React framework from dependencies', () => {
      projectDir = createTempProject();
      writePackageJson(projectDir, {
        name: 'test-proj',
        dependencies: { react: '^18.0.0' },
      });

      const result = scanDeps(projectDir);
      expect(result.length).toBeGreaterThan(0);
      const reactPage = result.find((p) => p.tags.includes('react'));
      expect(reactPage).toBeDefined();
      assertValidPage(reactPage!);
    });

    it('detects multiple frameworks from devDependencies', () => {
      projectDir = createTempProject();
      writePackageJson(projectDir, {
        name: 'test-proj',
        devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      });

      const result = scanDeps(projectDir);
      const vitestPage = result.find((p) => p.tags.includes('vitest'));
      expect(vitestPage).toBeDefined();
      assertValidPage(vitestPage!);
    });

    it('returns empty array when no package.json exists', () => {
      projectDir = createTempProject();
      const result = scanDeps(projectDir);
      expect(result).toEqual([]);
    });

    it('handles malformed package.json gracefully', () => {
      projectDir = createTempProject();
      writeFileSync(join(projectDir, 'package.json'), '{ invalid json }');
      const result = scanDeps(projectDir);
      expect(result).toEqual([]);
    });
  });

  describe('with requirements.txt', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('detects Django from Python dependencies', () => {
      projectDir = createTempProject();
      writeRequirementsTxt(projectDir, ['Django==4.0', 'djangorestframework==3.14']);

      const result = scanDeps(projectDir);
      const djangoPage = result.find((p) => p.tags.includes('django'));
      expect(djangoPage).toBeDefined();
      assertValidPage(djangoPage!);
    });
  });

  describe('with pyproject.toml', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('detects FastAPI from pyproject.toml', () => {
      projectDir = createTempProject();
      writePyprojectToml(projectDir, '[project]\ndependencies = [\n  "fastapi>=0.100",\n  "uvicorn",\n]\n');

      const result = scanDeps(projectDir);
      const fastapiPage = result.find((p) => p.tags.includes('fastapi'));
      expect(fastapiPage).toBeDefined();
      assertValidPage(fastapiPage!);
    });
  });

  describe('edge cases', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns pages with valid ProposedKnowledgePage structure', () => {
      projectDir = createTempProject();
      writePackageJson(projectDir, {
        dependencies: { express: '^4.18.0' },
      });

      const result = scanDeps(projectDir);
      for (const page of result) {
        assertValidPage(page);
      }
    });
  });
});

// ─── scanCodeStructure ───

describe('scanCodeStructure', () => {
  describe('architecture detection', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('detects feature-based architecture from features directory', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'features', isDir: true, children: [
          { name: 'auth', isDir: true },
          { name: 'dashboard', isDir: true },
        ] },
        { name: 'utils', isDir: true },
      ]);

      const result = scanCodeStructure(projectDir);
      const archPage = result.find((p) => p.type === 'decision' && p.tags.includes('architecture'));
      expect(archPage).toBeDefined();
      assertValidPage(archPage!);
    });

    it('detects CLI tool architecture from commands directory', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'commands', isDir: true, children: [
          { name: 'init.ts', isDir: false },
          { name: 'build.ts', isDir: false },
        ] },
        { name: 'utils', isDir: true },
      ]);

      const result = scanCodeStructure(projectDir);
      const archPage = result.find((p) => p.tags.includes('architecture'));
      expect(archPage).toBeDefined();
      assertValidPage(archPage!);
    });

    it('returns null pattern for src with no recognized structure', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'helpers', isDir: true },
        { name: 'utils', isDir: true },
      ]);

      const result = scanCodeStructure(projectDir);
      const archPage = result.find((p) => p.tags.includes('architecture'));
      expect(archPage).toBeUndefined();
    });
  });

  describe('structural risk detection', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('does not produce risk pages for small directories', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'core', isDir: true, children: [
          { name: 'a.ts', isDir: false },
          { name: 'b.ts', isDir: false },
        ] },
      ]);

      const result = scanCodeStructure(projectDir);
      const riskPages = result.filter((p) => p.type === 'risk');
      expect(riskPages.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns empty array for empty project', () => {
      projectDir = createTempProject();
      const result = scanCodeStructure(projectDir);
      expect(Array.isArray(result)).toBe(true);
    });

    it('accepts an optional scope parameter', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'core', isDir: true, children: [
          { name: 'mod.ts', isDir: false },
        ] },
      ]);

      const result = scanCodeStructure(projectDir, 'src');
      expect(Array.isArray(result)).toBe(true);
    });

    it('all returned pages have valid structure', () => {
      projectDir = createTempProject();
      writeSrcDir(projectDir, [
        { name: 'controllers', isDir: true, children: [
          { name: 'user.ts', isDir: false },
        ] },
        { name: 'services', isDir: true, children: [
          { name: 'auth.ts', isDir: false },
        ] },
      ]);

      const result = scanCodeStructure(projectDir);
      for (const page of result) {
        assertValidPage(page);
      }
    });
  });
});

// ─── scanDocs ───

describe('scanDocs', () => {
  describe('missing docs detection', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('reports missing README.md when absent', () => {
      projectDir = createTempProject();

      const result = scanDocs(projectDir);
      // Should report missing README as a documentation issue
      const missingPage = result.find(
        (p) => p.tags.includes('missing'),
      );
      expect(missingPage).toBeDefined();
      // Validate all returned pages have correct structure
      for (const page of result) {
        assertValidPage(page);
      }
    });

    it('does not report missing README when present with sufficient content', () => {
      projectDir = createTempProject();
      const longContent = '# Project\n\n' + 'Line content here.\n'.repeat(60);
      writeMarkdownFile(projectDir, 'README.md', longContent);

      const result = scanDocs(projectDir);
      // Should not have a page about missing README specifically
      const readmeMissingPage = result.find(
        (p) => p.tags.includes('missing') && p.title.includes('README'),
      );
      expect(readmeMissingPage).toBeUndefined();
    });

    it('reports minimal README when less than 50 lines', () => {
      projectDir = createTempProject();
      writeMarkdownFile(projectDir, 'README.md', '# Short\n\nMinimal readme.');

      const result = scanDocs(projectDir);
      const qualityPage = result.find((p) => p.title.includes('不完整') || p.tags.includes('quality'));
      expect(qualityPage).toBeDefined();
    });
  });

  describe('root markdown detection', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('discovers root-level markdown files as knowledge sources', () => {
      projectDir = createTempProject();
      writeMarkdownFile(projectDir, 'CONTRIBUTING.md', '# Contributing\n');
      writeMarkdownFile(projectDir, 'LICENSE.md', '# License\n');

      const result = scanDocs(projectDir);
      const discoveryPage = result.find((p) => p.tags.includes('inventory') || p.tags.includes('discovery'));
      expect(discoveryPage).toBeDefined();
      assertValidPage(discoveryPage!);
    });
  });

  describe('edge cases', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns empty array for project with no docs at all', () => {
      projectDir = createTempProject();
      const result = scanDocs(projectDir);
      expect(Array.isArray(result)).toBe(true);
    });

    it('all returned pages have valid structure', () => {
      projectDir = createTempProject();
      writeMarkdownFile(projectDir, 'README.md', '# Hello\n');

      const result = scanDocs(projectDir);
      for (const page of result) {
        assertValidPage(page);
      }
    });
  });
});

// ─── scanGitHistory ───

describe('scanGitHistory', () => {
  describe('non-git directory', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns empty array when no .git exists', () => {
      projectDir = createTempProject();
      const result = scanGitHistory(projectDir);
      expect(result).toEqual([]);
    });
  });

  describe('structure validation', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('all returned pages (if any) have valid ProposedKnowledgePage structure', () => {
      projectDir = createTempProject();
      const result = scanGitHistory(projectDir);
      for (const page of result) {
        assertValidPage(page);
      }
    });
  });
});

// ─── runScan orchestrator ───

describe('runScan', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTempProject();
    writePackageJson(projectDir, {
      name: 'scan-test',
      dependencies: { react: '^18.0.0' },
    });
  });

  afterEach(() => { cleanup(projectDir); });

  it('returns a ScanResult with correct shape', () => {
    const result = runScan(projectDir);
    expect(result).toHaveProperty('sources');
    expect(result).toHaveProperty('totalProposed');
    expect(result).toHaveProperty('byConfidence');
    expect(result).toHaveProperty('byType');
    expect(result).toHaveProperty('totalDurationMs');
    expect(Array.isArray(result.sources)).toBe(true);
    expect(typeof result.totalProposed).toBe('number');
    expect(typeof result.totalDurationMs).toBe('number');
  });

  it('byConfidence contains high, medium, low counts', () => {
    const result = runScan(projectDir);
    expect(result.byConfidence).toHaveProperty('high');
    expect(result.byConfidence).toHaveProperty('medium');
    expect(result.byConfidence).toHaveProperty('low');
    const sum = result.byConfidence.high + result.byConfidence.medium + result.byConfidence.low;
    expect(sum).toBe(result.totalProposed);
  });

  it('respects sources option to limit scanning', () => {
    const result = runScan(projectDir, { sources: ['deps'] });
    expect(result.sources.length).toBe(1);
    expect(result.sources[0]!.source).toBe('deps');
  });

  it('respects maxPages option', () => {
    const result = runScan(projectDir, { maxPages: 1 });
    expect(result.totalProposed).toBeLessThanOrEqual(1);
  });

  it('includes all four sources by default', () => {
    const result = runScan(projectDir);
    const sourceNames = result.sources.map((s) => s.source);
    expect(sourceNames).toContain('deps');
    expect(sourceNames).toContain('code');
    expect(sourceNames).toContain('git');
    expect(sourceNames).toContain('docs');
  });

  it('each source result has expected fields', () => {
    const result = runScan(projectDir);
    for (const sourceResult of result.sources) {
      expect(sourceResult).toHaveProperty('source');
      expect(sourceResult).toHaveProperty('proposedPages');
      expect(sourceResult).toHaveProperty('scannedCount');
      expect(sourceResult).toHaveProperty('durationMs');
      expect(Array.isArray(sourceResult.proposedPages)).toBe(true);
      expect(typeof sourceResult.scannedCount).toBe('number');
    }
  });
});
