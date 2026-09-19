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
import { spawnSync } from 'node:child_process';
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

// Check config.yaml schema version.
//
// `.mumuspec/config.yaml` carries a **schema** version (canonical field:
// `schema_version`, see `saveConfig()` in src/core/config-io.ts), NOT the
// package version. Comparing it to `package.json` was a category error: the two
// numbers are unrelated, so the warning could never legitimately be cleared —
// a permanently-amber signal trains readers to ignore the whole warning channel.
const configPath = join(root, '.mumuspec/config.yaml');
const schemaSrcPath = join(root, 'src/core/schema-version.ts');
if (existsSync(configPath)) {
  // Single source of truth: read the expected value out of the TypeScript
  // module rather than duplicating the constant here.
  let expectedSchemaVersion = null;
  if (existsSync(schemaSrcPath)) {
    const schemaSrc = readFileSync(schemaSrcPath, 'utf8');
    const m = schemaSrc.match(/config:\s*'([^']+)'/);
    if (m) expectedSchemaVersion = m[1];
  }

  const configYaml = readFileSync(configPath, 'utf8');
  const schemaVersionMatch = configYaml.match(/^schema_version:\s*([0-9][0-9.]*(?:-[a-z0-9.]+)?)/m);
  const legacyVersionMatch = configYaml.match(/^version:\s*([0-9][0-9.]*(?:-[a-z0-9.]+)?)/m);

  if (schemaVersionMatch) {
    if (!expectedSchemaVersion || schemaVersionMatch[1] === expectedSchemaVersion) {
      pass(`.mumuspec/config.yaml schema_version matches CURRENT_SCHEMA_VERSION.config: ${schemaVersionMatch[1]}`);
    } else {
      fail(`config.yaml schema_version (${schemaVersionMatch[1]}) ≠ CURRENT_SCHEMA_VERSION.config (${expectedSchemaVersion})`);
    }
  } else if (legacyVersionMatch) {
    warn(
      `config.yaml 是遗留格式（无 schema_version，仅有 version: ${legacyVersionMatch[1]}）。` +
        `该字段是**配置 schema 版本**，与 package.json 版本无关，本检查不再把两者相比。` +
        `运行 \`mumuspec sync --migrate\` 可补齐 schema_version。`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Check 1.5: STATUS.md Assertion Reconciliation (enforcement-gap L2)
// ═══════════════════════════════════════════════════════════════
console.log('\n📐 STATUS Assertion Reconciliation (E-DRIFT-016)\n');

{
  const cli = join(root, 'dist', 'cli.js');
  if (existsSync(cli)) {
    let payload = null;
    try {
      const out = spawnSync(process.execPath, [cli, 'check', '--json'], { cwd: root, encoding: 'utf8', timeout: 60_000 });
      payload = JSON.parse(out.stdout);
    } catch {
      warn('STATUS 对账跳过：check --json 不可解析（先 npm run build）');
    }
    if (payload?.drift) {
      const conflicts = [...(payload.drift.errors ?? []), ...(payload.drift.warnings ?? [])]
        .filter((d) => d.type === 'status_assertion' && d.code === 'E-DRIFT-016');
      if (conflicts.length === 0) {
        pass('STATUS.md 机器可核断言与仓库事实一致');
      } else {
        for (const c of conflicts) fail(`STATUS 断言矛盾: ${c.message}`);
      }
    }
  } else {
    warn('STATUS 对账跳过：dist/cli.js 不存在（先 npm run build）');
  }
}

// ═══════════════════════════════════════════════════════════════
// Check 2: Error Code Documentation Drift
// ═══════════════════════════════════════════════════════════════
console.log('\n📚 Error Code Documentation Drift Check\n');

// Extract error codes from errors.ts
// Prefix is not a filter: the registry holds advisory codes under both `E-`
// (legacy, severity WARN) and `W-` (current). Matching only `E-` here made the
// drift check blind to every `W-` code.
const errorsContent = readFileSync(join(root, 'src/core/errors.ts'), 'utf8');
const codeMatches = errorsContent.matchAll(/'([EW]-\w+-\d+)':\s*\{/g);
const sourceCodes = new Set();
for (const m of codeMatches) {
  sourceCodes.add(m[1]);
}

// Extract error codes from documentation
const docContent = readFileSync(join(root, 'docs/reference/error-codes.md'), 'utf8');
const docCodeMatches = docContent.matchAll(/`([EW]-\w+-\d+)`/g);
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
// Check 4: Spec Enforcement Gate (check + validate as hard CI gates)
// ═══════════════════════════════════════════════════════════════
console.log('\n🛡️  Spec Enforcement Gate\n');

const cliPath = join(root, 'dist', 'cli.js');

// Run one engine gate and parse its --json report from stdout.
// Fail-closed: missing dist, spawn failure, timeout, or unparseable output
// all count as errors — an undecidable gate result must never read as green.
function runEngineGate(label, args) {
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    cwd: root,
    timeout: 120_000,
  });
  const out = (res.stdout || '');
  const jsonStart = out.indexOf('{');
  if (jsonStart === -1) {
    const reason = res.error ? res.error.message : (res.stderr || '').trim().split('\n').pop() || `exit ${res.status}`;
    fail(`[${label}] 无法获得可判定结论（${reason}）`);
    return;
  }
  let report;
  try {
    report = JSON.parse(out.slice(jsonStart));
  } catch (err) {
    fail(`[${label}] JSON 解析失败（${err.message}）`);
    return;
  }
  // Schema note: `check --json` = { compliance:{errors,warnings}, drift:{errors,warnings}, exitCode };
  // `validate --json` = { errors, warnings, ... }. Normalize both.
  const errors = [
    ...(report.compliance?.errors ?? []),
    ...(report.drift?.errors ?? []),
    ...(report.errors ?? []),
  ];
  const warnings = [
    ...(report.compliance?.warnings ?? []),
    ...(report.drift?.warnings ?? []),
    ...(report.warnings ?? []),
  ];
  for (const e of errors) {
    fail(`[${label}] ${e.code || e.type || 'UNKNOWN'} ${e.message || ''}`);
  }
  for (const w of warnings) {
    warn(`[${label}] ${w.code || 'UNKNOWN'} ${w.message || ''}`);
  }
  // exitCode is authoritative: an engine-reported failure with no parseable
  // error detail must still fail the gate (undecidable ≠ green).
  if (errors.length === 0) {
    const exit = report.exitCode ?? res.status;
    if (exit !== 0) {
      fail(`[${label}] 引擎退出码 ${exit} 但未解析到错误明细 — 按失败处理`);
    } else {
      pass(`${label}: 0 error(s), ${warnings.length} warning(s)`);
    }
  }
}

if (!existsSync(cliPath)) {
  fail(`dist/cli.js 不存在 — spec 强制门禁不可静默跳过，先运行 npm run build`);
} else {
  runEngineGate('check', ['check', '--json']);
  runEngineGate('validate', ['validate', '--json']);
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
