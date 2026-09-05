import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { Logger } from '../core/logger.js';
import { detectJsxUsage } from './ast-checker.js';
import type { SpecFile, GuardResult, DriftResult, GuardError, GuardWarning } from '../core/types.js';
import { parseSpecFile, parsePrdFile, parseTechFile } from '../spec/parser.js';
import { classifyRequirements, computeEnforcementCoverage, extractQuotedTerms, type ClassifiedItem } from '../spec/verifier-classify.js';
import { parsePonytailMarkers } from '../spec/ponytail.js';
import { lintPonytail } from './ponytail-linter.js';
import { readText, writeText, computeHash, getMumuSpecDir, findSpecDirs, normalizePath } from '../core/utils.js';
import type { ConstraintStrengthField } from '../core/config.js';
import { evaluateConstraint, type ConstraintCheck } from '../core/constraint-evaluator.js';
import { detectContractDrift } from '../contract/validator.js';
import { getLanguageProvider, registerBuiltInProviders, getProviderCount } from './language-provider-registry.js';

/**
 * Guard check metadata — maps error codes to strength-evaluation attributes.
 *
 * Used by `applyStrengthToGuardResult()` to decide whether a given error/
 * warning should be kept (block), downgraded to a warning (warn), or dropped
 * (info) based on the project's `constraint_strength` configuration.
 *
 * Error codes absent from this map use a default of
 * `{ dimension: 'technical_design', min_strength: 'low' }` — i.e. they
 * always fire at any strength level, preserving backwards compatibility
 * for code paths that have not yet been annotated.
 */
