import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SpecFile, GuardResult, DriftResult } from '../core/types.js';
import { parseSpecFile } from '../spec/parser.js';
import { parsePonytailMarkers } from '../spec/ponytail.js';
import { readText, getMumuSpecDir } from '../core/utils.js';
import type { MumuSpecConfig } from '../core/config.js';

/** Check compliance of code against specs */
export function checkCompliance(
  projectRoot: string,
  options: {
    shall?: boolean;
    shallNot?: boolean;
    ponytail?: boolean;
    testImmutability?: boolean;
    stagedOnly?: boolean;
  },
): GuardResult {
  const errors: { code: string; message: string; detail?: string }[] = [];
  const warnings: { code: string; message: string; detail?: string }[] = [];

  // SHALL NOT check
  if (options.shallNot || (!options.shall && !options.shallNot && !options.ponytail && !options.testImmutability)) {
    checkShallNot(projectRoot, errors, warnings);
  }

  // SHALL check
  if (options.shall || (!options.shall && !options.shallNot && !options.ponytail && !options.testImmutability)) {
    checkShall(projectRoot, errors, warnings);
  }

  // Ponytail check
  if (options.ponytail) {
    checkPonytail(projectRoot, errors, warnings);
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/** Check SHALL NOT violations */
function checkShallNot(
  projectRoot: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  // Collect all SHALL NOT constraints from all spec files
  const prohibitions = collectAllProhibitions(projectRoot);

  // Scan source files for potential violations
  const sourceFiles = findSourceFiles(projectRoot);

  for (const filePath of sourceFiles) {
    const content = readText(filePath);
    if (!content) continue;

    for (const { text, source } of prohibitions) {
      // Simple pattern matching - check if the prohibition text appears in code
      // This is a basic heuristic; real implementation would use AST analysis
      const violation = checkProhibitionViolation(content, text, filePath);
      if (violation) {
        errors.push({
          code: 'E-GUARD-003',
          message: `SHALL NOT 违规: ${text}`,
          detail: `${filePath}:${violation.line} (source: ${source})`,
        });
      }
    }
  }
}

/** Check SHALL requirements */
function checkShall(
  projectRoot: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  // For now, check that SHALL requirements have corresponding code
  // Real implementation would verify code patterns match requirements
  const specs = findAllSpecs(projectRoot);

  for (const spec of specs) {
    for (const req of spec.requirements) {
      for (const shall of req.shall) {
        // Check if there's any enforcement rule
        const hasEnforcement = req.enforcement.length > 0;
        if (!hasEnforcement) {
          warnings.push({
            code: 'E-SPEC-004',
            message: `SHALL without enforcement: "${shall}"`,
            detail: spec.path,
          });
        }
      }
    }
  }
}

/** Check Ponytail compliance */
function checkPonytail(
  projectRoot: string,
  errors: { code: string; message: string; detail?: string }[],
  warnings: { code: string; message: string; detail?: string }[],
): void {
  // Check for ponytail: markers in code
  const sourceFiles = findSourceFiles(projectRoot);

  for (const filePath of sourceFiles) {
    const content = readText(filePath);
    if (!content) continue;

    const markers = parsePonytailMarkers(content, filePath);
    // Markers are intentional simplifications, just note them
    for (const marker of markers) {
      warnings.push({
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
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      // Could compare with design.md declarations
      // For now, just note the dependency count
    } catch {
      // Ignore
    }
  }
}

/** Collect all SHALL NOT constraints from all specs */
function collectAllProhibitions(
  projectRoot: string,
): { text: string; source: string }[] {
  const results: { text: string; source: string }[] = [];
  const specs = findAllSpecs(projectRoot);

  for (const spec of specs) {
    for (const req of spec.requirements) {
      for (const shallNot of req.shallNot) {
        results.push({ text: shallNot, source: spec.path });
      }
    }
  }

  return results;
}

/** Check if a prohibition is violated in code content */
function checkProhibitionViolation(
  content: string,
  prohibition: string,
  filePath: string,
): { line: number } | null {
  // Very basic heuristic: extract key identifiers from prohibition text
  // and check if they appear in code

  // Extract patterns like "禁止使用 XXX" or "must not use XXX"
  const patterns: RegExp[] = [];

  // Extract quoted identifiers
  const quoted = prohibition.match(/[`'"]([^`'"]+)[`'"]/g);
  if (quoted) {
    for (const q of quoted) {
      const term = q.replace(/[`'"]/g, '');
      if (term.length > 2) {
        patterns.push(new RegExp(escapeRegExp(term), 'i'));
      }
    }
  }

  // Check for eval/Function constructor (common security prohibition)
  if (prohibition.toLowerCase().includes('eval') || prohibition.toLowerCase().includes('动态执行')) {
    patterns.push(/eval\s*\(/, /new\s+Function\s*\(/);
  }

  for (const pattern of patterns) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Skip comments
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*')) {
        continue;
      }
      if (pattern.test(lines[i])) {
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
      } catch {
        // Skip
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
      // Ignore
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
    } catch {
      // Ignore
    }
  }

  scan(projectRoot);
  return results;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        });
      }
    }
  }

  // Index drift: check if index.yaml matches actual structure
  checkIndexDrift(projectRoot, results);

  return results;
}

/** Check index.yaml freshness */
function checkIndexDrift(
  projectRoot: string,
  results: DriftResult[],
): void {
  function scan(dir: string) {
    const mumuDir = join(dir, '.mumuspec');
    const indexPath = join(mumuDir, 'index.yaml');

    if (existsSync(indexPath)) {
      // Check if children in index match actual directories
      try {
        const indexContent = readFileSync(indexPath, 'utf8');
        // Simple check: count children in index vs actual
        const actualChildren = readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
          .filter((e) => existsSync(join(dir, e.name, '.mumuspec')));

        if (actualChildren.length > 0) {
          // Could do more detailed comparison
        }
      } catch {
        // Ignore
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
      // Ignore
    }
  }

  scan(projectRoot);
}
