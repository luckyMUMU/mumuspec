/**
 * Contract Validator — validates contracts, detects drift, and checks
 * boundary document compliance.
 *
 * Implements the Contract Drift Detection rules from AGENTS.md.
 */

import { existsSync, readdirSync, lstatSync, readlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type {
  Contract,
  ContractRegistry,
  ContractDrift,
  DriftReport,
  BoundaryValidationResult,
  BoundaryIssue,
} from '../core/types-contract.js';
import {
  loadAllContracts,
  loadBoundaryDocument,
} from './loader.js';
import { readText } from '../core/utils.js';
import { MAX_SCAN_DEPTH } from './constants.js';

/**
 * Run full contract drift detection across the project.
 */
export function detectContractDrift(projectRoot: string): DriftReport {
  const startTime = Date.now();
  const drifts: ContractDrift[] = [];
  const cleanContracts: string[] = [];

  const registry = loadAllContracts(projectRoot);

  for (const contract of registry.contracts) {
    const contractDrifts = checkContractDrift(contract, projectRoot);
    if (contractDrifts.length > 0) {
      drifts.push(...contractDrifts);
    } else {
      cleanContracts.push(contract.id);
    }
  }

  // Check dependency graph integrity
  checkDependencyGraph(registry, drifts);

  const duration = Date.now() - startTime;
  const hasCritical = drifts.some((d: ContractDrift) => d.severity === 'ERROR');

  return {
    timestamp: new Date().toISOString(),
    total_contracts: registry.contracts.length,
    drift_count: drifts.length,
    drifts,
    clean_contracts: cleanContracts,
    scan_duration_ms: duration,
    has_critical_drifts: hasCritical,
  };
}

/**
 * Validate a single contract for drift.
 */
function checkContractDrift(contract: Contract, projectRoot: string): ContractDrift[] {
  const drifts: ContractDrift[] = [];

  // Check if contract source file exists
  if (contract.source && !contract.source.startsWith('http')) {
    const sourcePath = join(projectRoot, contract.source);
    if (!existsSync(sourcePath)) {
      drifts.push({
        type: 'unimplemented',
        severity: contract.criticality === 'critical' ? 'ERROR' : 'WARN',
        id: `DRIFT-${contract.id}-001`,
        contract_id: contract.id,
        error_code: 'E-CONTRACT-005',
        message: `Contract "${contract.id}" source file not found: ${contract.source}`,
        expected: contract.source,
        suggestion: 'Create the source file or update the contract source path.',
      });
    }
  }

  // Check deprecated contracts still in use
  if (contract.status === 'deprecated' && contract.upstream.length > 0) {
    drifts.push({
      type: 'deprecated_in_use',
      severity: 'WARN',
      id: `DRIFT-${contract.id}-002`,
      contract_id: contract.id,
      error_code: 'E-CONTRACT-006',
      message: `Contract "${contract.id}" is deprecated but still has ${contract.upstream.length} upstream consumer(s)`,
      suggestion: contract.migrationPath
        ? `Use migration path: ${contract.migrationPath}`
        : 'Define a migration path or update consumers.',
    });
  }

  // Check retired contracts still registered
  if (contract.status === 'retired') {
    drifts.push({
      type: 'deprecated_in_use',
      severity: 'WARN',
      id: `DRIFT-${contract.id}-003`,
      contract_id: contract.id,
      message: `Contract "${contract.id}" is marked as retired but still in registry`,
      suggestion: 'Remove from contracts.yaml or set to deprecated.',
    });
  }

  // Check schema definition completeness
  if (!contract.schema || Object.keys(contract.schema).length === 0) {
    drifts.push({
      type: 'schema_mismatch',
      severity: 'WARN',
      id: `DRIFT-${contract.id}-004`,
      contract_id: contract.id,
      error_code: 'E-CONTRACT-007',
      message: `Contract "${contract.id}" has no schema definition`,
      suggestion: 'Define a schema for automated validation.',
    });
  }

  // Check category-specific constraints
  checkCategorySpecific(contract, drifts);

  return drifts;
}

/**
 * Category-specific validation rules.
 */
function checkCategorySpecific(contract: Contract, drifts: ContractDrift[]): void {
  switch (contract.category) {
    case 'api':
      // API contracts should have examples
      if (!contract.examples || contract.examples.length === 0) {
        drifts.push({
          type: 'enforcement_violation',
          severity: 'WARN',
          id: `DRIFT-${contract.id}-005`,
          contract_id: contract.id,
          error_code: 'E-CONTRACT-009',
          message: `API contract "${contract.id}" should include example requests/responses`,
          suggestion: 'Add example payloads to the contract definition.',
        });
      }
      break;

    case 'cli':
      // CLI contracts should describe flags and output format
      if (!contract.schema['flags'] && !contract.schema['options']) {
        drifts.push({
          type: 'enforcement_violation',
          severity: 'WARN',
          id: `DRIFT-${contract.id}-006`,
          contract_id: contract.id,
          error_code: 'E-CONTRACT-009',
          message: `CLI contract "${contract.id}" should define flags/options schema`,
          suggestion: 'Add flags or options definition to the schema.',
        });
      }
      break;

    case 'database':
      // DB contracts should have a version
      if (!contract.version || contract.version === '0.0.0') {
        drifts.push({
          type: 'enforcement_violation',
          severity: 'WARN',
          id: `DRIFT-${contract.id}-007`,
          contract_id: contract.id,
          error_code: 'E-CONTRACT-009',
          message: `Database contract "${contract.id}" should have a proper version`,
          suggestion: 'Set version to track schema evolution.',
        });
      }
      break;

    case 'sdk':
      // SDK contracts should document the upstream source
      if (!contract.owner) {
        drifts.push({
          type: 'enforcement_violation',
          severity: 'WARN',
          id: `DRIFT-${contract.id}-008`,
          contract_id: contract.id,
          error_code: 'E-CONTRACT-009',
          message: `SDK contract "${contract.id}" should specify an owner`,
          suggestion: 'Add the SDK owner/vendor name.',
        });
      }
      break;

    default:
      break;
  }
}

/**
 * Validate dependency graph integrity.
 */
function checkDependencyGraph(registry: ContractRegistry, drifts: ContractDrift[]): void {
  const allIds = new Set(registry.contracts.map((c: Contract) => c.id));

  // Check outbound/inbound IDs exist
  for (const id of registry.outbound_ids) {
    if (!allIds.has(id)) {
      drifts.push({
        type: 'schema_mismatch',
        severity: 'WARN',
        id: 'DRIFT-GRAPH-001',
        contract_id: id,
        error_code: 'E-CONTRACT-008',
        message: `Outbound contract ID "${id}" referenced but not defined in contracts`,
        suggestion: 'Remove missing ID from outbound_ids or add the missing contract.',
      });
    }
  }

  for (const id of registry.inbound_ids) {
    if (!allIds.has(id)) {
      drifts.push({
        type: 'schema_mismatch',
        severity: 'WARN',
        id: 'DRIFT-GRAPH-002',
        contract_id: id,
        error_code: 'E-CONTRACT-008',
        message: `Inbound contract ID "${id}" referenced but not defined in contracts`,
        suggestion: 'Remove missing ID from inbound_ids or add the missing contract.',
      });
    }
  }

  // Check orphaned consumers
  for (const contract of registry.contracts) {
    for (const depId of contract.downstream) {
      if (!allIds.has(depId)) {
        drifts.push({
          type: 'orphaned_consumer',
          severity: 'WARN',
          id: `DRIFT-${contract.id}-009`,
          contract_id: contract.id,
          error_code: 'E-CONTRACT-008',
          message: `Contract "${contract.id}" depends on "${depId}" which is not registered`,
          suggestion: 'Add missing dependency to contracts.yaml.',
        });
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// Boundary Document Validation
// ════════════════════════════════════════════════════════════════════

/**
 * Validate all boundary documents in the project.
 */
export function validateBoundaries(projectRoot: string): BoundaryValidationResult[] {
  const results: BoundaryValidationResult[] = [];
  const directoriesWithCode = findDirectoriesWithCode(projectRoot);

  for (const dir of directoriesWithCode) {
    const boundaryDoc = loadBoundaryDocument(dir);
    const errors: BoundaryIssue[] = [];
    const warnings: BoundaryIssue[] = [];

    if (!boundaryDoc) {
      results.push({
        dir_path: dir,
        has_boundary_doc: false,
        errors: [{
          code: 'E-CONTRACT-001',
          message: `Missing BOUNDARY.md in directory with code: ${dir}`,
          severity: 'WARN',
        }],
        warnings: [],
      });
      continue;
    }

    // Validate exports — check they actually exist
    for (const exp of boundaryDoc.exports) {
      const found = verifyExportExists(dir, exp);
      if (!found) {
        errors.push({
          code: 'E-CONTRACT-002',
          message: `Exported "${exp.name}" declared in BOUNDARY.md not found in code`,
          detail: `Signature: ${exp.signature || 'N/A'}`,
          severity: 'ERROR',
        });
      }
    }

    // Validate dependencies — check if declared, files actually use them
    for (const dep of boundaryDoc.dependencies) {
      if (dep.type === 'external' && !verifyDependencyUsage(dir, dep.module)) {
        warnings.push({
          code: 'E-CONTRACT-003',
          message: `Dependency "${dep.module}" declared but no import found in code`,
          severity: 'WARN',
        });
      }
    }

    // Validate change log is present
    if (boundaryDoc.change_log.length === 0) {
      warnings.push({
        code: 'E-CONTRACT-004',
        message: 'No change log entries in BOUNDARY.md',
        severity: 'WARN',
      });
    }

    results.push({
      dir_path: dir,
      has_boundary_doc: true,
      errors,
      warnings,
    });
  }

  return results;
}

/**
 * Find directories that contain source code files.
 */
function findDirectoriesWithCode(projectRoot: string): string[] {
  const results: string[] = [];
  const extensions = ['.ts', '.js', '.py', '.java', '.go', '.rs'];
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

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      let hasCode = false;

      for (const entry of entries) {
        if (entry.isFile() && extensions.some((ext: string) => entry.name.endsWith(ext))) {
          hasCode = true;
          break;
        }
      }

      if (hasCode) {
        results.push(dir);
      }

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
 * Verify an export declared in BOUNDARY.md exists in code.
 */
function verifyExportExists(dirPath: string, exp: { name: string; kind: string }): boolean {
  // ponytail: basic heuristic — check if name appears in any source file
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const content = readText(join(dirPath, entry.name));
        if (content && content.includes(exp.name)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Verify a dependency is actually imported in code.
 */
function verifyDependencyUsage(dirPath: string, moduleName: string): boolean {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        const content = readText(join(dirPath, entry.name));
        if (content) {
          // Check import/require patterns — including import type and dynamic import
          const patterns = [
            new RegExp(`import\\s+(type\\s+)?\\{?\\s*[^}]*\\s*\\}?\\s+from\\s+['"]${escapeRegExp(moduleName)}['"]`),
            new RegExp(`import\\s+['"]${escapeRegExp(moduleName)}['"]`),
            new RegExp(`require\\(['"]${escapeRegExp(moduleName)}['"]\\)`),
            new RegExp(`import\\(['"]${escapeRegExp(moduleName)}['"]\\)`),
          ];
          if (patterns.some((p: RegExp) => p.test(content))) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore
  }
  return false;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
