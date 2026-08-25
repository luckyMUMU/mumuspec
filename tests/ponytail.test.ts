import { describe, it, expect } from 'vitest';
import {
  PONYTAIL_LADDER,
  PONYTAIL_CONSTRAINTS,
  NON_LAZY_DOMAINS,
  injectPonytail,
  parsePonytailMarkers,
  getPonytailRequirement,
} from '../src/spec/ponytail.js';
import { parseSpecFile } from '../src/spec/parser.js';
import type { SpecFile } from '../src/core/types.js';

describe('ponytail', () => {
  it('should have 7 levels in the ladder', () => {
    expect(PONYTAIL_LADDER).toHaveLength(7);
    expect(PONYTAIL_LADDER[0].level).toBe(1);
    expect(PONYTAIL_LADDER[6].level).toBe(7);
  });

  it('should have YAGNI as level 1', () => {
    expect(PONYTAIL_LADDER[0].question).toContain('需要存在');
    expect(PONYTAIL_LADDER[0].type).toBe('SHALL NOT');
  });

  it('should have SHALL NOT constraints', () => {
    expect(PONYTAIL_CONSTRAINTS.shallNot.length).toBeGreaterThan(0);
    expect(PONYTAIL_CONSTRAINTS.shallNot.some(s => s.includes('YAGNI'))).toBe(true);
  });

  it('should have enforcement rules', () => {
    expect(PONYTAIL_CONSTRAINTS.enforcement).toHaveLength(4);
    expect(PONYTAIL_CONSTRAINTS.enforcement[0].id).toBe('PONYTAIL-1');
  });

  it('should have non-lazy domains', () => {
    expect(NON_LAZY_DOMAINS.length).toBeGreaterThan(0);
    expect(NON_LAZY_DOMAINS).toContain('安全性');
    expect(NON_LAZY_DOMAINS).toContain('输入验证');
  });

  it('should inject Ponytail constraints into spec', () => {
    const specContent = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: General

### SHALL
- 基本要求
`;
    const spec = parseSpecFile(specContent, '/test/spec.md');
    const injected = injectPonytail(spec);

    expect(injected.requirements).toHaveLength(2);
    expect(injected.requirements[0].name).toBe(PONYTAIL_CONSTRAINTS.name);
  });

  it('should not duplicate Ponytail constraints', () => {
    const specContent = `---
layer: 0
scope: "."
last_updated: "2026-01-01"
---

## Requirement: ${PONYTAIL_CONSTRAINTS.name}

### SHALL
- existing
`;
    const spec = parseSpecFile(specContent, '/test/spec.md');
    const injected = injectPonytail(spec);

    expect(injected.requirements).toHaveLength(1);
  });

  it('should parse ponytail: markers from code', () => {
    const code = `function foo() {
  // ponytail: simplified for demo
  return 42;
}

const bar = () => {
  # ponytail: python style
  return 1;
};
`;
    const markers = parsePonytailMarkers(code, '/test/file.ts');

    expect(markers).toHaveLength(2);
    expect(markers[0].reason).toBe('simplified for demo');
    expect(markers[0].line).toBe(2);
    expect(markers[1].reason).toBe('python style');
  });

  it('should return ponytail requirement', () => {
    const req = getPonytailRequirement();
    expect(req.name).toBe(PONYTAIL_CONSTRAINTS.name);
    expect(req.shallNot).toHaveLength(PONYTAIL_CONSTRAINTS.shallNot.length);
  });
});
