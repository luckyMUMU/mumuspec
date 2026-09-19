/**
 * Status-assertion checker (enforcement-gap L2) — reconciles machine-checkable
 * assertions in docs/STATUS.md against repository facts. The channel reports
 * ONLY assertion-vs-fact conflicts ("断言与事实矛盾"); it never judges progress
 * quality (density-as-signal discipline).
 *
 * checkStatusAssertions is a pure function over (statusText, facts, now);
 * detectStatusAssertionDrift adds deterministic fs fact collection.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DriftResult } from '../core/types-workflow.js';

export const STATUS_ASSERTION_CODE = 'E-DRIFT-016';

/** Capability-layer rows whose assertion maps to a source directory. */
export const LAYER_DIRS: Record<string, string> = {
  'Spec Layer': 'src/spec',
  'Change Layer': 'src/change',
  'Guard Layer': 'src/guard',
  'Contract Layer': 'src/contract',
  'Knowledge Layer': 'src/knowledge',
  'AI Integration': 'src/install',
};

/** A row asserting 0% progress is only contradicted at/above this line count. */
export const ZERO_PROGRESS_LINE_THRESHOLD = 200;

export interface StatusAssertionFacts {
  /** package.json version (authoritative release fact). */
  version: string;
  /** Registered top-level CLI command count. */
  commandCount: number;
  /** Registered MCP tool count. */
  toolCount: number;
}

export interface StatusAssertionOpts {
  /** Clock injection for deterministic freshness checks. */
  now?: Date;
  /** Freshness threshold in days (INFO level). */
  staleDays?: number;
  /** enforcement_strict gate: promotes conflicts from WARN to ERROR. */
  strict?: boolean;
}

function productionLineCount(projectRoot: string, relDir: string): number {
  const dir = join(projectRoot, relDir);
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const p = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && !entry.name.startsWith('.')) walk(p);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        total += readFileSync(p, 'utf8').split('\n').length;
      }
    }
  };
  walk(dir);
  return total;
}

interface TableRow {
  name: string;
  implPercent: number;
}

function parseProgressRows(statusText: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const line of statusText.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '');
    if (cells.length < 3) continue;
    const name = cells[0];
    if (!(name in LAYER_DIRS)) continue;
    const m = cells[2].match(/~?\*{0,2}(\d+)/);
    if (!m) continue;
    rows.push({ name, implPercent: Number(m[1]) });
  }
  return rows;
}

/** Pure reconciliation: STATUS text + injected facts → conflict entries. */
export function checkStatusAssertions(
  statusText: string,
  facts: StatusAssertionFacts,
  projectRoot: string,
  opts?: StatusAssertionOpts,
): DriftResult[] {
  const strict = opts?.strict ?? false;
  const severity = strict ? 'ERROR' as const : 'WARN' as const;
  const findings: DriftResult[] = [];
  const push = (message: string) => findings.push({
    type: 'status_assertion',
    severity,
    message,
    file: 'docs/STATUS.md',
    code: STATUS_ASSERTION_CODE,
    fixHint: '修正 docs/STATUS.md 断言使其与仓库事实一致，或修正事实源',
  });

  // 1. package version assertion
  const version = statusText.match(/当前包版本\*{0,2}[:：]\s*([^\s|]+)/)?.[1]?.replace(/`/g, '');
  if (version && version !== facts.version) {
    push(`包版本断言 "${version}" ≠ package.json "${facts.version}"`);
  }

  // 2. capability-layer progress rows vs module facts
  for (const row of parseProgressRows(statusText)) {
    const lines = productionLineCount(projectRoot, LAYER_DIRS[row.name]);
    if (row.implPercent === 0 && lines >= ZERO_PROGRESS_LINE_THRESHOLD) {
      push(`"${row.name}" 断言实现进度 0%，但 ${LAYER_DIRS[row.name]} 有 ${lines} 行生产代码`);
    } else if (row.implPercent > 0 && lines === 0) {
      push(`"${row.name}" 断言实现进度 ${row.implPercent}%，但 ${LAYER_DIRS[row.name]} 无生产代码`);
    }
  }

  // 3. "N+ 命令/工具" quantity assertions
  const cmd = statusText.match(/(\d+)\+\s*命令/);
  if (cmd && facts.commandCount < Number(cmd[1])) {
    push(`命令数断言 "${cmd[1]}+" > 实际注册 ${facts.commandCount}`);
  }
  const tool = statusText.match(/(\d+)\+\s*工具/);
  if (tool && facts.toolCount < Number(tool[1])) {
    push(`工具数断言 "${tool[1]}+" > 实际注册 ${facts.toolCount}`);
  }

  // 4. freshness (INFO signal, never a conflict)
  const dateStr = statusText.match(/最后更新日期\*{0,2}[:：]\s*(\d{4}-\d{2}-\d{2})/)?.[1];
  if (dateStr) {
    const days = Math.floor(((opts?.now ?? new Date()).getTime() - new Date(`${dateStr}T00:00:00Z`).getTime()) / 86_400_000);
    if (days > (opts?.staleDays ?? 30)) {
      findings.push({
        type: 'status_assertion',
        severity: 'INFO',
        message: `STATUS.md 最后更新距今 ${days} 天（阈值 ${opts?.staleDays ?? 30}）`,
        file: 'docs/STATUS.md',
      });
    }
  }

  return findings;
}

/**
 * fs-level entry: reads docs/STATUS.md (if present) and reconciles against
 * injected CLI/MCP facts plus module facts. Missing or unreadable STATUS.md
 * yields a single visible skip WARN — the blind spot is reported, never silent.
 */
export function detectStatusAssertionDrift(
  projectRoot: string,
  facts: StatusAssertionFacts,
  opts?: StatusAssertionOpts,
): DriftResult[] {
  const statusPath = join(projectRoot, 'docs', 'STATUS.md');
  if (!existsSync(statusPath)) {
    return [{
      type: 'status_assertion',
      severity: 'WARN',
      message: '对账跳过：docs/STATUS.md 不存在',
    }];
  }
  try {
    return checkStatusAssertions(readFileSync(statusPath, 'utf8'), facts, projectRoot, opts);
  } catch (e) {
    return [{
      type: 'status_assertion',
      severity: 'WARN',
      message: `对账跳过：STATUS.md 不可解析（${(e as Error).message}）`,
      file: 'docs/STATUS.md',
    }];
  }
}
