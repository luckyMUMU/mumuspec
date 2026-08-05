/**
 * Contract Layer — Loader and Validator Tests
 *
 * Tests the contract registry loading, boundary parsing, and drift detection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  loadAllContracts,
  loadContractRegistry,
  findContract,
  getOutboundContracts,
  getInboundContracts,
  loadBoundaryDocument,
  findAllBoundaryDocuments,
  discoverContractDirs,
} from '../src/contract/loader.js';
import {
  detectContractDrift,
  validateBoundaries,
} from '../src/contract/validator.js';

const TEST_DIR = join(tmpdir(), 'mumuspec-contract-test-' + Date.now());

function setupTestDir(): string {
  const dir = join(TEST_DIR, 'project-' + Math.random().toString(36).slice(2));
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

const SAMPLE_CONTRACTS_YAML = `version: "1.0.0"
last_updated: "2026-08-02T00:00:00Z"
contracts:
  - id: "API-SPEC-001"
    name: "REST API User Endpoint"
    category: api
    status: active
    criticality: critical
    version: "1.0.0"
    source: "src/core/api.ts"
    description: "User CRUD API endpoint contract"
    owner: "backend-team"
    upstream: ["WEB-001"]
    downstream: ["DB-MODEL-001"]
    schema:
      method: "POST"
      path: "/api/users"
      response_type: "User"
    examples:
      - '{"id": "u1", "name": "Test User"}'
  - id: "DB-MODEL-001"
    name: "User Table Schema"
    category: database
    status: active
    criticality: important
    version: "1.2.0"
    source: "src/core/models.ts"
    description: "User table database schema"
    upstream: ["API-SPEC-001"]
    downstream: []
    schema:
      table: "users"
      columns: ["id", "name", "email", "created_at"]
  - id: "DEPRECATED-PROTOCOL"
    name: "Old Message Protocol"
    category: messaging
    status: deprecated
    criticality: important
    version: "0.9.0"
    source: "src/core/old-protocol.ts"
    description: "Legacy message format, replaced by v2"
    upstream: ["LEGACY-001"]
    downstream: []
    migrationPath: "Use NEW-PROTOCOL-002 instead"
    schema:
outbound_ids:
  - "API-SPEC-001"
inbound_ids:
  - "DB-MODEL-001"
`;

const SAMPLE_BOUNDARY_MD = `# BOUNDARY.md

## 对外接口

- \`loadAllContracts(root: string)\`: Load all contracts from project
- \`loadContractRegistry(dirPath: string)\`: Load single registry file
- \`detectContractDrift(projectRoot: string)\`: Drift detection

## 依赖声明

- \`yaml\` - YAML parser for contract files
- \`node:fs\` - File system operations
- \`node:path\` - Path resolution utilities

## 数据契约

- \`ContractRegistry\`: JSON/YAML contract collection
- \`BoundaryDocument\`: Parsed BOUNDARY.md content

## 变更日志

- 2026-08-02: Initial Contract Layer implementation (BREAKING)
- 2026-08-01: Contract Layer design finalized
`;

describe('Contract Loader', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = setupTestDir();
    writeFileSync(
      join(projectDir, '.mumuspec', 'contracts', 'contracts.yaml'),
      SAMPLE_CONTRACTS_YAML,
    );
    writeFileSync(join(projectDir, 'src', 'core', 'models.ts'), 'export interface User { id: string; name: string; }');
    writeFileSync(join(projectDir, 'BOUNDARY.md'), SAMPLE_BOUNDARY_MD);
  });

  afterAll(() => {
    cleanup();
  });

  it('should load all contracts from project', () => {
    const registry = loadAllContracts(projectDir);
    expect(registry.contracts).toHaveLength(3);
    expect(registry.outbound_ids).toContain('API-SPEC-001');
    expect(registry.inbound_ids).toContain('DB-MODEL-001');
  });

  it('should load a single contract registry', () => {
    const dir = join(projectDir, '.mumuspec', 'contracts');
    const registry = loadContractRegistry(dir);
    expect(registry).not.toBeNull();
    expect(registry!.contracts).toHaveLength(3);
  });

  it('should find a contract by ID', () => {
    const contract = findContract(projectDir, 'API-SPEC-001');
    expect(contract).not.toBeNull();
    expect(contract!.name).toBe('REST API User Endpoint');
    expect(contract!.category).toBe('api');
  });

  it('should return null for non-existent contract ID', () => {
    const contract = findContract(projectDir, 'NON-EXISTENT');
    expect(contract).toBeNull();
  });

  it('should filter outbound contracts', () => {
    const outbound = getOutboundContracts(projectDir);
    expect(outbound).toHaveLength(1);
    expect(outbound[0].id).toBe('API-SPEC-001');
  });

  it('should filter inbound contracts', () => {
    const inbound = getInboundContracts(projectDir);
    expect(inbound).toHaveLength(1);
    expect(inbound[0].id).toBe('DB-MODEL-001');
  });

  it('should discover contract directories', () => {
    const dirs = discoverContractDirs(projectDir);
    expect(dirs).toHaveLength(1);
    expect(dirs[0]).toContain('.mumuspec');
    expect(dirs[0]).toContain('contracts');
  });
});

describe('Boundary Document Loader', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = setupTestDir();
    writeFileSync(join(projectDir, 'BOUNDARY.md'), SAMPLE_BOUNDARY_MD);
  });

  afterAll(() => {
    cleanup();
  });

  it('should load and parse BOUNDARY.md', () => {
    const doc = loadBoundaryDocument(projectDir);
    expect(doc).not.toBeNull();
    expect(doc!.exports.length).toBeGreaterThanOrEqual(3);
    expect(doc!.dependencies.length).toBeGreaterThanOrEqual(3);
    expect(doc!.change_log.length).toBe(2);
  });

  it('should detect BREAKING changes in change log', () => {
    const doc = loadBoundaryDocument(projectDir);
    expect(doc).not.toBeNull();
    const breakingChanges = doc!.change_log.filter((e) => e.breaking);
    expect(breakingChanges.length).toBeGreaterThanOrEqual(1);
  });

  it('should find all boundary documents', () => {
    const docs = findAllBoundaryDocuments(projectDir);
    expect(docs).toHaveLength(1);
    expect(docs[0].dir_path).toBe(projectDir);
  });
});

describe('Contract Drift Detection', () => {
  let projectDir: string;

  beforeAll(() => {
    projectDir = setupTestDir();
    writeFileSync(
      join(projectDir, '.mumuspec', 'contracts', 'contracts.yaml'),
      SAMPLE_CONTRACTS_YAML,
    );
    writeFileSync(join(projectDir, 'src', 'core', 'models.ts'), 'export interface User {}');
  });

  afterAll(() => {
    cleanup();
  });

  it('should detect missing source file as drift', () => {
    const report = detectContractDrift(projectDir);
    const missingSourceDrifts = report.drifts.filter((d: { type: string }) => d.type === 'unimplemented');
    expect(missingSourceDrifts.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect deprecated contract still in use', () => {
    const report = detectContractDrift(projectDir);
    const deprecatedDrifts = report.drifts.filter((d: { type: string }) => d.type === 'deprecated_in_use');
    const depContract = deprecatedDrifts.find((d: { contract_id: string }) => d.contract_id === 'DEPRECATED-PROTOCOL');
    expect(depContract).toBeDefined();
  });

  it('should include report metadata', () => {
    const report = detectContractDrift(projectDir);
    expect(report.total_contracts).toBe(3);
    expect(report.timestamp).toBeDefined();
    expect(report.scan_duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe('Contract Error Codes', () => {
  it('should have E-CONTRACT-001 through E-CONTRACT-009 defined', async () => {
    const { ERROR_CODES } = await import('../src/core/errors.js');
    expect(ERROR_CODES['E-CONTRACT-001']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-002']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-003']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-004']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-005']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-006']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-007']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-008']).toBeDefined();
    expect(ERROR_CODES['E-CONTRACT-009']).toBeDefined();
  });

  it('should have correct severity for critical errors', async () => {
    const { ERROR_CODES } = await import('../src/core/errors.js');
    expect(ERROR_CODES['E-CONTRACT-002'].severity).toBe('ERROR');
    expect(ERROR_CODES['E-CONTRACT-005'].severity).toBe('ERROR');
    expect(ERROR_CODES['E-CONTRACT-009'].severity).toBe('ERROR');
  });
});

describe('validateBoundaries', () => {
  afterAll(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('should detect missing BOUNDARY.md in directory with code', () => {
    const dir = join(TEST_DIR, 'noboundary-' + Math.random().toString(36).slice(2));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), 'export function foo() {}\n', 'utf-8');
    mkdirSync(join(dir, '.mumuspec', 'contracts'), { recursive: true });

    const results = validateBoundaries(dir);
    const srcResult = results.find(r => r.dir_path.endsWith('src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(false);
    expect(srcResult!.errors.some(e => e.code === 'E-CONTRACT-001')).toBe(true);
  });

  it('should detect exports declared in BOUNDARY.md not found in code', () => {
    const dir = join(TEST_DIR, 'export-mismatch-' + Math.random().toString(36).slice(2));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), '\n', 'utf-8');
    writeFileSync(join(dir, 'src', 'BOUNDARY.md'),
      '# BOUNDARY.md\n## 对外接口\n- `doesNotExist(): void`\n', 'utf-8');
    mkdirSync(join(dir, '.mumuspec', 'contracts'), { recursive: true });

    const results = validateBoundaries(dir);
    const srcResult = results.find(r => r.dir_path.endsWith('src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    expect(srcResult!.errors.some(e => e.code === 'E-CONTRACT-002')).toBe(true);
  });

  it('should pass validation when boundary doc matches code', () => {
    const dir = join(TEST_DIR, 'clean-' + Math.random().toString(36).slice(2));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), 'export function validFn(): void {}\n', 'utf-8');
    writeFileSync(join(dir, 'src', 'BOUNDARY.md'),
      '# BOUNDARY.md\n## 对外接口\n- `validFn(): void`: A valid function\n## 依赖声明\n## 数据契约\n## 变更日志\n- 2026-01-01: Initial\n', 'utf-8');
    mkdirSync(join(dir, '.mumuspec', 'contracts'), { recursive: true });

    const results = validateBoundaries(dir);
    const srcResult = results.find(r => r.dir_path.endsWith('src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    expect(srcResult!.errors.filter(e => e.code === 'E-CONTRACT-002').length).toBe(0);
  });
});