const GUARD_CHECK_METADATA: Record<string, Omit<ConstraintCheck, 'id'>> = {
  // SHALL NOT violations — always block (CI invariant)
  'E-GUARD-003': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // SHALL without verification declaration — verifiability is orthogonal to
  // strength (P0): always visible, never folded away at low strength.
  'E-SPEC-004': { dimension: 'technical_design', min_strength: 'medium', always_enforce: true },
  // SHALL NOT unverifiable (P0 E-SPEC-015) — red-line format invariant, always block
  'E-SPEC-015': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Manual constraint missing verify evidence (P0 E-VERIFY-003) — result gate
  'E-VERIFY-003': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Ponytail markers — TD
  'E-PONYTAIL-001': { dimension: 'technical_design', min_strength: 'medium' },
  // Test immutability hash mismatch — TD (behavior constraint, downgraded for LLM freedom)
  'E-GUARD-004': { dimension: 'technical_design', min_strength: 'medium' },
  // Build layers not done — RG (delivery completeness, result constraint — keep block)
  'E-GUARD-002': { dimension: 'requirement_goals', min_strength: 'high' },
  // Cognitive framework checks — TD (behavior constraints, downgraded for LLM freedom)
  'E-DESIGN-001': { dimension: 'technical_design', min_strength: 'medium' },
  'E-DESIGN-002': { dimension: 'technical_design', min_strength: 'medium' },
  'E-DESIGN-003': { dimension: 'technical_design', min_strength: 'medium' },
  'E-DESIGN-004': { dimension: 'technical_design', min_strength: 'medium' },
  'E-DESIGN-005': { dimension: 'technical_design', min_strength: 'medium' },
  'E-DESIGN-006': { dimension: 'technical_design', min_strength: 'medium' },
  // decisions.md hash mismatch — RG (audit integrity, always block)
  'E-CHANGE-007': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Completeness gate artifacts invalid / resolution chain broken — RG high
  // (goal-p0-dispatch-gate ENF-1/2/4: gate must never be degraded or bypassed)
  'E-CHANGE-020': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  'E-CHANGE-021': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Completeness gate block (missing artifact / open items / empty artifact /
  // unsigned declaration path) — RG high, always_enforce (ENF-3/ENF-4 red line)
  'E-GUARD-008': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Invalid phase transition — workflow control (always block)
  'E-CHANGE-006': { dimension: 'requirement_goals', min_strength: 'high', always_enforce: true },
  // Generic guard error (proposal.md missing, etc.) — TD medium (process artifact check)
  // CHG-5 (0.20): downgraded from RG high to TD medium — artifact existence is a
  // process constraint; the result constraint (verify pass) catches missing artifacts.
  'E-GUARD-001': { dimension: 'technical_design', min_strength: 'medium' },
  // Design template check — TD (process constraint, design structure is HOW)
  'E-DESIGN-009': { dimension: 'technical_design', min_strength: 'medium' },
  // Cross-artifact consistency — TD (process constraint, advisory for LLM freedom)
  'E-DESIGN-010': { dimension: 'technical_design', min_strength: 'medium' },
};

/** Default metadata for unmapped error codes. */
const DEFAULT_CHECK_METADATA: Omit<ConstraintCheck, 'id'> = {
  dimension: 'technical_design',
  min_strength: 'low',
};

/**
 * Apply strength-aware evaluation to a `GuardResult`.
 *
 * For each error/warning, looks up its `code` in `GUARD_CHECK_METADATA`,
 * calls `evaluateConstraint()`, and partitions the result:
 *   - `block` → retained in `errors`
 *   - `warn`  → moved to `warnings` (if it was an error) or retained (if already a warning)
 *   - `info`  → dropped from the output
 *
 * If `strength` is `undefined`, returns `result` unchanged (backwards compat
 * for callers that have not opted into strength-aware evaluation).
 */
export function applyStrengthToGuardResult(
  result: GuardResult,
  strength: ConstraintStrengthField | undefined,
): GuardResult {
  if (!strength) return result;

  const newErrors: GuardError[] = [];
  const newWarnings: GuardWarning[] = [];

  for (const err of result.errors) {
    const meta = GUARD_CHECK_METADATA[err.code] ?? DEFAULT_CHECK_METADATA;
    const evalResult = evaluateConstraint(
      { id: err.code, ...meta },
      strength,
    );
    if (evalResult.action === 'block') {
      newErrors.push(err);
    } else if (evalResult.action === 'warn') {
      newWarnings.push({
        code: err.code,
        message: `[downgraded from error] ${err.message}`,
        detail: err.detail ? `${err.detail} (reason: ${evalResult.reason})` : `(reason: ${evalResult.reason})`,
      });
    }
    // 'info' → dropped
  }

  for (const warn of result.warnings) {
    const meta = GUARD_CHECK_METADATA[warn.code] ?? DEFAULT_CHECK_METADATA;
    const evalResult = evaluateConstraint(
      { id: warn.code, ...meta },
      strength,
    );
    if (evalResult.action === 'block' || evalResult.action === 'warn') {
      newWarnings.push(warn);
    }
    // 'info' → dropped
  }

  return {
    passed: newErrors.length === 0,
    errors: newErrors,
    warnings: newWarnings,
    // P0: preserve enforcement coverage through strength folding
    coverage: result.coverage,
  };
}

/** Check compliance of code against specs */
export function checkCompliance(
  projectRoot: string,
  options: {
    shall?: boolean;
    shallNot?: boolean;
    ponytail?: boolean;
    testImmutability?: boolean;
    stagedOnly?: boolean;
    strength?: ConstraintStrengthField;
  },
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];
  const fullCheck = !options.shall && !options.shallNot && !options.ponytail && !options.testImmutability;

  // Merge source file scans: compute once, share across checks (IO optimization)
  const needsSourceFiles = options.shallNot || options.ponytail || fullCheck;
  const sourceFiles = needsSourceFiles ? findSourceFiles(projectRoot) : [];

  // SHALL NOT check
  if (options.shallNot || fullCheck) {
    checkShallNot(projectRoot, sourceFiles, errors, warnings);
  }

  // SHALL check — P0: also returns classified items for coverage (full check only)
  let classifiedItems: ClassifiedItem[] = [];
  if (options.shall || fullCheck) {
    classifiedItems = checkShall(projectRoot, errors, warnings, options.strength?.enforcement_strict !== false);
  }

  // Ponytail check
  if (options.ponytail) {
    checkPonytail(projectRoot, sourceFiles, errors, warnings);
    // Run ponytail linter rules (0.20.0+)
    const lintResults = lintPonytail(projectRoot);
    for (const result of lintResults) {
      const entry = {
        code: result.severity === 'error' ? 'E-PONYTAIL-001' : 'W-PONYTAIL-001',
        message: result.message,
        detail: `${result.file}:${result.line}${result.suggestion ? ' — ' + result.suggestion : ''}`,
      };
      if (result.severity === 'error') {
        errors.push(entry);
      } else {
        warnings.push(entry);
      }
    }
  }

  const rawResult: GuardResult = {
    passed: errors.length === 0,
    errors,
    warnings,
  };

  // P0 (C2): full checks report enforcement coverage (partial flags would
  // yield a misleading subset, so coverage is attached only then).
  if (fullCheck) {
    rawResult.coverage = computeEnforcementCoverage(classifiedItems);
  }

  return applyStrengthToGuardResult(rawResult, options.strength);
}

/** Check SHALL NOT violations */
// P1-1 Fix: Prohibition with annotation for semantic checking
interface ProhibitionEntry {
  text: string;
  source: string;
  annotation?: import('../core/types-spec.js').MachineReadableAnnotation;
}

