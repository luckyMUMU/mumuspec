/**
 * W3 配套修复 — 动态执行 lexical 通道词边界（build 期发现）。
 *
 * 背景：上 CHG 合并的 SHALL NOT「禁止建议逻辑绕过 evaluator 结果自行采样」
 * 含 "evaluator"，被 includes('eval') 子串判定误判为动态执行类禁令，
 * 将 eval 域 runner 的 new Function 断言执行器标记为 E-GUARD-003（假阳性）。
 * 修复后：仅独立词 "eval"（\beval\b）或"动态执行"才启用该通道。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompliance } from '../../src/guard/checker.js';
import { isRegexCheckable } from '../../src/spec/verifier-classify.js';

function tmp(): string {
  return join(tmpdir(), `mumu-evalwb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function makeProject(root: string, prohibition: string, code: string): void {
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  writeFileSync(
    join(root, '.mumuspec', 'spec.md'),
    [
      '---',
      'scope: .',
      'layer: 0',
      'last_updated: 2026-09-09',
      '---',
      '',
      '# Spec',
      '',
      '## Requirement: demo',
      '',
      '### SHALL NOT',
      '',
      `- ${prohibition}`,
      '',
    ].join('\n'),
    'utf8',
  );
  mkdirSync(join(root, 'src', 'mod'), { recursive: true });
  writeFileSync(join(root, 'src', 'mod', 'a.ts'), code, 'utf8');
}

describe('动态执行通道词边界（eval ⊄ evaluator）', () => {
  let root: string;
  beforeEach(() => { root = tmp(); });
  afterEach(() => { cleanup(root); });

  it('禁令含 "evaluator" + 代码含 new Function → 不报 E-GUARD-003', () => {
    makeProject(
      root,
      '禁止建议逻辑绕过 evaluator 结果自行采样（建议必须引用本轮 metric 数值）。',
      'const fn = new Function("errors", "return errors.length === 0");\n',
    );
    const result = checkCompliance(root, { shallNot: true });
    expect(result.errors.find((e) => e.code === 'E-GUARD-003')).toBeUndefined();
  });

  it('禁令含独立词 "eval" + 代码含 new Function → 仍必须报 E-GUARD-003', () => {
    makeProject(
      root,
      '禁止使用 eval 动态执行字符串构造逻辑。',
      'const fn = new Function("errors", "return errors.length === 0");\n',
    );
    const result = checkCompliance(root, { shallNot: true });
    expect(result.errors.find((e) => e.code === 'E-GUARD-003')).toBeDefined();
  });

  it('isRegexCheckable：evaluator 不启用动态执行通道；eval 启用', () => {
    expect(isRegexCheckable('禁止建议逻辑绕过 evaluator 结果自行采样')).toBe(false);
    expect(isRegexCheckable('禁止使用 eval 执行动态字符串')).toBe(true);
  });
});
