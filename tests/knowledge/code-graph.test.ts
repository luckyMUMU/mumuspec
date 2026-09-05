/**
 * Unit tests for src/knowledge/code-graph.ts — in-memory graph operations.
 */
import { describe, it, expect } from 'vitest';
import {
  createGraph,
  makeNodeId,
  addNode,
  addEdge,
  getNode,
  getNodesForFile,
  searchNodes,
  tracePath,
  getStructure,
  getOutgoingEdges,
  getIncomingEdges,
  getGraphStats,
  serializeGraph,
  deserializeGraph,
} from '../../src/knowledge/code-graph.js';
import type { GraphNode, GraphEdge } from '../../src/core/types-knowledge.js';

function makeFileNode(name: string, filePath: string): GraphNode {
  return { id: makeNodeId('File', name), label: 'File', name, filePath };
}

function makeFuncNode(name: string, filePath: string, startLine?: number): GraphNode {
  return { id: makeNodeId('Function', name, filePath), label: 'Function', name, filePath, startLine };
}

describe('createGraph', () => {
  it('should create an empty graph', () => {
    const g = createGraph();
    expect(g.nodes.size).toBe(0);
    expect(g.edges).toHaveLength(0);
    expect(g.fileIndex.size).toBe(0);
    expect(g.builtAt).toBeTruthy();
  });
});

describe('makeNodeId', () => {
  it('should generate id with label and name', () => {
    expect(makeNodeId('File', 'git.ts')).toBe('File:git.ts');
  });

  it('should include filePath when provided', () => {
    expect(makeNodeId('Function', 'foo', 'src/git.ts')).toBe('Function:src/git.ts::foo');
  });
});

describe('addNode', () => {
  it('should add a node to the graph', () => {
    const g = createGraph();
    const node = makeFileNode('git.ts', 'src/git.ts');
    addNode(g, node);
    expect(g.nodes.size).toBe(1);
    expect(getNode(g, node.id)).toBe(node);
  });

  it('should index by filePath', () => {
    const g = createGraph();
    addNode(g, makeFileNode('git.ts', 'src/git.ts'));
    addNode(g, makeFuncNode('clone', 'src/git.ts'));
    const nodes = getNodesForFile(g, 'src/git.ts');
    expect(nodes).toHaveLength(2);
  });

  it('should not duplicate fileIndex entries', () => {
    const g = createGraph();
    const node = makeFileNode('git.ts', 'src/git.ts');
    addNode(g, node);
    addNode(g, node);
    expect(g.nodes.size).toBe(1);
    expect(getNodesForFile(g, 'src/git.ts')).toHaveLength(1);
  });
});

describe('addEdge', () => {
  it('should add an edge', () => {
    const g = createGraph();
    const edge: GraphEdge = { from: 'A', to: 'B', type: 'CALLS' };
    addEdge(g, edge);
    expect(g.edges).toHaveLength(1);
  });

  it('should deduplicate edges with same from+to+type', () => {
    const g = createGraph();
    const edge: GraphEdge = { from: 'A', to: 'B', type: 'CALLS' };
    addEdge(g, edge);
    addEdge(g, edge);
    expect(g.edges).toHaveLength(1);
  });

  it('should allow different edge types between same nodes', () => {
    const g = createGraph();
    addEdge(g, { from: 'A', to: 'B', type: 'CALLS' });
    addEdge(g, { from: 'A', to: 'B', type: 'CONTAINS' });
    expect(g.edges).toHaveLength(2);
  });
});

