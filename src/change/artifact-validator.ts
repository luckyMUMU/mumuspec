/**
 * Artifact validator — completeness gate artifacts (open-questions.yaml / assumptions.yaml).
 *
 * KP-0060 axiom 3: "校验归代码，先校验器后消费者" — this module is the sole
 * schema/semantic validator for gate artifacts. The phase guard refuses to
 * consume invalid artifacts (fail-closed) rather than degrading.
 *
 * Schema v1 (C4, versioned for forward compatibility):
 *   version: 1
 *   change: <name>
 *   items:
 *     - id: OQ-1            # AS-1 for assumptions
 *       question: <string>  # assumption: <string> for assumptions kind
 *       status: open        # open | resolved | accepted | deferred
 *       resolution?:        # required when status != open
 *         decision_ref: <decisions.md entry timestamp>
 *         note?: <string>   # required when deferred
 *
 * Unknown item fields are advisory (ignored by validation, forward compatible):
 * LLM advisory completeness markers never enter the gate decision path.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getChangeDir } from './paths.js';

export type ArtifactKind = 'open-questions' | 'assumptions';

export const ARTIFACT_SCHEMA_VERSION = 1;

export const ARTIFACT_STATUSES = ['open', 'resolved', 'accepted', 'deferred'] as const;
export type ArtifactStatus = (typeof ARTIFACT_STATUSES)[number];

export interface ArtifactResolution {
  decision_ref?: unknown;
  note?: unknown;
  [key: string]: unknown;
}

export interface ArtifactItem {
  id?: unknown;
  question?: unknown;
  assumption?: unknown;
  status?: unknown;
  resolution?: unknown;
  [key: string]: unknown; // advisory fields — never validated as gate input
}

export interface ArtifactData {
  version?: unknown;
  change?: unknown;
  items?: unknown;
  [key: string]: unknown; // advisory top-level fields (e.g. completeness markers)
}

export interface ArtifactDiagnostic {
  code: 'E-CHANGE-020' | 'E-CHANGE-021';
  path: string; // JSON-ish path into the artifact, e.g. 'items[0].resolution.decision_ref'
  message: string;
}

export interface ArtifactValidationResult {
  exists: boolean;
  isValid: boolean;
  errors: ArtifactDiagnostic[];
  /** ids of items with status === 'open' (guard block diagnostics) */
  openItemIds: string[];
  /** parsed items (empty when artifact missing or schema-invalid) */
  items: ArtifactItem[];
}

const QUESTION_FIELD: Record<ArtifactKind, string> = {
  'open-questions': 'question',
  assumptions: 'assumption',
};

/** decisions.md entry heading: `## [<phase>] <timestamp>` — timestamp is the decision_ref anchor */
const DECISION_HEADING_RE = /^##\s*\[[a-z-]+\]\s*(\S[^\n]*)$/gm;

/** Extract all decision_ref anchors (entry timestamps) from decisions.md content */
export function extractDecisionRefs(decisionsContent: string): string[] {
  const refs: string[] = [];
  for (const match of decisionsContent.matchAll(DECISION_HEADING_RE)) {
    refs.push(match[1].trim());
  }
  return refs;
}

/** Schema layer — structural/type/enum validation. All failures → E-CHANGE-020. */
export function validateArtifactSchema(
  data: ArtifactData,
  kind: ArtifactKind,
  changeName: string
): ArtifactDiagnostic[] {
  const errors: ArtifactDiagnostic[] = [];
  const textField = QUESTION_FIELD[kind];

  if (data.version === undefined || data.version === null) {
    errors.push({ code: 'E-CHANGE-020', path: 'version', message: '缺少 version 字段' });
  } else if (data.version !== ARTIFACT_SCHEMA_VERSION) {
    errors.push({
      code: 'E-CHANGE-020',
      path: 'version',
      message: `不支持的 schema 版本: ${String(data.version)}（当前支持 version: ${ARTIFACT_SCHEMA_VERSION}）`,
    });
  }

  if (typeof data.change !== 'string' || data.change.length === 0) {
    errors.push({ code: 'E-CHANGE-020', path: 'change', message: '缺少 change 字段或类型非法' });
  } else if (data.change !== changeName) {
    errors.push({
      code: 'E-CHANGE-020',
      path: 'change',
      message: `工件 change "${data.change}" 与当前变更 "${changeName}" 不匹配`,
    });
  }

  if (!Array.isArray(data.items)) {
    errors.push({ code: 'E-CHANGE-020', path: 'items', message: '缺少 items 字段或不是数组' });
    return errors;
  }

  data.items.forEach((item, idx) => {
    const at = `items[${idx}]`;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      errors.push({ code: 'E-CHANGE-020', path: at, message: 'item 必须是对象' });
      return;
    }
    const it = item as ArtifactItem;
    if (typeof it.id !== 'string' || it.id.trim().length === 0) {
      errors.push({ code: 'E-CHANGE-020', path: `${at}.id`, message: '缺少 id 或类型非法' });
    }
    if (typeof it[textField] !== 'string' || (it[textField] as string).trim().length === 0) {
      errors.push({
        code: 'E-CHANGE-020',
        path: `${at}.${textField}`,
        message: `缺少 ${textField} 字段或类型非法`,
      });
    }
    if (typeof it.status !== 'string' || !ARTIFACT_STATUSES.includes(it.status as ArtifactStatus)) {
      errors.push({
        code: 'E-CHANGE-020',
        path: `${at}.status`,
        message: `status 非法: ${String(it.status)}（合法枚举: ${ARTIFACT_STATUSES.join(' | ')}）`,
      });
      return;
    }
    if (it.status !== 'open') {
      // resolution object presence is a schema-level requirement (locked TC-B1.7/1.8)
      if (it.resolution === undefined || it.resolution === null || typeof it.resolution !== 'object' || Array.isArray(it.resolution)) {
        errors.push({
          code: 'E-CHANGE-020',
          path: `${at}.resolution`,
          message: `status=${it.status} 时 resolution 对象必填`,
        });
        return;
      }
      const res = it.resolution as ArtifactResolution;
      if (typeof res.decision_ref !== 'string' || res.decision_ref.trim().length === 0) {
        errors.push({
          code: 'E-CHANGE-020',
          path: `${at}.resolution.decision_ref`,
          message: 'decision_ref 必填且须为字符串（decisions.md 条目时间戳）',
        });
      }
    }
  });

  return errors;
}

