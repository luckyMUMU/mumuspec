/**
 * Contract Loader — loads, parses, and resolves contract registries
 * from .mumuspec/contracts/ directories.
 *
 * Supports tree-distributed contract definitions unified into a
 * single resolved registry at project root.
 */

import { existsSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  Contract,
  ContractRegistry,
  BoundaryDocument,
  BoundaryExport,
  BoundaryDependency,
  BoundaryDataContract,
  BoundaryChangeEntry,
} from '../core/types-contract.js';
import { readText } from '../core/utils.js';
import { MUMUSPEC_DIR, CONTRACTS_SUBDIR, REGISTRY_FILE, MAX_SCAN_DEPTH } from './constants.js';

/** Contract registry file names to discover */
const REGISTRY_FILES = ['contracts.yaml', 'contracts.yml', 'contracts.json'];

/** Boundary document file name */
const BOUNDARY_FILE = 'BOUNDARY.md';

// ════════════════════════════════════════════════════════════════════
// Cache Layer — ponytail: simple Map cache, no external dependency
// ════════════════════════════════════════════════════════════════════

/** Module-level cache: projectRoot -> ContractRegistry */
const _registryCache = new Map<string, ContractRegistry>();

/**
 * Invalidate the contract registry cache for a project.
 * MUST be called after any write operation (persist/deprecate/remove).
 */
export function invalidateContractCache(projectRoot: string): void {
  _registryCache.delete(resolve(projectRoot));
}

/**
 * Load all contracts from a project root.
 *
 * Walks the directory tree, resolves each `.mumuspec/contracts/`
 * directory found, and merges all contracts into a unified registry.
 *
 * Result is cached per projectRoot — call invalidateContractCache() after writes.
 */
export function loadAllContracts(projectRoot: string): ContractRegistry {
  const root = resolve(projectRoot);

  // Return cached registry if available
  const cached = _registryCache.get(root);
  if (cached) return cached;

  const registries = discoverContractDirs(root);
  const allContracts: Contract[] = [];
  const outboundIds: string[] = [];
  const inboundIds: string[] = [];
  const depGraph: Record<string, string[]> = {};

  for (const dir of registries) {
    const reg = loadContractRegistry(dir);
    if (!reg) continue;

    for (const contract of reg.contracts) {
      // Deduplicate by id — root-level wins on conflict
      if (!allContracts.find((c: Contract) => c.id === contract.id)) {
        allContracts.push(contract);
      }
    }

    for (const id of reg.outbound_ids) {
      if (!outboundIds.includes(id)) outboundIds.push(id);
    }
    for (const id of reg.inbound_ids) {
      if (!inboundIds.includes(id)) inboundIds.push(id);
    }

    if (reg.dependency_graph) {
      Object.assign(depGraph, reg.dependency_graph);
    }
  }

  const registry: ContractRegistry = {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    contracts: allContracts,
    dependency_graph: depGraph,
    outbound_ids: outboundIds,
    inbound_ids: inboundIds,
  };

  // Cache the result
  _registryCache.set(root, registry);
  return registry;
}

/**
 * Load a contract registry from a single .mumuspec/contracts/ directory.
 */
export function loadContractRegistry(dirPath: string): ContractRegistry | null {
  for (const filename of REGISTRY_FILES) {
    const filePath = join(dirPath, filename);
    if (existsSync(filePath)) {
      const content = readText(filePath);
      if (!content) continue;
      if (filename.endsWith('.json')) {
        return JSON.parse(content) as ContractRegistry;
      }
      return parseYaml(content) as ContractRegistry;
    }
  }
  return null;
}

/**
 * Find a single contract by ID across the project.
 */
export function findContract(projectRoot: string, contractId: string): Contract | null {
  const registry = loadAllContracts(projectRoot);
  return registry.contracts.find((c: Contract) => c.id === contractId) ?? null;
}

/**
 * Get all outbound contracts (this project exposes to external consumers).
 */
export function getOutboundContracts(projectRoot: string): Contract[] {
  const registry = loadAllContracts(projectRoot);
  return registry.contracts.filter((c: Contract) => registry.outbound_ids.includes(c.id));
}

/**
 * Get all inbound contracts (this project depends on externally).
 */
export function getInboundContracts(projectRoot: string): Contract[] {
  const registry = loadAllContracts(projectRoot);
  return registry.contracts.filter((c: Contract) => registry.inbound_ids.includes(c.id));
}

/**
 * Discover all `.mumuspec/contracts/` directories in the project tree.
 */
export function discoverContractDirs(projectRoot: string): string[] {
  const results: string[] = [];
  const visited = new Set<string>(); // Symlink cycle guard

  function scan(dir: string, depth: number = 0) {
    if (depth > MAX_SCAN_DEPTH) return;  // ponytail: reasonable limit — contract dirs shouldn't be nested too deep

    // Resolve real path to detect symlink cycles
    let realPath: string;
    try {
      realPath = lstatSync(dir).isSymbolicLink() ? resolve(dir, '..', readlinkSync(dir, 'utf-8')) : dir;
    } catch {
      realPath = dir;
    }
    const normalized = resolve(realPath);
    if (visited.has(normalized)) return;
    visited.add(normalized);

    const contractsPath = join(dir, MUMUSPEC_DIR, CONTRACTS_SUBDIR);
    if (existsSync(contractsPath) && (
      existsSync(join(contractsPath, REGISTRY_FILE)) ||
      existsSync(join(contractsPath, 'contracts.yml')) ||
      existsSync(join(contractsPath, 'contracts.json'))
    )) {
      results.push(contractsPath);
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore
    }
  }

  scan(projectRoot);
  return results;
}

/**
 * Resolve a contract's relative source path to absolute path.
 */
