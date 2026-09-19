/**
 * Change lifecycle — create, discard, escalate, snapshot, build-layers, test-cases.
 */
import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ChangeState, Workflow, BuildLayer } from '../core/types.js';
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

## User Decisions
<!-- 影响可见结果的决策项写在这里：以 - [blocking] 前缀标记阻塞项。
    声明阻塞项后须经 decisions append 逐项签收才能进入 build（freeze gate）；
    无声明则不产生任何门禁 -->

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

/**
 * Initialize build layers for a change.
 *
 * Design-build orthogonality (I3): a layer number may carry **several scopes**
 * — same layer + no direct code edge = a parallel group. When the caller does
 * not supply `parallel_group`, entries sharing a layer number are auto-assigned
 * one shared group id, and the group ids are returned so callers can report
 * them (`mumuspec state layers`).
 */
export function initBuildLayers(
  projectRoot: string,
  changeName: string,
  layers: { layer: number; scope: string; parallel_group?: number; depends_on?: string[] }[],
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  state.build_layers = layers.map((l) => {
    const entry: BuildLayer = {
      layer: l.layer,
      scope: l.scope,
      status: 'pending' as const,
    };
    // `parallel_group` is deliberately NOT auto-filled from the layer number.
    // The layer number is only a *candidate* group ("same layer, unverified");
    // an explicit group id is how `planParallelGroups()` records the verified
    // subset. Auto-filling would make the two indistinguishable, and the
    // verification step (`mumuspec state plan-parallel`) would never be due.
    if (l.parallel_group !== undefined) entry.parallel_group = l.parallel_group;
    if (l.depends_on && l.depends_on.length > 0) entry.depends_on = [...l.depends_on];
    return entry;
  });

  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
}

/** Resolve the build-layer entries matching a layer number (may be >1) */
function findBuildLayers(state: ChangeState, layer: number): BuildLayer[] {
  return (state.build_layers as BuildLayer[]).filter((l) => l.layer === layer);
}

/**
 * Update a build layer status.
 *
 * Two design-build orthogonality rules are enforced here (write-time, per
 * CLI-first — the invariant lives in the deterministic command, not in the
 * caller's discipline):
 *
 * 1. **No silent first-match** (fixes the old `find(l => l.layer === layer)`
 *    which, for a layer holding several scopes, always mutated the first one
 *    and silently dropped the rest). Ambiguous targeting is an error listing
 *    the candidate scopes; pass `scope` to select one.
 * 2. **Bottom-up order** (I2/BP-2 A): a layer may only become `done` once every
 *    lower layer is `done`. Scopes within one layer stay free to run in
 *    parallel. `force` bypasses, for the rare case where the plan changed.
 */
export function updateBuildLayerStatus(
  projectRoot: string,
  changeName: string,
  layer: number,
  status: 'pending' | 'in-progress' | 'done',
  options: { scope?: string; force?: boolean } = {},
): { updated: string[] } {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  const candidates = findBuildLayers(state, layer);
  if (candidates.length === 0) {
    throw new Error(`Layer ${layer} not found in change ${changeName}`);
  }

  let targets: BuildLayer[];
  if (options.scope !== undefined) {
    const scoped = candidates.filter((l) => l.scope === options.scope);
    if (scoped.length === 0) {
      throw new Error(
        `Layer ${layer} has no scope "${options.scope}" in change ${changeName} ` +
          `(available: ${candidates.map((l) => l.scope).join(', ')})`,
      );
    }
    targets = scoped;
  } else if (candidates.length > 1) {
    throw new Error(
      `Layer ${layer} has ${candidates.length} scopes in change ${changeName} — ` +
        `ambiguous target (available: ${candidates.map((l) => l.scope).join(', ')}). ` +
        `Pass --scope <scope> to select one.`,
    );
  } else {
    targets = candidates;
  }

  if (status === 'done' && !options.force) {
    const blocking = (state.build_layers as BuildLayer[]).filter(
      (l) => l.layer < layer && l.status !== 'done',
    );
    if (blocking.length > 0) {
      throw new Error(
        `Bottom-up ordering violated: layer ${layer} cannot be done while ` +
          `${blocking.map((l) => `L${l.layer}/${l.scope}=${l.status}`).join(', ')} remain. ` +
          `Complete lower layers first, or pass --force to override.`,
      );
    }
  }

  for (const t of targets) t.status = status;
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
  return { updated: targets.map((t) => t.scope) };
}

/**
 * Build-layer view used by `mumuspec state layers` and the phase guards.
 *
 * Three levels of grouping, from claim to verified fact:
 * - `candidate_groups` — same layer number. Grouping by number alone is only a
 *   *candidate*: it asserts nothing about coupling.
 * - `parallel_groups` — entries sharing a `parallel_group` id. This is the
 *   claim "these may be implemented concurrently", recorded on the state.
 * - `coupled_scopes` — scopes carrying `depends_on`, i.e. the planner found a
 *   direct code edge and refused to claim parallelism (I3 counter-example).
 */
export interface BuildLayerView {
  layers: BuildLayer[];
  /** Candidate groups = same layer number (parallel-capable by construction) */
  candidate_groups: { layer: number; scopes: string[] }[];
  /** Claimed parallel sets = entries sharing a `parallel_group` id */
  parallel_groups: { group: number; layer: number; scopes: string[] }[];
  /** Scopes whose coupling to a same-layer sibling was detected (not parallel) */
  coupled_scopes: string[];
  /**
   * Layer numbers where several scopes coexist but no `parallel_group` has
   * been recorded yet — i.e. "same layer number" is still only a *candidate*
   * grouping. Consumers must not print "verify me" advice once empty.
   */
  unverified_layer_groups: number[];
}

/** Build the grouped view of a change's build layers */
export function getBuildLayerView(projectRoot: string, changeName: string): BuildLayerView {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);
  return buildLayerView(state.build_layers as BuildLayer[]);
}

/** Pure grouping helper (shared by the CLI and the guards) */
export function buildLayerView(layers: BuildLayer[]): BuildLayerView {
  const byLayer = new Map<number, BuildLayer[]>();
  for (const l of layers) {
    const bucket = byLayer.get(l.layer) ?? [];
    bucket.push(l);
    byLayer.set(l.layer, bucket);
  }

  const candidateGroups = [...byLayer.entries()]
    .map(([layer, entries]) => ({ layer, scopes: entries.map((e) => e.scope) }))
    .sort((a, b) => a.layer - b.layer);

  const groupIds = [
    ...new Set(layers.map((l) => l.parallel_group).filter((g): g is number => g !== undefined)),
  ].sort((a, b) => a - b);
  const parallelGroups = groupIds.map((group) => {
    const members = layers.filter((l) => l.parallel_group === group);
    return {
      group,
      layer: members[0]?.layer ?? -1,
      scopes: members.map((m) => m.scope),
    };
  });

  const unverifiedLayerGroups = candidateGroups
    .filter((g) => g.scopes.length > 1)
    .filter((g) => !layers.some((l) => l.layer === g.layer && l.parallel_group !== undefined))
    .map((g) => g.layer);

  return {
    layers,
    candidate_groups: candidateGroups,
    parallel_groups: parallelGroups,
    coupled_scopes: layers.filter((l) => (l.depends_on?.length ?? 0) > 0).map((l) => l.scope),
    unverified_layer_groups: unverifiedLayerGroups,
  };
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
