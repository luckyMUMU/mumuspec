/**
 * Unit Tests — design-build-first-pass evaluator (freedom-metrics)
 *
 * Covers ENF-2 of delta-spec freedom-metrics:
 * - 从 state 工件推导一次通过率（rollback_count / rebuild_count）
 * - 空集 → nullResult（不虚构 100%）
 * - 以存在 .mumuspec.yaml 为准，不依赖目录命名（AS-1）
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designBuildFirstPassEvaluator } from '../../../src/core/metrics/design-build-first-pass.js';
import type { EvaluatorContext } from '../../../src/core/metrics/types.js';

const dirs: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumu-firstpass-'));
  dirs.push(dir);
  return dir;
}

function makeCtx(projectRoot: string, changeName = 'fp-probe'): EvaluatorContext {
  return { projectRoot, changeName, roundHistory: [] };
}

function writeState(root: string, parts: string[], yaml: string): void {
  const dir = join(root, '.mumuspec', 'changes', ...parts);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.mumuspec.yaml'), yaml, 'utf8');
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('design-build-first-pass evaluator', () => {
  it('computes first-pass ratio across archive and active changes', async () => {
    const root = makeRoot();
    writeState(root, ['archive', '2026-01-01-a'], 'name: a\nrollback_count: 0\nrebuild_count: 0\n');
    writeState(root, ['archive', '2026-01-02-b'], 'name: b\nrollback_count: 1\nrebuild_count: 0\n');
    writeState(root, ['c-active'], 'name: c\nrollback_count: 0\nrebuild_count: 0\n');

    const result = await designBuildFirstPassEvaluator.evaluate(makeCtx(root));

    expect(result.name).toBe('design-build-first-pass');
    expect(result.weight).toBe(0.2);
    expect(result.value).toBeCloseTo(2 / 3, 6);
    expect(result.rawData).toMatchObject({ firstPass: 2, total: 3 });
  });

  it('ignores directories without .mumuspec.yaml regardless of naming (AS-1)', async () => {
    const root = makeRoot();
    writeState(root, ['archive', '2026-01-01-a'], 'name: a\nrollback_count: 0\nrebuild_count: 0\n');
    // special dir without state file → skipped (not counted, not guessed)
    mkdirSync(join(root, '.mumuspec', 'changes', 'archive', 'discarded'), { recursive: true });
    // state file missing counts fields → defaults to 0 (first pass)
    writeState(root, ['archive', '2026-01-03-d'], 'name: d\n');

    const result = await designBuildFirstPassEvaluator.evaluate(makeCtx(root));

    expect(result.rawData).toMatchObject({ firstPass: 2, total: 2 });
  });

  it('skips unparseable state files instead of miscounting', async () => {
    const root = makeRoot();
    writeState(root, ['archive', '2026-01-01-a'], 'name: a\nrollback_count: 0\nrebuild_count: 0\n');
    writeState(root, ['archive', '2026-01-02-broken'], 'name: broken\nfoo: "unterminated\n');

    const result = await designBuildFirstPassEvaluator.evaluate(makeCtx(root));

    expect(result.rawData).toMatchObject({ firstPass: 1, total: 1 });
  });

  it('returns nullResult when no change states exist', async () => {
    const root = makeRoot();

    const result = await designBuildFirstPassEvaluator.evaluate(makeCtx(root));

    expect(result.value).toBe(0);
    expect(result.weight).toBe(0);
    expect(result.details.length).toBeGreaterThan(0);
  });

  it('does not double-count the archive directory when scanning active changes', async () => {
    const root = makeRoot();
    writeState(root, ['archive', '2026-01-01-a'], 'name: a\nrollback_count: 0\nrebuild_count: 0\n');

    const result = await designBuildFirstPassEvaluator.evaluate(makeCtx(root));

    expect(result.rawData).toMatchObject({ firstPass: 1, total: 1 });
  });
});
