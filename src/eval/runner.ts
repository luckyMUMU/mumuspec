import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  type Dirent,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkCompliance, detectDrift } from '../guard/checker.js';
import { runPhaseGuard } from '../guard/phase-guard.js';
import { findProjectRoot } from '../core/utils.js';
import {
  collectCodes,
  diffSignals,
  findCoverage,
  loadFixtureExpectation,
  makeRatio,
  PROBE_ARGS,
  type CoverageVector,
  type FixtureExpectation,
  type FixtureSignals,
  type RatioReport,
} from './corpus.js';

// === Types ===

export interface EvalScenario {
  name: string;
  description?: string;
  type: 'compliance' | 'drift' | 'phase-guard' | 'custom' | 'corpus';
  // For compliance/drift: project root to scan
  projectRoot?: string;
  // For phase-guard: change name and target phase
  changeName?: string;
  targetPhase?: string;
  // For corpus: corpus dir relative to projectRoot (default .eval-corpus)
  corpusDir?: string;
  // For corpus: aggregate-level assertions (optional)
  corpusExpect?: {
    minRecall?: number;
    maxNoise?: number;
    recallBySeverity?: Partial<Record<'veto' | 'error' | 'warn', number>>;
  };
  // Expected outcomes
  expected?: {
    minErrors?: number;
    maxErrors?: number;
    minWarnings?: number;
    maxWarnings?: number;
    mustContainErrorCodes?: string[];
    mustNotContainErrorCodes?: string[];
    mustNotContainErrorMessages?: string[];
  };
  // Custom assertions (evaluated as JavaScript expressions)
  assertions?: string[];
}

/** 单个 corpus fixture 的结果。 */
export interface CorpusFixtureResult {
  name: string;
  kind: 'baseline' | 'bad-case' | 'clean';
  severity?: 'veto' | 'error' | 'warn';
  /** bad-case：是否检出。 */
  killed?: boolean;
  /** clean：是否误报（有码即判误报，D-corpus-2）。 */
  falsePositive?: boolean;
  /** 相对基线的新增码。 */
  newCodes: string[];
  /** 相对基线变化的 coverage 字段。 */
  changedCoverageFields: string[];
  /** 期望码是否全部命中（精度校验）。 */
  mustContainSatisfied: boolean;
  /** 命中 mustNotContain 的码（精度违规）。 */
  unexpectedCodes: string[];
  /** 该 fixture 运行/解析错误。 */
  errors: string[];
}

/** corpus 场景聚合报告。 */
export interface CorpusScenarioReport {
  scenario: string;
  corpusDir: string;
  /** fixture 总数（不含 _baseline）。 */
  total: number;
  /** 坏样本检出率（overall）。 */
  recall: RatioReport;
  recallBySeverity: Record<'veto' | 'error' | 'warn', RatioReport>;
  /** 净样本误报率。 */
  noise: RatioReport;
  baseline: { codes: string[]; coverage: CoverageVector | null } | null;
  fixtures: CorpusFixtureResult[];
}

export interface EvalResult {
  scenario: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: string;
  duration: number;
  corpus?: CorpusScenarioReport;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
  duration: number;
  corpusReports?: CorpusScenarioReport[];
}

// === Scenario loading ===

/**
 * Load a scenario from a YAML-like file.
 * ponytail: using simple line-based parsing, no external YAML dep
 */
