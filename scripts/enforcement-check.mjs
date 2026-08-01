#!/usr/bin/env node
/**
 * enforcement-check.mjs — Automated enforcement rule scanner.
 *
 * Implements the lint rules defined in .mumuspec/spec.md Enforcement section:
 *   PONYTAIL-1: detect unnecessary abstraction patterns (YAGNI)
 *   PONYTAIL-2: check for unnecessary new dependencies
 *   PONYTAIL-3: detect boilerplate code patterns
 *   PONYTAIL-4: detect overly clever solutions
 *   STRUCT-1: spec.md frontmatter validation (layer, scope, last_updated)
 *   STRUCT-2: SHALL must have corresponding Enforcement entry
 *   CHANGE-3: package.json ↔ src/cli.ts version consistency
 *   ENV-3: env-spec.md format check (frontmatter + SHALL/SHALL NOT + Detected)
 *
 * Usage: node scripts/enforcement-check.mjs [--strict]
 *   --strict  — treat warnings as errors (CI mode)
 *
 * Exit codes: 0 = all passed, 1 = errors found
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const STRICT = process.argv.includes('--strict');

let errors = 0;
let warnings = 0;
const report = (level, code, message) => {
  if (level === 'error') {
    console.error(`  [${code}] FAIL — ${message}`);
    errors++;
  } else {
    console.warn(`  [${code}] WARN — ${message}`);
    warnings++;
  }
};

// ══════════════════════════════════════════════════════════════
// PONYTAIL-1: Detect unnecessary abstraction (YAGNI)
// ══════════════════════════════════════════════════════════════
function checkPonytail1(srcDir) {
  console.log('\n[PONYTAIL-1] YAGNI — unnecessary abstraction scan');

  const unnecessaryPatterns = [
    { pattern: /class\s+\w+Factory\s*{/, desc: 'Factory class without clear multi-product need' },
    { pattern: /class\s+\w+Manager\s*extends\s+\w+Manager\s*{/, desc: 'Inheritance from another Manager (possible over-abstraction)' },
    { pattern: /interface\s+\w+Repository\s*{[^}]*getById/, desc: 'Repository interface for single-entity CRUD (use direct import)' },
  ];

  const tsFiles = listFiles(srcDir, '.ts');
  for (const file of tsFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      for (const { pattern, desc } of unnecessaryPatterns) {
        if (pattern.test(content)) {
          const relPath = file.replace(root + '\\', '/');
          report('warn', 'PONYTAIL-1', `${relPath}: ${desc}`);
        }
      }
    } catch {
      // skip unreadable files
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PONYTAIL-2: Check for unnecessary new dependencies in zero-dep modules
// ══════════════════════════════════════════════════════════════
function checkPonytail2(srcDir) {
  console.log('\n[PONYTAIL-2] Unnecessary external dependencies in zero-dep modules');

  const zeroDepModules = ['install', 'bundle', 'i18n', 'skill-authoring'];

  for (const mod of zeroDepModules) {
    const modDir = join(srcDir, mod);
    if (!existsSync(modDir)) continue;

    const files = listFiles(modDir, '.ts');
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        // Look for import from external packages (not node: or relative)
        const externalImports = content.match(/from\s+['"](?!node:)(?!\.)([^'"]+)['"]/g);
        if (externalImports) {
          for (const imp of externalImports) {
            const pkgName = imp.replace(/from\s+['"](.+)['"]/, '$1').split('/')[0];
            const relPath = file.replace(root + '\\', '/');
            report('error', 'PONYTAIL-2', `${relPath}: zero-dep module imports external pkg "${pkgName}"`);
          }
        }
      } catch {
        // skip
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PONYTAIL-3: Detect boilerplate code patterns
// ══════════════════════════════════════════════════════════════
function checkPonytail3(srcDir) {
  console.log('\n[PONYTAIL-3] Boilerplate code detection');

  const tsFiles = listFiles(srcDir, '.ts');
  for (const file of tsFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      // Empty function bodies that just throw "not implemented"
      if (/throw new Error\(['"]not implemented['"]\)/i.test(content)) {
        const relPath = file.replace(root + '\\', '/');
        report('warn', 'PONYTAIL-3', `${relPath}: contains "throw new Error(\'not implemented\')" placeholder`);
      }
      // Redundant TypeScript return annotations on simple arrow functions
      const redundantReturn = content.match(/\)\s*=>\s*\w+\s*as\s+\w+/g);
      if (redundantReturn && redundantReturn.length > 3) {
        const relPath = file.replace(root + '\\', '/');
        report('warn', 'PONYTAIL-3', `${relPath}: ${redundantReturn.length} redundant "as" type assertions (consider inference)`);
      }
    } catch {
      // skip
    }
  }
}

// ══════════════════════════════════════════════════════════════
// PONYTAIL-4: Detect overly clever solutions
// ══════════════════════════════════════════════════════════════
function checkPonytail4(srcDir) {
  console.log('\n[PONYTAIL-4] Overly clever solutions detection');

  const tsFiles = listFiles(srcDir, '.ts');
  for (const file of tsFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      // Nested ternary beyond 2 levels
      const nestedTernary = content.match(/\?\s*\w+\s*:\s*\(?\s*\w+\s*\?\s*\w+\s*:/g);
      if (nestedTernary) {
        const relPath = file.replace(root + '\\', '/');
        report('warn', 'PONYTAIL-4', `${relPath}: nested ternary operators (consider if/else for clarity)`);
      }
      // Bitwise operators in non-performance-critical modules
      if ((/~\w+/.test(content) || /\|= 0/.test(content))
        && !file.includes('bundle') && !file.includes('packager')) {
        const relPath = file.replace(root + '\\', '/');
        report('warn', 'PONYTAIL-4', `${relPath}: bitwise operators in non-performance-critical module`);
      }
    } catch {
      // skip
    }
  }
}

// ══════════════════════════════════════════════════════════════
// STRUCT-1: spec.md frontmatter validation
// ══════════════════════════════════════════════════════════════
function checkStruct1() {
  console.log('\n[STRUCT-1] spec.md frontmatter validation');

  const specFiles = findFiles(join(root, '.mumuspec'), 'spec.md');
  for (const file of specFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        report('error', 'STRUCT-1', `${file}: missing YAML frontmatter`);
        continue;
      }
      const fm = frontmatterMatch[1];

      // Check layer field
      if (!/layer:\s*\d+/.test(fm)) {
        report('error', 'STRUCT-1', `${file}: frontmatter missing "layer: <number>"`);
      }
      // Check scope field
      if (!/scope:\s*["']?([^"'\n]+)["']?/.test(fm)) {
        report('warn', 'STRUCT-1', `${file}: frontmatter missing "scope"`);
      }
      // Check last_updated field
      if (!/last_updated:\s*["']?\d{4}-\d{2}-\d{2}["']?/.test(fm)) {
        report('warn', 'STRUCT-1', `${file}: frontmatter missing valid "last_updated: YYYY-MM-DD"`);
      }
    } catch {
      report('error', 'STRUCT-1', `${file}: failed to read`);
    }
  }
}

// ══════════════════════════════════════════════════════════════
// STRUCT-2: SHALL must have corresponding Enforcement entry
// ══════════════════════════════════════════════════════════════
function checkStruct2() {
  console.log('\n[STRUCT-2] SHALL ↔ Enforcement correspondence check');

  const specFiles = findFiles(join(root, '.mumuspec'), 'spec.md');
  for (const file of specFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      const relPath = file.replace(root + '\\', '/');

      // Count SHALL entries (lines starting with "- " under a SHALL section)
      const shallMatches = content.match(/^[-*]\s+\*\*(?:SHALL|必须)/gm) || [];
      const shallCount = shallMatches.length;

      // Count Enforcement entries
      const enforcementMatches = content.match(/^[-*]\s+\w+-\d+: Enforcement/gm) ||
                                  content.match(/^[-*]\s+\w+-\d+:\s*\*\*/gm) || [];
      const enforcementCount = enforcementMatches.length;

      if (shallCount > 0 && enforcementCount === 0) {
        report('error', 'STRUCT-2', `${relPath}: ${shallCount} SHALL rules but zero Enforcement entries`);
      } else if (shallCount > enforcementCount) {
        report('warn', 'STRUCT-2', `${relPath}: ${shallCount} SHALL vs ${enforcementCount} Enforcement entries`);
      }
    } catch {
      // skip
    }
  }
}

