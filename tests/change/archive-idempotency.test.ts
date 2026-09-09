/**
 * W2 — archive 幂等化（CHG 2026-09-09-review-followup-hardening）。
 *
 * 背景：二评实测 Windows renameSync EPERM（目标目录已存在时 dir→dir rename
 * 在 Windows 上失败）导致重试后版本连跳 4 次。修复三件套：
 *   1. moveDirSync：existing-empty-target 先清再 rename；EPERM/EXDEV 降级 copy+delete；
 *   2. bump 后置到 rename 成功之后；
 *   3. bump 幂等标记（归档目录 .version-bumped），重复调用只 bump 一次。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { moveDirSync, bumpVersionForArchiveIdempotent } from '../../src/change/archive.js';

function tmp(): string {
  return join(tmpdir(), `mumu-archidem-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('moveDirSync（EPERM 回退 + existing-empty-target 处理）', () => {
  let root: string;
  beforeEach(() => { root = tmp(); });
  afterEach(() => { cleanup(root); });

  it('目标不存在 → 纯 rename 迁移', () => {
    const from = join(root, 'a');
    const to = join(root, 'b');
    mkdirSync(from, { recursive: true });
    writeFileSync(join(from, 'x.txt'), 'hello');

    moveDirSync(from, to);

    expect(existsSync(from)).toBe(false);
    expect(readFileSync(join(to, 'x.txt'), 'utf8')).toBe('hello');
  });

  it('目标为已存在空目录（Windows EPERM 实测触发场景）→ 先清后迁移，内容完整', () => {
    const from = join(root, 'src-change');
    const to = join(root, 'archived');
    mkdirSync(join(from, 'nested'), { recursive: true });
    writeFileSync(join(from, 'state.yaml'), 'name: demo');
    writeFileSync(join(from, 'nested', 'deep.txt'), 'deep');
    mkdirSync(to, { recursive: true }); // ← 旧代码的 ensureDir 先行，正是 EPERM 根因

    moveDirSync(from, to);

    expect(existsSync(from)).toBe(false);
    expect(readFileSync(join(to, 'state.yaml'), 'utf8')).toBe('name: demo');
    expect(readFileSync(join(to, 'nested', 'deep.txt'), 'utf8')).toBe('deep');
  });

  it('rename 不可行时降级 copy+delete（跨目录树内容不丢失）', () => {
    const from = join(root, 'from');
    const to = join(root, 'to', 'target'); // 父目录不存在，rename 会因 EXDEV/ENOENT 场景走回退
    mkdirSync(from, { recursive: true });
    writeFileSync(join(from, 'f.txt'), 'payload');

    moveDirSync(from, to);

    expect(existsSync(from)).toBe(false);
    expect(readFileSync(join(to, 'f.txt'), 'utf8')).toBe('payload');
  });
});

describe('bumpVersionForArchiveIdempotent（标记防重放）', () => {
  let root: string;
  let archivedDir: string;

  beforeEach(() => {
    root = tmp();
    archivedDir = join(root, 'archived', '2026-09-09-demo');
    mkdirSync(join(archivedDir), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"name":"m","version":"1.0.0"}\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'cli.ts'), ".version('1.0.0')\n");
  });
  afterEach(() => { cleanup(root); });

  it('首次调用 bump 并写标记；重复调用被标记拦截', () => {
    const v1 = bumpVersionForArchiveIdempotent(archivedDir, root, 'full', 'demo');
    expect(v1).toBe('1.0.1-alpha.0');
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('1.0.1-alpha.0');
    expect(existsSync(join(archivedDir, '.version-bumped'))).toBe(true);

    // 模拟重放：把 package.json 手工改回旧版（环境恢复场景），标记仍在
    writeFileSync(join(root, 'package.json'), '{"name":"m","version":"1.0.0"}\n');
    const v2 = bumpVersionForArchiveIdempotent(archivedDir, root, 'full', 'demo');
    expect(v2).toBeNull();
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('1.0.0');
  });

  it('bump 失败（缺 package.json）不写标记，可安全重试', () => {
    const bare = join(root, 'archived', 'bare');
    mkdirSync(bare, { recursive: true });
    const noPkgRoot = tmp();
    try {
      const v = bumpVersionForArchiveIdempotent(bare, noPkgRoot, 'full', 'bare-demo');
      expect(v).toBeNull();
      expect(existsSync(join(bare, '.version-bumped'))).toBe(false);
    } finally {
      cleanup(noPkgRoot);
    }
  });
});
