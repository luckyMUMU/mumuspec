/**
 * Contract Loader — loads, parses, and resolves contract registries
 * from .mumuspec/contracts/ directories.
 *
 * Supports tree-distributed contract definitions unified into a
 * single resolved registry at project root.
 *
 * BOUNDARY.md location: dir/.mumuspec/BOUNDARY.md (new pattern)
 * Backward compat: dir/BOUNDARY.md (old pattern, still supported)
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
import { MUMUSPEC_DIR, CONTRACTS_SUBDIR, REGISTRY_FILE, BOUNDARY_FILE, MAX_SCAN_DEPTH } from './constants.js';

/** Contract registry file names to discover */
const REGISTRY_FILES = ['contracts.yaml', 'contracts.yml', 'contracts.json'];

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
 * Resolve the BOUNDARY.md file path for a directory.
 *
 * Checks dir/.mumuspec/BOUNDARY.md first (new pattern),
 * falls back to dir/BOUNDARY.md (backward compat).
 *
 * @returns file path if found, null otherwise
 */
export function resolveBoundaryPath(dirPath: string): string | null {
  // New pattern: dir/.mumuspec/BOUNDARY.md
  const mumuspecPath = join(dirPath, MUMUSPEC_DIR, BOUNDARY_FILE);
  if (existsSync(mumuspecPath)) return mumuspecPath;

  // Old pattern: dir/BOUNDARY.md (backward compat)
  const directPath = join(dirPath, BOUNDARY_FILE);
  if (existsSync(directPath)) return directPath;

  return null;
}

/**
 * Load a BOUNDARY.md file from a directory.
 *
 * Looks for dir/.mumuspec/BOUNDARY.md first, then dir/BOUNDARY.md.
 */
export function loadBoundaryDocument(dirPath: string): BoundaryDocument | null {
  const filePath = resolveBoundaryPath(dirPath);
  if (!filePath) return null;

  const content = readText(filePath);
  if (!content) return null;

  return parseBoundaryDocument(content, dirPath, filePath);
}

/**
 * Parse BOUNDARY.md content into structured format.
 *
 * Supports both Markdown table format (| col | col |) and list format (- item).
 */
