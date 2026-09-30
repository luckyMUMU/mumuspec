/**
 * Graph rendering — deterministic projection of orchestration data
 * (core-consolidation L5, R-0019).
 *
 * Design doc: `docs/design/diagram-rendering.md`.
 *
 * Load-bearing rules (locked by `tests/graph/render.test.ts`):
 *   - same input ⇒ same bytes; caller edge order never leaks into output;
 *   - labels come only from graph data — callers cannot inject display text;
 *   - structural gaps stay visible: unguarded transitions, unreachable nodes,
 *     isolated contracts;
 *   - unknown format or a contradictory graph fails loudly instead of degrading.
 *
 * Pure module: no I/O, no subprocess, no renderer binary.
 */

export type RenderFormat = 'mermaid' | 'dot' | 'json';

const FORMATS: readonly RenderFormat[] = ['mermaid', 'dot', 'json'];

const SEP = ' ｜ ';

export interface RenderEdgeInput {
  from: string;
  to: string;
  direction: 'forward' | 'backward' | 'skip';
  countAs: 'rollback' | 'rebuild' | 'none';
  label: string;
  bp?: { id: string; description: string; required: boolean };
}

export interface WorkflowGraphInput {
  workflow: string;
  phases: string[];
  terminal: string[];
  edges: RenderEdgeInput[];
  phaseBps?: Record<string, string[]>;
}

export interface RenderState {
  phase: string;
  rollbackCount: number;
  rollbackLimit: number;
  rebuildCount: number;
  rebuildLimit: number;
}

export interface RenderOpts {
  format: RenderFormat;
  state?: RenderState;
}

export interface ContractNodeInput {
  id: string;
  name: string;
  criticality: string;
  upstream: string[];
  downstream: string[];
}

export interface ContractGraphInput {
  contracts: ContractNodeInput[];
}

interface CanonEdge {
  from: string;
  to: string;
  direction: string;
  countAs: string;
  guarded: boolean;
  caption: string;
}

class RenderError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'RenderError';
    this.code = code;
  }
}

function assertFormat(format: RenderFormat): void {
  if (!FORMATS.includes(format)) {
    throw new RenderError('E-GRAPH-002', `未知渲染格式 "${String(format)}"（支持 ${FORMATS.join(' | ')}）`);
  }
}

/** Strip graph-syntax characters so no source value can break out of its label. */
function safe(value: string): string {
  return value.replace(/["[\]{}<>|`]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nodeOrder(input: WorkflowGraphInput): string[] {
  const nodes = [...input.phases];
  for (const t of input.terminal) if (!nodes.includes(t)) nodes.push(t);
  return nodes;
}

function canonicalEdges(input: WorkflowGraphInput): CanonEdge[] {
  const declared = new Set(nodeOrder(input));
  for (const e of input.edges) {
    for (const end of [e.from, e.to]) {
      if (!declared.has(end)) {
        throw new RenderError('E-GRAPH-003', `边 "${e.from} → ${e.to}" 引用未声明节点 "${end}"`);
      }
    }
  }
  return input.edges
    .map((e) => ({
      from: e.from,
      to: e.to,
      direction: e.direction,
      countAs: e.countAs,
      guarded: Boolean(e.bp),
      caption: `${safe(e.from)} → ${safe(e.to)}${SEP}${e.bp ? `${safe(e.bp.id)} ${safe(e.bp.description)}` : '未把守'}${SEP}${e.countAs}${SEP}${e.direction}`,
    }))
    .sort((a, b) => (a.caption < b.caption ? -1 : a.caption > b.caption ? 1 : 0));
}

function unreachableNodes(nodes: string[], edges: CanonEdge[]): string[] {
  if (nodes.length === 0) return [];
  const reached = new Set<string>([nodes[0]]);
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.from) ?? [];
    list.push(e.to);
    outgoing.set(e.from, list);
  }
  const queue = [nodes[0]];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of outgoing.get(current) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return nodes.filter((n) => !reached.has(n));
}

function budgetLine(state?: RenderState): string | null {
  if (!state) return null;
  return `%% 当前: ${safe(state.phase)}${SEP}回退 ${state.rollbackCount}/${state.rollbackLimit}${SEP}重建 ${state.rebuildCount}/${state.rebuildLimit}`;
}

