/**
 * engine-consolidation L1 — 通道标记剥离归一（TC-L1-001/002/003）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stripChannelMarker, isRegexCheckable } from '../../src/spec/verifier-classify.js';
import { checkCompliance } from '../../src/guard/checker.js';

describe('stripChannelMarker（TC-L1-001）', () => {
  it('剥 lex:/ast: 前缀并归一空白；无标记原样', () => {
    expect(stripChannelMarker('lex:  Foo BAR')).toBe('Foo BAR');
    expect(stripChannelMarker('ast:x')).toBe('x');
    expect(stripChannelMarker('plain text')).toBe('plain text');
    expect(stripChannelMarker('LEX: mixed case keeps body')).toBe('mixed case keeps body');
  });
  it('isRegexCheckable 对 lex: 前缀与原文同判', () => {
    expect(isRegexCheckable('lex: 禁止 `dangerous()`')).toBe(isRegexCheckable('禁止 `dangerous()`'));
  });
});

describe('执行路径等价（TC-L1-002，经 checkCompliance 端到端）', () => {
  let root: string;
  const sysItem = 'The system SHALL NOT enforce `single_active_change` globally when per-scope enforcement is active';

  function specWith(itemLine: string): string {
    return `---
layer: 0
scope: "."
last_updated: "2026-09-20"
---

## Requirement: Gate Fixtures

### SHALL NOT
- ${itemLine}

### Enforcement
- ENF-1: manual(端到端等价断言)
`;
  }

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'lex-exempt-'));
    mkdirSync(join(root, '.mumuspec'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'a.ts'), 'export const cfg = { single_active_change: true };\n');
  });

  it('系统行为条目带 lex: 前缀与不带前缀同样被豁免（不误报 E-GUARD-003）', () => {
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specWith(sysItem));
    const plain = checkCompliance(root, { shallNot: true });
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specWith('lex: ' + sysItem));
    const prefixed = checkCompliance(root, { shallNot: true });
    const hits = (r: typeof plain) => r.errors.filter((e) => e.code === 'E-GUARD-003').length;
    expect(hits(plain)).toBe(0);
    expect(hits(prefixed)).toBe(0);
  });

  it('普通词法红线带前缀仍真实扫描（豁免不是万能免检）', () => {
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specWith('禁止 `eval()` 动态执行'));
    const plain = checkCompliance(root, { shallNot: true });
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specWith('lex: 禁止 `eval()` 动态执行'));
    const prefixed = checkCompliance(root, { shallNot: true });
    // 两条同文（仅前缀差）对同一 src 的命中数一致
    expect(prefixed.errors.filter((e) => e.code === 'E-GUARD-003').length)
      .toBe(plain.errors.filter((e) => e.code === 'E-GUARD-003').length);
  });
});

describe('agent 行为豁免等价（TC-L0-001，兑现 TC-L1-002 第 2 行）', () => {
  let selfRoot: string;
  let plainRoot: string;
  const agentItem = '禁止以 `--force` 越过 E-SPEC-015';
  const srcCode = "execSync('mumuspec state transition demo build --force');\n";

  function specWith(itemLine: string): string {
    return `---
layer: 0
scope: "."
last_updated: "2026-09-20"
---

## Requirement: Agent Behavior Fixtures

### SHALL NOT
- ${itemLine}

### Enforcement
- ENF-1: manual(端到端等价断言)
`;
  }

  beforeAll(() => {
    selfRoot = mkdtempSync(join(tmpdir(), 'agent-exempt-self-'));
    writeFileSync(join(selfRoot, 'package.json'), JSON.stringify({ name: 'mumuspec' }));
    mkdirSync(join(selfRoot, '.mumuspec'), { recursive: true });
    mkdirSync(join(selfRoot, 'src'), { recursive: true });
    writeFileSync(join(selfRoot, 'src', 'a.ts'), srcCode);

    plainRoot = mkdtempSync(join(tmpdir(), 'agent-exempt-plain-'));
    mkdirSync(join(plainRoot, '.mumuspec'), { recursive: true });
    mkdirSync(join(plainRoot, 'src'), { recursive: true });
    writeFileSync(join(plainRoot, 'src', 'a.ts'), srcCode);
  });

  it('自仓 src/：带/不带 lex: 前缀同样触发 agent 行为豁免（0 E-GUARD-003）', () => {
    writeFileSync(join(selfRoot, '.mumuspec', 'spec.md'), specWith(agentItem));
    const plain = checkCompliance(selfRoot, { shallNot: true });
    writeFileSync(join(selfRoot, '.mumuspec', 'spec.md'), specWith('lex: ' + agentItem));
    const prefixed = checkCompliance(selfRoot, { shallNot: true });
    const hits = (r: ReturnType<typeof checkCompliance>) =>
      r.errors.filter((e) => e.code === 'E-GUARD-003').length;
    expect(hits(plain)).toBe(0);
    expect(hits(prefixed)).toBe(0);
  });

  it('非自仓同夹具必命中（豁免非空转），且带/不带前缀命中一致', () => {
    writeFileSync(join(plainRoot, '.mumuspec', 'spec.md'), specWith(agentItem));
    const plain = checkCompliance(plainRoot, { shallNot: true });
    writeFileSync(join(plainRoot, '.mumuspec', 'spec.md'), specWith('lex: ' + agentItem));
    const prefixed = checkCompliance(plainRoot, { shallNot: true });
    const hits = (r: ReturnType<typeof checkCompliance>) =>
      r.errors.filter((e) => e.code === 'E-GUARD-003').length;
    expect(hits(plain)).toBe(hits(prefixed));
    expect(hits(prefixed)).toBeGreaterThanOrEqual(1);
  });
});
