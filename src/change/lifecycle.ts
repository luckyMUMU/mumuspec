/**
 * Change lifecycle — create, discard, escalate, snapshot, build-layers, test-cases.
 */
import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ChangeState, Workflow } from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText, writeText, ensureDir, computeHash, now, appendAuditLog, getMumuSpecDir } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';
import { getCurrentBranch, isGitRepo, hasWorktree, removeWorktree } from '../core/git.js';
import { ensureFeedbackStructure, getChangeFeedbackDir } from '../feedback/manager.js';
import { getChangeDir, getDiscardedDir } from './paths.js';
import { loadChangeState, saveChangeState } from './state.js';
import { getActiveChange } from './listing.js';
import { getActiveChangeOnBranch, getChangeBranchName, ensureChangeBranch, rollbackChangeCreation } from './branch.js';
import { scaffoldChangeSpecs } from '../core/spec-scaffolder.js';

/** Create a new change */
export function createChange(
  projectRoot: string,
  changeName: string,
  workflow: Workflow,
  config: MumuSpecConfig,
  affectedScopes: string[] = [],
  scope?: string,
): ChangeState {
  // Per-branch single active change (branch-driven workflow)
  const isBranchDriven = config.changes?.default_isolation === 'branch';
  const gitRepo = isGitRepo(projectRoot);
  const currentBranch = gitRepo ? getCurrentBranch(projectRoot) : undefined;
  const branchName = isBranchDriven ? getChangeBranchName(projectRoot, changeName, config) : undefined;

  if (isBranchDriven && gitRepo && currentBranch) {
    const activeOnBranch = getActiveChangeOnBranch(projectRoot, currentBranch);
    if (activeOnBranch && config.workflow?.single_active_change !== false) {
      throw new MumuSpecError('E-CHANGE-001', {
        '当前活跃变更': activeOnBranch,
        '当前分支': currentBranch,
        '修复': '完成或 Discard 当前分支上的变更后再创建新变更',
        '提示': '单分支仅允许单一激活变更；如需并行请先合并/归档当前变更',
      });
    }
  } else {
    // Fallback: global single-active check (legacy behavior)
    const active = getActiveChange(projectRoot, scope);
    if (active && config.workflow?.single_active_change !== false) {
      throw new MumuSpecError('E-CHANGE-001', {
        '当前活跃变更': active,
        '作用域': scope || '.',
        '修复': '完成或 Discard 当前变更后再创建新变更',
        '提示': '如需并行变更，可在其他作用域创建变更，或在 config.yaml 设置 workflow.single_active_change: false',
      });
    }
  }

  if (scope && scope !== '.') {
    const validation = validateScope(projectRoot, scope, affectedScopes);
    if (!validation.valid) {
      throw new MumuSpecError('E-CHANGE-008', {
        'scope': scope,
        '超出的路径': validation.overflowPaths.join(', '),
        '修复': '缩减 affected_scopes 到当前作用域子树内，或在父级作用域创建变更',
      });
    }
  }

  const changeDir = getChangeDir(projectRoot, changeName, scope);
  ensureDir(changeDir);

  const state: ChangeState = {
    name: changeName,
    phase: 'open',
    workflow,
    created_at: now(),
    updated_at: now(),
    scope: scope || '.',
    affected_scopes: affectedScopes,
    build_layers: [],
    test_cases: {
      design_locked: false,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: config.changes.default_rollback_limit,
    rebuild_limit: config.changes.default_rebuild_limit,
    build_mode: config.changes.default_build_mode,
    // CHG-5: tdd_mode 由配置 changes.default_tdd_mode 决定（默认 'tdd'，向后兼容）
    tdd_mode: config.changes.default_tdd_mode ?? 'tdd',
    isolation: config.changes.default_isolation,
    branch: branchName,
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    cognitive_framework: {
      enabled: workflow === 'full' && config.cognitive_framework.enabled,
      q1_count: 0,
      q2_pending: 0,
      q3_pending: 0,
      q4_scans_completed: 0,
      converged: false,
      rounds_completed: 0,
    },
    hyperplan_result: {
      triggered: false,
      hard_constraints_merged: true,
      open_questions_resolved: true,
      degraded: false,
    },
    feedback_log: { entries: [], session_links: [] },
  };

  if (workflow === 'hotfix' || workflow === 'tweak' || workflow === 'loop') {
    state.build_layers = [
      { layer: 0, scope: affectedScopes[0] || '.', status: 'pending' as const },
    ];
  }

  // Loop mode: start directly at build phase (skip open/design)
  if (workflow === 'loop') {
    state.phase = 'build';
  }

  saveChangeState(projectRoot, changeName, state, scope);

  // Auto-create the change branch (branch-driven workflow)
  if (isBranchDriven && gitRepo && branchName) {
    try {
      ensureChangeBranch(projectRoot, changeName);
    } catch (e) {
      rollbackChangeCreation(projectRoot, changeName);
      throw new MumuSpecError('E-CHANGE-009', {
        '变更名': changeName,
        '分支': branchName,
        '错误': e instanceof Error ? e.message : String(e),
        '说明': '自动创建分支失败，已回滚变更目录',
      });
    }
  }

  createInitialArtifacts(projectRoot, changeName, workflow, affectedScopes, scope);
  ensureFeedbackStructure(projectRoot);
  ensureDir(getChangeFeedbackDir(projectRoot, changeName));

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.create',
    change: changeName,
    scope: scope || '.',
    branch: branchName,
    result: 'success',
  });

  return state;
}

