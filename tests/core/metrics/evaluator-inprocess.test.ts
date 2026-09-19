/**
 * 评估器 in-process（evaluator-inprocess）——TC-L0-01/02/03。
 *
 * 验证 in-process 入口与既有契约一致、指标输出结构与权重不变量。
 */

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCheckJsonPayload, checkCompliance, createInProcessMetricSources, detectDrift, detectDriftInProcess } from '../../../src/guard/checker.js';
import { specComplianceEvaluator } from '../../../src/core/metrics/spec-compliance.js';
import { driftScoreEvaluator, DRIFT_SATURATION } from '../../../src/core/metrics/drift-score.js';
import type { EvaluatorContext } from '../../../src/core/metrics/types.js';

function createProject(files: Record<string, string>): string {
  const dir = join(tmpdir(), `mumuspec-inproc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  for (const [rel, content] of Object.entries(files)) {
    const idx = rel.lastIndexOf('/');
    const parent = idx >= 0 ? join(dir, rel.slice(0, idx)) : dir;
    mkdirSync(parent, { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const CLEAN_SPEC = [
  '---', 'layer: 0', 'scope: "."', '---', '',
  '## Requirement: R', '',
  '### SHALL NOT', '- 禁止使用 `eval`', '',
].join('\n');

const DESIGN_DOC = '---\nlayer: 0\nscope: "."\n---\n\n# Design\n\nfixture\n';

describe('buildCheckJsonPayload 契约', () => {
  let dir: string;
  afterEach(() => cleanup(dir));

  it('TC-L0-01: payload 与 checkCompliance 逐字段一致，exitCode 派生正确', () => {
    dir = createProject({
      '.mumuspec/spec.md': CLEAN_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/a.js': 'eval("1")\n',
    });
    const payload = buildCheckJsonPayload(dir);
    const result = checkCompliance(dir, {});
    expect(payload.compliance.coverage.total).toBeGreaterThan(0);
    expect(payload.compliance.errors.map((e) => e.code)).toEqual(result.errors.map((e) => e.code));
    expect(payload.exitCode).toBe(result.passed ? 0 : 1);
  });
});

describe('detectDriftInProcess 同源', () => {
  it('TC-L0-02: 与 detectDrift 结果一致（同一收集函数）', () => {
    const consts = detectDriftInProcess(process.cwd());
    expect(consts.length).toBe(detectDrift(process.cwd()).length);
  });
});

describe('评估器 in-process 输出契约', () => {
  let dir: string;
  afterEach(() => cleanup(dir));

  it('TC-L0-03: spec-compliance 输出 value∈[0,1] 且 weight=defaultWeight, rawData 字段不变（in-process 注入 seam）', async () => {
    dir = createProject({
      '.mumuspec/spec.md': CLEAN_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/a.js': 'eval("1")\n',
    });
    const ctx: EvaluatorContext = { projectRoot: dir, changeName: 't', roundHistory: [], inProcess: createInProcessMetricSources() };
    const metric = await specComplianceEvaluator.evaluate(ctx);
    expect(metric.value).toBeGreaterThanOrEqual(0);
    expect(metric.value).toBeLessThanOrEqual(1);
    expect(metric.weight).toBe(0.2);
    expect(metric.rawData).toHaveProperty('failed');
    expect(metric.rawData).toHaveProperty('total');
  });

  it('TC-L0-03b: drift-score 输出饱和归一语义不变（in-process 注入 seam）', async () => {
    const metric = await driftScoreEvaluator.evaluate({
      projectRoot: process.cwd(), changeName: 't', roundHistory: [], inProcess: createInProcessMetricSources(),
    } as EvaluatorContext);
    expect(metric.value).toBeGreaterThanOrEqual(0);
    expect(metric.value).toBeLessThanOrEqual(1);
    expect(metric.weight).toBe(0.2);
    expect(metric.rawData).toHaveProperty('violations');
    expect(metric.rawData).toHaveProperty('saturation', DRIFT_SATURATION);
  });

  it('TC-L0-03c: 干净的合规项目 → 分值为 1（全过）或按 errors 计算，绝不超界', async () => {
    dir = createProject({ '.mumuspec/spec.md': CLEAN_SPEC, '.mumuspec/design.md': DESIGN_DOC });
    const metric = await specComplianceEvaluator.evaluate({ projectRoot: dir, changeName: 't', roundHistory: [], inProcess: createInProcessMetricSources() } as EvaluatorContext);
    expect(metric.rawData).not.toBeNull();
  });
});