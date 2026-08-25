/**
 * Contract Layer — Manager & Impact Analyzer Tests
 *
 * Tests contract lifecycle operations: persist, deprecate, remove,
 * audit logging, impact analysis, and BOUNDARY.md scaffolding.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  persistContract,
  deprecateContract,
  removeContract,
  appendContractAuditLog,
  readAuditLog,
  scaffoldBoundary,
  writeBoundary,
  type ContractAuditEntry,
} from '../src/contract/manager.js';
import { analyzeContractImpact, formatImpactReport } from '../src/contract/impact-analyzer.js';
import { loadAllContracts } from '../src/contract/loader.js';
import type { Contract } from '../src/core/types-contract.js';

const TEST_DIR = join(tmpdir(), 'mumuspec-manager-test-' + Date.now());

function setupTestDir(id: string): string {
  const dir = join(TEST_DIR, `project-${id}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec', 'contracts'), { recursive: true });
  mkdirSync(join(dir, 'src', 'core'), { recursive: true });
  return dir;
}

function cleanup() {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}

// ── Helpers ──

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'test.contract',
    name: 'Test Contract',
    category: 'api',
    criticality: 'standard',
    status: 'active',
    version: '1.0.0',
    owner: 'test-team',
    description: 'A test contract',
    upstream: [],
    downstream: [],
    schema: {},
    examples: [],
    ...overrides,
  };
}

function writeContractsYaml(dir: string, contracts: Contract[]): void {
  const yaml = `version: '1.0.0'\nlast_updated: ${new Date().toISOString()}\ncontracts:\n${contracts.map(c => `  - id: ${c.id}\n    name: ${c.name}\n    category: ${c.category}\n    criticality: ${c.criticality}\n    status: ${c.status}\n    version: ${c.version}\n    owner: ${c.owner}\n    description: ${c.description}\n    upstream: [${c.upstream.join(', ')}]\n    downstream: [${c.downstream.join(', ')}]\n    schema: {}\n    examples: []\n`).join('')}\noutbound_ids: [${contracts.filter(c => c.upstream.length > 0).map(c => c.id).join(', ')}]\ninbound_ids: [${contracts.filter(c => c.downstream.length > 0).map(c => c.id).join(', ')}]\ndependency_graph: {}\n`;
  writeFileSync(join(dir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');
}

// ════════════════════════════════════════════════════════════════════
// Impact Analyzer Tests
// ════════════════════════════════════════════════════════════════════

describe('Impact Analyzer', () => {
  afterAll(cleanup);

  it('returns low risk when contract not found', () => {
    const dir = setupTestDir('notfound');
    const result = analyzeContractImpact(dir, 'missing.contract', 'modify');
    expect(result.breaking).toBe(false);
    expect(result.risk).toBe('low');
    expect(result.mitigations[0]).toContain('not found');
  });

  it('marks removal as breaking when upstream consumers exist', () => {
    const dir = setupTestDir('remove-breaking');
    const contract = makeContract({
      id: 'svc.auth',
      name: 'Auth Service',
      upstream: ['svc.client'],
      downstream: ['db.users'],
    });
    writeContractsYaml(dir, [contract]);

    const result = analyzeContractImpact(dir, 'svc.auth', 'remove');
    expect(result.breaking).toBe(true);
    expect(result.upstream_impact.length).toBeGreaterThan(0);
    expect(result.upstream_impact[0].breaking).toBe(true);
  });

  it('marks deprecation of critical contract as breaking', () => {
    const dir = setupTestDir('deprecate-critical');
    const contract = makeContract({
      id: 'svc.core',
      name: 'Core Service',
      criticality: 'critical',
      upstream: ['svc.client'],
      downstream: [],
    });
    writeContractsYaml(dir, [contract]);

    const result = analyzeContractImpact(dir, 'svc.core', 'deprecate');
    expect(result.breaking).toBe(true);
  });

  it('returns low risk for modification of standalone contract', () => {
    const dir = setupTestDir('modify-standalone');
    const contract = makeContract({
      id: 'svc.standalone',
      name: 'Standalone Service',
      criticality: 'standard',
      upstream: [],
      downstream: [],
    });
    writeContractsYaml(dir, [contract]);

    const result = analyzeContractImpact(dir, 'svc.standalone', 'modify');
    expect(result.breaking).toBe(false);
    expect(result.risk).toBe('low');
  });

  it('identifies indirect upstream impact', () => {
    const dir = setupTestDir('indirect');
    // svc.b depends on svc.a (svc.b.downstream contains svc.a),
    // so modifying svc.a impacts svc.b indirectly
    const svcA = makeContract({
      id: 'svc.a',
      name: 'Service A',
      downstream: [],
    });
    const svcB = makeContract({
      id: 'svc.b',
      name: 'Service B',
      downstream: ['svc.a'],
    });
    writeContractsYaml(dir, [svcA, svcB]);

    const result = analyzeContractImpact(dir, 'svc.a', 'modify');
    // svc.b has svc.a in its downstream → indirect upstream impact
    expect(result.upstream_impact.some(e => e.id === 'svc.b')).toBe(true);
  });

  it('generates mitigations for remove change', () => {
    const dir = setupTestDir('mitigations-remove');
    const contract = makeContract({
      id: 'svc.gateway',
      name: 'API Gateway',
      criticality: 'critical',
      upstream: ['svc.web', 'svc.mobile'],
      downstream: ['svc.core'],
    });
    writeContractsYaml(dir, [contract]);

    const result = analyzeContractImpact(dir, 'svc.gateway', 'remove');
    expect(result.mitigations.length).toBeGreaterThan(0);
    expect(result.mitigations.some(m => m.includes('deprecation') || m.includes('Notify'))).toBe(true);
  });

  it('formats report with correct sections', () => {
    const dir = setupTestDir('report');
    const contract = makeContract({
      id: 'svc.test',
      name: 'Test Service',
      upstream: ['consumer-1'],
      downstream: ['provider-1'],
    });
    writeContractsYaml(dir, [contract]);

    const analysis = analyzeContractImpact(dir, 'svc.test', 'modify');
    const report = formatImpactReport(analysis);

    expect(report).toContain('svc.test');
    expect(report).toContain('Upstream Impact');
    expect(report).toContain('Downstream Impact');
    expect(report).toContain('Recommended Mitigations');
    expect(report).toContain('consumer-1');
    expect(report).toContain('provider-1');
  });
});

// ════════════════════════════════════════════════════════════════════
// Contract Persistence Tests
// ════════════════════════════════════════════════════════════════════

describe('Contract Persistence', () => {
  afterAll(cleanup);

  it('creates a new contract in registry', () => {
    const dir = setupTestDir('create');
    const contract = makeContract();
    const result = persistContract(dir, contract);

    expect(result.success).toBe(true);
    const registry = loadAllContracts(dir);
    expect(registry.contracts.find(c => c.id === 'test.contract')).toBeDefined();
  });

  it('updates an existing contract', () => {
    const dir = setupTestDir('update');
    const contract = makeContract();
    persistContract(dir, contract);

    const updated = { ...contract, version: '2.0.0', description: 'Updated' };
    persistContract(dir, updated);

    const registry = loadAllContracts(dir);
    const found = registry.contracts.find(c => c.id === 'test.contract');
    expect(found?.version).toBe('2.0.0');
    expect(found?.description).toBe('Updated');
  });

  it('deprecates a contract with impact analysis', () => {
    const dir = setupTestDir('deprecate');
    writeContractsYaml(dir, [makeContract({ id: 'svc.dep', upstream: ['consumer'] })]);

    const result = deprecateContract(dir, 'svc.dep', {
      migrationPath: 'svc.new-dep',
      actor: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.impact).toBeDefined();

    const registry = loadAllContracts(dir);
    const found = registry.contracts.find(c => c.id === 'svc.dep');
    expect(found?.status).toBe('deprecated');
  });

  it('prevents removal when breaking upstream consumers exist', () => {
    const dir = setupTestDir('remove-blocked');
    writeContractsYaml(dir, [makeContract({ id: 'svc.core', upstream: ['svc.web'] })]);

    const result = removeContract(dir, 'svc.core');
    expect(result.success).toBe(false);
    expect(result.message).toContain('upstream');
  });

  it('allows removal when no upstream consumers', () => {
    const dir = setupTestDir('remove-ok');
    writeContractsYaml(dir, [makeContract({ id: 'svc.standalone', upstream: [] })]);

    const result = removeContract(dir, 'svc.standalone');
    expect(result.success).toBe(true);

    const registry = loadAllContracts(dir);
    expect(registry.contracts.find(c => c.id === 'svc.standalone')).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Audit Log Tests
// ════════════════════════════════════════════════════════════════════

describe('Contract Audit Log', () => {
  afterAll(cleanup);

  it('appends entries to audit log', () => {
    const dir = setupTestDir('audit-write');
    const entry: ContractAuditEntry = {
      timestamp: new Date().toISOString(),
      actor: 'test',
      action: 'create',
      contract_id: 'svc.audit',
      details: 'Test entry',
    };

    appendContractAuditLog(dir, entry);
    const entries = readAuditLog(dir);

    expect(entries.length).toBe(1);
    expect(entries[0].contract_id).toBe('svc.audit');
    expect(entries[0].action).toBe('create');
  });

  it('returns empty array when no audit log exists', () => {
    const dir = setupTestDir('audit-empty');
    const entries = readAuditLog(dir);
    expect(entries).toEqual([]);
  });

  it('persists audit entries across calls', () => {
    const dir = setupTestDir('audit-multi');
    const actions = ['create', 'update', 'deprecate'] as const;

    for (let i = 0; i < actions.length; i++) {
      appendContractAuditLog(dir, {
        timestamp: new Date().toISOString(),
        actor: 'test',
        action: actions[i],
        contract_id: `svc.${i}`,
        details: `Entry ${i}`,
      });
    }

    const entries = readAuditLog(dir);
    expect(entries.length).toBe(3);
    expect(entries[0].contract_id).toBe('svc.0');
    expect(entries[2].contract_id).toBe('svc.2');
  });
});

// ════════════════════════════════════════════════════════════════════
// BOUNDARY.md Scaffolding Tests
// ════════════════════════════════════════════════════════════════════

describe('BOUNDARY.md Scaffolding', () => {
  afterAll(cleanup);

  it('generates BOUNDARY.md content with correct structure', () => {
    const dir = setupTestDir('scaffold');
    const srcDir = join(dir, 'src', 'core');

    // Write a sample source file
    writeFileSync(join(srcDir, 'index.ts'), `
export function doSomething(): void {}
export interface MyInterface { name: string; }
export class MyClass {}
export const VERSION = '1.0.0';
`, 'utf-8');

    const content = scaffoldBoundary(srcDir);

    expect(content).toContain('# BOUNDARY.md');
    expect(content).toContain('## 对外接口');
    expect(content).toContain('## 依赖声明');
    expect(content).toContain('## 数据契约');
    expect(content).toContain('## 变更日志');
  });

  it('auto-detects exports from source files', () => {
    const dir = setupTestDir('scaffold-exports');
    const srcDir = join(dir, 'src', 'utils');

    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'helpers.ts'), `
export function sum(a: number, b: number): number {}
export interface Config { debug: boolean; }
`, 'utf-8');

    const content = scaffoldBoundary(srcDir);

    expect(content).toContain('sum');
    expect(content).toContain('Config');
  });

  it('writes BOUNDARY.md to disk', () => {
    const dir = setupTestDir('scaffold-write');
    const targetDir = join(dir, 'boundary-target');
    mkdirSync(targetDir, { recursive: true });

    const content = scaffoldBoundary(targetDir);
    const filePath = writeBoundary(targetDir, content);

    expect(existsSync(filePath)).toBe(true);
    const written = readFileSync(filePath, 'utf-8');
    expect(written).toContain('# BOUNDARY.md');
  });

  it('handles empty directories gracefully', () => {
    const dir = setupTestDir('scaffold-empty');
    const emptyDir = join(dir, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const content = scaffoldBoundary(emptyDir);
    expect(content).toContain('No public exports detected');
    expect(content).toContain('No imports detected');
  });
});
