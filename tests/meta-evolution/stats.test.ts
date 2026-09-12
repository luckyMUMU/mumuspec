/**
 * Tests for stats persistence + evolution-root resolution (self-improvement-loop-p0 P0-1).
 *
 * - recordCheck / readCheckRecords round trip on real temp dirs
 * - resolveEvolutionRoot: env override / git-common-dir / fallback
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { recordCheck, readCheckRecords, resolveEvolutionRoot } from '../../src/meta-evolution/stats.js';

const ENV_KEY = 'MUMUSPEC_EVOLUTION_ROOT';

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'mumuspec-stats-'));
}

describe('recordCheck / readCheckRecords', () => {
  let root: string;

  beforeEach(() => { root = freshRoot(); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('round-trips a CheckRecord (adds timestamp)', async () => {
    await recordCheck(root, { constraintId: 'guard:design', passed: true, falsePositive: false });

    const records = await readCheckRecords(root);
    expect(records).toHaveLength(1);
    expect(records[0].constraintId).toBe('guard:design');
    expect(records[0].passed).toBe(true);
    expect(records[0].falsePositive).toBe(false);
    expect(records[0].timestamp).toBeTruthy();
  });

  it('appends multiple records (JSONL)', async () => {
    await recordCheck(root, { constraintId: 'guard:build', passed: true, falsePositive: false });
    await recordCheck(root, { constraintId: 'guard:verify:force', passed: false, falsePositive: true });

    const records = await readCheckRecords(root);
    expect(records).toHaveLength(2);
    expect(records[1].constraintId).toBe('guard:verify:force');
    expect(records[1].falsePositive).toBe(true);
  });

  it('returns empty array when no stats file exists', async () => {
    expect(await readCheckRecords(root)).toEqual([]);
  });
});

describe('resolveEvolutionRoot', () => {
  let root: string;
  const originalEnv = process.env[ENV_KEY];

  beforeEach(() => { root = freshRoot(); });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (originalEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalEnv;
  });

  it('prefers MUMUSPEC_EVOLUTION_ROOT override', () => {
    process.env[ENV_KEY] = '/override/path';
    expect(resolveEvolutionRoot(root)).toBe('/override/path');
  });

  it('resolves git-common-dir parent in a git repo when no override', () => {
    // 普通仓库：git-common-dir == '.git' → resolver 返回仓库根
    spawnSync('git', ['init'], { cwd: root, encoding: 'utf-8' });
    expect(resolveEvolutionRoot(root)).toBe(root);
  });

  it('falls back to projectRoot when not a git repo', () => {
    expect(resolveEvolutionRoot(root)).toBe(root);
  });
});