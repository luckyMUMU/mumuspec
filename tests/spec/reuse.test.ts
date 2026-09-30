/**
 * Reuse planning tests (core-consolidation L4, R-0018).
 *
 * Locks TC-L4-003 / TC-L4-004: reuse must carry an upstream source, must refuse
 * when the source does not exist instead of returning an empty success, and may
 * only tighten.
 */

import { describe, it, expect } from 'vitest';
import { buildReusedEntry, listConstraints, planConstraintReuse, reuseId } from '../../src/spec/reuse.js';
import { planContractImport } from '../../src/contract/reuse.js';
import type { ConstraintsFile } from '../../src/core/types-constraint.js';
import type { ContractRegistry } from '../../src/core/types-contract.js';

function files(withSource: boolean): ConstraintsFile[] {
  return [
    {
      version: '0.2.0',
      last_updated: '2026-09-30',
      scope: 'src/guard',
      layer: 1,
      forward: {
        technical_design: [
          {
            id: 'TD-F-100',
            content: '守卫层不得执行子进程',
            min_strength: 'high',
            enforcement: 'manual(评审核对)',
            category: 'guard',
            source_specs: withSource ? ['src/guard/.mumuspec/spec.md#守卫执行边界'] : [],
          },
        ],
      },
      reverse: {
        requirement_goals: [
          {
            id: 'RG-R-200',
            content: '不得放宽上层约束',
            min_strength: 'medium',
            enforcement: 'manual(继承校验)',
          },
        ],
      },
    },
  ];
}

const registry = (ids: string[]): ContractRegistry => ({
  version: '1.0.0',
  last_updated: '2026-09-30',
  contracts: ids.map((id) => ({
    id,
    name: `${id}.op`,
    category: 'api',
    status: 'stable',
    criticality: 'high',
    version: '1.0.0',
    source: 'src/guard/.mumuspec/BOUNDARY.md',
    description: '',
    upstream: ['caller'],
    downstream: [],
    schema: {},
  })),
});

describe('constraint reuse', () => {
  it('lists entries with their coordinates', () => {
    const located = listConstraints(files(true));
    expect(located.map((l) => `${l.scope}#${l.entry.id}`).sort()).toEqual([
      'src/guard#RG-R-200',
      'src/guard#TD-F-100',
    ]);
  });

  it('plans a reuse that inherits the upstream source', () => {
    const plan = planConstraintReuse(files(true), { id: 'TD-F-100', fromScope: 'src/guard' });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const written = buildReusedEntry(plan, { layer: 2, scope: 'src/guard/ast' });
    expect(written.id).toBe('TD-F-100@src_guard');
    expect(written.source_specs).toEqual(['src/guard/.mumuspec/spec.md#守卫执行边界']);
    expect(written.inherited).toBe(true);
    expect(written.min_strength).toBe('high');
  });

  it('refuses a source entry that has no upstream of its own', () => {
    const plan = planConstraintReuse(files(false), { id: 'TD-F-100', fromScope: 'src/guard' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusal.code).toBe('E-SPEC-016');
    expect(plan.refusal.reason).toBe('no-upstream-source');
  });

  it('fails loudly on a missing source scope and lists what exists', () => {
    const plan = planConstraintReuse(files(true), { id: 'TD-F-100', fromScope: 'src/nope' });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.refusal.reason).toBe('source-scope-missing');
    expect(plan.available).toEqual(['src/guard#TD-F-100', 'src/guard#RG-R-200']);
  });

  it('rejects loosening strength but accepts tightening', () => {
    const loose = planConstraintReuse(files(true), {
      id: 'TD-F-100',
      fromScope: 'src/guard',
      tighten: 'medium',
    });
    expect(loose.ok).toBe(false);
    if (loose.ok) return;
    expect(loose.refusal.code).toBe('E-SPEC-017');

    const same = planConstraintReuse(files(true), { id: 'TD-F-100', tighten: 'high' });
    expect(same.ok).toBe(true);
  });

  it('produces stable ids per source scope', () => {
    expect(reuseId('src/guard', 'TD-F-100')).toBe('TD-F-100@src_guard');
    expect(reuseId('.', 'TD-F-100')).toBe('TD-F-100@root');
  });
});

describe('contract import', () => {
  it('rewrites source to the imported-from registry location', () => {
    const plan = planContractImport(registry(['API-001']), { fromScope: 'src/guard' });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].source).toBe('src/guard/.mumuspec/contracts/contracts.yaml#API-001');
    expect(plan.missing).toEqual([]);
  });

  it('reports a requested contract that does not exist instead of an empty success', () => {
    const plan = planContractImport(registry(['API-001']), { fromScope: '.', id: 'API-999' });
    expect(plan.items).toEqual([]);
    expect(plan.missing).toEqual(['API-999']);
    expect(plan.available).toEqual(['API-001']);
    expect(plan.items[0]).toBeUndefined();
  });

  it('keeps the contract content intact apart from provenance', () => {
    const plan = planContractImport(registry(['API-001']), { fromScope: 'src/guard' });
    expect(plan.items[0].id).toBe('API-001');
    expect(plan.items[0].upstream).toEqual(['caller']);
    expect(plan.items[0].criticality).toBe('high');
  });
});
