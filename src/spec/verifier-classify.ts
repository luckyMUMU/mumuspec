/**
 * Verifier Classifier — constraint verifiability classification (P0, 2026-08-29).
 *
 * Implements the four-class model from `review/proposal-verifier-semantics-2026-08-29.md`
 * §3.1. Every SHALL / SHALL NOT constraint is classified, in fixed order (first
 * match wins):
 *
 *   R1 enforced-strong — SHALL NOT has a non-custom frontmatter annotation or
 *                        an `ast:` prefix → AST channel really executes.
 *   R2 enforced-weak   — SHALL NOT text is regex-extractable (quoted terms,
 *                        eval / 动态执行 / jsx keywords) → lexical channel executes.
 *   R3 manual          — block-level Enforcement declared (explicit `manual(...)`
 *                        or legacy free text) → human verification with verify-
 *                        stage evidence obligation.
 *   R4 unverifiable    — none of the above → format defect (E-SPEC-015 for
 *                        SHALL NOT, E-SPEC-004 for SHALL).
 *
 * SHALL constraints have no automated channel today (honest state, proposal
 * N1: no new engines), so they only classify as manual / unverifiable.
 *
 * Pure functions, no I/O — callers (validator, guard, CLI, MCP) supply parsed
 * specs. Shared regex helpers are consumed by guard/checker.ts so the lexical
 * fallback and the classifier cannot drift apart.
 */

import type {
  Requirement,
  EnforcementRule,
  ProhibitionAnnotation,
  MachineReadableAnnotation,
} from '../core/types-spec.js';
import type { EnforcementCoverage } from '../core/types-workflow.js';

/** The four verifiability classes (proposal §3.1). */
export type VerifiabilityClass = 'enforced-strong' | 'enforced-weak' | 'manual' | 'unverifiable';

export type ConstraintPolarity = 'shall' | 'shall-not';

/** One classified constraint item (a single SHALL / SHALL NOT bullet). */
export interface ClassifiedItem {
  requirement: string;
  polarity: ConstraintPolarity;
  text: string;
  cls: VerifiabilityClass;
  /** Matched machine-readable annotation (same text as the constraint item). */
  annotation?: MachineReadableAnnotation;
  /** For enforced-weak: channel origin — 'lex' (explicit prefix) or 'legacy' (fallback). */
  weakSource?: 'lex' | 'legacy';
  /** Enforcement anchor for manual evidence matching (first block-level rule). */
  enforcementId?: string;
  enforcementDescription?: string;
  /** Whether the manual class comes from an explicit `manual(...)` declaration. */
  explicitManual?: boolean;
  source: string;
}

/** Classification policy options (defaults preserve current behavior). */
export interface ClassificationOpts {
  /**
   * When false, the lexical channel (enforced-weak) requires an explicit
   * `lex:` prefix; unannotated SHALL NOT texts no longer auto-fall back.
   * Default true (legacy compatibility).
   */
  legacyLexical?: boolean;
}

/** Input to classifyConstraint. */
export interface VerifiableConstraint {
  requirement: string;
  polarity: ConstraintPolarity;
  text: string;
  /** Frontmatter prohibitions annotations (whole file) — matched by exact text. */
  annotations: ProhibitionAnnotation[];
  /** Block-level Enforcement rules (apply to every item in the Requirement). */
  enforcement: EnforcementRule[];
  source: string;
}

// ════════════════════════════════════════════════════════════════════
// Shared lexical channel (R2) — consumed by guard/checker.ts too
// ════════════════════════════════════════════════════════════════════

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * engine-consolidation L1: strip the `ast:` / `lex:` channel markers so that
 * exemption and scan routing see the same body text regardless of how the
 * author declared the channel. A marker selects classification provenance;
 * it must never change the execution path (root cause of the batch-1 15-FP
 * regression where `lex:` broke the system-behavior exemption).
 */
export function stripChannelMarker(text: string): string {
  return text.replace(/^\s*(ast|lex):\s*/i, '').trim();
}

