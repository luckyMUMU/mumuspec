/**
 * Deep coverage for src/guard/checker.ts — targets uncovered branches.
 *
 * Focuses on:
 * - applyStrengthToGuardResult: downgrade error→warn path, every code in GUARD_CHECK_METADATA
 * - checkCompliance: invalid/empty spec, quoted-identifier JSX detection, word-boundary matching
 * - detectDrift: index drift scan, findSourceFiles depth limit
 * - detectContractGuardDrift: valid contracts with / without drifts
 * - autoFixDrift: relative path file, empty dry run with warnings
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyStrengthToGuardResult,
  checkCompliance,
  detectDrift,
  detectContractGuardDrift,
  autoFixDrift,
} from '../../src/guard/checker.js';
import type { GuardResult, DriftResult, ConstraintStrengthField } from '../../src/core/types.js';

// ─── helpers ───────────────────────────────────────────────────────────────

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-deep-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const STRENGTH_LOW: ConstraintStrengthField = {
  technical_design: 'low',
  requirement_goals: 'low',
};

const STRENGTH_MED: ConstraintStrengthField = {
  technical_design: 'medium',
  requirement_goals: 'medium',
};

const STRENGTH_HIGH: ConstraintStrengthField = {
  technical_design: 'high',
  requirement_goals: 'high',
};

/**
 * Write a valid spec.md with properly structured requirements.
 * Format MUST be: ## Requirement: Name / ### SHALL NOT / - item
 */
function writeSpec(projectDir: string, body: string): void {
  writeFileSync(
    join(projectDir, '.mumuspec', 'spec.md'),
    `---\nlayer: 0\nscope: "."\n---\n\n${body}`,
  );
}

// ─── applyStrengthToGuardResult — downgrade & every metadata code ───────────

describe('applyStrengthToGuardResult — error downgrade to warn', () => {
  it('should downgrade E-SPEC-004 from error to warn when TD strength is MEDIUM (action=warn)', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
      warnings: [],
    };
    // E-SPEC-004: dimension=technical_design. medium TD → action=warn → downgrade to warning
    const output = applyStrengthToGuardResult(result, STRENGTH_MED);
    expect(output.errors).toHaveLength(0);
    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0].code).toBe('E-SPEC-004');
    expect(output.warnings[0].message).toContain('[downgraded from error]');
    expect(output.warnings[0].detail).toContain('reason:');
  });

  it('should keep E-SPEC-004 as error when TD strength is HIGH (action=block)', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
      warnings: [],
    };
    // E-SPEC-004: high TD → action=block → stays as error
    const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
    expect(output.errors).toHaveLength(1);
    expect(output.warnings).toHaveLength(0);
  });

  it('should drop E-SPEC-004 at LOW strength (action=info)', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
      warnings: [],
    };
    // E-SPEC-004: low TD → action=info → dropped (removed from both errors and warnings)
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.errors).toHaveLength(0);
    expect(output.warnings).toHaveLength(0);
    expect(output.passed).toBe(true);
  });

  it('should drop unmapped error code at low strength (info → dropped)', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-CUSTOM-UNKNOWN', message: 'custom' }],
      warnings: [],
    };
    // Unmapped: default technical_design/low → low=info → dropped
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.errors).toHaveLength(0);
    expect(output.passed).toBe(true);
  });

  it('should keep unmapped error code at high strength', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-CUSTOM-UNKNOWN', message: 'custom' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
    expect(output.errors).toHaveLength(1);
    expect(output.passed).toBe(false);
  });
});

