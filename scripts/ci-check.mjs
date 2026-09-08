#!/usr/bin/env node
/**
 * CI Pipeline Checks — Version Consistency & Documentation Drift Detection
 * 
 * Runs in CI to prevent:
 * 1. Version number inconsistencies
 * 2. Error code documentation drift
 * 3. README/product claim mismatches
 * 
 * Usage: node scripts/ci-check.mjs [--strict]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  warnings++;
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

// ═══════════════════════════════════════════════════════════════
// Check 1: Version Consistency
// ═══════════════════════════════════════════════════════════════
console.log('\n📦 Version Consistency Check\n');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const pkgVersion = pkg.version;

// Check README version
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const readmeVersionMatch = readme.match(/当前版本[：:]\s*[*]*([0-9][0-9.]*(?:-[a-z0-9.]+)?)[*]*/);
if (readmeVersionMatch) {
  if (readmeVersionMatch[1] === pkgVersion) {
    pass(`README version matches package.json: ${pkgVersion}`);
  } else {
    fail(`README version (${readmeVersionMatch[1]}) ≠ package.json version (${pkgVersion})`);
  }
} else {
  warn('Could not find version in README.md');
}

// Check STATUS.md version
const statusPath = join(root, 'docs/STATUS.md');
if (existsSync(statusPath)) {
const status = readFileSync(statusPath, 'utf8');
const statusVersionMatch = status.match(/当前包版本\**[：:]\s*[*]*([0-9][0-9.]*(?:-[a-z0-9.]+)?)[*]*/m);
if (statusVersionMatch) {
  if (statusVersionMatch[1] === pkgVersion) {
    pass(`STATUS.md version matches package.json: ${pkgVersion}`);
  } else {
    fail(`STATUS.md version (${statusVersionMatch[1]}) ≠ package.json version (${pkgVersion})`);
  }
} else {
  warn('Could not find version in STATUS.md');
}
} else {
  fail('docs/STATUS.md not found');
}

// Check config.yaml version
const configPath = join(root, '.mumuspec/config.yaml');
if (existsSync(configPath)) {
const configYaml = readFileSync(configPath, 'utf8');
const configVersionMatch = configYaml.match(/^version:\s*([0-9][0-9.]*(?:-[a-z0-9.]+)?)/m);
if (configVersionMatch) {
  if (configVersionMatch[1] === pkgVersion) {
    pass(`.mumuspec/config.yaml version matches package.json: ${pkgVersion}`);
  } else {
    warn(`config.yaml version (${configVersionMatch[1]}) ≠ package.json version (${pkgVersion}) — config version may lag intentionally`);
  }
}
}

// ═══════════════════════════════════════════════════════════════
// Check 2: Error Code Documentation Drift
// ═══════════════════════════════════════════════════════════════
console.log('\n📚 Error Code Documentation Drift Check\n');

// Extract error codes from errors.ts
const errorsContent = readFileSync(join(root, 'src/core/errors.ts'), 'utf8');
const codeMatches = errorsContent.matchAll(/'(E-\w+-\d+)':\s*\{/g);
const sourceCodes = new Set();
for (const m of codeMatches) {
  sourceCodes.add(m[1]);
}

// Extract error codes from documentation
const docContent = readFileSync(join(root, 'docs/reference/error-codes.md'), 'utf8');
const docCodeMatches = docContent.matchAll(/`(E-\w+-\d+)`/g);
const docCodes = new Set();
for (const m of docCodeMatches) {
  docCodes.add(m[1]);
}

// Detect drift
let driftDetected = false;
for (const code of sourceCodes) {
  if (!docCodes.has(code)) {
    fail(`Error code ${code} exists in source but missing from documentation`);
    driftDetected = true;
  }
}
for (const code of docCodes) {
  if (!sourceCodes.has(code)) {
    fail(`Error code ${code} exists in documentation but missing from source`);
    driftDetected = true;
  }
}
if (!driftDetected) {
  pass(`All ${sourceCodes.size} error codes are documented`);
}

// Check for auto-generated header
if (docContent.includes('Auto-generated')) {
  pass('Documentation has auto-generated header');
} else {
  warn('Documentation missing auto-generated header — run `npm run gen:error-codes`');
}

// ═══════════════════════════════════════════════════════════════
// Check 3: Changelog Completeness
// ═══════════════════════════════════════════════════════════════
console.log('\n📝 Changelog Completeness Check\n');

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const changelogVersions = changelog.matchAll(/^##?\s+\[?([0-9][0-9.]*(?:-[a-z0-9.]+)?)\]?/gm);
const changelogVersionSet = new Set();
for (const m of changelogVersions) {
  changelogVersionSet.add(m[1]);
}

// Check that the current version or recent versions are in changelog
if (changelogVersionSet.has(pkgVersion)) {
  pass(`CHANGELOG has entry for current version ${pkgVersion}`);
} else {
  warn(`CHANGELOG missing entry for current version ${pkgVersion}`);
}

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`\nResults: ${errors} error(s), ${warnings} warning(s)\n`);

if (errors > 0) {
  console.error('❌ CI checks FAILED');
  process.exit(1);
} else if (warnings > 0) {
  console.log('⚠️  CI checks passed with warnings');
  process.exit(0);
} else {
  console.log('✅ All CI checks passed');
  process.exit(0);
}
