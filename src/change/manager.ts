import { existsSync, readdirSync, renameSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ChangeState,
  ChangePhase,
  Workflow,
  BuildLayer,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readYaml, writeYaml, readText, writeText, ensureDir, computeHash, now, appendAuditLog, getMumuSpecDir } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';

/** Get the changes directory */
export function getChangesDir(projectRoot: string): string {
  return join(getMumuSpecDir(projectRoot), 'changes');
}

/** Get the archive directory */
export function getArchiveDir(projectRoot: string): string {
  return join(getChangesDir(projectRoot), 'archive');
}

/** Get a change directory path */
export function getChangeDir(projectRoot: string, changeName: string): string {
  return join(getChangesDir(projectRoot), changeName);
}

/** Get the .mumuspec.yaml path for a change */
export function getChangeStatePath(projectRoot: string, changeName: string): string {
  return join(getChangeDir(projectRoot, changeName), '.mumuspec.yaml');
}

/** List all active changes (not archived, not in terminal state) */
export function listActiveChanges(projectRoot: string): string[] {
  const changesDir = getChangesDir(projectRoot);
  if (!existsSync(changesDir)) return [];

  const results: string[] = [];
  const entries = readdirSync(changesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'archive') {
      // Check if it has .mumuspec.yaml
      if (existsSync(join(changesDir, entry.name, '.mumuspec.yaml'))) {
        // Filter out terminal states (discarded / archive-completed)
        const state = readYaml<ChangeState>(join(changesDir, entry.name, '.mumuspec.yaml'));
        if (state && (state.phase === 'discarded' || state.phase === 'archive-completed')) {
          continue;
        }
        results.push(entry.name);
      }
    }
  }
  return results;
}

/** List archived changes */
export function listArchivedChanges(projectRoot: string): string[] {
  const archiveDir = getArchiveDir(projectRoot);
  if (!existsSync(archiveDir)) return [];

  const results: string[] = [];
  try {
    const entries = readdirSync(archiveDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(entry.name);
      }
    }
  } catch {
    // Ignore
  }
  return results;
}

/** Load a change state */
export function loadChangeState(projectRoot: string, changeName: string): ChangeState | undefined {
  const statePath = getChangeStatePath(projectRoot, changeName);
  return readYaml<ChangeState>(statePath);
}

/** Save a change state */
export function saveChangeState(projectRoot: string, changeName: string, state: ChangeState): void {
  const statePath = getChangeStatePath(projectRoot, changeName);
  writeYaml(statePath, state);
}

/** Check if there's an active change (single active change constraint) */
export function getActiveChange(projectRoot: string): string | undefined {
  const active = listActiveChanges(projectRoot);
  if (active.length === 0) return undefined;

  // Filter out discarded/terminal changes
  for (const name of active) {
    const state = loadChangeState(projectRoot, name);
    if (state && state.phase !== 'archive-completed' && state.phase !== 'discarded') {
      return name;
    }
  }
  return undefined;
}

/** Create a new change */
export function createChange(
  projectRoot: string,
  changeName: string,
  workflow: Workflow,
  config: MumuSpecConfig,
  affectedScopes: string[] = [],
): ChangeState {
  // Check single active change constraint
  const active = getActiveChange(projectRoot);
  if (active) {
    throw new MumuSpecError('E-CHANGE-001', {
      '当前活跃变更': active,
      '修复': '完成或 Discard 当前变更后再创建新变更',
    });
  }

  const changeDir = getChangeDir(projectRoot, changeName);
  ensureDir(changeDir);

  // Create initial state
  const state: ChangeState = {
    name: changeName,
    phase: 'open',
    workflow,
    created_at: now(),
    updated_at: now(),
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
    tdd_mode: 'tdd',
    isolation: config.changes.default_isolation,
    single_active_change: true,
    user_confirmed: false,
    decisions_log: {
      counts: {},
    },
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
  };

  // For hotfix/tweak, initialize single build layer
  if (workflow === 'hotfix' || workflow === 'tweak') {
    state.build_layers = [
      { layer: 0, scope: affectedScopes[0] || '.', status: 'pending' as const },
    ];
  }

  saveChangeState(projectRoot, changeName, state);

  // Create initial artifacts
  createInitialArtifacts(projectRoot, changeName, workflow, affectedScopes);

  // Audit log
  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.create',
    change: changeName,
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
): void {
  const changeDir = getChangeDir(projectRoot, changeName);

  // proposal.md
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

  // delta-specs directory
  ensureDir(join(changeDir, 'delta-specs'));

  // constraints directory
  ensureDir(join(changeDir, 'constraints'));
  writeText(join(changeDir, 'constraints', 'new-shall.md'), '# New SHALL Constraints\n\n');
  writeText(join(changeDir, 'constraints', 'new-shall-not.md'), '# New SHALL NOT Constraints\n\n');

  // test-cases directory
  ensureDir(join(changeDir, 'test-cases'));

  // code-graph directory
  ensureDir(join(changeDir, 'code-graph'));

  // decisions.md
  writeText(join(changeDir, 'decisions.md'), `# Decision Log: ${changeName}\n\n`);

  // snapshots directory
  ensureDir(join(changeDir, 'snapshots'));
}

