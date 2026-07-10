import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecFile, GuardResult } from '../core/types.js';
import { parseSpecFile } from './parser.js';
import { checkInheritanceConflicts } from './inheritance.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText } from '../core/utils.js';

/** Validate all spec files in the project */
export function validateAllSpecs(
  projectRoot: string,
  config: MumuSpecConfig,
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  const specDirs = findAllSpecDirs(projectRoot);

  // Check max layer depth
  for (const dirPath of specDirs) {
    const specPath = join(dirPath, '.mumuspec', 'spec.md');
    if (!existsSync(specPath)) continue;

    try {
      const content = readText(specPath);
      if (!content) continue;

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

      // Check for enforcement on SHALL/SHALL NOT
      for (const req of spec.requirements) {
        const hasConstraints = req.shall.length > 0 || req.shallNot.length > 0;
        const hasEnforcement = req.enforcement.length > 0;
        if (hasConstraints && !hasEnforcement) {
          warnings.push({
            code: 'E-SPEC-004',
            message: `Requirement "${req.name}" has constraints but no Enforcement`,
            detail: specPath,
          });
        }
      }
    } catch (err) {
      errors.push({
        code: 'E-SPEC-001',
        message: `Invalid spec.md: ${(err as Error).message}`,
        detail: specPath,
      });
    }
  }

  // Check inheritance conflicts
  checkAllInheritance(specDirs, errors);

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
  };
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

/** Find all directories with .mumuspec/ */
function findAllSpecDirs(projectRoot: string): string[] {
  const results: string[] = [];

  function scan(dir: string) {
    const mumuDir = join(dir, '.mumuspec');
    if (existsSync(mumuDir)) {
      results.push(dir);
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(join(dir, entry.name));
        }
      }
    } catch {
      // Ignore
    }
  }

  scan(projectRoot);
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
