/**
 * finalize-archive command — Post-archive cleanup operations.
 *
 * Encapsulates all mechanical operations that were previously agent-driven:
 * - Merge delta-specs to corresponding scope's tech.md/prd.md
 * - Update prohibitions.md
 * - Rebuild index.yaml
 * - Update code-graph snapshot
 * - Extract knowledge to global knowledge base
 * - Clean worktree and release active change slot
 * - Clean stale cache/indexed.yaml entries
 * - Ask user about old spec.md/design.md files
 */
import type { Command } from 'commander';
import { existsSync, readdirSync, unlinkSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import {
  findProjectRoot,
  writeText,
  readText,
  writeYaml,
  readYaml,
  now,
  appendAuditLog,
  getMumuSpecDir,
} from '../../core/utils.js';
import { MumuSpecError } from '../../core/errors.js';
import { loadConfig } from '../../core/config.js';
import { isRegisteredSpecModule } from '../../core/utils.js';
import { getCurrentBranch, getMainBranch, switchBranch } from '../../core/git.js';
import {
  loadChangeState,
  getArchivedChangeDir,
  mergeDeltaSpecsToMain,
  extractKnowledgeToGlobal,
} from '../../change/manager.js';
import { getCachedCodeGraph } from '../../knowledge/graph-builder.js';
import type { ChangeState } from '../../core/types.js';

export function registerFinalizeArchiveCommand(program: Command): void {
  program
    .command('finalize-archive')
    .description('Post-archive cleanup: merge specs, update index, clean cache')
    .argument('<change-name>', 'archived change name')
    .option('--delete-old', 'auto-delete old spec.md/design.md without prompt')
    .option('--keep-old', 'auto-keep old spec.md/design.md without prompt')
    .option('--force', 're-run even if already finalized (overrides .finalized marker)')
    .option('--json', 'output as JSON')
    .action((changeName: string, options: { deleteOld?: boolean; keepOld?: boolean; json?: boolean; force?: boolean }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);
      const results: string[] = [];
      const warnings: string[] = [];
      const archiveBaseDir = join(getMumuSpecDir(root), 'changes', 'archive');

      // ── Step B-1: 防重跑（幂等）— P0-D ③ ──
      // 归档后重复 finalize 会造成 delta 重复合并、状态与目录不一致（E-CHANGE-011 风险）。
      // 以 .finalized 标记拦截；--force 显式覆盖。
      let archivedDirEarly = getArchivedChangeDir(root, changeName);
      if (!archivedDirEarly || !existsSync(archivedDirEarly)) {
        if (existsSync(archiveBaseDir)) {
          for (const entry of readdirSync(archiveBaseDir)) {
            if (entry === changeName || entry.endsWith(`-${changeName}`)) {
              archivedDirEarly = join(archiveBaseDir, entry);
              break;
            }
          }
        }
      }
      if (archivedDirEarly && !options.force && isFinalized(archivedDirEarly)) {
        const msg = `已 finalize，跳过（标记存在：${
          readText(finalizeMarkerPath(archivedDirEarly)) || '未知时间'
        }）。需重跑请加 --force`;
        if (options.json) {
          console.log(JSON.stringify({ results: [msg], warnings: [] }, null, 2));
          return;
        }
        console.log(msg);
        return;
      }

      // ── Step B0: Verify archived ──
      let archivedDir = getArchivedChangeDir(root, changeName);

      if (!archivedDir || !existsSync(archivedDir)) {
        // Try to find by pattern match
        const patterns = [`${changeName}`, `-${changeName}`];
        if (existsSync(archiveBaseDir)) {
          const entries = readdirSync(archiveBaseDir);
          for (const entry of entries) {
            if (patterns.some((p) => entry.endsWith(p))) {
              archivedDir = join(archiveBaseDir, entry);
              break;
            }
          }
        }

        if (!archivedDir || !existsSync(archivedDir)) {
          throw new MumuSpecError('E-FINAL-001', {
            '说明': '变更未归档或归档目录不存在',
            '修复': '请先运行 `mumuspec state transition <name> archive` 归档变更',
          });
        }
      }

      const state = loadChangeState(root, changeName);
      if (state && state.phase !== 'archive-completed') {
        throw new MumuSpecError('E-FINAL-001', {
          '当前phase': state.phase,
          '需要': 'archive-completed',
          '修复': '请先完成归档流程',
        });
      }

      // Also try loading from archive directory if not found in active
      let archiveState = state;
      if (!state || !existsSync(join(archivedDir, '.mumuspec.yaml'))) {
        // Check archive dir for state
        const archiveStatePath = join(archivedDir, '.mumuspec.yaml');
        if (existsSync(archiveStatePath)) {
          archiveState = readYaml<ChangeState>(archiveStatePath) || state;
        }
      }

      // ── Step B1: Merge delta-specs ──
      try {
        // Defensive default: tolerate void-returning implementations.
        const deltaResult = (mergeDeltaSpecsToMain(root, changeName, archivedDir, archiveState) ?? {
          merged: [],
          skippedIdempotent: [],
          unresolved: [],
        }) as { merged: string[]; skippedIdempotent: string[]; unresolved: { file: string; reason: string }[] };
        // Fail-closed parity with archive: unresolved deltas must be visible,
        // never folded into a green "merged" line.
        for (const u of deltaResult.unresolved) {
          warnings.push(`⚠ delta-specs merge unresolved: ${u.file} — ${u.reason}`);
        }
        if (deltaResult.merged.length > 0) {
          results.push(`✓ delta-specs merged (${deltaResult.merged.length})`);
        } else if (deltaResult.unresolved.length === 0) {
          results.push('✓ delta-specs merged');
        }
      } catch (err) {
        warnings.push(`⚠ delta-specs merge: ${(err as Error).message}`);
      }

      // ── Step B2: Update prohibitions.md ──
      try {
        updateProhibitions(root, archivedDir, config);
        results.push('✓ prohibitions.md updated');
      } catch (err) {
        warnings.push(`⚠ prohibitions update: ${(err as Error).message}`);
      }

      // ── Step B3: Rebuild index.yaml ──
      try {
        rebuildIndexYaml(root, config);
        results.push('✓ index.yaml rebuilt');
      } catch (err) {
        warnings.push(`⚠ index rebuild: ${(err as Error).message}`);
      }

      // ── Step B4: Code-graph snapshot ──
      try {
        updateCodeGraphSnapshot(root, changeName, archivedDir);
        results.push('✓ code-graph snapshot updated');
      } catch {
        warnings.push('⚠ code-graph snapshot update skipped (non-fatal)');
      }

      // ── Step B5: Knowledge extraction ──
      if (archiveState && archiveState.workflow !== 'tweak') {
        try {
          extractKnowledgeToGlobal(root, changeName, archivedDir, archiveState);
          results.push('✓ knowledge extracted');
        } catch {
          warnings.push('⚠ knowledge extraction skipped (non-fatal)');
        }
      }

      // ── Step B6: Cleanup worktree ──
      try {
        cleanupWorktree(root, changeName);
        results.push('✓ worktree cleaned');
      } catch {
        warnings.push('⚠ worktree cleanup skipped');
      }

      // ── Step B7: Report stale archives (read-only) ──
      try {
        const stale = reportStaleArchives(root);
        if (stale.length > 0) {
          results.push(
            `⚠ ${stale.length} 个归档条目超过 ${STALE_ARCHIVE_DAYS} 天未改动（只读报告，不删除）: ${stale.join(', ')}`,
          );
        }
      } catch {
        // Non-fatal
      }

      // ── Step B8: Release active slot ──
      releaseActiveSlot(root, changeName);

      // ── Step B8.5: 写防重跑标记（幂等保障，P0-D ③）──
      try {
        markFinalized(archivedDir);
        results.push('✓ finalized marker written (.finalized)');
      } catch {
        warnings.push('⚠ finalized marker 写入失败（重跑保护未生效）');
      }

      // ── Step B9: User decision about old files ──
      if (!options.deleteOld && !options.keepOld) {
        const oldFiles = findBackwardCompatFiles(root);
        if (oldFiles.length > 0) {
          console.log('');
          console.log('╔══════════════════════════════════════════════════════════╗');
          console.log('║  Backward Compatibility Files Detected                  ║');
          console.log('╚══════════════════════════════════════════════════════════╝');
          console.log('');
          console.log('The following files are superseded by new prd.md/tech.md:');
          console.log('');
          for (const f of oldFiles) {
            console.log(`  - ${f}`);
          }
          console.log('');
          console.log('These files may be kept for backward compatibility or deleted.');
          console.log('To delete: run `mumuspec finalize-archive <name> --delete-old`');
          console.log('To keep:   run `mumuspec finalize-archive <name> --keep-old`');
          console.log('');
          results.push(`⚠ ${oldFiles.length} backward compat files detected (use --delete-old to remove)`);
        }
      } else if (options.deleteOld) {
        const oldFiles = findBackwardCompatFiles(root);
        let deleted = 0;
        for (const f of oldFiles) {
          try {
            unlinkSync(f);
            deleted++;
          } catch {
            // Non-fatal
          }
        }
        if (deleted > 0) {
          results.push(`✓ deleted ${deleted} backward compat files`);
        }
      }

      // ── Audit log ──
      appendAuditLog(getMumuSpecDir(root), {
        actor: 'user',
        action: 'change.finalize-archive',
        change: changeName,
        result: 'success',
      });

      // ── Output ──
      if (options.json) {
        console.log(JSON.stringify({ results, warnings }, null, 2));
        return;
      }

      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Finalize Archive Complete                              ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      for (const r of results) {
        console.log(`  ${r}`);
      }
      if (warnings.length > 0) {
        console.log('');
        console.log('Warnings:');
        for (const w of warnings) {
          console.log(`  ${w}`);
        }
      }
    });
}

