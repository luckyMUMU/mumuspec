/**
 * Spec/PRD/Tech document types — parsed artifact structures and progressive disclosure context.
 */

import type { Severity } from './types-constraint.js';

/** Spec file frontmatter */
export interface SpecFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  /** Points to parent PRD (relative path) for inheritance */
  parent_prd?: string;
  /** Points to parent Tech (relative path) for inheritance */
  parent_tech?: string;
  /** Document type discriminator */
  doc_type?: 'spec' | 'prd' | 'tech' | 'design' | 'prohibitions';
  /** P1-1 Fix: Prohibition annotations for semantic checking */
  prohibitions?: ProhibitionAnnotation[];
  /** Context projection whitelist (spec-context-projection): Requirement names to disclose. */
  disclosure?: string[];
}

/** P1-1 Fix: Prohibition annotation mapping natural language to machine-readable check */
export interface ProhibitionAnnotation {
  /** The natural language prohibition text (matches shallNot entry) */
  text: string;
  /** Machine-readable annotation */
  annotation: MachineReadableAnnotation;
}

/** A single requirement block in spec.md */
export interface Requirement {
  name: string;
  shall: string[];
  shallNot: string[];
  should?: string[];
  enforcement: EnforcementRule[];
}

/** Enforcement rule for a constraint */
export interface EnforcementRule {
  id: string;
  description: string;
  check?: string;
  /**
   * Verifier semantics (P0, 2026-08-29): how this enforcement is discharged.
   * - 'manual'          — explicit `manual(reason)` declaration
   * - 'implicit-manual' — legacy free-text line (never machine-executed; honest class)
   * No automated kind exists yet by design (proposal N1: no new engines).
   */
  kind?: 'manual' | 'implicit-manual';
  severity: Severity;
  /** P1-1 Fix: Machine-readable annotation for semantic checking */
  machine_readable?: MachineReadableAnnotation;
}

/** P1-1 Fix: Machine-readable constraint annotation for AST-based checking */
export interface MachineReadableAnnotation {
  /** Constraint type for routing to AST checker */
  type: 'no-new-dependency' | 'no-mutable-state' | 'no-side-effect' | 'pure-function' | 'no-global-state' | 'behavior-gate' | 'custom';
  /** Scope of the check */
  scope?: 'function' | 'module' | 'class' | 'file';
  /** Target of the check (e.g., 'exported' for exported functions) */
  target?: string;
  /** Custom AST constraint ID (when type is 'custom') */
  ast_constraint?: string;
  /**
   * engine-consolidation L2 (behavior-gate): pointer to the registered gate
   * that actually guards this red line — `error-code:E-<DOMAIN>-<NNN>` or
   * `corpus:<fixture-dir>`. Resolved statically at check time; a dangling
   * pointer is E-GUARD-013 (never forceable).
   */
  gate_ref?: string;
  /** Human-readable explanation of why this annotation was chosen */
  rationale?: string;
}

/** Parsed spec.md content */
export interface SpecFile {
  path: string;
  frontmatter: SpecFrontmatter;
  requirements: Requirement[];
  raw: string;
}

/** Parsed design.md content */
export interface DesignFile {
  path: string;
  scope: string;
  layer: number;
  content: string;
  decisions: DesignDecision[];
}

/** Parsed prd.md content (product perspective: WHAT & WHY) */
export interface PrdFile {
  path: string;
  scope: string;
  layer: number;
  content: string;
  userScenarios: string[];
  acceptanceCriteria: string[];
  /** Constraint blocks (SHALL/SHALL NOT) — used by Guard Layer for prohibition extraction */
  requirements?: Requirement[];
}

/** Frontmatter specific to prd.md */
export interface PrdFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  parent_prd?: string;
  doc_type?: 'prd';
  /** Change name for change-level distributed PRD */
  change?: string;
}

/** Frontmatter specific to tech.md */
export interface TechFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
  parent_tech?: string;
  doc_type?: 'tech';
  /** Change name for change-level distributed tech */
  change?: string;
  /** Phase: design/build/verify */
  phase?: 'design' | 'build' | 'verify';
}

/** Parsed tech.md content (technical perspective: HOW, constraints + architecture) */
export interface TechFile {
  path: string;
  scope: string;
  layer: number;
  content: string;
  requirements: Requirement[];
  architectureDecisions: string[];
  /** Inherited requirements from parent */
  inherited_requirements?: Requirement[];
}

/** Architecture decision in design.md */
export interface DesignDecision {
  title: string;
  context: string;
  decision: string;
  consequences?: string;
}

/** Parsed prohibitions.md content */
export interface ProhibitionsFile {
  path: string;
  global: string[];
  moduleLevel: Map<string, string[]>;
}

/** Index.yaml content */
export interface SpecIndex {
  scope: string;
  layer: number;
  children: IndexChildEntry[];
}

export interface IndexChildEntry {
  name: string;
  path: string;
  prd_summary?: string;
  tech_summary?: string;
  constraint_count?: number;
}

/** Loaded spec context for a directory (progressive disclosure) */
export interface SpecContext {
  targetPath: string;
  layers: SpecLayerContext[];
  prohibitions: string[];
  index?: SpecIndex;
  /** Inheritance conflicts detected during loading */
  inheritance_conflicts?: InheritanceConflictRef[];
  /** LLM-Wiki memory context — relevant knowledge for design-time decisions */
  knowledge_memory?: SpecKnowledgeMemory;
}

/** Compact knowledge memory attached to spec context for AI consumption */
export interface SpecKnowledgeMemory {
  /** Project-level summary string */
  project_summary: string;
  /** Relevant historical decisions for the current scope */
  relevant_decisions: Array<{
    id: string;
    title: string;
    summary: string;
    scope: string;
  }>;
  /** Relevant architectural patterns for the current scope */
  relevant_patterns: Array<{
    id: string;
    title: string;
    summary: string;
    scope: string;
  }>;
  /** Active risks to consider */
  relevant_risks: Array<{
    id: string;
    title: string;
    summary: string;
    scope: string;
  }>;
  /** Recent lessons learned */
  recent_lessons: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
}

/** Reference to an inheritance conflict between parent and child */
export interface InheritanceConflictRef {
  type: string;
  child_path: string;
  parent_path: string;
  child_requirement: string;
  parent_requirement: string;
  message: string;
}

/** A single layer in the progressive disclosure */
export interface SpecLayerContext {
  level: number;
  scope: string;
  path: string;
  /** @deprecated Use tech instead */
  spec?: SpecFile;
  /** @deprecated Use prd instead */
  design?: DesignFile;
  prd?: PrdFile;
  tech?: TechFile;
  /** Whether this layer was merged from parent */
  merged?: boolean;
  /** Source paths inherited from (for debugging) */
  inherited_from?: string[];
}