export function loadScenario(filePath: string): EvalScenario {
  if (!existsSync(filePath)) {
    throw new Error(`Scenario file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const scenario: Record<string, unknown> = {
    expected: {},
    assertions: [],
  };

  let currentSection: string | null = null;
  // ponytail: corpusExpect 支持三层嵌套（corpusExpect > recallBySeverity > severity 桶）
  let corpusSubSection: string | null = null;
  let corpusChildIndent = -1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;

    // Top-level key
    if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      currentSection = key;
      corpusSubSection = null;
      corpusChildIndent = -1;

      if (value) {
        scenario[key] = parseScalar(value);
      } else if (key === 'expected') {
        scenario['expected'] = {};
      } else if (key === 'assertions') {
        scenario['assertions'] = [];
      } else if (key === 'corpusExpect') {
        scenario['corpusExpect'] = {};
      }
      continue;
    }

    // Indented line
    if (currentSection === 'expected') {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      (scenario['expected'] as Record<string, unknown>)[key] = parseScalar(value);
    } else if (currentSection === 'assertions') {
      if (line.startsWith('- ')) {
        (scenario['assertions'] as string[]).push(line.slice(2).trim());
      }
    } else if (currentSection === 'corpusExpect') {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      const corpusExpect = scenario['corpusExpect'] as Record<string, unknown>;

      if (corpusChildIndent === -1) corpusChildIndent = indent;

      if (indent > corpusChildIndent) {
        // 深层：归入当前子段（如 recallBySeverity）
        if (corpusSubSection) {
          const sub = corpusExpect[corpusSubSection] as Record<string, unknown>;
          sub[key] = parseScalar(value);
        }
      } else if (value === '') {
        // 与子段同缩进的空值 → 开启新子段
        corpusSubSection = key;
        corpusExpect[key] = {};
      } else {
        corpusExpect[key] = parseScalar(value);
      }
    }
  }

  // Validation
  if (!scenario.name) {
    // Use filename as fallback
    const baseName = filePath.split(/[\\/]/).pop()?.replace(/\.ya?ml$/, '') || 'unnamed';
    scenario.name = baseName;
  }

  if (!scenario.type) {
    scenario.type = 'compliance';
  }

  return scenario as unknown as EvalScenario;
}

function parseScalar(value: string): unknown {
  if (value.startsWith('[') && value.endsWith(']')) {
    // Array
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;
  return value.replace(/^["']|["']$/g, '');
}

// === Scenario discovery ===

/**
 * Discover all eval scenarios in .mumuspec/evals/.
 */
export function discoverScenarios(projectRoot: string): string[] {
  const evalsDir = join(projectRoot, '.mumuspec', 'evals');
  if (!existsSync(evalsDir)) return [];

  const files = readdirSync(evalsDir);
  return files
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => join(evalsDir, f));
}

// === corpus probing (L0) ===

/** 诊断码正则兜底：覆盖 JSON 之外的通道（如 archive 经 stderr 打印 E-CHANGE-022）。 */
const CODE_REGEX = /\b[EW]-[A-Z]+-\d{3}\b/g;

/**
 * 从 stdout 解析 JSON：优先整段（多行美化输出），失败则从首个结构字符 `{`/`[` 切片。
 *
 * ponytail: 与 `src/core/metrics/drift-score.ts::parseJsonFrom` 同一份工具语义；
 * L0 层不改动 src/core/metrics（留给 L1），故此处内联同款实现，避免跨层耦合。
 */
function parseJsonFrom(stdout: string): unknown {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const brace = stdout.indexOf('{');
    const bracket = stdout.indexOf('[');
    let start = -1;
    if (brace >= 0 && bracket >= 0) start = Math.min(brace, bracket);
    else start = Math.max(brace, bracket);
    if (start < 0) return null;
    try {
      return JSON.parse(stdout.slice(start)) as unknown;
    } catch {
      return null;
    }
  }
}

/**
 * 对一个 fixture 运行单次探针，提取多信号（码 ∪ coverage）。
 *
 * 安全约束（D-corpus-4 / Q4-001 / R-1）：`cwd` **只接受绝对 fixture 路径**，
 * 绝不依赖 process.cwd()，也不做 findProjectRoot 向上推断。
 */
function runProbe(
  fixturePath: string,
  exp: FixtureExpectation,
): { signals: FixtureSignals; errors: string[] } {
  const errors: string[] = [];
  const args = PROBE_ARGS[exp.probe](exp.change);

  let stdout = '';
  let stderr = '';

  try {
    const res = spawnSync('npx', ['mumuspec', ...args], {
      cwd: fixturePath, // 绝对路径：见 D-corpus-4
      encoding: 'utf-8',
      timeout: 30_000,
      shell: process.platform === 'win32',
    });
    if (res.error) {
      errors.push(`probe failed to start: ${res.error.message}`);
    }
    stdout = res.stdout ?? '';
    stderr = res.stderr ?? '';
  } catch (err) {
    errors.push(`probe failed to start: ${err instanceof Error ? err.message : String(err)}`);
  }

  const parsed = parseJsonFrom(stdout);
  const codes = parsed === null ? new Set<string>() : collectCodes(parsed);

  // 正则兜底：扫 stdout + stderr，覆盖非 JSON 通道（E-10）
  const combined = `${stdout}\n${stderr}`;
  const re = new RegExp(CODE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(combined)) !== null) {
    codes.add(match[0]);
  }

  const coverage = parsed === null ? null : findCoverage(parsed);

  return { signals: { codes: Array.from(codes), coverage }, errors };
}

function formatRatioValue(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(3);
}

interface CorpusRunOutput {
  report: CorpusScenarioReport | null;
  errors: string[];
  warnings: string[];
  details: string;
}

/**
 * corpus 场景运行流程（design §2.1.3 8 步）。
 *
 * 全部 fixture 探针 `cwd` 均为绝对路径；baseline 只跑一次并复用。
 */
function runCorpusScenario(scenario: EvalScenario, projectRoot: string): CorpusRunOutput {
  const errors: string[] = [];
  const warnings: string[] = [];

  const corpusDirName = scenario.corpusDir ?? '.eval-corpus';
  const corpusDir = resolve(projectRoot, corpusDirName);

  // Step 1: corpusDir 存在性（E-1）
  if (!existsSync(corpusDir)) {
    errors.push(`corpus dir not found: ${corpusDir}`);
    return { report: null, errors, warnings, details: `Corpus: dir not found (${corpusDir})` };
  }

  // Step 2: 枚举直接子目录中「含 expected.yaml」者为 fixture（E-5）
  let entries: Dirent[];
  try {
    entries = readdirSync(corpusDir, { withFileTypes: true });
  } catch (err) {
    errors.push(`corpus dir unreadable: ${err instanceof Error ? err.message : String(err)}`);
    return { report: null, errors, warnings, details: 'Corpus: dir unreadable' };
  }

  const fixtureNames: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (existsSync(join(corpusDir, entry.name, 'expected.yaml'))) {
      fixtureNames.push(entry.name);
    }
  }

  // Step 2（空目录，E-2）：warning + n=0，不抛异常
  if (fixtureNames.length === 0) {
    warnings.push('corpus dir empty');
    const emptyReport: CorpusScenarioReport = {
      scenario: scenario.name,
      corpusDir: corpusDirName,
      total: 0,
      recall: makeRatio(0, 0),
      recallBySeverity: {
        veto: makeRatio(0, 0),
        error: makeRatio(0, 0),
        warn: makeRatio(0, 0),
      },
      noise: makeRatio(0, 0),
      baseline: null,
      fixtures: [],
    };
    return { report: emptyReport, errors, warnings, details: 'Corpus: 0 fixtures' };
  }

  // Step 2（缺 _baseline，E-3）：fail-fast
  const baselineName = fixtureNames.find((n) => n === '_baseline');
  if (!baselineName) {
    errors.push('corpus requires _baseline fixture');
    return { report: null, errors, warnings, details: 'Corpus: missing _baseline' };
  }

  // Step 3: baseline 探针 + 强校验零码（E-4 / R-4）
  const baselinePath = resolve(corpusDir, baselineName);
  const baselineExp = loadFixtureExpectation(join(baselinePath, 'expected.yaml'));
  const baselineRun = runProbe(baselinePath, baselineExp);
  const baselineSignals = baselineRun.signals;
  errors.push(...baselineRun.errors.map((e) => `_baseline: ${e}`));

  if (baselineSignals.codes.length > 0) {
    errors.push(
      `baseline must be clean but produced codes: ${baselineSignals.codes.join(', ')}`,
    );
    return { report: null, errors, warnings, details: 'Corpus: baseline not clean (fail-fast)' };
  }

  // Step 4/5: bad-case / clean 逐个探针
  const fixtures: CorpusFixtureResult[] = [];
  const severityTally: Record<'veto' | 'error' | 'warn', { success: number; n: number }> = {
    veto: { success: 0, n: 0 },
    error: { success: 0, n: 0 },
    warn: { success: 0, n: 0 },
  };
  let killedCount = 0;
  let badCount = 0;
  let falsePositiveCount = 0;
  let cleanCount = 0;

  for (const name of fixtureNames) {
    if (name === baselineName) continue;

    const fixturePath = resolve(corpusDir, name);
    const exp = loadFixtureExpectation(join(fixturePath, 'expected.yaml'));
    const run = runProbe(fixturePath, exp);
    const signals = run.signals;

    const mustContainSatisfied = exp.mustContain.every((code) => signals.codes.includes(code));
    const unexpectedCodes = signals.codes.filter((code) => exp.mustNotContain.includes(code));

    if (exp.kind === 'clean') {
      // Step 5: noise 只计码（D-corpus-2）
      const falsePositive = signals.codes.length > 0;
      cleanCount += 1;
      if (falsePositive) falsePositiveCount += 1;
      fixtures.push({
        name,
        kind: 'clean',
        severity: exp.severity,
        falsePositive,
        newCodes: [],
        changedCoverageFields: [],
        mustContainSatisfied,
        unexpectedCodes,
        errors: run.errors,
      });
      continue;
    }

    // Step 4: bad-case（含 kind 缺省推断为 bad-case 者）
    const diff = diffSignals(baselineSignals, signals);
    badCount += 1;
    if (diff.killed) killedCount += 1;
    const severity = exp.severity ?? 'error';
    severityTally[severity].n += 1;
    if (diff.killed) severityTally[severity].success += 1;

    fixtures.push({
      name,
      kind: 'bad-case',
      severity: exp.severity,
      killed: diff.killed,
      newCodes: diff.newCodes,
      changedCoverageFields: diff.changedCoverageFields,
      mustContainSatisfied,
      unexpectedCodes,
      errors: run.errors,
    });
  }

  // Step 6: 聚合
  const recall = makeRatio(killedCount, badCount);
  const recallBySeverity: Record<'veto' | 'error' | 'warn', RatioReport> = {
    veto: makeRatio(severityTally.veto.success, severityTally.veto.n),
    error: makeRatio(severityTally.error.success, severityTally.error.n),
    warn: makeRatio(severityTally.warn.success, severityTally.warn.n),
  };
  const noise = makeRatio(falsePositiveCount, cleanCount);

  const report: CorpusScenarioReport = {
    scenario: scenario.name,
    corpusDir: corpusDirName,
    total: fixtureNames.length - 1,
    recall,
    recallBySeverity,
    noise,
    baseline: { codes: baselineSignals.codes, coverage: baselineSignals.coverage },
    fixtures,
  };

  // Step 7: corpusExpect 断言（若声明）
  const corpusExpect = scenario.corpusExpect;
  if (corpusExpect) {
    if (
      corpusExpect.minRecall !== undefined &&
      (recall.value === null || recall.value < corpusExpect.minRecall)
    ) {
      errors.push(
        `corpusExpect.minRecall ${corpusExpect.minRecall} not met (recall=${formatRatioValue(recall.value)})`,
      );
    }
    if (
      corpusExpect.maxNoise !== undefined &&
      noise.value !== null &&
      noise.value > corpusExpect.maxNoise
    ) {
      errors.push(
        `corpusExpect.maxNoise ${corpusExpect.maxNoise} violated (noise=${formatRatioValue(noise.value)})`,
      );
    }
    if (corpusExpect.recallBySeverity) {
      for (const severity of ['veto', 'error', 'warn'] as const) {
        const threshold = corpusExpect.recallBySeverity[severity];
        if (threshold === undefined) continue;
        const ratio = recallBySeverity[severity];
        if (ratio.value === null || ratio.value < threshold) {
          errors.push(
            `corpusExpect.recallBySeverity.${severity} ${threshold} not met (recall=${formatRatioValue(ratio.value)})`,
          );
        }
      }
    }
  }

  // Step 8: 返回 report（由 runScenario 挂到 EvalResult.corpus）
  return {
    report,
    errors,
    warnings,
    details:
      `Corpus: ${badCount} bad-case (recall=${formatRatioValue(recall.value)}), ` +
      `${cleanCount} clean (noise=${formatRatioValue(noise.value)}), ${fixtures.length} fixtures`,
  };
}

// === Scenario execution ===

/**
 * Run a single eval scenario.
 */
export function runScenario(scenario: EvalScenario): EvalResult {
  const startTime = Date.now();
  const resultErrors: string[] = [];
  const resultWarnings: string[] = [];
  let details = '';
  let corpusReport: CorpusScenarioReport | undefined;

  try {
    const projectRoot = scenario.projectRoot || findProjectRoot() || process.cwd();
    const expected = scenario.expected || {};

    let complianceResult: { errors: { code: string; message: string }[]; warnings: { code: string; message: string }[] } | null = null;
    let driftResults: { type: string; severity: string; message: string }[] | null = null;
    let guardResult: { errors: { code: string; message: string }[]; warnings: { code: string; message: string }[] } | null = null;

    switch (scenario.type) {
      case 'compliance':
        complianceResult = checkCompliance(projectRoot, {});
        details = `Compliance: ${complianceResult.errors.length} errors, ${complianceResult.warnings.length} warnings`;
        break;
      case 'drift':
        driftResults = detectDrift(projectRoot);
        const driftErrors = driftResults.filter((d) => d.severity === 'ERROR');
        const driftWarns = driftResults.filter((d) => d.severity !== 'ERROR');
        details = `Drift: ${driftErrors.length} errors, ${driftWarns.length} warnings`;
        break;
      case 'phase-guard':
        if (!scenario.changeName || !scenario.targetPhase) {
          resultErrors.push('phase-guard scenario requires changeName and targetPhase');
          break;
        }
        guardResult = runPhaseGuard(projectRoot, scenario.changeName, scenario.targetPhase);
        details = `Phase Guard (${scenario.changeName} → ${scenario.targetPhase}): ${guardResult.errors.length} errors`;
        break;
      case 'custom':
        // DS-EVAL-002：assertions-only，无引擎动作、零警告（脱离 default 死端）
        break;
      case 'corpus': {
        const corpusRun = runCorpusScenario(scenario, projectRoot);
        if (corpusRun.report) corpusReport = corpusRun.report;
        resultErrors.push(...corpusRun.errors);
        resultWarnings.push(...corpusRun.warnings);
        details = corpusRun.details;
        break;
      }
      default:
        resultWarnings.push(`Unknown scenario type: ${scenario.type}`);
    }

    // Collect all errors/warnings for assertion
    const allErrors: { code: string; message: string }[] = [];
    const allWarnings: { code: string; message: string }[] = [];

    if (complianceResult) {
      allErrors.push(...complianceResult.errors);
      allWarnings.push(...complianceResult.warnings);
    }
    if (driftResults) {
      for (const d of driftResults) {
        if (d.severity === 'ERROR') {
          allErrors.push({ code: 'DRIFT', message: `${d.type}: ${d.message}` });
        } else {
          allWarnings.push({ code: 'DRIFT', message: `${d.type}: ${d.message}` });
        }
      }
    }
    if (guardResult) {
      allErrors.push(...guardResult.errors);
      allWarnings.push(...guardResult.warnings);
    }

    // Run assertions
    if (expected.minErrors !== undefined && allErrors.length < expected.minErrors) {
      resultErrors.push(`Expected at least ${expected.minErrors} errors, got ${allErrors.length}`);
    }
    if (expected.maxErrors !== undefined && allErrors.length > expected.maxErrors) {
      resultErrors.push(`Expected at most ${expected.maxErrors} errors, got ${allErrors.length}`);
    }
    if (expected.minWarnings !== undefined && allWarnings.length < expected.minWarnings) {
      resultErrors.push(`Expected at least ${expected.minWarnings} warnings, got ${allWarnings.length}`);
    }
    if (expected.maxWarnings !== undefined && allWarnings.length > expected.maxWarnings) {
      resultErrors.push(`Expected at most ${expected.maxWarnings} warnings, got ${allWarnings.length}`);
    }

    // Check error codes
    if (expected.mustContainErrorCodes) {
      const actualCodes = allErrors.map((e) => e.code);
      for (const requiredCode of expected.mustContainErrorCodes as string[]) {
        if (!actualCodes.includes(requiredCode)) {
          resultErrors.push(`Expected error code "${requiredCode}" not found`);
        }
      }
    }
    if (expected.mustNotContainErrorCodes) {
      const actualCodes = allErrors.map((e) => e.code);
      for (const forbiddenCode of expected.mustNotContainErrorCodes) {
        if (actualCodes.includes(forbiddenCode)) {
          resultErrors.push(`Forbidden error code "${forbiddenCode}" found`);
        }
      }
    }

    // Run custom assertions
    for (const assertion of scenario.assertions || []) {
      try {
        // Simple assertion evaluation: supports patterns like:
        // "errors.length === 0"
        // "errors.some(e => e.code === 'E-GUARD-003')"
        const fn = new Function('errors', 'warnings', `"use strict"; return (${assertion});`);
        const assertionResult = fn(allErrors, allWarnings);
        if (!assertionResult) {
          resultErrors.push(`Assertion failed: ${assertion}`);
        }
      } catch (evalErr) {
        resultErrors.push(`Assertion error: ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`);
      }
    }

  } catch (err) {
    resultErrors.push(`Scenario execution error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const result: EvalResult = {
    scenario: scenario.name,
    passed: resultErrors.length === 0,
    errors: resultErrors,
    warnings: resultWarnings,
    details,
    duration: Date.now() - startTime,
  };
  if (corpusReport) result.corpus = corpusReport;
  return result;
}

/**
 * Run all discovered scenarios.
 */
export function runAllEvals(projectRoot?: string): EvalReport {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const startTime = Date.now();

  const scenarioFiles = discoverScenarios(root);

  if (scenarioFiles.length === 0) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
      duration: Date.now() - startTime,
      corpusReports: [],
    };
  }

  const results: EvalResult[] = [];
  for (const file of scenarioFiles) {
    const scenario = loadScenario(file);
    // corpus 场景需以「已发现的 projectRoot」为基准解析 corpusDir（不依赖 cwd）
    if (!scenario.projectRoot) scenario.projectRoot = root;
    results.push(runScenario(scenario));
  }

  // C-6：收集 corpus 维度（同一对象引用，不深拷贝错位）
  const corpusReports: CorpusScenarioReport[] = [];
  for (const result of results) {
    if (result.corpus) corpusReports.push(result.corpus);
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
    duration: Date.now() - startTime,
    corpusReports,
  };
}

/**
 * Init a sample evals directory with starter scenarios.
 */
export function initEvalsDir(projectRoot: string): { created: string[]; errors: string[] } {
  const evalsDir = join(projectRoot, '.mumuspec', 'evals');
  const created: string[] = [];
  const errors: string[] = [];

  if (!existsSync(evalsDir)) {
    try {
      mkdirSync(evalsDir, { recursive: true });
    } catch (err) {
      errors.push(`Failed to create evals dir: ${err instanceof Error ? err.message : String(err)}`);
      return { created, errors };
    }
  }

  // Sample: basic compliance check
  const complianceFile = join(evalsDir, 'sample-compliance.yaml');
  if (!existsSync(complianceFile)) {
    try {
      writeFileSync(complianceFile, `# Sample compliance eval
name: sample-compliance
description: Verify no SHALL NOT violations in committed code
type: compliance
expected:
  maxErrors: 0
  mustNotContainErrorCodes: ["E-GUARD-003"]
`);
      created.push(complianceFile);
    } catch (err) {
      errors.push(`Failed to write sample: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Sample: drift detection
  const driftFile = join(evalsDir, 'sample-drift.yaml');
  if (!existsSync(driftFile)) {
    try {
      writeFileSync(driftFile, `# Sample drift detection eval
name: sample-drift
description: Check spec-code drift after changes
type: drift
expected:
  maxWarnings: 5
`);
      created.push(driftFile);
    } catch (err) {
      errors.push(`Failed to write sample: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, errors };
}
