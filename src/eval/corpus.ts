/**
 * corpus.ts — L0 runner 层纯函数模块（eval-corpus / DS-EVAL-001）。
 *
 * 职责：把「corpus 场景」中所有**纯计算**从 runner 编排中剥离出来，便于直接单测
 * （本模块无 IO 副作用、无子进程 spawn；仅 loadFixtureExpectation 读一个本地
 * expected.yaml 文件，其余全是纯函数）。
 *
 * 覆盖信号口径（C-5 多信号并集）：新增诊断码 ∪ coverage 五字段任一变化。
 * 依赖方向：本模块不 import runner，也不 import src/core/metrics（L1）。
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

/** coverage 五字段（DS-EVAL-001 多信号口径）。 */
export const COVERAGE_FIELDS = [
  'total',
  'enforced_strong',
  'enforced_weak',
  'manual',
  'unverifiable',
] as const;

export type CoverageField = (typeof COVERAGE_FIELDS)[number];

/** coverage 向量：五字段数值齐备。 */
export type CoverageVector = Record<CoverageField, number>;

/** 一次 fixture 运行的原始信号。 */
export interface FixtureSignals {
  /** 去重后的码集合（error ∪ warning，跨域）。 */
  codes: string[];
  /** 探针未输出 coverage 时为 null。 */
  coverage: CoverageVector | null;
}

/**
 * 从任意校验器 JSON 输出递归收集所有 `{code:string}`（域无关，兼容 validate/check/guard）。
 *
 * @param node 任意 JSON 节点（对象 / 数组 / 原始值 / null 均安全）
 * @param out  累加的码集合（默认内部新建）
 * @returns 出现过的唯一 code 集合
 */
export function collectCodes(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (node === null || node === undefined) return out;

  if (Array.isArray(node)) {
    for (const item of node) collectCodes(item, out);
    return out;
  }

  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const code = obj['code'];
    if (typeof code === 'string') out.add(code);
    // 继续下沉所有子节点（含 code 自身，字符串递归为 no-op）
    for (const key of Object.keys(obj)) {
      collectCodes(obj[key], out);
    }
  }

  return out;
}

/**
 * 判定一个对象是否为齐备的 coverage 向量（total + 四分类数值）。
 * 任一字段缺失或非有限数值 → null。
 */
function extractCoverageVector(obj: Record<string, unknown>): CoverageVector | null {
  const vector = {} as CoverageVector;
  for (const field of COVERAGE_FIELDS) {
    const value = obj[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    vector[field] = value;
  }
  return vector;
}

/**
 * 从任意 JSON 输出中定位 EnforcementCoverage（首个含 total + 四分类数值的对象）。
 *
 * 同一游走可命中 `validate --json` 顶层 `coverage` 与 `check --json` 的
 * `compliance.coverage`；两者都没有（如 guard/archive）→ null。
 */
export function findCoverage(node: unknown): CoverageVector | null {
  if (node === null || node === undefined || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findCoverage(item);
      if (found) return found;
    }
    return null;
  }

  const obj = node as Record<string, unknown>;
  const direct = extractCoverageVector(obj);
  if (direct) return direct;

  // DFS 前序：先看当前节点，再逐子节点
  for (const key of Object.keys(obj)) {
    const found = findCoverage(obj[key]);
    if (found) return found;
  }
  return null;
}

/**
 * 多信号 diff（C-5）：返回相对基线的「新增码」与「coverage 变化字段」。
 *
 * - newCodes = fixture.codes − baseline.codes
 * - changedCoverageFields = baseline/fixture 双侧均有 coverage 时，数值不等的字段名
 *   （单侧 null → 降级纯码检测，D-corpus-1 / E-12）
 * - killed = newCodes.length > 0 || changedCoverageFields.length > 0
 */
export function diffSignals(
  baseline: FixtureSignals,
  fixture: FixtureSignals,
): {
  newCodes: string[];
  changedCoverageFields: CoverageField[];
  killed: boolean;
} {
  const baselineCodes = new Set(baseline.codes);
  const newCodes = fixture.codes.filter((code) => !baselineCodes.has(code));

  const changedCoverageFields: CoverageField[] = [];
  if (baseline.coverage !== null && fixture.coverage !== null) {
    for (const field of COVERAGE_FIELDS) {
      if (baseline.coverage[field] !== fixture.coverage[field]) {
        changedCoverageFields.push(field);
      }
    }
  }

  return {
    newCodes,
    changedCoverageFields,
    killed: newCodes.length > 0 || changedCoverageFields.length > 0,
  };
}

export interface WilsonInterval {
  lower: number;
  upper: number;
  n: number;
  confidence: 0.95;
  /** n<3：样本不足以定标（Q1-005 / Q1-008）。 */
  insufficient: boolean;
}