describe('searchNodes', () => {
  it('should find nodes by exact name (score 100)', () => {
    const g = createGraph();
    addNode(g, makeFuncNode('createGraph', 'code-graph.ts'));
    const results = searchNodes(g, 'createGraph');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(100);
  });

  it('should find nodes by substring (score 50)', () => {
    const g = createGraph();
    addNode(g, makeFuncNode('createGraph', 'code-graph.ts'));
    const results = searchNodes(g, 'create');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(50);
  });

  it('should find nodes by file path (score 25)', () => {
    const g = createGraph();
    addNode(g, makeFuncNode('foo', 'src/code-graph.ts'));
    const results = searchNodes(g, 'code-graph');
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(25);
  });

  it('should return empty when no match', () => {
    const g = createGraph();
    addNode(g, makeFuncNode('foo', 'src/a.ts'));
    expect(searchNodes(g, 'bar')).toHaveLength(0);
  });

  it('should respect limit', () => {
    const g = createGraph();
    for (let i = 0; i < 10; i++) {
      addNode(g, makeFuncNode(`func${i}`, `src/f${i}.ts`));
    }
    const results = searchNodes(g, 'func', 3);
    expect(results).toHaveLength(3);
  });

  it('should sort by score descending', () => {
    const g = createGraph();
    addNode(g, { id: makeNodeId('Function', 'foo'), label: 'Function', name: 'foo', filePath: 'src/foo.ts' });
    addNode(g, { id: makeNodeId('Function', 'foobar'), label: 'Function', name: 'foobar', filePath: 'src/x.ts' });
    const results = searchNodes(g, 'foo');
    expect(results[0].node.name).toBe('foo');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});

describe('tracePath', () => {
  it('should traverse BFS from start node', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFileNode('b.ts', 'src/b.ts'));
    addNode(g, makeFileNode('c.ts', 'src/c.ts'));
    addEdge(g, { from: makeNodeId('File', 'a.ts'), to: makeNodeId('File', 'b.ts'), type: 'CALLS' });
    addEdge(g, { from: makeNodeId('File', 'b.ts'), to: makeNodeId('File', 'c.ts'), type: 'CALLS' });
    const path = tracePath(g, makeNodeId('File', 'a.ts'), 5);
    expect(path).toHaveLength(3);
    expect(path[0].name).toBe('a.ts');
    expect(path[2].name).toBe('c.ts');
  });

  it('should respect maxDepth', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFileNode('b.ts', 'src/b.ts'));
    addEdge(g, { from: makeNodeId('File', 'a.ts'), to: makeNodeId('File', 'b.ts'), type: 'CALLS' });
    const path = tracePath(g, makeNodeId('File', 'a.ts'), 0);
    expect(path).toHaveLength(1);
  });

  it('should handle cycles with visited set', () => {
    const g = createGraph();
    const idA = makeNodeId('File', 'a.ts');
    const idB = makeNodeId('File', 'b.ts');
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFileNode('b.ts', 'src/b.ts'));
    addEdge(g, { from: idA, to: idB, type: 'CALLS' });
    addEdge(g, { from: idB, to: idA, type: 'CALLS' });
    const path = tracePath(g, idA, 5);
    expect(path).toHaveLength(2);
  });

  it('should return empty for non-existent start node', () => {
    const g = createGraph();
    const path = tracePath(g, 'nonexistent', 5);
    expect(path).toHaveLength(0);
  });
});

describe('getStructure', () => {
  it('should group nodes by label within a directory', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFileNode('b.ts', 'src/b.ts'));
    addNode(g, makeFuncNode('foo', 'src/a.ts'));
    const struct = getStructure(g, 'src');
    expect(struct.files).toHaveLength(2);
    expect(struct.functions).toHaveLength(1);
    expect(struct.modules).toHaveLength(0);
    expect(struct.classes).toHaveLength(0);
  });

  it('should not include nodes from other directories', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFileNode('b.ts', 'tests/b.ts'));
    const struct = getStructure(g, 'src');
    expect(struct.files).toHaveLength(1);
    expect(struct.files[0].name).toBe('a.ts');
  });
});

describe('getOutgoingEdges / getIncomingEdges', () => {
  it('should return outgoing edges', () => {
    const g = createGraph();
    addEdge(g, { from: 'A', to: 'B', type: 'CALLS' });
    addEdge(g, { from: 'A', to: 'C', type: 'CALLS' });
    addEdge(g, { from: 'B', to: 'C', type: 'CALLS' });
    expect(getOutgoingEdges(g, 'A')).toHaveLength(2);
    expect(getIncomingEdges(g, 'C')).toHaveLength(2);
    expect(getOutgoingEdges(g, 'C')).toHaveLength(0);
  });
});

describe('getGraphStats', () => {
  it('should count nodes, edges, and byLabel', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFuncNode('foo', 'src/a.ts'));
    addEdge(g, { from: 'File:a.ts', to: 'Function:src/a.ts::foo', type: 'DEFINES' });
    const stats = getGraphStats(g);
    expect(stats.totalNodes).toBe(2);
    expect(stats.totalEdges).toBe(1);
    expect(stats.byLabel['File']).toBe(1);
    expect(stats.byLabel['Function']).toBe(1);
    expect(stats.fileCount).toBe(1);
  });
});

describe('serializeGraph / deserializeGraph', () => {
  it('should round-trip serialize and deserialize', () => {
    const g = createGraph();
    addNode(g, makeFileNode('a.ts', 'src/a.ts'));
    addNode(g, makeFuncNode('foo', 'src/a.ts', 10));
    addEdge(g, { from: 'File:a.ts', to: 'Function:src/a.ts::foo', type: 'DEFINES' });
    const json = serializeGraph(g);
    const restored = deserializeGraph(json);
    expect(restored.nodes.size).toBe(2);
    expect(restored.edges).toHaveLength(1);
    expect(restored.fileIndex.size).toBe(1);
    expect(restored.builtAt).toBe(g.builtAt);
  });

  it('should preserve node fields after round-trip', () => {
    const g = createGraph();
    addNode(g, { id: 'Function:foo', label: 'Function', name: 'foo', filePath: 'src/a.ts', startLine: 5, endLine: 10 });
    const restored = deserializeGraph(serializeGraph(g));
    const node = getNode(restored, 'Function:foo');
    expect(node?.startLine).toBe(5);
    expect(node?.endLine).toBe(10);
  });
});
