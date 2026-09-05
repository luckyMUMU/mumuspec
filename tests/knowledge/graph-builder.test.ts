/**
 * Unit tests for src/knowledge/graph-builder.ts — project graph construction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildCodeGraph, updateCodeGraph } from '../../src/knowledge/graph-builder.js';
import { searchNodes, getGraphStats } from '../../src/knowledge/code-graph.js';

let tmpRoot: string;

function setupProject(files: Record<string, string>): string {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mumuspec-graph-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(tmpRoot, relPath);
    const dir = join(fullPath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
  return tmpRoot;
}

afterEach(() => {
  if (tmpRoot) {
    rmSync(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
});

describe('buildCodeGraph', () => {
  it('should build File and Function nodes from TS source', () => {
    const root = setupProject({
      'src/utils.ts': `
        export function add(a: number, b: number): number { return a + b; }
        export class Calculator {
          multiply(a: number, b: number): number { return a * b; }
        }
      `,
    });

    const graph = buildCodeGraph(root);
    const stats = getGraphStats(graph);
    expect(stats.byLabel['File']).toBe(1);
    expect(stats.byLabel['Function']).toBeGreaterThanOrEqual(1);
    expect(stats.byLabel['Class']).toBeGreaterThanOrEqual(1);
  });

  it('should create DEFINES edges from File to symbols', () => {
    const root = setupProject({
      'src/math.ts': `export function compute() { return 42; }`,
    });

    const graph = buildCodeGraph(root);
    const funcResults = searchNodes(graph, 'compute');
    expect(funcResults).toHaveLength(1);
    const funcNode = funcResults[0].node;
    // File should DEFINE this function
    const fileEdges = graph.edges.filter((e) => e.to === funcNode.id && e.type === 'DEFINES');
    expect(fileEdges).toHaveLength(1);
  });

  it('should create Module nodes from directory structure', () => {
    const root = setupProject({
      'src/api/handler.ts': `export function handle() { return; }`,
      'src/api/util.ts': `export function util() { return; }`,
    });

    const graph = buildCodeGraph(root);
    const moduleNodes = Array.from(graph.nodes.values()).filter((n) => n.label === 'Module');
    expect(moduleNodes.length).toBeGreaterThanOrEqual(1);
    // Should have a module for 'src' and 'src/api'
    const moduleNames = moduleNodes.map((m) => m.name);
    expect(moduleNames).toContain('src');
    expect(moduleNames).toContain('api');
  });

  it('should create CONTAINS edges from Module to File', () => {
    const root = setupProject({
      'src/a.ts': `export function foo() { return; }`,
    });

    const graph = buildCodeGraph(root);
    const containsEdges = graph.edges.filter((e) => e.type === 'CONTAINS');
    expect(containsEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('should create CALLS edges from import statements', () => {
    const root = setupProject({
      'src/a.ts': `import { foo } from './b';\nexport function caller() { return foo(); }`,
      'src/b.ts': `export function foo() { return 42; }`,
    });

    const graph = buildCodeGraph(root);
    const callsEdges = graph.edges.filter((e) => e.type === 'CALLS');
    expect(callsEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip node_modules and dist directories', () => {
    const root = setupProject({
      'src/main.ts': `export function main() { return; }`,
      'node_modules/pkg/index.ts': `export function evil() { return; }`,
      'dist/main.js': `function built() { return; }`,
    });

    const graph = buildCodeGraph(root);
    expect(searchNodes(graph, 'evil')).toHaveLength(0);
    expect(searchNodes(graph, 'built')).toHaveLength(0);
    // 'main' matches both the file 'main.ts' and the function 'main'
    const mainResults = searchNodes(graph, 'main');
    expect(mainResults.length).toBeGreaterThanOrEqual(1);
    expect(mainResults.some((r) => r.node.label === 'File')).toBe(true);
  });

  it('should handle empty project gracefully', () => {
    const root = setupProject({});
    const graph = buildCodeGraph(root);
    expect(getGraphStats(graph).totalNodes).toBe(0);
  });

  it('should ignore non-source files', () => {
    const root = setupProject({
      'src/data.json': `{ "key": "value" }`,
      'src/readme.md': `# Hello`,
      'src/code.ts': `export function real() { return; }`,
    });

    const graph = buildCodeGraph(root);
    const stats = getGraphStats(graph);
    expect(stats.byLabel['File']).toBe(1);
    expect(searchNodes(graph, 'real')).toHaveLength(1);
  });
});

describe('updateCodeGraph (incremental)', () => {
  it('should rebuild only changed file nodes', () => {
    const root = setupProject({
      'src/a.ts': `export function foo() { return; }`,
      'src/b.ts': `export function bar() { return; }`,
    });

    const graph = buildCodeGraph(root);
    const beforeCount = graph.nodes.size;

    // Modify one file
    writeFileSync(join(root, 'src/a.ts'), `export function renamed() { return; }`, 'utf8');

    const updated = updateCodeGraph(root, graph, [join(root, 'src/a.ts')]);
    // New function node added
    expect(searchNodes(updated, 'renamed')).toHaveLength(1);
    // Old function removed
    expect(searchNodes(updated, 'foo')).toHaveLength(0);
    // b.ts still has bar
    expect(searchNodes(updated, 'bar')).toHaveLength(1);
  });

  it('should remove nodes for deleted files', () => {
    const root = setupProject({
      'src/a.ts': `export function foo() { return; }`,
    });

    const graph = buildCodeGraph(root);
    expect(searchNodes(graph, 'foo')).toHaveLength(1);

    rmSync(join(root, 'src/a.ts'));
    const updated = updateCodeGraph(root, graph, [join(root, 'src/a.ts')]);
    expect(searchNodes(updated, 'foo')).toHaveLength(0);
  });
});
