/**
 * engine-consolidation L2 — behavior-gate 五态核验与发射面（TC-L2-001/002）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveGate, buildCorpusGateIndex } from '../../src/guard/gate-validator.js';
import { classifyConstraintEntry } from '../../src/spec/verifier-classify.js';
import { checkCompliance } from '../../src/guard/checker.js';
import { ERROR_CODES } from '../../src/core/errors.js';

const CODES = new Set(['E-SPEC-015', 'E-SPEC-004']);

describe('resolveGate 五态（TC-L2-001）', () => {
  const corpus = { codes: new Set(['E-SPEC-015']), fixtures: new Set(['bad-spec-016']) };

  it('码已注册且有语料命中 → ok', () => {
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'error-code:E-SPEC-015' }, CODES, corpus).ok).toBe(true);
  });
  it('码未注册 → fail unregistered', () => {
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'error-code:E-BOGUS-999' }, CODES, corpus).ok).toBe(false);
  });
  it('码注册但无语料 → fail no-corpus', () => {
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'error-code:E-SPEC-004' }, CODES, corpus).ok).toBe(false);
  });
  it('fixture 存在且声明非空 → ok；缺失 → fail', () => {
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'corpus:bad-spec-016' }, CODES, corpus).ok).toBe(true);
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'corpus:no-such' }, CODES, corpus).ok).toBe(false);
  });
  it('gate_ref 缺失或形态不识别 → fail（fail-closed）', () => {
    expect(resolveGate({ type: 'behavior-gate' }, CODES, corpus).ok).toBe(false);
    expect(resolveGate({ type: 'behavior-gate', gate_ref: 'unit-test:foo' }, CODES, corpus).ok).toBe(false);
  });
});

describe('buildCorpusGateIndex（fs）', () => {
  it('聚合 fixture 名与其 mustContain 码', () => {
    const root = mkdtempSync(join(tmpdir(), 'gate-index-'));
    const fx = join(root, '.eval-corpus', 'bad-x');
    mkdirSync(fx, { recursive: true });
    writeFileSync(join(fx, 'expected.yaml'), 'kind: bad-case\nprobe: check\nmustContain: [E-SPEC-015]\n');
    const idx = buildCorpusGateIndex(root);
    expect(idx.fixtures.has('bad-x')).toBe(true);
    expect(idx.codes.has('E-SPEC-015')).toBe(true);
  });
});

describe('分类与发射（TC-L2-002）', () => {
  it('behavior-gate 注解条目 → enforced-strong（与 custom 区分）', () => {
    expect(classifyConstraintEntry({
      id: 'G1', content: 'x', enforcement: '',
      annotation: { type: 'behavior-gate', gate_ref: 'error-code:E-SPEC-015' },
    })).toBe('enforced-strong');
  });

  let root: string;
  const specFor = (gateRef: string) => `---
layer: 0
scope: "."
last_updated: "2026-09-20"
prohibitions:
  - text: "禁止以 --force 越过 E-SPEC-015 红线"
    annotation:
      type: behavior-gate
      gate_ref: "${gateRef}"
---

## Requirement: Gate Check

### SHALL NOT
- 禁止以 --force 越过 E-SPEC-015 红线

### Enforcement
- ENF-1: manual(悬空即阻断断言)
`;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'gate-emit-'));
    mkdirSync(join(root, '.mumuspec'), { recursive: true });
    const fx = join(root, '.eval-corpus', 'bad-spec-016');
    mkdirSync(fx, { recursive: true });
    writeFileSync(join(fx, 'expected.yaml'), 'kind: bad-case\nprobe: check\nmustContain: [E-SPEC-015]\n');
  });

  it('悬空指针 → E-GUARD-013 恒发（forceable:false）', () => {
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specFor('error-code:E-BOGUS-999'));
    const r = checkCompliance(root, {});
    const hit = r.errors.filter((e) => e.code === 'E-GUARD-013');
    expect(hit.length).toBeGreaterThanOrEqual(1);
    expect(r.passed).toBe(false);
  });

  it('合法指针（码+本地语料）→ 无 013 且计入 strong', () => {
    writeFileSync(join(root, '.mumuspec', 'spec.md'), specFor('error-code:E-SPEC-015'));
    const r = checkCompliance(root, {});
    expect(r.errors.filter((e) => e.code === 'E-GUARD-013')).toHaveLength(0);
    expect(r.coverage!.enforced_strong).toBeGreaterThanOrEqual(1);
  });
});

describe('E-GUARD-013 注册元数据（TC-L0-002）', () => {
  it('ERROR / forceable:false / always_enforce:true（红线属性防翻改）', () => {
    const def = ERROR_CODES['E-GUARD-013'];
    expect(def).toBeDefined();
    expect(def?.severity).toBe('ERROR');
    expect(def?.forceable).toBe(false);
    expect(def?.always_enforce).toBe(true);
  });
});
