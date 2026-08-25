/**
 * Handler-level tests for contract commands (list, show, register, boundary list/check).
 *
 * Strategy: mock all dependencies, register contract commands, then invoke
 * handlers to test branch logic: filtering, boundary validation, impact analysis.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadAllContracts,
  mockFindAllBoundaryDocuments,
  mockValidateBoundaries,
  mockPersistContract,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadAllContracts: vi.fn(),
  mockFindAllBoundaryDocuments: vi.fn(),
  mockValidateBoundaries: vi.fn(),
  mockPersistContract: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/contract/loader.js', () => ({
  loadAllContracts: mockLoadAllContracts,
  findAllBoundaryDocuments: mockFindAllBoundaryDocuments,
}));

vi.mock('../../../src/contract/validator.js', () => ({
  validateBoundaries: mockValidateBoundaries,
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

function makeContract(overrides: Partial<{ id: string; name: string; category: string; status: string; criticality: string; version: string; source: string; name_full: string; description: string; owner: string; upstream: string[]; downstream: string[] }> = {}) {
  return {
    id: overrides.id ?? 'cont-001',
    name: overrides.name ?? 'Test Contract',
    category: overrides.category ?? 'api',
    status: overrides.status ?? 'active',
    criticality: overrides.criticality ?? 'standard',
    version: overrides.version ?? '1.0.0',
    source: overrides.source ?? 'src/api/handler.ts',
    name_full: overrides.name_full ?? 'Test Contract Full',
    description: overrides.description ?? 'A test contract',
    owner: overrides.owner ?? 'team-a',
    upstream: overrides.upstream ?? [],
    downstream: overrides.downstream ?? [],
    schema: {},
    examples: [],
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('contract command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadAllContracts.mockReturnValue({
      contracts: [makeContract()],
      outbound_ids: ['cont-001'],
      inbound_ids: [],
    });
    mockFindAllBoundaryDocuments.mockReturnValue([]);
    mockValidateBoundaries.mockReturnValue([]);
    mockPersistContract.mockReturnValue({ success: true, message: 'Saved' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── contract list ─────────────────────────────────────

  describe('list handler', () => {
    it('lists all contracts', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 total'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cont-001'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('-> OUT'));
    });

    it('filters by category', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'api-1', category: 'api' }), makeContract({ id: 'db-1', category: 'database' })],
        outbound_ids: ['api-1', 'db-1'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--category', 'api']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('api-1');
      expect(output).not.toContain('db-1');
    });

    it('filters by status', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'c1', status: 'active' }), makeContract({ id: 'c2', status: 'deprecated' })],
        outbound_ids: ['c1', 'c2'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--status', 'active']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('c1');
      expect(output).not.toContain('c2');
    });

    it('filters outbound-only', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'out-1' }), makeContract({ id: 'in-1' })],
        outbound_ids: ['out-1'],
        inbound_ids: ['in-1'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--outbound']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('out-1');
      expect(output).not.toContain('in-1');
    });

    it('filters inbound-only', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'out-1' }), makeContract({ id: 'in-1' })],
        outbound_ids: ['out-1'],
        inbound_ids: ['in-1'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--inbound']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('in-1');
      expect(output).not.toContain('out-1');
    });

    it('shows empty message when no contracts', async () => {
      mockLoadAllContracts.mockReturnValue({ contracts: [], outbound_ids: [], inbound_ids: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No contracts registered'));
    });

    it('outputs JSON with --json flag', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'list', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"contracts"') && call[0].includes('"total"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'list']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('MumuSpec not initialized. Run `mumuspec init` first.');
    });
  });

  // ── contract show ─────────────────────────────────────

  describe('show handler', () => {
    it('shows contract details', async () => {
      const contract = makeContract({ id: 'api-contract', name: 'API v1', owner: 'backend-team' });
      mockLoadAllContracts.mockReturnValue({
        contracts: [contract],
        outbound_ids: ['api-contract'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'api-contract']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Contract: api-contract'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('OUTBOUND'));
    });

    it('exits when contract not found', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'other' })],
        outbound_ids: [],
        inbound_ids: [],
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'nonexistent']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Contract not found: nonexistent');
    });

    it('outputs JSON with --json flag', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'json-test' })],
        outbound_ids: [],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'json-test', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"id": "json-test"')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── contract register ─────────────────────────────────

  describe('register handler', () => {
    it('registers a new contract successfully', async () => {
      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'register',
        '--id', 'new-contract',
        '--name', 'New Contract',
        '--category', 'api',
        '--source', 'src/new.ts',
        '--version', '1.0.0',
      ]);

      expect(mockPersistContract).toHaveBeenCalledWith(
        FAKE_ROOT,
        expect.objectContaining({
          id: 'new-contract',
          name: 'New Contract',
          category: 'api',
          source: 'src/new.ts',
        })
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Contract registered'));
    });

    it('exits when persistContract fails', async () => {
      mockPersistContract.mockReturnValue({ success: false, message: 'Duplicate ID' });

      const program = createProgram();
      await expect(program.parseAsync([
        'node', 'mumuspec', 'contract', 'register',
        '--id', 'dup',
        '--name', 'Dup',
        '--category', 'api',
        '--source', 'src/dup.ts',
      ])).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Failed: Duplicate ID');
    });
  });

  // ── boundary list ──────────────────────────────────────

  describe('boundary list handler', () => {
    it('shows message when no boundary docs found', async () => {
      mockFindAllBoundaryDocuments.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No BOUNDARY.md files found'));
    });

    it('lists boundary documents', async () => {
      mockFindAllBoundaryDocuments.mockReturnValue([
        { dir_path: 'src/api', exports: ['handler', 'router'], dependencies: ['core', 'utils'], data_contracts: [] },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'list']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 found'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('src/api'));
    });

    it('outputs JSON with --json flag', async () => {
      mockFindAllBoundaryDocuments.mockReturnValue([
        { dir_path: 'src/api', exports: ['handler'], dependencies: [], data_contracts: [] },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'list', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"boundaries"')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── boundary check ────────────────────────────────────

  describe('boundary check handler', () => {
    it('reports validation errors', async () => {
      mockValidateBoundaries.mockReturnValue([
        {
          dir_path: 'src/api',
          has_boundary_doc: false,
          errors: [{ code: 'MISSING_DOC', message: 'No BOUNDARY.md' }],
          warnings: [],
        },
      ]);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'check']))
        .rejects.toThrow('process.exit called with code 1');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[MISSING]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 errors'));
    });

    it('reports warnings without errors', async () => {
      mockValidateBoundaries.mockReturnValue([
        {
          dir_path: 'src/api',
          has_boundary_doc: true,
          errors: [],
          warnings: [{ code: 'STALE', doc_path: 'src/api/BOUNDARY.md', message: 'Doc outdated' }],
        },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'check']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Summary: 0 errors, 1 warnings'));
    });
  });
});
