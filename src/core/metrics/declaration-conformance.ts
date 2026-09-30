/**
 * Declaration conformance — three closure equalities (core-consolidation L6, R-0016).
 *
 * "Implementation completeness" here is not a feature checklist; it is three
 * mechanical equations:
 *
 *   E1 declaration ⊆ implementation — anything a config field, an error-code fix
 *      step or a command help text promises must exist.
 *   E2 implementation ⊆ consumer — every produced artifact must be consumed.
 *   E3 gate ⊆ fact — a gate that claims to hold something must have a checker.
 *
 * All probes are pure functions over caller-supplied facts (the CLI feeds them
 * from the live command registry, config defaults, error table and guard
 * sources). No LLM judgement, no hand-written numbers — a violation is either
 * derivable from repository facts or it is not reported.
 *
 * Scope honesty: the probe set defines what is checked. A violation class with
 * no probe is NOT covered, and `unprobed_classes` reports that gap rather than
 * implying a clean bill of health.
 */

export type Equation = 'E1' | 'E2' | 'E3';

export interface ConformanceViolation {
  equation: Equation;
  probe: string;
  subject: string;
  detail: string;
}

export interface ConformanceProbeResult {
  probe: string;
  equation: Equation;
  checked: number;
  violations: ConformanceViolation[];
}

export interface ConformanceReport {
  e1: { checked: number; violations: ConformanceViolation[]; ratio: number };
  e2: { checked: number; violations: ConformanceViolation[]; ratio: number };
  e3: { checked: number; violations: ConformanceViolation[]; ratio: number };
  probes: ConformanceProbeResult[];
  /** Detected but not ratio-counted: requires a human call (emit or retract). */
  advisory: ConformanceViolation[];
  unprobed_classes: string[];
}

/**
 * Violation classes that no probe covers yet — surfaced, never silently green.
 * Boundary-symbol drift is not listed here: it is judged, just judged by
 * `mumuspec sync --check` (declaration ⊆ code) rather than by this metric.
 */
export const UNPROBED_CLASSES: readonly string[] = [
  '伴生能力接线（清单侧的 wired 集合已由测试锁定；守卫侧引用该集合的事实未建探针）',
  'fixSteps 所述能力与命令实际能力是否相符（名字解析可判定存在性，语义不可）',
];

function ratio(checked: number, violations: number): number {
  if (checked === 0) return 1;
  return (checked - violations) / checked;
}

/**
 * E1 · error-code fix steps must name a command that is actually registered.
 * `commandIndex` holds both `top` and `top sub` keys as they appear in help.
 */
export function probeErrorFixStepCommands(
  errorCodes: Record<string, { fixSteps?: string[] }>,
  commandIndex: ReadonlySet<string>,
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  let checked = 0;
  for (const [code, def] of Object.entries(errorCodes).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    for (const step of def.fixSteps ?? []) {
      for (const match of step.matchAll(/\bmumuspec\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?/g)) {
        const [, head, sub] = match;
        if (['npm', 'npx', 'git', 'node', 'run', 'install'].includes(head)) continue;
        checked++;
        const candidate = sub ? `${head} ${sub}` : head;
        const known = commandIndex.has(candidate) || (sub && commandIndex.has(head));
        if (!known) {
          violations.push({
            equation: 'E1',
            probe: 'error-fixstep-command',
            subject: code,
            detail: `fixSteps 指向未注册命令 "mumuspec ${candidate}"`,
          });
        }
      }
    }
  }
  return { probe: 'error-fixstep-command', equation: 'E1', checked, violations };
}

/**
 * E1 · a registration factory defined by a command module must be called.
 *
 * Factory naming is not uniform (nested sub-commands are wired by the parent
 * module), so the probe compares *definitions* against *call sites* instead of
 * deriving a name from the file stem. "Has tests" never counts as registration.
 */