/**
 * Wilson 95% 置信区间。
 *
 * - n<=0 或非有限 → null（Q4-002 除零兜底 / E-6）
 * - n<3 → 正常计算但置 `insufficient=true`（E-7）
 * - lower/upper 钳制到 [0,1]
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): WilsonInterval | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    n,
    confidence: 0.95,
    insufficient: n < 3,
  };
}

export interface RatioReport {
  /** n===0 → null（不做 0/0）。 */
  value: number | null;
  n: number;
  ci: WilsonInterval | null;
  /**
   * 被排除出分母的数量（BP-12-1 / D-corpus-5）：recall 时 = errored fixture 数；
   * noise 时缺省。仅展示，不参与 value 计算。
   */
  excluded?: number;
}

/**
 * 由成功数 / 总数构造比值报告。
 *
 * @param successes 分子（如 killed 数）
 * @param n         有效分母（errored 已排除）
 * @param excluded  被排除出分母的数量（如探针 errored 的坏样本）；仅展示
 */
export function makeRatio(successes: number, n: number, excluded?: number): RatioReport {
  const report: RatioReport =
    !Number.isFinite(n) || n <= 0
      ? { value: null, n, ci: null }
      : { value: successes / n, n, ci: wilsonInterval(successes, n) };
  if (excluded !== undefined) report.excluded = excluded;
  return report;
}

export type ProbeName = 'validate' | 'check' | 'guard' | 'archive';

/** 期望信号（fixture expected.yaml 解析结果）。 */
export interface FixtureExpectation {
  kind: 'baseline' | 'bad-case' | 'clean';
  /** bad-case 分档。 */
  severity?: 'veto' | 'error' | 'warn';
  /** 缺省 'validate'。 */
  probe: ProbeName;
  /** guard/archive 探针所需的变更名。 */
  change?: string;
  mustContain: string[];
  mustNotContain: string[];
}

/**
 * 固定 argv 模板（白名单枚举，杜绝命令注入；不做任意命令字符串，D-corpus-3）。
 */
export const PROBE_ARGS: Record<ProbeName, (change?: string) => string[]> = {
  validate: () => ['validate', '--json'],
  check: () => ['check', '--json'],
  guard: (c) => ['guard', c ?? '', 'verify', '--json'],
  archive: (c) => ['change', 'archive', c ?? ''],
};

/** 目录名约定推断 kind：`_baseline`→baseline、`clean-*`→clean、其余→bad-case。 */
function inferKind(dirName: string): FixtureExpectation['kind'] {
  if (dirName === '_baseline') return 'baseline';
  if (dirName.startsWith('clean-')) return 'clean';
  return 'bad-case';
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function parseKind(value: string): FixtureExpectation['kind'] | null {
  const v = stripQuotes(value);
  if (v === 'baseline' || v === 'bad-case' || v === 'clean') return v;
  return null;
}

function parseSeverity(value: string): FixtureExpectation['severity'] | null {
  const v = stripQuotes(value);
  if (v === 'veto' || v === 'error' || v === 'warn') return v;
  return null;
}

function parseProbe(value: string): ProbeName | null {
  const v = stripQuotes(value);
  if (v === 'validate' || v === 'check' || v === 'guard' || v === 'archive') return v;
  return null;
}

/** 解析行式码清单：支持内联数组 `[A, B]`、空、或单标量 `A`。 */
function parseCodeList(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => stripQuotes(s.trim())).filter((s) => s !== '');
  }
  if (trimmed === '') return [];
  return [stripQuotes(trimmed)];
}

/**
 * 加载 fixture 期望（expected.yaml）。
 *
 * 行式解析（与 loadScenario 同款，不引 YAML 依赖）；容错：坏行 / 非法字段跳过，
 * 缺省补齐（`probe='validate'`、`mustContain=[]`、`mustNotContain=[]`，E-13）；
 * 文件不存在时仅按目录名约定返回缺省（不抛异常）。
 */
export function loadFixtureExpectation(filePath: string): FixtureExpectation {
  const result: FixtureExpectation = {
    kind: inferKind(basename(dirname(filePath))),
    probe: 'validate',
    mustContain: [],
    mustNotContain: [],
  };

  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'kind': {
        const kind = parseKind(value);
        if (kind) result.kind = kind;
        break;
      }
      case 'severity': {
        const severity = parseSeverity(value);
        if (severity) result.severity = severity;
        break;
      }
      case 'probe': {
        const probe = parseProbe(value);
        if (probe) result.probe = probe;
        break;
      }
      case 'change':
        result.change = stripQuotes(value);
        break;
      case 'mustContain':
        result.mustContain = parseCodeList(value);
        break;
      case 'mustNotContain':
        result.mustNotContain = parseCodeList(value);
        break;
      default:
        // E-13：未知字段静默忽略，不抛异常
        break;
    }
  }

  return result;
}
