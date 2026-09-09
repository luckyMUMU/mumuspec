/**
 * W3 — 模块注册判定标准统一（CHG 2026-09-09-review-followup-hardening）。
 *
 * 契约："已注册模块" = 目录含 .mumuspec 且内有 prd.md 或 tech.md。
 * checker 的 index_drift 与 rebuildIndexYaml 必须共用同一判定函数，
 * BOUNDARY-only 目录既不入 index 也不触发 index_drift。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isRegisteredSpecModule } from '../../src/core/utils.js';
import { detectDrift } from '../../src/guard/checker.js';

function tmp(): string {
  return join(tmpdir(), `mumu-regmod-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('isRegisteredSpecModule（共享判定）', () => {
  let root: string;
  beforeEach(() => { root = tmp(); });
  afterEach(() => { cleanup(root); });

  it('含 .mumuspec + prd.md → true', () => {
    const d = join(root, 'mod-a');
    mkdirSync(join(d, '.mumuspec'), { recursive: true });
    writeFileSync(join(d, '.mumuspec', 'prd.md'), '# PRD\n');
    expect(isRegisteredSpecModule(d)).toBe(true);
  });

  it('含 .mumuspec + tech.md（无 prd）→ true', () => {
    const d = join(root, 'mod-b');
    mkdirSync(join(d, '.mumuspec'), { recursive: true });
    writeFileSync(join(d, '.mumuspec', 'tech.md'), '# Tech\n');
    expect(isRegisteredSpecModule(d)).toBe(true);
  });

  it('BOUNDARY-only（仅 .mumuspec/BOUNDARY.md）→ false', () => {
    const d = join(root, 'mod-c');
    mkdirSync(join(d, '.mumuspec'), { recursive: true });
    writeFileSync(join(d, '.mumuspec', 'BOUNDARY.md'), '# Boundary\n');
    expect(isRegisteredSpecModule(d)).toBe(false);
  });

  it('无 .mumuspec → false', () => {
    const d = join(root, 'plain');
    mkdirSync(d, { recursive: true });
    expect(isRegisteredSpecModule(d)).toBe(false);
  });
});

describe('checker 与 builder 判定一致（BOUNDARY-only 不触发 index_drift）', () => {
  let root: string;
  beforeEach(() => { root = tmp(); });
  afterEach(() => { cleanup(root); });

  it('BOUNDARY-only 目录未注册进 index → 不报 index_drift', () => {
    const boundaryOnly = join(root, 'src', 'leaf');
    mkdirSync(join(boundaryOnly, '.mumuspec'), { recursive: true });
    writeFileSync(join(boundaryOnly, '.mumuspec', 'BOUNDARY.md'), '# Boundary\n');
    // 根 index 存在（对比基准），但未收录 src/leaf
    mkdirSync(join(root, '.mumuspec'), { recursive: true });
    writeFileSync(join(root, '.mumuspec', 'index.yaml'), 'children: []\n');

    const drifts = detectDrift(root);
    const hit = drifts.find((d) => d.type === 'index_drift' && d.message.includes('src/leaf'));
    expect(hit).toBeUndefined();
  });

  it('已注册模块（含 prd.md）未进 index → 仍必须报 index_drift（回归保护）', () => {
    const mod = join(root, 'src', 'real-mod');
    mkdirSync(join(mod, '.mumuspec'), { recursive: true });
    writeFileSync(join(mod, '.mumuspec', 'prd.md'), '# PRD: real-mod\n');
    mkdirSync(join(root, '.mumuspec'), { recursive: true });
    writeFileSync(join(root, '.mumuspec', 'index.yaml'), 'children: []\n');

    const drifts = detectDrift(root);
    const hit = drifts.find((d) => d.type === 'index_drift' && d.message.includes('src/real-mod'));
    expect(hit).toBeDefined();
  });
});
