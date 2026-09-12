/**
 * Design-build orthogonality — I3 layer/parallel-group mechanics.
 *
 * Covers the write-time invariants that used to be implicit assumptions:
 * - same-layer scopes are distinct targets (no silent first-match)
 * - bottom-up ordering is enforced where the fact is written
 * - parallel groups are derived, not asserted
 *
 * Real fs + real state persistence (no mocks) so the assertions are about the
 * artifacts, not about the mock calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { CodeGraph } from '../../src/core/types-knowledge.js';

type GraphLike = Pick<CodeGraph, 'fileIndex' | 'edges' | 'nodes'> & { builtAt: string };

let mockedGraph: GraphLike | undefined;

vi.mock('../../src/knowledge/graph-builder.js', () => ({
  getCachedCodeGraph: () => {
    if (!mockedGraph) throw new Error('graph unavailable');
    return mockedGraph;
  },
}));

import {
  initBuildLayers,
  updateBuildLayerStatus,
  getBuildLayerView,
  planParallelGroups,
} from '../../src/change/manager.js';

const CHANGE = 'layers-tc';
let testRoot: string;

function writeState(buildLayers = '[]'): void {
  const dir = join(testRoot, '.mumuspec', 'changes', CHANGE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, '.mumuspec.yaml'),
    [
      `name: ${CHANGE}`,
      'phase: build',
      'workflow: full',
      'created_at: "2026-09-12T00:00:00.000Z"',
      'updated_at: "2026-09-12T00:00:00.000Z"',
      'affected_scopes: []',
      `build_layers: ${buildLayers}`,
      'test_cases:',
      '  design_locked: false',
      '  suites_locked: false',
      '  suites_locked_layers: []',
      '  suites_hash: {}',
      'rollback_count: 0',
      'rebuild_count: 0',
      'rollback_limit: 3',
      'rebuild_limit: 5',
      'build_mode: executing-plans',
      'tdd_mode: non-tdd',
      'isolation: branch',
      'single_active_change: true',
      'user_confirmed: false',
      'decisions_log:',
      '  counts: {}',
      'rollback_history: []',
      '',
    ].join('\n'),
  );
}

function readLayers(): Array<Record<string, unknown>> {
  const raw = readFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, '.mumuspec.yaml'), 'utf8');
  const lines: Record<string, unknown>[] = [];
  let inLayers = false;
  let current: Record<string, unknown> | undefined;
  for (const line of raw.split('\n')) {
    if (line.startsWith('build_layers:')) {
      inLayers = true;
      continue;
    }
    if (inLayers && /^[a-z_]/.test(line)) break;
    if (!inLayers) continue;
    const newEntry = line.match(/^\s{2}- layer:\s*(\d+)/);
    if (newEntry) {
      current = { layer: Number(newEntry[1]) };
      lines.push(current);
      continue;
    }
    const kv = line.match(/^\s{4}([a-z_]+):\s*(.+)$/);
    if (kv && current) current[kv[1]] = kv[2];
  }
  return lines;
}

beforeEach(() => {
  testRoot = join(tmpdir(), `mumuspec-layers-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mockedGraph = undefined;
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe('G3 — same-layer scopes are never folded into one target', () => {
  beforeEach(() => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 0, scope: 'src/core' },
      { layer: 1, scope: 'src/guard' },
      { layer: 1, scope: 'src/spec' },
    ]);
  });

  it('does not invent parallel groups — a shared layer number stays a *candidate*', () => {
    const layers = readLayers();
    expect(layers[0].parallel_group).toBeUndefined();
    expect(layers[1].parallel_group).toBeUndefined();
    const view = getBuildLayerView(testRoot, CHANGE);
    expect(view.parallel_groups).toEqual([]);
    expect(view.unverified_layer_groups).toEqual([1]);
  });

  it('preserves an explicitly declared parallel_group (the verified form)', () => {
    initBuildLayers(testRoot, CHANGE, [
      { layer: 1, scope: 'src/guard', parallel_group: 7 },
      { layer: 1, scope: 'src/spec', parallel_group: 7 },
    ]);
    const view = getBuildLayerView(testRoot, CHANGE);
    expect(view.parallel_groups).toEqual([{ group: 7, layer: 1, scopes: ['src/guard', 'src/spec'] }]);
    expect(view.unverified_layer_groups).toEqual([]);
  });

  it('ambiguous layer target throws instead of silently mutating the first entry', () => {
    expect(() => updateBuildLayerStatus(testRoot, CHANGE, 1, 'in-progress')).toThrow(/2 scopes/);
    expect(() => updateBuildLayerStatus(testRoot, CHANGE, 1, 'in-progress')).toThrow(/--scope/);
  });

  it('--scope selects exactly one entry', () => {
    const { updated } = updateBuildLayerStatus(testRoot, CHANGE, 1, 'in-progress', { scope: 'src/spec' });
    expect(updated).toEqual(['src/spec']);
    const layers = readLayers();
    expect(layers[1].status).toBe('pending');
    expect(layers[2].status).toBe('in-progress');
  });

  it('an unknown scope is an error listing the candidates', () => {
    expect(() => updateBuildLayerStatus(testRoot, CHANGE, 1, 'done', { scope: 'nope' })).toThrow(/src\/guard, src\/spec/);
  });
});

describe('bottom-up ordering is enforced at write time', () => {
  beforeEach(() => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 0, scope: 'src/core' },
      { layer: 1, scope: 'src/guard' },
    ]);
  });

  it('refuses to mark an upper layer done while a lower layer is pending', () => {
    expect(() => updateBuildLayerStatus(testRoot, CHANGE, 1, 'done')).toThrow(/Bottom-up ordering violated/);
    expect(readLayers()[1].status).toBe('pending');
  });

  it('--force bypasses the ordering check', () => {
    updateBuildLayerStatus(testRoot, CHANGE, 1, 'done', { force: true });
    expect(readLayers()[1].status).toBe('done');
  });

  it('allows the transition once the lower layer is done', () => {
    updateBuildLayerStatus(testRoot, CHANGE, 0, 'done');
    updateBuildLayerStatus(testRoot, CHANGE, 1, 'done');
    expect(readLayers().map((l) => l.status)).toEqual(['done', 'done']);
  });
});

describe('buildLayerView', () => {
  it('separates candidate groups from declared groups', () => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 0, scope: 'a' },
      { layer: 1, scope: 'b' },
      { layer: 1, scope: 'c' },
    ]);
    const view = getBuildLayerView(testRoot, CHANGE);
    expect(view.candidate_groups).toEqual([
      { layer: 0, scopes: ['a'] },
      { layer: 1, scopes: ['b', 'c'] },
    ]);
    // Nothing verified yet: no declared group, and L1 is flagged as unverified.
    expect(view.parallel_groups).toEqual([]);
    expect(view.unverified_layer_groups).toEqual([1]);
    expect(view.coupled_scopes).toEqual([]);
  });

  it('a declared group clears the unverified flag for that layer', () => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 1, scope: 'b', parallel_group: 1 },
      { layer: 1, scope: 'c', parallel_group: 1 },
    ]);
    const view = getBuildLayerView(testRoot, CHANGE);
    expect(view.parallel_groups.find((g) => g.group === 1)?.scopes).toEqual(['b', 'c']);
    expect(view.unverified_layer_groups).toEqual([]);
  });
});

function graphFor(files: string[], edges: [string, string][]): GraphLike {
  return {
    nodes: new Map(),
    fileIndex: new Map(files.map((f) => [f, []])),
    edges: edges.map(([from, to]) => ({ from, to, type: 'CALLS' as const })),
    builtAt: '2026-09-12T00:00:00.000Z',
  } as GraphLike;
}

describe('I3 — parallel groups are derived from coupling, not asserted', () => {
  beforeEach(() => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 1, scope: 'src/guard' },
      { layer: 1, scope: 'src/spec' },
    ]);
  });

  it('uncoupled same-layer scopes share one group', () => {
    mockedGraph = graphFor(['src/guard/a.ts', 'src/spec/b.ts'], []);
    const plan = planParallelGroups(testRoot, CHANGE);
    expect(plan.graph_available).toBe(true);
    expect(plan.coupled).toEqual([]);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].scopes.sort()).toEqual(['src/guard', 'src/spec']);
  });

  it('a direct CALLS edge splits the scopes into separate groups and records depends_on', () => {
    mockedGraph = graphFor(['src/guard/a.ts', 'src/spec/b.ts'], [['src/guard/a.ts', 'src/spec/b.ts']]);
    const plan = planParallelGroups(testRoot, CHANGE);
    expect(plan.coupled).toHaveLength(1);
    expect(plan.coupled[0].edge_count).toBe(1);
    expect(plan.coupled[0].evidence[0]).toBe('src/guard/a.ts → src/spec/b.ts');
    expect(plan.groups).toHaveLength(2);

    const guard = plan.entries.find((e) => e.scope === 'src/guard')!;
    const spec = plan.entries.find((e) => e.scope === 'src/spec')!;
    expect(guard.parallel_group).not.toBe(spec.parallel_group);
    expect(guard.depends_on).toEqual(['L1:src/spec']);
    expect(spec.depends_on).toEqual(['L1:src/guard']);
  });

  it('cross-layer edges are not treated as an I3 violation', () => {
    writeState();
    initBuildLayers(testRoot, CHANGE, [
      { layer: 0, scope: 'src/core' },
      { layer: 1, scope: 'src/guard' },
      { layer: 1, scope: 'src/spec' },
    ]);
    mockedGraph = graphFor(
      ['src/core/x.ts', 'src/guard/a.ts', 'src/spec/b.ts'],
      [
        ['src/guard/a.ts', 'src/core/x.ts'],
        ['src/spec/b.ts', 'src/core/x.ts'],
      ],
    );
    expect(planParallelGroups(testRoot, CHANGE).coupled).toEqual([]);
  });

  it('an unavailable graph degrades to advisory instead of throwing', () => {
    mockedGraph = undefined;
    const plan = planParallelGroups(testRoot, CHANGE);
    expect(plan.graph_available).toBe(false);
    expect(plan.coupled).toEqual([]);
  });
});
