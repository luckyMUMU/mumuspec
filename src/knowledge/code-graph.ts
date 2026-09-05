/**
 * Lightweight in-memory Code Graph — MVP implementation (0.20.0+).
 *
 * ponytail: in-memory Map-based graph, no SQLite or tree-sitter dependency.
 * Inspired by codebase-memory-mcp (CBM) file-level indexing approach.
 *
 * Provides:
 * - createGraph() — empty graph
 * - addNode/addEdge — graph construction
 * - searchNodes — symbol/file search
 * - tracePath — call chain traversal
 * - getStructure — directory-level structure summary
 */
import type {
  CodeGraph,
  GraphNode,
  GraphEdge,
  GraphNodeLabel,
  GraphSearchResult,
} from '../core/types-knowledge.js';

/** Create an empty code graph */
export function createGraph(): CodeGraph {
  return {
    nodes: new Map(),
    edges: [],
    fileIndex: new Map(),
    builtAt: new Date().toISOString(),
  };
}

/** Generate a unique node ID */
export function makeNodeId(label: GraphNodeLabel, name: string, filePath?: string): string {
  const base = filePath ? `${filePath}::${name}` : name;
  return `${label}:${base}`;
}

/** Add a node to the graph */
export function addNode(graph: CodeGraph, node: GraphNode): void {
  graph.nodes.set(node.id, node);
  if (node.filePath) {
    const existing = graph.fileIndex.get(node.filePath) ?? [];
    if (!existing.includes(node.id)) {
      existing.push(node.id);
      graph.fileIndex.set(node.filePath, existing);
    }
  }
}

/** Add an edge to the graph (deduplicates by from+to+type) */
export function addEdge(graph: CodeGraph, edge: GraphEdge): void {
  const exists = graph.edges.some(
    (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type,
  );
  if (!exists) {
    graph.edges.push(edge);
  }
}

/** Get a node by ID */
export function getNode(graph: CodeGraph, id: string): GraphNode | undefined {
  return graph.nodes.get(id);
}

/** Get all nodes for a given file path */
export function getNodesForFile(graph: CodeGraph, filePath: string): GraphNode[] {
  const ids = graph.fileIndex.get(filePath) ?? [];
  return ids.map((id) => graph.nodes.get(id)).filter((n): n is GraphNode => n !== undefined);
}

/** Search nodes by name (case-insensitive substring match) */
export function searchNodes(graph: CodeGraph, query: string, limit: number = 20): GraphSearchResult[] {
  const lower = query.toLowerCase();
  const results: GraphSearchResult[] = [];

  for (const node of graph.nodes.values()) {
    let score = 0;
    if (node.name.toLowerCase() === lower) {
      score = 100;
    } else if (node.name.toLowerCase().includes(lower)) {
      score = 50;
    } else if (node.filePath?.toLowerCase().includes(lower)) {
      score = 25;
    }

    if (score > 0) {
      results.push({ node, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Trace a call chain from a starting node (BFS, max depth) */
export function tracePath(
  graph: CodeGraph,
  startNodeId: string,
  maxDepth: number = 5,
): GraphNode[] {
  const visited = new Set<string>();
  const result: GraphNode[] = [];
  const queue: { id: string; depth: number }[] = [{ id: startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const node = graph.nodes.get(id);
    if (node) {
      result.push(node);
    }

    // Follow outgoing edges
    for (const edge of graph.edges) {
      if (edge.from === id && !visited.has(edge.to)) {
        queue.push({ id: edge.to, depth: depth + 1 });
      }
    }
  }

  return result;
}

/** Get a directory-level structure summary */
export function getStructure(
  graph: CodeGraph,
  dirPath: string,
): { modules: GraphNode[]; files: GraphNode[]; functions: GraphNode[]; classes: GraphNode[] } {
  const normalizedDir = dirPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const modules: GraphNode[] = [];
  const files: GraphNode[] = [];
  const functions: GraphNode[] = [];
  const classes: GraphNode[] = [];

  for (const node of graph.nodes.values()) {
    const nodePath = node.filePath ?? '';
    if (!nodePath.startsWith(normalizedDir)) continue;

    switch (node.label) {
      case 'Module':
        modules.push(node);
        break;
      case 'File':
        files.push(node);
        break;
      case 'Function':
        functions.push(node);
        break;
      case 'Class':
        classes.push(node);
        break;
    }
  }

  return { modules, files, functions, classes };
}

/** Get all outgoing edges from a node */
export function getOutgoingEdges(graph: CodeGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId);
}

/** Get all incoming edges to a node */
export function getIncomingEdges(graph: CodeGraph, nodeId: string): GraphEdge[] {
  return graph.edges.filter((e) => e.to === nodeId);
}

/** Get graph statistics */
export function getGraphStats(graph: CodeGraph): {
  totalNodes: number;
  totalEdges: number;
  byLabel: Record<string, number>;
  fileCount: number;
} {
  const byLabel: Record<string, number> = {};
  for (const node of graph.nodes.values()) {
    byLabel[node.label] = (byLabel[node.label] ?? 0) + 1;
  }
  return {
    totalNodes: graph.nodes.size,
    totalEdges: graph.edges.length,
    byLabel,
    fileCount: graph.fileIndex.size,
  };
}

/** Serialize graph to JSON for persistence */
export function serializeGraph(graph: CodeGraph): string {
  const nodes = Array.from(graph.nodes.entries()).map(([id, node]) => {
    const { id: _omit, ...rest } = node;
    return { id, ...rest };
  });
  const fileIndex = Array.from(graph.fileIndex.entries()).map(([path, ids]) => ({ path, ids }));
  return JSON.stringify({ nodes, edges: graph.edges, fileIndex, builtAt: graph.builtAt }, null, 2);
}

/** Deserialize graph from JSON */
export function deserializeGraph(json: string): CodeGraph {
  const data = JSON.parse(json) as {
    nodes: (GraphNode & { id: string })[];
    edges: GraphEdge[];
    fileIndex: { path: string; ids: string[] }[];
    builtAt: string;
  };
  const graph = createGraph();
  graph.builtAt = data.builtAt;
  for (const node of data.nodes) {
    graph.nodes.set(node.id, node);
  }
  graph.edges = data.edges;
  for (const entry of data.fileIndex) {
    graph.fileIndex.set(entry.path, entry.ids);
  }
  return graph;
}
