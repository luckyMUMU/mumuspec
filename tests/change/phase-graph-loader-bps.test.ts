/**
 * L0 数据层测试 — workflows.<wf>.phase_bps 可选段（TC-L0-01..06）。
 * 锁定 delta-spec graph-phase-bps.md Requirement 1。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseWorkflowConfig,
  loadWorkflowConfig,
  buildFallbackConfig,
} from '../../src/change/phase-graph-loader.js';
import type { WorkflowConfig } from '../../src/change/phase-graph.js';

function withBps(bps: unknown): WorkflowConfig {
  const cfg = buildFallbackConfig();
  (cfg.workflows.full as Record<string, unknown>).phase_bps = bps;
  return cfg;
}

const VALID_BPS = {
  open: ['BP-1', 'BP-2', 'BP-3'],
  design: ['BP-4', 'BP-4.5', 'BP-5', 'BP-6', 'BP-7', 'BP-8'],
  build: ['BP-9', 'BP-10', 'BP-11', 'BP-12', 'BP-13'],
  verify: ['BP-14', 'BP-15', 'BP-16'],
  'archive-in-progress': ['BP-17'],
};

describe('phase_bps loader 校验（TC-L0）', () => {
  it('TC-L0-01: 合法 phase_bps 解析通过且原样保留', () => {
    const yaml = JSON.stringify(withBps(VALID_BPS));
    const cfg = parseWorkflowConfig(yaml);
    expect(cfg.workflows.full.phase_bps).toEqual(VALID_BPS);
  });

  it('TC-L0-02: 缺 phase_bps 向后兼容（0 错误）', () => {
    const cfg = buildFallbackConfig();
    const yaml = JSON.stringify(cfg);
    expect(() => parseWorkflowConfig(yaml)).not.toThrow();
    expect(cfg.workflows.full.phase_bps).toBeUndefined();
  });

  it('TC-L0-03: 未知 phase 键报错且含键名', () => {
    const bad = { ...VALID_BPS, launch: ['BP-99'] };
    expect(() => parseWorkflowConfig(JSON.stringify(withBps(bad)))).toThrow(/launch/);
  });

  it('TC-L0-04: BP id 格式非法报错且含 id', () => {
    const bad = { ...VALID_BPS, open: ['BP-x'] };
    expect(() => parseWorkflowConfig(JSON.stringify(withBps(bad)))).toThrow(/BP-x/);
  });

  it('TC-L0-05: BP id 全局重复报错', () => {
    const bad = {
      ...VALID_BPS,
      verify: ['BP-14', 'BP-15', 'BP-16', 'BP-3'],
    };
    expect(() => parseWorkflowConfig(JSON.stringify(withBps(bad)))).toThrow(/BP-3/);
  });

  it('TC-L0-06: 非法结构走 fail-safe（warn + 内置默认，不抛异常）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mumuspec-bps-'));
    const file = join(dir, 'wf.yaml');
    writeFileSync(file, JSON.stringify(withBps({ open: 'not-an-array' })));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const cfg = loadWorkflowConfig(file);
      expect(cfg).toEqual(buildFallbackConfig());
    } finally {
      warn.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
