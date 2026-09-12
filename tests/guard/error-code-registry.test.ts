/**
 * Error-code registry closure — every code the guard layer emits must exist in
 * `ERROR_CODES`.
 *
 * Why this test exists: `checkMetadataFor()` falls back to
 * `{ dimension: 'technical_design', min_strength: 'low' }` for unregistered
 * codes, so an unregistered emission is *silent* — the strength model treats it
 * as a code nobody configured, and `docs/reference/error-codes.md` (generated
 * from the registry) never mentions it. That is how eleven W-DESIGN-* codes
 * shipped unregistered while `E-DESIGN-001/002/009` sat registered-but-dead.
 *
 * The assertion is one-directional on purpose: a registered code with no
 * emission site is not automatically a defect (codes may be reserved), but an
 * emitted code with no registration always is.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ERROR_CODES } from '../../src/core/errors.js';
/**
 * Scanned layers. `spec` is included because it emits codes through the same
 * registry/doc pipeline — `detectConstraintSourceDrift` (constraint-provenance.ts)
 * emits `E-CONSTRAINT-001/002` and `W-CONSTRAINT-003` into `mumuspec check`'s
 * drift array. The invariant is about the *pipeline*, not about one directory.
 */
const SCAN_DIRS = ['guard', 'spec'].map((d) => join(process.cwd(), 'src', d));

function emittedCodes(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const dir of SCAN_DIRS) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const text = readFileSync(join(dir, file), 'utf8');
      // Matches `code: 'E-X-NNN'` / `code: "W-X-NNN"` literals.
      for (const m of text.matchAll(/code:\s*['"]([EW]-[A-Z]+(?:-[A-Z]+)?-\d{3})['"]/g)) {
        const list = found.get(m[1]) ?? [];
        const label = `${basename(dir)}/${file}`;
        if (!list.includes(label)) list.push(label);
        found.set(m[1], list);
      }
    }
  }
  return found;
}

describe('guard/spec error codes are registered', () => {
  it('every code literal in src/guard and src/spec is present in ERROR_CODES', () => {
    const missing: string[] = [];
    for (const [code, files] of emittedCodes()) {
      if (!ERROR_CODES[code]) missing.push(`${code} (${files.join(', ')})`);
    }
    expect(missing).toEqual([]);
  });

  it('the registry covers the design advisory family the guards emit', () => {
    // Regression guard for the specific gap this test was written for.
    for (let i = 1; i <= 11; i++) {
      const code = `W-DESIGN-${String(i).padStart(3, '0')}`;
      expect(ERROR_CODES[code], `${code} must be registered`).toBeDefined();
      expect(ERROR_CODES[code].severity).toBe('WARN');
    }
  });

  it('the generated reference doc lists every registered code', () => {
    // `scripts/gen-error-codes-doc.mjs` used to match only `E-`-prefixed keys
    // and hardcode `E-` when rendering, so every `W-` code was silently absent
    // from the doc (and `npm run ci:check` could not see the drift either).
    // This asserts the committed artifact against the registry.
    const doc = readFileSync(join(process.cwd(), 'docs', 'reference', 'error-codes.md'), 'utf8');
    const undocumented = Object.keys(ERROR_CODES).filter((code) => !doc.includes(`\`${code}\``));
    expect(undocumented).toEqual([]);
  });
});
