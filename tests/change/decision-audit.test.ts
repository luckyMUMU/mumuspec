import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureDir, writeText, readText, writeYaml } from '../../src/core/utils.js';
import { recordAutoDecision } from '../../src/change/decision-audit.js';
import { loadChangeState } from '../../src/change/state.js';
import type { ChangeState } from '../../src/core/types-workflow.js';

let testDir: string;
let changeDir: string;

function setupChange(): void {
  const mumuDir = join(testDir, '.mumuspec');
  ensureDir(join(mumuDir, 'changes'));
  changeDir = join(mumuDir, 'changes', 'test-change');
  ensureDir(changeDir);
  writeText(join(changeDir, 'decisions.md'), `# Decision Log: test-change\n\n`);

  const state: Partial<ChangeState> = {
    name: 'test-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    scope: '.',
    affected_scopes: [],
    build_layers: [],
    test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'layered',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    auto_decisions: [],
  };
  // Write initial .mumuspec.yaml
  writeYaml(join(changeDir, '.mumuspec.yaml'), state);
}

describe('decision-audit', () => {
  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'mumuspec-decision-test-'));
    setupChange();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should append auto_decisions to state', () => {
    recordAutoDecision(testDir, 'test-change', {
      phase: 'open',
      decision: 'compress_to_tweak',
      rationale: 'Small change, safe to compress',
      confidence: 0.85,
      approved_by: 'auto_L2_rule',
    });

    const state = loadChangeState(testDir, 'test-change');
    expect(state?.auto_decisions).toBeDefined();
    expect(state?.auto_decisions?.length).toBe(1);
    expect(state?.auto_decisions?.[0].decision).toBe('compress_to_tweak');
    expect(state?.auto_decisions?.[0].approved_by).toBe('auto_L2_rule');
  });

  it('should append entry to decisions.md', () => {
    recordAutoDecision(testDir, 'test-change', {
      phase: 'open',
      decision: 'skip_design',
      rationale: 'Doc-only change',
      confidence: 0.9,
      approved_by: 'auto_L2_rule',
    });

    const decisionsMd = readText(join(changeDir, 'decisions.md'));
    expect(decisionsMd).toContain('skip_design');
    expect(decisionsMd).toContain('Doc-only change');
  });

  it('should record multiple decisions in order', () => {
    recordAutoDecision(testDir, 'test-change', {
      phase: 'open',
      decision: 'first',
      rationale: 'first reason',
      confidence: 0.8,
      approved_by: 'auto_L2_rule',
    });
    recordAutoDecision(testDir, 'test-change', {
      phase: 'design',
      decision: 'second',
      rationale: 'second reason',
      confidence: 0.75,
      approved_by: 'user',
    });

    const state = loadChangeState(testDir, 'test-change');
    expect(state?.auto_decisions?.length).toBe(2);
    expect(state?.auto_decisions?.[0].decision).toBe('first');
    expect(state?.auto_decisions?.[1].decision).toBe('second');
  });
});
