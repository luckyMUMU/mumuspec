#!/usr/bin/env node
/**
 * prebuild-check.mjs — Sanity checks before `tsc` build.
 *
 * Run automatically via the `prebuild` npm script. Failures exit non-zero
 * so `npm run build` aborts before emitting broken artifacts.
 *
 * Checks:
 *   1. package.json `version` is valid SemVer.
 *   2. CLI version in src/cli/index.ts (or src/cli.ts as fallback) matches package.json version.
 *   3. All `files` entries in package.json exist on disk.
 *   4. All `bin` entry source files exist (src/cli.ts → src/cli/index.ts, src/mcp-server.ts).
 *
 * Exit codes: 0 = ok, 1 = check failed.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgPath = join(root, 'package.json');

let failed = false;
const fail = (msg) => {
  console.error(`prebuild-check: FAIL — ${msg}`);
  failed = true;
};

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

// 1. SemVer check.
const semverRe = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/;
if (!semverRe.test(pkg.version)) {
  fail(`package.json version "${pkg.version}" is not valid SemVer`);
}

// 2. CLI version sync. Preferred: CLI reads version from package.json at
//    runtime (constructed consistency — CHANGE-3 cannot drift). Fallback:
//    literal .version('...') in src/cli/index.ts (then src/cli.ts) must match.
const cliFile = join(root, 'src', 'cli.ts');
const cliIndexFile = join(root, 'src', 'cli', 'index.ts');

const cliIndexSrc = existsSync(cliIndexFile) ? readFileSync(cliIndexFile, 'utf8') : '';
const dynamicVersion = /package\.json['"]\s*,\s*import\.meta\.url/.test(cliIndexSrc);

if (dynamicVersion) {
  // Runtime read — version consistency is guaranteed by construction.
} else {
  let cliVerMatch = cliIndexSrc.match(/\.version\(['"]([^'"]+)['"]\)/);
  if (!cliVerMatch) {
    // Fallback: check legacy src/cli.ts
    const cliSrc = readFileSync(cliFile, 'utf8');
    cliVerMatch = cliSrc.match(/\.version\(['"]([^'"]+)['"]\)/);
  }

  if (!cliVerMatch) {
    fail(`src/cli.ts and src/cli/index.ts: cannot find .version('...') call`);
  } else if (cliVerMatch[1] !== pkg.version) {
    fail(
      `version mismatch: package.json=${pkg.version}, cli source=${cliVerMatch[1]}`,
    );
  }
}

// 3. files[] entries exist.
const files = pkg.files ?? [];
for (const f of files) {
  if (f.endsWith('/')) continue; // directory entry — checked via build
  const abs = join(root, f);
  if (!existsSync(abs)) {
    // Some entries (LICENSE, CHANGELOG.md) may not exist yet in early dev.
    // Warn but do not fail. Hard-required files should be added below.
    console.warn(`prebuild-check: WARN — files[] entry "${f}" missing on disk`);
  }
}

// 4. bin entry source files exist.
const bin = pkg.bin ?? {};
for (const binPath of Object.values(bin)) {
  // bin paths point to dist/, map back to src/ for the .ts source.
  const srcPath = binPath
    .replace(/^dist\//, 'src/')
    .replace(/\.js$/, '.ts');
  const abs = join(root, srcPath);
  if (!existsSync(abs)) {
    fail(`bin source "${srcPath}" not found (required by bin entry "${binPath}")`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`prebuild-check: OK (version=${pkg.version})`);
