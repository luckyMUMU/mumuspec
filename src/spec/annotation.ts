/**
 * P1-1 Fix: Semantic annotation engine for SHALL NOT constraints
 * Maps natural language prohibitions to machine-readable AST-checkable annotations
 */

import type {
  MachineReadableAnnotation,
  ProhibitionAnnotation,
  SpecFrontmatter,
} from '../core/types-spec.js';
import type { Requirement } from '../core/types-spec.js';

/** Known annotation patterns for common prohibition types */
const KNOWN_PATTERNS: Array<{
  pattern: RegExp;
  annotation: MachineReadableAnnotation;
}> = [
  {
    pattern: /禁止.*引入.*依赖|禁止.*新增.*依赖|YAGNI|不被请求的抽象/,
    annotation: { type: 'no-new-dependency', scope: 'module', rationale: 'Matches YAGNI/unrequested dependency prohibition' },
  },
  {
    pattern: /禁止.*可变状态|禁止.*修改.*外部|不得.*副作用/,
    annotation: { type: 'no-mutable-state', scope: 'function', rationale: 'Matches no-side-effect prohibition' },
  },
  {
    pattern: /禁止.*样板代码|禁止.*重复代码|DRY/,
    annotation: { type: 'no-side-effect', scope: 'module', rationale: 'Matches boilerplate prohibition' },
  },
  {
    pattern: /禁止.*全局变量|禁止.*全局状态/,
    annotation: { type: 'no-global-state', scope: 'file', rationale: 'Matches no-global-state prohibition' },
  },
  {
    pattern: /纯函数|必须幂等|无副作用/,
    annotation: { type: 'pure-function', scope: 'function', rationale: 'Matches pure-function requirement' },
  },
];

/**
 * Auto-generate annotation for a prohibition text using pattern matching.
 * Returns null if no pattern matches (requires manual annotation).
 */
export function autoAnnotate(prohibitionText: string): MachineReadableAnnotation | null {
  for (const { pattern, annotation } of KNOWN_PATTERNS) {
    if (pattern.test(prohibitionText)) {
      return { ...annotation, rationale: `${annotation.rationale} (auto-detected)` };
    }
  }
  return null;
}

/**
 * Generate annotations for all requirements in a spec file.
 * Returns new annotations array and a list of prohibition texts that need manual annotation.
 */
export function generateAnnotations(
  requirements: Requirement[],
  existingAnnotations: ProhibitionAnnotation[] = [],
): {
  annotations: ProhibitionAnnotation[];
  needsManual: Array<{ requirementName: string; prohibitionText: string }>;
} {
  const annotations: ProhibitionAnnotation[] = [...existingAnnotations];
  const needsManual: Array<{ requirementName: string; prohibitionText: string }> = [];

  for (const req of requirements) {
    for (const prohibitionText of req.shallNot) {
      // Check if already annotated
      const existing = annotations.find(a => a.text === prohibitionText);
      if (existing) continue;

      const annotation = autoAnnotate(prohibitionText);
      if (annotation) {
        annotations.push({ text: prohibitionText, annotation });
      } else {
        needsManual.push({ requirementName: req.name, prohibitionText });
      }
    }
  }

  return { annotations, needsManual };
}

/**
 * Merge annotations into spec frontmatter.
 */
export function mergeAnnotationsIntoFrontmatter(
  frontmatter: SpecFrontmatter,
  annotations: ProhibitionAnnotation[],
): SpecFrontmatter {
  return {
    ...frontmatter,
    prohibitions: annotations,
  };
}

/**
 * Get the machine-readable annotation for a given prohibition text.
 */
export function getAnnotationForProhibition(
  frontmatter: SpecFrontmatter,
  prohibitionText: string,
): MachineReadableAnnotation | undefined {
  return frontmatter.prohibitions?.find(
    a => a.text === prohibitionText || prohibitionText.includes(a.text) || a.text.includes(prohibitionText),
  )?.annotation;
}