// ════════════════════════════════════════════════════════════════════
// Sub-process implementations
// ════════════════════════════════════════════════════════════════════

function updateProhibitions(
  projectRoot: string,
  changeDir: string,
  _config: ReturnType<typeof loadConfig>,
): void {
  const constraintsDir = join(changeDir, 'constraints');
  if (!existsSync(constraintsDir)) return;

  const prohibitionsPath = join(getMumuSpecDir(projectRoot), 'prohibitions.md');
  let existingContent = existsSync(prohibitionsPath) ? (readText(prohibitionsPath) || '') : '';

  // Import new-shall-not constraints
  const shallNotPath = join(constraintsDir, 'new-shall-not.md');
  if (existsSync(shallNotPath)) {
    const shallNotContent = readText(shallNotPath);
    if (shallNotContent && !existingContent.includes(shallNotContent)) {
      existingContent += `\n\n<!-- from finalize-archive -->\n${shallNotContent}\n`;
      writeText(prohibitionsPath, existingContent);
    }
  }
}

function rebuildIndexYaml(projectRoot: string, _config: ReturnType<typeof loadConfig>): void {
  const indexPath = join(getMumuSpecDir(projectRoot), 'index.yaml');
  const children: Array<{ name: string; path: string; prd_summary: string; tech_summary: string }> = [];

  // Scan for all .mumuspec directories with prd.md/tech.md
  function scanDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const mumuDir = join(dir, '.mumuspec');

      // W3: shared registration predicate (single source of truth with checker)
      if (isRegisteredSpecModule(dir)) {
        const prdPath = join(mumuDir, 'prd.md');
        const techPath = join(mumuDir, 'tech.md');

        {
          const relPath = relative(projectRoot, dir) || '.';
          const prdSummary = existsSync(prdPath) ? extractFirstHeading(prdPath) : '';
          const techSummary = existsSync(techPath) ? extractFirstHeading(techPath) : '';

          children.push({
            name: dir.split(/[\\/]/).pop() || relPath,
            path: relPath,
            prd_summary: prdSummary,
            tech_summary: techSummary,
          });
        }
      }

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist'
        ) {
          scanDir(join(dir, entry.name));
        }
      }
    } catch {
      // Skip
    }
  }

  scanDir(projectRoot);

  writeYaml(indexPath, {
    scope: '.',
    layer: 0,
    last_updated: now().split('T')[0],
    children,
  });
}

