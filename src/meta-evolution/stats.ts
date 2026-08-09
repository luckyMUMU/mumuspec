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
import { join } from 'node:path';
import type { CheckRecord } from './types.js';

const STATS_DIR = '.mumuspec/evolution';
const STATS_FILE = 'stats.jsonl';
const MAX_RECORDS = 1000;

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

  const { readText } = await import('../core/utils.js');
  const content = readText(projectRoot, join(STATS_DIR, STATS_FILE));
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

  const { readText, writeText } = await import('../core/utils.js');
  const content = readText(projectRoot, join(STATS_DIR, STATS_FILE));
  if (!content) return;

  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length <= MAX_RECORDS) return;

  // Keep most recent half
  const keep = lines.slice(-Math.floor(MAX_RECORDS / 2));
  // ponytail: simple rotation — lossy but keeps recent data
  writeText(projectRoot, join(STATS_DIR, STATS_FILE), keep.join('\n') + '\n');
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