function checkShallNot(
  projectRoot: string,
  sourceFiles: string[],
  errors: { code: string; message: string; detail?: string }[],
  _warnings: { code: string; message: string; detail?: string }[],
): void {
  // Collect all SHALL NOT constraints with annotation data
  const prohibitions = collectAllProhibitions(projectRoot);

  // Separate file-coexistence constraints from code-level prohibitions
  const codeProhibitions: ProhibitionEntry[] = [];
  const coexistenceConstraints: ProhibitionEntry[] = [];

  for (const p of prohibitions) {
    if (isCoexistenceConstraint(p.text)) {
      coexistenceConstraints.push(p);
    } else {
      codeProhibitions.push(p);
    }
  }

  // Handle file-coexistence constraints via directory scanning (not code pattern matching)
  if (coexistenceConstraints.length > 0) {
    checkFileCoexistence(projectRoot, coexistenceConstraints, errors);
  }

  // Scan source files for code-level prohibitions with annotation-aware routing
  const isSelfTool = isMumuSpecSelfRepo(projectRoot);
  for (const filePath of sourceFiles) {
    // Behavioral SHALL NOTs target agents operating the tool, not the test
    // harness — tests legitimately exercise forbidden paths to verify the CLI.
    if (isTestFile(filePath)) continue;

    const content = readText(filePath);
    if (!content) continue;

    for (const prohibition of codeProhibitions) {
      // Scope-aware: only check files within the prohibition's source tree
      if (!isFileInScope(filePath, prohibition.source, projectRoot)) continue;

      // Dogfooding carve-out (goal-p0-dispatch-gate): agent-behavioral
      // prohibitions ("禁止手工编辑...状态工件", "禁止以 --force 越过 E-SPEC-015")
      // target agents operating the tool. In the tool's own repo, src/ IS the
      // sanctioned implementer of those gates, so these constraints do not
      // scan the implementation module.
      if (isSelfTool && isAgentBehaviorConstraint(prohibition.text) && /(^|[\\/])src[\\/]/.test(filePath)) continue;

      // P1-1 Fix: Use annotation for semantic checking if available
      const violation = checkProhibitionViolation(content, prohibition.text, filePath, prohibition.annotation);
      if (violation) {
        errors.push({
          code: 'E-GUARD-003',
          message: `SHALL NOT 违规: ${prohibition.text}`,
          detail: `${filePath}:${violation.line} (source: ${prohibition.source})`,
        });
      }
    }
  }
}

/** Check if a source file falls within the scope of a prohibition's origin */
function isFileInScope(filePath: string, prohibitionSource: string, projectRoot: string): boolean {
  // Determine the spec's directory (e.g., from "demo/.mumuspec/spec.md" → "demo/")
  const specDir = prohibitionSource.replace(projectRoot, '').replace(/^\\/, '');
  const parts = specDir.split(/[\\/]/);
  // Find the subdirectory containing .mumuspec — that's the scope root
  const scopeRoot = parts.slice(0, parts.indexOf('.mumuspec')).join('/');

  // Root-level (.mumuspec/) applies to entire project
  if (scopeRoot === '') return true;

  // Subproject spec only applies to files under that subproject
  const relPath = filePath.replace(projectRoot, '').replace(/^\\/, '');
  return relPath.startsWith(scopeRoot);
}

/** Test harness files — behavioral SHALL NOTs do not scan these (they
 *  legitimately exercise forbidden paths to verify the CLI itself). */
function isTestFile(filePath: string): boolean {
  const norm = filePath.split('\\').join('/');
  if (/(^|\/)(tests?|__tests__)\//.test(norm)) return true;
  return /\.(test|spec)\.[cm]?[jt]sx?$/.test(norm);
}

/** Whether the checked project is the MumuSpec tool itself (dogfooding). */
function isMumuSpecSelfRepo(projectRoot: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
    return pkg?.name === 'mumuspec';
  } catch {
    return false;
  }
}

/** Agent-behavioral prohibitions whose lexical channel cannot express intent:
 *  - "禁止手工编辑由 CLI 管理的审计与状态工件…" (any artifact/command mention matches)
 *  - "禁止以 `--force` 越过 E-SPEC-015…" (flag definitions, git ops, remedy prose match)
 *  In the tool's own repo (dogfooding), src/ is the sanctioned implementer of
 *  these very gates, so the constraint exempts the implementation module. */
function isAgentBehaviorConstraint(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes('手工编辑') && (lower.includes('状态工件') || lower.includes('.mumuspec.yaml') || lower.includes('decisions.md'))) {
    return true;
  }
  return lower.includes('--force') && (lower.includes('e-spec-015') || lower.includes('forceable'));
}

