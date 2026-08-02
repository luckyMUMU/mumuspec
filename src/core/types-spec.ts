/**
 * Spec/PRD/Tech document types — parsed artifact structures and progressive disclosure context.
 */

import type { Severity } from './types-constraint.js';

/** Spec file frontmatter */
export interface SpecFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
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
}

/** Parsed tech.md content (technical perspective: HOW, constraints + architecture) */
export interface TechFile {
  path: string;
  scope: string;
  layer: number;
  content: string;
  requirements: Requirement[];
  architectureDecisions: string[];
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
  /** @deprecated Use prd_summary + tech_summary instead */
  summary?: string;
  /** @deprecated Use constraint_count instead */
  shallNotCount?: number;
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
}
