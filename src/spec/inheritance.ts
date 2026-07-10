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

  // If SHALL says "must use X" and SHALL NOT says "禁止使用 X" (or "must not use X")
  // Look for direct negation patterns

  // Extract key terms (verbs, nouns)
  const shallTerms = extractKeyTerms(shallLower);
  const shallNotTerms = extractKeyTerms(shallNotLower);

  // Check if they reference the same action with opposite polarity
  // e.g., "must use X" vs "禁止使用 X"
  for (const term of shallTerms) {
    if (shallNotTerms.includes(term)) {
      // Same term in both - potential conflict
      // Check if one says "must" and other says "not/禁止"
      const shallHasPositive = shallLower.includes('must') || shallLower.includes('必须') || shallLower.includes('应该');
      const shallNotHasNegative = shallNotLower.includes('禁止') || shallNotLower.includes('not') || shallNotLower.includes('不得');

      if (shallHasPositive && shallNotHasNegative) {
        return true;
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
