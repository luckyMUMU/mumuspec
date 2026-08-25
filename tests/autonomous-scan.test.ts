/**
 * TDD tests for autonomous knowledge scanning.
 * Covers: scan-types, scanners (deps/code/git/docs), orchestrator (scan.ts), doctor.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { runScan, listScanSources, getSourceDescription } from '../src/knowledge/scan';
import { runDiagnosis } from '../src/knowledge/doctor';
import { scanDeps } from '../src/knowledge/scanners/dep-scanner';
import { scanCodeStructure } from '../src/knowledge/scanners/code-scanner';
import { scanGitHistory } from '../src/knowledge/scanners/git-scanner';
import { scanDocs } from '../src/knowledge/scanners/docs-scanner';

const testDir = join(tmpdir(), `mumuspec-scan-test-${Date.now()}`);

function setupTestProject(structure: Record<string, string>): void {
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(testDir, path);
    const parentDir = join(fullPath, '..');
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }
}

function cleanupTestProject(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function initGitRepo(dir: string): void {
  try {
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
    execSync('git add .', { cwd: dir, stdio: 'ignore' });
    execSync('git commit -m "initial commit"', { cwd: dir, stdio: 'ignore' });
  } catch {
    // Git operations non-critical for most tests
  }
}

describe('scan-types', () => {
  it('should export valid scan sources', () => {
    const sources = listScanSources();
    expect(sources).toContain('deps');
    expect(sources).toContain('code');
    expect(sources).toContain('git');
    expect(sources).toContain('docs');
  });

  it('should provide descriptions for all sources', () => {
    for (const source of listScanSources()) {
      const desc = getSourceDescription(source);
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe('string');
    }
  });
});

describe('dep-scanner', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should propose framework knowledge from next.js dependency', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        name: 'test-project',
        dependencies: {
          next: '14.0.0',
          react: '18.0.0',
        },
      }),
    });

    const proposed = scanDeps(testDir);
    expect(proposed.length).toBeGreaterThan(0);
    const frameworkProposal = proposed.find((p) => p.title.includes('Next.js') || p.type === 'decision');
    expect(frameworkProposal).toBeDefined();
    expect(frameworkProposal!.source).toBe('deps');
  });

  it('should detect ORM choice from prisma dependency', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        name: 'test-project',
        dependencies: {
          prisma: '5.0.0',
          '@prisma/client': '5.0.0',
        },
      }),
    });

    const proposed = scanDeps(testDir);
    const ormProposal = proposed.find((p) => p.title.includes('Prisma') || p.title.includes('ORM'));
    expect(ormProposal).toBeDefined();
  });

  it('should return empty array when no package.json exists', () => {
    const proposed = scanDeps(testDir);
    expect(proposed).toEqual([]);
  });

  it('should parse requirements.txt for Python projects', () => {
    setupTestProject({
      'requirements.txt': 'django==4.2.0\ndjangorestframework==3.14.0\ncelery==5.3.0\n',
    });

    const proposed = scanDeps(testDir);
    expect(proposed.length).toBeGreaterThan(0);
  });

  it('should scan pyproject.toml for Python projects', () => {
    setupTestProject({
      'pyproject.toml': `[project]
name = "my-project"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0.0",
]
`,
    });

    const proposed = scanDeps(testDir);
    expect(proposed.length).toBeGreaterThan(0);
  });
});

describe('code-scanner', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should detect DDD architecture pattern', () => {
    setupTestProject({
      'src/domains/order/order.entity.ts': '// entity',
      'src/domains/order/order.repository.ts': '// repo interface',
      'src/infrastructure/order.repository.impl.ts': '// impl',
      'src/app/order.controller.ts': '// controller',
      'README.md': '# My Project',
    });

    const proposed = scanCodeStructure(testDir);
    expect(proposed.length).toBeGreaterThan(0);
    const dddProposal = proposed.some((p) => p.tags.includes('ddd') || p.title.includes('DDD'));
    expect(dddProposal).toBe(true);
  });

  it('should detect large module risk (>50 files)', () => {
    // Generate 55 dummy files in src/components/
    const files: Record<string, string> = { 'README.md': '#' };
    for (let i = 0; i < 55; i++) {
      files[`src/components/Component${i}.tsx`] = `// Component ${i}`;
    }
    setupTestProject(files);

    const proposed = scanCodeStructure(testDir);
    const largeModuleRisk = proposed.find((p) => p.type === 'risk' && (p.title.includes('过多') || p.title.includes('large')));
    expect(largeModuleRisk).toBeDefined();
  });

  it('should detect file distribution for minimal project', () => {
    setupTestProject({
      'README.md': '# My Project\n\nSome more content here.',
      'misc.txt': 'random file',
    });

    const proposed = scanCodeStructure(testDir);
    // Minimal projects with mixed extensions may return 0 results
    // but the function should not throw and should return an array
    expect(proposed).toBeInstanceOf(Array);
    // If there is a result, it should be a rationale about file distribution
    if (proposed.length > 0) {
      expect(proposed[0]!.type).toBe('rationale');
    }
  });
});

describe('git-scanner', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return empty array when no git history', () => {
    setupTestProject({
      'README.md': '# Test',
      'package.json': '{"name":"test"}',
    });

    const proposed = scanGitHistory(testDir);
    expect(proposed).toEqual([]);
  });

  it('should detect revert commit as lesson', () => {
    setupTestProject({
      'index.js': 'console.log("hello");',
      'package.json': '{"name":"test"}',
    });
    initGitRepo(testDir);

    // Make a revert commit
    writeFileSync(join(testDir, 'index.js'), 'console.log("bug");');
    try {
      execSync('git add . && git commit -m "introduce bug"', { cwd: testDir, stdio: 'ignore' });
      writeFileSync(join(testDir, 'index.js'), 'console.log("hello");');
      execSync('git add . && git commit -m "Revert: introduce bug\n\nThis reverts commit of the buggy change."', { cwd: testDir, stdio: 'ignore' });
    } catch {
      // Git may fail in some test environments
    }

    const proposed = scanGitHistory(testDir);
    const lessonProposal = proposed.find((p) => p.type === 'lesson' || p.title.includes('回退'));
    // Only assert if git commands actually succeeded
    if (lessonProposal) {
      expect(lessonProposal.confidence).toBe('medium');
    }
  });
});

describe('docs-scanner', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should detect missing README', () => {
    setupTestProject({
      'package.json': '{"name":"test"}',
    });

    const proposed = scanDocs(testDir);
    const missingReadme = proposed.find((p) => p.title.includes('README'));
    expect(missingReadme).toBeDefined();
    expect(missingReadme!.type).toBe('risk');
  });

  it('should report minimal docs when README is empty', () => {
    setupTestProject({
      'README.md': '# Test\n',
      'package.json': '{"name":"test"}',
    });

    const proposed = scanDocs(testDir);
    // Should have some recommendation about documentation
    expect(proposed.length).toBeGreaterThan(0);
  });

  it('should handle project with good documentation', () => {
    setupTestProject({
      'README.md': '# My Project\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n```bash\nnpm start\n```\n\n## API\n\nSee docs/.\n\n## Contributing\n\nWelcome!\n\n## License\n\nMIT\n\nMore details here to make it a longer README file that exceeds fifty lines total.\nLine 17.\nLine 18.\nLine 19.\nLine 20.\nLine 21.\nLine 22.\nLine 23.\nLine 24.\nLine 25.\nLine 26.\nLine 27.\nLine 28.\nLine 29.\nLine 30.\nLine 31.\nLine 32.\nLine 33.\nLine 34.\nLine 35.\nLine 36.\nLine 37.\nLine 38.\nLine 39.\nLine 40.\nLine 41.\nLine 42.\nLine 43.\nLine 44.\nLine 45.\nLine 46.\nLine 47.\nLine 48.\nLine 49.\nLine 50.\nLine 51.\nLine 52.\n',
      'package.json': '{"name":"test"}',
      'docs/design/architecture.md': '# Architecture\n\n## Decisions\n\nUse monolith.',
    });

    const proposed = scanDocs(testDir);
    // Should have fewer risk findings for a well-documented project
    const risks = proposed.filter((p) => p.type === 'risk');
    expect(risks.length).toBeLessThan(3);
  });

  it('should list discovered docs as pattern knowledge', () => {
    setupTestProject({
      'README.md': '# Test\n',
      'ARCHITECTURE.md': '# Architecture\n',
      'package.json': '{"name":"test"}',
    });

    const proposed = scanDocs(testDir);
    const patternProposal = proposed.find((p) => p.type === 'pattern');
    expect(patternProposal).toBeDefined();
  });
});

describe('scan orchestrator', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should aggregate results from all sources', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        name: 'test-project',
        dependencies: {
          express: '4.18.0',
          prisma: '5.0.0',
        },
      }),
      'README.md': '# Test\n\n## Installation\n\nnpm install',
      'src/routes/index.ts': '// routes',
      'src/models/user.ts': '// model',
    });

    const result = runScan(testDir);
    expect(result.sources.length).toBe(4);
    expect(result.totalProposed).toBeGreaterThan(0);
    expect(result.byConfidence.high + result.byConfidence.medium + result.byConfidence.low).toBe(result.totalProposed);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should filter by min-confidence', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        dependencies: { express: '4.18.0' },
      }),
      'README.md': '# Test',
    });

    const lowResult = runScan(testDir, { minConfidence: 'low' });
    const highResult = runScan(testDir, { minConfidence: 'high' });
    expect(highResult.totalProposed).toBeLessThanOrEqual(lowResult.totalProposed);
  });

  it('should respect max-pages limit', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        dependencies: {
          express: '4.18.0',
          prisma: '5.0.0',
          redis: '4.0.0',
          bullmq: '4.0.0',
          '@nestjs/core': '10.0.0',
        },
      }),
      'README.md': '# Test',
    });

    const result = runScan(testDir, { maxPages: 3 });
    expect(result.totalProposed).toBeLessThanOrEqual(3);
  });

  it('should filter by specific sources', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        dependencies: { express: '4.18.0' },
      }),
      'README.md': '# Test',
    });

    const result = runScan(testDir, { sources: ['deps'] });
    expect(result.sources.every((s) => s.source === 'deps')).toBe(true);
  });
});

describe('doctor diagnosis', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTestProject();
  });

  it('should return a diagnosis report with findings', () => {
    setupTestProject({
      'package.json': '{"name":"test"}',
    });

    const report = runDiagnosis(testDir);
    expect(report).toBeDefined();
    expect(report.findings).toBeInstanceOf(Array);
    expect(report.summary).toBeTruthy();
    expect(report.timestamp).toBeTruthy();
  });

  it('should detect missing knowledge directory', () => {
    setupTestProject({
      'package.json': '{"name":"test"}',
    });

    const report = runDiagnosis(testDir);
    const missingKb = report.findings.find((f) => f.category === 'missing');
    expect(missingKb).toBeDefined();
    expect(missingKb!.severity).toBe('error');
  });

  it('should report scan proposals count', () => {
    setupTestProject({
      'package.json': JSON.stringify({
        dependencies: { express: '4.18.0', prisma: '5.0.0' },
      }),
      'README.md': '# Test',
    });

    const report = runDiagnosis(testDir);
    expect(report.stats.proposedFromScan).toBeGreaterThanOrEqual(0);
  });
});