export function resolveContractSource(contractRef: string, fromDir: string): string {
  if (contractRef.startsWith('/')) {
    return contractRef;
  }
  return resolve(fromDir, contractRef);
}

// ════════════════════════════════════════════════════════════════════
// Boundary Document Loader
// ════════════════════════════════════════════════════════════════════

/**
 * Load a BOUNDARY.md file from a directory.
 */
export function loadBoundaryDocument(dirPath: string): BoundaryDocument | null {
  const filePath = join(dirPath, BOUNDARY_FILE);
  if (!existsSync(filePath)) return null;

  const content = readText(filePath);
  if (!content) return null;

  return parseBoundaryDocument(content, dirPath, filePath);
}

/**
 * Parse BOUNDARY.md content into structured format.
 */
export function parseBoundaryDocument(
  content: string,
  dirPath: string,
  filePath: string,
): BoundaryDocument {
  const exports_entries = parseSection(content, '对外接口');
  const deps_entries = parseSection(content, '依赖声明');
  const data_entries = parseSection(content, '数据契约');
  const changelog_entries = parseSection(content, '变更日志');

  return {
    dir_path: dirPath,
    file_path: filePath,
    exports: parseExports(exports_entries),
    dependencies: parseDependencies(deps_entries),
    data_contracts: parseDataContracts(data_entries),
    change_log: parseChangeLog(changelog_entries),
    raw: content,
  };
}

/**
 * Find all BOUNDARY.md files in the project.
 */
export function findAllBoundaryDocuments(projectRoot: string): BoundaryDocument[] {
  const results: BoundaryDocument[] = [];
  const visited = new Set<string>(); // Symlink cycle guard

  function scan(dir: string, depth: number = 0) {
    if (depth > MAX_SCAN_DEPTH) return;  // ponytail: reasonable limit

    // Resolve real path to detect symlink cycles
    let realPath: string;
    try {
      realPath = lstatSync(dir).isSymbolicLink() ? resolve(dir, '..', readlinkSync(dir, 'utf-8')) : dir;
    } catch {
      realPath = dir;
    }
    const normalized = resolve(realPath);
    if (visited.has(normalized)) return;
    visited.add(normalized);

    const boundaryPath = join(dir, BOUNDARY_FILE);
    if (existsSync(boundaryPath)) {
      const content = readText(boundaryPath);
      if (content) {
        results.push(parseBoundaryDocument(content, dir, boundaryPath));
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore
    }
  }

  scan(projectRoot);
  return results;
}

// ════════════════════════════════════════════════════════════════════
// Internal parsing helpers
// ════════════════════════════════════════════════════════════════════

/** Extract section content from markdown by heading */
function parseSection(content: string, heading: string): string {
  const lines = content.split('\n');
  let inSection = false;
  let depth = 0;
  const result: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();

      if (!inSection) {
        if (text.includes(heading)) {
          inSection = true;
          depth = level;
        }
      } else if (level <= depth) {
        break;
      }
    }

    if (inSection) {
      result.push(line);
    }
  }

  return result.join('\n');
}

/** Parse exports from section content */
function parseExports(sectionContent: string): BoundaryExport[] {
  const exports: BoundaryExport[] = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    // Match list items like: - `functionName(type): description`
    const match = line.match(/^[-*]\s+`?(\w+)`?(?:\s*[\(:]([^)]+)[\)]?)?:?\s*(.*)$/);
    if (match) {
      exports.push({
        name: match[1],
        kind: guessExportKind(match[2] || '', match[1]),
        description: match[3]?.trim() || '',
        signature: match[2]?.trim() || undefined,
      });
    }
  }

  return exports;
}

/** Parse dependencies from section content */
function parseDependencies(sectionContent: string): BoundaryDependency[] {
  const deps: BoundaryDependency[] = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^[-*]\s+`?([^`]+)`?\s*[-–:]\s*(.*)$/);
    if (match) {
      deps.push({
        module: match[1].trim(),
        type: 'external',
        used_for: match[2].trim(),
        optional: line.includes('optional') || line.includes('可选'),
      });
    }
  }

  return deps;
}

/** Parse data contracts from section content */
function parseDataContracts(sectionContent: string): BoundaryDataContract[] {
  const contracts: BoundaryDataContract[] = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    const match = line.match(/^[-*]\s+`?([^`]+)`?\s*[-–:]\s*(.*)$/);
    if (match) {
      contracts.push({
        name: match[1].trim(),
        format: 'unspecified',
        description: match[2].trim(),
      });
    }
  }

  return contracts;
}

/** Parse change log from section content */
function parseChangeLog(sectionContent: string): BoundaryChangeEntry[] {
  const entries: BoundaryChangeEntry[] = [];
  const lines = sectionContent.split('\n');

  for (const line of lines) {
    // Match: - 2026-08-02: description (BREAKING)
    const match = line.match(/^[-*]\s+(\d{4}-\d{2}-\d{2}):?\s+(.*)$/);
    if (match) {
      const desc = match[2];
      entries.push({
        date: match[1],
        description: desc.replace(/\(BREAKING\)$/i, '').trim(),
        breaking: /BREAKING/i.test(desc),
      });
    }
  }

  return entries;
}

/** Guess export kind from context */
function guessExportKind(signature: string, name: string): BoundaryExport['kind'] {
  if (/^\s*\(/.test(signature) || signature.includes('=>')) return 'function';
  if (name[0] === name[0].toUpperCase() && !name.includes('_')) {
    if (name.startsWith('I') && name[1] === name[1].toUpperCase()) return 'interface';
    return name.includes('Type') || name.includes('T') ? 'type' : 'class';
  }
  if (name === name.toUpperCase()) return 'const';
  return 'function';
}
