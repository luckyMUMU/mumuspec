/**
 * Statistics persistence for Meta-Evolution (R-0005).
 *
 * Records guard check results to `${projectRoot}/.mumuspec/evolution/stats.jsonl`
 * for later effectiveness scoring.
 *
 * ponytail: append-only JSONL; rotation/compaction deferred until data volume
 * exceeds 1000 lines.
 */

import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { readText, writeText } from '../core/utils.js';
import type { CheckRecord } from './types.js';

const STATS_DIR = '.mumuspec/evolution';
const STATS_FILE = 'stats.jsonl';
const MAX_RECORDS = 1000;
const EVOLUTION_ROOT_ENV = 'MUMUSPEC_EVOLUTION_ROOT';

/**
 * Resolve the project root that owns `.mumuspec/evolution/`.
 *
 * Records must land in the MAIN repository root, not a loop worktree:
 * `.mumuspec/evolution/` is not gitignored, so inside a worktree it is an
 * untracked file that would be lost with `worktree remove --force`.
 * Resolution order: `MUMUSPEC_EVOLUTION_ROOT` override → the parent of
 * `git rev-parse --git-common-dir` (main repo root even when cwd is a linked
 * worktree) → caller-supplied projectRoot.
 */
export function resolveEvolutionRoot(projectRoot: string): string {
  const override = process.env[EVOLUTION_ROOT_ENV];
  if (override) return override;

  try {
    const r = spawnSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10_000,
    });
    if (r.status === 0 && r.stdout.trim()) {
      // git-common-dir may be relative to cwd or absolute; resolve handles both.
      return dirname(resolve(projectRoot, r.stdout.trim()));
    }
  } catch {
    // fall through to projectRoot
  }

  return projectRoot;
}

/**
 * Get the stats file path for a project.
 */
export function getStatsFilePath(projectRoot: string): string {
  return join(projectRoot, STATS_DIR, STATS_FILE);
}

/**
 * Record a single check result.
 *
 * Creates the evolution directory if it doesn't exist.
 */
export async function recordCheck(
  projectRoot: string,
  record: Omit<CheckRecord, 'timestamp'>,
): Promise<void> {
  const dir = join(projectRoot, STATS_DIR);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const fullRecord: CheckRecord = {
    timestamp: new Date().toISOString(),
    ...record,
  };

  const filePath = join(dir, STATS_FILE);
  await appendFile(filePath, JSON.stringify(fullRecord) + '\n', 'utf-8');
}

/**
 * Read all check records from the stats file.
 */
export async function readCheckRecords(projectRoot: string): Promise<CheckRecord[]> {
  const filePath = getStatsFilePath(projectRoot);
  if (!existsSync(filePath)) return [];

  const content = readText(filePath);
  if (!content) return [];

  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CheckRecord);
}

/**
 * Rotate stats file if it exceeds MAX_RECORDS.
 *
 * Keeps the most recent MAX_RECORDS / 2 records.
 */
export async function rotateStatsIfNeeded(projectRoot: string): Promise<void> {
  const filePath = getStatsFilePath(projectRoot);
  if (!existsSync(filePath)) return;

  const content = readText(filePath);
  if (!content) return;

  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length <= MAX_RECORDS) return;

  // Keep most recent half
  const keep = lines.slice(-Math.floor(MAX_RECORDS / 2));
  // ponytail: simple rotation — lossy but keeps recent data
  writeText(filePath, keep.join('\n') + '\n');
}

/**
 * Delete all evolution stats (for reset/testing).
 */
export async function clearStats(projectRoot: string): Promise<void> {
  const dir = join(projectRoot, STATS_DIR);
  if (!existsSync(dir)) return;

  const files = await readdir(dir);
  for (const f of files) {
    if (f.startsWith('stats')) {
      await unlink(join(dir, f));
    }
  }
}
