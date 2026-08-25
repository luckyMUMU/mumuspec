/**
 * Contract Manager — write-path for contract lifecycle operations.
 *
 * Provides:
 * - Create/update/delete contracts with persistence
 * - Change history tracking
 * - BOUNDARY.md auto-scaffolding from code analysis
 */

import { existsSync, writeFileSync, mkdirSync, appendFileSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type {
  Contract,
  BoundaryExport,
  ContractRegistry,
} from '../core/types-contract.js';
import { analyzeExports, analyzeImports } from './ast-analyzer.js';
import type { ExportInfo } from './ast-analyzer.js';
import { loadAllContracts, invalidateContractCache } from './loader.js';
import { MUMUSPEC_DIR, CONTRACTS_SUBDIR, AUDIT_LOG_FILE, REGISTRY_FILE, BOUNDARY_FILE } from './constants.js';
import { readText } from '../core/utils.js';
import { Logger } from '../core/logger.js';
import { MumuSpecError } from '../core/errors.js';
import { analyzeContractImpact } from './impact-analyzer.js';

/** Write registry to YAML file — ponytail: centralizes serialization logic */
function writeRegistryYaml(registry: ContractRegistry, registryFile: string): void {
  writeFileSync(registryFile, stringifyYaml({
    version: registry.version || '1.0.0',
    last_updated: new Date().toISOString(),
    contracts: registry.contracts,
    outbound_ids: registry.outbound_ids,
    inbound_ids: registry.inbound_ids,
    dependency_graph: registry.dependency_graph || {},
  }), 'utf-8');
}

/** Audit log entry */
export interface ContractAuditEntry {
  timestamp: string;
  actor: string;
  action: 'create' | 'update' | 'delete' | 'deprecate' | 'migrate';
  contract_id: string;
  details: string;
  impact_risk?: 'low' | 'medium' | 'high';
}

// ════════════════════════════════════════════════════════════════════
// Simple file lock — ponytail: mkdir is atomic, no external dep needed
// ════════════════════════════════════════════════════════════════════

const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 50;

/**
 * Acquire a lock for exclusive file access.
 * Returns a release function. Call it when done.
 * P0-3 Fix: Throws on timeout instead of silent bypass; uses statSync for non-blocking check.
 */
function acquireLock(contractsDir: string): () => void {
  const lockDir = join(contractsDir, '.lock');
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir); // Atomic — fails if exists
      return () => {
        try {
          rmdirSync(lockDir);
        } catch (e) {
          Logger.warn('contract.manager', 'Failed to release lock', { error: (e as Error).message });
        }
      };
    } catch {
      // P0-3 Fix: Check if lock is stale (holder crashed) and reclaim
      try {
        const stat = statSync(lockDir);
        if (Date.now() - stat.mtimeMs > LOCK_TIMEOUT_MS) {
          rmdirSync(lockDir); // Remove stale lock
          continue;
        }
      } catch {
        // Lock removed by another process, retry immediately
      }
      // Non-blocking wait: use a short synchronous pause via statSync on a file
      const waitUntil = Date.now() + LOCK_RETRY_MS;
      while (Date.now() < waitUntil) {
        // ponytail: minimal sync wait — for true async, use setTimeout in caller
      }
    }
  }

  // P0-3 Fix: Throw on timeout instead of silent bypass
  throw new MumuSpecError('E-CONTRACT-010', { detail: 'Lock acquisition timeout' });
}

/**
 * Create or update a contract with persistence.
 */
export function persistContract(
  projectRoot: string,
  contract: Contract,
  options: {
    create?: boolean;
    actor?: string;
  } = {},
): { success: boolean; message: string; auditEntry: ContractAuditEntry } {
  const registry = loadAllContracts(projectRoot);
  const contractsDir = join(projectRoot, MUMUSPEC_DIR, CONTRACTS_SUBDIR);
  const registryFile = join(contractsDir, REGISTRY_FILE);

  // Ensure directory exists
  mkdirSync(contractsDir, { recursive: true });

  // Acquire file lock for write safety
  const releaseLock = acquireLock(contractsDir);

  try {
    return _persistContractWrite(projectRoot, contract, options, registry, contractsDir, registryFile);
  } finally {
    releaseLock();
  }
}

/**
 * Internal: perform the actual write (called within lock).
 */