function extractFirstHeading(filePath: string): string {
  try {
    const content = readText(filePath);
    if (!content) return '';
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

/**
 * 序列化当前代码结构快照（P0-D ①）。
 * 复用既有 getCachedCodeGraph（Ponytail L2: 复用已有实现），落到 temp/ 下
 * （spec 临时目录管理规范：非规范产物一律入 .mumuspec/temp/，且不纳版本控制）。
 */
function updateCodeGraphSnapshot(
  projectRoot: string,
  _changeName: string,
  _changeDir: string,
): void {
  const graph = getCachedCodeGraph(projectRoot);
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const tempDir = join(getMumuSpecDir(projectRoot), 'temp');
  if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  const snapshotPath = join(tempDir, 'codegraph.snapshot.json');
  writeText(
    snapshotPath,
    JSON.stringify({ generatedAt: now(), nodeCount: nodes.length, nodes }, null, 2),
  );
}

function cleanupWorktree(projectRoot: string, _changeName: string): void {
  // Branch-driven workflow: after archive, switch back to the main branch.
  // The change branch is kept until `mumuspec merge` deletes it (safe -d).
  try {
    const current = getCurrentBranch(projectRoot);
    const main = getMainBranch(projectRoot);
    if (current && main && current !== main) {
      switchBranch(projectRoot, main);
    }
  } catch {
    // Non-fatal: repo may be absent or no main branch; skip switch
  }
}

/** Stale-archive report threshold (days) — 超此天数未改动的归档条目在 finalize 时提示。 */
const STALE_ARCHIVE_DAYS = 30;

/**
 * 报告陈旧归档条目（只读，不执行任何删除）。
 *
 * 归档目录承载变更的唯一物理副本（delta-specs / decisions.md / design.md /
 * cognitive-map.yaml），其生命周期不由 finalize-archive 决定。此前此处按
 * 目录 mtime 递归删除归档条目，属于无人工确认、无路径级审计的不可逆操作，
 * 且 mtime 与归档时间无因果关系（会被非归档行为刷新）。删除行为已移除，
 * 仅保留清单报告。
 */
function reportStaleArchives(projectRoot: string): string[] {
  const archiveDir = join(getMumuSpecDir(projectRoot), 'changes', 'archive');
  if (!existsSync(archiveDir)) return [];

  const stale: string[] = [];
  const cutoff = Date.now() - STALE_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

  for (const entry of readdirSync(archiveDir)) {
    try {
      if (statSync(join(archiveDir, entry)).mtimeMs < cutoff) {
        stale.push(entry);
      }
    } catch {
      // 不可 stat 的条目跳过（权限/占用），不影响其余条目
    }
  }

  return stale;
}

/** P0-D ③ 防重跑标记：归档目录写入 .finalized（含时间戳），重复运行幂等跳过。 */
function finalizeMarkerPath(changeDir: string): string {
  return join(changeDir, '.finalized');
}

function isFinalized(changeDir: string): boolean {
  return existsSync(finalizeMarkerPath(changeDir));
}

function markFinalized(changeDir: string): void {
  writeText(finalizeMarkerPath(changeDir), now());
}

function releaseActiveSlot(projectRoot: string, changeName: string): void {
  // Mark active change slot as released
  // This is a no-op in the distributed changes model since archive
  // already moves the changes directory
  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'system',
    action: 'active_slot.released',
    change: changeName,
    result: 'success',
  });
}

function findBackwardCompatFiles(projectRoot: string): string[] {
  const oldFiles: string[] = [];

  function scanDir(dir: string): void {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            entry.name !== 'dist'
          ) {
            scanDir(join(dir, entry.name));
          }
        } else if (entry.name === 'spec.md' || entry.name === 'design.md') {
          // Check if corresponding prd.md or tech.md exists
          const parentDir = dirname(join(dir, entry.name));
          const hasPrdOrTech =
            existsSync(join(parentDir, 'prd.md')) ||
            existsSync(join(parentDir, 'tech.md'));

          if (hasPrdOrTech) {
            const fullPath = join(dir, entry.name);
            // Skip the root .mumuspec/spec.md and .mumuspec/design.md
            if (!fullPath.includes(`${sep}.mumuspec${sep}spec.md`) &&
                !fullPath.includes(`${sep}.mumuspec${sep}design.md`)) {
              oldFiles.push(fullPath);
            }
          }
        }
      }
    } catch {
      // Skip
    }
  }

  scanDir(projectRoot);
  return oldFiles;
}
