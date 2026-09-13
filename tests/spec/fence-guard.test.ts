/**
 * Fence guard tests (spec-fence-guard, 2026-09-13).
 *
 * Fenced code blocks in spec documents are documentation — example
 * constraints inside ``` / ~~~ fences must never parse as live requirements.
 */

import { describe, it, expect } from 'vitest';
import { parseRequirements, stripFencedBlocks } from '../../src/spec/parser.js';

const SPEC_WITH_FENCED_EXAMPLE = [
  '## Requirement: 真实约束',
  '',
  '### SHALL NOT',
  '- 真实红线条目',
  '',
  '以下为文档示例：',
  '',
  '```markdown',
  '## Requirement: 示例约束',
  '',
  '### SHALL NOT',
  '- 这是围栏内的示例条目',
  '```',
  '',
].join('\n');

describe('stripFencedBlocks', () => {
  it('TC3: handles info string, ~~~ fences, and unclosed fences', () => {
    const body = [
      'before',
      '```markdown',
      '## Requirement: fenced-a',
      '```',
      'middle',
      '~~~',
      '## Requirement: fenced-b',
      '~~~',
      'after',
      '```',
      '## Requirement: fenced-c',
      // unclosed — content dropped to EOF
    ].join('\n');
    const stripped = stripFencedBlocks(body);
    expect(stripped).not.toContain('fenced-a');
    expect(stripped).not.toContain('fenced-b');
    expect(stripped).not.toContain('fenced-c');
    expect(stripped).toContain('before');
    expect(stripped).toContain('middle');
    expect(stripped).toContain('after');
  });
});

describe('parseRequirements fence guard', () => {
  it('TC1: fenced example requirement is not parsed (probe regression 2→1)', () => {
    const reqs = parseRequirements(SPEC_WITH_FENCED_EXAMPLE);
    expect(reqs.length).toBe(1);
    expect(reqs[0].name).toBe('真实约束');
    expect(reqs[0].shallNot).toEqual(['真实红线条目']);
  });

  it('TC2: fenced SHALL sections are ignored; outside constraints unaffected', () => {
    const body = [
      '## Requirement: 外层',
      '',
      '### SHALL',
      '- 外层真实要求',
      '',
      '示例：',
      '```',
      '### SHALL',
      '- 围栏内伪要求',
      '```',
      '',
    ].join('\n');
    const reqs = parseRequirements(body);
    expect(reqs.length).toBe(1);
    expect(reqs[0].shall).toEqual(['外层真实要求']);
  });

  it('TC4: fence-free body parses identically (no-strip invariant)', () => {
    const body = [
      '## Requirement: A',
      '',
      '### SHALL NOT',
      '- a1',
      '',
      '## Requirement: B',
      '',
      '### SHALL',
      '- b1',
      '',
    ].join('\n');
    const reqs = parseRequirements(body);
    expect(reqs.map((r) => r.name)).toEqual(['A', 'B']);
    expect(stripFencedBlocks(body)).toBe(body);
  });
});
