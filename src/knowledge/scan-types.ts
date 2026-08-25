/**
 * Autonomous Knowledge Scan types — inferred knowledge from codebase, deps, git, docs.
 * 
 * These types represent knowledge that is autonomously discovered from sources
 * OTHER than user-fed documents or change-archived artifacts.
 */

/** Source of autonomous knowledge discovery */
export type ScanSource = 'deps' | 'code' | 'git' | 'docs';

/** Confidence level for inferred knowledge */
export type InferenceConfidence = 'high' | 'medium' | 'low';

/** A proposed knowledge page inferred from scanning */
export interface ProposedKnowledgePage {
  /** Generated ID prefix (e.g., "KS" for Knowledge Scan) */
  id: string;
  title: string;
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson';
  scope: string;
  content: string;
  tags: string[];
  graph_bindings: string[];
  confidence: InferenceConfidence;
  source: ScanSource;
  /** What evidence led to this inference */
  evidence: string;
}

/** Result from a single-source scan */
export interface ScanSourceResult {
  source: ScanSource;
  proposedPages: ProposedKnowledgePage[];
  /** Files/items scanned */
  scannedCount: number;
  /** Time taken in ms */
  durationMs: number;
}

/** Overall scan result */
export interface ScanResult {
  sources: ScanSourceResult[];
  totalProposed: number;
  byConfidence: { high: number; medium: number; low: number };
  byType: Record<string, number>;
  totalDurationMs: number;
}

/** Options for the scan operation */
export interface ScanOptions {
  /** Which sources to scan (default: all) */
  sources?: ScanSource[];
  /** Minimum confidence to include in results */
  minConfidence?: InferenceConfidence;
  /** Only scan, don't register pages */
  dryRun?: boolean;
  /** Maximum number of pages to propose */
  maxPages?: number;
  /** Scope to limit the scan to a directory */
  scope?: string;
}

/** Dependency knowledge rule */
export interface DepKnowledgeRule {
  /** Package name or pattern (single or multiple matches) */
  packagePattern: string | string[];
  /** Knowledge to propose when found */
  propose: {
    type: ProposedKnowledgePage['type'];
    titleTemplate: string;
    contentTemplate: string;
    tags: string[];
    confidence: InferenceConfidence;
  };
}

/** Git history pattern for knowledge extraction */
export interface GitKnowledgePattern {
  /** Regex to match in commit messages */
  pattern: RegExp;
  /** Knowledge type to extract */
  type: ProposedKnowledgePage['type'];
  /** Title template (uses capture groups) */
  titleTemplate: string;
  /** Content template */
  contentTemplate: string;
}

/** Documentation inventory entry */
export interface DocInventoryEntry {
  path: string;
  exists: boolean;
  completeness: 'complete' | 'minimal' | 'partial' | 'missing';
  lastModified?: string;
}
