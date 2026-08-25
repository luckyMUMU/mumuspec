#!/usr/bin/env node
/**
 * copy-assets.mjs — Copy non-TS assets from src/ to dist/ after `tsc` build.
 *
 * tsc (tsconfig include: src/**\/*.ts) does not copy .yaml files. CHG-6 moves
 * the workflow definition to src/change/workflow.default.yaml (single source
 * of truth); the runtime loader resolves it via import.meta.url relative to
 * the compiled module, so it MUST exist at dist/change/workflow.default.yaml.
 *
 * Failures exit non-zero so `npm run build` aborts before emitting a broken
 * package (same discipline as scripts/prebuild-check.mjs).
 */

import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 资产清单：src 相对路径 → dist 相对路径（保持目录结构一致）
const ASSETS = [
  { src: join('src', 'change', 'workflow.default.yaml'), dest: join('dist', 'change', 'workflow.default.yaml') },
];

let failed = false;

for (const asset of ASSETS) {
  const srcPath = join(root, asset.src);
  const destPath = join(root, asset.dest);

  if (!existsSync(srcPath)) {
    console.error(`copy-assets: FAIL — source missing: ${asset.src}`);
    failed = true;
    continue;
  }

  try {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    console.log(`copy-assets: ${asset.src} → ${asset.dest}`);
  } catch (err) {
    console.error(`copy-assets: FAIL — ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('copy-assets: all assets copied');