/**
 * Whether the regex fallback channel can extract checkable patterns from a
 * prohibition text: quoted terms (>2 chars), eval / 动态执行, or jsx keywords.
 * Mirrors guard/checker.ts checkProhibitionViolation's fallback conditions.
 */
export function isRegexCheckable(text: string): boolean {
  const lower = stripChannelMarker(text).toLowerCase();
  if (lower.includes('jsx') || lower.includes('tsx')) return true;
  if (/\beval\b/.test(lower) || lower.includes('动态执行')) return true;
  const quoted = text.match(/[`'"]([^`'"]+)[`'"]/g);
  return !!quoted?.some((q) => q.replace(/[`'"]/g, '').length > 2);
}

/**
 * Extract quoted terms from a constraint text (single source of truth shared
 * by extractRegexPatterns and guard/checker.ts's per-term affinity rules).
 */
export function extractQuotedTerms(text: string): string[] {
  const quoted = text.match(/[`'"]([^`'"]+)[`'"]/g) ?? [];
  return quoted.map((q) => q.replace(/[`'"]/g, '')).filter((t) => t.length > 2);
}

/**
 * Build the regex fallback patterns for a prohibition text. Single source of
 * truth shared with guard/checker.ts (prevents classifier/linter regex drift).
 */
export function extractRegexPatterns(text: string): RegExp[] {
  const lower = text.replace(/^ast:/i, '').toLowerCase();
  const patterns: RegExp[] = [];
  for (const term of extractQuotedTerms(text)) {
    const escaped = escapeRegExp(term);
    // Word boundary for short identifiers to avoid substring false positives
    patterns.push(
      term.length <= 4 ? new RegExp(`\\b${escaped}\\b`, 'i') : new RegExp(escaped, 'i'),
    );
  }
  if (/\beval\b/.test(lower) || lower.includes('动态执行')) {
    patterns.push(/eval\s*\(/, /new\s+Function\s*\(/);
  }
  return patterns;
}

// ════════════════════════════════════════════════════════════════════
// Classification
// ════════════════════════════════════════════════════════════════════

/** Classify one constraint item (R1 → R4 fixed order). */
export function classifyConstraint(
  c: VerifiableConstraint,
  opts?: ClassificationOpts,
): VerifiabilityClass {
  // R1 — annotation channel (authoritative when present; polarity-neutral)
  const matched = c.annotations.find((a) => a.text === c.text);
  if (matched?.annotation && matched.annotation.type !== 'custom') return 'enforced-strong';
  if (c.text.startsWith('ast:')) return 'enforced-strong';
  if (c.polarity === 'shall-not') {
    // R2 — lexical channel: explicit `lex:` prefix, or legacy fallback (opt-in).
    // SHALL has no weak tier.
    if (c.text.startsWith('lex:')) return 'enforced-weak';
    if ((opts?.legacyLexical ?? true) !== false && isRegexCheckable(c.text)) return 'enforced-weak';
  }
  // R3 — manual (explicit or legacy implicit); applies to both polarities
  if (c.enforcement.length > 0) return 'manual';
  // R4 — no channel, no declaration
  return 'unverifiable';
}

/** Whether an enforcement rule is an explicit `manual(...)` declaration. */
export function isExplicitManual(rule: EnforcementRule): boolean {
  return rule.kind === 'manual';
}

/**
 * Classify every SHALL / SHALL NOT item of the given requirement blocks.
 * SHOULD items never require enforcement (proposal N3).
 */
export function classifyRequirements(
  reqs: Requirement[],
  annotations: ProhibitionAnnotation[],
  source: string,
  opts?: ClassificationOpts,
): ClassifiedItem[] {
  const items: ClassifiedItem[] = [];
  for (const req of reqs) {
    const explicit = req.enforcement.some(isExplicitManual);
    for (const text of req.shall) {
      items.push(makeItem(req.name, 'shall', text, req.enforcement, explicit, annotations, source, opts));
    }
    for (const text of req.shallNot) {
      items.push(makeItem(req.name, 'shall-not', text, req.enforcement, explicit, annotations, source, opts));
    }
  }
  return items;
}

function makeItem(
  requirement: string,
  polarity: ConstraintPolarity,
  text: string,
  enforcement: EnforcementRule[],
  explicit: boolean,
  annotations: ProhibitionAnnotation[],
  source: string,
  opts?: ClassificationOpts,
): ClassifiedItem {
  const cls = classifyConstraint({ requirement, polarity, text, annotations, enforcement, source }, opts);
  const anchor = enforcement[0];
  return {
    requirement,
    polarity,
    text,
    cls,
    annotation: annotations.find((a) => a.text === text)?.annotation,
    weakSource: cls === 'enforced-weak' ? (text.startsWith('lex:') ? 'lex' : 'legacy') : undefined,
    enforcementId: anchor?.id,
    enforcementDescription: anchor?.description,
    explicitManual: cls === 'manual' ? explicit : undefined,
    source,
  };
}

// ════════════════════════════════════════════════════════════════════
// Coverage (proposal §3.5)
// ════════════════════════════════════════════════════════════════════

const MAX_UNVERIFIABLE_DETAILS = 50;

/** Aggregate classified items into the enforcement coverage report. */
export function computeEnforcementCoverage(items: ClassifiedItem[]): EnforcementCoverage {
  const total = items.length;
  const counts = { strong: 0, weak: 0, manual: 0, unverifiable: 0 };
  const details: EnforcementCoverage['unverifiable_items'] = [];
  const actionable: EnforcementCoverage['actionable_weak'] = [];
  let legacyWeak = 0;
  for (const item of items) {
    switch (item.cls) {
      case 'enforced-strong': counts.strong++; break;
      case 'enforced-weak':
        counts.weak++;
        // Legacy-fallback weak items are the "add annotation" action items.
        if (item.weakSource === 'legacy') {
          legacyWeak++;
          actionable.push({ requirement: item.requirement, text: item.text, source: item.source });
        }
        break;
      case 'manual': counts.manual++; break;
      case 'unverifiable':
        counts.unverifiable++;
        if (details.length < MAX_UNVERIFIABLE_DETAILS) {
          details.push({
            requirement: item.requirement,
            polarity: item.polarity,
            text: item.text,
            source: item.source,
          });
        }
        break;
    }
  }
  return {
    total,
    enforced_strong: counts.strong,
    enforced_weak: counts.weak,
    manual: counts.manual,
    unverifiable: counts.unverifiable,
    declared_ratio: total === 0 ? 0 : (total - counts.unverifiable) / total,
    strong_ratio: total === 0 ? 0 : counts.strong / total,
    unverifiable_items: details,
    legacy_weak: legacyWeak,
    actionable_weak: actionable,
  };
}

// ════════════════════════════════════════════════════════════════════
// constraints.yaml entries (proposal §3.1 — same classification)
// ════════════════════════════════════════════════════════════════════

interface MinimalConstraintEntry {
  id: string;
  content: string;
  enforcement: string;
  annotation?: MachineReadableAnnotation;
}

/**
 * Classify a constraints.yaml ConstraintEntry (enforcement-gap A3.3).
 * Same judgment order as spec items: R1 annotation/ast: ⇒ strong,
 * explicit `lex:` prefix ⇒ weak, then enforcement declaration ⇒ manual,
 * legacy lexical fallback (opt-in) ⇒ weak, else unverifiable.
 */
export function classifyConstraintEntry(
  entry: MinimalConstraintEntry,
  opts?: ClassificationOpts,
): VerifiabilityClass {
  if (entry.annotation && entry.annotation.type !== 'custom') return 'enforced-strong';
  const content = entry.content ?? '';
  if (content.startsWith('ast:')) return 'enforced-strong';
  if (content.startsWith('lex:')) return 'enforced-weak';
  const enforcement = (entry.enforcement ?? '').trim();
  if (enforcement !== '') return 'manual';
  if ((opts?.legacyLexical ?? true) !== false && isRegexCheckable(content)) return 'enforced-weak';
  return 'unverifiable';
}

/**
 * Project a constraints.yaml entry into a ClassifiedItem so the guard
 * execution pipeline and enforcement coverage consume entries through the
 * same machinery as spec.md items (no second check implementation).
 */
export function constraintEntryToItem(
  entry: MinimalConstraintEntry,
  direction: 'forward' | 'reverse',
  sourcePath: string,
  opts?: ClassificationOpts,
): ClassifiedItem {
  const polarity: ConstraintPolarity = direction === 'forward' ? 'shall' : 'shall-not';
  const cls = classifyConstraintEntry(entry, opts);
  const enforcement = (entry.enforcement ?? '').trim();
  return {
    requirement: `constraints:${entry.id}`,
    polarity,
    text: entry.content,
    cls,
    annotation: entry.annotation,
    weakSource: cls === 'enforced-weak'
      ? ((entry.content ?? '').startsWith('lex:') ? 'lex' : 'legacy')
      : undefined,
    enforcementId: enforcement !== '' ? entry.id : undefined,
    enforcementDescription: enforcement !== '' ? enforcement : undefined,
    explicitManual: cls === 'manual' ? enforcement.startsWith('manual') : undefined,
    source: sourcePath,
  };
}

// ════════════════════════════════════════════════════════════════════
// Manual evidence matching (proposal §3.3 E-VERIFY-003)
// ════════════════════════════════════════════════════════════════════

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** One structured manual-evidence record found in verify.md. */
export interface StructuredEvidence {
  constraintId: string;
  user?: string;
  verdict?: string;
  timestamp?: string;
  evidenceHash?: string;
}

/**
 * Extract structured evidence records ({constraintId: ..., ...}) from verify.md.
 * Tolerant parsing: quotes optional, key order free, inline prefix allowed.
 * Pure function — caller decides how the records are consumed.
 */
export function parseStructuredEvidence(verifyContent: string): StructuredEvidence[] {
  const records: StructuredEvidence[] = [];
  const blockRe = /\{([^{}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(verifyContent)) !== null) {
    if (!block[1].includes('constraintId')) continue;
    const kv: Record<string, string> = {};
    const kvRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*["']?([^"',}\s]+)/g;
    let field: RegExpExecArray | null;
    while ((field = kvRe.exec(block[1])) !== null) {
      kv[field[1]] = field[2];
    }
    if (!kv.constraintId) continue;
    records.push({
      constraintId: kv.constraintId,
      user: kv.user,
      verdict: kv.verdict,
      timestamp: kv.timestamp,
      evidenceHash: kv.evidence_hash ?? kv.evidenceHash,
    });
  }
  return records;
}

/**
 * Return the manual-class items whose verification record is missing from the
 * verify.md content. Evidence anchors (priority order): structured record with
 * a matching constraintId and a non-empty verdict/evidence_hash; the
 * Enforcement ID in the text; the constraint text (normalized; long texts
 * anchor on their first 24 chars). Non-manual classes never require evidence.
 */
export function missingManualEvidence(
  verifyContent: string,
  items: ClassifiedItem[],
): ClassifiedItem[] {
  // Strip structured-record braces before legacy anchor matching so an
  // incomplete record cannot self-satisfy via its own enforcementId text.
  const haystack = normalize(verifyContent.replace(/\{[^{}]*\}/g, ' '));
  // Structured records — only structurally complete ones satisfy (verdict + evidence_hash).
  const byId = new Map<string, StructuredEvidence>();
  for (const rec of parseStructuredEvidence(verifyContent)) {
    if (rec.verdict && rec.evidenceHash) byId.set(normalize(rec.constraintId), rec);
  }
  return items.filter((item) => {
    if (item.cls !== 'manual') return false;
    if (item.enforcementId && byId.has(normalize(item.enforcementId))) return false;
    if (item.enforcementId && haystack.includes(normalize(item.enforcementId))) return false;
    const needle = normalize(item.text);
    const anchor = needle.length > 24 ? needle.slice(0, 24) : needle;
    return !haystack.includes(anchor);
  });
}
