/**
 * AST-based constraint types — multi-language extensible engine.
 *
 * This module defines the ILanguageProvider interface and related types
 * for the R-0003 AST Guard upgrade. Language providers implement this interface
 * to offer semantic constraint detection for specific programming languages.
 */
import type { ExtractedSymbol } from './types-knowledge.js';

/** Result of parsing source code into an AST. */
export interface ASTResult {
  root: ASTNode;
  sourceFile: string;
  language: string;
  diagnostics: ASTDiagnostic[];
}

/** A unified AST node structure — language-agnostic representation. */
export interface ASTNode {
  kind: string;
  text: string;
  range: { start: number; end: number };
  children: ASTNode[];
  /** Optional metadata for provider-specific extensions */
  meta?: Record<string, unknown>;
}

/** Diagnostic emitted during parsing (warning/info level). */
export interface ASTDiagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  range?: { start: number; end: number };
}

/** Location of a violation in source code. */
export interface ViolationLocation {
  file: string;
  line: number;
  column: number;
}

/** A semantic constraint violation detected by AST analysis. */
export interface ConstraintViolation {
  ruleId: string;
  message: string;
  severity: 'error' | 'warning';
  location: ViolationLocation;
  snippet: string;
}

/** AST-based semantic constraint definition. */
export interface SemanticConstraint {
  /** Constraint type: 'no-mutable-state' | 'enforce-idempotent' | etc. */
  type: string;
  /** Optional parameters for parameterized constraints */
  params?: Record<string, unknown>;
}

/** Metadata for a registered language provider. */
export interface ProviderInfo {
  language: string;
  extensions: string[];
  registeredAt: string;
}

/**
 * Language Provider interface — implement this to add AST support for a new language.
 *
 * Usage:
 * ```typescript
 * registerLanguageProvider(new MyLanguageProvider());
 * ```
 */
export interface ILanguageProvider {
  /** Language identifier (e.g., 'typescript', 'python', 'java') */
  readonly language: string;
  /** File extensions this provider handles (e.g., ['.ts', '.tsx']) */
  readonly extensions: string[];

  /**
   * Parse source code into a unified AST structure.
   * Should never throw — return diagnostics on parse failure.
   */
  parse(source: string, filename: string): ASTResult;

  /**
   * Check a semantic constraint against the parsed AST.
   * Returns a list of violations found.
   */
  checkConstraint(ast: ASTResult, constraint: SemanticConstraint): ConstraintViolation[];

  /**
   * Optional custom message formatter for violations.
   * If not provided, a default format is used.
   */
  formatMessage?(violation: ConstraintViolation): string;

  /**
   * Extract symbols (functions, classes, interfaces) from source code.
   * Used by the Code Graph builder to construct the in-memory graph.
   * Returns empty array if not supported.
   */
  extractSymbols?(source: string, filename: string): ExtractedSymbol[];
}

/** Regex-based constraint (backward compatibility). */
export interface RegexConstraint {
  pattern: string;
  flags?: string;
}

/** Union type for all constraint kinds. */
export type GuardConstraint = (SemanticConstraint | RegexConstraint) & {
  parser?: 'regex' | 'ast-ts' | 'ast-js' | 'ast-py' | 'ast-java' | 'ast-go';
};
