/**
 * 约束来源闭合 — 「下层受上层约束」的可判定形式。
 *
 * 背景：自由度边界把自由度定义为**区间**——约束定界，界内自由。设计 Level N
 * 只受 Level 0..N-1 约束；实现 Level N 只受设计已声明的边界约束。这个定义有
 * 一个直接推论：**一条约束若没有可解析的上游来源，它就不属于任何层级**——那是
 * 凭空发明，即「越权约束」，会把本应自由的界内空间压窄。
 *
 * `source_specs` 字段自 0.12.0 起就存在于 `ConstraintEntry` 与约束树中，却没有
 * 任何消费者：约束条目的来源标注写了、没人核对。本模块把它变成可判定通道，
 * 与 `change/archive-consistency.ts` 同构（同为「引擎声明 ↔ 实际工件」的闭合检查）。
 *
 * 检查三态：
 * - E-CONSTRAINT-001：约束条目缺少 source_specs（越权约束 — 无上游来源）
 * - E-CONSTRAINT-002：来源文件不存在（悬空来源）
 * - W-CONSTRAINT-003：来源锚点在文件中找不到对应标题（锚点漂移）
 *
 * 锚点匹配为**归一化子串**匹配：忽略大小写与空白/连字符/下划线/间隔号。这样
 * `#流程执行载体` 能命中 `## Requirement: 流程执行载体（CLI-first）`，
 * `#verifier-语义与可验证性` 能命中 `## Requirement: Verifier 语义与可验证性（0.20）`。
 * 该宽松度是刻意的：锚点服务于「来源可追溯」，不是精确指针，误报比漏报更贵。
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DriftResult, ConstraintsFile, ConstraintEntry } from '../core/types.js';
import { loadAllConstraints } from '../core/constraints-loader.js';

/** 归一化标题/锚点：忽略大小写与空白、连字符、下划线、间隔号。 */
export function normalizeHeading(text: string): string {
  return text.replace(/[\s\-_·]+/g, '').toLowerCase();
}

/**
 * 读取 Markdown 文件的全部标题文本（# 至 ######）。
 * 文件不存在或不可读时返回空数组——调用方据空数组报「锚点缺失」。
 */
export function collectHeadings(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  return [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
}

/** 单条来源引用的解析结果。 */
export interface SourceSpecResolution {
  ok: boolean;
  /** 失败原因；`ok` 为 true 时缺省。 */
  reason?: 'file-missing' | 'anchor-missing';
}

/**
 * 解析单条来源引用，形如 `<相对于项目根的路径>#<标题>`。
 * 锚点可省略（只指文件），此时仅校验文件存在性。
 */
export function resolveSourceSpec(projectRoot: string, ref: string): SourceSpecResolution {
  const hash = ref.indexOf('#');
  const file = hash === -1 ? ref : ref.slice(0, hash);
  const anchor = hash === -1 ? '' : ref.slice(hash + 1);

  const target = join(projectRoot, file);
  if (!existsSync(target)) return { ok: false, reason: 'file-missing' };
  if (!anchor) return { ok: true };

  const wanted = normalizeHeading(anchor);
  const hit = collectHeadings(target).some((h) => normalizeHeading(h).includes(wanted));
  return hit ? { ok: true } : { ok: false, reason: 'anchor-missing' };
}

/** 遍历约束文件中的全部条目（forward/reverse × 两个维度）。 */
export function* iterateConstraintEntries(
  files: ConstraintsFile[],
): Generator<{ entry: ConstraintEntry; scope: string; file: string }> {
  for (const file of files) {
    for (const direction of ['forward', 'reverse'] as const) {
      for (const dimension of ['technical_design', 'requirement_goals'] as const) {
        for (const entry of file[direction]?.[dimension] ?? []) {
          yield { entry, scope: file.scope ?? '.', file: `constraints.yaml` };
        }
      }
    }
  }
}

/**
 * 约束来源闭合检查。
 *
 * 返回 `DriftResult[]`，供 `mumuspec check` 的 drift 数组消费（与
 * `detectArchiveStateDrift` / `detectAgentsDrift` 并列）。
 */
export function detectConstraintSourceDrift(projectRoot: string): DriftResult[] {
  const { files } = loadAllConstraints(projectRoot);
  const results: DriftResult[] = [];

  for (const { entry, scope } of iterateConstraintEntries(files)) {
    const refs = entry.source_specs ?? [];
    const where = scope === '.' ? '.mumuspec/constraints.yaml' : `${scope}/.mumuspec/constraints.yaml`;

    if (refs.length === 0) {
      results.push({
        type: 'constraint_source_drift',
        code: 'E-CONSTRAINT-001',
        severity: 'ERROR',
        message: `约束 ${entry.id} 没有上游来源（越权约束）：约束必须来自更高层规范`,
        file: where,
        fixHint: `为该约束补 source_specs，指向定义它的规范标题（如 .mumuspec/spec.md#<Requirement 标题>）`,
      });
      continue;
    }

    for (const ref of refs) {
      const resolution = resolveSourceSpec(projectRoot, ref);
      if (resolution.ok) continue;

      const fileMissing = resolution.reason === 'file-missing';
      results.push({
        type: 'constraint_source_drift',
        code: fileMissing ? 'E-CONSTRAINT-002' : 'W-CONSTRAINT-003',
        severity: fileMissing ? 'ERROR' : 'WARN',
        message: fileMissing
          ? `约束 ${entry.id} 的来源文件不存在：${ref}`
          : `约束 ${entry.id} 的来源锚点在文件中找不到对应标题：${ref}`,
        file: where,
        fixHint: fileMissing
          ? '修正 source_specs 的路径，或删除该来源标注'
          : '把锚点改为目标规范中真实存在的标题（归一化后子串匹配）',
      });
    }
  }

  return results;
}
