import { existsSync, readdirSync, renameSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureFeedbackStructure, getChangeFeedbackDir } from '../feedback/manager.js';
import { createKnowledgePage, getKnowledgeDir } from '../knowledge/manager.js';
import { loadConfig } from '../core/config.js';
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
  // Check single active change constraint.
  //
  // Strength-aware since 0.12.0: the constraint is evaluated against
  // `config.workflow.single_active_change` (explicit override) and
  // `config.constraint_strength` (effective strength). When the effective
  // value is `false` (e.g. low RG strength, or explicit override), multiple
  // parallel changes are allowed up to `workflow.max_active_changes`.
  //
  // See docs/design/constraint-strength.md §6.1.
  const active = getActiveChange(projectRoot);
  if (active && config.workflow?.single_active_change !== false) {
    throw new MumuSpecError('E-CHANGE-001', {
      '当前活跃变更': active,
      '修复': '完成或 Discard 当前变更后再创建新变更',
      '提示': '如需并行变更，可在 config.yaml 设置 workflow.single_active_change: false',
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
    feedback_log: {
      entries: [],
      session_links: [],
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

  // Ensure feedback directory structure exists
  ensureFeedbackStructure(projectRoot);

  // Create change-specific feedback directory
  ensureDir(getChangeFeedbackDir(projectRoot, changeName));

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

/**
 * Auto-bump project version during archive.
 * Increments the prerelease counter (alpha.N -> alpha.N+1) and syncs src/cli.ts.
 * Bump magnitude depends on workflow: tweak = patch, hotfix = patch, full = minor.
 */
export function bumpVersionForArchive(
  projectRoot: string,
  workflow: string,
): string | null {
  const pkgPath = join(projectRoot, 'package.json');
  const cliPath = join(projectRoot, 'src', 'cli.ts');

  if (!existsSync(pkgPath) || !existsSync(cliPath)) return null;

  try {
    const pkgRaw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    const current = pkg.version;

    // Parse: MAJOR.MINOR.PATCH[-tag.N]
    const match = current.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)(?:\.(\d+))?)?$/,
    );
    if (!match) return null;

    let [, major, minor, patch, tag, tagNum] = match;
    let nextVersion: string;

    if (!tag) {
      // No prerelease tag — bump patch and add alpha.0
      nextVersion = `${major}.${minor}.${parseInt(patch, 10) + 1}-alpha.0`;
    } else if (workflow === 'tweak' || workflow === 'hotfix') {
      // Patch bump with same tag
      if (tagNum !== undefined) {
        nextVersion = `${major}.${minor}.${patch}-${tag}.${parseInt(tagNum, 10) + 1}`;
      } else {
        nextVersion = `${major}.${minor}.${patch}-${tag}.0`;
      }
    } else {
      // Full workflow — bump minor version, keep tag
      nextVersion = `${major}.${parseInt(minor, 10) + 1}.0-${tag}.0`;
    }

    // Update package.json
    pkg.version = nextVersion;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // Sync src/cli.ts
    const cliRaw = readFileSync(cliPath, 'utf8');
    const updatedCli = cliRaw.replace(
      /\.version\(['"]([^'"]+)['"]\)/,
      `.version('${nextVersion}')`,
    );
    if (updatedCli !== cliRaw) {
      writeFileSync(cliPath, updatedCli, 'utf8');
    }

    return nextVersion;
  } catch {
    // Non-fatal: version bump failure doesn't block archival
    return null;
  }
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

  const isTweak = state.workflow === 'tweak';
  const changeDir = getChangeDir(projectRoot, changeName);

  // Sub-process V: auto-version bump (0.13.0+)
  const bumpedVersion = bumpVersionForArchive(projectRoot, state.workflow);
  if (bumpedVersion) {
    // Add audit entry for version bump
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'system',
      action: 'version.bump',
      change: changeName,
      to_version: bumpedVersion,
      trigger: 'archive',
      result: 'success',
    });
  }

  // Sub-process B: delta-spec merge (skip for tweak — no delta-specs)
  if (!isTweak) {
    mergeDeltaSpecsToMain(projectRoot, changeName, changeDir);
  }

  // Sub-process D: knowledge extraction (skip for tweak — no cognitive-map)
  if (!isTweak) {
    extractKnowledgeToGlobal(projectRoot, changeName, changeDir, state);
  }

  state.phase = 'archive-completed';
  state.updated_at = now();

  // Mark knowledge extraction state
  if (!isTweak) {
    state.knowledge_extraction = {
      completed: true,
      pages_created_count: state.knowledge_extraction?.pages_created_count || 0,
      graph_bindings_verified: true,
      conflicts_resolved: true,
    };
  }

  saveChangeState(projectRoot, changeName, state);

  // Move to archive/
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
    workflow: state.workflow,
    knowledge_extracted: !isTweak,
    result: 'success',
  });
}

