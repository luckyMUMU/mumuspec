/**
 * Unit tests for the constraint-strength system (0.12.1+).
 *
 * Covers:
 *   1. `resolveConstraintTree` — tree-distributed constraint resolution
 *      (inheritance, tightening, conflicts, skip-layer inheritance)
 *   2. `evaluateConstraint` — runtime strength evaluation
 *      (exceptions, overrides, strength comparison, action mapping)
 *   3. `loadConstraintsFile` / `loadAllConstraints` — disk loader
 *      (file discovery, scope normalization, missing-root handling)
 *
 * Design reference: docs/design/constraint-strength.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  resolveConstraintTree,
  normalizeScope,
  strengthRank,
  isTightening,
  isValidStrength,
  BUILTIN_CONSTRAINT_EXCEPTIONS,
  STRENGTH_ACTION_MAP,
  WORKFLOW_RULE_DIMENSION,
  WORKFLOW_STRENGTH_MATRIX,
} from '../src/core/config.js';

import {
  evaluateConstraint,
  evaluateChecks,
  resolveWorkflowRule,
  type ConstraintCheck,
} from '../src/core/constraint-evaluator.js';

import {
  loadConstraintsFile,
  loadAllConstraints,
  resolveRootStrength,
} from '../src/core/constraints-loader.js';

import type {
  ConstraintsFile,
  ConstraintEntry,
  ConstraintStrength,
  ConstraintStrengthField,
} from '../src/core/types.js';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ConstraintEntry> = {}): ConstraintEntry {
  return {
    id: 'TD-SHALL-001',
    content: 'design.md must cover all affected layers',
    min_strength: 'high',
    enforcement: 'phase_guard: design_to_build',
    ...overrides,
  };
}

function makeFile(overrides: Partial<ConstraintsFile> = {}): ConstraintsFile {
  return {
    version: '0.2.0',
    last_updated: '2026-07-28',
    scope: '.',
    layer: 0,
    strength: { technical_design: 'high', requirement_goals: 'high' },
    ...overrides,
  };
}

function makeStrengthField(
  td: ConstraintStrength = 'high',
  rg: ConstraintStrength = 'high',
  overrides: Partial<ConstraintStrengthField> = {},
): ConstraintStrengthField {
  return {
    technical_design: td,
    requirement_goals: rg,
    exceptions: [...BUILTIN_CONSTRAINT_EXCEPTIONS],
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────
// 1. resolveConstraintTree
// ────────────────────────────────────────────────────────────────────

describe('resolveConstraintTree', () => {
  it('returns a bare root for empty input', () => {
    const res = resolveConstraintTree([], {
      technical_design: 'high',
      requirement_goals: 'high',
    });
    expect(res.root.scope).toBe('.');
    expect(res.root.layer).toBe(0);
    expect(res.root.forward.technical_design).toHaveLength(0);
    expect(res.root.reverse.technical_design).toHaveLength(0);
    expect(res.conflicts).toHaveLength(0);
    expect(res.warnings).toHaveLength(0);
  });

  it('resolves a single root file with entries', () => {
    const entry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'high' });
    const file = makeFile({
      forward: { technical_design: [entry] },
    });

    const res = resolveConstraintTree([file], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    expect(res.root.forward.technical_design).toHaveLength(1);
    expect(res.root.forward.technical_design[0].id).toBe('TD-SHALL-001');
    expect(res.root.forward.technical_design[0].inherited).toBe(false);
    expect(res.conflicts).toHaveLength(0);
  });

  it('inherits parent entries to child (marked inherited: true)', () => {
    const parentEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'medium' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [] },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    const childNode = res.root.children.get('src');
    expect(childNode).toBeDefined();
    expect(childNode!.forward.technical_design).toHaveLength(1);
    expect(childNode!.forward.technical_design[0].id).toBe('TD-SHALL-001');
    expect(childNode!.forward.technical_design[0].inherited).toBe(true);
  });

  it('allows child to tighten parent constraint (same enforcement, higher strength)', () => {
    const parentEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'medium' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const childTightened = makeEntry({ id: 'TD-SHALL-001', min_strength: 'high' });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [childTightened] },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    // No conflict — tightening is legal
    expect(res.conflicts).toHaveLength(0);
    const childNode = res.root.children.get('src');
    expect(childNode!.forward.technical_design).toHaveLength(1);
    expect(childNode!.forward.technical_design[0].min_strength).toBe('high');
    expect(childNode!.forward.technical_design[0].tightens).toEqual({
      layer: 0,
      scope: '.',
      id: 'TD-SHALL-001',
    });
  });

  it('records a conflict when child relaxes parent (lower min_strength)', () => {
    const parentEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'high' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const childRelaxed = makeEntry({ id: 'TD-SHALL-001', min_strength: 'low' });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [childRelaxed] },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].resolution).toBe('manual_review');
    expect(res.conflicts[0].winner.min_strength).toBe('high');
    expect(res.conflicts[0].losers[0].min_strength).toBe('low');
    // Parent entry retained at child scope
    const childNode = res.root.children.get('src');
    expect(childNode!.forward.technical_design[0].min_strength).toBe('high');
  });

  it('records a conflict when enforcement mechanism differs', () => {
    const parentEntry = makeEntry({
      id: 'TD-SHALL-001',
      min_strength: 'high',
      enforcement: 'phase_guard: design_to_build',
    });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const childDiffEnf = makeEntry({
      id: 'TD-SHALL-001',
      min_strength: 'high',
      enforcement: 'ponytail_drift',
    });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [childDiffEnf] },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].resolution).toBe('highest_layer_wins');
  });

  it('accumulates SHALL NOT entries across layers (union)', () => {
    const parentNot = makeEntry({ id: 'TD-SHALL-NOT-001', min_strength: 'high' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      reverse: { technical_design: [parentNot] },
    });
    const childNot = makeEntry({ id: 'TD-SHALL-NOT-002', min_strength: 'high' });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      reverse: { technical_design: [childNot] },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    const childNode = res.root.children.get('src');
    expect(childNode!.reverse.technical_design).toHaveLength(2);
    expect(childNode!.reverse.technical_design.map((e) => e.id).sort())
      .toEqual(['TD-SHALL-NOT-001', 'TD-SHALL-NOT-002']);
  });

  it('implements skip-layer inheritance (grandparent → grandchild)', () => {
    // Root has constraints, "src" has no file, "src/api" has a file.
    // "src/api" should inherit directly from root.
    const rootEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'high' });
    const root = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [rootEntry] },
    });
    const apiFile = makeFile({
      scope: 'src/api',
      layer: 2,
      forward: { technical_design: [] },
    });

    const res = resolveConstraintTree([root, apiFile], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    // "src" node is NOT created (no file), but "src/api" inherits from root
    const apiNode = res.root.children.get('src/api');
    expect(apiNode).toBeDefined();
    expect(apiNode!.forward.technical_design).toHaveLength(1);
    expect(apiNode!.forward.technical_design[0].id).toBe('TD-SHALL-001');
    expect(apiNode!.forward.technical_design[0].inherited).toBe(true);
  });

  it('ignores child strength weaker than parent (with warning)', () => {
    const parent = makeFile({
      scope: '.',
      layer: 0,
      strength: { technical_design: 'high', requirement_goals: 'high' },
    });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      strength: { technical_design: 'low', requirement_goals: 'medium' },
    });

    const res = resolveConstraintTree([parent, child], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    const childNode = res.root.children.get('src');
    // TD relaxation ignored — keeps parent's high
    expect(childNode!.strength.technical_design).toBe('high');
    // RG relaxation also ignored — medium < high
    expect(childNode!.strength.requirement_goals).toBe('high');
    expect(res.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates files at the same scope (first wins, with warning)', () => {
    const a = makeFile({ scope: '.', forward: { technical_design: [makeEntry({ id: 'A' })] } });
    const b = makeFile({ scope: '.', forward: { technical_design: [makeEntry({ id: 'B' })] } });

    const res = resolveConstraintTree([a, b], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    expect(res.root.forward.technical_design[0].id).toBe('A');
    expect(res.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('handles Windows-style scope paths (backslashes)', () => {
    const file = makeFile({
      scope: 'src\\api',
      forward: { technical_design: [makeEntry()] },
    });

    const res = resolveConstraintTree([file], {
      technical_design: 'high',
      requirement_goals: 'high',
    });

    // Should normalize to "src/api"
    expect(res.root.scope).toBe('src/api');
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. evaluateConstraint
// ────────────────────────────────────────────────────────────────────

describe('evaluateConstraint', () => {
  it('blocks when check is in BUILTIN_CONSTRAINT_EXCEPTIONS', () => {
    const check: ConstraintCheck = {
      id: 'bp_17_archive_confirmation',
      dimension: 'requirement_goals',
      min_strength: 'low',
    };
    const config = makeStrengthField('low', 'low');

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('block');
    expect(result.reason).toContain('exception');
  });

  it('blocks when always_enforce is true', () => {
    const check: ConstraintCheck = {
      id: 'custom-always',
      dimension: 'technical_design',
      min_strength: 'low',
      always_enforce: true,
    };
    const config = makeStrengthField('low', 'low');

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('block');
  });

  it('blocks when strength=high and min_strength=high', () => {
    const check: ConstraintCheck = {
      id: 'TD-SHALL-001',
      dimension: 'technical_design',
      min_strength: 'high',
    };
    const config = makeStrengthField('high', 'high');

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('block');
  });

  it('warns when strength=medium and min_strength=high', () => {
    const check: ConstraintCheck = {
      id: 'TD-SHALL-001',
      dimension: 'technical_design',
      min_strength: 'high',
    };
    const config = makeStrengthField('medium', 'high');

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('warn');
  });

  it('infos when strength=low and min_strength=high (below threshold)', () => {
    const check: ConstraintCheck = {
      id: 'TD-SHALL-001',
      dimension: 'technical_design',
      min_strength: 'high',
    };
    const config = makeStrengthField('low', 'high');

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('info');
    expect(result.reason).toContain('< min_strength');
  });

  it('respects explicit workflow override=true (block even at low strength)', () => {
    const check: ConstraintCheck = {
      id: 'worktree_isolation_check',
      dimension: 'requirement_goals',
      min_strength: 'high',
      workflowRule: 'worktree_isolation',
    };
    const config = makeStrengthField('low', 'low', {
      overrides: {
        workflow: { worktree_isolation: 'true' },
        cognitive_framework: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('block');
    expect(result.reason).toContain('worktree_isolation=true');
  });

  it('respects explicit workflow override=false (info even at high strength)', () => {
    const check: ConstraintCheck = {
      id: 'tdd_check',
      dimension: 'technical_design',
      min_strength: 'high',
      workflowRule: 'tdd_enforced',
    };
    const config = makeStrengthField('high', 'high', {
      overrides: {
        workflow: { tdd_enforced: 'false' },
        cognitive_framework: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('info');
    expect(result.reason).toContain('tdd_enforced=false');
  });

  it('respects capability override=required (block)', () => {
    const check: ConstraintCheck = {
      id: 'cf_check',
      dimension: 'technical_design',
      min_strength: 'high',
      capabilityOverride: 'cognitive_framework',
    };
    const config = makeStrengthField('low', 'low', {
      overrides: {
        workflow: {
          worktree_isolation: 'inherit',
          single_active_change: 'inherit',
          top_down_design: 'inherit',
          tdd_enforced: 'inherit',
        },
        cognitive_framework: 'required',
        hyperplan: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('block');
  });

  it('respects capability override=off (info)', () => {
    const check: ConstraintCheck = {
      id: 'cf_check',
      dimension: 'technical_design',
      min_strength: 'high',
      capabilityOverride: 'cognitive_framework',
    };
    const config = makeStrengthField('high', 'high', {
      overrides: {
        workflow: {
          worktree_isolation: 'inherit',
          single_active_change: 'inherit',
          top_down_design: 'inherit',
          tdd_enforced: 'inherit',
        },
        cognitive_framework: 'off',
        hyperplan: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });

    const result = evaluateConstraint(check, config);
    expect(result.action).toBe('info');
  });

  it('evaluateChecks partitions results by action', () => {
    const checks: ConstraintCheck[] = [
      { id: 'block-check', dimension: 'technical_design', min_strength: 'high' },
      { id: 'warn-check', dimension: 'technical_design', min_strength: 'high' },
      { id: 'info-check', dimension: 'technical_design', min_strength: 'high' },
    ];
    // First: high → block; second: medium → warn; third: low → info
    // We can't have different strengths per-check with one config, so test
    // with a single medium config: high-min checks become warn.
    const config = makeStrengthField('medium', 'medium');

    const { results, blockers, warnings, infos } = evaluateChecks(checks, config);
    expect(results).toHaveLength(3);
    expect(blockers).toHaveLength(0);
    expect(warnings).toHaveLength(3);
    expect(infos).toHaveLength(0);
  });

  it('resolveWorkflowRule honors explicit override=true', () => {
    const config = makeStrengthField('low', 'low', {
      overrides: {
        workflow: { worktree_isolation: 'true' },
        cognitive_framework: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });
    const result = resolveWorkflowRule(
      'worktree_isolation',
      config,
      WORKFLOW_RULE_DIMENSION,
      WORKFLOW_STRENGTH_MATRIX,
    );
    expect(result).toBe(true);
  });

  it('resolveWorkflowRule falls back to strength matrix when override=inherit', () => {
    const config = makeStrengthField('medium', 'medium', {
      overrides: {
        workflow: { single_active_change: 'inherit' },
        cognitive_framework: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    });
    // medium + RG → single_active_change=false per WORKFLOW_STRENGTH_MATRIX
    const result = resolveWorkflowRule(
      'single_active_change',
      config,
      WORKFLOW_RULE_DIMENSION,
      WORKFLOW_STRENGTH_MATRIX,
    );
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. loadConstraintsFile / loadAllConstraints
// ────────────────────────────────────────────────────────────────────

describe('constraints-loader', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'mumuspec-load-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function writeConstraintsFile(dir: string, content: object): void {
    const mumuDir = join(dir, '.mumuspec');
    if (!existsSync(mumuDir)) mkdirSync(mumuDir, { recursive: true });
    writeFileSync(join(mumuDir, 'constraints.yaml'), yamlStringify(content), 'utf8');
  }

  // Minimal YAML stringifier (avoids depending on the `yaml` package in tests).
  function yamlStringify(obj: unknown): string {
    if (typeof obj !== 'object' || obj === null) return String(obj);
    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) {
          lines.push(`  ${kk}: ${yamlScalar(vv)}`);
        }
      } else if (Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`  - id: ${(item as ConstraintEntry).id}`);
          lines.push(`    content: ${(item as ConstraintEntry).content}`);
          lines.push(`    min_strength: ${(item as ConstraintEntry).min_strength}`);
          lines.push(`    enforcement: ${(item as ConstraintEntry).enforcement}`);
        }
      } else {
        lines.push(`${k}: ${yamlScalar(v)}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  function yamlScalar(v: unknown): string {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }

  it('loadConstraintsFile returns undefined when file missing', () => {
    const result = loadConstraintsFile(projectRoot, projectRoot);
    expect(result).toBeUndefined();
  });

  it('loadConstraintsFile loads and stamps scope from path', () => {
    writeConstraintsFile(projectRoot, {
      version: '0.2.0',
      last_updated: '2026-07-28',
      forward: {
        technical_design: [
          {
            id: 'TD-SHALL-001',
            content: 'test',
            min_strength: 'high',
            enforcement: 'phase_guard',
          },
        ],
      },
    });

    const result = loadConstraintsFile(projectRoot, projectRoot);
    expect(result).toBeDefined();
    expect(result!.scope).toBe('.');
    expect(result!.layer).toBe(0);
    expect(result!.forward?.technical_design).toHaveLength(1);
    expect(result!.forward!.technical_design![0].id).toBe('TD-SHALL-001');
  });

  it('loadAllConstraints returns empty when no .mumuspec/ exists', () => {
    const { files, warnings } = loadAllConstraints(projectRoot);
    expect(files).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('loadAllConstraints discovers files at multiple layers', () => {
    // Root
    writeConstraintsFile(projectRoot, {
      version: '0.2.0',
      last_updated: '2026-07-28',
      forward: {
        technical_design: [
          {
            id: 'TD-SHALL-ROOT',
            content: 'root',
            min_strength: 'high',
            enforcement: 'phase_guard',
          },
        ],
      },
    });
    // src/api
    const srcApiDir = join(projectRoot, 'src', 'api');
    mkdirSync(srcApiDir, { recursive: true });
    writeConstraintsFile(srcApiDir, {
      version: '0.2.0',
      last_updated: '2026-07-28',
      forward: {
        technical_design: [
          {
            id: 'TD-SHALL-API',
            content: 'api',
            min_strength: 'high',
            enforcement: 'contract_drift_check',
          },
        ],
      },
    });

    const { files } = loadAllConstraints(projectRoot);
    expect(files).toHaveLength(2);
    const scopes = files.map((f) => f.scope).sort();
    expect(scopes).toEqual(['.', 'src/api']);
  });

  it('loadAllConstraints skips node_modules and dist', () => {
    writeConstraintsFile(projectRoot, {
      version: '0.2.0',
      last_updated: '2026-07-28',
    });
    // Create a fake constraints.yaml inside node_modules — should be ignored
    const nmDir = join(projectRoot, 'node_modules', 'some-pkg');
    mkdirSync(nmDir, { recursive: true });
    writeConstraintsFile(nmDir, {
      version: '0.2.0',
      last_updated: '2026-07-28',
      forward: {
        technical_design: [
          {
            id: 'SHOULD-NOT-LOAD',
            content: 'x',
            min_strength: 'high',
            enforcement: 'x',
          },
        ],
      },
    });

    const { files } = loadAllConstraints(projectRoot);
    expect(files).toHaveLength(1);
    expect(files[0].scope).toBe('.');
  });

  it('resolveRootStrength falls back to config when root file omits strength', () => {
    const files: ConstraintsFile[] = [
      makeFile({ scope: '.', strength: undefined }),
    ];
    const result = resolveRootStrength(files, {
      technical_design: 'medium',
      requirement_goals: 'high',
    });
    expect(result.technical_design).toBe('medium');
    expect(result.requirement_goals).toBe('high');
  });

  it('resolveRootStrength uses root file strength when present', () => {
    const files: ConstraintsFile[] = [
      makeFile({ scope: '.', strength: { technical_design: 'low', requirement_goals: 'high' } }),
    ];
    const result = resolveRootStrength(files, {
      technical_design: 'medium',
      requirement_goals: 'medium',
    });
    expect(result.technical_design).toBe('low');
    expect(result.requirement_goals).toBe('high');
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Pure helpers (normalizeScope, strengthRank, isTightening, isValidStrength)
// ────────────────────────────────────────────────────────────────────

describe('constraint helpers', () => {
  it('normalizeScope canonicalizes paths', () => {
    expect(normalizeScope(undefined)).toBe('.');
    expect(normalizeScope('')).toBe('.');
    expect(normalizeScope('.')).toBe('.');
    expect(normalizeScope('./')).toBe('.');
    expect(normalizeScope('./src')).toBe('src');
    expect(normalizeScope('/src')).toBe('src');
    expect(normalizeScope('src/')).toBe('src');
    expect(normalizeScope('src\\api')).toBe('src/api');
    expect(normalizeScope('src//api')).toBe('src/api');
  });

  it('strengthRank returns 3/2/1 for high/medium/low', () => {
    expect(strengthRank('high')).toBe(3);
    expect(strengthRank('medium')).toBe(2);
    expect(strengthRank('low')).toBe(1);
  });

  it('strengthRank throws on invalid input', () => {
    expect(() => strengthRank('invalid' as ConstraintStrength)).toThrow();
  });

  it('isValidStrength narrows correctly', () => {
    expect(isValidStrength('high')).toBe(true);
    expect(isValidStrength('medium')).toBe(true);
    expect(isValidStrength('low')).toBe(true);
    expect(isValidStrength('off')).toBe(false);
    expect(isValidStrength(undefined)).toBe(false);
    expect(isValidStrength(123)).toBe(false);
  });

  it('isTightening validates same-id strength-raising', () => {
    const parent = makeEntry({ id: 'X', min_strength: 'medium', enforcement: 'a' });
    const childOk = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'a' });
    const childRelax = makeEntry({ id: 'X', min_strength: 'low', enforcement: 'a' });
    const childDiffEnf = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'b' });
    const childDiffId = makeEntry({ id: 'Y', min_strength: 'high', enforcement: 'a' });

    expect(isTightening(parent, childOk).valid).toBe(true);
    expect(isTightening(parent, childRelax).valid).toBe(false);
    expect(isTightening(parent, childDiffEnf).valid).toBe(false);
    expect(isTightening(parent, childDiffId).valid).toBe(false);
  });

  it('STRENGTH_ACTION_MAP maps high→block, medium→warn, low→info', () => {
    expect(STRENGTH_ACTION_MAP.high).toBe('block');
    expect(STRENGTH_ACTION_MAP.medium).toBe('warn');
    expect(STRENGTH_ACTION_MAP.low).toBe('info');
  });

  it('WORKFLOW_STRENGTH_MATRIX enforces all rules at high, relaxes some at medium, all at low', () => {
    expect(Object.values(WORKFLOW_STRENGTH_MATRIX.high).every(Boolean)).toBe(true);
    expect(WORKFLOW_STRENGTH_MATRIX.medium.worktree_isolation).toBe(true);
    expect(WORKFLOW_STRENGTH_MATRIX.medium.tdd_enforced).toBe(false); // 0.20.0+: relaxed for LLM freedom
    expect(WORKFLOW_STRENGTH_MATRIX.medium.single_active_change).toBe(false);
    expect(WORKFLOW_STRENGTH_MATRIX.medium.top_down_design).toBe(false);
    expect(Object.values(WORKFLOW_STRENGTH_MATRIX.low).every((v) => v === false)).toBe(true);
  });

  it('BUILTIN_CONSTRAINT_EXCEPTIONS contains the 9 documented exceptions', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toHaveLength(9);
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('archive_terminal_state');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('discard_user_confirmation');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('commit_sha_immutability');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('sensitive_info_scan');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('shall_not_violation_in_ci');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_03_user_confirmation');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_04_design_confirmation');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_14_verify_failure');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_17_archive_confirmation');
  });
});
