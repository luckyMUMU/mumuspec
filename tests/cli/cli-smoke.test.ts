import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
// ponytail: import the in-process command tree so we can assert structural
// invariants directly, instead of relying on --help crash-as-guard.
import { buildProgram } from '../../src/cli/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// ponytail: smoke test targets the built artifact (dist/cli.js) so it catches
// end-to-end regressions that unit tests — which register commands module-by-module —
// never assemble. This is the exact gap that let the R1/R2 'check' collision ship broken.
const root = resolve(__dirname, '..', '..');
const cli = resolve(root, 'dist', 'cli.js');

function runCli(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: 'utf8',
    });
    return { code: 0, out };
  } catch (e: any) {
    return { code: e.status ?? 1, out: (e.stdout ?? '') + (e.stderr ?? '') };
  }
}

describe('CLI smoke — anti-regression gate (R3/R4)', () => {
  it('build artifact dist/cli.js exists', () => {
    expect(existsSync(cli)).toBe(true);
  });

  it('mumuspec --help starts with exit 0 and lists each top-level command exactly once', () => {
    const { code, out } = runCli(['--help']);
    expect(code).toBe(0);
    // Top-level commands are indented 2 spaces and start with a lowercase word.
    const topLevel = out
      .split('\n')
      .filter((l) => /^  [a-z]/.test(l))
      .map((l) => l.trimStart().split(/\s+/)[0]);
    const collisions = topLevel.filter((c, i) => topLevel.indexOf(c) !== i);
    expect(collisions).toEqual([]); // no duplicate command registration
    expect(topLevel).toContain('check'); // the command R3 merged must be present
  });

  it('mumuspec --version prints a SemVer string', () => {
    const { code, out } = runCli(['--version']);
    expect(code).toBe(0);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('mumuspec check runs (dogfooding) with exit 0', () => {
    const { code, out } = runCli(['check']);
    expect(code).toBe(0);
    expect(out).toContain('passed');
  });
});

describe('Command tree integrity — in-process (R5)', () => {
  it('assembles with no duplicate top-level command names', () => {
    // ponytail: buildProgram() is importable without executing the CLI, so we
    // assert the structural invariant directly — the hard guard R4 called for.
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(names).toContain('check'); // the command R3 merged must survive
    expect(names).toContain('loop'); // self-improve capability must be wired
  });
});