/** Create initial change artifacts */
function createInitialArtifacts(
  projectRoot: string,
  changeName: string,
  workflow: Workflow,
  affectedScopes: string[],
  scope?: string,
): void {
  const changeDir = getChangeDir(projectRoot, changeName, scope);

  const proposalContent = `# Proposal: ${changeName}

## Why
[描述变更的原因和背景]

## What
[描述变更内容]

## Impact Scope
${affectedScopes.map((s) => `- ${s}`).join('\n') || '- (待确定)'}

## Workflow
${workflow}
`;
  writeText(join(changeDir, 'proposal.md'), proposalContent);
  ensureDir(join(changeDir, 'delta-specs'));
  ensureDir(join(changeDir, 'constraints'));
  writeText(join(changeDir, 'constraints', 'new-shall.md'), '# New SHALL Constraints\n\n');
  writeText(join(changeDir, 'constraints', 'new-shall-not.md'), '# New SHALL NOT Constraints\n\n');
  ensureDir(join(changeDir, 'test-cases'));
  ensureDir(join(changeDir, 'code-graph'));
  writeText(join(changeDir, 'decisions.md'), `# Decision Log: ${changeName}\n\n`);
  ensureDir(join(changeDir, 'snapshots'));

  // Create distributed spec files (prd.md + tech.md) with standard format
  try {
    scaffoldChangeSpecs(changeDir, changeName, {
      parentRoot: projectRoot,
      phase: workflow === 'hotfix' ? 'build' : 'design',
    });
  } catch {
    // Scaffolding is best-effort; don't fail change creation
  }
}

/** Discard a change */
export function discardChange(
  projectRoot: string,
  changeName: string,
  reason: string,
  scope?: string,
): void {
  const state = loadChangeState(projectRoot, changeName, scope);
  if (!state) {
    throw new Error(`Change not found: ${changeName}`);
  }

  if (state.phase === 'archive-completed' || state.phase === 'discarded') {
    throw new MumuSpecError('E-CHANGE-006', {
      '当前phase': state.phase,
      '说明': '终态不可回退',
    });
  }

  const changeDir = getChangeDir(projectRoot, changeName, scope);
  const snapshotDir = join(changeDir, 'snapshots', 'discard');
  ensureDir(snapshotDir);

  // P0-1 Fix: Save original phase for rollback on rename failure
  const originalPhase = state.phase;
  const discardedDir = getDiscardedDir(projectRoot, changeName, scope);

  // Ensure target parent directory exists before rename
  ensureDir(dirname(discardedDir));

  try {
    renameSync(changeDir, discardedDir);
  } catch (err) {
    // Rename failed: do NOT update state.phase to terminal
    // The change remains in its original location and phase
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'user',
      action: 'change.discard',
      change: changeName,
      result: 'failed',
      error: (err as Error).message,
    });
    throw new MumuSpecError('E-CHANGE-010', { cause: (err as Error).message });
  }

  // Only update state AFTER successful rename
  state.phase = 'discarded';
  state.updated_at = now();
  state.rollback_history.push({
    from: originalPhase,
    to: 'discarded',
    reason,
    timestamp: now(),
    counted: false,
    event: 'discard',
  });

  saveChangeState(projectRoot, changeName, state, scope);

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.discard',
    change: changeName,
    result: 'success',
  });

  // Clean up worktree if physical isolation was used (0.20.0+)
  try {
    if (hasWorktree(projectRoot, changeName)) {
      removeWorktree(projectRoot, changeName);
    }
  } catch {
    // Worktree cleanup failure is non-fatal — change is already discarded
  }
}

