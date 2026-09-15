/**
 * eval command — Lightweight eval framework.
 */
import type { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/listing.js';
import { verifiableRatioEvaluator } from '../../core/metrics/verifiable-ratio.js';
import { failOpenCountEvaluator } from '../../core/metrics/fail-open-count.js';
import type { EvaluatorContext, MetricResult } from '../../core/metrics/types.js';
import {
  loadScenario,
  runScenario,
  runAllEvals,
  discoverScenarios,
  initEvalsDir,
  type EvalReport,
  type CorpusScenarioReport,
} from '../../eval/runner.js';

// === eval --report 汇总（L2 消费层，design §2.3.1 / DS-EVAL-004） ===

/** 单指标汇总投影（MetricResult 的子集，供 report 直接透传）。 */
export interface EvalSummaryMetric {
  value: number;
  weight: number;
  details: string;
  rawData?: unknown;
}

/**
 * `eval --report --json` 的冻结契约（Q4-003）。
 *
 * version=1 起冻结：后续只**加字段**，不改既有字段类型 / 语义
 * （BP-12-2 于本版新增顶层 `precision`，version 仍为 1）。
 */
export interface EvalSummaryReport {
  version: 1;
  /** ISO 8601 生成时间。 */
  generatedAt: string;
  evals: { total: number; passed: number; failed: number; duration: number };
  corpus: CorpusScenarioReport[];
  /** 跨 corpus 场景求和的聚合精度（仅展示、不设阈值，BP-12-2）。 */
  precision: { mustContainSatisfied: number; mustContainTotal: number; ratio: number | null };
  metrics: {
    'verifiable-ratio': EvalSummaryMetric;
    'fail-open-count': EvalSummaryMetric;
  };
  coverageRef: {
    metric: 'vitest-v8';
    thresholds: { lines: number; branches: number; functions: number; statements: number };
    command: string;
  };
}

/** 覆盖率引用采集命令（指针，不 embed 数值；B6）。 */
const COVERAGE_COMMAND = 'npx vitest run --coverage';

/**
 * 从 `vitest.config.ts` 读取 coverage.thresholds 四维阈值（design §2.3.1）。
 *
 * 读取失败或缺失 → 回退冻结默认四维 95（与契约一致），绝不抛异常。
 */
function readCoverageThresholds(
  root: string,
): { lines: number; branches: number; functions: number; statements: number } {
  const fallback = { lines: 95, branches: 95, functions: 95, statements: 95 };
  try {
    const configPath = join(root, 'vitest.config.ts');
    if (!existsSync(configPath)) return fallback;
    const body = readFileSync(configPath, 'utf8').match(/thresholds\s*:\s*\{([^}]*)\}/)?.[1];
    if (!body) return fallback;
    const read = (key: keyof typeof fallback): number => {
      const m = body.match(new RegExp(`${key}\\s*:\\s*(\\d+)`));
      return m ? Number(m[1]) : fallback[key];
    };
    return {
      lines: read('lines'),
      branches: read('branches'),
      functions: read('functions'),
      statements: read('statements'),
    };
  } catch {
    return fallback;
  }
}

/** 取当前活跃变更名（无则空串）；只读、无副作用（design §2.3.1 ctx）。 */
function detectActiveChange(root: string): string {
  try {
    return getActiveChange(root) ?? '';
  } catch {
    return '';
  }
}

/** 跨 corpus 场景求和精度（分母 0 → ratio=null，绝不产生 NaN）。 */
function aggregatePrecision(
  corpusReports: CorpusScenarioReport[],
): { mustContainSatisfied: number; mustContainTotal: number; ratio: number | null } {
  let satisfied = 0;
  let total = 0;
  for (const report of corpusReports) {
    satisfied += report.precision.mustContainSatisfied;
    total += report.precision.mustContainTotal;
  }
  return {
    mustContainSatisfied: satisfied,
    mustContainTotal: total,
    ratio: total > 0 ? satisfied / total : null,
  };
}

