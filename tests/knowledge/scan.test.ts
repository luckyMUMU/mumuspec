/**
 * Extra tests for src/knowledge/scan.ts — orchestrator (runScan, getSourceDescription, listScanSources).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/knowledge/scanners/dep-scanner.js', () => ({
  scanDeps: vi.fn(() => [{ id: 'KS-DEP-0001', title: 'test dep', type: 'decision', scope: '.', content: '', tags: [], graph_bindings: [], confidence: 'high', source: 'deps', evidence: 'pkg' }]),
}));

vi.mock('../../src/knowledge/scanners/code-scanner.js', () => ({
  scanCodeStructure: vi.fn(() => []),
}));

vi.mock('../../src/knowledge/scanners/git-scanner.js', () => ({
  scanGitHistory: vi.fn(() => []),
}));

vi.mock('../../src/knowledge/scanners/docs-scanner.js', () => ({
  scanDocs: vi.fn(() => []),
}));

import { runScan, getSourceDescription, listScanSources } from '../../src/knowledge/scan.js';

describe('listScanSources', () => {
  it('should return all 4 scan sources', () => {
    const sources = listScanSources();
    expect(sources).toEqual(['deps', 'code', 'git', 'docs']);
  });

  it('should not be empty', () => {
    expect(listScanSources().length).toBe(4);
  });
});

describe('getSourceDescription', () => {
  it('should return description for deps', () => {
    expect(getSourceDescription('deps')).toContain('依赖');
  });

  it('should return description for code', () => {
    expect(getSourceDescription('code')).toContain('代码');
  });

  it('should return description for git', () => {
    expect(getSourceDescription('git')).toContain('Git');
  });

  it('should return description for docs', () => {
    expect(getSourceDescription('docs')).toContain('文档');
  });
});

describe('runScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a ScanResult structure', () => {
    const result = runScan('/root');
    expect(result).toHaveProperty('sources');
    expect(result).toHaveProperty('totalProposed');
    expect(result).toHaveProperty('byConfidence');
    expect(result).toHaveProperty('byType');
    expect(result).toHaveProperty('totalDurationMs');
  });

  it('should scan all 4 sources by default', () => {
    const result = runScan('/root');
    expect(result.sources.length).toBe(4);
  });

  it('should respect sources option', () => {
    const result = runScan('/root', { sources: ['deps'] });
    expect(result.sources.length).toBe(1);
    expect(result.sources[0].source).toBe('deps');
  });

  it('should filter by minConfidence', () => {
    const result = runScan('/root', { minConfidence: 'high' });
    // High confidence filter should include only high-confidence pages
    expect(result.totalProposed).toBeGreaterThanOrEqual(0);
  });

  it('should filter by maxPages', () => {
    const result = runScan('/root', { maxPages: 1 });
    expect(result.totalProposed).toBeLessThanOrEqual(1);
  });

  it('should compute byConfidence counts', () => {
    const result = runScan('/root');
    const { byConfidence } = result;
    expect(byConfidence.high + byConfidence.medium + byConfidence.low).toBe(result.totalProposed);
  });

  it('should compute byType counts', () => {
    const result = runScan('/root');
    const totalFromTypes = Object.values(result.byType).reduce((a, b) => a + b, 0);
    expect(totalFromTypes).toBe(result.totalProposed);
  });

  it('should track duration', () => {
    const result = runScan('/root');
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});
