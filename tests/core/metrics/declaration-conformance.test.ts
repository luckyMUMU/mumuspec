/**
 * Declaration conformance probes (core-consolidation L6, R-0016).
 *
 * Locks TC-L6-001/002: each of the three equations must count a violation when
 * the repository facts contradict their own declaration, and the report must
 * stay silent about classes it does not probe instead of claiming cleanliness.
 */

import { describe, it, expect } from 'vitest';
import {
  assembleReport,
  probeDeclaredImplementations,
  probeEmittedErrorCodes,
  probeExceptionPointers,
  probeErrorFixStepCommands,
  probeGatePointers,
  probeProducedArtifacts,
  probeRegisteredCommandModules,
  probeSurfacePairing,
} from '../../../src/core/metrics/declaration-conformance.js';
import { ERROR_CODES } from '../../../src/core/errors.js';
import { DECLARED_UNEMITTED, DECLARED_UNEMITTED_CODES } from '../../../src/core/error-declarations.js';

describe('E1 — declaration ⊆ implementation', () => {
  it('flags an error code whose fix step names an unregistered command', () => {
    const result = probeErrorFixStepCommands(
      {
        'E-SPEC-006': { fixSteps: ['用 mumuspec design init <scope> 创建 design.md'] },
        'E-OK-001': { fixSteps: ['运行 mumuspec check'] },
      },
      new Set(['check']),
    );
    expect(result.checked).toBe(2);
    expect(result.violations.map((v) => v.subject)).toEqual(['E-SPEC-006']);
  });

  it('accepts a nested command written as "top sub"', () => {
    const result = probeErrorFixStepCommands(
      { 'E-A': { fixSteps: ['mumuspec contract boundary check'] } },
      new Set(['contract', 'contract boundary']),
    );
    expect(result.violations).toEqual([]);
  });

  it('flags a registration factory with no call site', () => {
    const result = probeRegisteredCommandModules(
      [
        { file: 'state.ts', factories: ['registerStateCommands'] },
        { file: 'ghost.ts', factories: ['registerGhostCommands'] },
      ],
      new Set(['registerStateCommands', 'registerKnowledgeCrud']),
    );
    expect(result.checked).toBe(2);
    expect(result.violations.map((v) => v.subject)).toEqual(['ghost.ts:registerGhostCommands']);
  });

  it('accepts a factory called from a parent module rather than index', () => {
    const result = probeRegisteredCommandModules(
      [{ file: 'knowledge-crud.ts', factories: ['registerKnowledgeCrud'] }],
      new Set(['registerKnowledgeCrud']),
    );
    expect(result.violations).toEqual([]);
  });

  it('flags a declared backend the implementation does not support', () => {
    const result = probeDeclaredImplementations([
      { subject: 'knowledge.code_graph.storage', declared: 'sqlite', implemented: ['builtin'] },
      { subject: 'enforcement.engine', declared: 'builtin', implemented: ['builtin'] },
    ]);
    expect(result.checked).toBe(2);
    expect(result.violations.map((v) => v.subject)).toEqual(['knowledge.code_graph.storage']);
  });
});

describe('E2 — implementation ⊆ consumer', () => {
  it('routes an unemitted code with no external citation to violations', () => {
    const { result, advisory } = probeEmittedErrorCodes(['E-X-001'], { 'a.ts': 'nothing here' });
    expect(result.checked).toBe(1);
    expect(result.violations.map((v) => v.subject)).toEqual(['E-X-001']);
    expect(advisory).toEqual([]);
  });

  it('sends an unemitted code that documents still cite to the advisory register', () => {
    const { result, advisory } = probeEmittedErrorCodes(
      ['E-Y-001', 'E-Z-001'],
      { 'a.ts': 'E-Z-001 is emitted here' },
      new Set(['E-Y-001']),
    );
    expect(result.violations).toEqual([]);
    expect(advisory.map((v) => v.subject)).toEqual(['E-Y-001']);
    // advisory items stay out of the ratio denominator — they are undecided
    expect(result.checked).toBe(1);
  });

  it('closes a code declared as reserved only while no fixture expects it', () => {
    const { result, advisory } = probeEmittedErrorCodes(
      ['E-RES-001', 'E-RES-002'],
      { 'a.ts': 'nothing here' },
      new Set(['E-RES-001', 'E-RES-002']),
      new Set(['E-RES-001', 'E-RES-002']),
      new Set(['E-RES-002']),
    );
    // E-RES-001: declared and expected by nothing → closed
    // E-RES-002: declared reserved but a corpus mustContain demands it → contradiction
    expect(result.checked).toBe(2);
    expect(result.violations.map((v) => v.subject)).toEqual(['E-RES-002']);
    expect(advisory).toEqual([]);
  });

  it('keeps a cited-but-undeclared code in the advisory register', () => {
    const { result, advisory } = probeEmittedErrorCodes(
      ['E-CITE-001'],
      { 'a.ts': 'nothing here' },
      new Set(['E-CITE-001']),
      new Set(['E-OTHER-001']),
      new Set(),
    );
    expect(result.violations).toEqual([]);
    expect(advisory.map((v) => v.subject)).toEqual(['E-CITE-001']);
  });

  it('flags a declared surface that no dispatch branch handles', () => {
    const result = probeSurfacePairing('mcp-tool', ['alpha', 'beta', 'gamma'], new Set(['alpha', 'gamma']));
    expect(result.equation).toBe('E2');
    expect(result.checked).toBe(3);
    expect(result.violations.map((v) => v.subject)).toEqual(['beta']);
  });

  it('flags a produced artifact with no consumer', () => {
    const result = probeProducedArtifacts([
      { subject: 'state.hyperplan_result', producers: 1, consumers: 0 },
      { subject: 'enforcement_coverage', producers: 1, consumers: 3 },
    ]);
    expect(result.violations.map((v) => v.subject)).toEqual(['state.hyperplan_result']);
  });

  it('does not flag something that is neither produced nor consumed', () => {
    const result = probeProducedArtifacts([{ subject: 'absent', producers: 0, consumers: 0 }]);
    expect(result.violations).toEqual([]);
  });
});

