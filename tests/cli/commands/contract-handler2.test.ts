/**
 * Supplementary handler-level tests for contract commands (show branches,
 * impact analysis, deprecate/remove, audit display, boundary init).
 *
 * Strategy: extends contract-handler.test.ts coverage by exercising branches
 * not covered there — show metadata fields, impact error paths, deprecate/remove
 * success and failure, audit filtering, boundary init dry-run and write.
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
  mockDeprecateContract,
  mockRemoveContract,
  mockReadAuditLog,
  mockScaffoldBoundary,
  mockWriteBoundary,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadAllContracts: vi.fn(),
  mockFindAllBoundaryDocuments: vi.fn(),
  mockValidateBoundaries: vi.fn(),
  mockPersistContract: vi.fn(),
  mockDeprecateContract: vi.fn(),
  mockRemoveContract: vi.fn(),
  mockReadAuditLog: vi.fn(),
  mockScaffoldBoundary: vi.fn(),
  mockWriteBoundary: vi.fn(),
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
  deprecateContract: mockDeprecateContract,
  removeContract: mockRemoveContract,
  readAuditLog: mockReadAuditLog,
  scaffoldBoundary: mockScaffoldBoundary,
  writeBoundary: mockWriteBoundary,
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
    id: (overrides.id as string) ?? 'cont-001',
    name: (overrides.name as string) ?? 'Test Contract',
    category: (overrides.category as string) ?? 'api',
    status: (overrides.status as string) ?? 'active',
    criticality: (overrides.criticality as string) ?? 'standard',
    version: (overrides.version as string) ?? '1.0.0',
    source: (overrides.source as string) ?? 'src/api/handler.ts',
    description: (overrides.description as string) ?? 'A test contract',
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

describe('contract command handlers (supplementary)', () => {
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
      outbound_ids: ['cont-001'],
      inbound_ids: [],
    });
    mockFindAllBoundaryDocuments.mockReturnValue([]);
    mockValidateBoundaries.mockReturnValue([]);
    mockPersistContract.mockReturnValue({ success: true, message: 'Saved' });
    mockDeprecateContract.mockReset();
    mockRemoveContract.mockReset();
    mockReadAuditLog.mockReset();
    mockScaffoldBoundary.mockReset();
    mockWriteBoundary.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── contract show: branch coverage ────────────────────

  describe('show handler — metadata branches', () => {
    it('renders INBOUND label when contract is inbound', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [makeContract({ id: 'in-c', status: 'deprecated' })],
        outbound_ids: [],
        inbound_ids: ['in-c'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'in-c']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('INBOUND');
      // show command writes: "Status: deprecated" (no brackets on status label)
      expect(output).toContain('Status:');
      expect(output).toContain('deprecated');
    });

    it('renders owner, upstream, downstream when present', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({
            id: 'meta-c',
            owner: 'platform-team',
            upstream: ['upstream-a'],
            downstream: ['downstream-b', 'downstream-c'],
          }),
        ],
        outbound_ids: ['meta-c'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'meta-c']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('platform-team');
      expect(output).toContain('upstream-a');
      expect(output).toContain('downstream-b, downstream-c');
    });

    it('renders migration path and deprecation note', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({
            id: 'dep-c',
            migrationPath: 'cont-replacement',
            deprecationNote: 'Use cont-replacement instead',
          }),
        ],
        outbound_ids: [],
        inbound_ids: ['dep-c'],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'dep-c']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('Migration:');
      expect(output).toContain('cont-replacement');
      expect(output).toContain('Deprecation:');
      expect(output).toContain('Use cont-replacement instead');
    });

    it('renders examples when available', async () => {
      mockLoadAllContracts.mockReturnValue({
        contracts: [
          makeContract({
            id: 'ex-c',
            examples: ['GET /api/v1/users returns 200', 'POST /api/v1/users returns 201'],
          }),
        ],
        outbound_ids: ['ex-c'],
        inbound_ids: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'ex-c']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('GET /api/v1/users');
      expect(output).toContain('POST /api/v1/users');
    });

    it('shows "(none)" when registry is empty on not-found', async () => {
      mockLoadAllContracts.mockReturnValue({ contracts: [], outbound_ids: [], inbound_ids: [] });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'nope']))
        .rejects.toThrow('process.exit called with code 1');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('(none)'));
    });

    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'show', 'any']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('MumuSpec not initialized. Run `mumuspec init` first.');
    });
  });

  // ── contract impact — error paths ─────────────────────

  describe('impact handler — error paths', () => {
    it('rejects invalid change type and prints error', async () => {
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'cont-001', '--change-type', 'invalid'])
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid change type'));
    });

    it('exits when not in project root', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'cont-001'])
      ).rejects.toThrow('process.exit called with code 1');
    });

    it('validates change type before calling analyzer', async () => {
      // Even with a mock setup, invalid types should fail at validation stage
      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'contract', 'impact', 'cont-001', '--change-type', 'DEPRECATED'])
      ).rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── contract deprecate ─────────────────────────────────

  describe('deprecate handler', () => {
    it('deprecates successfully and prints impact', async () => {
      mockDeprecateContract.mockReturnValue({
        success: true,
        message: 'Deprecated',
        impact: {
          risk: 'medium',
          mitigations: ['Notify downstream teams', 'Set sunset date'],
        },
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
        '--migration-path', 'cont-v2',
      ]);

      expect(mockDeprecateContract).toHaveBeenCalledWith(FAKE_ROOT, 'cont-001', {
        migrationPath: 'cont-v2',
        actor: 'cli-user',
      });
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('deprecated successfully');
      expect(output).toContain('medium');
      expect(output).toContain('Notify downstream teams');
    });

    it('handles failure with impact detail', async () => {
      mockDeprecateContract.mockReturnValue({
        success: false,
        message: 'Cannot deprecate: active upstream consumers',
        impact: {
          risk: 'high',
          mitigations: ['Contact upstream first'],
        },
      });

      const program = createProgram();
      await expect(program.parseAsync([
        'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
        '--migration-path', 'cont-v2',
      ])).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Deprecation failed'));
    });

    it('outputs JSON with --json flag', async () => {
      const result = { success: true, message: 'Done', impact: null };
      mockDeprecateContract.mockReturnValue(result);

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'contract', 'deprecate', 'cont-001',
        '--migration-path', 'cont-v2', '--json',
      ]);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"success": true')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── contract remove ───────────────────────────────────

  describe('remove handler', () => {
    it('removes contract successfully', async () => {
      mockRemoveContract.mockReturnValue({
        success: true,
        message: 'Removed',
        impact: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001']);

      expect(mockRemoveContract).toHaveBeenCalledWith(FAKE_ROOT, 'cont-001', {
        actor: 'cli-user',
      });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('removed successfully'));
    });

    it('blocks removal when upstream consumers exist', async () => {
      mockRemoveContract.mockReturnValue({
        success: false,
        message: 'Blocked: 2 upstream consumers',
        impact: {
          upstream_impact: [
            { id: 'c-a', description: 'depends on cont-001' },
            { id: 'c-b', description: 'also depends on cont-001' },
          ],
          downstream_impact: [],
        },
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Removal blocked'));
    });

    it('outputs JSON with --json flag on success', async () => {
      mockRemoveContract.mockReturnValue({
        success: true,
        message: 'Removed',
        impact: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'remove', 'cont-001', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"success": true')
      );
      expect(jsonCall).toBeDefined();
    });
  });

  // ── contract audit ────────────────────────────────────

  describe('audit handler', () => {
    it('displays audit log entries', async () => {
      mockReadAuditLog.mockReturnValue([
        {
          timestamp: '2026-01-15T10:00:00Z',
          action: 'deprecate',
          contract_id: 'cont-001',
          actor: 'admin',
          details: 'Deprecated cont-001',
          impact_risk: 'medium',
        },
        {
          timestamp: '2026-01-15T11:00:00Z',
          action: 'register',
          contract_id: 'cont-002',
          actor: 'user',
          details: 'Registered new contract',
          impact_risk: 'low',
        },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('2 entries');
      expect(output).toContain('cont-001');
      expect(output).toContain('cont-002');
      expect(output).toContain('[MED]');
      expect(output).toContain('[LOW]');
    });

    it('filters by contract ID', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: 't1', action: 'deprecate', contract_id: 'cont-001', actor: 'admin', details: 'd1', impact_risk: 'high' },
        { timestamp: 't2', action: 'register', contract_id: 'cont-002', actor: 'user', details: 'd2', impact_risk: 'low' },
        { timestamp: 't3', action: 'modify', contract_id: 'cont-001', actor: 'admin', details: 'd3', impact_risk: 'medium' },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit', '--id', 'cont-001']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('cont-001');
      expect(output).not.toContain('cont-002');
      expect(output).toContain('2 entries');
    });

    it('respects --limit option', async () => {
      const entries = Array.from({ length: 50 }, (_, i) => ({
        timestamp: `t${i}`,
        action: 'register',
        contract_id: `c-${i}`,
        actor: 'user',
        details: `entry ${i}`,
        impact_risk: 'low' as const,
      }));
      mockReadAuditLog.mockReturnValue(entries);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit', '--limit', '10']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      // Last 10 entries (c-40 through c-49)
      expect(output).toContain('10 entries');
      expect(output).toContain('c-49');
      expect(output).not.toContain('c-0 entry');
    });

    it('shows empty message when no entries', async () => {
      mockReadAuditLog.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      expect(logSpy).toHaveBeenCalledWith('No audit entries found.');
    });

    it('outputs JSON with --json flag', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: 't1', action: 'register', contract_id: 'c1', actor: 'user', details: 'd', impact_risk: 'low' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"entries"') && call[0].includes('"total"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('renders HIGH risk icon correctly', async () => {
      mockReadAuditLog.mockReturnValue([
        { timestamp: 't1', action: 'remove', contract_id: 'c1', actor: 'admin', details: 'd', impact_risk: 'high' as const },
      ]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'audit']);

      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('[HIGH]');
    });
  });

  // ── boundary init ──────────────────────────────────────

  describe('boundary init handler', () => {
    it('shows dry-run preview without writing', async () => {
      const generatedContent = '# BOUNDARY.md\nExternal: [handler]\n';
      mockScaffoldBoundary.mockReturnValue(generatedContent);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init', '--dry-run']);

      expect(mockScaffoldBoundary).toHaveBeenCalled();
      expect(mockWriteBoundary).not.toHaveBeenCalled();
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('# BOUNDARY.md');
    });

    it('writes BOUNDARY.md when not dry-run', async () => {
      const generatedContent = '# BOUNDARY.md\nExternal: [router]\n';
      mockScaffoldBoundary.mockReturnValue(generatedContent);
      mockWriteBoundary.mockReturnValue('/fake/project/BOUNDARY.md');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init']);

      expect(mockWriteBoundary).toHaveBeenCalled();
      const output = logSpy.mock.calls.map(c => c[0]).join('\n');
      expect(output).toContain('BOUNDARY.md generated');
    });

    it('outputs JSON in dry-run with --json', async () => {
      mockScaffoldBoundary.mockReturnValue('# dry content');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init', '--dry-run', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"content"') && call[0].includes('"directory"')
      );
      expect(jsonCall).toBeDefined();
    });

    it('outputs JSON when writing', async () => {
      mockScaffoldBoundary.mockReturnValue('# content');
      mockWriteBoundary.mockReturnValue('/fake/project/src/api/BOUNDARY.md');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'contract', 'boundary', 'init', '--json']);

      const jsonCall = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"filePath"')
      );
      expect(jsonCall).toBeDefined();
    });
  });
});