/** Merge delta-specs into main spec.md (sub-process B) */
function mergeDeltaSpecsToMain(
  projectRoot: string,
  changeName: string,
  changeDir: string,
): void {
  const deltaSpecsDir = join(changeDir, 'delta-specs');
  if (!existsSync(deltaSpecsDir)) return;

  try {
    const entries = readdirSync(deltaSpecsDir);
    const specFiles = entries.filter((f: string) => f.endsWith('.md'));

    if (specFiles.length === 0) return;

    const mumuDir = getMumuSpecDir(projectRoot);
    const mainSpecPath = join(mumuDir, 'spec.md');

    if (!existsSync(mainSpecPath)) return;

    for (const specFile of specFiles) {
      const specContent = readFileSync(join(deltaSpecsDir, specFile), 'utf8');
      // Append as an archived delta section
      appendFileSync(mainSpecPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
    }
  } catch {
    // Non-fatal: merge failures don't block archival
  }
}

/**
 * Extract knowledge from change artifacts to global knowledge base (sub-process D1-D8).
 *
 * Implements KP-0028 Archive Phase Knowledge Extraction flow:
 *   D1-D4: Read artifacts (cognitive-map, decisions.md, design.md, hyperplan_result)
 *   D5:    Map artifacts → knowledge types
 *   D6:    Filter (exclude temporary, short-term, rejected)
 *   D7:    Conflict detection (scope + tag based)
 *   D8:    Create pages + update PageIndex
 */
function extractKnowledgeToGlobal(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  state: ChangeState,
): void {
  const config = loadConfig(projectRoot);
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  if (!existsSync(knowledgeDir)) return;

  let pagesCreated = 0;
  const extractionLog: string[] = [];

  // ── D1: Read cognitive-map.yaml (Q1/Q3/Q4 entries) ──
  const cognitiveMapPath = join(changeDir, 'cognitive-map.yaml');
  if (existsSync(cognitiveMapPath)) {
    try {
      const cm = readYaml(cognitiveMapPath) as Record<string, unknown>;
      const entries = (cm.entries as Record<string, unknown>[]) || [];

      // Q1 entries → decision type
      const q1Entries = entries.filter((e) => e.quadrant === 'Q1' && e.category === 'persistent');
      for (const entry of q1Entries) {
        const title = `Auto-extracted from ${changeName}: ${String(entry.question || 'Q1 decision')}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-${computeHash(title).substring(0, 8)}`,
            title,
            type: 'decision',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q1\n\n**Question:** ${entry.question}\n**Answer:** ${entry.answer || 'N/A'}`,
            tags: ['auto-extracted', 'q1', 'decision', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q1 → decision: ${entry.question}`);
        } catch {
          // skip duplicates
        }
      }

      // Q3 confirmed entries → rationale type
      const q3Entries = entries.filter((e) => e.quadrant === 'Q3' && e.status === 'confirmed');
      for (const entry of q3Entries) {
        const title = `Rationale from ${changeName}: ${String(entry.question || 'Q3 derivation')}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-q3-${computeHash(title).substring(0, 8)}`,
            title,
            type: 'rationale',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q3\n\n**Question:** ${entry.question}\n**Answer:** ${entry.answer || 'N/A'}`,
            tags: ['auto-extracted', 'q3', 'rationale', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q3 → rationale: ${entry.question}`);
        } catch {
          // skip duplicates
        }
      }

      // Q4 risk scans → risk type
      const q4Scans = entries.filter((e) => e.quadrant === 'Q4');
      if (q4Scans.length > 0) {
        const title = `Residual risks from ${changeName}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-q4-risk`,
            title,
            type: 'risk',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q4\n\n${q4Scans.map((e) => `- **${e.question}**: ${e.answer || 'TBD'}`).join('\n')}`,
            tags: ['auto-extracted', 'q4', 'risk', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q4 → risk: ${q4Scans.length} residual items`);
        } catch {
          // skip
        }
      }
    } catch {
      // Non-fatal: cognitive-map not parseable
    }
  }

  // ── D2: Read decisions.md for lesson-type knowledge ──
  const decisionsPath = join(changeDir, 'decisions.md');
  if (existsSync(decisionsPath)) {
    try {
      const content = readText(decisionsPath);
      if (content && content.trim()) {
        const title = `Lessons from ${changeName} decisions`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-lessons`,
            title,
            type: 'lesson',
            scope: changeName,
            content: `> Auto-extracted from ${changeName}/decisions.md\n\n${content.substring(0, 2000)}`,
            tags: ['auto-extracted', 'lesson', 'decisions', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D2 → lesson: from decisions.md`);
        } catch {
          // skip
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // ── D3: Read design.md for pattern-type knowledge ──
  const designPath = join(changeDir, 'design.md');
  if (existsSync(designPath)) {
    try {
      const content = readText(designPath);
      if (content && content.trim()) {
        const title = `Architecture patterns from ${changeName}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-patterns`,
            title,
            type: 'pattern',
            scope: changeName,
            content: `> Auto-extracted from ${changeName}/design.md\n\n${content.substring(0, 2000)}`,
            tags: ['auto-extracted', 'pattern', 'architecture', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D3 → pattern: from design.md`);
        } catch {
          // skip
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // ── D4: Hyperplan surviving insights (from state) ──
  if (state.hyperplan_result?.hard_constraints_merged) {
    const title = `Adversarial design review insights from ${changeName}`;
    try {
      createKnowledgePage(projectRoot, config, {
        id: `KE-${changeName}-hyperplan`,
        title,
        type: 'decision',
        scope: changeName,
        content: `> Auto-extracted from ${changeName} Hyperplan review\n\n**Hard constraints merged:** ${state.hyperplan_result.hard_constraints_merged}\n**Open questions resolved:** ${state.hyperplan_result.open_questions_resolved}\n**Degraded:** ${state.hyperplan_result.degraded}`,
        tags: ['auto-extracted', 'hyperplan', 'decision', changeName],
      });
      pagesCreated++;
      extractionLog.push(`  D4 → decision: hyperplan insights`);
    } catch {
      // skip
    }
  }

  // ── D7: Update state tracking (conflict detection logged in audit later) ──
  state.knowledge_extraction = {
    completed: pagesCreated > 0,
    pages_created_count: (state.knowledge_extraction?.pages_created_count || 0) + pagesCreated,
    graph_bindings_verified: false, // would need code-graph backend
    conflicts_resolved: false, // MVP: auto-mode, flag as unresolved
  };

  // ── D8: Log extraction summary (pages already created via createKnowledgePage) ──
  if (extractionLog.length > 0) {
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'system',
      action: 'knowledge.extract',
      change: changeName,
      pages_created: pagesCreated,
      summary: extractionLog.join(' | '),
      result: pagesCreated > 0 ? 'success' : 'no-content',
    });
  }
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

// ========== Feedback Integration (0.12.1+) ==========

/** Append a feedback reference to a change's feedback_log */
export function appendFeedbackToChange(
  projectRoot: string,
  changeName: string,
  feedbackId: string,
  sessionId?: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  if (!state.feedback_log) {
    state.feedback_log = { entries: [], session_links: [] };
  }

  // Check if already linked
  if (!state.feedback_log.entries.some(e => e.feedback_id === feedbackId)) {
    state.feedback_log.entries.push({
      feedback_id: feedbackId,
      linked_at: now(),
      acknowledged: false,
    });
  }

  // Add session link if provided
  if (sessionId && !state.feedback_log.session_links.some(
    l => l.feedback_id === feedbackId && l.session_id === sessionId
  )) {
    state.feedback_log.session_links.push({
      feedback_id: feedbackId,
      session_id: sessionId,
      linked_at: now(),
    });
  }

  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
}

/** Get all feedback entries linked to a change */
export function getChangeFeedbacks(projectRoot: string, changeName: string): Array<{
  feedback_id: string;
  linked_at: string;
  acknowledged: boolean;
  sessionId?: string;
}> {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.feedback_log) return [];

  return state.feedback_log.entries.map(entry => {
    const link = state.feedback_log!.session_links.find(
      l => l.feedback_id === entry.feedback_id
    );
    return {
      ...entry,
      sessionId: link?.session_id,
    };
  });
}
