/**
 * Ready-action guidance e2e (ready-action-guidance, 2026-09-13).
 *
 * `mumuspec status` must surface the next transition with a live gate verdict:
 * blocked (with error codes) when artifacts are missing, ready when the gate
 * passes — read-only, no state mutation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('../../..', import.meta.url)));

function run(root: string, args: string[]): { status: number; out: string } {
  const res = spawnSync(process.execPath, [join(repoRoot, 'dist', 'cli.js'), ...args], {
    encoding: 'utf8',
    cwd: root,
    timeout: 60_000,
  });
  return { status: res.status ?? 0, out: (res.stdout || '') + (res.stderr || '') };
}

describe('status ready-action block', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-ready-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    run(dir, ['init', '.']);
    run(dir, ['new', 'demo-change', '--workflow', 'full']);
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('TC1: design phase without design.md → 受阻 with E-GUARD-001', () => {
    // open→design gate has no hard error; the deterministic blocker is
    // design→build without design.md.
    run(dir, ['state', 'transition', 'demo-change', 'design', '--confirm']);
    const { out } = run(dir, ['status', 'demo-change']);
    expect(out).toContain('就绪动作');
    expect(out).toContain('✗ 受阻');
    expect(out).toContain('E-GUARD-001');
    expect(out).toContain('design.md');
  });

  it('TC2: after design.md exists → 就绪 with transition command', () => {
    // Satisfy open→design gate: design.md + open-questions declaration signed off.
    const designPath = join(dir, '.mumuspec', 'changes', 'demo-change', 'design.md');
    writeFileSync(
      designPath,
      ['## Design', '', '<!-- no-open-questions -->', '<!-- no-assumptions -->', ''].join('\n'),
    );
    // Sign-off via decisions append needs CLI state; run it.
    run(dir, ['decisions', 'append', '--phase', 'design', '--change', 'demo-change', 'no-open-questions/no-assumptions 签收']);
    // Transition to design so the block evaluates the next gate (design→build).
    run(dir, ['state', 'transition', 'demo-change', 'design', '--confirm']);
    // Clean previous sign-offs context: next gate is build (design_exists + cognitive map warnings only).

    const { out } = run(dir, ['status', 'demo-change']);
    expect(out).toContain('就绪动作');
    expect(out).toContain('✓ 就绪');
    expect(out).toContain('transition demo-change build');
  });

  it('TC4: legacy status fields remain intact', () => {
    const { out } = run(dir, ['status', 'demo-change']);
    expect(out).toContain('变更: demo-change');
    expect(out).toContain('Phase:');
    expect(out).toContain('Workflow: full');
    expect(out).toContain('下一步:');
  });
});