function _persistContractWrite(
  projectRoot: string,
  contract: Contract,
  options: { create?: boolean; actor?: string },
  registry: import('../core/types-contract.js').ContractRegistry,
  _contractsDir: string,
  registryFile: string,
): { success: boolean; message: string; auditEntry: ContractAuditEntry } {

  const existingIdx = registry.contracts.findIndex((c: Contract) => c.id === contract.id);
  const isCreate = existingIdx === -1;

  if (isCreate) {
    registry.contracts.push(contract);
    if (contract.upstream.length > 0 && !registry.outbound_ids.includes(contract.id)) {
      registry.outbound_ids.push(contract.id);
    }
    if (contract.downstream.length > 0 && !registry.inbound_ids.includes(contract.id)) {
      registry.inbound_ids.push(contract.id);
    }
  } else {
    // Update existing
    registry.contracts[existingIdx] = contract;
  }

  // Write contracts.yaml
  writeRegistryYaml(registry, registryFile);

  // Invalidate cache after write
  invalidateContractCache(projectRoot);

  // Create audit entry
  const auditEntry: ContractAuditEntry = {
    timestamp: new Date().toISOString(),
    actor: options.actor || 'user',
    action: isCreate ? 'create' : 'update',
    contract_id: contract.id,
    details: isCreate
      ? `Created contract "${contract.name}" (${contract.category}, ${contract.criticality})`
      : `Updated contract "${contract.name}" (v${contract.version})`,
  };

  // Write to audit log
  appendContractAuditLog(projectRoot, auditEntry);

  return {
    success: true,
    message: isCreate
      ? `Contract ${contract.id} created successfully`
      : `Contract ${contract.id} updated successfully`,
    auditEntry,
  };
}

/**
 * Deprecate a contract (with impact analysis).
 */
export function deprecateContract(
  projectRoot: string,
  contractId: string,
  options: {
    migrationPath?: string;
    actor?: string;
  } = {},
): { success: boolean; message: string; impact?: ReturnType<typeof analyzeContractImpact> } {
  const registry = loadAllContracts(projectRoot);
  const contract = registry.contracts.find((c: Contract) => c.id === contractId);

  if (!contract) {
    return { success: false, message: `Contract not found: ${contractId}` };
  }

  // Analyze impact before deprecating
  const impact = analyzeContractImpact(projectRoot, contractId, 'deprecate');

  // Apply deprecation
  contract.status = 'deprecated';
  if (options.migrationPath) {
    contract.migrationPath = options.migrationPath;
  }
  contract.deprecationNote = `Deprecated on ${new Date().toISOString().split('T')[0]}. ${options.migrationPath || ''}`;

  // Persist (audit uses 'update' from persistContract — that's fine for persistence)
  const result = persistContract(projectRoot, contract, {
    create: false,
    actor: options.actor,
  });

  // Audit with explicit 'deprecate' action
  appendContractAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    actor: options.actor || 'user',
    action: 'deprecate',
    contract_id: contractId,
    details: `Deprecated contract ${contractId}${options.migrationPath ? ` → ${options.migrationPath}` : ''}`,
    impact_risk: impact.risk,
  });

  return {
    success: result.success,
    message: `Contract ${contractId} deprecated`,
    impact,
  };
}

/**
 * Remove a contract (with impact analysis).
 */
export function removeContract(
  projectRoot: string,
  contractId: string,
  options: {
    actor?: string;
  } = {},
): { success: boolean; message: string; impact?: ReturnType<typeof analyzeContractImpact> } {
  const registry = loadAllContracts(projectRoot);

  // Analyze impact before removal
  const impact = analyzeContractImpact(projectRoot, contractId, 'remove');

  // Cannot remove if it has upstream consumers (breaking change)
  if (impact.breaking) {
    return {
      success: false,
      message: `Cannot remove contract ${contractId}: ${impact.upstream_impact.length} upstream consumer(s) will break. Deprecate first.`,
      impact,
    };
  }

  // Remove from registry
  const idx = registry.contracts.findIndex((c: Contract) => c.id === contractId);
  if (idx === -1) {
    return { success: false, message: `Contract not found: ${contractId}` };
  }

  registry.contracts.splice(idx, 1);
  registry.outbound_ids = registry.outbound_ids.filter((id: string) => id !== contractId);
  registry.inbound_ids = registry.inbound_ids.filter((id: string) => id !== contractId);

  // Clean up dependency_graph
  if (registry.dependency_graph) {
    delete registry.dependency_graph[contractId];
    for (const [key, deps] of Object.entries(registry.dependency_graph)) {
      if (Array.isArray(deps)) {
        registry.dependency_graph[key] = deps.filter((d: string) => d !== contractId);
      }
    }
  }

  // Write updated registry
  const contractsDir = join(projectRoot, MUMUSPEC_DIR, CONTRACTS_SUBDIR);
  const registryFile = join(contractsDir, REGISTRY_FILE);

  // Acquire file lock for write safety
  const releaseLock = acquireLock(contractsDir);

  try {
    writeRegistryYaml(registry, registryFile);
  } finally {
    releaseLock();
  }

  // Invalidate cache after write
  invalidateContractCache(projectRoot);

  // Audit
  const auditEntry: ContractAuditEntry = {
    timestamp: new Date().toISOString(),
    actor: options.actor || 'user',
    action: 'delete',
    contract_id: contractId,
    details: `Removed contract ${contractId}`,
  };
  appendContractAuditLog(projectRoot, auditEntry);

  return {
    success: true,
    message: `Contract ${contractId} removed successfully`,
    impact,
  };
}

/**
 * Append entry to contract audit log (separate from general change audit log in core/utils).
 * Writes to `.mumuspec/contracts/audit.log`.
 */
