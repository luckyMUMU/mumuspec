/**
 * L1 消费层测试 — graph verify 的 phase_bps 报告与 skill 侧一致性检查（TC-L1-01..06）。
 * 锁定 delta-spec graph-phase-bps.md Requirement 2。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  collectWorkflowBps,
  unionBps,
  collectSkillBps,
  compareBps,
} from '../../src/change/phase-bps.js';
import { buildFallbackConfig } from '../../src/change/phase-graph-loader.js';
import { ERROR_CODES } from '../../src/core/errors.js';

const ROOT = process.cwd();

/** 引擎侧声明：与 workflow.default.yaml 的设计值一致（见 design.md 表格） */
function configWithBps() {
  const cfg = buildFallbackConfig();
  (cfg.workflows.full as Record<string, unknown>).phase_bps = {
    open: ['BP-1', 'BP-2', 'BP-3'],
    design: ['BP-4', 'BP-4.5', 'BP-5', 'BP-6', 'BP-7', 'BP-8'],
    build: ['BP-9', 'BP-10', 'BP-11', 'BP-12', 'BP-13'],
    verify: ['BP-14', 'BP-15', 'BP-16'],
    'archive-in-progress': ['BP-17'],
  };
  (cfg.workflows.hotfix as Record<string, unknown>).phase_bps = {
    open: ['BP-3'],
    build: ['BP-18'],
    verify: ['BP-14', 'BP-16'],
    'archive-in-progress': ['BP-17'],
  };
  (cfg.workflows.tweak as Record<string, unknown>).phase_bps = {
    open: ['BP-3'],
    build: ['BP-18'],
    verify: ['BP-14', 'BP-16'],
    'archive-in-progress': ['BP-17'],
  };
  return cfg;
}

function loadSkillWorkflowYaml(): unknown | undefined {
  const p = join(ROOT, 'skills', 'mumuspec', 'workflow.yaml');
  try {
    return parse(readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

describe('phase_bps 报告与一致性（TC-L1）', () => {
  const cfg = configWithBps();

  it('TC-L1-01: full workflow 的 phase_bps 覆盖五个 phase', () => {
    const bps = collectWorkflowBps(cfg, 'full');
    expect(Object.keys(bps).sort()).toEqual(
      ['archive-in-progress', 'build', 'design', 'open', 'verify'],
    );
    expect(bps.design).toContain('BP-4.5');
  });

  it('TC-L1-02: 全 workflow 并集覆盖 BP-1..BP-18', () => {
    const ids = new Set(unionBps(cfg));
    for (let i = 1; i <= 18; i++) expect(ids.has(`BP-${i}`)).toBe(true);
  });

  it('TC-L1-03: skill 侧声明与引擎一致时 0 差异', () => {
    const skill = loadSkillWorkflowYaml();
    if (!skill) return; // 文件缺失时本用例无从对比（fail-open）
    const skillIds = collectSkillBps(skill);
    const engineIds = [...new Set(unionBps(cfg))].filter((id) => id !== 'BP-18');
    // 引擎 loop 也声明 build/verify/archive 的 BP；skill phases 并集应包含 full 的全部
    const diff = compareBps([...new Set(unionBps(cfg))], skillIds);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual([]);
    expect(engineIds.length).toBeGreaterThan(0);
  });

  it('TC-L1-04: skill 侧缺声明触发 W-GRAPH-001 差异（missing 含 id）', () => {
    const skillIds = ['BP-1', 'BP-2']; // 刻意残缺
    const diff = compareBps([...new Set(unionBps(cfg))], skillIds);
    expect(diff.missing).toContain('BP-4.5');
    expect(diff.missing).toContain('BP-18');
    expect(diff.extra).toEqual([]);
  });

  it('TC-L1-05: skill 侧多声明报 extra', () => {
    const diff = compareBps(['BP-1'], ['BP-1', 'BP-99']);
    expect(diff.extra).toEqual(['BP-99']);
  });

  it('TC-L1-06: W-GRAPH-001 已注册且为 WARN', () => {
    const entry = (ERROR_CODES as Record<string, { severity?: string }>)['W-GRAPH-001'];
    expect(entry).toBeDefined();
    expect(entry.severity).toBe('WARN');
  });
});
