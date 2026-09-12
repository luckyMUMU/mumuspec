/**
 * Parallel planner — design-build orthogonality, invariant I3 (2026-09-12).
 *
 * > 实现侧的并行度 = 设计侧完备性的可测量投影。
 *
 * A layer number holding several scopes is only a **candidate** parallel group.
 * This module turns the candidate into a verdict by asking the code graph:
 *
 * - no direct CALLS edge between two same-layer scopes → they may run
 *   concurrently (contracts frozen, tests locked) → one shared group.
 * - a direct CALLS edge → they are coupled. Either the design has not closed
 *   (they are really one module) or the layer assignment is wrong. The planner
 *   refuses to claim parallelism, puts them in *different* groups, and records
 *   the evidence for the human to arbitrate.
 *
 * Grouping is derived, never configured: `--apply` writes the derived
 * `parallel_group` / `depends_on` back onto the existing `build_layers` entries.
 */
import type { BuildLayer } from '../core/types.js';
import { getCachedCodeGraph } from '../knowledge/graph-builder.js';
import { loadChangeState } from './state.js';

/** One detected coupling between two scopes sitting at the same layer */
export interface ScopeCoupling {
  from_scope: string;
  to_scope: string;
  /** Sample `from-file → to-file` evidence (capped) */
  evidence: string[];
  /** Number of distinct CALLS edges observed */
  edge_count: number;
}

/** Result of planning parallel groups for one change */
export interface ParallelPlan {
  /** Groups of same-layer scopes verified to have no coupling between them */
  groups: { group: number; layer: number; scopes: string[] }[];
  /** Same-layer scope pairs that ARE coupled → must not be claimed parallel */
  coupled: ScopeCoupling[];
  /** Scopes that matched no file in the graph (graph is blind for them) */
  unmapped_scopes: string[];
  /** False when the graph is empty → every verdict below is advisory only */
  graph_available: boolean;
  /** Entries to write back on `--apply` */
  entries: BuildLayer[];
}

const MAX_EVIDENCE = 3;

/** Entry reference format used by `BuildLayer.depends_on` */
export function entryRef(entry: BuildLayer): string {
  return `L${entry.layer}:${entry.scope}`;
}

/** Normalise a scope into a relative path prefix (`src/change`, `src/change/`) */
function normalizeScope(scope: string): string {
  return scope.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/** Whether a graph file path lives inside a scope directory */
function fileInScope(filePath: string, scopePrefix: string): boolean {
  if (scopePrefix === '' || scopePrefix === '.') return true;
  return filePath === scopePrefix || filePath.startsWith(`${scopePrefix}/`);
}

/**
 * Plan parallel groups for a change's build layers.
 *
 * Read-only w.r.t. the state file — callers decide whether to persist `entries`.
 */
export function planParallelGroups(projectRoot: string, changeName: string): ParallelPlan {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  const layers = (state.build_layers ?? []) as BuildLayer[];
  const byLayer = new Map<number, BuildLayer[]>();
  for (const l of layers) {
    const bucket = byLayer.get(l.layer) ?? [];
    bucket.push(l);
    byLayer.set(l.layer, bucket);
  }

  let allFiles: string[] = [];
  let edges: { from: string; to: string }[] = [];
  try {
    const graph = getCachedCodeGraph(projectRoot);
    allFiles = [...graph.fileIndex.keys()];
    edges = graph.edges.filter((e) => e.type === 'CALLS');
  } catch {
    // Graph unavailable — degrade to "each scope its own group", never to a crash
  }
  const graphAvailable = allFiles.length > 0;

  // scope → files (longest matching prefix wins, so nested scopes beat parents)
  const scopesByPrefixLength = [...new Set(layers.map((l) => l.scope))]
    .map((scope) => ({ scope, prefix: normalizeScope(scope) }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  const scopeOfFile = new Map<string, string>();
  for (const file of allFiles) {
    for (const { scope, prefix } of scopesByPrefixLength) {
      if (fileInScope(file, prefix)) {
        scopeOfFile.set(file, scope);
        break;
      }
    }
  }

  const mappedScopes = new Set(scopeOfFile.values());
  const unmapped = [...new Set(layers.map((l) => l.scope))].filter(
    (scope) => !mappedScopes.has(scope) && normalizeScope(scope) !== '' && normalizeScope(scope) !== '.',
  );

  // Same-layer coupling detection
  const layerOf = new Map<string, number>(layers.map((l) => [l.scope, l.layer]));
  const coupledByPair = new Map<string, ScopeCoupling>();
  for (const edge of edges) {
    const fromScope = scopeOfFile.get(edge.from);
    const toScope = scopeOfFile.get(edge.to);
    if (!fromScope || !toScope || fromScope === toScope) continue;
    const fromLayer = layerOf.get(fromScope);
    if (fromLayer === undefined || fromLayer !== layerOf.get(toScope)) continue;

    const key = [fromScope, toScope].sort().join('||');
    const existing = coupledByPair.get(key);
    if (existing) {
      existing.edge_count++;
      if (existing.evidence.length < MAX_EVIDENCE) existing.evidence.push(`${edge.from} → ${edge.to}`);
    } else {
      coupledByPair.set(key, {
        from_scope: fromScope,
        to_scope: toScope,
        evidence: [`${edge.from} → ${edge.to}`],
        edge_count: 1,
      });
    }
  }

  const coupledNeighbours = new Map<string, Set<string>>();
  for (const c of coupledByPair.values()) {
    coupledNeighbours.set(c.from_scope, (coupledNeighbours.get(c.from_scope) ?? new Set()).add(c.to_scope));
    coupledNeighbours.set(c.to_scope, (coupledNeighbours.get(c.to_scope) ?? new Set()).add(c.from_scope));
  }

  // Greedy partition per layer: a scope joins the first group containing no
  // coupled neighbour; otherwise it opens a new group. Coupled scopes therefore
  // always land in *different* groups — parallelism is never over-claimed.
  const groups: ParallelPlan['groups'] = [];
  const entries: BuildLayer[] = [];
  let nextGroup = 1;

  for (const [layer, members] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    const layerGroups: string[][] = [];
    for (const member of members) {
      const neighbours = coupledNeighbours.get(member.scope) ?? new Set<string>();
      const host = layerGroups.find((g) => !g.some((s) => neighbours.has(s)));
      if (host) host.push(member.scope);
      else layerGroups.push([member.scope]);
    }

    for (const scopes of layerGroups) {
      const group = nextGroup++;
      groups.push({ group, layer, scopes });
      for (const scope of scopes) {
        const source = members.find((m) => m.scope === scope) as BuildLayer;
        entries.push({ ...source, parallel_group: group });
      }
    }

    // A scope whose same-layer sibling sits in another group is coupled: it
    // must declare what it waits on, otherwise the split looks unexplained.
    for (const source of members) {
      const neighbours = coupledNeighbours.get(source.scope);
      if (!neighbours || neighbours.size === 0) continue;
      const entry = entries.find((e) => e.layer === layer && e.scope === source.scope);
      if (!entry) continue;
      entry.depends_on = [...neighbours]
        .filter((s) => layerOf.get(s) === layer)
        .map((s) => entryRef({ layer, scope: s, status: 'pending' }))
        .sort();
    }
  }

  return {
    groups,
    coupled: [...coupledByPair.values()],
    unmapped_scopes: unmapped,
    graph_available: graphAvailable,
    entries,
  };
}
