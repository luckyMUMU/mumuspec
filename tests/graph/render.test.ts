/**
 * Graph rendering tests (core-consolidation L5, R-0019).
 *
 * Locks TC-L5-001..004: rendering is a deterministic projection of graph data —
 * same input ⇒ same bytes, order-insensitive inputs ⇒ same bytes, and structural
 * gaps (unreachable nodes, unguarded transitions, contradictory edges) MUST be
 * visible rather than silently dropped.
 */

import { describe, it, expect } from 'vitest';
import {
  renderStateMachine,
  renderBpLanes,
  renderContractGraph,
  renderConstraintTree,
  type RenderFormat,
  type WorkflowGraphInput,
} from '../../src/graph/render.js';

const PHASES = ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'];

function graph(edges: WorkflowGraphInput['edges'] = DEFAULT_EDGES): WorkflowGraphInput {
  return {
    workflow: 'full',
    phases: PHASES,
    terminal: ['archive-completed', 'discarded'],
    edges,
    phaseBps: { open: ['BP-1', 'BP-2', 'BP-3'], design: ['BP-4'], build: ['BP-9'] },
  };
}

const DEFAULT_EDGES: WorkflowGraphInput['edges'] = [
  { from: 'open', to: 'design', direction: 'forward', countAs: 'none', label: 'open→design', bp: { id: 'BP-3', description: '工件审查与确认', required: true } },
  { from: 'design', to: 'build', direction: 'forward', countAs: 'none', label: 'design→build', bp: { id: 'BP-4', description: '设计方案确认', required: true } },
  { from: 'build', to: 'verify', direction: 'forward', countAs: 'none', label: 'build→verify' },
  { from: 'build', to: 'design', direction: 'backward', countAs: 'rollback', label: 'build→design（回退重设）' },
  { from: 'verify', to: 'archive-in-progress', direction: 'forward', countAs: 'none', label: 'verify→archive', bp: { id: 'BP-17', description: '归档最终确认', required: true } },
];

describe('renderStateMachine — TC-L5-001 determinism', () => {
  it('same input renders byte-identical output for every format', () => {
    for (const format of ['mermaid', 'dot', 'json'] as RenderFormat[]) {
      const a = renderStateMachine(graph(), { format });
      const b = renderStateMachine(graph(), { format });
      expect(a).toBe(b);
    }
  });

  it('input edge order does not change the bytes', () => {
    const input = graph();
    const shuffled = graph([...input.edges].reverse());
    expect(renderStateMachine(shuffled, { format: 'mermaid' })).toBe(
      renderStateMachine(input, { format: 'mermaid' }),
    );
    expect(renderStateMachine(shuffled, { format: 'json' })).toBe(
      renderStateMachine(input, { format: 'json' }),
    );
  });

  it('current phase and remaining budgets come from state, not from callers', () => {
    const out = renderStateMachine(graph(), { format: 'mermaid', state: { phase: 'build', rollbackCount: 1, rollbackLimit: 3, rebuildCount: 0, rebuildLimit: 5 } });
    expect(out).toContain('build');
    expect(out).toContain('回退 1/3');
    expect(out).toContain('重建 0/5');
  });
});

