/**
 * 最小可解析单元测试（lightweight-freeze-gate）：
 * 轻量档 delta「单条 ## Requirement: + 一条 ### SHALL 项」即为合法最小单元；
 * full workflow 校验行为零变化（E-SPEC-004 仅在零 requirements 时告警）。
 */
import { describe, it, expect } from 'vitest';
import { parseSpecFile } from '../../src/spec/parser.js';
import { isMinParseableUnit } from '../../src/spec/validator.js';

const MINIMAL_DELTA = `---
layer: 0
scope: .
---

# Delta Spec: minimal-unit

## Requirement: 单条 SHALL 即合法

### SHALL

- 提供单条可执行约束即可构成最小 delta
`;

const ZERO_REQ = `---
layer: 0
scope: .
---

# Delta Spec: empty
`;

describe('isMinParseableUnit', () => {
  it('TC-L0-05: single requirement with one SHALL bullet → min parseable unit', () => {
    const spec = parseSpecFile(MINIMAL_DELTA, 'minimal.md');
    expect(spec.requirements.length).toBe(1);
    expect(isMinParseableUnit(spec)).toBe(true);
  });

  it('zero requirements → not a parseable unit (E-SPEC-004 warning path unchanged)', () => {
    const spec = parseSpecFile(ZERO_REQ, 'empty.md');
    expect(spec.requirements.length).toBe(0);
    expect(isMinParseableUnit(spec)).toBe(false);
  });

  it('requirement without SHALL/SHALL NOT body → not a parseable unit', () => {
    const spec = parseSpecFile(
      `---\nlayer: 0\nscope: .\n---\n\n## Requirement: 无主体\n`,
      'nobody.md',
    );
    expect(isMinParseableUnit(spec)).toBe(false);
  });
});