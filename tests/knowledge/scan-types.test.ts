/**
 * Tests for src/knowledge/scan-types.ts — pure type interface validation.
 */
import { describe, it, expect } from 'vitest';
import type {
  ScanSource,
  InferenceConfidence,
  ProposedKnowledgePage,
  ScanSourceResult,
  ScanResult,
  ScanOptions,
  DepKnowledgeRule,
  GitKnowledgePattern,
  DocInventoryEntry,
} from '../../src/knowledge/scan-types.js';

describe('scan-types — type interfaces', () => {
  it('ProposedKnowledgePage should accept all fields', () => {
    const page: ProposedKnowledgePage = {
      id: 'KS-0001',
      title: 'Test decision',
      type: 'decision',
      scope: 'src',
      content: 'Some content',
      tags: ['framework', 'react'],
      graph_bindings: ['src/components'],
      confidence: 'high',
      source: 'deps',
      evidence: 'package.json',
    };
    expect(page.type).toBe('decision');
    expect(page.confidence).toBe('high');
  });

  it('ProposedKnowledgePage supports all valid types', () => {
    const types: ProposedKnowledgePage['type'][] = ['decision', 'pattern', 'risk', 'rationale', 'lesson'];
    expect(types.length).toBe(5);
  });

  it('ProposedKnowledgePage accepts all confidence levels', () => {
    const levels: InferenceConfidence[] = ['high', 'medium', 'low'];
    expect(levels.length).toBe(3);
  });

  it('ScanSource accepts all 4 sources', () => {
    const sources: ScanSource[] = ['deps', 'code', 'git', 'docs'];
    expect(sources.length).toBe(4);
  });

  it('ScanOptions supports all option fields', () => {
    const opts: ScanOptions = {
      sources: ['deps', 'code'],
      minConfidence: 'medium',
      dryRun: true,
      maxPages: 10,
      scope: 'src',
    };
    expect(opts.maxPages).toBe(10);
    expect(opts.dryRun).toBe(true);
  });

  it('DepKnowledgeRule should accept string pattern', () => {
    const rule: DepKnowledgeRule = {
      packagePattern: 'next',
      propose: {
        type: 'decision',
        titleTemplate: 'Use Next.js',
        contentTemplate: 'desc',
        tags: ['framework'],
        confidence: 'high',
      },
    };
    expect(rule.packagePattern).toBe('next');
  });

  it('DepKnowledgeRule should accept array pattern', () => {
    const rule: DepKnowledgeRule = {
      packagePattern: ['react', 'react-dom'],
      propose: {
        type: 'decision',
        titleTemplate: 'Use React',
        contentTemplate: 'desc',
        tags: ['framework'],
        confidence: 'high',
      },
    };
    expect(Array.isArray(rule.packagePattern)).toBe(true);
  });

  it('DocInventoryEntry should accept all fields', () => {
    const entry: DocInventoryEntry = {
      path: 'README.md',
      exists: true,
      completeness: 'complete',
      lastModified: '2024-01-01T00:00:00Z',
    };
    expect(entry.completeness).toBe('complete');
  });

  it('DocInventoryEntry accepts all completeness levels', () => {
    const levels: DocInventoryEntry['completeness'][] = ['complete', 'minimal', 'partial', 'missing'];
    expect(levels.length).toBe(4);
  });

  it('ScanResult should accept result structure', () => {
    const result: ScanResult = {
      sources: [],
      totalProposed: 5,
      byConfidence: { high: 2, medium: 2, low: 1 },
      byType: { decision: 3, pattern: 2 },
      totalDurationMs: 100,
    };
    expect(result.totalProposed).toBe(5);
  });

  it('ScanSourceResult should accept result structure', () => {
    const result: ScanSourceResult = {
      source: 'deps',
      proposedPages: [],
      scannedCount: 3,
      durationMs: 25,
    };
    expect(result.source).toBe('deps');
  });

  it('GitKnowledgePattern should accept pattern structure', () => {
    const pattern: GitKnowledgePattern = {
      pattern: /fix: (.+)/,
      type: 'lesson',
      titleTemplate: 'Lesson: $1',
      contentTemplate: 'From commit: $1',
    };
    expect(pattern.pattern).toBeDefined();
  });
});
