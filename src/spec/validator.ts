import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { SpecFile, GuardResult } from '../core/types.js';
import type { ProhibitionAnnotation } from '../core/types-spec.js';
import type { ClassifiedItem } from './verifier-classify.js';
import { classifyRequirements, computeEnforcementCoverage } from './verifier-classify.js';
import { parseSpecFile, parsePrdFile, parseTechFile } from './parser.js';
import { checkInheritanceConflicts } from './inheritance.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText, findSpecDirs } from '../core/utils.js';

/** Distributed spec file types for validation */
const DISTRIBUTED_SPEC_FILES = ['spec.md', 'prd.md', 'tech.md'] as const;

type DistSpecFile = typeof DISTRIBUTED_SPEC_FILES[number];

/** Validate all spec files in the project */
export function validateAllSpecs(
  projectRoot: string,
  config: MumuSpecConfig,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  // P0 verifier gate (M2): strict mode promotes unverifiable SHALL NOT to ERROR.
  // Default ON since M2 — opt out with `enforcement_strict: false`.
  const strict = config?.constraint_strength?.enforcement_strict !== false;

  const specDirs = findAllSpecDirs(projectRoot);

  // Collect all distributed spec file paths
  const allSpecFiles: { dir: string; file: DistSpecFile; path: string }[] = [];
  for (const dirPath of specDirs) {
    for (const fileName of DISTRIBUTED_SPEC_FILES) {
      const filePath = join(dirPath, '.mumuspec', fileName);
      if (existsSync(filePath)) {
        allSpecFiles.push({ dir: dirPath, file: fileName, path: filePath });
      }
    }
  }

  // P0: classifier items collected across all files → enforcement coverage
  const allItems: ClassifiedItem[] = [];

  // Validate each spec file based on its type
  for (const { dir, file, path: specPath } of allSpecFiles) {
    if (file === 'spec.md') {
      validateSpecMd(specPath, dir, config, strict, allItems, errors, warnings);
    } else if (file === 'prd.md') {
      validatePrdFile(specPath, dir, errors, warnings);
    } else if (file === 'tech.md') {
      validateTechFile(specPath, dir, strict, allItems, errors, warnings);
    }
  }

  // Check inheritance conflicts
  checkAllInheritance(specDirs, errors);

  // Check parent_prd/parent_tech references
  checkParentReferences(allSpecFiles, errors);

  // Check index.yaml freshness
  for (const dirPath of specDirs) {
    const indexPath = join(dirPath, '.mumuspec', 'index.yaml');
    if (existsSync(indexPath)) {
      const actualChildren = getActualChildSpecDirs(dirPath);
      // Simple check: if there are child spec dirs not in index, warn
      if (actualChildren.length > 0) {
        // Could do more detailed comparison here
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    coverage: computeEnforcementCoverage(allItems),
  };
}

/**
 * P0 verifier semantics (proposal §3.3): emit gate-aware findings for one
 * classified item.
 *   - SHALL NOT + unverifiable → E-SPEC-015 (strict: ERROR / else WARN)
 *   - SHALL + unverifiable     → E-SPEC-004 (always WARN, never folded away —
 *                                ERROR_CODES registry marks it always_enforce)
 */
function emitVerifiabilityFindings(
  items: ClassifiedItem[],
  strict: boolean,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  for (const item of items) {
    if (item.cls !== 'unverifiable') continue;
    if (item.polarity === 'shall-not') {
      const message = `SHALL NOT 无可验证通道 (Requirement "${item.requirement}"): "${item.text}"`;
      const finding = strict
        ? errors
        : warnings;
      finding.push({
        code: 'E-SPEC-015',
        message: strict ? message : `${message} [enforcement_strict=false — 将在 strict 模式下阻断]`,
        detail: item.source,
      });
    } else {
      warnings.push({
        code: 'E-SPEC-004',
        message: `SHALL 无验证声明 (Requirement "${item.requirement}"): "${item.text}"`,
        detail: item.source,
      });
    }
  }
}

/** Validate a spec.md file (original format) */
function validateSpecMd(
  specPath: string,
  dirPath: string,
  config: MumuSpecConfig,
  strict: boolean,
  collectedItems: ClassifiedItem[],
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  try {
    const content = readText(specPath);
    if (!content) return;

    const spec = parseSpecFile(content, specPath);

    // Check layer depth
    if (spec.frontmatter.layer > config.specs.max_layer_depth) {
      errors.push({
        code: 'E-SPEC-002',
        message: `Directory ${dirPath} exceeds max_layer_depth (${spec.frontmatter.layer} > ${config.specs.max_layer_depth})`,
        detail: specPath,
      });
    }

    // Check for design.md if required
    if (config.specs.require_design_doc) {
      const designPath = join(dirPath, '.mumuspec', 'design.md');
      if (!existsSync(designPath)) {
        errors.push({
          code: 'E-SPEC-006',
          message: `Missing design.md in ${dirPath}`,
          detail: designPath,
        });
      }
    }

    // P0 verifier semantics: classify every SHALL/SHALL NOT item
    const prohibitions: ProhibitionAnnotation[] = spec.frontmatter.prohibitions ?? [];
    const items = classifyRequirements(spec.requirements, prohibitions, specPath);
    collectedItems.push(...items);
    emitVerifiabilityFindings(items, strict, errors, warnings);
  } catch (err) {
    errors.push({
      code: 'E-SPEC-001',
      message: `Invalid spec.md: ${(err as Error).message}`,
      detail: specPath,
    });
  }
}

/** Validate a single spec file */
export function validateSpecFile(filePath: string): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  try {
    const content = readText(filePath);
    if (!content) {
      errors.push({
        code: 'E-SPEC-001',
        message: 'File is empty',
        detail: filePath,
      });
      return { passed: false, errors, warnings };
    }

    const spec = parseSpecFile(content, filePath);

    // Check frontmatter
    if (spec.frontmatter.layer < 0) {
      errors.push({
        code: 'E-SPEC-001',
        message: 'layer must be >= 0',
        detail: filePath,
      });
    }

    if (!spec.frontmatter.scope) {
      errors.push({
        code: 'E-SPEC-001',
        message: 'scope is required',
        detail: filePath,
      });
    }

    // Check for requirements
    if (spec.requirements.length === 0) {
      warnings.push({
        code: 'E-SPEC-004',
        message: 'No requirements defined',
        detail: filePath,
      });
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'MumuSpecError') {
      errors.push({
        code: 'E-SPEC-001',
        message: err.message,
        detail: filePath,
      });
    } else {
      errors.push({
        code: 'E-SPEC-001',
        message: `Failed to parse: ${(err as Error).message}`,
        detail: filePath,
      });
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/** Find all directories with .mumuspec/ (shared core walker + root check) */
function findAllSpecDirs(projectRoot: string): string[] {
  const results = findSpecDirs(projectRoot);
  if (existsSync(join(projectRoot, '.mumuspec'))) results.unshift(projectRoot);
  return results;
}

/** Check inheritance for all spec directories */
function checkAllInheritance(
  specDirs: string[],
  errors: { code: string; message: string; detail?: string }[],
) {
  // Build a map of directory -> spec
  const specMap = new Map<string, SpecFile>();

  for (const dirPath of specDirs) {
    const specPath = join(dirPath, '.mumuspec', 'spec.md');
    if (existsSync(specPath)) {
      try {
        const content = readText(specPath);
        if (content) {
          specMap.set(dirPath, parseSpecFile(content, specPath));
        }
      } catch {
        // Skip
      }
    }
  }

  // For each spec, find its parent and check conflicts
  for (const [dirPath, childSpec] of specMap) {
    const parentPath = getParentSpecDir(dirPath, specDirs);
    if (parentPath) {
      const parentSpec = specMap.get(parentPath);
      if (parentSpec) {
        const conflicts = checkInheritanceConflicts(parentSpec, childSpec);
        for (const conflict of conflicts) {
          errors.push({
            code: 'E-SPEC-003',
            message: conflict.message,
            detail: `${childSpec.path} (child) vs ${parentSpec.path} (parent)`,
          });
        }
      }
    }
  }
}

/** Find the parent spec directory for a given directory */
function getParentSpecDir(dirPath: string, allDirs: string[]): string | undefined {
  // Go up the directory tree and find the nearest directory with .mumuspec/
  let current = dirPath;
  while (current) {
    const parent = current.substring(0, current.lastIndexOf('/'));
    const parentWithBackslash = current.substring(0, current.lastIndexOf('\\'));
    const parentDir = parent.length > parentWithBackslash.length ? parent : parentWithBackslash;

    if (!parentDir || parentDir === current) break;
    current = parentDir;

    if (allDirs.includes(current)) {
      return current;
    }
  }
  return undefined;
}

/** Get actual child directories that have .mumuspec/ */
function getActualChildSpecDirs(dirPath: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const childDir = join(dirPath, entry.name);
        if (existsSync(join(childDir, '.mumuspec'))) {
          results.push(childDir);
        }
      }
    }
  } catch {
    // Ignore
  }
  return results;
}

// ════════════════════════════════════════════════════════════════════
// Distributed Spec V2 Validation
// ════════════════════════════════════════════════════════════════════

/** Check if a prd.md uses V2 format (has doc_type: prd in frontmatter) */
function isV2Prd(content: string): boolean {
  const match = content.match(/^doc_type:\s*prd/m);
  return !!match;
}

/** Validate a prd.md file (only strict-checks V2-format files) */
function validatePrdFile(
  prdPath: string,
  _dirPath: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  try {
    const content = readText(prdPath);
    if (!content) {
      warnings.push({ code: 'E-SPEC-008', message: 'prd.md is empty', detail: prdPath });
      return;
    }

    // Only strict-validate V2-format prd.md (with doc_type: prd in frontmatter)
    // Old format (without doc_type) is grandfathered in for backward compatibility
    if (!isV2Prd(content)) {
      return;
    }

    const prd = parsePrdFile(content, prdPath);

    // Check for requirements (warn if none)
    const reqBlockCount = (content.match(/^##\s+Requirement:/gm) || []).length;
    if (reqBlockCount === 0) {
      warnings.push({
        code: 'E-SPEC-011',
        message: 'prd.md has no ## Requirement: blocks — constraints may not be machine-checkable',
        detail: prdPath,
      });
    }

    // Check frontmatter currency
    if (prd.layer == null || prd.layer < 0) {
      errors.push({
        code: 'E-SPEC-008',
        message: 'prd.md has invalid layer in frontmatter',
        detail: prdPath,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    errors.push({
      code: 'E-SPEC-008',
      message: `Invalid prd.md: ${errMsg}`,
      detail: prdPath,
    });
  }
}

/** Validate a tech.md file (only strict-checks V2-format files) */
function validateTechFile(
  techPath: string,
  _dirPath: string,
  strict: boolean,
  collectedItems: ClassifiedItem[],
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  try {
    const content = readText(techPath);
    if (!content) {
      warnings.push({ code: 'E-SPEC-009', message: 'tech.md is empty', detail: techPath });
      return;
    }

    // Only strict-validate V2-format tech.md (with doc_type: tech in frontmatter)
    const isV2Tech = /^doc_type:\s*tech/m.test(content);
    if (!isV2Tech) {
      return;
    }

    const tech = parseTechFile(content, techPath);

    // P0 verifier semantics: classify every SHALL/SHALL NOT item.
    // tech.md frontmatter carries no prohibitions annotations today (the
    // annotate command writes spec.md only) — honest empty channel set.
    const items = classifyRequirements(tech.requirements, [], techPath);
    collectedItems.push(...items);
    emitVerifiabilityFindings(items, strict, errors, warnings);

    // Warn if no Requirement blocks at all
    const reqBlockCount = (content.match(/^##\s+Requirement:/gm) || []).length;
    if (reqBlockCount === 0) {
      warnings.push({
        code: 'E-SPEC-011',
        message: 'tech.md has no ## Requirement: blocks — constraints may not be machine-checkable',
        detail: techPath,
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    errors.push({
      code: 'E-SPEC-009',
      message: `Invalid tech.md: ${errMsg}`,
      detail: techPath,
    });
  }
}

/**
 * Check that parent_prd / parent_tech references in tech.md / prd.md
 * point to existing files. Reports E-SPEC-010 if not.
 */
function checkParentReferences(
  allSpecFiles: { dir: string; file: DistSpecFile; path: string }[],
  errors: { code: string; message: string; detail?: string }[],
): void {
  for (const { file, path: specPath } of allSpecFiles) {
    if (file !== 'prd.md' && file !== 'tech.md') continue;

    try {
      const content = readText(specPath);
      if (!content) continue;

      const parentPrdMatch = content.match(/^parent_prd:\s*["']?([^"'\n]+)["']?$/m);
      const parentTechMatch = content.match(/^parent_tech:\s*["']?([^"'\n]+)["']?$/m);

      if (parentPrdMatch) {
        const parentPath = resolve(dirname(specPath), parentPrdMatch[1].trim());
        if (!existsSync(parentPath)) {
          errors.push({
            code: 'E-SPEC-010',
            message: `parent_prd "${parentPrdMatch[1].trim()}" not found (resolved: ${parentPath})`,
            detail: specPath,
          });
        }
      }

      if (parentTechMatch) {
        const parentPath = resolve(dirname(specPath), parentTechMatch[1].trim());
        if (!existsSync(parentPath)) {
          errors.push({
            code: 'E-SPEC-010',
            message: `parent_tech "${parentTechMatch[1].trim()}" not found (resolved: ${parentPath})`,
            detail: specPath,
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
}
