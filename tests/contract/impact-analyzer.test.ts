/**
 * Contract Layer — Impact Analyzer Tests (tests/contract/)
 *
 * Dedicated test suite for analyzeContractImpact() and formatImpactReport().
 * Uses temporary project directories with contract registries for isolation.
 *
 * Naming convention: METHOD > scenario (AAA pattern).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { analyzeContractImpact, formatImpactReport } from '../../src/contract/impact-analyzer.js';
import { loadAllContracts } from '../../src/contract/loader.js';
import type { Contract } from '../../src/core/types-contract.js';

// ════════════════════════════════════════════════════════════════════
// Test Infrastructure
// ════════════════════════════════════════════════════════════════════

const TEST_DIR = join(tmpdir(), 'mumuspec-impact-test-' + Date.now());

function setupTestDir(id: string): string {
  const dir = join(TEST_DIR, `project-${id}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec', 'contracts'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

function cleanup(): void {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'test.contract',
    name: 'Test Contract',
    category: 'api',
    status: 'active',
    criticality: 'important',
    version: '1.0.0',
    source: 'src/test.ts',
    description: 'A test contract',
    owner: 'team',
    upstream: [],
    downstream: [],
    schema: { type: 'object' },
    examples: [],
    ...overrides,
  };
}

function writeContractsYaml(dir: string, yaml: string): void {
  writeFileSync(join(dir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');
}

afterAll(cleanup);

// ════════════════════════════════════════════════════════════════════
// analyzeContractImpact > normal contract change — return structure
// ════════════════════════════════════════════════════════════════════

describe('analyzeContractImpact > normal contract change return structure', () => {
  it('returns complete ContractImpactAnalysis shape for modify on standalone contract', () => {
    // ARRANGE
    const dir = setupTestDir('normal-return');
    const contract = makeContract();
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ASSERT
    expect(result).toHaveProperty('contract_id', 'test.contract');
    expect(result).toHaveProperty('change_type', 'modify');
    expect(result).toHaveProperty('upstream_impact');
    expect(result).toHaveProperty('downstream_impact');
    expect(result).toHaveProperty('breaking');
    expect(result).toHaveProperty('risk');
    expect(result).toHaveProperty('mitigations');
    expect(Array.isArray(result.upstream_impact)).toBe(true);
    expect(Array.isArray(result.downstream_impact)).toBe(true);
    expect(Array.isArray(result.mitigations)).toBe(true);
    expect(typeof result.breaking).toBe('boolean');
    expect(['low', 'medium', 'high']).toContain(result.risk);
  });

  it('returns correct structure for upstream and downstream impact entries', () => {
    // ARRANGE
    const dir = setupTestDir('entry-shape');
    const contract = makeContract({
      upstream: ['svc.frontend'],
      downstream: ['svc.database'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ASSERT
    if (result.upstream_impact.length > 0) {
      const entry = result.upstream_impact[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('breaking');
      expect(entry).toHaveProperty('effort');
      expect(['trivial', 'small', 'medium', 'large']).toContain(entry.effort);
    }
    if (result.downstream_impact.length > 0) {
      const entry = result.downstream_impact[0];
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('breaking');
      expect(entry).toHaveProperty('effort');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// analyzeContractImpact > breaking change — upstream/downstream lists
// ════════════════════════════════════════════════════════════════════

describe('analyzeContractImpact > breaking change returns dependency lists', () => {
  it('flags breaking=true and lists upstream consumers when removing a contract with dependents', () => {
    // ARRANGE
    const dir = setupTestDir('breaking-remove');
    const contract = makeContract({
      upstream: ['svc.web', 'svc.mobile'],
      downstream: ['svc.db'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'remove');

    // ASSERT
    expect(result.breaking).toBe(true);
    expect(result.upstream_impact.length).toBeGreaterThanOrEqual(2);
    expect(result.upstream_impact.some(e => e.id === 'svc.web')).toBe(true);
    expect(result.upstream_impact.some(e => e.id === 'svc.mobile')).toBe(true);
    expect(result.upstream_impact.every(e => e.breaking)).toBe(true);
  });

  it('flags breaking=true when deprecating a critical contract', () => {
    // ARRANGE
    const dir = setupTestDir('breaking-deprecate');
    const contract = makeContract({
      criticality: 'critical',
      upstream: ['svc.frontend'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'deprecate');

    // ASSERT
    expect(result.breaking).toBe(true);
    expect(result.upstream_impact.some(e => e.id === 'svc.frontend')).toBe(true);
  });

  it('returns downstream dependency list with effort estimates', () => {
    // ARRANGE
    const dir = setupTestDir('downstream-list');
    const contract = makeContract({
      downstream: ['svc.cache', 'svc.queue'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ASSERT
    expect(result.downstream_impact.length).toBeGreaterThanOrEqual(2);
    expect(result.downstream_impact.some(e => e.id === 'svc.cache')).toBe(true);
    expect(result.downstream_impact.some(e => e.id === 'svc.queue')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// analyzeContractImpact > invalid parameter handling
// ════════════════════════════════════════════════════════════════════

describe('analyzeContractImpact > invalid parameter error handling', () => {
  it('returns not-found mitigation and breaking=false for non-existent contract ID', () => {
    // ARRANGE
    const dir = setupTestDir('invalid-id');
    writeContractsYaml(dir, buildYaml([makeContract()]));

    // ACT
    const result = analyzeContractImpact(dir, 'does.not.exist', 'modify');

    // ASSERT
    expect(result.breaking).toBe(false);
    expect(result.risk).toBe('low');
    expect(result.contract_id).toBe('does.not.exist');
    expect(result.upstream_impact).toHaveLength(0);
    expect(result.downstream_impact).toHaveLength(0);
    expect(result.mitigations.length).toBeGreaterThan(0);
    expect(result.mitigations[0]).toContain('not found');
  });

  it('handles contract with no upstream and no downstream gracefully', () => {
    // ARRANGE
    const dir = setupTestDir('isolated');
    const contract = makeContract({ upstream: [], downstream: [] });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'remove');

    // ASSERT
    expect(result.breaking).toBe(false);
    expect(result.upstream_impact).toHaveLength(0);
    expect(result.downstream_impact).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// analyzeContractImpact > breaking change type-level detection
// ════════════════════════════════════════════════════════════════════

describe('analyzeContractImpact > breaking change type field detection', () => {
  it('detects modify as breaking when contract is critical and has upstream', () => {
    // ARRANGE
    const dir = setupTestDir('type-breaking');
    const contract = makeContract({
      criticality: 'critical',
      upstream: ['svc.consumer'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ASSERT
    expect(result.breaking).toBe(true);
    expect(result.upstream_impact.some(e => e.id === 'svc.consumer' && e.breaking)).toBe(true);
  });

  it('detects modify as non-breaking when contract is non-critical', () => {
    // ARRANGE
    const dir = setupTestDir('type-nonbreaking');
    const contract = makeContract({
      criticality: 'minor',
      upstream: ['svc.consumer'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ASSERT
    expect(result.breaking).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// analyzeContractImpact > edge cases — empty list, single entry
// ════════════════════════════════════════════════════════════════════

describe('analyzeContractImpact > edge cases — empty list and single entry', () => {
  it('handles empty contract registry gracefully', () => {
    // ARRANGE
    const dir = setupTestDir('empty-registry');
    writeContractsYaml(dir, 'version: "1.0.0"\nlast_updated: "2025-01-01T00:00:00Z"\ncontracts: []\noutbound_ids: []\ninbound_ids: []\ndependency_graph: {}\n');

    // ACT
    const result = analyzeContractImpact(dir, 'any.contract', 'modify');

    // ASSERT
    expect(result.breaking).toBe(false);
    expect(result.upstream_impact).toHaveLength(0);
    expect(result.downstream_impact).toHaveLength(0);
    expect(result.mitigations[0]).toContain('not found');
  });

  it('analyzes single contract in registry correctly', () => {
    // ARRANGE
    const dir = setupTestDir('single-entry');
    const contract = makeContract({ upstream: ['external.consumer'], downstream: ['external.provider'] });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = analyzeContractImpact(dir, 'test.contract', 'deprecate');

    // ASSERT
    expect(result.contract_id).toBe('test.contract');
    expect(result.upstream_impact.length).toBeGreaterThanOrEqual(1);
    expect(result.downstream_impact.length).toBeGreaterThanOrEqual(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// formatImpactReport > output structure
// ════════════════════════════════════════════════════════════════════

describe('formatImpactReport > formatted output', () => {
  it('renders all key sections: title, risk, upstream, downstream, mitigations', () => {
    // ARRANGE
    const dir = setupTestDir('report-format');
    const contract = makeContract({ upstream: ['svc.a'], downstream: ['svc.b'] });
    writeContractsYaml(dir, buildYaml([contract]));
    const analysis = analyzeContractImpact(dir, 'test.contract', 'modify');

    // ACT
    const report = formatImpactReport(analysis);

    // ASSERT
    expect(report).toContain('test.contract');
    expect(report).toContain('Upstream Impact');
    expect(report).toContain('Downstream Impact');
    expect(report).toContain('Recommended Mitigations');
    expect(report).toContain('svc.a');
    expect(report).toContain('svc.b');
  });
});

// ════════════════════════════════════════════════════════════════════
// YAML helper
// ════════════════════════════════════════════════════════════════════

function buildYaml(contracts: Contract[]): string {
  // ponytail: manually build YAML to avoid external dependency; omits examples
  // to keep valid YAML — not needed for impact analysis tests.
  const lines: string[] = [
    'version: "1.0.0"',
    `last_updated: "${new Date().toISOString()}"`,
    'contracts:',
  ];

  for (const c of contracts) {
    lines.push(`  - id: "${c.id}"`);
    lines.push(`    name: "${c.name}"`);
    lines.push(`    category: ${c.category}`);
    lines.push(`    status: ${c.status}`);
    lines.push(`    criticality: ${c.criticality}`);
    lines.push(`    version: "${c.version}"`);
    lines.push(`    source: "${c.source}"`);
    lines.push(`    description: "${c.description}"`);
    lines.push(`    owner: "${c.owner}"`);
    lines.push(`    upstream: [${c.upstream.map(u => `"${u}"`).join(', ')}]`);
    lines.push(`    downstream: [${c.downstream.map(d => `"${d}"`).join(', ')}]`);
    lines.push(`    schema: ${JSON.stringify(c.schema)}`);
  }

  const outboundIds = contracts.filter(c => c.upstream.length > 0).map(c => `"${c.id}"`);
  const inboundIds = contracts.filter(c => c.downstream.length > 0).map(c => `"${c.id}"`);

  lines.push(`outbound_ids: [${outboundIds.join(', ')}]`);
  lines.push(`inbound_ids: [${inboundIds.join(', ')}]`);
  lines.push('dependency_graph: {}');

  return lines.join('\n') + '\n';
}