// ══════════════════════════════════════════════════════════════
// CHANGE-3: package.json ↔ src/cli.ts version consistency
// ══════════════════════════════════════════════════════════════
function checkChange3() {
  console.log('\n[CHANGE-3] Version consistency check');

  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const cliSrc = readFileSync(join(root, 'src', 'cli.ts'), 'utf8');
  const cliVerMatch = cliSrc.match(/\.version\(['"]([^'"]+)['"]\)/);

  if (!cliVerMatch) {
    report('error', 'CHANGE-3', 'src/cli.ts: cannot find .version() call');
  } else if (cliVerMatch[1] !== pkg.version) {
    report('error', 'CHANGE-3', `version mismatch: package.json=${pkg.version}, cli.ts=${cliVerMatch[1]}`);
  }
}

// ══════════════════════════════════════════════════════════════
// ENV-3: env-spec.md format check
// ══════════════════════════════════════════════════════════════
function checkEnv3() {
  console.log('\n[ENV-3] env-spec.md format check');

  const envSpecPath = join(root, '.mumuspec', 'env-spec.md');
  if (!existsSync(envSpecPath)) {
    console.log('  SKIP — env-spec.md does not exist (optional file)');
    return;
  }

  const content = readFileSync(envSpecPath, 'utf8');

  // Check type: environment frontmatter
  if (!/type:\s*environment/.test(content)) {
    report('error', 'ENV-3', 'env-spec.md: frontmatter missing "type: environment"');
  }
  // Check SHALL section exists
  if (!/##?\s*SHALL/i.test(content)) {
    report('warn', 'ENV-3', 'env-spec.md: SHALL section missing');
  }
  // Check SHALL NOT section exists
  if (!/##?\s*SHALL\s*NOT/i.test(content)) {
    report('warn', 'ENV-3', 'env-spec.md: SHALL NOT section missing');
  }
  // Check Detected section exists
  if (!/##?\s*Detected/i.test(content)) {
    report('warn', 'ENV-3', 'env-spec.md: Detected section missing');
  }
}

// ══════════════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════════════
function listFiles(dir, ext) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'changes') continue;
        results.push(...listFiles(full, ext));
      } else if (entry.endsWith(ext)) {
        results.push(full);
      }
    }
  } catch {
    // skip
  }
  return results;
}

function findFiles(dir, name) {
  if (!existsSync(dir)) return [];
  const results = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'changes') continue;
        results.push(...findFiles(full, name));
      } else if (entry === name && !full.includes(`${join('changes', '')}`)) {
        results.push(full);
      }
    }
  } catch {
    // skip
  }
  return results;
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════
console.log('═'.repeat(60));
console.log('  Enforcement Check — MumuSpec');
console.log('═'.repeat(60));

const srcDir = join(root, 'src');

checkPonytail1(srcDir);
checkPonytail2(srcDir);
checkPonytail3(srcDir);
checkPonytail4(srcDir);
checkStruct1();
checkStruct2();
checkChange3();
checkEnv3();

console.log('\n' + '═'.repeat(60));
console.log(`  Results: ${errors} error(s), ${warnings} warning(s)`);
console.log('═'.repeat(60));

if (errors > 0 || (STRICT && warnings > 0)) {
  process.exit(1);
}
process.exit(0);
