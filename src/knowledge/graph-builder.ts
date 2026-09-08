/**
 * Code Graph Builder — constructs an in-memory CodeGraph from a project.
 *
 * ponytail: reuses existing directory traversal from code-scanner.ts and
 * language provider registry from guard/language-provider-registry.ts.
 * No new dependencies — only Node.js built-ins + existing TS Compiler API.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { computeHash, SKIP_DIRS, findSpecDirs } from '../core/utils.js';
import { registerBuiltInProviders, getLanguageProvider } from '../guard/language-provider-registry.js';
import {
  createGraph,
  addNode,
  addEdge,
  makeNodeId,
} from './code-graph.js';
import type { CodeGraph, GraphNode, GraphEdge } from '../core/types-knowledge.js';
import type { MumuSpecConfig } from '../core/config.js';

// ponytail: skip directories shared with code-scanner.ts
// SKIP_DIRS 已统一收编到 core/utils.js（Phase 3.4）

// Per-project graph cache — avoids rebuilding on every CLI/MCP call
let _graphCache: { root: string; graph: CodeGraph } | null = null;

/** Get the cached code graph for a project root (builds on first access). */
export function getCachedCodeGraph(root: string): CodeGraph {
  if (!_graphCache || _graphCache.root !== root) {
    _graphCache = { root, graph: buildCodeGraph(root) };
  }
  return _graphCache.graph;
}

/** Build a code graph from a project root */
export function buildCodeGraph(
  projectRoot: string,
  _config?: MumuSpecConfig,
): CodeGraph {
  // Ensure language providers are registered
  registerBuiltInProviders();

  const graph = createGraph();

  // 1. Traverse source directories and build File/Function/Class nodes
  traverseDir(projectRoot, projectRoot, graph);

  // 2. Build Module nodes from directory structure
  buildModuleNodes(projectRoot, graph);

  // 3. Analyze import relationships to build CALLS edges
  buildImportEdges(projectRoot, graph);

  // 4. Match spec.md bindings to build GOVERNED_BY edges
  buildSpecBindings(projectRoot, graph);

  return graph;
}

/** Recursively traverse a directory, building File/Function/Class nodes */
function traverseDir(
  projectRoot: string,
  dirPath: string,
  graph: CodeGraph,
  depth: number = 0,
): void {
  if (depth > 8) return; // ponytail: max depth to prevent infinite recursion

  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;

    const fullPath = join(dirPath, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      traverseDir(projectRoot, fullPath, graph, depth + 1);
    } else if (stat.isFile()) {
      processFile(projectRoot, fullPath, graph);
    }
  }
}

/** Process a single source file — extract symbols and create graph nodes */
function processFile(
  projectRoot: string,
  filePath: string,
  graph: CodeGraph,
): void {
  const ext = extname(filePath).toLowerCase();
  const relPath = relative(projectRoot, filePath).replace(/\\/g, '/');

  // Get language provider for this extension
  const provider = getLanguageProvider(ext);
  if (!provider) return; // Not a supported language

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  // Create File node
  const fileNodeId = makeNodeId('File', relPath);
  const fileNode: GraphNode = {
    id: fileNodeId,
    label: 'File',
    name: relPath.split('/').pop() ?? relPath,
    filePath: relPath,
    language: provider.language,
    hash: computeHash(content),
  };
  addNode(graph, fileNode);

  // Extract symbols using the language provider
  if (provider.extractSymbols) {
    const symbols = provider.extractSymbols(content, relPath);
    for (const sym of symbols) {
      const symNodeId = makeNodeId(
        sym.kind === 'class' ? 'Class' : 'Function',
        sym.name,
        relPath,
      );
      const symNode: GraphNode = {
        id: symNodeId,
        label: sym.kind === 'class' ? 'Class' : 'Function',
        name: sym.name,
        filePath: relPath,
        language: provider.language,
        startLine: sym.startLine,
        endLine: sym.endLine,
      };
      addNode(graph, symNode);

      // File DEFINES Symbol
      const edge: GraphEdge = {
        from: fileNodeId,
        to: symNodeId,
        type: 'DEFINES',
      };
      addEdge(graph, edge);
    }
  }
}

/** Build Module nodes from directory structure and CONTAINS edges */
function buildModuleNodes(_projectRoot: string, graph: CodeGraph): void {
  // Collect unique directories from file nodes
  const dirs = new Set<string>();
  for (const node of graph.nodes.values()) {
    if (node.filePath) {
      const parts = node.filePath.split('/');
      for (let i = 1; i < parts.length; i++) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    }
  }

  for (const dir of dirs) {
    const moduleId = makeNodeId('Module', dir);
    if (!graph.nodes.has(moduleId)) {
      const parts = dir.split('/');
      const moduleName = parts[parts.length - 1] ?? dir;
      addNode(graph, {
        id: moduleId,
        label: 'Module',
        name: moduleName,
        filePath: dir,
      });
    }

    // Module CONTAINS File nodes in this directory
    const dirPrefix = dir + '/';
    for (const node of graph.nodes.values()) {
      if (node.label === 'File' && node.filePath?.startsWith(dirPrefix)) {
        addEdge(graph, { from: moduleId, to: node.id, type: 'CONTAINS' });
      }
    }

    // Parent Module CONTAINS this Module
    const parentParts = dir.split('/');
    if (parentParts.length > 1) {
      const parentDir = parentParts.slice(0, -1).join('/');
      const parentId = makeNodeId('Module', parentDir);
      if (graph.nodes.has(parentId)) {
        addEdge(graph, { from: parentId, to: moduleId, type: 'CONTAINS' });
      }
    }
  }
}

