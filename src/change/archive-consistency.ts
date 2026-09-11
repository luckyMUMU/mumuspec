/**
 * 归档一致性检查 — 引擎状态工件与物理布局的一致性不变量。
 *
 * 校验面此前只检查「规范文本 ↔ 代码」，不检查「引擎产出的状态工件 ↔ 物理布局」，
 * 导致归档后状态写回失效（活跃区残留状态目录、归档状态停在未完成阶段）等问题
 * 长期不被任何防线捕获。本模块把这些不变量变成可判定的检查项。
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState } from '../core/types.js';
import type { DriftResult } from '../core/types-workflow.js';
import { readYaml } from '../core/utils.js';
import { getArchiveDir, getChangesDir } from './paths.js';

/** 归档目录名中的日期前缀：`YYYY-MM-DD-`。 */
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/** 剥离归档条目的日期前缀，得到变更名。 */
function stripDatePrefix(entry: string): string {
  return DATE_PREFIX.test(entry) ? entry.slice(11) : entry;
}

function readStateFile(statePath: string): ChangeState | undefined {
  if (!existsSync(statePath)) return undefined;
  return readYaml<ChangeState>(statePath) ?? undefined;
}

/**
 * 归档一致性不变量检查。
 *
 * - ARCH-001：活跃区残留已归档变更的状态目录（归档后不应存在）
 * - ARCH-002：归档目录内的状态阶段不是 archive-completed
 * - ARCH-003：归档目录名出现重复日期前缀
 */
export function detectArchiveStateDrift(
  projectRoot: string,
  scope?: string,
): DriftResult[] {
  const results: DriftResult[] = [];
  const changesDir = getChangesDir(projectRoot, scope);
  const archiveDir = getArchiveDir(projectRoot, scope);
  if (!existsSync(changesDir) || !existsSync(archiveDir)) return results;

  const archivedNames = new Set<string>();
  let archiveEntries: string[] = [];
  try {
    archiveEntries = readdirSync(archiveDir);
  } catch {
    return results;
  }

  for (const entry of archiveEntries) {
    if (entry === 'discarded') continue;
    archivedNames.add(stripDatePrefix(entry));

    if (DATE_PREFIX.test(stripDatePrefix(entry))) {
      results.push({
        type: 'archive_state_drift',
        code: 'E-ARCH-003',
        severity: 'WARN',
        message: `归档目录名出现重复日期前缀: ${entry}`,
        file: join(archiveDir, entry),
        fixHint: '重命名归档目录，去掉多余的日期前缀',
      });
    }

    const archivedStatePath = join(archiveDir, entry, '.mumuspec.yaml');
    const archivedState = readStateFile(archivedStatePath);
    // 无 phase 字段的归档属历史格式，不做阶段判定
    if (
      archivedState?.phase &&
      archivedState.phase !== 'archive-completed' &&
      archivedState.phase !== 'discarded'
    ) {
      results.push({
        type: 'archive_state_drift',
        code: 'E-ARCH-002',
        severity: 'ERROR',
        message: `归档状态阶段为 ${archivedState.phase}，应为 archive-completed`,
        file: archivedStatePath,
        fixHint: `将 ${archivedStatePath} 的 phase 改为 archive-completed（状态权威源应随变更留在归档目录）`,
      });
    }
  }

  // 活跃区残留：目录名与某个归档条目同名
  let activeEntries: string[] = [];
  try {
    activeEntries = readdirSync(changesDir);
  } catch {
    return results;
  }

  for (const entry of activeEntries) {
    if (entry === 'archive') continue;
    const activeDir = join(changesDir, entry);
    if (!archivedNames.has(entry)) continue;

    const statePath = join(activeDir, '.mumuspec.yaml');
    const state = readStateFile(statePath);
    if (!state) continue;

    results.push({
      type: 'archive_state_drift',
      code: 'E-ARCH-001',
      severity: 'ERROR',
      message: `活跃区残留已归档变更的状态目录: ${entry}`,
      file: statePath,
      fixHint: `删除残留目录 ${activeDir}（权威状态应只存在于归档目录）`,
    });
  }

  return results;
}
