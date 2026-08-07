/**
 * Deep tests for contract/manager.ts — full coverage of write-path
 * contract lifecycle operations, audit logging, and BOUNDARY.md scaffolding.
 *
 * Uses vi.mock to isolate node:fs, yaml, contract/loader, and
 * contract/impact-analyzer dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock node:fs ──────────────────────────────────────────────────
const mockExistsSync = vi.fn<(p: string) => boolean>();
const mockWriteFileSync = vi.fn<(p: string, data: string, enc?: string) => void>();
const mockMkdirSync = vi.fn<(p: string, opts?: unknown) => void>();
const mockAppendFileSync = vi.fn<(p: string, data: string, enc?: string) => void>();
const mockReaddirSync = vi.fn<(p: string, opts?: unknown) => unknown>();
const mockRmdirSync = vi.fn<(p: string) => void>();

vi.mock('node:fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
  writeFileSync: (p: string, data: string, enc?: string) => mockWriteFileSync(p, data, enc),
  mkdirSync: (p: string, opts?: unknown) => mockMkdirSync(p, opts),
  appendFileSync: (p: string, data: string, enc?: string) => mockAppendFileSync(p, data, enc),
  readdirSync: (p: string, opts?: unknown) => mockReaddirSync(p, opts),
  rmdirSync: (p: string) => mockRmdirSync(p),
}));

// ── Mock node:path ────────────────────────────────────────────────
const mockJoin = vi.fn<(...parts: string[]) => string>();

vi.mock('node:path', () => ({
  join: (...parts: string[]) => mockJoin(...parts),
}));

// ── Mock yaml ─────────────────────────────────────────────────────
const mockStringifyYaml = vi.fn<(data: unknown) => string>();

vi.mock('yaml', () => ({
  stringify: (data: unknown) => mockStringifyYaml(data),
}));

// ── Mock contract/loader ──────────────────────────────────────────
const mockLoadAllContracts = vi.fn<(p: string) => any>();
const mockInvalidateContractCache = vi.fn<(p: string) => void>();

vi.mock('../../src/contract/loader.js', () => ({
  loadAllContracts: (p: string) => mockLoadAllContracts(p),
  invalidateContractCache: (p: string) => mockInvalidateContractCache(p),
}));

// ── Mock contract/impact-analyzer ─────────────────────────────────
const mockAnalyzeContractImpact = vi.fn<(root: string, id: string, type: string) => any>();

vi.mock('../../src/contract/impact-analyzer.js', () => ({
  analyzeContractImpact: (root: string, id: string, type: string) => mockAnalyzeContractImpact(root, id, type),
}));

// ── Mock core/utils ───────────────────────────────────────────────
const mockReadText = vi.fn<(p: string) => string | undefined>();

vi.mock('../../src/core/utils.js', () => ({
  readText: (p: string) => mockReadText(p),
}));

// Import after mocks
import {
  persistContract,
  deprecateContract,
  removeContract,
  appendContractAuditLog,
  readAuditLog,
  scaffoldBoundary,
  writeBoundary,
} from '../../src/contract/manager.js';

import type { Contract, ContractRegistry } from '../../src/core/types-contract.js';
import type { ContractAuditEntry } from '../../src/contract/manager.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'API-001',
    name: 'Test API Contract',
    category: 'api',
    status: 'active',
    criticality: 'important',
    version: '1.0.0',
    source: 'src/api/handler.ts',
    description: 'A test contract',
    owner: 'test-user',
    upstream: [],
    downstream: [],
    schema: { type: 'object' },
    examples: [],
    ...overrides,
  };
}

function makeRegistry(overrides: Partial<ContractRegistry> = {}): ContractRegistry {
  return {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    contracts: [],
    dependency_graph: {},
    outbound_ids: [],
    inbound_ids: [],
    ...overrides,
  };
}

function resetMocks(): void {
  mockExistsSync.mockReset();
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
  mockAppendFileSync.mockReset();
  mockReaddirSync.mockReset();
  mockRmdirSync.mockReset();
  mockJoin.mockReset();
  mockStringifyYaml.mockReset();
  mockLoadAllContracts.mockReset();
  mockInvalidateContractCache.mockReset();
  mockAnalyzeContractImpact.mockReset();
  mockReadText.mockReset();

  // Default implementations
  mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));
  mockStringifyYaml.mockImplementation((data: unknown) => JSON.stringify(data));
  mockMkdirSync.mockImplementation(() => undefined);
  mockWriteFileSync.mockImplementation(() => undefined);
  mockAppendFileSync.mockImplementation(() => undefined);
  mockRmdirSync.mockImplementation(() => undefined);
}

const emptyRegistry = makeRegistry();

// ── Tests ─────────────────────────────────────────────────────────

describe('persistContract', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should create a new contract that does not exist in registry', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());
    const contract = makeContract();

    const result = persistContract('C:\\project', contract);

    expect(result.success).toBe(true);
    expect(result.auditEntry.action).toBe('create');
    expect(result.auditEntry.contract_id).toBe('API-001');
    expect(mockWriteFileSync).toHaveBeenCalled();
    expect(mockInvalidateContractCache).toHaveBeenCalledWith('C:\\project');
    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('should update an existing contract', () => {
    const contract = makeContract();
    mockLoadAllContracts.mockReturnValue(makeRegistry({ contracts: [contract] }));

    const updated = { ...contract, version: '2.0.0', description: 'Updated' };
    const result = persistContract('C:\\project', updated, { create: false });

    expect(result.success).toBe(true);
    expect(result.auditEntry.action).toBe('update');
    expect(result.auditEntry.details).toContain('v2.0.0');
  });

  it('should add contract to outbound_ids when upstream is non-empty', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());
    const contract = makeContract({ upstream: ['API-002'] });

    const result = persistContract('C:\\project', contract);

    expect(result.success).toBe(true);
    // Verify writeRegistryYaml was called with outbound_ids containing our contract
    const writeCall = mockWriteFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1 as number]);
    expect(writtenData.outbound_ids).toContain('API-001');
  });

  it('should add contract to inbound_ids when downstream is non-empty', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());
    const contract = makeContract({ downstream: ['DB-001'] });

    const result = persistContract('C:\\project', contract);

    expect(result.success).toBe(true);
    const writeCall = mockWriteFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1 as number]);
    expect(writtenData.inbound_ids).toContain('API-001');
  });

  it('should use specified actor for audit entry', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());
    const contract = makeContract();

    const result = persistContract('C:\\project', contract, { actor: 'bot-deployer' });

    expect(result.auditEntry.actor).toBe('bot-deployer');
  });

  it('should handle mkdirSync recursive for contracts directory', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());
    const contract = makeContract();

    persistContract('C:\\project', contract);

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('contracts'),
      { recursive: true },
    );
  });
});

describe('deprecateContract', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should deprecate an existing contract', () => {
    const contract = makeContract({ upstream: ['SRV-001'] });
    mockLoadAllContracts.mockReturnValue(makeRegistry({ contracts: [contract] }));
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'deprecate',
      upstream_impact: [{ id: 'SRV-001', description: 'test', breaking: false, effort: 'small' }],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    const result = deprecateContract('C:\\project', 'API-001', { migrationPath: 'API-002' });

    expect(result.success).toBe(true);
    expect(result.message).toContain('deprecated');
    expect(result.impact).toBeDefined();
  });

  it('should return failure when contract not found', () => {
    mockLoadAllContracts.mockReturnValue(makeRegistry());

    const result = deprecateContract('C:\\project', 'NONEXISTENT');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should set deprecationNote with migration path', () => {
    const contract = makeContract();
    mockLoadAllContracts.mockReturnValue(makeRegistry({ contracts: [contract] }));
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'deprecate',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    const result = deprecateContract('C:\\project', 'API-001', { migrationPath: 'API-002' });

    expect(result.success).toBe(true);
    // The audit log should have been called with deprecate action
    const lastAppendCall = mockAppendFileSync.mock.calls[mockAppendFileSync.mock.calls.length - 1];
    const auditEntry = JSON.parse(lastAppendCall[1 as number]);
    expect(auditEntry.action).toBe('deprecate');
    expect(auditEntry.details).toContain('API-002');
  });

  it('should bypass migration path when not provided', () => {
    const contract = makeContract();
    mockLoadAllContracts.mockReturnValue(makeRegistry({ contracts: [contract] }));
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'deprecate',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    const result = deprecateContract('C:\\project', 'API-001');

    expect(result.success).toBe(true);
    const lastAppendCall = mockAppendFileSync.mock.calls[mockAppendFileSync.mock.calls.length - 1];
    const auditEntry = JSON.parse(lastAppendCall[1 as number]);
    expect(auditEntry.details).toContain('Deprecated contract API-001');
  });
});

describe('removeContract', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should remove contract when no breaking impact', () => {
    const contract = makeContract({ upstream: [], downstream: [] });
    mockLoadAllContracts.mockReturnValue(
      makeRegistry({ contracts: [contract], outbound_ids: [], inbound_ids: [] }),
    );
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'remove',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    const result = removeContract('C:\\project', 'API-001');

    expect(result.success).toBe(true);
    expect(result.message).toContain('removed');
    expect(mockInvalidateContractCache).toHaveBeenCalledWith('C:\\project');
  });

  it('should block removal when breaking upstream consumers exist', () => {
    const contract = makeContract({ upstream: ['SRV-001'] });
    mockLoadAllContracts.mockReturnValue(
      makeRegistry({ contracts: [contract], outbound_ids: ['API-001'] }),
    );
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'remove',
      upstream_impact: [{ id: 'SRV-001', description: 'breaks', breaking: true, effort: 'large' }],
      downstream_impact: [],
      breaking: true,
      risk: 'high',
      mitigations: [],
    });

    const result = removeContract('C:\\project', 'API-001');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Cannot remove');
    expect(result.impact!.breaking).toBe(true);
  });

  it('should return not found for nonexistent contract', () => {
    mockLoadAllContracts.mockReturnValue(
      makeRegistry({ contracts: [makeContract()] }),
    );
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'OTHER',
      change_type: 'remove',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    const result = removeContract('C:\\project', 'OTHER');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should clean dependency_graph on removal', () => {
    const contract = makeContract();
    mockLoadAllContracts.mockReturnValue(
      makeRegistry({
        contracts: [contract],
        dependency_graph: { 'API-001': ['DB-001'], 'DB-001': ['API-001'] },
      }),
    );
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'remove',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    removeContract('C:\\project', 'API-001');

    // Verify write was called with cleaned dependency_graph
    const writeCall = mockWriteFileSync.mock.calls[0];
    const writtenData = JSON.parse(writeCall[1 as number]);
    expect(writtenData.dependency_graph['API-001']).toBeUndefined();
    expect(writtenData.dependency_graph['DB-001']).not.toContain('API-001');
  });

  it('should write delete audit entry on removal', () => {
    const contract = makeContract();
    mockLoadAllContracts.mockReturnValue(makeRegistry({ contracts: [contract] }));
    mockAnalyzeContractImpact.mockReturnValue({
      contract_id: 'API-001',
      change_type: 'remove',
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [],
    });

    removeContract('C:\\project', 'API-001');

    const lastAppendCall = mockAppendFileSync.mock.calls[mockAppendFileSync.mock.calls.length - 1];
    const auditEntry = JSON.parse(lastAppendCall[1 as number]);
    expect(auditEntry.action).toBe('delete');
    expect(auditEntry.contract_id).toBe('API-001');
  });
});

describe('appendContractAuditLog', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should append to existing audit log', () => {
    mockAppendFileSync.mockImplementation(() => undefined);

    const entry: ContractAuditEntry = {
      timestamp: new Date().toISOString(),
      actor: 'test',
      action: 'create',
      contract_id: 'API-001',
      details: 'test create',
    };

    const result = appendContractAuditLog('C:\\project', entry);

    expect(result.success).toBe(true);
    expect(mockAppendFileSync).toHaveBeenCalled();
    const [filePath, data] = mockAppendFileSync.mock.calls[0] as [string, string];
    expect(filePath).toContain('audit.log');
    expect(data).toContain('"action":"create"');
  });

  it('should create file and directory if append fails', () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const entry: ContractAuditEntry = {
      timestamp: new Date().toISOString(),
      actor: 'test',
      action: 'update',
      contract_id: 'API-001',
      details: 'test update',
    };

    const result = appendContractAuditLog('C:\\project', entry);

    // Should fall back to writeFileSync
    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('contracts'),
      { recursive: true },
    );
    expect(mockWriteFileSync).toHaveBeenCalled();
  });

  it('should return false if both append and write fail', () => {
    mockAppendFileSync.mockImplementation(() => {
      throw new Error('fail');
    });
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('fail again');
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const entry: ContractAuditEntry = {
      timestamp: new Date().toISOString(),
      actor: 'test',
      action: 'delete',
      contract_id: 'API-001',
      details: 'test delete',
    };

    const result = appendContractAuditLog('C:\\project', entry);

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('readAuditLog', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should return empty array when audit log does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = readAuditLog('C:\\project');

    expect(result).toEqual([]);
  });

  it('should return empty array when audit log is empty', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('');

    const result = readAuditLog('C:\\project');

    expect(result).toEqual([]);
  });

  it('should parse valid audit log entries', () => {
    mockExistsSync.mockReturnValue(true);
    const entry1 = JSON.stringify({
      timestamp: '2026-01-01T00:00:00Z',
      actor: 'user',
      action: 'create',
      contract_id: 'API-001',
      details: 'created',
    });
    const entry2 = JSON.stringify({
      timestamp: '2026-01-02T00:00:00Z',
      actor: 'user',
      action: 'update',
      contract_id: 'API-001',
      details: 'updated',
    });
    mockReadText.mockReturnValue(entry1 + '\n' + entry2 + '\n');

    const result = readAuditLog('C:\\project');

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('create');
    expect(result[1].action).toBe('update');
  });

  it('should skip corrupted lines in audit log', () => {
    mockExistsSync.mockReturnValue(true);
    const validEntry = JSON.stringify({
      timestamp: '2026-01-01T00:00:00Z',
      actor: 'user',
      action: 'create',
      contract_id: 'API-001',
      details: 'created',
    });
    mockReadText.mockReturnValue(validEntry + '\n{bad json}\n');

    const result = readAuditLog('C:\\project');

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('create');
  });

  it('should skip blank lines', () => {
    mockExistsSync.mockReturnValue(true);
    const entry = JSON.stringify({
      timestamp: '2026-01-01T00:00:00Z',
      actor: 'user',
      action: 'create',
      contract_id: 'API-001',
      details: 'created',
    });
    mockReadText.mockReturnValue(entry + '\n\n   \n');

    const result = readAuditLog('C:\\project');

    expect(result).toHaveLength(1);
  });
});

describe('scaffoldBoundary', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should generate BOUNDARY.md content with exports and imports', () => {
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === 'C:\\src') {
        return [
          { name: 'handler.ts', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    mockReadText.mockImplementation((p: string) => {
      if (p.endsWith('handler.ts')) {
        return [
          'import { join } from \'node:path\';',
          'import { readFile } from \'node:fs\';',
          'export function handleRequest(input: string): string { return input; }',
          'export class RequestHandler { process() {} }',
          'export interface IRequest { body: string; }',
          'export type Handler = (req: IRequest) => string;',
          'export const MAX_RETRIES = 3;',
          'export default function defaultHandler() {}',
          'export { foo as bar, baz };',
        ].join('\n');
      }
      return undefined;
    });

    const result = scaffoldBoundary('C:\\src');

    expect(result).toContain('# BOUNDARY.md');
    expect(result).toContain('## 对外接口');
    expect(result).toContain('`handleRequest`');
    expect(result).toContain('`RequestHandler`');
    expect(result).toContain('## 依赖声明');
    expect(result).toContain('`node:path`');
    expect(result).toContain('`node:fs`');
    expect(result).toContain('## 数据契约');
    expect(result).toContain('## 变更日志');
  });

  it('should handle empty directory', () => {
    mockReaddirSync.mockReturnValue([]);
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    const result = scaffoldBoundary('C:\\empty');

    expect(result).toContain('# BOUNDARY.md');
    expect(result).toContain('(No public exports detected');
    expect(result).toContain('(No imports detected)');
  });

  it('should handle directory with no TS/JS files', () => {
    mockReaddirSync.mockImplementation((_p: string, _opts?: unknown) => [
      { name: 'README.md', isDirectory: () => false, isFile: () => true },
    ]);
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    const result = scaffoldBoundary('C:\\docs');

    expect(result).toContain('(No public exports detected');
  });

  it('should deduplicate exports by name', () => {
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === 'C:\\src') {
        return [
          { name: 'a.ts', isDirectory: () => false, isFile: () => true },
          { name: 'b.ts', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    mockReadText.mockReturnValue('export function dup() {}');

    const result = scaffoldBoundary('C:\\src');

    // Count occurrences of `dup` in the output
    const matches = result.match(/`dup`/g) || [];
    expect(matches.length).toBe(1);
  });

  it('should list imports from both regular and side-effect imports', () => {
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === 'C:\\src') {
        return [
          { name: 'mod.ts', isDirectory: () => false, isFile: () => true },
        ];
      }
      return [];
    });
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    mockReadText.mockReturnValue(
      'import { foo } from \'bar\';\nimport \'side-effect\';\nimport * from \'namespaced\';',
    );

    const result = scaffoldBoundary('C:\\src');

    expect(result).toContain('`bar`');
    expect(result).toContain('`side-effect`');
    expect(result).toContain('`namespaced`');
  });
});

describe('writeBoundary', () => {
  beforeEach(resetMocks);
  afterEach(resetMocks);

  it('should write BOUNDARY.md to specified directory', () => {
    mockJoin.mockImplementation((...parts: string[]) => parts.join('\\'));

    const content = '# BOUNDARY.md\n\nTest content.';
    const result = writeBoundary('C:\\src', content);

    expect(result).toContain('BOUNDARY.md');
    expect(mockMkdirSync).toHaveBeenCalledWith('C:\\src', { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('BOUNDARY.md'),
      content,
      'utf-8',
    );
  });
});
