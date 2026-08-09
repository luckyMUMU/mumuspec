/**
 * Tests for src/core/git.ts — unified git wrapper.
 *
 * Strategy: mock node:child_process spawnSync to assert args (no shell), output
 * parsing, Windows \r cleanup, and failure paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSpawnSync = vi.fn();
vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

// Import after mock registration
import * as git from '../../src/core/git.js';

function mockResult(overrides: Partial<{ stdout: string; stderr: string; status: number; error: Error }>) {
  mockSpawnSync.mockReturnValue({
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
    status: overrides.status ?? 0,
    error: overrides.error ?? undefined,
  });
}

describe('git.ts unified wrapper', () => {
  beforeEach(() => {
    mockSpawnSync.mockReset();
  });

  it('git() passes args array and cwd, no shell option', () => {
    mockResult({ stdout: 'ok\n' });
    const result = git.git('/repo', ['branch', '--show-current']);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['branch', '--show-current'],
      expect.objectContaining({ cwd: '/repo', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('ok\n');
  });

  it('git() strips \r for Windows CRLF output', () => {
    mockResult({ stdout: 'main\r\n', status: 0 });
    const result = git.git('/repo', ['branch', '--show-current']);
    expect(result.stdout).toBe('main\n');
  });

  it('git() throws E-GIT-001 on spawn error', () => {
    mockResult({ error: new Error('git not found') });
    expect(() => git.git('/repo', ['status'])).toThrowError(/E-GIT-001/);
  });

  it('git() throws E-GIT-002 on non-zero exit unless allowFail', () => {
    mockResult({ status: 128, stderr: 'fatal: not a git repository' });
    expect(() => git.git('/repo', ['status'])).toThrowError(/E-GIT-002/);
    const r = git.git('/repo', ['status'], { allowFail: true });
    expect(r.status).toBe(128);
  });

  it('git() supports custom timeout', () => {
    mockResult({ status: 0 });
    git.git('/repo', ['status'], { timeout: 5000 });
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['status'],
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('getCurrentBranch returns trimmed branch, undefined on empty', () => {
    mockResult({ stdout: '  main\r\n' });
    expect(git.getCurrentBranch('/repo')).toBe('main');
    mockResult({ stdout: '' });
    expect(git.getCurrentBranch('/repo')).toBeUndefined();
  });

  it('getCurrentBranch returns undefined when git errors', () => {
    mockResult({ error: new Error('boom') });
    expect(git.getCurrentBranch('/repo')).toBeUndefined();
  });

  it('createBranch / switchBranch issue checkout commands', () => {
    mockResult({ status: 0 });
    git.createBranch('/repo', 'mumuspec/demo');
    expect(mockSpawnSync).toHaveBeenCalledWith('git', ['checkout', '-b', 'mumuspec/demo'], expect.anything());
    git.switchBranch('/repo', 'main');
    expect(mockSpawnSync).toHaveBeenCalledWith('git', ['checkout', 'main'], expect.anything());
  });

  it('isWorkingTreeClean true when porcelain empty, false otherwise', () => {
    mockResult({ stdout: '' });
    expect(git.isWorkingTreeClean('/repo')).toBe(true);
    mockResult({ stdout: ' M file.ts\n' });
    expect(git.isWorkingTreeClean('/repo')).toBe(false);
    mockResult({ error: new Error('boom') });
    expect(git.isWorkingTreeClean('/repo')).toBe(false);
  });

  it('getMainBranch prefers main, falls back to master', () => {
    mockResult({ status: 0, stdout: 'abc123' });
    expect(git.getMainBranch('/repo')).toBe('main');
    // main missing (non-zero), master exists
    mockSpawnSync
      .mockReturnValueOnce({ status: 128, stdout: '', stderr: 'unknown revision' })
      .mockReturnValueOnce({ status: 0, stdout: 'def456' });
    expect(git.getMainBranch('/repo')).toBe('master');
    // neither exists
    mockSpawnSync.mockReturnValue({ status: 128, stdout: '', stderr: '' });
    expect(() => git.getMainBranch('/repo')).toThrowError(/E-GIT-003/);
  });

  it('mergeNoFF uses --no-ff with message, allowFail', () => {
    mockResult({ status: 0, stdout: '' });
    const r = git.mergeNoFF('/repo', 'mumuspec/demo', 'Merge change demo');
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'git',
      ['merge', '--no-ff', 'mumuspec/demo', '-m', 'Merge change demo'],
      expect.anything(),
    );
    expect(r.status).toBe(0);
  });

  it('getMergeConflicts parses conflicted files', () => {
    mockResult({ stdout: 'a.ts\nb.ts\r\n' });
    expect(git.getMergeConflicts('/repo')).toEqual(['a.ts', 'b.ts']);
    mockResult({ error: new Error('boom') });
    expect(git.getMergeConflicts('/repo')).toEqual([]);
  });

  it('commitAll stages all then commits', () => {
    mockResult({ status: 0 });
    git.commitAll('/repo', 'feat: x');
    expect(mockSpawnSync).toHaveBeenNthCalledWith(1, 'git', ['add', '-A'], expect.anything());
    expect(mockSpawnSync).toHaveBeenNthCalledWith(2, 'git', ['commit', '-m', 'feat: x'], expect.anything());
  });

  it('branchExists true on status 0, false on failure', () => {
    mockResult({ status: 0, stdout: 'abc' });
    expect(git.branchExists('/repo', 'mumuspec/demo')).toBe(true);
    mockResult({ status: 128, stdout: '' });
    expect(git.branchExists('/repo', 'nope')).toBe(false);
    mockResult({ error: new Error('boom') });
    expect(git.branchExists('/repo', 'nope')).toBe(false);
  });

  it('deleteBranch issues branch -d (safe, only merged)', () => {
    mockResult({ status: 0 });
    git.deleteBranch('/repo', 'mumuspec/demo');
    expect(mockSpawnSync).toHaveBeenCalledWith('git', ['branch', '-d', 'mumuspec/demo'], expect.anything());
  });

  it('getHeadSha returns trimmed sha', () => {
    mockResult({ stdout: 'abc123\n' });
    expect(git.getHeadSha('/repo')).toBe('abc123');
  });

  it('isGitRepo true/false', () => {
    mockResult({ status: 0, stdout: 'true' });
    expect(git.isGitRepo('/repo')).toBe(true);
    mockResult({ status: 0, stdout: 'false' });
    expect(git.isGitRepo('/repo')).toBe(false);
    mockResult({ error: new Error('boom') });
    expect(git.isGitRepo('/repo')).toBe(false);
  });
});
