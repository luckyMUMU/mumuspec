import { describe, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(() => '/repo'),
  mockCheckMergeGate: vi.fn(() => ({ passed: true, errors: [], warnings: [] })),
  mockMergeArchivedChange: vi.fn(() => 'abc'),
  mockGetCurrentBranch: vi.fn(() => 'master'),
  mockGetMainBranch: vi.fn(() => 'master'),
}));
vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mocks.mockFindProjectRoot };
});
vi.mock('../../../src/change/branch.js', () => ({
  checkMergeGate: mocks.mockCheckMergeGate,
  mergeArchivedChange: mocks.mockMergeArchivedChange,
}));
vi.mock('../../../src/core/git.js', () => ({
  getCurrentBranch: mocks.mockGetCurrentBranch,
  getMainBranch: mocks.mockGetMainBranch,
}));
vi.mock('../../../src/core/errors.js', () => ({
  MumuSpecError: class extends Error { code = ''; context = {}; constructor(code: string, c?: Record<string,unknown>) { super(code); this.code = code; this.context = c ?? {}; } },
}));
import { Command } from 'commander';
const { registerMergeCommand } = await import('../../../src/cli/commands/merge.js');
describe('debug', () => {
  it('full mock', async () => {
    console.log('REGISTER TYPE:', typeof registerMergeCommand);
    const program = new Command();
    registerMergeCommand(program);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try { await program.parseAsync(['node','t','demo']); } catch (e) { console.log('CAUGHT:', (e as Error).message); }
    console.log('FINDER:', mocks.mockFindProjectRoot.mock.calls.length, 'GATE:', mocks.mockCheckMergeGate.mock.calls.length, 'MERGE:', mocks.mockMergeArchivedChange.mock.calls.length);
    spy.mockRestore(); errSpy.mockRestore();
  });
});
