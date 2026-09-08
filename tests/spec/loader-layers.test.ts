/**
 * P0-B: loader 层数配置化 — selectLayersToLoad 必须尊重 config.specs.max_layer_depth,
 * 不再硬编码 3 层（spec: "SHALL NOT hardcode a fixed number of layers"）。
 */
import { describe, it, expect, vi } from 'vitest';

// 假链路径在磁盘上不存在 —— mock existsSync 让「含 .mumuspec」过滤全部通过，
// 从而隔离测试纯粹的层数选择逻辑。
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, default: { ...actual }, existsSync: () => true };
});

const { selectLayersToLoad } = await import('../../src/spec/loader.js');

type ChainEntry = { level: number; dirPath: string; scope: string };

const chain = (n: number): ChainEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    level: i,
    dirPath: `/root${i === 0 ? '' : '/l' + i}`,
    scope: i === 0 ? '.' : 'l' + i,
  }));

describe('selectLayersToLoad — max_layer_depth 配置化', () => {
  it('层数 ≤ max_layer_depth 时全量返回', () => {
    const result = selectLayersToLoad(chain(4), 5);
    expect(result).toHaveLength(4);
  });

  it('层数 > max_layer_depth 时降载，但保留 root 与 target', () => {
    const result = selectLayersToLoad(chain(8), 5);
    expect(result).toHaveLength(5);
    expect(result[0].level).toBe(0); // root 保留
    expect(result[result.length - 1].level).toBe(7); // target 保留
  });

  it('max_layer_depth = 3 时行为等同旧硬编码（root+parent+target）', () => {
    const result = selectLayersToLoad(chain(6), 3);
    expect(result.map((r) => r.level)).toEqual([0, 4, 5]);
  });

  it('max_layer_depth = 2 时仅保留 root + target', () => {
    const result = selectLayersToLoad(chain(6), 2);
    expect(result.map((r) => r.level)).toEqual([0, 5]);
  });

  it('非法配置（0 / 负数 / NaN）回退默认 5', () => {
    for (const bad of [0, -3, Number.NaN]) {
      const result = selectLayersToLoad(chain(9), bad);
      expect(result).toHaveLength(5);
      expect(result[0].level).toBe(0);
      expect(result[result.length - 1].level).toBe(8);
    }
  });

  it('空链与单元素链不报错', () => {
    expect(selectLayersToLoad([], 5)).toEqual([]);
    expect(selectLayersToLoad(chain(1), 5)).toHaveLength(1);
  });
});