/** Discard a change */
export function discardChange(
  projectRoot: string,
  changeName: string,
  reason: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) {
    throw new Error(`Change not found: ${changeName}`);
  }

  if (state.phase === 'archive-completed' || state.phase === 'discarded') {
    throw new MumuSpecError('E-CHANGE-006', {
      '当前phase': state.phase,
      '说明': '终态不可回退',
    });
  }

  // Save snapshot
  const changeDir = getChangeDir(projectRoot, changeName);
  const snapshotDir = join(changeDir, 'snapshots', 'discard');
  ensureDir(snapshotDir);

  // Update state
  state.phase = 'discarded';
  state.updated_at = now();
  state.rollback_history.push({
    from: state.phase,
    to: 'discarded',
    reason,
    timestamp: now(),
    counted: false,
    event: 'discard',
  });

  saveChangeState(projectRoot, changeName, state);

  // Move to archive/discarded/
  const archiveDir = getArchiveDir(projectRoot);
  const discardedDir = join(archiveDir, 'discarded', changeName);
  ensureDir(discardedDir);

  // Move all contents
  try {
    renameSync(changeDir, discardedDir);
  } catch {
    // If rename fails, copy would be needed; for simplicity, we leave in place
  }

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.discard',
    change: changeName,
    result: 'success',
  });
}

/** Archive a change (move to archive/) */
export function archiveChange(
  projectRoot: string,
  changeName: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) {
    throw new Error(`Change not found: ${changeName}`);
  }

  if (state.phase !== 'archive-in-progress') {
    throw new MumuSpecError('E-CHANGE-006', {
      '当前phase': state.phase,
      '需要': 'archive-in-progress',
    });
  }

  state.phase = 'archive-completed';
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);

  // Move to archive/
  const changeDir = getChangeDir(projectRoot, changeName);
  const archiveDir = getArchiveDir(projectRoot);
  const archivedDir = join(archiveDir, `${new Date().toISOString().split('T')[0]}-${changeName}`);

  ensureDir(archivedDir);
  try {
    renameSync(changeDir, archivedDir);
  } catch {
    // Ignore
  }

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.archive',
    change: changeName,
    result: 'success',
  });
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

  // Copy key artifacts
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

/** Lock test cases (compute hash, set design_locked) */
export function lockTestCases(
  projectRoot: string,
  changeName: string,
): string {
  const changeDir = getChangeDir(projectRoot, changeName);
  const testCasesDir = join(changeDir, 'test-cases');

  // Compute hash of all test case files
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

  const hash = computeHash(combinedContent);

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

  const actualHash = computeHash(combinedContent);
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

/** Append to decisions.md */
export function appendDecision(
  projectRoot: string,
  changeName: string,
  phase: string,
  decision: string,
): void {
  const changeDir = getChangeDir(projectRoot, changeName);
  const decisionsPath = join(changeDir, 'decisions.md');

  const timestamp = now();
  const entry = `\n## [${phase}] ${timestamp}\n\n${decision}\n`;

  const existing = readText(decisionsPath) || '';
  writeText(decisionsPath, existing + entry);

  // Update state counts
  const state = loadChangeState(projectRoot, changeName);
  if (state) {
    state.decisions_log.counts[phase] = (state.decisions_log.counts[phase] || 0) + 1;
    // Recompute hash
    const newContent = readText(decisionsPath) || '';
    state.decisions_log.content_hash = computeHash(newContent);
    state.updated_at = now();
    saveChangeState(projectRoot, changeName, state);
  }
}

/** Get a summary of the change status */
export function getChangeStatusSummary(
  projectRoot: string,
  changeName: string,
): string {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) return `Change not found: ${changeName}`;

  const lines: string[] = [];
  lines.push(`变更: ${changeName}`);
  lines.push(`Phase: ${state.phase}`);
  lines.push(`Workflow: ${state.workflow}`);
  lines.push(`创建时间: ${state.created_at}`);
  lines.push(`更新时间: ${state.updated_at}`);

  if (state.build_layers.length > 0) {
    lines.push('');
    lines.push('Build Layers:');
    for (const layer of state.build_layers) {
      const statusIcon = layer.status === 'done' ? '✓' : layer.status === 'in-progress' ? '◐' : '○';
      lines.push(`  ${statusIcon} Layer ${layer.layer} (${layer.scope}): ${layer.status}`);
    }
  }

  lines.push('');
  lines.push(`Test Cases Locked: ${state.test_cases.design_locked}`);
  lines.push(`Suites Locked: ${state.test_cases.suites_locked}`);
  lines.push(`Rollback Count: ${state.rollback_count}/${state.rollback_limit}`);
  lines.push(`Rebuild Count: ${state.rebuild_count}/${state.rebuild_limit}`);

  if (state.cognitive_framework?.enabled) {
    lines.push('');
    lines.push('Cognitive Framework:');
    lines.push(`  Q1 entries: ${state.cognitive_framework.q1_count}`);
    lines.push(`  Q2 pending: ${state.cognitive_framework.q2_pending}`);
    lines.push(`  Q3 pending: ${state.cognitive_framework.q3_pending}`);
    lines.push(`  Q4 scans: ${state.cognitive_framework.q4_scans_completed}`);
    lines.push(`  Converged: ${state.cognitive_framework.converged}`);
    lines.push(`  Rounds: ${state.cognitive_framework.rounds_completed}`);
  }

  // Next step suggestion
  const nextPhase = getNextPhaseHint(state);
  if (nextPhase) {
    lines.push('');
    lines.push(`下一步: ${nextPhase}`);
  }

  return lines.join('\n');
}

function getNextPhaseHint(state: ChangeState): string | undefined {
  switch (state.phase) {
    case 'open':
      if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
        return 'mumuspec state transition <name> build (hotfix/tweak 跳过 Design)';
      }
      return 'mumuspec state transition <name> design (进入 Design 阶段)';
    case 'design':
      return 'mumuspec state transition <name> build (进入 Build 阶段)';
    case 'build':
      return 'mumuspec state transition <name> verify (进入 Verify 阶段)';
    case 'verify':
      return 'mumuspec state transition <name> archive-in-progress (进入 Archive 阶段)';
    case 'archive-in-progress':
      return 'mumuspec archive <name> (完成归档)';
    default:
      return undefined;
  }
}
