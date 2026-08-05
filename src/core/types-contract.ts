/**
 * Contract Layer types — external contract management, boundary documents,
 * drift detection, and compatibility validation.
 *
 * Implements the Contract & Boundary Rules from AGENTS.md:
 * - External contract registration & storage
 * - Directory boundary document (BOUNDARY.md) scanning
 * - Contract drift detection (spec vs actual code)
 * - Breaking change impact analysis
 */

import type { Severity } from './types-constraint.js';

// ════════════════════════════════════════════════════════════════════
// Contract Classification
// ════════════════════════════════════════════════════════════════════

/** Contract category — determines validation and drift detection strategy */
export type ContractCategory =
  /** API endpoint contracts (REST/gRPC/GraphQL) */
  | 'api'
  /** Database schema & mapping contracts */
  | 'database'
  /** Message queue / event protocol contracts */
  | 'messaging'
  /** Serialization format contracts (JSON schema, protobuf, etc.) */
  | 'serialization'
  /** Third-party SDK interface signatures */
  | 'sdk'
  /** CLI interface contracts (flags, args, output format) */
  | 'cli'
  /** File system / storage contracts */
  | 'filesystem'
  /** Environment & configuration contracts */
  | 'config';

/** Contract criticality level */
export type ContractCriticality = 'critical' | 'important' | 'minor';

/** Contract stability status */
export type ContractStatus =
  /** New contract, not yet accepted */
  | 'draft'
  /** Active and enforced */
  | 'active'
  /** Scheduled for removal */
  | 'deprecated'
  /** No longer enforced */
  | 'retired';

// ════════════════════════════════════════════════════════════════════
// Core Contract Entity
// ════════════════════════════════════════════════════════════════════

/** A single external contract definition */
export interface Contract {
  /** Unique contract identifier (e.g., "API-001", "DB-USERS-TABLE") */
  id: string;
  /** Contract name */
  name: string;
  /** Contract category */
  category: ContractCategory;
  /** Current status */
  status: ContractStatus;
  /** Criticality level */
  criticality: ContractCriticality;
  /** Contract version (SemVer) */
  version: string;
  /** Source file path where this contract is defined */
  source: string;
  /** Human-readable description */
  description: string;
  /** Contract owner / maintainer */
  owner?: string;
  /** Upstream dependency (who calls this contract) */
  upstream: string[];
  /** Downstream consumers (who implements/fulfills this contract) */
  downstream: string[];
  /** Schema definition (JSON Schema, type signature, etc.) */
  schema: Record<string, unknown>;
  /** Example payloads or usage snippets */
  examples?: string[];
  /** Deprecation notice if status is deprecated */
  deprecationNote?: string;
  /** Migration path for breaking changes */
  migrationPath?: string;
}

/** Contract collection root — stored in .mumuspec/contracts/ */
export interface ContractRegistry {
  /** Registry format version */
  version: string;
  /** Last updated timestamp */
  last_updated: string;
  /** All registered contracts */
  contracts: Contract[];
  /** Dependency graph edges (id → [id]) */
  dependency_graph?: Record<string, string[]>;
  /** Outbound contracts (this project exposes) */
  outbound_ids: string[];
  /** Inbound contracts (this project consumes) */
  inbound_ids: string[];
}

// ════════════════════════════════════════════════════════════════════
// Drift Detection
// ════════════════════════════════════════════════════════════════════

/** Types of contract drift */
export type DriftType =
  /** Contract declared but no implementation found */
  | 'unimplemented'
  /** Implementation exists but diverges from contract */
  | 'diverged'
  /** Contract deprecated but still in use */
  | 'deprecated_in_use'
  /** Schema mismatch (type/field differences) */
  | 'schema_mismatch'
  /** Consumer depends on removed contract */
  | 'orphaned_consumer'
  /** Enforcement rule violation */
  | 'enforcement_violation';

/** A single contract drift finding */
export interface ContractDrift {
  /** Drift type */
  type: DriftType;
  /** Severity level */
  severity: Severity;
  /** Drift identifier */
  id: string;
  /** Related contract ID */
  contract_id: string;
  /** Human-readable message */
  message: string;
  /** Expected value per contract */
  expected?: string;
  /** Actual value found in code */
  actual?: string;
  /** Source file reference */
  file?: string;
  /** Line number */
  line?: number;
  /** Suggested fix */
  suggestion?: string;
  /** Associated error code (E-CONTRACT-xxx) for programmatic handling */
  error_code?: string;
}

