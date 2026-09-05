/**
 * Ponytail Linter — enforces the 7-level priority ladder.
 *
 * ponytail: reuses existing parsePonytailMarkers and PONYTAIL_LADDER.
 * No external deps — only Node.js built-ins.
 *
 * Rules:
 * - PONYTAIL-1: YAGNI — detect unnecessary abstraction patterns
 * - PONYTAIL-2: No new dependencies without justification
 * - PONYTAIL-3: No boilerplate code
 * - PONYTAIL-4: Boring over clever
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { parsePonytailMarkers } from '../spec/ponytail.js';

export interface PonytailLintResult {
  ruleId: string;
  severity: 'error' | 'warning';
  file: string;
  line: number;
  message: string;
  suggestion?: string;
}

/** Run ponytail lint rules on a project */
export function lintPonytail(projectRoot: string): PonytailLintResult[] {
  const results: PonytailLintResult[] = [];

  // PONYTAIL-2: Check for new dependencies without justification
  results.push(...checkNewDependencies(projectRoot));

  // PONYTAIL-1: Check for unnecessary abstractions in source files
  results.push(...checkAbstractions(projectRoot));

  return results;
}

/**
 * PONYTAIL-2: Check package.json for dependencies that may violate
 * the "no new deps" rule (Level 5 of the ladder).
 */
function checkNewDependencies(projectRoot: string): PonytailLintResult[] {
  const results: PonytailLintResult[] = [];
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return results;

  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return results;
  }

  // ponytail: minimal check — flag deps that could be replaced by stdlib
  const stdlibReplacements: Record<string, string> = {
    'lodash': 'Node.js standard library (Array/Object methods)',
    'underscore': 'Node.js standard library (Array/Object methods)',
    'chalk': 'Node.js util.styleText (Node 21+)',
    'uuid': 'crypto.randomUUID() (Node 19+)',
    'node-fetch': 'global fetch (Node 18+)',
    'axios': 'global fetch (Node 18+)',
    'mkdirp': 'fs.mkdirSync(path, { recursive: true })',
    'rimraf': 'fs.rmSync(path, { recursive: true })',
    'glob': 'fs.globSync() (Node 22+)',
  };

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [depName, version] of Object.entries(deps)) {
    const replacement = stdlibReplacements[depName];
    if (replacement) {
      results.push({
        ruleId: 'PONYTAIL-2',
        severity: 'warning',
        file: 'package.json',
        line: 1,
        message: `Dependency "${depName}@${version}" can be replaced by ${replacement}`,
        suggestion: `Consider removing "${depName}" and using ${replacement}`,
      });
    }
  }

  return results;
}

/**
 * PONYTAIL-1 & PONYTAIL-3: Check source files for unnecessary abstractions
 * and boilerplate patterns.
 * ponytail: simple heuristic checks — no AST parsing required.
 */
function checkAbstractions(projectRoot: string): PonytailLintResult[] {
  const results: PonytailLintResult[] = [];

  // Scan .ts files in src/ for common anti-patterns
  const srcDir = join(projectRoot, 'src');
  if (!existsSync(srcDir)) return results;

  const files = collectSourceFiles(srcDir, []);

  for (const filePath of files) {
    const ext = extname(filePath).toLowerCase();
    if (ext !== '.ts' && ext !== '.tsx' && ext !== '.js' && ext !== '.jsx') continue;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const relPath = filePath.replace(projectRoot + '\\', '').replace(projectRoot + '/', '').replace(/\\/g, '/');

    // Check for excessive abstraction (PONYTAIL-1)
    // ponytail: simple heuristics — count interface/class ratios
    const interfaceCount = (content.match(/^export\s+interface\s+/gm) || []).length;
    const classCount = (content.match(/^export\s+class\s+/gm) || []).length;
    const functionCount = (content.match(/^export\s+(?:async\s+)?function\s+/gm) || []).length;

    // Flag files with many interfaces but few implementations (over-abstraction)
    if (interfaceCount > 3 && functionCount === 0 && classCount === 0) {
      results.push({
        ruleId: 'PONYTAIL-1',
        severity: 'warning',
        file: relPath,
        line: 1,
        message: `File has ${interfaceCount} interfaces but no implementations (possible YAGNI violation)`,
        suggestion: 'Remove unused interfaces or implement them',
      });
    }

    // Check for boilerplate (PONYTAIL-3)
    // ponytail: detect getter/setter pairs that just forward to a field
    const getterSetterPattern = /get\s+(\w+)\(\)\s*{\s*return\s+this\.\1;\s*}\s*set\s+\1\((\w+)\)\s*{\s*this\.\1\s*=\s*\2;\s*}/g;
    const boilerplateMatches = content.match(getterSetterPattern);
    if (boilerplateMatches && boilerplateMatches.length > 2) {
      results.push({
        ruleId: 'PONYTAIL-3',
        severity: 'warning',
        file: relPath,
        line: 1,
        message: `${boilerplateMatches.length} trivial getter/setter pairs detected (boilerplate)`,
        suggestion: 'Use public fields instead of trivial getter/setter pairs',
      });
    }

    // Check that ponytail: markers have meaningful reasons (not just "lazy")
    const markers = parsePonytailMarkers(content, relPath);
    for (const marker of markers) {
      if (marker.reason.toLowerCase().includes('lazy') || marker.reason.length < 5) {
        results.push({
          ruleId: 'PONYTAIL-1',
          severity: 'warning',
          file: marker.file,
          line: marker.line,
          message: `ponytail: marker reason too vague: "${marker.reason}"`,
          suggestion: 'Provide a specific reason for the simplification',
        });
      }
    }

    // PONYTAIL-4: Boring over clever — detect unnecessarily complex patterns
    // ponytail: simple regex heuristics — no AST needed for these common patterns
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Nested ternary (a ? b ? c : d : e)
      if ((line.match(/\?/g) || []).length > 2 && line.includes('?') && !line.includes('//')) {
        results.push({
          ruleId: 'PONYTAIL-4',
          severity: 'warning',
          file: relPath,
          line: i + 1,
          message: 'Nested ternary operator detected — use if/else or separate statements',
          suggestion: 'Prefer explicit if/else for readability (boring over clever)',
        });
      }
      // Ternary where || would suffice (x ? x : y → x || y)
      if (/\b(\w+)\s*\?\s*\1\s*:/.test(line)) {
        results.push({
          ruleId: 'PONYTAIL-4',
          severity: 'warning',
          file: relPath,
          line: i + 1,
          message: 'Ternary with same operand — can be simplified to ||',
          suggestion: 'Use `||` operator instead of `x ? x : y`',
        });
      }
    }
  }

  return results;
}

/** Recursively collect source files (depth-limited) */
function collectSourceFiles(dir: string, accum: string[], depth: number = 0): string[] {
  if (depth > 6) return accum; // ponytail: max depth

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return accum;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === '.mumuspec') continue;
    const fullPath = join(dir, entry);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectSourceFiles(fullPath, accum, depth + 1);
      } else {
        accum.push(fullPath);
      }
    } catch {
      continue;
    }
  }

  return accum;
}
