/**
 * Tests for 0.20 CLI-first deterministic helpers (src/change/lifecycle.ts):
 *   - lockTestSuite — per-layer suite hash locking into state.suites_hash
 *   - getNextTask   — first-unchecked-task locator for tasks.md
 *
 * Design reference: review/pipeline-cli-first-analysis-2026-08-29.md §候选 A1/A2.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lockTestSuite, getNextTask } from '../../src/change/lifecycle.js';

const STATE = [
  'name: cli-test',
  'phase: build',
  'workflow: full',
  'created_at: "2026-08-29T00:00:00.000Z"',
  'updated_at: "2026-08-29T00:00:00.000Z"',
  'affected_scopes:',
  '  - "."',
  'build_layers: []',
  'test_cases:',
  '  design_locked: true',
  '  suites_locked: false',
  '  suites_locked_layers: []',
  '  suites_hash: {}',
  'rollback_count: 0',
  'rebuild_count: 0',
  'rollback_limit: 3',
  'rebuild_limit: 5',
  'build_mode: incremental',
  'tdd_mode: tdd',
  'isolation: worktree',
].join('\n');

describe('lockTestSuite', () => {
  let dir: string;
  const changeDir = () => join(dir, '.mumuspec', 'changes', 'cli-test');

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-suite-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(changeDir(), 'test-cases'), { recursive: true });
    writeFileSync(join(changeDir(), '.mumuspec.yaml'), STATE);
    writeFileSync(join(changeDir(), 'test-cases', 'layer-1-cases.md'), '# Layer 1\n- case a\n');
    writeFileSync(join(changeDir(), 'test-cases', 'layer-2-cases.md'), '# Layer 2\n- case b\n');
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('locks one layer hash and reports pending layers', () => {
    const { hash, allLocked, pendingLayers } = lockTestSuite(dir, 'cli-test', 1);
    expect(hash).toBeTruthy();
    expect(allLocked).toBe(false);
    expect(pendingLayers).toEqual([2]);
    // re-lock stability: same content → same hash
    const again = lockTestSuite(dir, 'cli-test', 1);
    expect(again.hash).toBe(hash);
  });

  it('marks suites_locked=true only when every suite file is locked', () => {
    lockTestSuite(dir, 'cli-test', 1);
    const second = lockTestSuite(dir, 'cli-test', 2);
    expect(second.allLocked).toBe(true);
    expect(second.pendingLayers).toEqual([]);
  });

  it('throws for a missing suite file', () => {
    expect(() => lockTestSuite(dir, 'cli-test', 9)).toThrow(/Test suite not found/);
  });

  it('hash changes when the suite content changes (drift is detectable)', () => {
    const first = lockTestSuite(dir, 'cli-test', 1).hash;
    writeFileSync(join(changeDir(), 'test-cases', 'layer-1-cases.md'), '# Layer 1\n- case a2\n');
    const second = lockTestSuite(dir, 'cli-test', 1).hash;
    expect(second).not.toBe(first);
  });
});

describe('getNextTask', () => {
  let dir: string;
  const changeDir = () => join(dir, '.mumuspec', 'changes', 'cli-test');

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-tasks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(changeDir(), { recursive: true });
    writeFileSync(join(changeDir(), '.mumuspec.yaml'), STATE);
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('locates the first unchecked item with line number and counts', () => {
    writeFileSync(join(changeDir(), 'tasks.md'), [
      '# Tasks',
      '',
      '- [x] done item',
      '- [ ] first pending',
      '- [ ] second pending',
      '',
    ].join('\n'));
    const r = getNextTask(dir, 'cli-test');
    expect(r.firstUnchecked).toEqual({ line: 4, text: 'first pending' });
    expect(r.remaining).toBe(2);
    expect(r.total).toBe(3);
  });

  it('reports zero remaining when all items are checked', () => {
    writeFileSync(join(changeDir(), 'tasks.md'), '- [x] a\n- [X] b\n');
    const r = getNextTask(dir, 'cli-test');
    expect(r.firstUnchecked).toBeNull();
    expect(r.remaining).toBe(0);
    expect(r.total).toBe(2);
  });

  it('handles empty checklists', () => {
    writeFileSync(join(changeDir(), 'tasks.md'), '# Tasks\n\n(no items)\n');
    const r = getNextTask(dir, 'cli-test');
    expect(r.total).toBe(0);
    expect(r.firstUnchecked).toBeNull();
  });

  it('throws when tasks.md does not exist', () => {
    expect(() => getNextTask(dir, 'cli-test')).toThrow(/tasks.md not found/);
  });
});