/** MetricResult → 汇总投影（rawData 缺省则不落键）。 */
function toSummaryMetric(metric: MetricResult): EvalSummaryMetric {
  const out: EvalSummaryMetric = {
    value: metric.value,
    weight: metric.weight,
    details: metric.details,
  };
  if (metric.rawData !== undefined) out.rawData = metric.rawData;
  return out;
}

/**
 * 构造 `EvalSummaryReport`（design §2.3.1）。
 *
 * metrics 由**进程内直接调用** L1 两评估器得到（与 `metrics` 命令同源、只读、
 * 无副作用），不 shell-out、不自建采集通道。
 */
export async function buildSummaryReport(
  report: EvalReport,
  root: string,
): Promise<EvalSummaryReport> {
  const ctx: EvaluatorContext = {
    projectRoot: root,
    changeName: detectActiveChange(root),
    roundHistory: [],
  };

  const [verifiableRatio, failOpenCount] = await Promise.all([
    verifiableRatioEvaluator.evaluate(ctx),
    failOpenCountEvaluator.evaluate(ctx),
  ]);

  const corpusReports = report.corpusReports ?? [];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    evals: {
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      duration: report.duration,
    },
    corpus: corpusReports,
    precision: aggregatePrecision(corpusReports),
    metrics: {
      'verifiable-ratio': toSummaryMetric(verifiableRatio),
      'fail-open-count': toSummaryMetric(failOpenCount),
    },
    coverageRef: {
      metric: 'vitest-v8',
      thresholds: readCoverageThresholds(root),
      command: COVERAGE_COMMAND,
    },
  };
}

/** 比值三态渲染：null → `n/a`，否则三位小数（绝不产 NaN/Infinity）。 */
function formatRatio(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(3);
}

/**
 * 文本形态渲染（四段，design §2.3.1 / line 490）：
 * ① evals 概览；② corpus（逐场景 recall/noise/precision + CI + 置信/errored 提示）；
 * ③ metrics（A1 + B4）；④ coverageRef（B6 阈值 + 采集命令）。
 */
export function renderSummaryText(summary: EvalSummaryReport): string {
  const lines: string[] = [];

  lines.push(`Eval Summary (v${summary.version}) — generated ${summary.generatedAt}`);
  lines.push(
    `evals: ${summary.evals.passed}/${summary.evals.total} passed, ` +
      `${summary.evals.failed} failed (${summary.evals.duration}ms)`,
  );

  lines.push('corpus:');
  if (summary.corpus.length === 0) {
    lines.push('  (no corpus scenarios)');
  } else {
    for (const c of summary.corpus) {
      const ci = c.recall.ci
        ? `[${c.recall.ci.lower.toFixed(3)}, ${c.recall.ci.upper.toFixed(3)}]`
        : '[n/a]';
      let line =
        `  ${c.scenario}: recall=${formatRatio(c.recall.value)} (n=${c.recall.n}, CI=${ci})` +
        ` / noise=${formatRatio(c.noise.value)} / precision=${formatRatio(c.precision.ratio)}`;
      if (c.recall.ci?.insufficient || c.noise.ci?.insufficient) {
        line += '（置信不足）';
      }
      if (c.errored > 0) {
        line += `（${c.errored} errored 已排除分母）`;
      }
      lines.push(line);
    }
  }

  lines.push('metrics:');
  const vr = summary.metrics['verifiable-ratio'];
  lines.push(
    `  verifiable-ratio: value=${vr.value.toFixed(3)} (weight=${vr.weight}) — ${vr.details}`,
  );
  const foc = summary.metrics['fail-open-count'];
  lines.push(
    `  fail-open-count: value=${foc.value.toFixed(3)} (weight=${foc.weight}) — ${foc.details}`,
  );

  const t = summary.coverageRef.thresholds;
  lines.push('coverageRef:');
  lines.push(
    `  ${summary.coverageRef.metric} thresholds ` +
      `{lines:${t.lines}, branches:${t.branches}, functions:${t.functions}, statements:${t.statements}}` +
      ` via \`${summary.coverageRef.command}\``,
  );

  return lines.join('\n');
}