describe('E3 — gate ⊆ fact', () => {
  it('flags a strength-matrix rule with no guard reference', () => {
    const result = probeGatePointers(
      ['worktree_isolation', 'single_active_change'],
      { 'phase-guard.ts': 'if (rule.single_active_change) { ... }' },
    );
    expect(result.violations.map((v) => v.subject)).toEqual(['worktree_isolation']);
  });

  it('passes when a guard source references the rule', () => {
    const result = probeGatePointers(
      ['tdd_enforced'],
      { 'checker.ts': 'resolveWorkflowRule("tdd_enforced", strength)' },
    );
    expect(result.violations).toEqual([]);
  });
});

describe('report assembly', () => {
  it('computes a ratio per equation and keeps violation counts together', () => {
    const report = assembleReport([
      probeErrorFixStepCommands({ 'E-A': { fixSteps: ['mumuspec nope'] } }, new Set(['check'])),
      probeProducedArtifacts([{ subject: 'a', producers: 1, consumers: 0 }]),
      probeGatePointers(['r1'], { 'g.ts': 'r1' }),
    ]);
    expect(report.e1.checked).toBe(1);
    expect(report.e1.violations).toHaveLength(1);
    expect(report.e1.ratio).toBe(0);
    expect(report.e2.ratio).toBe(0);
    expect(report.e3.ratio).toBe(1);
  });

  it('an equation with nothing checked reads as satisfied, not as failure', () => {
    const report = assembleReport([]);
    expect(report.e1).toEqual({ checked: 0, violations: [], ratio: 1 });
  });

  it('declares which violation classes are not probed', () => {
    const report = assembleReport([]);
    expect(report.unprobed_classes.length).toBeGreaterThan(0);
    expect(report.advisory).toEqual([]);
  });

  it('output is order-insensitive for the same facts', () => {
    const facts = [
      probeProducedArtifacts([
        { subject: 'b', producers: 1, consumers: 0 },
        { subject: 'a', producers: 1, consumers: 0 },
      ]),
    ];
    const other = [
      probeProducedArtifacts([
        { subject: 'a', producers: 1, consumers: 0 },
        { subject: 'b', producers: 1, consumers: 0 },
      ]),
    ];
    expect(JSON.stringify(facts)).toBe(JSON.stringify(other));
  });
});

describe('E3 — always-enforce exception pointers', () => {
  it('reports exception names no check id can take', () => {
    const findings = probeExceptionPointers(
      ['zeta_inert', 'alpha_live'],
      new Set(['alpha_live', 'E-SPEC-001']),
    );
    expect(findings.map((f) => f.subject)).toEqual(['zeta_inert']);
    expect(findings[0].equation).toBe('E3');
    expect(findings[0].probe).toBe('always-enforce-exception');
  });

  it('reserves only what the registry itself declares', () => {
    expect(DECLARED_UNEMITTED_CODES).toEqual(
      Object.keys(ERROR_CODES).filter((code) => ERROR_CODES[code].reserved !== undefined),
    );
    for (const code of DECLARED_UNEMITTED_CODES) {
      expect(DECLARED_UNEMITTED[code]).toContain('无发射点');
    }
  });
});
