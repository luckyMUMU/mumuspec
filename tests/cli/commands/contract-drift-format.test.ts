/**
 * Integration tests: contract drift CLI with --format flag (TC-STD-06, TC-STD-07).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockDetectDrift = vi.fn();
const mockSarifString = vi.fn(() => '{"version":"2.1.0"}');
const mockPmString = vi.fn(() => '{"problems":[]}');

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});
vi.mock('../../../src/contract/validator.js', () => ({
  detectContractDrift: mockDetectDrift,
  validateBoundaries: vi.fn(() => []),
}));
vi.mock('../../../src/contract/manager.js', () => ({
  persistContract: vi.fn(() => ({ success: true, message: 'ok' })),
  readAuditLog: vi.fn(() => []),
  deprecateContract: vi.fn(() => ({ success: true })),
  removeContract: vi.fn(() => ({ success: true })),
  scaffoldBoundary: vi.fn(() => ''),
  writeBoundary: vi.fn(() => '/tmp/BOUNDARY.md'),
}));
vi.mock('../../../src/contract/formatter/sarif.js', () => ({
  toSarifString: mockSarifString,
}));
vi.mock('../../../src/contract/formatter/problem-matcher.js', () => ({
  toProblemMatcherString: mockPmString,
}));
vi.mock('../../../src/change/manager.js', () => ({
  getActiveChange: vi.fn(),
}));
vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: vi.fn(),
}));

const { registerContractCommands } = await import('../../../src/cli/commands/contract.js');

function createProgram(): Command {
  const program = new Command();
  registerContractCommands(program);
  return program;
}

describe('contract drift --format', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error('process.exit: ' + code);
    }) as typeof process.exit);
    mockFindProjectRoot.mockReturnValue('/fake/project');
    mockDetectDrift.mockReturnValue({
      timestamp: '2026-08-09T10:00:00Z',
      total_contracts: 0,
      drift_count: 0,
      drifts: [],
      clean_contracts: [],
      scan_duration_ms: 0,
      has_critical_drifts: false,
    });
  });

  // TC-STD-06
  it('--format sarif outputs SARIF 2.1', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'contract', 'drift', '--format', 'sarif']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('2.1.0');
  });

  // TC-STD-07
  it('--format problem-matcher outputs problem list', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'contract', 'drift', '--format', 'problem-matcher']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('problems');
  });

  it('exits non-zero on critical drifts with sarif format', async () => {
    mockDetectDrift.mockReturnValue({
      timestamp: '2026-08-09T10:00:00Z',
      total_contracts: 1,
      drift_count: 1,
      drifts: [{ type: 'unimplemented', severity: 'ERROR', id: 'D1', contract_id: 'C1', message: 'err' }],
      clean_contracts: [],
      scan_duration_ms: 0,
      has_critical_drifts: true,
    });

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'mumuspec', 'contract', 'drift', '--format', 'sarif']),
    ).rejects.toThrow('process.exit');
  });
});