/** Semantic layer — resolution chain assertions. Failures → E-CHANGE-021. */
export function validateArtifactSemantics(
  data: ArtifactData,
  decisionsContent: string
): ArtifactDiagnostic[] {
  const errors: ArtifactDiagnostic[] = [];
  const items = data.items;
  if (!Array.isArray(items)) return errors; // schema layer already reported

  const knownRefs = new Set(extractDecisionRefs(decisionsContent));

  items.forEach((item, idx) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return;
    const it = item as ArtifactItem;
    if (typeof it.status !== 'string' || !ARTIFACT_STATUSES.includes(it.status as ArtifactStatus)) return;
    if (it.status === 'open') return;
    if (it.resolution === undefined || it.resolution === null || typeof it.resolution !== 'object' || Array.isArray(it.resolution)) return;

    const at = `items[${idx}]`;
    const res = it.resolution as ArtifactResolution;
    const ref = typeof res.decision_ref === 'string' ? res.decision_ref.trim() : '';
    if (ref.length > 0 && !knownRefs.has(ref)) {
      errors.push({
        code: 'E-CHANGE-021',
        path: `${at}.resolution.decision_ref`,
        message: `decision_ref "${ref}" 在 decisions.md 中无对应条目（resolution 链断裂）`,
      });
    }
    if (it.status === 'deferred') {
      const note = typeof res.note === 'string' ? res.note.trim() : '';
      if (note.length === 0) {
        errors.push({
          code: 'E-CHANGE-021',
          path: `${at}.resolution.note`,
          message: 'status=deferred 时 note 必填（deferred 必须给出理由）',
        });
      }
    }
  });

  return errors;
}

/**
 * Pure core: validate raw artifact text against schema v1 + resolution chain.
 * `raw === null` means artifact file missing (caller decides the missing-branch policy).
 * Fail-closed: YAML syntax errors are schema violations (E-CHANGE-020), never silent pass.
 */
export function validateArtifactData(
  raw: string | null,
  kind: ArtifactKind,
  changeName: string,
  decisionsContent: string
): ArtifactValidationResult {
  if (raw === null) {
    return { exists: false, isValid: false, errors: [], openItemIds: [], items: [] };
  }

  let data: ArtifactData;
  try {
    data = parseYaml(raw) as ArtifactData;
  } catch (err) {
    return {
      exists: true,
      isValid: false,
      errors: [
        {
          code: 'E-CHANGE-020',
          path: '(document)',
          message: `YAML 解析失败: ${(err as Error).message}`,
        },
      ],
      openItemIds: [],
      items: [],
    };
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      exists: true,
      isValid: false,
      errors: [{ code: 'E-CHANGE-020', path: '(document)', message: '工件顶层必须是 YAML 映射' }],
      openItemIds: [],
      items: [],
    };
  }

  const errors = [
    ...validateArtifactSchema(data, kind, changeName),
    ...validateArtifactSemantics(data, decisionsContent),
  ];

  const items = Array.isArray(data.items) ? (data.items as ArtifactItem[]) : [];
  const openItemIds = items
    .filter((it) => it && typeof it === 'object' && it.status === 'open' && typeof it.id === 'string')
    .map((it) => it.id as string);

  return { exists: true, isValid: errors.length === 0, errors, openItemIds, items };
}

/** IO wrapper: validate `<changeDir>/<kind>.yaml` against `<changeDir>/decisions.md` */
export function validateArtifact(
  root: string,
  changeName: string,
  kind: ArtifactKind,
  scope?: string
): ArtifactValidationResult {
  const changeDir = getChangeDir(root, changeName, scope);
  const artifactPath = join(changeDir, `${kind}.yaml`);
  const decisionsPath = join(changeDir, 'decisions.md');

  const raw = existsSync(artifactPath) ? readFileSync(artifactPath, 'utf8') : null;
  const decisionsContent = existsSync(decisionsPath) ? readFileSync(decisionsPath, 'utf8') : '';

  return validateArtifactData(raw, kind, changeName, decisionsContent);
}