/** Validate that affected_scopes are within the given scope's subtree. */
export function validateScope(
  _projectRoot: string,
  scope: string,
  affectedScopes: string[],
): { valid: boolean; overflowPaths: string[] } {
  const overflowPaths: string[] = [];
  const scopePrefix = scope === '.' ? '' : scope + '/';

  for (const affected of affectedScopes) {
    if (affected === '.' || affected === '') continue;
    const isSubtree = affected === scope || affected.startsWith(scopePrefix);
    if (!isSubtree) {
      overflowPaths.push(affected);
    }
  }

  return {
    valid: overflowPaths.length === 0,
    overflowPaths,
  };
}

/** Escalate a change from a child scope to its parent scope. */
export function escalateChange(
  projectRoot: string,
  changeName: string,
  fromScope: string,
): string {
  const parentScope = fromScope.includes('/')
    ? fromScope.split('/').slice(0, -1).join('/')
    : '.';

  const fromDir = getChangeDir(projectRoot, changeName, fromScope);
  const toDir = getChangeDir(projectRoot, changeName, parentScope);

  ensureDir(toDir);

  try {
    const entries = readdirSync(fromDir, { withFileTypes: true });
    for (const entry of entries) {
      renameSync(join(fromDir, entry.name), join(toDir, entry.name));
    }
  } catch {
    // Non-fatal
  }

  const state = loadChangeState(projectRoot, changeName, parentScope);
  if (state) {
    state.scope = parentScope;
    state.updated_at = now();
    saveChangeState(projectRoot, changeName, state, parentScope);
  }

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.escalate',
    change: changeName,
    from_scope: fromScope,
    to_scope: parentScope,
    result: 'success',
  });

  return parentScope;
}

/** Save a snapshot of the current change artifacts */
export function saveSnapshot(
  projectRoot: string,
  changeName: string,
  snapshotName: string,
): string {
  const changeDir = getChangeDir(projectRoot, changeName);
  const snapshotDir = join(changeDir, 'snapshots', snapshotName);
  ensureDir(snapshotDir);

  const artifactsToCopy = ['design.md', 'tasks.md', '.mumuspec.yaml', 'suite-map.yaml', 'verify.md'];
  for (const artifact of artifactsToCopy) {
    const src = join(changeDir, artifact);
    if (existsSync(src)) {
      const content = readText(src);
      if (content) {
        writeText(join(snapshotDir, artifact), content);
      }
    }
  }

  return snapshotDir;
}

/** Initialize test-cases for a change */
export function initTestCases(
  projectRoot: string,
  changeName: string,
  layers: number[],
): void {
  const changeDir = getChangeDir(projectRoot, changeName);
  const testCasesDir = join(changeDir, 'test-cases');
  ensureDir(testCasesDir);

  for (const layer of layers) {
    const content = `# Test Cases - Layer ${layer}

## Cases
(Define test cases here)
`;
    writeText(join(testCasesDir, `layer-${layer}-cases.md`), content);
  }
}

/** Compute the current test-cases content hash (read-only, no lock state change) */
export function computeTestCasesHash(
  projectRoot: string,
  changeName: string,
): string {
  const changeDir = getChangeDir(projectRoot, changeName);
  const testCasesDir = join(changeDir, 'test-cases');

  let combinedContent = '';
  if (existsSync(testCasesDir)) {
    const files = readdirSync(testCasesDir).sort();
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = readText(join(testCasesDir, file));
        if (content) {
          combinedContent += file + '\n' + content + '\n';
        }
      }
    }
  }

  return computeHash(combinedContent);
}

/** Lock test cases (compute hash, set design_locked) */
export function lockTestCases(
  projectRoot: string,
  changeName: string,
): string {
  const hash = computeTestCasesHash(projectRoot, changeName);

  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  state.test_cases.design_locked = true;
  state.test_cases.design_content_hash = hash;
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);

  return hash;
}