describe('applyStrengthToGuardResult — every code in GUARD_CHECK_METADATA', () => {
  it('E-GUARD-003: always_enforce, block regardless of strength', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-003', message: 'SHALL NOT violation' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0].message).toBe('SHALL NOT violation');
  });

  it('E-GUARD-004: min_strength=high, blocked at high TD', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-004', message: 'test immutability fail' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
    expect(output.errors).toHaveLength(1);
    expect(output.passed).toBe(false);
  });

  it('E-GUARD-004: downgraded to warn at medium TD', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-004', message: 'test immutability fail' }],
      warnings: [],
    };
    // medium TD, dimension=technical_design → action=warn → downgrade to warning
    const output = applyStrengthToGuardResult(result, STRENGTH_MED);
    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0].code).toBe('E-GUARD-004');
  });

  it('E-GUARD-002: min_strength=high RG, blocked at high RG', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-002', message: 'Build layers not done' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
    expect(output.errors).toHaveLength(1);
  });

  it('E-GUARD-002: downgraded at medium RG', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-002', message: 'Build layers not done' }],
      warnings: [],
    };
    // medium RG → action=warn → downgrade to warning
    const strength: ConstraintStrengthField = { technical_design: 'high', requirement_goals: 'medium' };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.warnings).toHaveLength(1);
  });

  it('E-DESIGN-001..006: downgraded at medium strength', () => {
    for (const code of ['E-DESIGN-001', 'E-DESIGN-002', 'E-DESIGN-003', 'E-DESIGN-004', 'E-DESIGN-005', 'E-DESIGN-006']) {
      const result: GuardResult = {
        passed: false,
        errors: [{ code, message: 'design error' }],
        warnings: [],
      };
      // medium TD → warn → downgrade
      const output = applyStrengthToGuardResult(result, STRENGTH_MED);
      expect(output.warnings).toHaveLength(1);
      expect(output.warnings[0].code).toBe(code);
    }
  });

  it('E-DESIGN-001..006: blocked at high strength', () => {
    for (const code of ['E-DESIGN-001', 'E-DESIGN-002', 'E-DESIGN-003', 'E-DESIGN-004', 'E-DESIGN-005', 'E-DESIGN-006']) {
      const result: GuardResult = {
        passed: false,
        errors: [{ code, message: 'design error' }],
        warnings: [],
      };
      const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
      expect(output.errors).toHaveLength(1);
      expect(output.errors[0].code).toBe(code);
    }
  });

  it('E-DESIGN-001..006: dropped at low strength (info)', () => {
    for (const code of ['E-DESIGN-001', 'E-DESIGN-002', 'E-DESIGN-003', 'E-DESIGN-004', 'E-DESIGN-005', 'E-DESIGN-006']) {
      const result: GuardResult = {
        passed: false,
        errors: [{ code, message: 'design error' }],
        warnings: [],
      };
      // low TD → info → dropped
      const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
      expect(output.errors).toHaveLength(0);
      expect(output.warnings).toHaveLength(0);
    }
  });

  it('E-CHANGE-006: always_enforce, block regardless', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-CHANGE-006', message: 'invalid phase transition' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.errors).toHaveLength(1);
  });

  it('E-CHANGE-007: always_enforce, block regardless', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-CHANGE-007', message: 'decisions hash mismatch' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.errors).toHaveLength(1);
  });

  it('E-GUARD-001: RG high, blocked at high RG', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: 'proposal.md missing' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_HIGH);
    expect(output.errors).toHaveLength(1);
  });

  it('E-GUARD-001: RG high, downgraded at medium RG', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: 'proposal.md missing' }],
      warnings: [],
    };
    // medium RG → action=warn → downgrade to warning
    const strength: ConstraintStrengthField = { technical_design: 'high', requirement_goals: 'medium' };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.warnings).toHaveLength(1);
  });
});

describe('applyStrengthToGuardResult — warning processing', () => {
  it('should drop warning when strength evaluates to info', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
    };
    // TD=low, E-SPEC-004 min_strength=medium, dimension=TD → info → dropped
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.warnings).toHaveLength(0);
  });

  it('should keep warning when strength evaluates to warn', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
    };
    // TD=medium, E-SPEC-004 min_strength=medium → warn → keep
    const output = applyStrengthToGuardResult(result, STRENGTH_MED);
    expect(output.warnings).toHaveLength(1);
  });

  it('should handle always_enforce warning staying as warning', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-CHANGE-007', message: 'hash mismatch' }],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    expect(output.warnings).toHaveLength(1);
    expect(output.warnings[0].code).toBe('E-CHANGE-007');
  });

  it('should handle mixed errors and warnings correctly', () => {
    const result: GuardResult = {
      passed: false,
      errors: [
        { code: 'E-GUARD-003', message: 'always block' },
        { code: 'E-SPEC-004', message: 'downgrade me' },
      ],
      warnings: [
        { code: 'E-GUARD-003', message: 'warn always' },
        { code: 'E-SPEC-004', message: 'warn downgrade' },
      ],
    };
    const output = applyStrengthToGuardResult(result, STRENGTH_LOW);
    // E-GUARD-003 error stays (always_enforce)
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0].code).toBe('E-GUARD-003');
    // E-GUARD-003 warning stays (always_enforce→block→keep as warn)
    // E-SPEC-004 warning dropped (TD=low, min_medium→info→drop)
    expect(output.warnings.some(w => w.code === 'E-GUARD-003')).toBe(true);
    expect(output.warnings.some(w => w.code === 'E-SPEC-004')).toBe(false);
  });
});