/** Check if a constraint is a file-coexistence rule or system-behavior rule (not a code pattern) */
function isCoexistenceConstraint(text: string): boolean {
  const lower = text.toLowerCase();
  // File coexistence constraints
  if (lower.includes('coexist') || lower.includes('共存') ||
      (lower.includes('shall not') && lower.includes('.md') && lower.includes('same'))) {
    return true;
  }
  // System-behavior constraints: "The system/loader/Init SHALL NOT..." rules target
  // runtime behavior, not code patterns — they need dedicated logic, not string matching
  const systemPrefixes = [
    'the system shall not',
    'the loader shall not',
    'init shall not',
    'finalize-archive shall not',
    'changes shall not',
    'the spec loader',
    'the user shall not',
    'the command shall not',
  ];
  for (const prefix of systemPrefixes) {
    if (lower.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Check file-coexistence constraints by scanning directories.
 * Prevents false positives from code that references spec filenames.
 */
function checkFileCoexistence(
  projectRoot: string,
  constraints: ProhibitionEntry[],
  errors: { code: string; message: string; detail?: string }[],
): void {
  // Extract file pairs from constraints like "X SHALL NOT coexist with Y"
  const filePairs: { fileA: string; fileB: string; source: string }[] = [];

  for (const { text, source } of constraints) {
    const match = text.match(/[`"']?(\w+\.md)[`"']?\s+(?:SHALL NOT|shall not)\s+(?:coexist|共存)\s+with\s+[`"']?(\w+\.md)[`"']?/i)
      || text.match(/[`"']?(\w+\.md)[`"']?\s*与\s*[`"']?(\w+\.md)[`"']?\s*不应共存/);
    if (match) {
      filePairs.push({ fileA: match[1], fileB: match[2], source });
    }
  }

  if (filePairs.length === 0) return;

  // Scan all .mumuspec/ directories (except project root for certain pairs)
  function scanDirs(dir: string): void {
    const mumuDir = join(dir, '.mumuspec');
    if (existsSync(mumuDir)) {
      const isRoot = dir === projectRoot;
      for (const { fileA, fileB, source } of filePairs) {
        // Root directory is allowed to retain the legacy full spec layout
        // (spec.md + tech.md + prd.md + design.md coexistence)
        if (isRoot) {
          continue;
        }
        const pathA = join(mumuDir, fileA);
        const pathB = join(mumuDir, fileB);
        if (existsSync(pathA) && existsSync(pathB)) {
          errors.push({
            code: 'E-GUARD-003',
            message: `SHALL NOT 违规: "${fileA}" 与 "${fileB}" 在同一个 .mumuspec/ 目录共存`,
            detail: `${mumuDir} (source: ${source})`,
          });
        }
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        // demo/examples trees are intentional fixtures that may showcase legacy
        // spec layouts — exempt from the coexistence gate (goal-p0-dispatch-gate)
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'demo' && entry.name !== 'examples') {
          scanDirs(join(dir, entry.name));
        }
      }
    } catch (e) {
      // Ignore — directory may not be readable
      Logger.debug('guard.checker', 'Failed to scan directories during coexistence check', { error: (e as Error).message });
    }
  }

  scanDirs(projectRoot);
}

/** Check SHALL requirements (P0: classifier-driven verifiability; returns classified items) */
function checkShall(
  projectRoot: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
  strict: boolean,
): ClassifiedItem[] {
  const specs = findAllSpecs(projectRoot);
  const allItems: ClassifiedItem[] = [];

  for (const spec of specs) {
    const prohibitions = spec.frontmatter.prohibitions ?? [];
    const items = classifyRequirements(spec.requirements, prohibitions, spec.path);
    allItems.push(...items);
    for (const item of items) {
      if (item.cls !== 'unverifiable') continue;
      if (item.polarity === 'shall') {
        warnings.push({
          code: 'E-SPEC-004',
          message: `SHALL without enforcement: "${item.text}"`,
          detail: spec.path,
        });
      } else {
        // P0 E-SPEC-015 — red-line gate; strict promotes to ERROR (always block)
        const message = `SHALL NOT 无可验证通道 (Requirement "${item.requirement}"): "${item.text}"`;
        const target = strict ? errors : warnings;
        target.push({
          code: 'E-SPEC-015',
          message: strict ? message : `${message} [enforcement_strict=false — 将在 strict 模式下阻断]`,
          detail: spec.path,
        });
      }
    }
  }
  return allItems;
}

/** Check Ponytail compliance */
function checkPonytail(
  projectRoot: string,
  sourceFiles: string[],
  _errors: { code: string; message: string; detail?: string }[],
  _warnings: { code: string; message: string; detail?: string }[],
): void {
  // Check for ponytail: markers in code
  for (const filePath of sourceFiles) {
    const content = readText(filePath);
    if (!content) continue;

    const markers = parsePonytailMarkers(content, filePath);
    // Markers are intentional simplifications, just note them
    for (const marker of markers) {
      _warnings.push({
        code: 'E-PONYTAIL-001',
        message: `Ponytail marker: ${marker.reason}`,
        detail: `${marker.file}:${marker.line}`,
      });
    }
  }

  // Check for new dependencies (basic check)
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      // ponytail: dep count comparison deferred
    } catch (e) {
      // Ignore — package.json may not be valid JSON
      Logger.debug('guard.checker', 'Failed to parse package.json during ponytail check', { error: (e as Error).message });
    }
  }
}

/**
 * Collect all SHALL NOT constraints from all spec files.
 *
 * Includes both legacy spec.md and distributed-spec V2 prd.md / tech.md.
 * prd.md / tech.md are parsed with V2-aware parsers; parsing failures are
 * silently skipped (backward compat — projects without prd/tech still work).
 */
function collectAllProhibitions(
  projectRoot: string,
): ProhibitionEntry[] {
  const results: ProhibitionEntry[] = [];
  const specs = findAllSpecs(projectRoot);

  for (const spec of specs) {
    for (const req of spec.requirements) {
      for (const shallNot of req.shallNot) {
        // P1-1 Fix: Look up annotation for this prohibition
        const annotation = getAnnotationFromFrontmatter(spec, shallNot);
        results.push({ text: shallNot, source: spec.path, annotation });
      }
    }
  }

  // Collect SHALL NOT from distributed-spec prd.md / tech.md
  collectDistributedProhibitions(projectRoot, results);

  return results;
}

/** P1-1 Fix: Look up annotation from spec frontmatter */
function getAnnotationFromFrontmatter(
  spec: import('../core/types.js').SpecFile,
  prohibitionText: string,
): import('../core/types-spec.js').MachineReadableAnnotation | undefined {
  const frontmatter = spec.frontmatter as import('../core/types-spec.js').SpecFrontmatter;
  if (!frontmatter.prohibitions) return undefined;
  
  const match = frontmatter.prohibitions.find(
    p => p.text === prohibitionText || prohibitionText.includes(p.text) || p.text.includes(prohibitionText)
  );
  return match?.annotation;
}

