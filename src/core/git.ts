/**
 * Unified git command wrapper — safe spawnSync with args array (no shell).
 *
 * All functions return/throw MumuSpecError on failure unless allowFail is set.
 * Windows: strip trailing \r from output lines.
 */
import { spawnSync } from 'node:child_process';
import { MumuSpecError } from './errors.js';

export interface GitResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface GitExecOptions {
  /** Timeout in ms (default 10_000) */
  timeout?: number;
  /** Do not throw on non-zero exit (return result instead) */
  allowFail?: boolean;
}

const DEFAULT_TIMEOUT = 10_000;

/** Normalize CRLF artifacts on Windows */
function normalizeOutput(s: string): string {
  return s.replace(/\r/g, '');
}

/** Execute a git command safely (spawnSync, args array, no shell). */
export function git(cwd: string, args: string[], opts: GitExecOptions = {}): GitResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: opts.timeout ?? DEFAULT_TIMEOUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stdout = normalizeOutput(result.stdout ?? '');
  const stderr = normalizeOutput(result.stderr ?? '');

  if (result.error) {
    throw new MumuSpecError('E-GIT-001', {
      命令: `git ${args.join(' ')}`,
      错误: result.error.message,
    });
  }

  if (result.status !== 0 && !opts.allowFail) {
    throw new MumuSpecError('E-GIT-002', {
      命令: `git ${args.join(' ')}`,
      退出码: String(result.status),
      输出: stderr || stdout,
    });
  }

  return { status: result.status ?? 1, stdout, stderr };
}

/** Current branch name (git branch --show-current); undefined when detached. */
export function getCurrentBranch(cwd: string): string | undefined {
  try {
    const r = git(cwd, ['branch', '--show-current'], { allowFail: true });
    const branch = r.stdout.trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/** Create and switch to a new branch (git checkout -b). */
export function createBranch(cwd: string, name: string): GitResult {
  return git(cwd, ['checkout', '-b', name]);
}

/** Switch to an existing branch (git checkout). */
export function switchBranch(cwd: string, name: string): GitResult {
  return git(cwd, ['checkout', name]);
}

/** True when working tree has no uncommitted changes. */
export function isWorkingTreeClean(cwd: string): boolean {
  try {
    const r = git(cwd, ['status', '--porcelain'], { allowFail: true });
    return r.stdout.trim() === '';
  } catch {
    return false;
  }
}

/** Main branch name: main first, fallback master. */
export function getMainBranch(cwd: string): string {
  for (const candidate of ['main', 'master']) {
    try {
      const r = git(cwd, ['rev-parse', '--verify', '--quiet', candidate], { allowFail: true });
      if (r.status === 0 && r.stdout.trim()) return candidate;
    } catch {
      // continue to next candidate
    }
  }
  throw new MumuSpecError('E-GIT-003', { 说明: '未找到 main/master 分支' });
}

/** Merge branch with --no-ff (git merge --no-ff <branch> -m <msg>). */
export function mergeNoFF(cwd: string, branch: string, message: string): GitResult {
  return git(cwd, ['merge', '--no-ff', branch, '-m', message], { allowFail: true });
}

/** List conflicted files (git diff --name-only --diff-filter=U). */
export function getMergeConflicts(cwd: string): string[] {
  try {
    const r = git(cwd, ['diff', '--name-only', '--diff-filter=U'], { allowFail: true });
    return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Stage all and commit (git add -A && git commit -m). */
export function commitAll(cwd: string, message: string): GitResult {
  git(cwd, ['add', '-A']);
  return git(cwd, ['commit', '-m', message], { allowFail: true });
}

/** Whether a branch exists locally (git rev-parse --verify --quiet). */
export function branchExists(cwd: string, name: string): boolean {
  try {
    const r = git(cwd, ['rev-parse', '--verify', '--quiet', name], { allowFail: true });
    return r.status === 0;
  } catch {
    return false;
  }
}

/** Delete a merged branch (git branch -d, safe: fails when not fully merged). */
export function deleteBranch(cwd: string, name: string): GitResult {
  return git(cwd, ['branch', '-d', name]);
}

/** Current HEAD commit sha (git rev-parse HEAD). */
export function getHeadSha(cwd: string): string {
  const r = git(cwd, ['rev-parse', 'HEAD']);
  return r.stdout.trim();
}

/** Whether the project root is inside a git repository. */
export function isGitRepo(cwd: string): boolean {
  try {
    const r = git(cwd, ['rev-parse', '--is-inside-work-tree'], { allowFail: true });
    return r.status === 0 && r.stdout.trim() === 'true';
  } catch {
    return false;
  }
}