/** Complete drift report for a contract scan */
export interface DriftReport {
  /** When the scan was performed */
  timestamp: string;
  /** Total contracts scanned */
  total_contracts: number;
  /** Number of drifts detected */
  drift_count: number;
  /** All drift findings */
  drifts: ContractDrift[];
  /** Contracts without drift (summary IDs) */
  clean_contracts: string[];
  /** Scan duration in ms */
  scan_duration_ms: number;
  /** Whether any critical drifts found */
  has_critical_drifts: boolean;
}

// ════════════════════════════════════════════════════════════════════
// Boundary Documents
// ════════════════════════════════════════════════════════════════════

/** Directory boundary document (BOUNDARY.md) content */
export interface BoundaryDocument {
  /** Absolute path to the directory */
  dir_path: string;
  /** BOUNDARY.md file path */
  file_path: string;
  /** Directory's public API / exports */
  exports: BoundaryExport[];
  /** Directory's declared dependencies */
  dependencies: BoundaryDependency[];
  /** Data contracts (schemas, protocols) */
  data_contracts: BoundaryDataContract[];
  /** Change log entries */
  change_log: BoundaryChangeEntry[];
  /** Raw content */
  raw: string;
}

/** A public export from a directory */
export interface BoundaryExport {
  /** Export name / identifier */
  name: string;
  /** Export type (function, class, type, const) */
  kind: 'function' | 'class' | 'type' | 'const' | 'interface';
  /** Description */
  description: string;
  /** Export signature if applicable */
  signature?: string;
}

/** A declared dependency of a directory */
export interface BoundaryDependency {
  /** Module / package name */
  module: string;
  /** Dependency type */
  type: 'internal' | 'external' | 'peer' | 'dev';
  /** Usage description */
  used_for: string;
  /** Whether dependency is optional */
  optional: boolean;
}

/** Data contract for inter-directory communication */
export interface BoundaryDataContract {
  /** Contract name */
  name: string;
  /** Data format (JSON, protobuf, binary) */
  format: string;
  /** Schema reference or inline definition */
  schema?: string;
  /** Description */
  description: string;
}

/** A change log entry */
export interface BoundaryChangeEntry {
  /** Change date (ISO) */
  date: string;
  /** Version affected */
  version?: string;
  /** Change description */
  description: string;
  /** Breaking change indicator */
  breaking: boolean;
}

/** Boundary validation result */
export interface BoundaryValidationResult {
  /** Directory being validated */
  dir_path: string;
  /** Whether boundary doc exists */
  has_boundary_doc: boolean;
  /** Validation errors */
  errors: BoundaryIssue[];
  /** Validation warnings */
  warnings: BoundaryIssue[];
}

/** An issue found during boundary validation */
export interface BoundaryIssue {
  code: string;
  message: string;
  detail?: string;
  severity: Severity;
}

// ════════════════════════════════════════════════════════════════════
// Impact Analysis
// ════════════════════════════════════════════════════════════════════

/** Impact analysis for a proposed contract change */
export interface ContractImpactAnalysis {
  /** Contract being analyzed */
  contract_id: string;
  /** Proposed change type */
  change_type: 'modify' | 'remove' | 'deprecate';
  /** Affected upstream callers */
  upstream_impact: ImpactEntry[];
  /** Affected downstream consumers */
  downstream_impact: ImpactEntry[];
  /** Breaking change classification */
  breaking: boolean;
  /** Overall risk level */
  risk: 'low' | 'medium' | 'high';
  /** Recommended mitigation steps */
  mitigations: string[];
}

/** A single impact entry */
export interface ImpactEntry {
  /** Identifier of affected component */
  id: string;
  /** Impact description */
  description: string;
  /** Whether this is a breaking impact */
  breaking: boolean;
  /** Estimated effort to adapt */
  effort: 'trivial' | 'small' | 'medium' | 'large';
}
