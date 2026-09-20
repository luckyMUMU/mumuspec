/**
 * Behavior-gate validator (engine-consolidation L2).
 *
 * A `behavior-gate` annotation declares that a red line is guarded by a real
 * gate: a registered error code with corpus kill evidence, or a named corpus
 * fixture. Resolution is fully static — registry membership plus the project's
 * own `.eval-corpus/` declarations. No subprocess, no LLM, no new parser
 * (the AST/lexical channels stay the only violance-scanning engines; a gate
 * verifies the guard exists, the guard itself scans for violations).
 */

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { MachineReadableAnnotation } from '../core/types-spec.js';
import { loadFixtureExpectation } from '../eval/corpus.js';

export interface CorpusGateIndex {
  /** Error codes declared in at least one fixture's mustContain. */
  codes: Set<string>;
  /** Fixture directory names whose mustContain is non-empty. */
  fixtures: Set<string>;
}

export interface GateResolution {
  ok: boolean;
  reason?: string;
}

/** Build the project-local corpus gate index (fs read-only, silent on unreadable dirs). */
export function buildCorpusGateIndex(projectRoot: string): CorpusGateIndex {
  const index: CorpusGateIndex = { codes: new Set(), fixtures: new Set() };
  const dir = join(projectRoot, '.eval-corpus');
  if (!existsSync(dir)) return index;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      const exp = loadFixtureExpectation(join(dir, entry.name, 'expected.yaml'));
      if (exp.mustContain.length > 0) {
        index.fixtures.add(entry.name);
        for (const code of exp.mustContain) index.codes.add(code);
      }
    } catch {
      // A fixture without/with an invalid expected.yaml declares nothing — skip.
    }
  }
  return index;
}

/** Statically resolve a behavior-gate pointer (fail-closed on unknown forms). */
export function resolveGate(
  annotation: MachineReadableAnnotation,
  registryCodes: Set<string>,
  corpus: CorpusGateIndex,
): GateResolution {
  const ref = (annotation.gate_ref ?? '').trim();
  if (!ref) return { ok: false, reason: 'gate_ref 缺失' };
  if (ref.startsWith('error-code:')) {
    const code = ref.slice('error-code:'.length);
    if (!registryCodes.has(code)) return { ok: false, reason: `错误码 ${code} 未注册` };
    if (!corpus.codes.has(code)) return { ok: false, reason: `错误码 ${code} 无任何语料 mustContain 命中` };
    return { ok: true };
  }
  if (ref.startsWith('corpus:')) {
    const fixture = ref.slice('corpus:'.length);
    if (!corpus.fixtures.has(fixture)) return { ok: false, reason: `语料 fixture ${fixture} 不存在或未声明 mustContain` };
    return { ok: true };
  }
  return { ok: false, reason: `gate_ref 形态不识别：${ref}` };
}
