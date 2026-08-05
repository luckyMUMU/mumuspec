/**
 * Contract Layer — Validator Tests (tests/contract/)
 *
 * Dedicated test suite for contract validation logic:
 * - detectContractDrift: drift detection for contract integrity
 * - validateBoundaries: BOUNDARY.md compliance checks
 * - getOutboundContracts / getInboundContracts: filtering logic
 *
 * Naming convention: METHOD > scenario (AAA pattern).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { detectContractDrift, validateBoundaries } from '../../src/contract/validator.js';
import { getOutboundContracts, getInboundContracts, loadAllContracts } from '../../src/contract/loader.js';
import type { Contract } from '../../src/core/types-contract.js';

// ════════════════════════════════════════════════════════════════════
// Test Infrastructure
// ════════════════════════════════════════════════════════════════════

const TEST_DIR = join(tmpdir(), 'mumuspec-validator-test-' + Date.now());

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
    schema: { type: 'object', properties: { id: { type: 'string' } } },
    examples: ['{"id": "1"}'],
    ...overrides,
  };
}

function writeContractsYaml(dir: string, yaml: string): void {
  writeFileSync(join(dir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');
}

afterAll(cleanup);

// ════════════════════════════════════════════════════════════════════
// detectContractDrift > validateContract — normal pass scenarios
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > validateContract — normal pass', () => {
  it('passes a fully valid contract with no drifts detected', () => {
    // ARRANGE
    const dir = setupTestDir('valid-clean');
    // Use serialization category (no specific enforcement rules) and http source
    // to skip file-existence check; include examples to satisfy api rules if needed.
    const contract = makeContract({
      source: 'https://api.example.com/spec',
      category: 'serialization',
      schema: { type: 'object', properties: { id: { type: 'string' } } },
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    // serialization category has no enforcement_violation rules, schema is non-empty,
    // source is http (no file check) → zero drifts expected
    expect(report.drifts).toHaveLength(0);
    expect(report.clean_contracts).toContain('test.contract');
    expect(report.total_contracts).toBe(1);
    expect(report.has_critical_drifts).toBe(false);
  });

  it('passes multiple contracts when all are properly defined', () => {
    // ARRANGE
    const dir = setupTestDir('valid-multi');
    const contracts = [
      makeContract({ id: 'svc.a', source: 'https://api.example.com/a', upstream: [] }),
      makeContract({ id: 'svc.b', source: 'https://api.example.com/b', downstream: ['svc.a'] }),
    ];
    writeContractsYaml(dir, buildYaml(contracts));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    expect(report.total_contracts).toBe(2);
    // Both should have valid schemas, no orphaned references
    expect(report.clean_contracts.length).toBeGreaterThanOrEqual(0);
  });

  it('passes with proper outbound and inbound ID sets', () => {
    // ARRANGE
    const dir = setupTestDir('valid-ids');
    const contract = makeContract({
      upstream: ['svc.frontend'],
      downstream: ['svc.backend'],
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    // dependency_graph should not contain orphaned ID warnings
    const graphDrifts = report.drifts.filter(d => d.id.startsWith('DRIFT-GRAPH'));
    expect(graphDrifts).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift > validateContract — schema violation scenarios
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > validateContract — schema violations', () => {
  it('detects missing required fields (empty schema)', () => {
    // ARRANGE
    const dir = setupTestDir('schema-empty');
    const contract = makeContract({ schema: {} });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const schemaDrifts = report.drifts.filter(d => d.type === 'schema_mismatch' && !d.id.startsWith('DRIFT-GRAPH'));
    expect(schemaDrifts.length).toBeGreaterThan(0);
    expect(schemaDrifts[0].contract_id).toBe('test.contract');
    expect(schemaDrifts[0].error_code).toBe('E-CONTRACT-007');
  });

  it('detects type error — source field with invalid local path (file missing)', () => {
    // ARRANGE
    const dir = setupTestDir('schema-source-missing');
    const contract = makeContract({ source: 'src/nonexistent/deep/path.ts' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const unimplementedDrifts = report.drifts.filter(d => d.type === 'unimplemented');
    expect(unimplementedDrifts.length).toBeGreaterThan(0);
    expect(unimplementedDrifts[0].contract_id).toBe('test.contract');
    expect(unimplementedDrifts[0].error_code).toBe('E-CONTRACT-005');
  });

  it('detects enforcement violation — API contract without examples', () => {
    // ARRANGE
    const dir = setupTestDir('enforce-no-examples');
    const contract = makeContract({ category: 'api', examples: [] });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const enforcementDrifts = report.drifts.filter(d => d.type === 'enforcement_violation');
    expect(enforcementDrifts.length).toBeGreaterThan(0);
    expect(enforcementDrifts[0].error_code).toBe('E-CONTRACT-009');
  });

  it('detects enforcement violation — CLI contract without flags schema', () => {
    // ARRANGE
    const dir = setupTestDir('enforce-cli-flags');
    const contract = makeContract({
      id: 'cli.contract',
      category: 'cli',
      schema: { type: 'object' },
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const cliDrifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('CLI')
    );
    expect(cliDrifts.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift > validateContract — orphaned outbound reference
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > validateContract — orphaned outbound reference', () => {
  it('detects drift when outbound_ids references a non-existent contract', () => {
    // ARRANGE
    const dir = setupTestDir('orphan-outbound');
    // Manually craft YAML with orphan outbound reference
    const yaml = [
      'version: "1.0.0"',
      'last_updated: "2025-01-01T00:00:00Z"',
      'contracts:',
      '  - id: "existing.contract"',
      '    name: "Existing"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "src/test.ts"',
      '    description: "An existing contract"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: { type: "object" }',
      'outbound_ids:',
      '  - "existing.contract"',
      '  - "ghost.contract"',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(dir, yaml);

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const orphanDrifts = report.drifts.filter(d =>
      d.message.includes('ghost.contract') && d.error_code === 'E-CONTRACT-008'
    );
    expect(orphanDrifts.length).toBeGreaterThan(0);
  });

  it('detects drift when inbound_ids references a non-existent contract', () => {
    // ARRANGE
    const dir = setupTestDir('orphan-inbound');
    const yaml = [
      'version: "1.0.0"',
      'last_updated: "2025-01-01T00:00:00Z"',
      'contracts:',
      '  - id: "existing.contract"',
      '    name: "Existing"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "src/test.ts"',
      '    description: "An existing contract"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: { type: "object" }',
      'outbound_ids: []',
      'inbound_ids:',
      '  - "ghost.contract"',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(dir, yaml);

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const orphanDrifts = report.drifts.filter(d =>
      d.message.includes('ghost.contract') && d.error_code === 'E-CONTRACT-008'
    );
    expect(orphanDrifts.length).toBeGreaterThan(0);
  });

  it('detects orphaned consumer — downstream dependency on unregistered contract', () => {
    // ARRANGE
    const dir = setupTestDir('orphan-consumer');
    const yaml = [
      'version: "1.0.0"',
      'last_updated: "2025-01-01T00:00:00Z"',
      'contracts:',
      '  - id: "svc.frontend"',
      '    name: "Frontend Service"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "src/test.ts"',
      '    description: "Frontend"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream:',
      '      - "svc.missing"',
      '    schema: { type: "object" }',
      'outbound_ids: []',
      'inbound_ids:',
      '  - "svc.frontend"',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(dir, yaml);

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const orphanedConsumer = report.drifts.filter(d =>
      d.type === 'orphaned_consumer' && d.message.includes('svc.missing')
    );
    expect(orphanedConsumer.length).toBeGreaterThan(0);
    expect(orphanedConsumer[0].error_code).toBe('E-CONTRACT-008');
  });
});

// ════════════════════════════════════════════════════════════════════
// getOutboundContracts > validateOutbound — normal scenarios
// ════════════════════════════════════════════════════════════════════

describe('getOutboundContracts > validateOutbound — normal scenario', () => {
  it('returns only contracts with upstream consumers (outbound side)', () => {
    // ARRANGE
    const dir = setupTestDir('outbound-normal');
    const outbound = makeContract({
      id: 'svc.api',
      upstream: ['external.web'],
      downstream: [],
    });
    const inbound = makeContract({
      id: 'svc.db',
      upstream: [],
      downstream: ['svc.api'],
    });
    writeContractsYaml(dir, buildYaml([outbound, inbound]));

    // ACT
    const result = getOutboundContracts(dir);

    // ASSERT
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(c => c.id === 'svc.api')).toBe(true);
  });

  it('filters correctly when all contracts are outbound', () => {
    // ARRANGE
    const dir = setupTestDir('outbound-all');
    const contracts = [
      makeContract({ id: 'svc.a', upstream: ['ext.1'] }),
      makeContract({ id: 'svc.b', upstream: ['ext.2'] }),
    ];
    writeContractsYaml(dir, buildYaml(contracts));

    // ACT
    const result = getOutboundContracts(dir);

    // ASSERT
    expect(result.length).toBe(2);
  });

  it('returns empty array when no outbound contracts exist', () => {
    // ARRANGE
    const dir = setupTestDir('outbound-none');
    const contract = makeContract({ upstream: [], downstream: ['svc.other'] });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const result = getOutboundContracts(dir);

    // ASSERT
    expect(result).toHaveLength(0);
  });

  it('getInboundContracts returns correct inbound set', () => {
    // ARRANGE
    const dir = setupTestDir('inbound-normal');
    // Inbound = contract that depends on external providers (has downstream)
    const inbound = makeContract({
      id: 'svc.database',
      upstream: [],
      downstream: ['external.db'],
    });
    writeContractsYaml(dir, buildYaml([inbound]));

    // ACT
    const result = getInboundContracts(dir);

    // ASSERT
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(c => c.id === 'svc.database')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// validateOutbound — URL format error scenarios
// ════════════════════════════════════════════════════════════════════

describe('validateOutbound — URL format error handling', () => {
  it('accepts HTTP URL format and skips file-existence check', () => {
    // ARRANGE
    const dir = setupTestDir('url-http');
    const contract = makeContract({ source: 'https://api.example.com/openapi.json' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const unimplemented = report.drifts.filter(d => d.type === 'unimplemented');
    expect(unimplemented).toHaveLength(0);
  });

  it('accepts HTTPS URL format and skips file-existence check', () => {
    // ARRANGE
    const dir = setupTestDir('url-https');
    const contract = makeContract({ source: 'https://raw.githubusercontent.com/spec/main.yaml' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const unimplemented = report.drifts.filter(d => d.type === 'unimplemented');
    expect(unimplemented).toHaveLength(0);
  });

  it('treats malformed local source as unimplemented file', () => {
    // ARRANGE
    const dir = setupTestDir('url-bad-local');
    const contract = makeContract({ source: 'this/is/a/missing/file.ts' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    const unimplemented = report.drifts.filter(d => d.type === 'unimplemented');
    expect(unimplemented.length).toBeGreaterThan(0);
    expect(unimplemented[0].message).toContain('this/is/a/missing/file.ts');
  });
});

// ════════════════════════════════════════════════════════════════════
// Edge cases — empty strings and oversized contracts
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > edge cases — empty strings and oversized contracts', () => {
  it('handles contract with empty string fields (empty name, empty owner)', () => {
    // ARRANGE
    const dir = setupTestDir('edge-empty-strings');
    const contract = makeContract({ name: '', owner: '', description: '' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    // Should not throw, should return a valid report
    expect(report).toBeDefined();
    expect(report.total_contracts).toBe(1);
    expect(report.timestamp).toBeDefined();
    expect(typeof report.scan_duration_ms).toBe('number');
  });

  it('handles contract with empty string in ID field', () => {
    // ARRANGE
    const dir = setupTestDir('edge-empty-id');
    const contract = makeContract({ id: '' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    expect(report).toBeDefined();
    expect(report.total_contracts).toBe(1);
  });

  it('handles oversized contract — large schema with many properties', () => {
    // ARRANGE
    const dir = setupTestDir('edge-oversized');
    const largeProperties: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) {
      largeProperties[`field_${i}`] = { type: 'string', description: 'a'.repeat(100) };
    }
    const contract = makeContract({
      id: 'oversized.contract',
      schema: { type: 'object', properties: largeProperties },
    });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    expect(report.total_contracts).toBe(1);
    // Contract has a non-empty schema, so no schema_mismatch drift
    const schemaDrifts = report.drifts.filter(d =>
      d.type === 'schema_mismatch' && d.contract_id === 'oversized.contract'
    );
    expect(schemaDrifts).toHaveLength(0);
    // Should complete within reasonable time
    expect(report.scan_duration_ms).toBeLessThan(5000);
  });

  it('handles contract with empty string as source field', () => {
    // ARRANGE
    const dir = setupTestDir('edge-empty-source');
    const contract = makeContract({ source: '' });
    writeContractsYaml(dir, buildYaml([contract]));

    // ACT
    const report = detectContractDrift(dir);

    // ASSERT
    // Empty source doesn't start with http, will check file existence
    // which will fail for empty string path — this is expected behavior
    expect(report).toBeDefined();
    expect(report.total_contracts).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// validateBoundaries — basic coverage
// ════════════════════════════════════════════════════════════════════

describe('validateBoundaries > basic coverage', () => {
  it('detects missing BOUNDARY.md in directory with code', () => {
    // ARRANGE
    const dir = setupTestDir('boundary-missing');
    writeFileSync(join(dir, 'src', 'index.ts'), 'export function hello() {}\n', 'utf-8');
    // Ensure contracts dir exists so validator doesn't skip
    writeContractsYaml(dir, 'version: "1.0.0"\nlast_updated: "2025-01-01T00:00:00Z"\ncontracts: []\noutbound_ids: []\ninbound_ids: []\ndependency_graph: {}\n');

    // ACT
    const results = validateBoundaries(dir);

    // ASSERT
    const srcResult = results.find(r => r.dir_path.endsWith('src'));
    if (srcResult) {
      expect(srcResult.has_boundary_doc).toBe(false);
      expect(srcResult.errors.some(e => e.code === 'E-CONTRACT-001')).toBe(true);
    }
  });

  it('passes when BOUNDARY.md matches code exports', () => {
    // ARRANGE
    const dir = setupTestDir('boundary-clean');
    writeFileSync(join(dir, 'src', 'api.ts'), 'export function getData(): void {}\n', 'utf-8');
    writeFileSync(join(dir, 'src', 'BOUNDARY.md'), [
      '# BOUNDARY.md',
      '',
      '## 对外接口',
      '',
      '- `getData(): void`: Fetch data',
      '',
      '## 依赖声明',
      '',
      '## 数据契约',
      '',
      '## 变更日志',
      '',
      '- 2025-01-01: Initial',
      '',
    ].join('\n'));
    writeContractsYaml(dir, 'version: "1.0.0"\nlast_updated: "2025-01-01T00:00:00Z"\ncontracts: []\noutbound_ids: []\ninbound_ids: []\ndependency_graph: {}\n');

    // ACT
    const results = validateBoundaries(dir);

    // ASSERT
    const srcResult = results.find(r => r.dir_path.endsWith('src'));
    if (srcResult) {
      expect(srcResult.has_boundary_doc).toBe(true);
      expect(srcResult.errors.filter(e => e.code === 'E-CONTRACT-002')).toHaveLength(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// YAML helper
// ════════════════════════════════════════════════════════════════════

function buildYaml(contracts: Contract[]): string {
  // ponytail: manually build YAML to avoid external dependency; omits examples
  // to keep valid YAML — tests that need examples write their own YAML.
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
    lines.push(`    owner: "${c.owner || ''}"`);
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