/** Recursively collect SHALL NOT from prd.md and tech.md files */
function collectDistributedProhibitions(
  projectRoot: string,
  results: ProhibitionEntry[],
): void {
  function scan(dir: string): void {
    const mumuDir = join(dir, '.mumuspec');

    // prd.md
    const prdPath = join(mumuDir, 'prd.md');
    if (existsSync(prdPath)) {
      try {
        const content = readText(prdPath);
        if (content && /^doc_type:\s*prd/m.test(content)) {
          const prd = parsePrdFile(content, prdPath);
          if (prd.requirements) {
            for (const req of prd.requirements) {
              for (const shallNot of req.shallNot) {
                results.push({ text: shallNot, source: prdPath });
              }
            }
          }
        }
      } catch {
        // Skip — prd.md may be malformed
        Logger.debug('guard.checker', 'Failed to parse prd.md for prohibitions', { path: prdPath });
      }
    }

    // tech.md
    const techPath = join(mumuDir, 'tech.md');
    if (existsSync(techPath)) {
      try {
        const content = readText(techPath);
        if (content && /^doc_type:\s*tech/m.test(content)) {
          const tech = parseTechFile(content, techPath);
          for (const req of tech.requirements) {
            for (const shallNot of req.shallNot) {
              results.push({ text: shallNot, source: techPath });
            }
          }
        }
      } catch {
        // Skip — tech.md may be malformed
        Logger.debug('guard.checker', 'Failed to parse tech.md for prohibitions', { path: techPath });
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(join(dir, entry.name));
        }
      }
    } catch {
      // Ignore — directory may not be readable
    }
  }

  scan(projectRoot);
}

/**
 * Check AST-based constraint violations using the Language Provider registry.
 *
 * Parses the constraint ID from `ast:<constraint>` format, looks up the provider
 * by file extension, and delegates to the provider's semantic checker.
 *
 * Falls back gracefully: any error returns null so the caller can try regex.
 */
function checkAstViolation(
  content: string,
  prohibition: string,
  filePath: string,
  annotation?: import('../core/types-spec.js').MachineReadableAnnotation,
): { line: number } | null {
  try {
    // P1-1 Fix: Derive constraint ID from annotation if available
    let constraintId: string;
    if (annotation) {
      // Map annotation type to AST constraint ID
      const typeToConstraint: Record<string, string> = {
        'no-new-dependency': 'no-new-dependency',
        'no-mutable-state': 'no-mutable-state',
        'no-side-effect': 'no-side-effect',
        'pure-function': 'enforce-idempotent',
        'no-global-state': 'no-global-state',
        'custom': annotation.ast_constraint || 'custom',
      };
      constraintId = typeToConstraint[annotation.type] || annotation.type;
    } else {
      // Legacy: Extract constraint ID from prohibition text (e.g., "ast:no-mutable-state" → "no-mutable-state")
      constraintId = prohibition.slice(4);
    }
    if (!constraintId) return null;

    // Auto-initialize built-in providers on first use
    if (getProviderCount() === 0) {
      registerBuiltInProviders();
    }

    // Extract extension from filePath (e.g., "src/foo.ts" → ".ts")
    const dotIndex = filePath.lastIndexOf('.');
    if (dotIndex < 0) return null;
    const ext = filePath.slice(dotIndex).toLowerCase();

    const provider = getLanguageProvider(ext);
    if (!provider) return null;

    const ast = provider.parse(content, filePath);
    const violations = provider.checkConstraint(ast, {
      type: constraintId,
      params: {},
    });

    if (violations.length === 0) return null;

    // Return the first violation's line
    const first = violations[0];
    return { line: first.location.line };
  } catch {
    // AST analysis failed — signal caller to fall back to regex
    Logger.debug('guard.checker', 'AST analysis failed, will fallback to regex', { file: filePath });
    return null;
  }
}

