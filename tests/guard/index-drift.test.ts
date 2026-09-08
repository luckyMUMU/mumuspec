/**
 * G7b — index drift 全树递归检测。
 *
 * 背景：checkIndexDrift 此前只扫 projectRoot 一层，深层模块（如 src\mcp）
 * 「有 .mumuspec 却未注册进 index.yaml」永远漏检。MumuSpec 的 index.yaml 是
 * 单文件全树注册（children.path 直接挂 src\mcp 这类相对路径），因此递归
 * 收集全树含 .mumuspec 的目录与根 index 双向对比才是正确语义。
 *
 * 本测试同时锁定 G7a 的配套行为：新补规范层的模块注册后不再报 drift。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectDrift } from '../../src/guard/checker.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-idxdrift-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  return dir;
}

function makeSpecDir(root: string, rel: string): void {
  mkdirSync(join(root, rel, '.mumuspec'), { recursive: true });
  writeFileSync(
    join(root, rel, '.mumuspec', 'prd.md'),
    ['---', `title: "PRD: ${rel}"`, 'layer: 2', '---', '', `# PRD: ${rel}`, ''].join('\n'),
  );
}

function writeIndex(root: string, children: Array<{ name: string; path: string }>): void {
  const lines = ['children:'];
  for (const c of children) {
    lines.push(`  - name: ${c.name}`);
    lines.push(`    path: ${c.path}`);
  }
  writeFileSync(join(root, '.mumuspec', 'index.yaml'), lines.join('\n') + '\n');
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('index drift 全树递归检测（G7b）', () => {
  let root: string;

  beforeEach(() => { root = createTmpProject(); });
  afterEach(() => { cleanup(root); });

  it('深层目录（二级以下）有 .mumuspec 但未注册 → 必须报 index_drift', () => {
    makeSpecDir(root, 'src/deep/mod');
    writeIndex(root, []); // 有 index 作对比基准，但未覆盖该目录

    const drifts = detectDrift(root);
    const hit = drifts.find(
      (d) => d.type === 'index_drift' && d.message.includes('src/deep/mod'),
    );
    expect(hit).toBeDefined();
  });

  it('深层目录已注册 → 不报', () => {
    makeSpecDir(root, 'src/deep/mod');
    writeIndex(root, [{ name: 'mod', path: 'src\\deep\\mod' }]);

    const drifts = detectDrift(root);
    expect(drifts.find((d) => d.type === 'index_drift' && d.message.includes('src/deep/mod'))).toBeUndefined();
  });

  it('index 注册了不存在的目录 → 反向报', () => {
    writeIndex(root, [{ name: 'ghost', path: 'src\\ghost' }]);

    const drifts = detectDrift(root);
    const hit = drifts.find(
      (d) => d.type === 'index_drift' && d.message.includes('src\\ghost'),
    );
    expect(hit).toBeDefined();
  });

  it('node_modules 下的 .mumuspec 不参与检测', () => {
    makeSpecDir(root, 'node_modules/fake-pkg');

    const drifts = detectDrift(root);
    expect(drifts.find((d) => d.type === 'index_drift')).toBeUndefined();
  });

  it('一级目录未注册仍报（向后兼容原一层行为）', () => {
    makeSpecDir(root, 'topmod');
    writeIndex(root, []);

    const drifts = detectDrift(root);
    const hit = drifts.find(
      (d) => d.type === 'index_drift' && d.message.includes('topmod'),
    );
    expect(hit).toBeDefined();
  });
});