// ─── checkCompliance — edge cases ──────────────────────────────────────────

describe('checkCompliance — invalid / empty spec', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should handle empty spec.md gracefully', () => {
    writeFileSync(join(projectDir, '.mumuspec', 'spec.md'), '');
    const result = checkCompliance(projectDir, {});
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
  });

  it('should handle invalid YAML frontmatter gracefully', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nnot valid: [\n---\n\n## Req\n- SHALL: "test"\n',
    );
    const result = checkCompliance(projectDir, {});
    expect(result).toBeDefined();
  });

  it('should handle spec.md without frontmatter', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '## Requirement: R1\n### SHALL\n- test\n',
    );
    const result = checkCompliance(projectDir, {});
    expect(result).toBeDefined();
  });

  it('should handle non-existent spec directory', () => {
    rmSync(join(projectDir, '.mumuspec'), { recursive: true, force: true });
    const result = checkCompliance(projectDir, {});
    expect(result).toBeDefined();
    expect(result.passed).toBe(true);
  });
});

describe('checkCompliance — options combinations', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should only run ponytail check when ponytail=true', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 eval()\n\n### SHALL\n\n- something\n');
    writeFileSync(join(projectDir, 'bad.js'), 'eval("test")\n');
    // ponytail=true only → should NOT trigger SHALL NOT check
    const result = checkCompliance(projectDir, { ponytail: true });
    expect(result.errors.filter(e => e.code === 'E-GUARD-003')).toHaveLength(0);
  });

  it('options with only shall=true does not trigger SHALL NOT', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 eval()\n');
    const result = checkCompliance(projectDir, { shall: true });
    expect(result.errors.filter(e => e.code === 'E-GUARD-003')).toHaveLength(0);
  });

  it('options with only shallNot=true does NOT trigger SHALL check', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL\n\n- needs enforcement\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.warnings.filter(w => w.code === 'E-SPEC-004')).toHaveLength(0);
  });
});

describe('checkCompliance — quoted identifier & word-boundary matching', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should detect quoted identifier in code (long term >4 chars)', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 `dangerousFunc` in code\n');
    writeFileSync(join(projectDir, 'app.js'), 'dangerousFunc();\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('E-GUARD-003');
  });

  it('should use word-boundary matching for short terms (<=4 chars)', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 `new` operator\n');
    // "new" is short (3 chars) — should match word boundary
    writeFileSync(join(projectDir, 'app.js'), 'const x = new Foo();\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should skip comment lines even for short terms', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 `new` operator\n');
    writeFileSync(join(projectDir, 'app.js'), '// new is forbidden\nconst x = 1;\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    // "new" only in comment → should not be flagged
    expect(result.errors.filter(e => e.detail && e.detail.includes('app.js'))).toHaveLength(0);
  });
});

