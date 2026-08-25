/**
 * Handler-level tests for merge command.
 *
 * Strategy: mock branch lifecycle + git + errors, register merge command on a
 * fresh Commander program, invoke via parseAsync().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';

const mocks = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockCheckMergeGate: vi.fn(),
  mockMergeArchivedChange: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
  mockGetMainBranch: vi.fn(),
  mockMumuSpecError: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', () => ({
  findProjectRoot: mocks.mockFindProjectRoot,
}));
vi.mock('../../../src/change/branch.js', () => ({
  checkMergeGate: mocks.mockCheckMergeGate,
  mergeArchivedChange: mocks.mockMergeArchivedChange,
}));
vi.mock('../../../src/core/git.js', () => ({
  getCurrentBranch: mocks.mockGetCurrentBranch,
  getMainBranch: mocks.mockGetMainBranch,
}));
vi.mock('../../../src/core/errors.js', () => ({
  MumuSpecError: class MumuSpecError extends Error {
    code: string;
    context?: Record<string, unknown>;
    constructor(code: string, context?: Record<string, unknown>) {
      super(code);
      this.code = code;
      this.context = context;
    }
  },
}));

// Import after mocks (dynamic import to respect vi.mock hoisting)
const { registerMergeCommand } = await import('../../../src/cli/commands/merge.js');

function createGateResult(passed: boolean, codes: string[] = []) {
  return {
    passed,
    errors: codes.map((code) => ({ code, message: `err:${code}` })),
    warnings: [],
  };
}

async function runMerge(args: string[]) {
  const program = new Command();
  registerMergeCommand(program);
  let exitCode = 0;
  vi.spyOn(process, 'exit').mockImplementation((code?: number | string) => {
    exitCode = Number(code);
    throw new Error(`exit:${code}`);
  });
  try {
    await program.parseAsync(['node', 'test', 'merge', ...args]);
  } catch (e) {
    // process.exit throws; ignore
  }
  return exitCode;
}

describe('merge command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFindProjectRoot.mockReturnValue('/repo');
  });

  it('prints gate errors and exits 1 when gate fails', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(false, ['E-MERGE-002', 'E-MERGE-003']));
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runMerge(['demo']);
    expect(mocks.mockCheckMergeGate).toHaveBeenCalledWith('/repo', 'demo');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('E-MERGE-002'));
    expect(exitCode).toBe(1);
    logSpy.mockRestore();
  });

  it('merges successfully when gate passes', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(true));
    mocks.mockGetCurrentBranch.mockReturnValue('master');
    mocks.mockGetMainBranch.mockReturnValue('master');
    mocks.mockMergeArchivedChange.mockReturnValue('abc123');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runMerge(['demo']);
    expect(mocks.mockMergeArchivedChange).toHaveBeenCalledWith('/repo', 'demo');
    expect(exitCode).toBe(0);
    logSpy.mockRestore();
  });

  it('prints conflict guidance and exits 1 on E-MERGE-010', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(true));
    mocks.mockGetCurrentBranch.mockReturnValue('master');
    mocks.mockGetMainBranch.mockReturnValue('master');
    mocks.mockMergeArchivedChange.mockImplementation(() => {
      const err = new Error('E-MERGE-010');
      (err as any).code = 'E-MERGE-010';
      (err as any).context = { '说明': '冲突' };
      throw err;
    });
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runMerge(['demo']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('冲突'));
    expect(exitCode).toBe(1);
    logSpy.mockRestore();
  });

  it('JSON mode outputs ok result', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(true));
    mocks.mockGetCurrentBranch.mockReturnValue('master');
    mocks.mockGetMainBranch.mockReturnValue('master');
    mocks.mockMergeArchivedChange.mockReturnValue('def456');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await runMerge(['--json', 'demo']);
    const jsonCall = logSpy.mock.calls.find((c) => typeof c[0] === 'string' && c[0].includes('def456'));
    expect(jsonCall).toBeTruthy();
    logSpy.mockRestore();
  });

  it('JSON mode outputs ok=false with errors when gate fails', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(false, ['E-MERGE-002']));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exitCode = await runMerge(['--json', 'demo']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"ok": false'));
    expect(exitCode).toBe(1);
    logSpy.mockRestore();
  });

  it('exits 1 when not in a mumuspec project', async () => {
    mocks.mockFindProjectRoot.mockReturnValue(null);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runMerge(['demo']);
    expect(exitCode).toBe(1);
    errSpy.mockRestore();
  });

  it('warns when on a non-main branch', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(true));
    mocks.mockGetCurrentBranch.mockReturnValue('mumuspec/demo');
    mocks.mockGetMainBranch.mockReturnValue('master');
    mocks.mockMergeArchivedChange.mockReturnValue('abc');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await runMerge(['demo']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('主分支'));
    warnSpy.mockRestore();
  });

  it('exits 1 on unexpected merge failure', async () => {
    mocks.mockCheckMergeGate.mockReturnValue(createGateResult(true));
    mocks.mockGetCurrentBranch.mockReturnValue('master');
    mocks.mockGetMainBranch.mockReturnValue('master');
    mocks.mockMergeArchivedChange.mockImplementation(() => {
      throw new Error('boom');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitCode = await runMerge(['demo']);
    expect(exitCode).toBe(1);
    errSpy.mockRestore();
  });
});