/** Verify test cases hash */
export function verifyTestCases(
  projectRoot: string,
  changeName: string,
): { valid: boolean; expectedHash?: string; actualHash?: string } {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) return { valid: false };

  if (!state.test_cases.design_locked) return { valid: true };

  const actualHash = computeTestCasesHash(projectRoot, changeName);
  const expectedHash = state.test_cases.design_content_hash;

  return {
    valid: actualHash === expectedHash,
    expectedHash,
    actualHash,
  };
}

/** Initialize build layers for a change */
export function initBuildLayers(
  projectRoot: string,
  changeName: string,
  layers: { layer: number; scope: string }[],
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  state.build_layers = layers.map((l) => ({
    layer: l.layer,
    scope: l.scope,
    status: 'pending' as const,
  }));

  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
}

/** Update a build layer status */
export function updateBuildLayerStatus(
  projectRoot: string,
  changeName: string,
  layer: number,
  status: 'pending' | 'in-progress' | 'done',
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  const layerDef = state.build_layers.find((l) => l.layer === layer);
  if (!layerDef) throw new Error(`Layer ${layer} not found in change ${changeName}`);

  layerDef.status = status;
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
}

/**
 * Lock a single layer's test suite hash (0.20 CLI-first).
 *
 * Replaces the skill-instructed hand-step "compute hash, write suite-map.yaml"
 * with a deterministic command. Writes into `state.test_cases.suites_hash`
 * (keyed by layer number per types-workflow.ts) and marks `suites_locked`
 * once every `test-cases/layer-N-cases.md` file has a locked hash.
 */
export function lockTestSuite(
  projectRoot: string,
  changeName: string,
  layer: number,
): { hash: string; allLocked: boolean; pendingLayers: number[] } {
  const changeDir = getChangeDir(projectRoot, changeName);
  const suitePath = join(changeDir, 'test-cases', `layer-${layer}-cases.md`);
  if (!existsSync(suitePath)) {
    throw new MumuSpecError('E-GUARD-001', {
      message: `Test suite not found: test-cases/layer-${layer}-cases.md (run 'mumuspec test-cases init ${changeName} --layers ${layer}' first)`,
    });
  }

  const hash = computeHash(readText(suitePath) ?? '');

  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  state.test_cases.suites_hash[layer] = hash;
  if (!state.test_cases.suites_locked_layers.includes(layer)) {
    state.test_cases.suites_locked_layers.push(layer);
  }

  // suites_locked = every suite file present on disk has a locked hash
  const testCasesDir = join(changeDir, 'test-cases');
  const suiteLayers = existsSync(testCasesDir)
    ? readdirSync(testCasesDir)
        .map((f) => f.match(/^layer-(\d+)-cases\.md$/))
        .filter((m): m is RegExpMatchArray => !!m)
        .map((m) => parseInt(m[1], 10))
    : [];
  const pendingLayers = suiteLayers.filter((l) => !state.test_cases.suites_locked_layers.includes(l));
  state.test_cases.suites_locked = suiteLayers.length > 0 && pendingLayers.length === 0;
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);

  return { hash, allLocked: state.test_cases.suites_locked, pendingLayers };
}

/**
 * Find the first unchecked task in tasks.md (read-only, 0.20 CLI-first).
 *
 * Replaces the skill-instructed `grep -n '\- \[ \]' tasks.md | head -1` hand-step.
 */
export function getNextTask(
  projectRoot: string,
  changeName: string,
): { firstUnchecked: { line: number; text: string } | null; remaining: number; total: number } {
  const changeDir = getChangeDir(projectRoot, changeName);
  const tasksPath = join(changeDir, 'tasks.md');
  if (!existsSync(tasksPath)) {
    throw new MumuSpecError('E-GUARD-001', { message: `tasks.md not found: ${tasksPath}` });
  }

  const content = readText(tasksPath) ?? '';
  const lines = content.split('\n');
  const itemRe = /^\s*- \[( |x|X)\] (.*)$/;
  let firstUnchecked: { line: number; text: string } | null = null;
  let remaining = 0;
  let total = 0;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(itemRe);
    if (!m) continue;
    total++;
    if (m[1].toLowerCase() === 'x') continue;
    remaining++;
    if (!firstUnchecked) firstUnchecked = { line: i + 1, text: m[2].trim() };
  }

  return { firstUnchecked, remaining, total };
}
