/**
 * Architecture preference packs and design skeleton (core-consolidation L2, R-0015).
 *
 * Locks TC-L2-001 / TC-L2-002: an undecided topic must be visibly pending, and a
 * "decision" that names no alternative or no reason must NOT read as decided —
 * an unreviewable choice is worse than an admitted gap.
 */

import { describe, it, expect } from 'vitest';
import {
  ARCH_PREFERENCE_PACKS,
  UNCONSTRAINED,
  findIncompleteSelections,
  renderDesignSkeleton,
} from '../../src/core/design-preferences.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

const analysis = {
  packageName: 'probe',
  projectType: 'library',
  language: 'typescript',
  framework: 'none',
  hasTypeScript: true,
  sourceDirs: ['src'],
  entryPoints: ['src/index.ts'],
} as unknown as ProjectAnalysis;

const TOPICS = ARCH_PREFERENCE_PACKS.map((p) => p.topic);

describe('ARCH_PREFERENCE_PACKS — TC-L2-002', () => {
  it('covers the five declared topics', () => {
    expect(TOPICS).toEqual(['分层策略', '数据流', '状态与持久化', '边界与契约', '模块组织']);
  });

  it('every pack offers at least two real options plus the unconstrained state', () => {
    for (const pack of ARCH_PREFERENCE_PACKS) {
      const real = pack.options.filter((o) => o.id !== UNCONSTRAINED);
      expect(real.length, pack.topic).toBeGreaterThanOrEqual(2);
      expect(pack.options.some((o) => o.id === UNCONSTRAINED), pack.topic).toBe(true);
    }
  });

  it('every option declares the cost of choosing it', () => {
    for (const pack of ARCH_PREFERENCE_PACKS) {
      for (const option of pack.options) {
        expect(option.tradeoff.trim().length, `${pack.topic}/${option.id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('renderDesignSkeleton — TC-L2-001', () => {
  it('renders every topic as pending when nothing is picked', () => {
    const md = renderDesignSkeleton(analysis);
    expect(findIncompleteSelections(md)).toEqual(TOPICS.slice().sort());
  });

  it('a picked topic with a reason becomes decided, and lists the unchosen alternatives', () => {
    const md = renderDesignSkeleton(analysis, {
      分层策略: { option: 'hexagonal', reason: '端口便于替换数据库' },
    });
    expect(findIncompleteSelections(md)).not.toContain('分层策略');
    expect(md).toContain('- 选定: 六边形');
    expect(md).toContain('分层架构');
    expect(md).toContain('暂不约束');
  });

  it('a pick with no reason stays pending', () => {
    const md = renderDesignSkeleton(analysis, { 分层策略: { option: 'hexagonal', reason: '   ' } });
    expect(findIncompleteSelections(md)).toContain('分层策略');
  });

  it('an unknown option id does not become decided', () => {
    const md = renderDesignSkeleton(analysis, { 分层策略: { option: 'microservices', reason: '随便' } });
    expect(findIncompleteSelections(md)).toContain('分层策略');
  });

  it('a hand-edited row that lost a decision field reads as undecided', () => {
    const picks: Record<string, { option: string; reason: string }> = {};
    for (const pack of ARCH_PREFERENCE_PACKS) {
      picks[pack.topic] = { option: pack.options.find((o) => o.id !== UNCONSTRAINED)!.id, reason: '理由' };
    }
    const md = renderDesignSkeleton(analysis, picks);
    expect(findIncompleteSelections(md)).toEqual([]);

    const stripped = md.replace(/- 备选: [^\n]*\n(?=- 理由（含未选代价）:)/, '');
    expect(stripped).not.toBe(md);
    expect(findIncompleteSelections(stripped)).toEqual(['分层策略']);
  });

  it('ignores sections that carry no selection fields', () => {
    const md = `${renderDesignSkeleton(analysis)}\n### 附录：术语\n\n本节不含选型字段。\n`;
    expect(findIncompleteSelections(md)).toEqual(TOPICS.slice().sort());
  });

  it('is deterministic for the same input', () => {
    expect(renderDesignSkeleton(analysis)).toBe(renderDesignSkeleton(analysis));
  });
});
