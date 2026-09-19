/**
 * enforcement-gap L1 — constraints.yaml 条目的执行面端到端（TC-L1-004/005）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompliance } from '../../src/guard/checker.js';

let root: string;

const SPEC = `---
layer: 0
scope: "."
last_updated: "2026-09-19"
---

## Requirement: Fixture Baseline

### SHALL
- SHALL keep this fixture spec minimal.

### Enforcement
- ENF-1: manual(fixture reviewer sign-off)
`;

const CONSTRAINTS = `version: "0.2.0"
last_updated: "2026-09-19"
forward:
  technical_design:
    - id: FE-1
      content: "全局可变状态必须经模块封装"
      min_strength: high
      enforcement: ""
      annotation:
        type: no-mutable-state
        scope: module
reverse:
  technical_design:
    - id: RE-1
      content: "禁止顶层可变状态扩散"
      min_strength: high
      enforcement: ""
      annotation:
        type: no-mutable-state
        scope: module
`;

const VIOLATION = 'let counter = 0;\nexport function bump(): number { counter += 1; return counter; }\n';
const CLEAN = 'export function add(a: number, b: number): number { return a + b; }\n';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'entry-channel-'));
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, '.mumuspec', 'spec.md'), SPEC);
  writeFileSync(join(root, '.mumuspec', 'constraints.yaml'), CONSTRAINTS);
});

describe('constraints.yaml 条目执行面（TC-L1-004/005）', () => {
  it('违规源文件 → forward 条目触发 E-GUARD-012、reverse 条目触发 E-GUARD-003', () => {
    writeFileSync(join(root, 'src', 'bad.ts'), VIOLATION);
    const r = checkCompliance(root, {});
    expect(r.errors.some((e) => e.code === 'E-GUARD-012' && e.message.includes('全局可变状态'))).toBe(true);
    expect(r.errors.some((e) => e.code === 'E-GUARD-003' && e.message.includes('顶层可变状态'))).toBe(true);
    expect(r.coverage!.enforced_strong).toBeGreaterThanOrEqual(2);
    expect(r.coverage!.total).toBeGreaterThanOrEqual(3); // spec SHALL 1 + 条目 2
  });

  it('干净源文件 → 无 E-GUARD-012/003，coverage 仍计入条目（TC-L1-005 计数）', () => {
    writeFileSync(join(root, 'src', 'bad.ts'), CLEAN);
    const r = checkCompliance(root, {});
    expect(r.errors.filter((e) => e.code === 'E-GUARD-012')).toHaveLength(0);
    expect(r.errors.filter((e) => e.code === 'E-GUARD-003')).toHaveLength(0);
    expect(r.coverage!.enforced_strong).toBeGreaterThanOrEqual(2);
  });

  it('无 annotation 的条目不误入机器通道（保持 manual）', () => {
    writeFileSync(join(root, '.mumuspec', 'constraints.yaml'), `version: "0.2.0"
last_updated: "2026-09-19"
forward:
  technical_design:
    - id: FE-2
      content: "散文约束无注解"
      min_strength: medium
      enforcement: "manual(评审)"
`);
    writeFileSync(join(root, 'src', 'bad.ts'), VIOLATION);
    const r = checkCompliance(root, {});
    expect(r.errors.filter((e) => e.code === 'E-GUARD-012')).toHaveLength(0);
    expect(r.coverage!.manual).toBeGreaterThanOrEqual(1);
  });
});
