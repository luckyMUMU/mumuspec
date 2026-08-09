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
  severity: Severity;
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