export function registerEvalCommands(program: Command): void {
  const evalCmd = program
    .command('eval')
    .description('Run eval scenarios to verify guard/skill behavior');

  evalCmd
    .command('init')
    .description('Initialize .mumuspec/evals/ with sample scenarios')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const result = initEvalsDir(root);
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`✗ ${err}`);
        }
        process.exit(1);
      }

      console.log('✓ Created eval scenarios:');
      for (const f of result.created) {
        console.log(`  ${f}`);
      }
      console.log('\nEdit the scenarios in .mumuspec/evals/ to match your project.');
    });

  evalCmd
    .command('list')
    .description('List available eval scenarios')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const scenarios = discoverScenarios(root);
      if (scenarios.length === 0) {
        console.log('No eval scenarios found.');
        console.log('  Run `mumuspec eval init` to create sample scenarios.');
        return;
      }

      console.log(`\n${scenarios.length} eval scenario(s):\n`);
      for (const file of scenarios) {
        try {
          const s = loadScenario(file);
          console.log(`  ${s.name}${s.description ? ` — ${s.description}` : ''}`);
          console.log(`    Type: ${s.type}`);
          console.log(`    File: ${file}`);
        } catch (err) {
          console.log(`  ✗ ${file} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

  evalCmd
    .command('run [name]')
    .description('Run eval scenarios (all or by name)')
    .option('--workspace-path <path>', 'workspace path', '.')
    .option('--verbose', 'show detailed output')
    .option('--report', 'print aggregated eval summary (corpus + A1 + B4 + coverage ref)')
    .option('--json', 'with --report: emit machine-readable JSON')
    .action(async (name, options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      let report: EvalReport;

      if (name) {
        // Run specific scenario
        const evalsDir = join(root, '.mumuspec', 'evals');
        const filePath = join(evalsDir, `${name}.yaml`);

        if (!existsSync(filePath)) {
          console.error(`Error: Scenario "${name}" not found at ${filePath}`);
          console.error('  Run `mumuspec eval list` to see available scenarios.');
          process.exit(1);
        }

        const scenario = loadScenario(filePath);
        const result = runScenario(scenario);
        report = {
          total: 1,
          passed: result.passed ? 1 : 0,
          failed: result.passed ? 0 : 1,
          results: [result],
          duration: result.duration,
        };
      } else {
        // Run all
        report = runAllEvals(root);
      }

      // Output
      console.log(`\nEval Report: ${report.passed}/${report.total} passed (${report.duration}ms)\n`);

      for (const result of report.results) {
        const icon = result.passed ? '✓' : '✗';
        console.log(`  ${icon} ${result.scenario}`);
        if (options.verbose) {
          console.log(`    ${result.details}`);
        }
        for (const err of result.errors) {
          console.error(`    ✗ ${err}`);
        }
        for (const warn of result.warnings) {
          console.log(`    ⚠ ${warn}`);
        }
      }

      console.log('');

      // eval --report：汇总出口（纯增量，不改变既有 run 行为与退出码；仅 stdout 不落盘）
      if (options.report) {
        const summary = await buildSummaryReport(report, root);
        console.log(options.json ? JSON.stringify(summary, null, 2) : renderSummaryText(summary));
      }

      if (report.failed > 0) {
        console.error(`✗ ${report.failed} scenario(s) failed.`);
        process.exit(1);
      } else if (report.total === 0) {
        console.log('No eval scenarios found. Run `mumuspec eval init` to get started.');
      } else {
        console.log('✓ All scenarios passed.');
      }
    });

  evalCmd.action(() => {
    console.log('Run eval scenarios to verify guard/skill behavior.\n');
    console.log('Usage:');
    console.log('  mumuspec eval init              Create sample eval scenarios');
    console.log('  mumuspec eval list              List available scenarios');
    console.log('  mumuspec eval run [name]        Run scenarios (all or specific)');
    console.log('\nScenarios are YAML files in .mumuspec/evals/');
    console.log('Each scenario verifies compliance/drift/guard behavior with assertions.');
  });
}
