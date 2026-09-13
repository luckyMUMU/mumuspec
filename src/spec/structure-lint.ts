/**
 * Structure lint — mechanical checkability features of constraint text (P0,
 * 2026-09-13). Complements verifier-classify: the four-class model decides
 * whether a constraint HAS a verification channel; this module decides whether
 * the text is structurally decidable at all. Vague unbounded qualifiers make a
 * constraint permanently satisfiable-in-word and unfalsifiable-in-practice.
 *
 * Pure functions, no I/O — consumed by spec/validator.ts (single consumer,
 * same-batch delivery; no dead-end artifacts).
 */

/**
 * Conservative word list of unbounded qualifiers. Substring matching (no
 * tokenization); false-positive rate is controlled by keeping the list tight.
 * Single source of truth — consumers must import, never copy.
 */
export const VAGUE_QUALIFIERS = [
  '合理',
  '适当',
  '必要时',
  '尽量',
  '尽可能',
  '酌情',
  '视情况',
] as const;

export interface StructureFinding {
  /** Matched qualifiers, deduplicated, in word-list order. */
  qualifiers: string[];
}

/** Lint one constraint text; null when clean. */
export function lintConstraintText(text: string): StructureFinding | null {
  const qualifiers: string[] = [];
  for (const q of VAGUE_QUALIFIERS) {
    if (text.includes(q) && !qualifiers.includes(q)) {
      qualifiers.push(q);
    }
  }
  return qualifiers.length > 0 ? { qualifiers } : null;
}
