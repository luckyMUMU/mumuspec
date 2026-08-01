import type { SpecFile, Requirement } from '../core/types.js';

/**
 * Check for inheritance conflicts between parent and child spec.
 * Rule: child SHALL NOT cannot conflict with parent SHALL (child can tighten but not widen).
 */
export interface InheritanceConflict {
  type: 'shall-not-vs-parent-shall';
  childRequirement: string;
  childShallNot: string;
  parentRequirement: string;
  parentShall: string;
  message: string;
}

/** Check inheritance conflicts between parent and child specs */
export function checkInheritanceConflicts(
  parentSpec: SpecFile,
  childSpec: SpecFile,
): InheritanceConflict[] {
  const conflicts: InheritanceConflict[] = [];

  // Collect all parent SHALLs
  const parentShalls = collectShalls(parentSpec.requirements);

  // Collect all child SHALL NOTs
  const childShallNots = collectShallNots(childSpec.requirements);

  for (const childShallNot of childShallNots) {
    for (const parentShall of parentShalls) {
      if (isConflicting(parentShall.text, childShallNot.text)) {
        conflicts.push({
          type: 'shall-not-vs-parent-shall',
          childRequirement: childShallNot.requirement,
          childShallNot: childShallNot.text,
          parentRequirement: parentShall.requirement,
          parentShall: parentShall.text,
          message: `子层 SHALL NOT "${childShallNot.text}" 与父层 SHALL "${parentShall.text}" 矛盾`,
        });
      }
    }
  }

  return conflicts;
}

/** Collect all SHALL items from requirements */
function collectShalls(requirements: Requirement[]): { text: string; requirement: string }[] {
  const result: { text: string; requirement: string }[] = [];
  for (const req of requirements) {
    for (const shall of req.shall) {
      result.push({ text: shall, requirement: req.name });
    }
  }
  return result;
}

/** Collect all SHALL NOT items from requirements */
function collectShallNots(requirements: Requirement[]): { text: string; requirement: string }[] {
  const result: { text: string; requirement: string }[] = [];
  for (const req of requirements) {
    for (const shallNot of req.shallNot) {
      result.push({ text: shallNot, requirement: req.name });
    }
  }
  return result;
}

/** Simple heuristic to detect conflicting constraints */
function isConflicting(shall: string, shallNot: string): boolean {
  // Normalize both to lowercase for comparison
  const shallLower = shall.toLowerCase();
  const shallNotLower = shallNot.toLowerCase();

  // Check polarity: one positive (must) and one negative (forbid)
  const shallHasPositive = shallLower.includes('must') || shallLower.includes('必须') || shallLower.includes('应该');
  const shallNotHasNegative = shallNotLower.includes('禁') || shallNotLower.includes('not') || shallNotLower.includes('不得');

  if (!(shallHasPositive && shallNotHasNegative)) {
    return false;
  }

  // Extract key terms (verbs, nouns)
  const shallTerms = extractKeyTerms(shallLower);
  const shallNotTerms = extractKeyTerms(shallNotLower);

  // Require at least 2 matching key terms to reduce false positives
  // (single shared words like "npm" or "frontmatter" are not enough on their own)
  const matchingTerms = shallTerms.filter((term) => shallNotTerms.includes(term));

  // Also check for significant Chinese character overlap (handles CJK text without spaces)
  // e.g., "HTTP 协议" vs "HTTP 协议" where split produces larger chunks
  const sharedChinese = hasSignificantChineseOverlap(shallLower, shallNotLower);

  // Conflict detection requires BOTH signals to avoid false positives:
  // - Single English term (e.g., "npm") can appear in passing in unrelated rules
  // - Common Chinese grammatical phrases (e.g., "必须通过") appear across many rules
  // - Together they indicate a genuine conflict (shared topic + shared domain term)
  return matchingTerms.length >= 2 || (matchingTerms.length >= 1 && sharedChinese);
}

/**
 * Check if two CJK-containing strings share significant character overlap.
 * Returns true if they share a Chinese substring of ≥3 chars (indicating same topic).
 */
function hasSignificantChineseOverlap(a: string, b: string): boolean {
  // Extract Chinese character sequences (CJK Unified Ideographs)
  const chineseRegex = /[\u4e00-\u9fff]+/g;
  const aChinese = a.match(chineseRegex) || [];
  const bChinese = b.match(chineseRegex) || [];

  // Check if any Chinese substring of length ≥4 from A appears in B
  // Threshold: 4 chars avoids common phrases like "必须通过" (3 chars)
  for (const seq of aChinese) {
    if (seq.length >= 4 && b.includes(seq)) return true;
    // Also check substrings of length 4 within longer sequences
    if (seq.length > 4) {
      for (let i = 0; i <= seq.length - 4; i++) {
        const sub = seq.substring(i, i + 4);
        if (b.includes(sub)) return true;
      }
    }
  }
  return false;
}

/** Extract key terms from a constraint text */
function extractKeyTerms(text: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'must', 'shall', 'should', 'may', 'not', '所有', '必须', '禁止',
    '不得', '不应', '应该', '可以', '使用', '在', '的', '和', '与',
  ]);

  const words = text.split(/[\s,，。.;；:：/\\]+/).filter((w) => w.length > 1 && !stopWords.has(w));
  return words;
}

/** Merge parent and child specs (child inherits parent's constraints) */
export function mergeSpecs(parent: SpecFile, child: SpecFile): SpecFile {
  const merged: SpecFile = {
    path: child.path,
    frontmatter: child.frontmatter,
    requirements: [...child.requirements],
    raw: '',
  };

  // Add parent's SHALLs (child inherits them)
  for (const parentReq of parent.requirements) {
    const existingReq = merged.requirements.find((r) => r.name === parentReq.name);
    if (existingReq) {
      // Merge: add parent's SHALLs that don't already exist
      for (const shall of parentReq.shall) {
        if (!existingReq.shall.includes(shall)) {
          existingReq.shall.push(shall);
        }
      }
      // Add parent's SHALL NOTs (accumulate, don't override)
      for (const shallNot of parentReq.shallNot) {
        if (!existingReq.shallNot.includes(shallNot)) {
          existingReq.shallNot.push(shallNot);
        }
      }
      // Add parent's enforcement
      for (const enf of parentReq.enforcement) {
        if (!existingReq.enforcement.some((e) => e.id === enf.id)) {
          existingReq.enforcement.push(enf);
        }
      }
    } else {
      // Add the entire parent requirement
      merged.requirements.push({ ...parentReq });
    }
  }

  return merged;
}
