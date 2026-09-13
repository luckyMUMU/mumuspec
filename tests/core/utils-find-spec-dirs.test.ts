/**
 * findSpecDirs 排除面（legacy-cleanup-fix TC-04）。
 * 锁定行为：SKIP_DIRS（含 temp）下的 .mumuspec 子目录不计入规范扫描面。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findSpecDirs } from '../../src/core/utils.js';

let root: string | undefined;

function makeProbe(dir: string): void {
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'spec.md'), '---\nscope: .\nlayer: 0\n---\n# probe\n');
}

afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
    root = undefined;
  }
});

describe('findSpecDirs 排除 SKIP_DIRS（TC-04）', () => {
  it('temp/ 与其他 SKIP_DIRS 下的 .mumuspec 不进入扫描面', () => {
    root = join(tmpdir(), `mumuspec-findspec-${Date.now()}`);
    makeProbe(join(root, 'temp', 'probe', 'cases', 'O1-v0'));
    makeProbe(join(root, 'mods', 'case-b'));
    makeProbe(join(root, 'dist', 'bad'));
    const found = findSpecDirs(root).map((p) => p.slice(root!.length + 1));
    expect(found).toContain(join('mods', 'case-b'));
    expect(found.some((p) => p.includes('temp'))).toBe(false);
    expect(found.some((p) => p.includes('dist'))).toBe(false);
  });
});
