/**
 * Tests — metadata single-source alignment (freedom-metrics-loop-closure ENF-7 / ENF-8).
 *
 * The middle layer's own progress metadata must not drift. These assertions act
 * as the consistency checker (D4: no new runtime validator — that would recreate
 * the very defect this change fixes, an artifact with no consumer):
 *   - docs/STATUS.md declares itself the single authority on progress; its
 *     package version must therefore track package.json.
 *   - .mumuspec/config.yaml must not keep advertising rule targets that the
 *     generator hard-filters out (legacy .cursorrules / .windsurfrules).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function readText(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), 'utf8');
}

describe('STATUS.md ↔ package.json version alignment (ENF-7)', () => {
  it('declares the same package version as package.json', () => {
    const pkg = JSON.parse(readText('package.json')) as { version: string };
    const match = readText('docs/STATUS.md').match(/-\s*\*\*当前包版本\*\*:\s*(\S+)/);

    expect(match, 'STATUS.md 缺少「当前包版本」字段').not.toBeNull();
    expect(match![1]).toBe(pkg.version);
  });
});

describe('config.yaml legacy rule targets (ENF-8)', () => {
  it('does not advertise rule files that the generator refuses to emit', () => {
    const config = parseYaml(readText('.mumuspec/config.yaml')) as {
      ai?: { rules_files?: unknown };
    };

    const rulesFiles = config.ai?.rules_files;
    expect(Array.isArray(rulesFiles)).toBe(true);
    expect(rulesFiles as string[]).not.toContain('.cursorrules');
    expect(rulesFiles as string[]).not.toContain('.windsurfrules');
  });
});
