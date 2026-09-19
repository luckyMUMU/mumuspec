/**
 * enforcement-gap L2 — status-assertion 对账纯函数（TC-L2-001/002/003/004）
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkStatusAssertions, type StatusAssertionFacts } from '../../src/guard/status-assertion-checker.js';

const FACTS: StatusAssertionFacts = { version: '0.43.0-alpha.0', commandCount: 46, toolCount: 30 };
const NOW = new Date('2026-09-19T12:00:00Z');

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'status-assert-'));
  mkdirSync(join(root, 'src/contract'), { recursive: true });
  mkdirSync(join(root, 'src/spec'), { recursive: true });
  writeFileSync(join(root, 'src/contract/loader.ts'), 'x\n'.repeat(300));
  writeFileSync(join(root, 'src/spec/parser.ts'), 'x\n'.repeat(300));
});

function status(rows: string, extra = '', version = FACTS.version): string {
  return `# MumuSpec 项目状态

- **最后更新日期**: 2026-09-18
- **当前包版本**: ${version}
${extra}
| 能力层 | 设计完备性 | 实现进度 | Phase 归属 | 备注 |
|-------|-----------|---------|-----------|------|
${rows}
`;
}

describe('版本断言（TC-L2-001）', () => {
  it('一致 → 无 drift', () => {
    expect(checkStatusAssertions(status('| Spec Layer | 100% | 95% | P1 | ✅ |'), FACTS, root, { now: NOW }))
      .toHaveLength(0);
  });
  it('矛盾 → 1 条 E-DRIFT-016', () => {
    const out = checkStatusAssertions(
      status('| Spec Layer | 100% | 95% | P1 | ✅ |', '', '0.35.0-alpha.0'),
      FACTS, root, { now: NOW },
    );
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('E-DRIFT-016');
    expect(out[0].type).toBe('status_assertion');
    expect(out[0].message).toContain('0.35.0-alpha.0');
    expect(out[0].message).toContain('0.43.0-alpha.0');
  });
});

describe('能力层进度矛盾（TC-L2-002）', () => {
  it('0% 断言 vs 300 行实现 → 矛盾', () => {
    const out = checkStatusAssertions(status('| Contract Layer | 100% | 0% | Phase 3 | 未开始 |'), FACTS, root, { now: NOW });
    expect(out.filter((d) => d.code === 'E-DRIFT-016')).toHaveLength(1);
  });
  it('85% 断言 vs 无实现 → 矛盾', () => {
    const out = checkStatusAssertions(status('| Knowledge Layer | 100% | 85% | P3 | ✅ |'), FACTS, root, { now: NOW });
    expect(out.filter((d) => d.code === 'E-DRIFT-016')).toHaveLength(1);
  });
  it('80% 断言 vs 300 行实现 → 无矛盾', () => {
    const out = checkStatusAssertions(status('| Contract Layer | 100% | 80% | Phase 3 | ✅ |'), FACTS, root, { now: NOW });
    expect(out.filter((d) => d.code === 'E-DRIFT-016')).toHaveLength(0);
  });
  it('~90% 波浪号写法可解析', () => {
    const out = checkStatusAssertions(status('| AI Integration | 100% | ~90% | P1 | ✅ |'), FACTS, root, { now: NOW });
    expect(out.filter((d) => d.code === 'E-DRIFT-016')).toHaveLength(1); // 90% 但无 src/install → 矛盾
  });
  it('无映射行（Ponytail）跳过', () => {
    const out = checkStatusAssertions(status('| Ponytail | 100% | 0% | Phase 2 | ✅ |'), FACTS, root, { now: NOW });
    expect(out).toHaveLength(0);
  });
});

describe('数量断言（TC-L2-003）', () => {
  it('"999+ 命令" > 实际 46 → 矛盾', () => {
    const out = checkStatusAssertions(
      status('| Spec Layer | 100% | 95% | P1 | ✅ |', '| x | y | 999+ 命令可用 |\n'),
      FACTS, root, { now: NOW },
    );
    expect(out.filter((d) => d.message.includes('命令'))).toHaveLength(1);
  });
  it('"43+ 命令" ≤ 实际 → 无矛盾；工具同理', () => {
    const out = checkStatusAssertions(
      status('| Spec Layer | 100% | 95% | P1 | ✅ |', '| a | b | 43+ 命令可用 | 25+ 工具可用 |\n'),
      FACTS, root, { now: NOW },
    );
    expect(out).toHaveLength(0);
  });
});

describe('新鲜度与 strict 门控（TC-L2-004/005）', () => {
  it('超 30 天 → INFO 级、无 code', () => {
    const text = `# s\n- **最后更新日期**: 2026-08-01\n- **当前包版本**: ${FACTS.version}\n${status('| Spec Layer | 100% | 95% | P1 | ✅ |')}`;
    const out = checkStatusAssertions(text, FACTS, root, { now: NOW });
    const info = out.filter((d) => d.severity === 'INFO');
    expect(info.length).toBeGreaterThanOrEqual(1);
    expect(info[0].code).toBeUndefined();
  });
  it('strict=true 时矛盾项 severity=ERROR，默认 WARN', () => {
    const t = status('| Contract Layer | 100% | 0% | P3 | x |');
    expect(checkStatusAssertions(t, FACTS, root, { now: NOW })[0].severity).toBe('WARN');
    expect(checkStatusAssertions(t, FACTS, root, { now: NOW, strict: true })[0].severity).toBe('ERROR');
  });
});