/** Analyze import statements to build CALLS edges between files */
function buildImportEdges(projectRoot: string, graph: CodeGraph): void {
  // ponytail: simple heuristic — match import paths to file nodes
  for (const node of graph.nodes.values()) {
    if (node.label !== 'File' || !node.filePath) continue;

    const absPath = join(projectRoot, node.filePath);
    let content: string;
    try {
      content = readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    // Match relative import paths (simplified)
    const importRegex = /(?:import|require)\s*\(?[^'"]*['"](\.[^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Resolve relative to the file's directory
      const fileDir = node.filePath.split('/').slice(0, -1).join('/');
      const resolvedBase = resolveRelativePath(fileDir, importPath);

      // Try matching with and without extension (import may omit .ts)
      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '.mjs']) {
        const candidate = ext ? resolvedBase.replace(/\.(ts|tsx|js|jsx|mjs)$/, '') + ext : resolvedBase;
        const targetFileId = makeNodeId('File', candidate);
        if (graph.nodes.has(targetFileId)) {
          addEdge(graph, { from: node.id, to: targetFileId, type: 'CALLS' });
          break; // ponytail: first match wins
        }
      }
    }
  }
}

/** Resolve a relative import path against a directory */
function resolveRelativePath(dir: string, importPath: string): string {
  if (importPath.startsWith('./')) {
    return (dir ? dir + '/' : '') + importPath.slice(2);
  }
  if (importPath.startsWith('../')) {
    const parts = dir.split('/');
    parts.pop();
    return (parts.length > 0 ? parts.join('/') + '/' : '') + importPath.slice(3);
  }
  return importPath;
}

/** Match spec.md bindings to build GOVERNED_BY edges */
function buildSpecBindings(projectRoot: string, graph: CodeGraph): void {
  // ponytail: scan .mumuspec/spec.md files for binding declarations
  const specDirs = findMumuSpecDirs(projectRoot);
  for (const specDir of specDirs) {
    const specPath = join(specDir, 'spec.md');
    if (!existsSync(specPath)) continue;

    let content: string;
    try {
      content = readFileSync(specPath, 'utf8');
    } catch {
      continue;
    }

    // Match SHALL/SHALL NOT requirements with binding paths
    const reqRegex = /^##\s+Requirement:\s+(.+)$/gm;
    const bindingRegex = /target:\s*["']([^"']+)["']/gm;

    let reqMatch: RegExpExecArray | null;
    while ((reqMatch = reqRegex.exec(content)) !== null) {
      const reqName = reqMatch[1].trim();
      const blockEnd = content.indexOf('## Requirement:', reqMatch.index + 1);
      const block = content.substring(reqMatch.index, blockEnd === -1 ? content.length : blockEnd);

      const isShallNot = /SHALL\s+NOT/i.test(block);
      const specNodeId = makeNodeId('Spec', reqName);
      addNode(graph, {
        id: specNodeId,
        label: 'Spec',
        name: reqName,
        specType: isShallNot ? 'SHALL_NOT' : 'SHALL',
      });

      // Match binding targets to file/function nodes
      let bindMatch: RegExpExecArray | null;
      while ((bindMatch = bindingRegex.exec(block)) !== null) {
        const targetPath = bindMatch[1];
        // Find matching file nodes
        for (const node of graph.nodes.values()) {
          if (node.label === 'File' && node.filePath) {
            // Simple glob matching: **/*.ts → match .ts files
            if (matchesGlob(node.filePath, targetPath)) {
              addEdge(graph, {
                from: node.id,
                to: specNodeId,
                type: 'GOVERNED_BY',
              });
            }
          }
        }
      }
    }
  }
}

/** Find all .mumuspec directories in the project (delegates to shared core walker) */
function findMumuSpecDirs(projectRoot: string): string[] {
  const parents = existsSync(join(projectRoot, '.mumuspec'))
    ? [projectRoot, ...findSpecDirs(projectRoot)]
    : findSpecDirs(projectRoot);
  return parents.map((d) => join(d, '.mumuspec'));
}

/** Simple glob matching — supports ** and * */
function matchesGlob(filePath: string, pattern: string): boolean {
  // ponytail: minimal glob — convert pattern to regex
  const regexStr = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\./g, '\\.');
  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(filePath);
}

/** Incremental update — rebuild only changed file nodes */
export function updateCodeGraph(
  projectRoot: string,
  graph: CodeGraph,
  changedFiles: string[],
): CodeGraph {
  registerBuiltInProviders();

  for (const filePath of changedFiles) {
    const relPath = relative(projectRoot, filePath).replace(/\\/g, '/');

    // Remove old nodes for this file
    const nodeIds = graph.fileIndex.get(relPath) ?? [];
    for (const id of nodeIds) {
      graph.nodes.delete(id);
      // Remove associated edges
      graph.edges = graph.edges.filter((e) => e.from !== id && e.to !== id);
    }
    graph.fileIndex.delete(relPath);

    // Re-process the file if it still exists
    if (existsSync(filePath)) {
      processFile(projectRoot, filePath, graph);
    }
  }

  graph.builtAt = new Date().toISOString();
  return graph;
}

// Re-export graph utilities for convenience
export {
  createGraph,
  addNode,
  addEdge,
  makeNodeId,
  serializeGraph,
  deserializeGraph,
} from './code-graph.js';