export function renderStateMachine(input: WorkflowGraphInput, opts: RenderOpts): string {
  assertFormat(opts.format);
  const nodes = nodeOrder(input);
  const edges = canonicalEdges(input);
  const unreachable = unreachableNodes(nodes, edges);

  if (opts.format === 'json') {
    return `${JSON.stringify(
      {
        view: 'statemachine',
        workflow: input.workflow,
        nodes,
        edges,
        unreachable,
        state: opts.state ?? null,
      },
      null,
      2,
    )}\n`;
  }

  if (opts.format === 'dot') {
    const lines = ['digraph phase_graph {'];
    for (const n of nodes) lines.push(`  "${safe(n)}";`);
    for (const e of edges) {
      const style = e.direction === 'backward' ? ', style=dashed' : '';
      lines.push(`  "${safe(e.from)}" -> "${safe(e.to)}" [label="${e.caption}"${style}];`);
    }
    if (unreachable.length > 0) {
      lines.push(`  // 不可达节点: ${unreachable.map(safe).join(', ')}`);
    }
    lines.push('}');
    return `${lines.join('\n')}\n`;
  }

  const lines = ['flowchart LR', `  %% 来源: workflow=${safe(input.workflow)}`];
  const budget = budgetLine(opts.state);
  if (budget) lines.push(`  ${budget}`);
  nodes.forEach((n, i) => lines.push(`  p${i}["${safe(n)}"]`));
  for (const e of edges) {
    const from = nodes.indexOf(e.from);
    const to = nodes.indexOf(e.to);
    lines.push(`  p${from} --> p${to}["${safe(e.from)} → ${safe(e.to)}"] : "${e.caption}"`);
  }
  if (unreachable.length > 0) {
    lines.push(`  %% 不可达节点: ${unreachable.map(safe).join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderBpLanes(input: WorkflowGraphInput, opts: RenderOpts): string {
  assertFormat(opts.format);
  const nodes = nodeOrder(input);
  const lanes = nodes.map((phase) => ({
    phase,
    bps: input.phaseBps?.[phase] ?? [],
  }));

  if (opts.format === 'json') {
    return `${JSON.stringify({ view: 'lanes', workflow: input.workflow, lanes }, null, 2)}\n`;
  }

  if (opts.format === 'dot') {
    const lines = ['digraph bp_lanes {'];
    for (const lane of lanes) {
      const body = lane.bps.map((bp) => `"${safe(bp)}"`).join(' -> ') || '"无门禁"';
      lines.push(`  "${safe(lane.phase)}" [label="${safe(lane.phase)}: ${body}"];`);
    }
    lines.push('}');
    return `${lines.join('\n')}\n`;
  }

  const lines = ['flowchart TB'];
  lanes.forEach((lane, i) => {
    lines.push(`  subgraph lane_${i} ["${safe(lane.phase)}"]`);
    if (lane.bps.length === 0) {
      lines.push(`    n${i}_none["无门禁"]`);
    } else {
      lane.bps.forEach((bp, j) => lines.push(`    n${i}_${j}["${safe(bp)}"]`));
    }
    lines.push('  end');
  });
  for (let i = 0; i < lanes.length - 1; i++) lines.push(`  lane_${i} --> lane_${i + 1}`);
  return `${lines.join('\n')}\n`;
}

export function renderContractGraph(input: ContractGraphInput, opts: RenderOpts): string {  assertFormat(opts.format);
  const contracts = [...input.contracts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byName = new Map(contracts.map((c) => [c.name, c.id]));
  const externals = new Set<string>();
  const edges: { from: string; to: string; caption: string }[] = [];
  const isolated: string[] = [];

  for (const c of contracts) {
    if (c.upstream.length === 0 && c.downstream.length === 0) isolated.push(`${c.id} ${c.name}`);
    for (const up of [...c.upstream].sort()) {
      const source = byName.get(up) ?? `ext:${up}`;
      if (!byName.has(up)) externals.add(up);
      edges.push({ from: source, to: c.id, caption: `${safe(up)} → ${safe(c.name)}${SEP}${safe(c.criticality)}` });
    }
    for (const down of [...c.downstream].sort()) {
      const target = byName.get(down) ?? `ext:${down}`;
      if (!byName.has(down)) externals.add(down);
      edges.push({ from: c.id, to: target, caption: `${safe(c.name)} → ${safe(down)}${SEP}${safe(c.criticality)}` });
    }
  }
  edges.sort((a, b) => (a.caption < b.caption ? -1 : a.caption > b.caption ? 1 : 0));

  if (opts.format === 'json') {
    return `${JSON.stringify(
      { view: 'contracts', contracts, edges, external_parties: [...externals].sort(), isolated },
      null,
      2,
    )}\n`;
  }

  const ids = new Map<string, string>();
  contracts.forEach((c, i) => ids.set(c.id, `c${i}`));
  [...externals].sort().forEach((name, i) => ids.set(`ext:${name}`, `x${i}`));

  if (opts.format === 'dot') {
    const lines = ['digraph contract_graph {'];
    for (const c of contracts) lines.push(`  "${safe(c.id)}" [label="${safe(c.id)} ${safe(c.name)}"];`);
    for (const e of edges) lines.push(`  "${e.from}" -> "${e.to}" [label="${e.caption}"];`);
    if (isolated.length > 0) lines.push(`  // 孤立契约: ${isolated.map(safe).join(', ')}`);
    lines.push('}');
    return `${lines.join('\n')}\n`;
  }

  const lines = ['flowchart LR'];
  for (const c of contracts) lines.push(`  ${ids.get(c.id)}["${safe(c.id)} ${safe(c.name)}"]`);
  for (const name of [...externals].sort()) lines.push(`  ${ids.get(`ext:${name}`)}["${safe(name)}"]`);
  for (const e of edges) lines.push(`  ${ids.get(e.from) ?? e.from} --> ${ids.get(e.to) ?? e.to} : "${e.caption}"`);
  if (isolated.length > 0) lines.push(`  %% 孤立契约（无上下游声明）: ${isolated.map(safe).join(', ')}`);
  return `${lines.join('\n')}\n`;
}

export interface ConstraintLayerInput {
  level: number;
  scope: string;
  /** Scopes this layer inherits from (declared by the loader, never inferred here). */
  inheritedFrom: string[];
  merged?: boolean;
}

export interface ConstraintTreeInput {
  layers: ConstraintLayerInput[];
}

/**
 * Constraint inheritance tree: which layer a constraint arrives from, and which
 * links in the declared chain cannot be resolved (a break must stay visible —
 * a design product with a missing layer is not complete).
 */
export function renderConstraintTree(input: ConstraintTreeInput, opts: RenderOpts): string {
  assertFormat(opts.format);
  const layers = [...input.layers].sort(
    (a, b) => a.level - b.level || (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0),
  );
  const known = new Set(layers.map((l) => l.scope));
  const edges: { from: string; to: string; caption: string }[] = [];
  const unresolved: string[] = [];

  for (const layer of layers) {
    for (const parent of [...layer.inheritedFrom].sort()) {
      if (!known.has(parent)) {
        unresolved.push(`${layer.scope} ← ${parent}`);
        continue;
      }
      edges.push({
        from: parent,
        to: layer.scope,
        caption: `${safe(parent)} → ${safe(layer.scope)}${SEP}L${layer.level}${layer.merged ? `${SEP}merged` : ''}`,
      });
    }
  }
  edges.sort((a, b) => (a.caption < b.caption ? -1 : a.caption > b.caption ? 1 : 0));
  const uniqueEdges = edges.filter((e, i, all) => all.findIndex((x) => x.caption === e.caption) === i);
  const roots = layers.filter((l) => l.inheritedFrom.length === 0);
  const uniqueUnresolved = [...new Set(unresolved)].sort();

  if (opts.format === 'json') {
    return `${JSON.stringify(
      {
        view: 'constraints',
        layers,
        edges: uniqueEdges,
        roots,
        unresolved_inheritance: uniqueUnresolved,
      },
      null,
      2,
    )}\n`;
  }

  const ids = new Map<string, string>();
  layers.forEach((l, i) => ids.set(l.scope, `s${i}`));

  if (opts.format === 'dot') {
    const lines = ['digraph constraint_tree {'];
    for (const l of layers) {
      lines.push(`  "${safe(l.scope)}" [label="L${l.level} ${safe(l.scope)}"];`);
    }
    for (const e of uniqueEdges) {
      lines.push(`  "${safe(e.from)}" -> "${safe(e.to)}" [label="${e.caption}"];`);
    }
    if (uniqueUnresolved.length > 0) {
      lines.push(`  // 继承源未注册: ${uniqueUnresolved.map(safe).join(', ')}`);
    }
    lines.push('}');
    return `${lines.join('\n')}\n`;
  }

  const lines = ['flowchart TD'];
  for (const l of layers) lines.push(`  ${ids.get(l.scope)}["L${l.level} ${safe(l.scope)}"]`);
  for (const e of uniqueEdges) {
    lines.push(`  ${ids.get(e.from)} --> ${ids.get(e.to)} : "${e.caption}"`);
  }
  if (roots.length > 0) lines.push(`  %% 继承链根: ${roots.map((r) => safe(r.scope)).join(', ')}`);
  if (uniqueUnresolved.length > 0) {
    lines.push(`  %% 继承源未注册（断链）: ${uniqueUnresolved.map(safe).join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}