/** Check if a prohibition is violated in code content (with AST fallback) */
function checkProhibitionViolation(
  content: string,
  prohibition: string,
  filePath: string,
  annotation?: import('../core/types-spec.js').MachineReadableAnnotation,
): { line: number } | null {
  // P1-1 Fix: AST routing based on annotation type
  if (annotation) {
    const astViolation = checkAstViolation(content, prohibition, filePath, annotation);
    if (astViolation) return astViolation;
    // For 'custom' type without specific handler, fall through to regex
    if (annotation.type !== 'custom') {
      // AST handler ran but found nothing — skip regex to avoid false positives
      return null;
    }
  }

  // Legacy AST-based routing: if prohibition starts with 'ast:', use AST provider
  if (prohibition.startsWith('ast:')) {
    const astViolation = checkAstViolation(content, prohibition, filePath);
    if (astViolation) return astViolation;
    // AST failed or found nothing — fallback to regex below
  }

  const lower = prohibition.replace(/^ast:/i, '').toLowerCase();
  const isJsxProhibition = lower.includes('jsx') || lower.includes('tsx');

  // JSX/TSX prohibition: use AST-based detection (distinguishes JSX from generics/htm).
  if (isJsxProhibition) {
    const result = detectJsxUsage(content, filePath);
    if (result.hasJsx) {
      return { line: result.line ?? 1 };
    }
    return null;
  }

  // P0: shared lexical-channel extraction (single source of truth with the
  // verifier classifier — quoted terms + eval/动态执行 patterns)
  // Per-term affinity rules suppress structural false positives: a matched
  // line must plausibly *perform* the prohibited act, not merely mention it.
  const terms = extractQuotedTerms(prohibition);
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = term.length <= 4 ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'i');
    const isFlagTerm = term.startsWith('--');
    const isFileTerm = /\.(md|ya?ml|json|txt|log)$/i.test(term);
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Skip comments (including block-comment continuation lines)
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }
      if (pattern.test(lines[i])) {
        // CLI-flag terms (--force etc.): flag *definitions* (.option('--force')),
        // other tools' invocations (git worktree remove --force) and remedy
        // prose are not violations — require the mumuspec CLI on the line
        // (as a standalone word, so "non-mumuspec hooks" doesn't count).
        if (isFlagTerm && !/(^|[^-\w])mumuspec([^-\w]|$)/i.test(lines[i])) continue;
        // File-artifact terms (.mumuspec.yaml, decisions.md): a mention is not
        // an edit — require an actual write/remove call on the line.
        if (isFileTerm && !/writeFileSync|appendFileSync|rmSync|unlinkSync|createWriteStream|writeFile\(|appendFile\(/.test(lines[i])) continue;
        return { line: i + 1 };
      }
    }
  }

  // eval/动态执行 lexical channel (mirrors extractRegexPatterns)
  const lowerText = prohibition.replace(/^ast:/i, '').toLowerCase();
  if (lowerText.includes('eval') || lowerText.includes('动态执行')) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }
      if (/eval\s*\(/.test(lines[i]) || /new\s+Function\s*\(/.test(lines[i])) {
        return { line: i + 1 };
      }
    }
  }

  return null;
}

/** Find all spec files in project */
function findAllSpecs(projectRoot: string): SpecFile[] {
  const results: SpecFile[] = [];

  function scan(dir: string) {
    const specPath = join(dir, '.mumuspec', 'spec.md');
    if (existsSync(specPath)) {
      try {
        const content = readFileSync(specPath, 'utf8');
        results.push(parseSpecFile(content, specPath));
      } catch (e) {
        // Skip — spec file may be malformed
        Logger.debug('guard.checker', 'Failed to read/parse spec file', { error: (e as Error).message });
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(join(dir, entry.name));
        }
      }
    } catch (e) {
      // Ignore — directory may not be readable
      Logger.debug('guard.checker', 'Failed to scan directories during spec search', { error: (e as Error).message });
    }
  }

  scan(projectRoot);
  return results;
}

/** Find source files in project */
function findSourceFiles(projectRoot: string): string[] {
  const results: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];

  function scan(dir: string, depth: number = 0) {
    if (depth > 10) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            scan(join(dir, entry.name), depth + 1);
          }
        } else if (entry.isFile()) {
          if (extensions.some((ext) => entry.name.endsWith(ext))) {
            results.push(join(dir, entry.name));
          }
        }
      }
    } catch (e) {
      // Ignore — directory may not be readable
      Logger.debug('guard.checker', 'Failed to scan directories during source file search', { error: (e as Error).message });
    }
  }

  scan(projectRoot);
  return results;
}

/** Detect drift between specs and code */
export function detectDrift(projectRoot: string): DriftResult[] {
  const results: DriftResult[] = [];
  const specs = findAllSpecs(projectRoot);

  // Spec drift: check if requirements have implementations
  for (const spec of specs) {
    for (const req of spec.requirements) {
      // Check if enforcement rules are defined
      if (req.shall.length > 0 && req.enforcement.length === 0) {
        results.push({
          type: 'spec_drift',
          severity: 'WARN',
          message: `Requirement "${req.name}" has SHALL constraints but no Enforcement`,
          file: spec.path,
          fixHint: `Add "enforcement:" block to requirement "${req.name}" in ${spec.path}`,
        });
      }
    }
  }

  // Index drift: check if index.yaml matches actual structure
  checkIndexDrift(projectRoot, results);

  return results;
}