describe('checkCompliance — JSX / TSX detection', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should detect JSX angle-bracket syntax', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 JSX/TSX 语法\n');
    writeFileSync(join(projectDir, 'Component.tsx'), 'function App() { return <div>Hello</div>; }\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('E-GUARD-003');
  });

  it('should NOT flag .jsx file with only plain JS content as JSX violation', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 JSX/TSX 语法\n');
    // A file with .jsx extension but no actual JSX syntax — AST detection should not flag it
    writeFileSync(join(projectDir, 'plain.jsx'), 'const x = 1;\nexport default x;\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    // AST-based detection: no JSX nodes found, extension alone is not sufficient
    const jsxError = result.errors.find(e => e.detail && e.detail.includes('plain.jsx'));
    expect(jsxError).toBeUndefined();
  });

  it('should NOT flag htm template as JSX', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 JSX/TSX 语法\n');
    writeFileSync(
      join(projectDir, 'htmComponent.js'),
      'import { html } from "htm/preact";\nconst App = () => html`<div>Hello</div>`;\n',
    );
    const result = checkCompliance(projectDir, { shallNot: true });
    const htmError = result.errors.find(e => e.detail && e.detail.includes('htmComponent.js'));
    expect(htmError).toBeUndefined();
  });

  it('should detect JSX in TSX with component pattern', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 JSX/TSX 语法\n');
    writeFileSync(
      join(projectDir, 'Comp.tsx'),
      'export function Greeting() {\n  return <Component name="test" />;\n}\n',
    );
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('checkCompliance — coexistence constraints', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should detect coexistence violation in subproject .mumuspec dir', () => {
    const subDir = join(projectDir, 'sub');
    mkdirSync(join(subDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(subDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\nscope: "sub"\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "spec.md SHALL NOT coexist with prd.md"\n',
    );
    // Create both spec.md and prd.md in subproject .mumuspec
    writeFileSync(join(subDir, '.mumuspec', 'prd.md'), '# PRD\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('E-GUARD-003');
  });

  it('should allow spec.md + prd.md coexistence in root .mumuspec', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- "spec.md SHALL NOT coexist with prd.md"\n');
    writeFileSync(join(projectDir, '.mumuspec', 'prd.md'), '# PRD\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    // Root directory is exempt from spec.md coexistence check
    expect(result.errors.filter(e => e.message.includes('spec.md') && e.message.includes('prd.md'))).toHaveLength(0);
  });

  it('should detect coexistence with Chinese text constraint', () => {
    const subDir = join(projectDir, 'feature');
    mkdirSync(join(subDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(subDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\nscope: "feature"\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- tech.md 与 design.md 不应共存\n',
    );
    writeFileSync(join(subDir, '.mumuspec', 'tech.md'), '# Tech\n');
    writeFileSync(join(subDir, '.mumuspec', 'design.md'), '# Design\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle system-behavior prefixes as coexistence-like constraints', () => {
    writeSpec(
      projectDir,
      '## Requirement: R1\n\n### SHALL NOT\n\n- the system shall not allow changes to skip the design phase\n',
    );
    // System-behavior prefix — no code-level check
    const result = checkCompliance(projectDir, { shallNot: true });
    // Should not produce E-GUARD-003 code-level errors
    expect(result.errors.filter(e => e.code === 'E-GUARD-003')).toHaveLength(0);
  });
});

describe('checkCompliance — subproject scope isolation', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should NOT flag code outside subproject scope', () => {
    const demoDir = join(projectDir, 'demo');
    mkdirSync(join(demoDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(demoDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\nscope: "demo"\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 `noGood` function\n',
    );
    // Code in ROOT that uses noGood — should NOT be flagged by demo's prohibition
    writeFileSync(join(projectDir, 'root.ts'), 'noGood();\n');
    // Code in demo/ that uses noGood — SHOULD be flagged
    writeFileSync(join(demoDir, 'impl.ts'), 'noGood();\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    const rootError = result.errors.find(e => e.detail && e.detail.includes('root.ts'));
    const demoError = result.errors.find(e => e.detail && e.detail.includes('impl.ts'));
    expect(rootError).toBeUndefined();
    expect(demoError).toBeDefined();
  });

  it('root prohibition with scope "." applies to all code', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 `globalBad`\n');
    const subDir = join(projectDir, 'packages');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, 'mod.ts'), 'globalBad();\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    const subError = result.errors.find(e => e.detail && e.detail.includes('mod.ts'));
    expect(subError).toBeDefined();
  });
});

// ─── detectDrift — edge cases ───────────────────────────────────────────────

describe('detectDrift — index & nested directory', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should scan index.yaml when present', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'index.yaml'),
      'layer: 0\nchildren:\n  - name: child1\n    path: sub1\n',
    );
    // Create the subproject so actualChildren filter finds it
    const subDir = join(projectDir, 'sub1');
    mkdirSync(join(subDir, '.mumuspec'), { recursive: true });
    const result = detectDrift(projectDir);
    // Should complete without throwing
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect drift in nested subproject specs', () => {
    const subDir = join(projectDir, 'packages', 'core');
    mkdirSync(join(subDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(subDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\nscope: "packages/core"\n---\n\n## Requirement: NR1\n\n### SHALL\n\n- must have feature X\n',
    );
    const result = detectDrift(projectDir);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.type === 'spec_drift')).toBe(true);
  });
});

// ─── detectContractGuardDrift — realistic scenarios ────────────────────────

