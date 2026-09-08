/**
 * Architecture boundary gate — Phase 3.1
 *
 * Invariant: src/core is the shared infrastructure layer and MUST NOT
 * import from any upper-layer domain (change / cli / eval / guard /
 * knowledge / spec / ...). Upper layers depend on core, never the reverse.
 *
 * This test statically scans all TS files under src/core (recursive) and
 * fails on any relative import that resolves outside src/core. Runtime dependencies are
 * unaffected (no mocking); it is a pure source-tree invariant check.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const CORE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/core');

/** Recursively collect all .ts files under a directory. */
function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTsFiles(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Extract relative static import specifiers from source text. */
function extractRelativeImports(text: string): string[] {
  const specs: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1].startsWith('.')) specs.push(m[1]);
  }
  // Side-effect / bare dynamic-style: import './x.js'
  const bare = /\bimport\s+['"](\.[^'"]+)['"]/g;
  while ((m = bare.exec(text)) !== null) {
    specs.push(m[1]);
  }
  return specs;
}

describe('architecture: core layer boundaries', () => {
  it('src/core must not import from upper-layer domains', () => {
    const violations: string[] = [];

    for (const file of collectTsFiles(CORE_DIR)) {
      const text = readFileSync(file, 'utf-8');
      for (const spec of extractRelativeImports(text)) {
        const target = resolve(dirname(file), spec);
        const rel = relative(CORE_DIR, target);
        // Escapes src/core if the resolved target is not inside it
        if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
          violations.push(`${relative(CORE_DIR, file)} -> ${spec}`);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `core 层出现 ${violations.length} 处越界导入（上层域依赖 core，反向禁止）：\n` +
          violations.map((v) => `  - ${v}`).join('\n')
      );
    }
  });
});