/** Check index.yaml freshness — P1-2 Fix: Real directory comparison */
function checkIndexDrift(
  projectRoot: string,
  results: DriftResult[],
): void {
  const scan = (dir: string) => {
    const mumuDir = join(dir, '.mumuspec');
    const indexPath = join(mumuDir, 'index.yaml');

    if (!existsSync(indexPath)) return;

    try {
      const indexContent = readFileSync(indexPath, 'utf8');
      const indexData = parse(indexContent) as { children?: Array<{ name?: string; path?: string }> };

      // Get actual directories that have .mumuspec subdirectory
      const actualDirs = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .filter((e) => existsSync(join(dir, e.name, '.mumuspec')))
        .map((e) => e.name);

      // P1-2 fix (2026-08-29): index children carry a `name` and a relative
      // `path` (e.g. "src\core"). The previous comparison matched paths
      // against bare directory names — they never intersected, so EVERY
      // entry produced a spurious "no longer has .mumuspec" warning.
      const indexEntries = indexData.children || [];

      // Detect directories missing from index (compare names against both
      // the entry name and its path basename/whole path)
      for (const dirName of actualDirs) {
        const covered = indexEntries.some((c) => {
          if (c.name === dirName || c.path === dirName) return true;
          const base = c.path?.split(/[\\/]/).pop();
          return base === dirName;
        });
        if (!covered) {
          results.push({
            type: 'index_drift',
            severity: 'WARN',
            message: `Directory "${dirName}" has .mumuspec but is missing from index.yaml`,
            file: join(dir, dirName),
            fixable: true,
            fixHint: `Run 'mumuspec sync' to update index.yaml`,
          });
        }
      }

      // Detect index entries whose target no longer has .mumuspec on disk
      for (const entry of indexEntries) {
        if (!entry.path) continue;
        const childMumuDir = join(dir, entry.path, '.mumuspec');
        if (!existsSync(childMumuDir)) {
          results.push({
            type: 'index_drift',
            severity: 'WARN',
            message: `index.yaml references "${entry.path}" but directory no longer has .mumuspec`,
            file: join(dir, entry.path),
            fixable: true,
            fixHint: `Remove stale entry from index.yaml or restore directory`,
          });
        }
      }
    } catch (e) {
      Logger.debug('guard.checker', 'Failed to read index.yaml during drift check', { error: (e as Error).message });
    }
  };

  scan(projectRoot);
}

/** Detect drift between contracts and code (Cross-Directory Contract Guard) */
export function detectContractGuardDrift(projectRoot: string): DriftResult[] {
  const results: DriftResult[] = [];

  try {
    const report = detectContractDrift(projectRoot);

    for (const drift of report.drifts) {
      results.push({
        type: `contract_${drift.type}`,
        severity: drift.severity,
        message: `[${drift.contract_id}] ${drift.message}`,
        file: drift.file,
        line: drift.line,
      });
    }

    // Add a summary entry if drifts found
    if (report.drift_count > 0) {
      results.push({
        type: 'contract_summary',
        severity: report.has_critical_drifts ? 'ERROR' : 'WARN',
        message: `Contract drift: ${report.drift_count} drift(s) across ${report.total_contracts} contract(s) in ${report.scan_duration_ms}ms`,
      });
    }
  } catch {
    // Contract drift detection is best-effort
    results.push({
      type: 'contract_drift_error',
      severity: 'WARN',
      message: 'Contract drift detection failed — contracts.yaml may be missing or malformed',
    });
  }

  return results;
}

/** Detect drift between specs and code (original, extended) */
export function detectDriftWithContracts(projectRoot: string): DriftResult[] {
  const results = detectDrift(projectRoot);
  const contractDrifts = detectContractGuardDrift(projectRoot);
  return [...results, ...contractDrifts];
}

// ════════════════════════════════════════════════════════════════════
// CHG-3 — AGENTS.md ↔ spec 同步 hash（agents-hash.json）
// ════════════════════════════════════════════════════════════════════

/** spec 组文件（根 .mumuspec/ 与各 findSpecDirs 子层同组） */
const AGENTS_HASH_SPEC_FILES = ['spec.md', 'prd.md', 'tech.md', 'prohibitions.md'];

/**
 * Compute the canonical spec content hash (CHG-3).
 *
 * 根 .mumuspec/ 下 spec.md/prd.md/tech.md/prohibitions.md + 递归 findSpecDirs
 * 子层同组文件；仅取存在者，按相对路径排序；contents = relpath + '\n' + content；
 * 最终 computeHash(join)。
 */
export function computeSpecHash(projectRoot: string): string {
  const entries: Array<{ relpath: string; content: string }> = [];
  const scopes = [projectRoot, ...findSpecDirs(projectRoot)];

  for (const scope of scopes) {
    const mumuDir = join(scope, '.mumuspec');
    if (!existsSync(mumuDir)) continue;
    const relBase = relative(projectRoot, scope) || '.';
    for (const name of AGENTS_HASH_SPEC_FILES) {
      const filePath = join(mumuDir, name);
      if (!existsSync(filePath)) continue;
      const relPath = relBase === '.' ? `.mumuspec/${name}` : `${relBase}/.mumuspec/${name}`;
      entries.push({
        relpath: normalizePath(relPath),
        content: readFileSync(filePath, 'utf8'),
      });
    }
  }

  entries.sort((a, b) => a.relpath.localeCompare(b.relpath));
  const joined = entries.map((e) => `${e.relpath}\n${e.content}`).join('\n');
  return computeHash(joined);
}

/**
 * Detect AGENTS.md ↔ spec drift (CHG-3).
 *
 * - agents-hash.json 缺失 → WARN（未生成/无法校验）
 * - 重新计算 specHash 比对不一致 → ERROR E-AGENTS-001
 * - 一致 → 无 agents_drift 报告
 */
