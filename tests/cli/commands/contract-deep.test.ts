/**
 * Deep branch coverage tests for contract commands.
 *
 * Targets remaining uncovered lines from the coverage report:
 * - Impact handler: happy path (analyzer call, formatImpactReport, breaking/non-breaking, JSON)
 * - Audit handler: JSON output with entries
 * - Deprecate handler: root null path
 * - Remove handler: root null path
 * - Boundary init handler: root null path + target dir argument
 *
 * Strategy: mock all dependencies including impact-analyzer, register contract commands,
 * invoke handlers via Commander parseAsync, assert on console output and exit codes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadAllContracts,
  mockFindAllBoundaryDocuments,
  mockValidateBoundaries,
  mockDetectContractDrift,
  mockPersistContract,
  mockDeprecateContract,
  mockRemoveContract,
  mockReadAuditLog,
  mockScaffoldBoundary,
  mockWriteBoundary,
  mockGetActiveChange,
  mockLoadChangeState,
  mockReadText,
  mockAnalyzeContractImpact,
  mockFormatImpactReport,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadAllContracts: vi.fn(),
  mockFindAllBoundaryDocuments: vi.fn(),
  mockValidateBoundaries: vi.fn(),
  mockDetectContractDrift: vi.fn(),
  mockPersistContract: vi.fn(),
  mockDeprecateContract: vi.fn(),
  mockRemoveContract: vi.fn(),
  mockReadAuditLog: vi.fn(),
  mockScaffoldBoundary: vi.fn(),
  mockWriteBoundary: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockReadText: vi.fn(),
  mockAnalyzeContractImpact: vi.fn(),
  mockFormatImpactReport: vi.fn(),
}));

// ── Hoisted readdirSync mock ──
const mockReaddirSyncDeep = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    readdirSync: mockReaddirSyncDeep,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    getActiveChange: mockGetActiveChange,
  };
});

vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: mockLoadChangeState,
}));

vi.mock('../../../src/contract/loader.js', () => ({
  loadAllContracts: mockLoadAllContracts,
  findAllBoundaryDocuments: mockFindAllBoundaryDocuments,
}));

vi.mock('../../../src/contract/validator.js', () => ({
  validateBoundaries: mockValidateBoundaries,
  detectContractDrift: mockDetectContractDrift,
}));

vi.mock('../../../src/contract/manager.js', () => ({
  persistContract: mockPersistContract,
  deprecateContract: mockDeprecateContract,
  removeContract: mockRemoveContract,
  readAuditLog: mockReadAuditLog,
  scaffoldBoundary: mockScaffoldBoundary,
  writeBoundary: mockWriteBoundary,
}));

vi.mock('../../../src/contract/impact-analyzer.js', () => ({
  analyzeContractImpact: mockAnalyzeContractImpact,
  formatImpactReport: mockFormatImpactReport,
}));

// Import after mocks
const { registerContractCommands } = await import('../../../src/cli/commands/contract.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerContractCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: (overrides.id as string) ?? 'API-1',
    name: (overrides.name as string) ?? 'API Contract',
    category: (overrides.category as string) ?? 'api',
    status: (overrides.status as string) ?? 'active',
    criticality: (overrides.criticality as string) ?? 'critical',
    version: (overrides.version as string) ?? '1.0.0',
    source: (overrides.source as string) ?? 'src/api/handler.ts',
    description: (overrides.description as string) ?? 'Test contract',
    owner: (overrides.owner as string) ?? 'team-a',
    upstream: (overrides.upstream as string[]) ?? [],
    downstream: (overrides.downstream as string[]) ?? [],
    schema: (overrides.schema as object) ?? {},
    examples: (overrides.examples as string[]) ?? [],
    migrationPath: (overrides.migrationPath as string) ?? undefined,
    deprecationNote: (overrides.deprecationNote as string) ?? undefined,
  };
}

// Default minimal impact analysis result
function makeImpactResult(overrides: Record<string, unknown> = {}) {
  return {
    contract_id: (overrides.contract_id as string) ?? 'API-1',
    change_type: (overrides.change_type as 'modify' | 'remove' | 'deprecate') ?? 'modify',
    upstream_impact: (overrides.upstream_impact as Array<{ id: string; description: string; breaking: boolean; effort: string }>) ?? [],
    downstream_impact: (overrides.downstream_impact as Array<{ id: string; description: string; breaking: boolean; effort: string }>) ?? [],
    breaking: (overrides.breaking as boolean) ?? false,
    risk: (overrides.risk as 'low' | 'medium' | 'high') ?? 'low',
    mitigations: (overrides.mitigations as string[]) ?? ['No action needed'],
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('contract command handlers — deep branch coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadAllContracts.mockReturnValue({
      contracts: [makeContract()],
      outbound_ids: ['API-1'],
      inbound_ids: [],
    });
    mockFindAllBoundaryDocuments.mockReturnValue([]);
    mockValidateBoundaries.mockReturnValue([]);
    mockDetectContractDrift.mockReturnValue({
      timestamp: '2026-01-01T00:00:00Z',
      total_contracts: 1,
      drift_count: 0,
      scan_duration_ms: 10,
      has_critical_drifts: false,
      drifts: [],
      clean_contracts: ['API-1'],
    });
    mockPersistContract.mockReturnValue({ success: true, message: 'Saved' });
    mockDeprecateContract.mockReset();
    mockRemoveContract.mockReset();
    mockReadAuditLog.mockReset();
    mockScaffoldBoundary.mockReset();
    mockWriteBoundary.mockReset();
    mockGetActiveChange.mockReturnValue(null);
    mockLoadChangeState.mockReturnValue(null);
    mockReadText.mockReturnValue(undefined);
    mockReaddirSyncDeep.mockReset();
    mockAnalyzeContractImpact.mockReset();
    mockFormatImpactReport.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ════════════════════════════════════════════════════════════════
  // contract impact — validation & root-null branches (lines 459-469)
  // Note: The impact handler uses `await import('../../contract/impact-analyzer.js')`
  // which vitest does not reliably intercept for nested dynamic imports inside
  // Commander action handlers. Therefore we cover the branches reachable BEFORE
  // the dynamic import: root-null (459-461) and invalid change type (467-469).
  // ════════════════════════════════════════════════════════════════

  describe('impact handler — validation branches', () => {
    it('rejects invalid change type "bogus" and exits(1)', async () => {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'API-1', '--change-type=bogus']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid change type'),
      );
    });

    it('rejects uppercase "MODIFY" (case-sensitive) and exits(1)', async () => {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'API-1', '--change-type=MODIFY']),
      ).rejects.toThrow('process.exit called with code 1');
    });

    it('rejects empty string change type and exits(1)', async () => {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'API-1', '--change-type=']),
      ).rejects.toThrow('process.exit called with code 1');
    });

    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'API-1']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });

    it('shows error message lists valid change types', async () => {
      // Verify the error path tells the user what types are valid
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'API-1', '--change-type=foo']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Must be modify, remove, or deprecate'),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract boundary check — root null (lines 419-421)
  // ════════════════════════════════════════════════════════════════

  describe('boundary check handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'check']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract compat-check — root null (lines 176-178)
  // ════════════════════════════════════════════════════════════════

  describe('compat-check handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract drift — root null (lines 255-257)
  // ════════════════════════════════════════════════════════════════

  describe('drift handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'drift']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract register — root null (lines 346-348)
  // ════════════════════════════════════════════════════════════════

  describe('register handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync([
          'node', 'mumuspec', 'contract', 'register',
          '--id', 'R-1', '--name', 'Test', '--category', 'api', '--source', 'src/t.ts',
        ]),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // boundary list — root null (lines 388-390)
  // ════════════════════════════════════════════════════════════════

  describe('boundary list handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'list']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract audit — root null (lines 499-501) and JSON (lines 513-515)
  // ════════════════════════════════════════════════════════════════

  describe('audit handler — JSON and edge cases', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'audit']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
    });
    it('outputs JSON with multiple entries', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: '2026-01-15T10:00:00Z', action: 'register', contract_id: 'API-1', actor: 'user-a', details: 'd1', impact_risk: 'low' as const },
        { timestamp: '2026-01-15T11:00:00Z', action: 'modify', contract_id: 'API-1', actor: 'user-b', details: 'd2', impact_risk: 'medium' as const },
        { timestamp: '2026-01-15T12:00:00Z', action: 'deprecate', contract_id: 'DB-1', actor: 'admin', details: 'd3', impact_risk: 'high' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"total": 3'),
      );
      expect(jsonCall).toBeDefined();
    });

    it('renders medium risk icon correctly', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: 't1', action: 'modify', contract_id: 'c1', actor: 'admin', details: 'd', impact_risk: 'medium' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[MED]');
    });

    it('renders low risk icon correctly', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: 't1', action: 'register', contract_id: 'c1', actor: 'user', details: 'd', impact_risk: 'low' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[LOW]');
    });

    it('renders actor and details for each entry', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: '2026-01-15T10:00:00Z', action: 'register', contract_id: 'NEW-1', actor: 'dev-team', details: 'Created new API contract', impact_risk: 'low' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('dev-team');
      expect(output).toContain('Created new API contract');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract deprecate — root null path (lines 543-545)
  // ════════════════════════════════════════════════════════════════

  describe('deprecate handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync([
          'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
          '--migration-path', 'cont-v2',
        ]),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
      expect(mockDeprecateContract).not.toHaveBeenCalled();
    });

    it('deprecates with high risk and multiple mitigations', async () => {
      mockDeprecateContract.mockReturnValue({
        success: true,
        message: 'Deprecated with high impact',
        impact: {
          risk: 'high',
          mitigations: [
            'Coordinate with all downstream providers',
            'Set a sunset date at least 90 days out',
            'Update consumer documentation',
          ],
        },
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
        '--migration-path', 'cont-v2',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('deprecated successfully');
      expect(output).toContain('high');
      expect(output).toContain('Coordinate with all downstream providers');
      expect(output).toContain('Set a sunset date at least 90 days out');
      expect(output).toContain('Update consumer documentation');
    });

    it('deprecates without impact field', async () => {
      mockDeprecateContract.mockReturnValue({
        success: true,
        message: 'Simple deprecation',
        impact: null,
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
        '--migration-path', 'cont-v2',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('deprecated successfully');
    });

    it('displays mitigations on failure without impact field', async () => {
      mockDeprecateContract.mockReturnValue({
        success: false,
        message: 'Cannot deprecate: contract is already retired',
        impact: null,
      });

      const program = createProgram();
      await expect(
        program.parseAsync([
          'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
          '--migration-path', 'cont-v2',
        ]),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation failed'),
      );
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract remove — root null path (lines 585-587)
  // ════════════════════════════════════════════════════════════════

  describe('remove handler — root null', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
      expect(mockRemoveContract).not.toHaveBeenCalled();
    });

    it('removes contract with upstream impact detail on failure', async () => {
      mockRemoveContract.mockReturnValue({
        success: false,
        message: 'Blocked: contract has 3 upstream consumers',
        impact: {
          upstream_impact: [
            { id: 'SRV-1', description: 'Primary service dependency' },
            { id: 'SRV-2', description: 'Secondary service dependency' },
            { id: 'GW-1', description: 'API gateway routes through this contract' },
          ],
          downstream_impact: [],
        },
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001']),
      ).rejects.toThrow('process.exit called with code 1');

      // 'Removal blocked' goes to stderr
      const errorOutput = errorSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(errorOutput).toContain('Removal blocked');
      // Upstream list goes to stdout
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('SRV-1');
      expect(output).toContain('Primary service dependency');
      expect(output).toContain('API gateway routes through this contract');
      expect(output).toContain('Use contract deprecate instead');
    });

    it('outputs JSON with failure result and returns normally', async () => {
      mockRemoveContract.mockReturnValue({
        success: false,
        message: 'Blocked: upstream consumers exist',
        impact: { upstream_impact: [{ id: 'x', description: 'y' }], downstream_impact: [] },
      });

      const program = createProgram();
      // In JSON mode, remove does NOT call process.exit(1); it just logs and returns
      await program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"success": false'),
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // boundary init — root null and target dir (lines 623-625 + dir arg)
  // ════════════════════════════════════════════════════════════════

  describe('boundary init handler — root null and target dir', () => {
    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        'MumuSpec not initialized. Run `mumuspec init` first.',
      );
      expect(mockScaffoldBoundary).not.toHaveBeenCalled();
    });

    it('exits when not in project root even with dir argument', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init', 'src/api']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(mockScaffoldBoundary).not.toHaveBeenCalled();
    });

    it('creates boundary at a specific sub-directory', async () => {
      mockScaffoldBoundary.mockReturnValue('# BOUNDARY.md for src/api\nExports: handler\n');
      mockWriteBoundary.mockReturnValue('/fake/project/src/api/BOUNDARY.md');

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'boundary', 'init', 'src/api',
      ]);

      expect(mockScaffoldBoundary).toHaveBeenCalled();
      expect(mockWriteBoundary).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('BOUNDARY.md generated');
    });

    it('shows dry-run JSON without dir argument', async () => {
      mockScaffoldBoundary.mockReturnValue('# dry content no dir');

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'boundary', 'init', '--dry-run', '--json',
      ]);

      expect(mockWriteBoundary).not.toHaveBeenCalled();
      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"content"'),
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract compat-check — retired status and edge cases
  // ════════════════════════════════════════════════════════════════

  describe('compat-check handler — retired edge cases', () => {
    it('detects retired contract references as problems', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'OLD-1', status: 'retired' })],
        outbound_ids: [],
        inbound_ids: ['OLD-1'],
      });
      mockReaddirSyncDeep.mockReturnValue([
        { name: 'proposal.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('This references OLD-1 which is retired');

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']),
      ).rejects.toThrow('process.exit called with code 1');

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('OLD-1');
      expect(output).toContain('is retired');
      expect(output).toContain('Compat check failed');
    });

    it('shows ok contracts when all active', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'API-1', status: 'active' }),
          makeContract({ id: 'API-2', status: 'active' }),
        ],
        outbound_ids: ['API-1', 'API-2'],
        inbound_ids: [],
      });
      mockReaddirSyncDeep.mockReturnValue([
        { name: 'spec.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('References API-1 and API-2');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Compatible: API-1, API-2');
      expect(output).toContain('All referenced contracts are compatible');
    });

    it('handles readText returning null gracefully', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'API-1', status: 'active' })],
        outbound_ids: ['API-1'],
        inbound_ids: [],
      });
      mockReaddirSyncDeep.mockReturnValue([
        { name: 'doc.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue(null);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Referenced contract IDs: 0');
    });

    it('outputs JSON with problems', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'API-1', status: 'deprecated' })],
        outbound_ids: [],
        inbound_ids: ['API-1'],
      });
      mockReaddirSyncDeep.mockReturnValue([
        { name: 'spec.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('References API-1');

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check', '--json']),
      ).rejects.toThrow('process.exit called with code 1');

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"problems"'),
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract show — JSON with full metadata
  // ════════════════════════════════════════════════════════════════

  describe('show handler — JSON with full metadata', () => {
    it('outputs JSON with all optional fields present', async () => {
      const fullContract = makeContract({
        id: 'FULL-1',
        name: 'Full Contract',
        category: 'sdk',
        status: 'draft',
        criticality: 'critical',
        version: '3.0.0',
        source: 'src/sdk/index.ts',
        description: 'Complete SDK contract',
        owner: 'sdk-team',
      });
      mockLoadAllContracts.mockReturnValue({
        contracts: [fullContract],
        outbound_ids: ['FULL-1'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'FULL-1', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"id": "FULL-1"'),
      );
      expect(jsonCall).toBeDefined();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('"category": "sdk"');
      expect(output).toContain('"status": "draft"');
      expect(output).toContain('"version": "3.0.0"');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract list — deprecated status icon and combined filters
  // ════════════════════════════════════════════════════════════════

  describe('list handler — deprecated icon and combined filters', () => {
    it('shows [deprecated] icon for deprecated contracts', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'API-1', status: 'active' }),
          makeContract({ id: 'API-2', status: 'deprecated' }),
        ],
        outbound_ids: ['API-1', 'API-2'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[active]');
      expect(output).toContain('[deprecated]');
    });

    it('combines category and status filters', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'api-1', category: 'api', status: 'active' }),
          makeContract({ id: 'api-2', category: 'api', status: 'deprecated' }),
          makeContract({ id: 'db-1', category: 'database', status: 'active' }),
        ],
        outbound_ids: ['api-1', 'api-2', 'db-1'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'list', '--category', 'api', '--status', 'active',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('api-1');
      expect(output).not.toContain('api-2');
      expect(output).not.toContain('db-1');
    });

    it('combines inbound filter with status', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'out-1', status: 'active' }),
          makeContract({ id: 'in-1', status: 'deprecated' }),
          makeContract({ id: 'in-2', status: 'active' }),
        ],
        outbound_ids: ['out-1'],
        inbound_ids: ['in-1', 'in-2'],
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'list', '--inbound', '--status', 'active',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('in-2');
      expect(output).not.toContain('in-1');
      expect(output).not.toContain('out-1');
    });
  });

  // ════════════════════════════════════════════════════════════════
  // contract boundary check — mixed results
  // ════════════════════════════════════════════════════════════════

  describe('boundary check handler — mixed results', () => {
    it('shows both doc and missing in single validation run', async () => {
      mockValidateBoundaries.mockReturnValue([
        {
          dir_path: 'src/api',
          has_boundary_doc: true,
          errors: [],
          warnings: [{ code: 'STALE', doc_path: 'src/api/BOUNDARY.md', message: 'Documentation is outdated', severity: 'WARN' as const }],
        },
        {
          dir_path: 'src/core',
          has_boundary_doc: false,
          errors: [{ code: 'MISSING_DOC', message: 'No BOUNDARY.md in directory with public exports', severity: 'ERROR' as const }],
          warnings: [],
        },
      ]);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'check']),
      ).rejects.toThrow('process.exit called with code 1');

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[doc]');
      expect(output).toContain('[MISSING]');
      expect(output).toContain('1 errors, 1 warnings');
    });

    it('outputs JSON for boundary check', async () => {
      mockValidateBoundaries.mockReturnValue([
        {
          dir_path: 'src/utils',
          has_boundary_doc: true,
          errors: [],
          warnings: [],
        },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'check', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"results"'),
      );
      expect(jsonCall).toBeDefined();
    });
  });
});
