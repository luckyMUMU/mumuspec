/**
 * Contract Validator tests — drift detection coverage for all drift types.
 *
 * Verifies: schema_mismatch, enforcement_violation, orphaned_consumer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectContractDrift } from '../src/contract/validator.js';
import { persistContract } from '../src/contract/manager.js';
import type { Contract } from '../src/core/types-contract.js';

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'mumuspec-validator-'));
  mkdirSync(join(testDir, '.mumuspec', 'contracts'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'test.contract',
    name: 'Test Contract',
    category: 'api',
    version: '1.0.0',
    criticality: 'standard',
    source: 'src/test.ts',
    schema: {},
    examples: [],
    upstream: [],
    downstream: [],
    status: 'active',
    owner: 'test',
    description: 'Test contract for validator tests',
    ...overrides,
  };
}

// ─── schema_mismatch drift ───────────────────────────────────────────────

describe('drift: schema_mismatch', () => {
  it('detects missing schema definition', () => {
    const contract = makeContract({ schema: {} });
    persistContract(testDir, contract);

    const report = detectContractDrift(testDir);
    const schemaDrifts = report.drifts.filter(d => d.type === 'schema_mismatch');

    expect(schemaDrifts.length).toBeGreaterThan(0);
    expect(schemaDrifts[0]).toMatchObject({
      error_code: 'E-CONTRACT-007',
      contract_id: 'test.contract',
    });
  });

  it('detects orphaned outbound_id references', () => {
    // Manually write a registry with orphan reference
    const yaml = `version: '1.0.0'
last_updated: '2025-01-01T00:00:00Z'
contracts: []
outbound_ids:
  - non.existent.contract
inbound_ids: []
dependency_graph: {}
`;
    writeFileSync(join(testDir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');

    const report = detectContractDrift(testDir);
    const orphanDrifts = report.drifts.filter(d =>
      d.type === 'schema_mismatch' && d.message.includes('non.existent.contract')
    );

    expect(orphanDrifts.length).toBeGreaterThan(0);
    expect(orphanDrifts[0].error_code).toBe('E-CONTRACT-008');
  });

  it('passes clean contract with full schema', () => {
    const contract = makeContract({
      source: 'https://example.com/api',  // HTTP source skips file existence check
      schema: { type: 'object', properties: { id: { type: 'string' } } },
      examples: [{ name: 'sample', value: { id: '123' } }],
    });
    persistContract(testDir, contract);

    const report = detectContractDrift(testDir);
    const schemaDrifts = report.drifts.filter(d => d.type === 'schema_mismatch');

    expect(schemaDrifts.length).toBe(0);
    expect(report.clean_contracts).toContain('test.contract');
  });
});

// ─── enforcement_violation drift ─────────────────────────────────────────

describe('drift: enforcement_violation', () => {
  it('detects API contract without examples', () => {
    persistContract(testDir, makeContract({ category: 'api', examples: [] }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d => d.type === 'enforcement_violation');

    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts[0]).toMatchObject({
      error_code: 'E-CONTRACT-009',
      message: /examples/,
    });
  });

  it('detects CLI contract without flags schema', () => {
    persistContract(testDir, makeContract({
      id: 'cli.contract',
      category: 'cli',
      schema: { type: 'object' },  // missing flags/options
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('CLI')
    );

    expect(drifts.length).toBeGreaterThan(0);
  });

  it('detects database contract without version', () => {
    persistContract(testDir, makeContract({
      id: 'db.contract',
      category: 'database',
      version: '0.0.0',
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('Database')
    );

    expect(drifts.length).toBeGreaterThan(0);
  });

  it('detects SDK contract without owner', () => {
    persistContract(testDir, makeContract({
      id: 'sdk.contract',
      category: 'sdk',
      owner: '',
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('SDK')
    );

    expect(drifts.length).toBeGreaterThan(0);
  });

  it('passes API contract with examples', () => {
    persistContract(testDir, makeContract({
      category: 'api',
      examples: [{ name: 'sample', value: {} }],
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.contract_id === 'test.contract'
    );

    expect(drifts.length).toBe(0);
  });
});

// ─── orphaned_consumer drift ─────────────────────────────────────────────

describe('drift: orphaned_consumer', () => {
  it('detects inbound_id pointing to non-existent contract', () => {
    const yaml = `version: '1.0.0'
last_updated: '2025-01-01T00:00:00Z'
contracts: []
outbound_ids: []
inbound_ids:
  - ghost.contract
dependency_graph: {}
`;
    writeFileSync(join(testDir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');

    const report = detectContractDrift(testDir);
    const orphaned = report.drifts.filter(d =>
      d.message.includes('ghost.contract') && d.type === 'schema_mismatch'
    );

    expect(orphaned.length).toBeGreaterThan(0);
    expect(orphaned[0].error_code).toBe('E-CONTRACT-008');
  });

  it('clean registry has no orphaned consumer drifts', () => {
    persistContract(testDir, makeContract());

    const report = detectContractDrift(testDir);
    const orphaned = report.drifts.filter(d =>
      d.id.startsWith('DRIFT-GRAPH')
    );

    expect(orphaned.length).toBe(0);
  });
});

// ─── Criticality escalation ──────────────────────────────────────────────

describe('drift: criticality escalation', () => {
  it('marks missing source as ERROR for critical contracts', () => {
    // Create file system without source file
    persistContract(testDir, makeContract({
      source: 'nonexistent/file.ts',
      criticality: 'critical',
    }));

    const report = detectContractDrift(testDir);
    const sourceDrift = report.drifts.find(d => d.type === 'unimplemented');

    expect(sourceDrift).toBeDefined();
    expect(sourceDrift!.severity).toBe('ERROR');
    expect(report.has_critical_drifts).toBe(true);
  });

  it('marks missing source as WARN for low-criticality contracts', () => {
    persistContract(testDir, makeContract({
      id: 'low.crit',
      source: 'nonexistent/file.ts',
      criticality: 'low',
    }));

    const report = detectContractDrift(testDir);
    const sourceDrift = report.drifts.find(d => d.type === 'unimplemented' && d.contract_id === 'low.crit');

    expect(sourceDrift).toBeDefined();
    expect(sourceDrift!.severity).toBe('WARN');
  });
});

// ─── Deprecated contract drift ───────────────────────────────────────────

describe('drift: deprecated_in_use', () => {
  it('detects deprecated contract with active upstream consumers', () => {
    persistContract(testDir, makeContract({
      status: 'deprecated',
      upstream: ['svc.a', 'svc.b'],
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d => d.type === 'deprecated_in_use');

    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts[0]).toMatchObject({
      error_code: 'E-CONTRACT-006',
    });
  });

  it('clean deprecated contract with no consumers', () => {
    persistContract(testDir, makeContract({
      status: 'deprecated',
      upstream: [],
    }));

    const report = detectContractDrift(testDir);
    const drifts = report.drifts.filter(d =>
      d.type === 'deprecated_in_use' && d.contract_id === 'test.contract'
    );

    expect(drifts.length).toBe(0);
  });
});