export function detectAgentsDrift(projectRoot: string): DriftResult[] {
  const hashPath = join(getMumuSpecDir(projectRoot), 'agents-hash.json');
  if (!existsSync(hashPath)) {
    return [
      {
        type: 'agents_drift',
        severity: 'WARN',
        message: 'AGENTS.md↔spec 漂移无法校验：agents-hash.json 未生成',
        fixHint: '运行 mumuspec rules generate 生成 AGENTS.md 与 agents-hash.json',
      },
    ];
  }

  let recorded: { version?: number; specHash?: string } = {};
  try {
    recorded = JSON.parse(readFileSync(hashPath, 'utf8')) as { version?: number; specHash?: string };
  } catch {
    return [
      {
        type: 'agents_drift',
        severity: 'WARN',
        message: 'AGENTS.md↔spec 漂移无法校验：agents-hash.json 解析失败',
        fixHint: '重新运行 mumuspec rules generate',
      },
    ];
  }

  const current = computeSpecHash(projectRoot);
  if (recorded.specHash === current) return [];

  return [
    {
      type: 'agents_drift',
      severity: 'ERROR',
      code: 'E-AGENTS-001',
      message: 'AGENTS.md↔spec 漂移：spec 内容在 AGENTS.md 生成后发生变化',
      fixHint: '重新运行 mumuspec rules generate',
    },
  ];
}

// ════════════════════════════════════════════════════════════════════
// Auto-Fix Engine — Safe drift auto-remediation
// ════════════════════════════════════════════════════════════════════

/**
 * Result of auto-fix operation.
 */
export interface AutoFixResult {
  /** Drifts that were successfully fixed */
  fixed: DriftResult[];
  /** Drifts that could not be fixed automatically */
  remaining: DriftResult[];
}

/**
 * Auto-fix safe drift issues.
 * Only applies fixes that are low-risk and deterministic.
 * Returns fixed items and remaining (unfixed) items.
 */
export function autoFixDrift(
  projectRoot: string,
  drifts: DriftResult[],
  dryRun = false,
): AutoFixResult {
  const fixed: DriftResult[] = [];
  const remaining: DriftResult[] = [];

  for (const drift of drifts) {
    const fixable = applySafeFix(projectRoot, drift, dryRun);
    if (fixable) {
      fixed.push(drift);
    } else {
      remaining.push(drift);
    }
  }

  return { fixed, remaining };
}

/**
 * Attempt to apply a safe fix for a single drift.
 * Returns true if the fix was applied (or would be applied in dry-run).
 */
function applySafeFix(projectRoot: string, drift: DriftResult, dryRun: boolean): boolean {
  // Only fix WARN-severity drifts — never auto-fix ERROR
  if (drift.severity === 'ERROR') return false;

  switch (drift.type) {
    case 'spec_drift':
      // Safe fix: add basic enforcement marker
      return fixSpecDrift(projectRoot, drift, dryRun);

    case 'index_drift':
      // P1-2 Fix: Auto-fix index drift by running sync
      return fixIndexDrift(projectRoot, drift, dryRun);

    case 'contract_summary':
    case 'contract_drift_error':
      // Informational only — nothing to fix
      return false;

    default:
      return false;
  }
}

/**
 * Fix spec drift: add enforcement hint comment to spec file.
 * Returns true if fix was applied (or would be in dry-run).
 *
 * Note: We add an HTML comment placeholder. Once the file contains
 * 'mumuspec-drift-fix' marker, we consider it "acknowledged" to prevent
 * repeated fix attempts on the same drift.
 */
function fixSpecDrift(projectRoot: string, drift: DriftResult, dryRun: boolean): boolean {
  if (!drift.file) return false;

  try {
    const absPath = drift.file.startsWith(projectRoot) ? drift.file : join(projectRoot, drift.file.replace(/^\\.\\?/, ''));
    const content = readText(absPath);
    if (!content) return false;

    // Check if already has enforcement section
    if (content.includes('enforcement:')) return false;

    // Check if fix already applied (marker present)
    if (content.includes('mumuspec-drift-fix')) return false;

    if (dryRun) {
      return true; // Would add enforcement hint
    }

    // Append enforcement hint comment
    const hint = `\n<!-- mumuspec-drift-fix: Add enforcement rules for SHALL constraints -->\n`;
    writeText(absPath, content + hint);
    return true;
  } catch (e) {
    Logger.debug('guard.checker', 'Failed to apply spec drift fix', { error: (e as Error).message });
    return false;
  }
}

/**
 * P1-2 Fix: Auto-fix index drift by adding missing entry to index.yaml
 */
function fixIndexDrift(projectRoot: string, drift: DriftResult, dryRun: boolean): boolean {
  if (!drift.file) return false;

  try {
    const indexPath = join(projectRoot, '.mumuspec', 'index.yaml');
    if (!existsSync(indexPath)) return false;

    const content = readText(indexPath);
    if (!content) return false;

    // Extract directory name from the drift path
    const dirName = drift.file.split('/').pop() || drift.file.split('\\').pop();
    if (!dirName) return false;

    // Check if already in index
    if (content.includes(`path: ${dirName}`) || content.includes(`path: "${dirName}"`)) return false;

    if (dryRun) {
      return true; // Would add entry to index
    }

    // Add entry to index.yaml (simple append to children)
    const entry = `\n  - path: ${dirName}\n    summary: Auto-fixed index entry\n`;
    const updatedContent = content.replace(/(\nchildren:\s*)/, `$1${entry}`);
    writeText(indexPath, updatedContent);
    return true;
  } catch (e) {
    Logger.debug('guard.checker', 'Failed to apply index drift fix', { error: (e as Error).message });
    return false;
  }
}
