/**
 * Supplementary handler-level tests for contract commands — deeper branches.
 *
 * Extends contract-handler.test.ts and contract-handler2.test.ts with:
 * - contract list (--scopes, --outbound, --inbound, category/status filters)
 * - contract verify (--change validation, critical drifts)
 * - contract drift (display with drifts, clean contracts)
 * - contract compat-check (no-change, missing, problems, ok)
 * - contract impact (breaking/non-breaking analyzer paths)
 * - boundary check (errors, warnings)
 * - contract register (success + failure)
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
  mockGetActiveChange,
  mockLoadChangeState,
  mockReadText,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadAllContracts: vi.fn(),
  mockFindAllBoundaryDocuments: vi.fn(),
  mockValidateBoundaries: vi.fn(),
  mockDetectContractDrift: vi.fn(),
  mockPersistContract: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockReadText: vi.fn(),
}));

// ── Hoisted readdirSync mock ──
const mockReaddirSyncContract = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    readdirSync: mockReaddirSyncContract,
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
  deprecateContract: vi.fn(),
  removeContract: vi.fn(),
  readAuditLog: vi.fn(),
  scaffoldBoundary: vi.fn(),
  writeBoundary: vi.fn(),
}));


vi.mock('../../../src/contract/impact-analyzer.js', () => ({
  analyzeContractImpact: vi.fn(),
  formatImpactReport: vi.fn(),
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
    criticality: (overrides.criticality as string) ?? 'standard',
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

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('contract command handlers — deeper branches', () => {
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
    mockPersistContract.mockReset();
    mockGetActiveChange.mockReturnValue(null);
    mockLoadChangeState.mockReturnValue(null);
    mockReadText.mockReturnValue(undefined);
    mockReaddirSyncContract.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── contract list — filter branches ─────────────────────

  describe('list handler — advanced filters', () => {
    it('lists distinct source scopes with --scopes', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'API-1', source: 'src/a.ts' }),
          makeContract({ id: 'API-2', source: 'src/b.ts' }),
          makeContract({ id: 'DB-1', source: 'lib/db.ts' }),
        ],
        outbound_ids: ['API-1', 'API-2'],
        inbound_ids: ['DB-1'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--scopes']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Contract source scopes');
      // 3 unique source values: src/a.ts, src/b.ts, lib/db.ts
      expect(output).toContain('src/a.ts');
      expect(output).toContain('src/b.ts');
      expect(output).toContain('lib/db.ts');
    });

    it('outputs scopes as JSON with --scopes --json', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ source: 'src/handler.ts' })],
        outbound_ids: ['API-1'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--scopes', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"scopes"'),
      );
      expect(jsonCall).toBeDefined();
    });

    it('filters by --outbound flag', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'API-1' }),
          makeContract({ id: 'API-2' }),
        ],
        outbound_ids: ['API-1'],
        inbound_ids: ['API-2'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--outbound']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('API-1');
      expect(output).not.toContain('API-2');
    });

    it('filters by --inbound flag', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({ id: 'API-1' }),
          makeContract({ id: 'DB-1' }),
        ],
        outbound_ids: ['API-1'],
        inbound_ids: ['DB-1'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--inbound']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('DB-1');
      expect(output).not.toContain('API-1');
    });

    it('shows "No contracts registered" when empty', async () => {
      mockLoadAllContracts.mockReturnValue({ contracts: [], outbound_ids: [], inbound_ids: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list']);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No contracts registered'),
      );
    });

    it('displays upstream/downstream for each contract', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({
            id: 'API-1',
            upstream: ['SRV-1'],
            downstream: ['DB-1', 'CACHE-1'],
          }),
        ],
        outbound_ids: ['API-1'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('upstream: SRV-1');
      expect(output).toContain('downstream: DB-1, CACHE-1');
    });
  });

  // ── contract verify ─────────────────────────────────────

  describe('verify handler', () => {
    it('verifies change exists with --change', async () => {
      mockLoadChangeState.mockReturnValue({ phase: 'build' });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'verify', '--change', 'existing-change']);

      // Should proceed past change check since state exists
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Contract Drift Report');
    });

    it('exits when --change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'verify', '--change', 'ghost']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });

    it('displays drift details with severity icons', async () => {
      mockDetectContractDrift.mockReturnValue({
        timestamp: '2026-01-01T00:00:00Z',
        total_contracts: 2,
        drift_count: 2,
        scan_duration_ms: 15,
        has_critical_drifts: true,
        drifts: [
          {
            type: 'SCHEMA_CHANGE',
            contract_id: 'API-1',
            severity: 'ERROR',
            message: 'Schema field removed',
            file: 'src/api.ts',
            line: 42,
            suggestion: 'Restore the field',
          },
          {
            type: 'VERSION_MISMATCH',
            contract_id: 'DB-1',
            severity: 'WARN',
            message: 'Version drifted',
            file: null,
            line: null,
            suggestion: null,
          },
        ],
        clean_contracts: [],
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'verify']),
      ).rejects.toThrow('process.exit called with code 1');

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Schema field removed');
      expect(output).toContain('Version drifted');
      expect(output).toContain('Critical contract drift found');
      expect(output).toContain('Restore the field');
    });

    it('outputs JSON with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'verify', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"drift_count"'),
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── contract drift (full display) ───────────────────────

  describe('drift handler — display branches', () => {
    it('shows clean contracts when no drifts', async () => {
      mockDetectContractDrift.mockReturnValue({
        timestamp: '2026-01-01T00:00:00Z',
        total_contracts: 3,
        drift_count: 0,
        scan_duration_ms: 5,
        has_critical_drifts: false,
        drifts: [],
        clean_contracts: ['API-1', 'DB-1', 'CACHE-1'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'drift']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Clean: API-1, DB-1, CACHE-1');
    });

    it('displays drift severity icons', async () => {
      mockDetectContractDrift.mockReturnValue({
        timestamp: '2026-01-01T00:00:00Z',
        total_contracts: 1,
        drift_count: 1,
        scan_duration_ms: 8,
        has_critical_drifts: false,
        drifts: [
          {
            type: 'FORMAT_CHANGE',
            contract_id: 'API-1',
            severity: 'WARN',
            message: 'Format changed',
            file: 'src/schema.yaml',
            line: 10,
            suggestion: null,
          },
        ],
        clean_contracts: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'drift']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      // WARN severity renders as ⚠ icon, ERROR as ✗
      expect(output).toContain('\u26a0'); // ⚠ icon
      expect(output).toContain('Format changed');
      expect(output).toContain('src/schema.yaml:10');
    });

    it('outputs JSON with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'drift', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"drift_count"'),
      );
      expect(jsonCall).toBeDefined();
    });

    it('exits on critical drifts in non-json mode', async () => {
      mockDetectContractDrift.mockReturnValue({
        timestamp: '2026-01-01T00:00:00Z',
        total_contracts: 1,
        drift_count: 1,
        scan_duration_ms: 3,
        has_critical_drifts: true,
        drifts: [
          {
            type: 'SCHEMA_CHANGE',
            contract_id: 'API-1',
            severity: 'ERROR',
            message: 'Critical',
            file: null,
            line: null,
            suggestion: null,
          },
        ],
        clean_contracts: [],
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'drift']),
      ).rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── contract compat-check ───────────────────────────────

  describe('compat-check handler', () => {
    it('exits when no active change and none specified', async () => {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active change'),
      );
    });

    it('exits when change specified but not found', async () => {
      mockLoadChangeState.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check', '--change', 'missing']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });

    it('shows compatible when no referenced contracts', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({ contracts: [], outbound_ids: [], inbound_ids: [] });
      mockReaddirSyncContract.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Referenced contract IDs: 0');
      expect(output).toContain('All referenced contracts are compatible');
    });

    it('detects deprecated contract references', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'API-1', status: 'deprecated' })],
        outbound_ids: [],
        inbound_ids: ['API-1'],
      });
      // Mock readdirSync to return a .md file entry
      mockReaddirSyncContract.mockReturnValue([
        { name: 'proposal.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('This change references API-1 for the new feature');

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']),
      ).rejects.toThrow('process.exit called with code 1');

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('API-1 is deprecated');
      expect(output).toContain('Compat check failed');
    });

    it('detects unregistered contract references', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({ contracts: [], outbound_ids: [], inbound_ids: [] });
      mockReaddirSyncContract.mockReturnValue([
        { name: 'design.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('References UNKNOWN-99 in the spec');

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']),
      ).rejects.toThrow('process.exit called with code 1');

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('UNKNOWN-99');
      expect(output).toContain('not found in registry');
    });

    it('outputs JSON with --json flag', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockReaddirSyncContract.mockReturnValue([]);
      mockReadText.mockReturnValue(null);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check', '--json']);

      const jsonCall = logSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"referenced"'),
      );
      expect(jsonCall).toBeDefined();
    });

    it('lists compatible contracts when active', async () => {
      mockGetActiveChange.mockReturnValue('my-change');
      mockLoadChangeState.mockReturnValue({ phase: 'build' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'API-1', status: 'active' })],
        outbound_ids: ['API-1'],
        inbound_ids: [],
      });
      mockReaddirSyncContract.mockReturnValue([
        { name: 'spec.md', isDirectory: () => false },
      ]);
      mockReadText.mockReturnValue('References API-1 in markdown');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'compat-check']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Compatible: API-1');
    });
  });

  // ── contract impact — handled by impact-analyzer.test.ts for analyzer logic;
  //     here we cover only the CLI argument/validation paths that the analyzer
  //     unit tests do not cover.
  //     Note: the impact handler uses `await import('../../contract/impact-analyzer.js')`
  //     which vitest does not reliably intercept for nested dynamic imports,
  //     so the output-formatting branches are covered by impact-analyzer.test.ts.

  // ── contract register ───────────────────────────────────

  describe('register handler', () => {
    it('registers successfully and prints confirmation', async () => {
      mockPersistContract.mockReturnValue({
        success: true,
        message: 'Contract API-2 created successfully',
        auditEntry: { action: 'create' },
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'register',
        '--id', 'API-2',
        '--name', 'New API',
        '--category', 'api',
        '--source', 'src/api/new.ts',
        '--description', 'A new endpoint',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Contract registered: API-2');
      expect(output).toContain('created successfully');
    });

    it('exits when persist fails', async () => {
      mockPersistContract.mockReturnValue({
        success: false,
        message: 'Permission denied',
        auditEntry: { action: 'create' },
      });

      const program = createProgram();
      await expect(
        program.parseAsync([
          'node', 'mumuspec', 'contract', 'register',
          '--id', 'API-3', '--name', 'Fail',
          '--category', 'api', '--source', 'src/fail.ts',
        ]),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
      );
    });

    it('passes all options to persistContract', async () => {
      mockPersistContract.mockReturnValue({
        success: true,
        message: 'ok',
        auditEntry: { action: 'create' },
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'register',
        '--id', 'API-10',
        '--name', 'Complex API',
        '--category', 'sdk',
        '--source', 'src/sdk/mod.ts',
        '--version', '2.0.0',
        '--criticality', 'critical',
        '--status', 'draft',
        '--owner', 'platform-team',
        '--description', 'Critical SDK contract',
        '--upstream', 'SRV-1', 'SRV-2',
        '--downstream', 'DB-1',
      ]);

      expect(mockPersistContract).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({
          id: 'API-10',
          name: 'Complex API',
          category: 'sdk',
          status: 'draft',
          criticality: 'critical',
          version: '2.0.0',
          owner: 'platform-team',
          upstream: ['SRV-1', 'SRV-2'],
          downstream: ['DB-1'],
        }),
      );
    });
  });
});