export function probeRegisteredCommandModules(
  definitions: readonly { file: string; factories: readonly string[] }[],
  callSites: ReadonlySet<string>,
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  const sorted = [...definitions].sort((a, b) => (a.file < b.file ? -1 : 1));
  for (const def of sorted) {
    for (const factory of [...def.factories].sort()) {
      if (!callSites.has(factory)) {
        violations.push({
          equation: 'E1',
          probe: 'command-module-registered',
          subject: `${def.file}:${factory}`,
          detail: '命令模块定义了注册工厂，但 CLI 装载面没有任何调用点（未注册即不可达）',
        });
      }
    }
  }
  return {
    probe: 'command-module-registered',
    equation: 'E1',
    checked: sorted.reduce((sum, d) => sum + d.factories.length, 0),
    violations,
  };
}

/** E1 · a declared backend/variant must be one the code actually implements. */
export function probeDeclaredImplementations(
  declarations: readonly { subject: string; declared: string; implemented: readonly string[] }[],
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  const sorted = [...declarations].sort((a, b) => (a.subject < b.subject ? -1 : 1));
  for (const d of sorted) {
    if (!d.implemented.includes(d.declared)) {
      violations.push({
        equation: 'E1',
        probe: 'declared-implementation',
        subject: d.subject,
        detail: `声明 "${d.declared}"，实现支持的集合为 [${d.implemented.join(', ')}]`,
      });
    }
  }
  return { probe: 'declared-implementation', equation: 'E1', checked: sorted.length, violations };
}

/** E2 · a produced artifact must have a declared consumer. */
export function probeProducedArtifacts(
  artifacts: readonly { subject: string; producers: number; consumers: number }[],
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  const sorted = [...artifacts].sort((a, b) => (a.subject < b.subject ? -1 : 1));
  for (const a of sorted) {
    if (a.producers > 0 && a.consumers === 0) {
      violations.push({
        equation: 'E2',
        probe: 'produced-artifact-consumer',
        subject: a.subject,
        detail: `产出 ${a.producers} 处而消费者 0 处（死端）`,
      });
    }
  }
  return { probe: 'produced-artifact-consumer', equation: 'E2', checked: sorted.length, violations };
}

/**
 * E3 · a workflow rule named in the strength matrix must be referenced by a
 * guard source file. A rule nobody checks is a dangling gate pointer.
 */
export function probeGatePointers(
  ruleKeys: readonly string[],
  guardSources: Readonly<Record<string, string>>,
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  const haystack = Object.entries(guardSources)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, text]) => text)
    .join('\n');
  const sortedKeys = [...ruleKeys].sort();
  for (const key of sortedKeys) {
    if (!haystack.includes(key)) {
      violations.push({
        equation: 'E3',
        probe: 'gate-pointer-enforcement',
        subject: key,
        detail: '出现在强度矩阵中，但没有任何守卫源码引用该规则',
      });
    }
  }
  return { probe: 'gate-pointer-enforcement', equation: 'E3', checked: sortedKeys.length, violations };
}

/** E2 · a declared surface must be dispatched (tool declared ⇒ handler exists). */
export function probeSurfacePairing(
  kind: string,
  declared: readonly string[],
  handled: ReadonlySet<string>,
): ConformanceProbeResult {
  const violations: ConformanceViolation[] = [];
  for (const name of [...declared].sort()) {
    if (!handled.has(name)) {
      violations.push({
        equation: 'E2',
        probe: `surface-pairing-${kind}`,
        subject: name,
        detail: `已对外声明但调用面无分发实现（声明即产物，无人消费）`,
      });
    }
  }
  return { probe: `surface-pairing-${kind}`, equation: 'E2', checked: declared.length, violations };
}