describe('renderStateMachine — TC-L5-002 visibility', () => {
  it('marks a transition without a blocking point as unguarded', () => {
    const out = renderStateMachine(graph(), { format: 'mermaid' });
    expect(out).toContain('build → verify');
    expect(out).toContain('未把守');
    expect(out).not.toMatch(/build → verify.*BP-/);
  });

  it('surfaces a node that no edge leads into', () => {
    const partial = graph([DEFAULT_EDGES[0], DEFAULT_EDGES[1]]);
    const out = renderStateMachine(partial, { format: 'mermaid' });
    expect(out).toContain('不可达');
    expect(out).toContain('verify');
  });

  it('keeps backward edges distinguishable with counter semantics', () => {
    const mermaid = renderStateMachine(graph(), { format: 'mermaid' });
    const dot = renderStateMachine(graph(), { format: 'dot' });
    expect(mermaid).toContain('rollback');
    expect(dot).toContain('style=dashed');
    const forwardLines = mermaid.split('\n').filter((l) => l.includes('design → build'));
    expect(forwardLines.every((l) => !l.includes('rollback'))).toBe(true);
  });

  it('emits unknown-format requests as a thrown error, never a default', () => {
    expect(() => renderStateMachine(graph(), { format: 'svg' as RenderFormat })).toThrow(/E-GRAPH-002/);
  });

  it('refuses contradictory graphs where an edge points at an undeclared node', () => {
    const broken = graph([{ from: 'build', to: 'nowhere', direction: 'forward', countAs: 'none', label: 'x' }]);
    expect(() => renderStateMachine(broken, { format: 'mermaid' })).toThrow(/E-GRAPH-003/);
  });
});

describe('renderBpLanes — TC-L5-003 phase × blocking points', () => {
  it('lists each phase lane with its declared blocking points', () => {
    const out = renderBpLanes(graph(), { format: 'mermaid' });
    expect(out).toContain('open');
    expect(out).toContain('BP-1');
    expect(out).toContain('BP-2');
    expect(out).toContain('BP-3');
    expect(out).toContain('design');
    expect(out).toContain('BP-4');
  });

  it('marks a lane that declares no blocking point', () => {
    const out = renderBpLanes(graph(), { format: 'mermaid' });
    expect(out).toContain('verify');
    expect(out).toMatch(/verify.*无门禁/s);
  });

  it('is byte-deterministic', () => {
    expect(renderBpLanes(graph(), { format: 'json' })).toBe(renderBpLanes(graph(), { format: 'json' }));
  });
});

describe('renderContractGraph — TC-L5-003 upstream/downstream', () => {
  it('renders edges from declared relations', () => {
    const out = renderContractGraph(
      {
        contracts: [
          { id: 'API-001', name: 'order.create', criticality: 'high', upstream: ['checkout'], downstream: ['inventory'] },
          { id: 'API-002', name: 'inventory.reserve', criticality: 'low', upstream: ['order.create'], downstream: [] },
        ],
      },
      { format: 'mermaid' },
    );
    expect(out).toContain('checkout');
    expect(out).toContain('inventory.reserve');
    expect(out).toContain('API-002');
  });

  it('flags a consumer that declares no counterpart', () => {
    const out = renderContractGraph(
      { contracts: [{ id: 'API-009', name: 'lonely', criticality: 'low', upstream: [], downstream: [] }] },
      { format: 'mermaid' },
    );
    expect(out).toContain('孤立');
  });
});

describe('renderConstraintTree — TC-L5-003 inheritance chain', () => {
  const layers = [
    { level: 0, scope: '.', inheritedFrom: [] },
    { level: 1, scope: 'src', inheritedFrom: ['.'], merged: true },
    { level: 2, scope: 'src/guard', inheritedFrom: ['.', 'src'] },
  ];

  it('renders the declared chain and its root', () => {
    const out = renderConstraintTree({ layers }, { format: 'mermaid' });
    expect(out).toContain('L0 .');
    expect(out).toContain('L2 src/guard');
    expect(out).toContain('继承链根: .');
  });

  it('keeps an unresolvable inheritance source visible as a break', () => {
    const broken = [...layers, { level: 3, scope: 'src/guard/x', inheritedFrom: ['src/missing'] }];
    const out = renderConstraintTree({ layers: broken }, { format: 'mermaid' });
    expect(out).toContain('继承源未注册（断链）');
    expect(out).toContain('src/guard/x ← src/missing');
  });

  it('is byte-deterministic regardless of input order', () => {
    const a = renderConstraintTree({ layers }, { format: 'json' });
    const b = renderConstraintTree({ layers: [...layers].reverse() }, { format: 'json' });
    expect(a).toBe(b);
  });
});