export function appendContractAuditLog(projectRoot: string, entry: ContractAuditEntry): { success: boolean } {
  const auditFile = join(projectRoot, MUMUSPEC_DIR, CONTRACTS_SUBDIR, AUDIT_LOG_FILE);
  const line = JSON.stringify(entry) + '\n';

  try {
    appendFileSync(auditFile, line, 'utf-8');
    return { success: true };
  } catch {
    // Create the file if it doesn't exist
    try {
      const dir = join(projectRoot, MUMUSPEC_DIR, CONTRACTS_SUBDIR);
      mkdirSync(dir, { recursive: true });
      writeFileSync(auditFile, line, 'utf-8');
      return { success: true };
    } catch {
      // Best effort — log warning
      console.warn(`[mumuspec] Failed to write audit log for ${entry.contract_id}`);
      return { success: false };
    }
  }
}

/**
 * Read audit log entries.
 */
export function readAuditLog(projectRoot: string): ContractAuditEntry[] {
  const auditFile = join(projectRoot, MUMUSPEC_DIR, CONTRACTS_SUBDIR, AUDIT_LOG_FILE);
  if (!existsSync(auditFile)) return [];

  const content = readText(auditFile);
  if (!content) return [];

  const entries: ContractAuditEntry[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch (e) {
      // Skip corrupted lines
      Logger.warn('contract.manager', 'Failed to parse audit log line', { error: (e as Error).message });
    }
  }

  return entries;
}

/**
 * Scaffold BOUNDARY.md from code directory.
 *
 * Analyzes source files to detect exported symbols and imports.
 */
export function scaffoldBoundary(dirPath: string): string {
  const exports = detectExports(dirPath);
  const imports = detectImports(dirPath);

  const lines: string[] = [];
  lines.push('# BOUNDARY.md — Auto-generated Directory Boundary Document');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push(`> Review and customize before committing.`);
  lines.push('');

  // Exports section
  lines.push('## 对外接口');
  lines.push('');
  if (exports.length > 0) {
    for (const exp of exports) {
      const sig = exp.signature ? `(${exp.signature})` : '';
      lines.push(`- \`${exp.name}\`${sig}: ${exp.description}`);
    }
  } else {
    lines.push('(No public exports detected — add manually if needed)');
  }
  lines.push('');

  // Dependencies section
  lines.push('## 依赖声明');
  lines.push('');
  if (imports.size > 0) {
    const sorted = Array.from(imports).sort();
    for (const imp of sorted) {
      lines.push(`- \`${imp}\`: [describe usage]`);
    }
  } else {
    lines.push('(No imports detected)');
  }
  lines.push('');

  // Data contracts section
  lines.push('## 数据契约');
  lines.push('');

  // Derive from exports (anything that looks like a type/interface)
  const dataExports = exports.filter(e => e.kind === 'type' || e.kind === 'interface' || e.kind === 'class');
  if (dataExports.length > 0) {
    for (const exp of dataExports) {
      lines.push(`- \`${exp.name}\`: [describe shape/protocol]`);
    }
  } else {
    lines.push('(No data contracts detected — add schemas as needed)');
  }
  lines.push('');

  // Change log
  lines.push('## 变更日志');
  lines.push('');
  lines.push(`- ${new Date().toISOString().split('T')[0]}: BOUNDARY.md auto-generated (review and customize)`);
  lines.push('');

  return lines.join('\n');
}

/**
* Write BOUNDARY.md to a directory's .mumuspec/ subdirectory.
*
* Creates dir/.mumuspec/ if needed, writes BOUNDARY.md there.
*/
export function writeBoundary(dirPath: string, content: string): string {
const mumuspecDir = join(dirPath, MUMUSPEC_DIR);
mkdirSync(mumuspecDir, { recursive: true });
const filePath = join(mumuspecDir, BOUNDARY_FILE);
writeFileSync(filePath, content, 'utf-8');
return filePath;
}

// ════════════════════════════════════════════════════════════════════
// Code analysis helpers (AST-based, using ast-analyzer.ts)
// ════════════════════════════════════════════════════════════════════

/** Detect exported symbols from source directory using AST parsing */
function detectExports(dirPath: string): BoundaryExport[] {
  try {
    const astExports = analyzeExports(dirPath);
    return astExports.map(adaptExportInfo);
  } catch (e) {
    Logger.warn('contract.manager', 'AST export detection failed', { error: (e as Error).message });
    return [];
  }
}

/** Adapt AST analyzer output to BoundaryExport with description/signature */
function adaptExportInfo(info: ExportInfo): BoundaryExport {
  const fileName = info.file ? info.file.split(/[\\/]/).pop() || '' : '';
  return {
    name: info.name,
    kind: info.kind,
    description: fileName ? `From ${fileName}` : 'Auto-detected',
    signature: info.signature,
  };
}

/** Detect imports from source directory using AST parsing */
function detectImports(dirPath: string): Set<string> {
  try {
    return analyzeImports(dirPath);
  } catch (e) {
    Logger.warn('contract.manager', 'AST import detection failed', { error: (e as Error).message });
    return new Set();
  }
}