/**
 * E2 · a registered error code must have an emission site.
 *
 * A code nobody emits is a promise in the table that no path can ever keep.
 * `sources` must exclude the error table itself (otherwise every code would
 * appear self-emitted).
 *
 * `documented` carries the codes that normative documents or tests still refer
 * to. Those go to the advisory register instead of the ratio: the correct fix is
 * to implement the emitter or retract the claim, and that requires human
 * adjudication — counting them as closed would be a false green, deleting them
 * silently would break the documents that cite them.
 *
 * `declaredUnemitted` is a *declared* reserved slot (the reason lives in the
 * table, not in the metric). A declaration closes a code only when nothing
 * actually expects it to fire: `corpusExpected` names the codes some fixture's
 * mustContain still demands. A code declared unemitted yet required by the
 * corpus is a contradiction and counts as a violation, so the declaration
 * cannot be used as an unconditional escape hatch.
 */
export function probeEmittedErrorCodes(
  codes: readonly string[],
  sources: Readonly<Record<string, string>>,
  documented: ReadonlySet<string> = new Set(),
  declaredUnemitted: ReadonlySet<string> = new Set(),
  corpusExpected: ReadonlySet<string> = new Set(),
): { result: ConformanceProbeResult; advisory: ConformanceViolation[] } {
  const violations: ConformanceViolation[] = [];
  const advisory: ConformanceViolation[] = [];
  const haystack = Object.entries(sources)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, text]) => text)
    .join('\n');
  const sorted = [...codes].sort();
  for (const code of sorted) {
    if (haystack.includes(code)) continue;
    if (declaredUnemitted.has(code)) {
      if (corpusExpected.has(code)) {
        violations.push({
          equation: 'E2',
          probe: 'error-code-emitted',
          subject: code,
          detail: '声明为无发射点，但语料 mustContain 仍期望命中（声明与期望矛盾）',
        });
      }
      continue;
    }
    const target = documented.has(code) ? advisory : violations;
    target.push({
      equation: 'E2',
      probe: 'error-code-emitted',
      subject: code,
      detail: documented.has(code)
        ? '无发射点，但规范文档或测试仍引用该码——补发射器或撤回声明，需人工裁决'
        : '已注册错误码，装载面与文档均无引用（纯残留）',
    });
  }
  return {
    result: { probe: 'error-code-emitted', equation: 'E2', checked: sorted.length - advisory.length, violations },
    advisory,
  };
}

/**
 * E3 · every `always_enforce` exception name must resolve to a check id the
 * evaluator can actually see. Strength folding calls `evaluateConstraint()` with
 * `{ id: <error code> }` (checker.ts) or a fixed hook id (hooks/guard.ts), so a
 * name that matches neither is an inert entry in a registry whose whole purpose
 * is "this one cannot be turned down".
 *
 * Reported as advisory, not violation: both honest fixes need a human ruling —
 * remapping the names onto real codes *strengthens* folding behaviour (red line:
 * no un-signed change to `constraint_strength`), while retiring the list rewrites
 * normative documents that advertise it.
 */
export function probeExceptionPointers(
  exceptionNames: readonly string[],
  resolvableIds: ReadonlySet<string>,
): ConformanceViolation[] {
  return [...exceptionNames]
    .sort()
    .filter((name) => !resolvableIds.has(name))
    .map((name) => ({
      equation: 'E3' as const,
      probe: 'always-enforce-exception',
      subject: name,
      detail: '出现在 BUILTIN_CONSTRAINT_EXCEPTIONS 中，但没有任何 check id 取该值（例外条目不参与求值）',
    }));
}

export function assembleReport(
  results: readonly ConformanceProbeResult[],
  advisory: readonly ConformanceViolation[] = [],
): ConformanceReport {
  const byEquation = (equation: Equation) => {
    const subset = results.filter((r) => r.equation === equation);
    const checked = subset.reduce((sum, r) => sum + r.checked, 0);
    const violations = subset.flatMap((r) => r.violations);
    return { checked, violations, ratio: ratio(checked, violations.length) };
  };
  return {
    e1: byEquation('E1'),
    e2: byEquation('E2'),
    e3: byEquation('E3'),
    probes: [...results],
    advisory: [...advisory],
    unprobed_classes: [...UNPROBED_CLASSES],
  };
}