export function parseBoundaryDocument(
  content: string,
  dirPath: string,
  filePath: string,
): BoundaryDocument {
  // Normalize CRLF to LF — ensures regex and split('\n') work consistently
  const normalized = content.replace(/\r\n/g, '\n');

  const exports_entries = parseSection(normalized, '对外接口');
  const deps_entries = parseSection(normalized, '依赖声明');
  const data_entries = parseSection(normalized, '数据契约');
  const changelog_entries = parseSection(normalized, '变更日志');

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
 *
 * Scans for dir/.mumuspec/BOUNDARY.md (new) and dir/BOUNDARY.md (old).
 * Does NOT recurse into a directory's .mumuspec/ if a boundary was found there,
 * but DOES recurse into .mumuspec/ at project root (for spec-only directories
 * like .mumuspec/roadmap/).
 */
export function findAllBoundaryDocuments(projectRoot: string): BoundaryDocument[] {
  const results: BoundaryDocument[] = [];
  const visited = new Set<string>(); // Symlink cycle guard

  function scan(dir: string, depth: number = 0) {
    if (depth > MAX_SCAN_DEPTH) return;

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

    // Check for boundary document via resolveBoundaryPath (checks both locations)
    const boundaryPath = resolveBoundaryPath(dir);
    let foundViaMumuspec = false;

    if (boundaryPath) {
      const content = readText(boundaryPath);
      if (content) {
        results.push(parseBoundaryDocument(content, dir, boundaryPath));
      }
      // If found via .mumuspec/ subdirectory, don't recurse into it
      if (boundaryPath.includes(join(MUMUSPEC_DIR, BOUNDARY_FILE))) {
        foundViaMumuspec = true;
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === '.git') continue;
        // Skip .mumuspec/ if we already found a boundary via it
        if (foundViaMumuspec && entry.name === MUMUSPEC_DIR) continue;
        scan(join(dir, entry.name), depth + 1);
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

// ─── Table parsing helpers ───────────────────────────────────────────

/**
 * Parse a Markdown table row into cells.
 *
 * @returns array of trimmed cell values, or null if not a data row
 *          (header rows and separator rows return null)
 */
function parseTableRow(line: string, isHeaderRow: boolean): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;

  // Split by | — first and last elements are empty (before/after outer pipes)
  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

  // Skip separator rows (|---|---| or |:---|:---|)
  if (cells.every(c => c === '' || /^[-:]+$/.test(c))) return null;

  // Skip header rows — caller passes isHeaderRow=true for the first non-separator row
  if (isHeaderRow) return null;

  return cells;
}

/** Strip backticks from a cell value */
function stripBackticks(s: string): string {
  return s.replace(/^`|`$/g, '').trim();
}

/** Check if a string looks like a function signature */
function isFunctionSignature(s: string): boolean {
  return /^\(.*\)/.test(s) || s.includes('=>') || /\(.*\):/.test(s);
}

/** Check if a string is a valid identifier (for export names) */
function isValidIdentifier(s: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(s);
}

// ─── Parse exports (table + list) ────────────────────────────────────

/** Parse exports from section content — supports table and list format */
function parseExports(sectionContent: string): BoundaryExport[] {
  const exports: BoundaryExport[] = [];
  const lines = sectionContent.split('\n');

  let inTable = false;
  let expectData = false; // After header+separator, next rows are data

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Determine if this is a separator, header, or data row
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

      // Separator row
      if (cells.every(c => c === '' || /^[-:]+$/.test(c))) {
        expectData = true;
        inTable = true;
        continue;
      }

      // Header row (before separator)
      if (!expectData && !inTable) {
        // This is a header — skip it, wait for separator
        continue;
      }

      // Data row
      if (expectData || inTable) {
        inTable = true;
        const parsed = parseTableRow(line, false);
        if (parsed && parsed.length >= 2) {
          const name = stripBackticks(parsed[0]);
          if (!name || !isValidIdentifier(name)) {
            continue;
          }

          // Determine signature and description based on column count
          let signature: string | undefined;
          let description = '';

          if (parsed.length >= 3) {
            const secondCell = stripBackticks(parsed[1]);
            if (isFunctionSignature(secondCell)) {
              signature = secondCell;
              // Description is the last cell
              description = parsed[parsed.length - 1];
            } else {
              // Second cell is not a signature (could be source file)
              description = parsed[parsed.length - 1];
            }
          } else {
            // 2 columns: name | description
            description = parsed[1];
          }

          const kind = guessExportKind(signature || '', name);
          exports.push({
            name,
            kind,
            description: description.trim(),
            signature: signature?.trim() || undefined,
          });
        }
        continue;
      }
    }

    // Non-table line — reset table state
    inTable = false;
    expectData = false;

    // Try list format: - `functionName(type): description`
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

// ─── Parse dependencies (table + list) ───────────────────────────────

/** Parse dependencies from section content — supports table and list format */
function parseDependencies(sectionContent: string): BoundaryDependency[] {
  const deps: BoundaryDependency[] = [];
  const lines = sectionContent.split('\n');

  let inTable = false;
  let expectData = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

      // Separator row
      if (cells.every(c => c === '' || /^[-:]+$/.test(c))) {
        expectData = true;
        inTable = true;
        continue;
      }

      // Header row (before separator)
      if (!expectData && !inTable) {
        continue;
      }

      // Data row
      if (expectData || inTable) {
        inTable = true;
        if (cells.length >= 2) {
          const module = stripBackticks(cells[0]);
          if (!module) continue;
          // Last cell is the usage description
          const usedFor = cells[cells.length - 1];
          deps.push({
            module,
            type: 'external',
            used_for: usedFor.trim(),
            optional: trimmed.includes('optional') || trimmed.includes('可选'),
          });
        }
        continue;
      }
    }

    // Non-table line — reset table state
    inTable = false;
    expectData = false;

    // Try list format: - `module` - description
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

// ─── Parse data contracts (table + list) ─────────────────────────────

/** Parse data contracts from section content — supports table and list format */
function parseDataContracts(sectionContent: string): BoundaryDataContract[] {
  const contracts: BoundaryDataContract[] = [];
  const lines = sectionContent.split('\n');

  let inTable = false;
  let expectData = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

      // Separator row
      if (cells.every(c => c === '' || /^[-:]+$/.test(c))) {
        expectData = true;
        inTable = true;
        continue;
      }

      // Header row
      if (!expectData && !inTable) {
        continue;
      }

      // Data row
      if (expectData || inTable) {
        inTable = true;
        if (cells.length >= 2) {
          const name = stripBackticks(cells[0]);
          if (!name) continue;
          const description = cells[cells.length - 1];
          contracts.push({
            name,
            format: 'unspecified',
            description: description.trim(),
          });
        }
        continue;
      }
    }

    // Non-table line — reset table state
    inTable = false;
    expectData = false;

    // Try list format
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

// ─── Parse change log (table + list) ─────────────────────────────────

/** Parse change log from section content — supports table and list format */
function parseChangeLog(sectionContent: string): BoundaryChangeEntry[] {
  const entries: BoundaryChangeEntry[] = [];
  const lines = sectionContent.split('\n');

  let inTable = false;
  let expectData = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());

      // Separator row
      if (cells.every(c => c === '' || /^[-:]+$/.test(c))) {
        expectData = true;
        inTable = true;
        continue;
      }

      // Header row
      if (!expectData && !inTable) {
        continue;
      }

      // Data row
      if (expectData || inTable) {
        inTable = true;
        // First cell should be a date (YYYY-MM-DD)
        const dateCell = cells[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateCell)) {
          // Remaining cells form the description
          const descParts = cells.slice(1);
          const desc = descParts.join(' — ');
          entries.push({
            date: dateCell,
            description: desc.replace(/\(BREAKING\)$/i, '').trim(),
            breaking: /BREAKING/i.test(desc),
          });
        }
        continue;
      }
    }

    // Non-table line — reset table state
    inTable = false;
    expectData = false;

    // Try list format: - 2026-08-02: description (BREAKING)
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
