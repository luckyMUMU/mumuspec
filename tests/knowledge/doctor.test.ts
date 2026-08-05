import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDiagnosis } from '../../src/knowledge/doctor.js';
import * as scanModule from '../../src/knowledge/scan.js';

// ─── Helpers ───

function createProject(): string {
  const dir = join(tmpdir(), `mumuspec-doc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } // eslint-disable-line
}

function createKnowledgeDir(dir: string): void {
  mkdirSync(join(dir, '.mumuspec', 'knowledge'), { recursive: true });
}

function writeIndexJson(dir: string, pages: Array<Record<string, unknown>>): void {
  const indexPath = join(dir, '.mumuspec', 'knowledge', 'index.json');
  writeFileSync(indexPath, JSON.stringify({ pages }, null, 2));
}

function writePagesDir(dir: string, files: string[]): void {
  const pagesDir = join(dir, '.mumuspec', 'knowledge', 'pages');
  mkdirSync(pagesDir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(pagesDir, file), `# ${file}\n`);
  }
}

// ─── Tests ───

describe('runDiagnosis', () => {
  describe('report structure', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns a DiagnosisReport with required fields', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('stats');
      expect(report).toHaveProperty('summary');
      expect(Array.isArray(report.findings)).toBe(true);
      expect(typeof report.summary).toBe('string');
    });

    it('stats has correct shape', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);

      expect(report.stats).toHaveProperty('totalKnowledgePages');
      expect(report.stats).toHaveProperty('proposedFromScan');
      expect(report.stats).toHaveProperty('sourcesCovered');
      expect(typeof report.stats.totalKnowledgePages).toBe('number');
      expect(typeof report.stats.proposedFromScan).toBe('number');
      expect(Array.isArray(report.stats.sourcesCovered)).toBe(true);
    });

    it('each finding has required fields', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);

      for (const finding of report.findings) {
        expect(finding).toHaveProperty('severity');
        expect(finding).toHaveProperty('category');
        expect(finding).toHaveProperty('message');
        expect(finding).toHaveProperty('suggestion');
        expect(['info', 'warn', 'error']).toContain(finding.severity);
        expect(['missing', 'stale', 'conflict', 'gap', 'coverage']).toContain(finding.category);
      }
    });

    it('timestamp is a valid ISO string', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);
      const parsed = new Date(report.timestamp);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
    });
  });

  describe('knowledge base directory missing', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('reports error when knowledge directory does not exist', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);

      const dirMissing = report.findings.find(
        (f) => f.category === 'missing' && f.message.includes('目录不存在'),
      );
      expect(dirMissing).toBeDefined();
      expect(dirMissing!.severity).toBe('error');
      expect(dirMissing!.suggestion).toContain('init');
    });
  });

  describe('index file missing', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('reports error when index.json is not present', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      // Create knowledge dir but no index.json
      const report = runDiagnosis(projectDir);

      const indexMissing = report.findings.find(
        (f) => f.category === 'missing' && f.message.includes('index.json'),
      );
      expect(indexMissing).toBeDefined();
    });
  });

  describe('empty pages directory', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('reports warning when pages directory is empty', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      writePagesDir(projectDir, []);

      const report = runDiagnosis(projectDir);
      const emptyPages = report.findings.find(
        (f) => f.category === 'gap' && f.message.includes('没有知识'),
      );
      expect(emptyPages).toBeDefined();
    });

    it('reports warning when pages directory does not exist', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);

      const report = runDiagnosis(projectDir);
      const noPages = report.findings.find(
        (f) => f.category === 'gap' && f.message.includes('pages/ 目录不存在'),
      );
      expect(noPages).toBeDefined();
    });
  });

  describe('healthy state', () => {
    let projectDir: string;

    afterEach(() => { cleanup(projectDir); });

    it('returns empty findings when knowledge base is fully set up with pages', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, [
        { id: 'DEC-001', title: 'Decision 1', type: 'decision' },
      ]);
      writePagesDir(projectDir, ['DEC-001.md']);

      // Mock runScan to return zero proposals for deterministic result
      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
        byType: {},
        totalDurationMs: 0,
      });

      const report = runDiagnosis(projectDir);
      const errors = report.findings.filter((f) => f.severity === 'error');
      expect(errors.length).toBe(0);
    });

    it('summary indicates good state when no issues found', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      writePagesDir(projectDir, ['SOME-001.md']);

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
        byType: {},
        totalDurationMs: 0,
      });

      const report = runDiagnosis(projectDir);
      expect(report.summary).toContain('状态良好');
    });
  });

  describe('scan integration', () => {
    let projectDir: string;

    afterEach(() => {
      cleanup(projectDir);
      vi.restoreAllMocks();
    });

    it('includes scan proposals in report when scan finds potential knowledge', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      writePagesDir(projectDir, ['OK-001.md']);

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [{
          source: 'deps',
          proposedPages: [{
            id: 'KS-DEP-0001',
            title: 'Test Proposal',
            type: 'decision',
            scope: '.',
            content: 'Test',
            tags: ['test'],
            graph_bindings: [],
            confidence: 'high',
            source: 'deps',
            evidence: 'test',
          }],
          scannedCount: 1,
          durationMs: 5,
        }],
        totalProposed: 1,
        byConfidence: { high: 1, medium: 0, low: 0 },
        byType: { decision: 1 },
        totalDurationMs: 5,
      });

      const report = runDiagnosis(projectDir);
      expect(report.stats.proposedFromScan).toBe(1);
      const coverageFinding = report.findings.find((f) => f.category === 'coverage');
      expect(coverageFinding).toBeDefined();
    });

    it('reflects scan proposal count in summary', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      writePagesDir(projectDir, ['OK-001.md']);

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 3,
        byConfidence: { high: 2, medium: 1, low: 0 },
        byType: { decision: 2, risk: 1 },
        totalDurationMs: 2,
      });

      const report = runDiagnosis(projectDir);
      expect(report.summary).toContain('3');
      expect(report.summary).toContain('潜在知识');
    });
  });

  describe('options handling', () => {
    let projectDir: string;

    afterEach(() => {
      cleanup(projectDir);
      vi.restoreAllMocks();
    });

    it('runs without options', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);
      expect(report).toBeDefined();
    });

    it('accepts sources option', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir, { sources: ['deps', 'code'] });
      expect(report.stats.sourcesCovered).toEqual(['deps', 'code']);
    });

    it('defaults to all four sources', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);
      expect(report.stats.sourcesCovered).toContain('deps');
      expect(report.stats.sourcesCovered).toContain('code');
      expect(report.stats.sourcesCovered).toContain('git');
      expect(report.stats.sourcesCovered).toContain('docs');
    });
  });

  describe('countKnowledgePages via index.json', () => {
    let projectDir: string;

    afterEach(() => {
      cleanup(projectDir);
      vi.restoreAllMocks();
    });

    it('counts pages from index.json', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, [
        { id: 'A', title: 'A' },
        { id: 'B', title: 'B' },
      ]);
      writePagesDir(projectDir, ['A.md', 'B.md']);

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
        byType: {},
        totalDurationMs: 0,
      });

      const report = runDiagnosis(projectDir);
      expect(report.stats.totalKnowledgePages).toBe(2);
    });

    it('counts zero pages when index is empty', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      writePagesDir(projectDir, []);

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
        byType: {},
        totalDurationMs: 0,
      });

      const report = runDiagnosis(projectDir);
      expect(report.stats.totalKnowledgePages).toBe(0);
    });

    it('counts zero pages when index.json does not exist', () => {
      projectDir = createProject();
      const report = runDiagnosis(projectDir);
      expect(report.stats.totalKnowledgePages).toBe(0);
    });
  });

  describe('summary building', () => {
    let projectDir: string;

    afterEach(() => {
      cleanup(projectDir);
      vi.restoreAllMocks();
    });

    it('summarizes warning findings', () => {
      projectDir = createProject();
      createKnowledgeDir(projectDir);
      writeIndexJson(projectDir, []);
      // pages dir exists but empty — triggers gap warning
      mkdirSync(join(projectDir, '.mumuspec', 'knowledge', 'pages'), { recursive: true });

      vi.spyOn(scanModule, 'runScan').mockReturnValue({
        sources: [],
        totalProposed: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
        byType: {},
        totalDurationMs: 0,
      });

      const report = runDiagnosis(projectDir);
      // The stale/empty pages warning should trigger
      expect(report.summary.length).toBeGreaterThan(0);
    });
  });
});