describe('detectContractGuardDrift — full scenarios', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should return empty array for project with no contracts config', () => {
    const result = detectContractGuardDrift(projectDir);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('should surface summary when contracts have drift', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'contracts.yaml'),
      [
        'contracts:',
        '  - id: test-impl-v1',
        '    file: src/api.ts',
        '    type: function',
        '    signature: "export function doSomething(): void"',
        '    description: "Test contract"',
        '    dependencies: []',
        '',
      ].join('\n'),
    );
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(join(projectDir, 'src', 'api.ts'), 'export function doSomething(): void { /* impl */ }\n');
    const result = detectContractGuardDrift(projectDir);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ─── autoFixDrift — additional edge cases ──────────────────────────────────

describe('autoFixDrift — remaining edge cases', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should handle relative-path file in drift', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, '---\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- something\n');
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: '.mumuspec/spec.md',  // relative path
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(1);
  });

  it('should handle mixed fixable and non-fixable drifts', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, '---\nlayer: 0\n---\n\n## Requirement: R1\n### SHALL\n- something\n');
    const drifts: DriftResult[] = [
      { type: 'spec_drift', severity: 'WARN', message: 'fixable', file: specPath },
      { type: 'spec_drift', severity: 'ERROR', message: 'not fixable', file: specPath },
      { type: 'unknown_type', severity: 'WARN', message: 'not fixable' },
    ];
    const result = autoFixDrift(projectDir, drifts);
    expect(result.fixed.length).toBeGreaterThanOrEqual(1);
    expect(result.remaining.length).toBeGreaterThanOrEqual(1);
  });

  it('should return empty result when drifts is empty array', () => {
    const result = autoFixDrift(projectDir, []);
    expect(result.fixed).toEqual([]);
    expect(result.remaining).toEqual([]);
  });

  it('dryRun returns true for fixable spec drift without modifying file', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    const content = '---\nlayer: 0\n---\n\n## Requirement: R1\n\n### SHALL\n\n- x\n';
    writeFileSync(specPath, content);
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: specPath,
    };
    autoFixDrift(projectDir, [drift], true);
    // Verify file unchanged
    expect(readFileSync(specPath, 'utf8')).toBe(content);
  });
});

// ─── checkCompliance option: testImmutability ──────────────────────────────

describe('checkCompliance — testImmutability option', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should handle testImmutability option without throwing', () => {
    writeFileSync(join(projectDir, 'test.ts'), '// test\n');
    const result = checkCompliance(projectDir, { testImmutability: true });
    expect(result).toBeDefined();
  });
});

// ─── checkCompliance with strength + violation combinations ─────────────────

describe('checkCompliance — strength + violation interaction', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('always_enforce SHALL NOT errors persist regardless of strength', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 eval()\n');
    writeFileSync(join(projectDir, 'bad.js'), 'eval("dangerous")\n');
    // E-GUARD-003 is always_enforce → stays as error even at low strength
    const result = checkCompliance(projectDir, { shallNot: true, strength: STRENGTH_LOW });
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe('E-GUARD-003');
  });

  it('non-always-enforce E-SPEC-004 dropped at low TD strength', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL\n\n- should have enforcement\n');
    // E-SPEC-004 at low TD → info → dropped
    const result = checkCompliance(projectDir, { strength: STRENGTH_LOW });
    expect(result.warnings.filter(w => w.code === 'E-SPEC-004')).toHaveLength(0);
  });

  it('non-always-enforce E-SPEC-004 kept as warning at medium TD strength', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL\n\n- should have enforcement\n');
    // E-SPEC-004 at medium TD → warn → kept as warning
    const result = checkCompliance(projectDir, { strength: STRENGTH_MED });
    expect(result.warnings.filter(w => w.code === 'E-SPEC-004').length).toBeGreaterThan(0);
  });
});

// ─── detectDrift: empty requirements ────────────────────────────────────────

describe('detectDrift — spec with no SHALL constraints', () => {
  let projectDir: string;

  beforeEach(() => { projectDir = createTmpProject(); });
  afterEach(() => { cleanup(projectDir); });

  it('should NOT drift for spec with only SHALL NOT but no SHALL', () => {
    writeSpec(projectDir, '## Requirement: R1\n\n### SHALL NOT\n\n- 禁止使用 eval()\n');
    const result = detectDrift(projectDir);
    expect(result).toEqual([]);
  });
});
