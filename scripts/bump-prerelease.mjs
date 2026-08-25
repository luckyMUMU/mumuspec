#!/usr/bin/env node
/**
 * bump-prerelease.mjs — Bump the prerelease segment of package.json version.
 *
 * Usage:
 *   node scripts/bump-prerelease.mjs alpha   # 0.12.1-alpha.0 -> 0.12.1-alpha.1
 *   node scripts/bump-prerelease.mjs beta    # 0.12.1-alpha.1 -> 0.12.1-beta.0
 *   node scripts/bump-prerelease.mjs rc      # 0.12.1-beta.2  -> 0.12.1-rc.0
 *
 * Behavior:
 *   - If the current version has NO prerelease tag, exit with error and ask
 *     the user to run `npm version <patch|minor|major>` first to establish
 *     a base, then `npm run version:alpha|beta|rc` to attach a prerelease.
 *   - If the current version already has the SAME prerelease tag, increment
 *     its numeric suffix by 1.
 *   - If switching tags (e.g. alpha -> beta), reset the numeric suffix to 0.
 *   - Updates package.json `version` field in place. Does not create a git
 *     tag — the release workflow tags explicitly via `npm version` or CI.
 *
 * Exit codes: 0 = success, 1 = usage / validation error.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VALID_TAGS = ['alpha', 'beta', 'rc'];
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');

const tag = process.argv[2];

if (!tag || !VALID_TAGS.includes(tag)) {
  console.error(
    `Usage: node scripts/bump-prerelease.mjs <${VALID_TAGS.join('|')}>`,
  );
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const current = pkg.version;

// Match SemVer: MAJOR.MINOR.PATCH[-prerelease][+build]
const semverMatch = current.match(
  /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+[a-zA-Z0-9.-]+)?$/,
);
if (!semverMatch) {
  console.error(`bump-prerelease: invalid version "${current}" in package.json`);
  process.exit(1);
}

const [, major, minor, patch, prerelease] = semverMatch;
const base = `${major}.${minor}.${patch}`;

if (!prerelease) {
  console.error(
    `bump-prerelease: current version "${current}" has no prerelease tag.\n` +
      `Run \`npm run version:${tag}\` after establishing a base with \`npm version <patch|minor|major>\`,\n` +
      `or manually set version to "${base}-${tag}.0" first.`,
  );
  process.exit(1);
}

// Parse existing prerelease: "<tag>.<n>" (e.g. "alpha.2") or just "<tag>".
const preParts = prerelease.split('.');
const preTag = preParts[0];
const preNum = preParts.length > 1 ? parseInt(preParts[1], 10) : 0;

if (!Number.isFinite(preNum)) {
  console.error(
    `bump-prerelease: cannot parse prerelease number from "${prerelease}"`,
  );
  process.exit(1);
}

// Switching tag resets counter to 0; same tag increments by 1.
const nextNum = preTag === tag ? preNum + 1 : 0;
const nextVersion = `${base}-${tag}.${nextNum}`;

pkg.version = nextVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

console.log(`bump-prerelease: ${current} -> ${nextVersion}`);
