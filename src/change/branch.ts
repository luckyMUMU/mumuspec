/**
 * Branch lifecycle — branch-driven multi-developer workflow.
 *
 * Per-branch single active change, auto branch creation on `mumuspec new`,
 * and archive-gated merge back to the main branch.
 */
import { rmSync } from 'node:fs';
import type { ChangeState } from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { loadConfig } from '../core/config.js';
import { MumuSpecError } from '../core/errors.js';
import { appendAuditLog, getMumuSpecDir, now } from '../core/utils.js';
import {
  getCurrentBranch,
  createBranch,
  switchBranch,
  isWorkingTreeClean,
  getMainBranch,
  mergeNoFF,
  getMergeConflicts,
  commitAll,
  branchExists,
  deleteBranch,
  getHeadSha,
} from '../core/git.js';
import { getChangeDir } from './paths.js';
import { listActiveChanges } from './listing.js';
import { loadChangeState, saveChangeState } from './state.js';
import type { GuardResult } from '../core/types-workflow.js';

/** Compute the branch name for a change: <prefix>/<name> (default "mumuspec/<name>"). */
export function getChangeBranchName(
  _projectRoot: string,
  changeName: string,
  config: MumuSpecConfig,
): string {
  const prefix = config.changes.branch_prefix || 'mumuspec';
  return `${prefix}/${changeName}`;
}

/** Switch to the change branch, creating it if absent (git checkout -b). */
export function ensureChangeBranch(projectRoot: string, changeName: string): void {
  const config = loadConfig(projectRoot);
  const branch = getChangeBranchName(projectRoot, changeName, config);
  if (branchExists(projectRoot, branch)) {
    switchBranch(projectRoot, branch);
    return;
  }
  createBranch(projectRoot, branch);
}

/** Clean up the change directory when branch creation fails. */
export function rollbackChangeCreation(projectRoot: string, changeName: string): void {
  const changeDir = getChangeDir(projectRoot, changeName);
  try {
    rmSync(changeDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Find the active change on a specific branch (per-branch single active).
 * Legacy changes without `branch` field fall back to global-single-active semantics.
 */
export function getActiveChangeOnBranch(
  projectRoot: string,
  branchName: string,
): string | undefined {
  const active = listActiveChanges(projectRoot);
  for (const name of active) {
    const state = loadChangeState(projectRoot, name);
    if (!state) continue;
    if (state.phase === 'archive-completed' || state.phase === 'discarded') continue;
    if (state.branch === branchName) return name;
  }
  // Fallback: if no change records a branch and exactly one active change exists,
  // treat it as the active change for the current branch (legacy data).
  if (active.length === 1) {
    const state = loadChangeState(projectRoot, active[0]);
    if (state && !state.branch) return active[0];
  }
  return undefined;
}

/** Commit all working-tree changes on the change branch and mark branch_status handled. */
export function commitChangeBranch(
  projectRoot: string,
  changeName: string,
  state: ChangeState,
): void {
  if (state.phase === 'discarded' || state.phase === 'archive-completed') return;

  commitAll(projectRoot, `chore(change): commit work for change ${changeName}`);

  state.branch_status = 'handled';
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.branch_commit',
    change: changeName,
    branch: state.branch,
    result: 'success',
  });
}

/** Merge gate: archive is required before merging (10 checks). */
export function checkMergeGate(projectRoot: string, changeName: string): GuardResult {
  const errors: GuardResult['errors'] = [];
  const warnings: GuardResult['warnings'] = [];

  const state = loadChangeState(projectRoot, changeName);
  if (!state) {
    errors.push({ code: 'E-MERGE-001', message: `变更不存在: ${changeName}` });
    return { passed: false, errors, warnings };
  }
  if (state.phase !== 'archive-completed') {
    errors.push({
      code: 'E-MERGE-002',
      message: `变更未归档，无法合并 (当前: ${state.phase})，必须先执行 mumuspec archive`,
    });
  }
  if (state.branch_status !== 'handled') {
    errors.push({
      code: 'E-MERGE-003',
      message: `变更分支代码未提交 (branch_status: ${state.branch_status ?? 'pending'})`,
    });
  }
  if (state.isolation !== 'branch' || !state.branch) {
    errors.push({
      code: 'E-MERGE-004',
      message: `变更不是分支隔离模式 (isolation: ${state.isolation}, branch: ${state.branch ?? '无'})`,
    });
  }

  const currentBranch = getCurrentBranch(projectRoot);
  if (!currentBranch) {
    errors.push({ code: 'E-MERGE-005', message: '无法确定当前分支（可能处于 detached HEAD）' });
  } else if (currentBranch === state.branch) {
    errors.push({
      code: 'E-MERGE-005',
      message: '必须切换到主分支后再合并（当前仍在变更分支上）',
    });
  }

  if (!isWorkingTreeClean(projectRoot)) {
    errors.push({ code: 'E-MERGE-006', message: '当前工作区有未提交改动，请先提交或 stash' });
  }

  if (!state.branch || !branchExists(projectRoot, state.branch)) {
    errors.push({
      code: 'E-MERGE-007',
      message: `变更分支不存在: ${state.branch ?? '无'}`,
    });
  }

  try {
    getMainBranch(projectRoot);
  } catch {
    errors.push({ code: 'E-MERGE-008', message: '未找到 main/master 主分支' });
  }

  return { passed: errors.length === 0, errors, warnings };
}

/** Merge an archived change branch back to the main branch (--no-ff, conflict pause). */
export function mergeArchivedChange(projectRoot: string, changeName: string): string {
  const gate = checkMergeGate(projectRoot, changeName);
  if (!gate.passed) {
    const detail = gate.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n');
    throw new MumuSpecError('E-MERGE-009', { 门禁未通过: `\n${detail}` });
  }

  const state = loadChangeState(projectRoot, changeName);
  if (!state?.branch) throw new MumuSpecError('E-MERGE-009', { 说明: '变更分支信息缺失' });

  const mainBranch = getMainBranch(projectRoot);
  switchBranch(projectRoot, mainBranch);

  const message = `Merge change ${changeName}`;
  const result = mergeNoFF(projectRoot, state.branch, message);

  const conflicts = getMergeConflicts(projectRoot);
  if (result.status !== 0 || conflicts.length > 0) {
    throw new MumuSpecError('E-MERGE-010', {
      说明: '合并发生冲突，请手动解决后重新执行 mumuspec merge',
      冲突文件: conflicts.join(', ') || '(未知)',
    });
  }

  const commitSha = getHeadSha(projectRoot);

  // Update archived state with merge info
  const archivedState = loadChangeState(projectRoot, changeName);
  if (archivedState) {
    archivedState.git_merge = { merged: true, commit_sha: commitSha, strategy: 'no-ff' };
    archivedState.updated_at = now();
    saveChangeState(projectRoot, changeName, archivedState);
  }

  // Safe delete: only merged branches
  try {
    deleteBranch(projectRoot, state.branch);
  } catch {
    // Non-fatal: branch may already be gone
  }

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.merge',
    change: changeName,
    branch: state.branch,
    main_branch: mainBranch,
    commit_sha: commitSha,
    result: 'success',
  });

  return commitSha;
}
