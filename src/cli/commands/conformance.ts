/**
 * conformance command — declaration conformance report (core-consolidation L6).
 *
 * Read-only by construction: it walks repository facts (command registry, error
 * table, config defaults, guard sources, MCP dispatch) and reports the three
 * closure equations. It is a *reported* metric — deliberately outside the loop
 * composite, so convergence weights, thresholds and stable windows stay
 * untouched, and it adds nothing to the check/validate JSON payloads.
 *
 * Usage:
 *   mumuspec conformance
 *   mumuspec conformance --json
 */
import type { Command } from 'commander';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import { ERROR_CODES } from '../../core/errors.js';
import { BUILTIN_CONSTRAINT_EXCEPTIONS } from '../../core/config-tree.js';
import { DECLARED_UNEMITTED_CODES } from '../../core/error-declarations.js';
import { loadFixtureExpectation } from '../../eval/corpus.js';
import { getDefaultConfig } from '../../core/config-io.js';
import {
  assembleReport,
  probeDeclaredImplementations,
  probeEmittedErrorCodes,
  probeErrorFixStepCommands,
  probeExceptionPointers,
  probeGatePointers,
  probeRegisteredCommandModules,
  probeSurfacePairing,
  type ConformanceProbeResult,
  type ConformanceViolation,
} from '../../core/metrics/declaration-conformance.js';

const GENERATED_ERROR_DOC = join('docs', 'reference', 'error-codes.md');

/** `top` and `top sub` keys for every command the live program exposes. */
function collectCommandIndex(program: Command): Set<string> {
  const index = new Set<string>();
  for (const cmd of program.commands) {
    index.add(cmd.name());
    for (const sub of cmd.commands) index.add(`${cmd.name()} ${sub.name()}`);
  }
  return index;
}

/** Flat directory of .ts files (non-recursive). */
function readTsDir(dir: string): Record<string, string> {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    try {
      out[name] = readFileSync(join(dir, name), 'utf-8');
    } catch {
      out[name] = '';
    }
  }
  return out;
}

/** Recursive .ts/.md scan keyed by repo-relative path. */
function readTree(root: string, dir: string, extensions: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const abs = join(root, dir);
  if (!existsSync(abs)) return out;
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.worktrees') continue;
      const p = join(current, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        try {
          out[relative(root, p)] = readFileSync(p, 'utf-8');
        } catch {
          out[relative(root, p)] = '';
        }
      }
    }
  };
  walk(abs);
  return out;
}

/**
 * E2 · a registered error code must be emitted somewhere in the loaded surface.
 * The error table itself is excluded so a code cannot count as its own emitter.
 * Codes still cited by normative documents or tests land in the advisory
 * register — the honest fix there is to build the emitter or retract the claim,
 * which is a human call, not something the ratio may decide either way.
 *
 * Declared reserved slots close only when the corpus expects nothing from them,
 * so the reservation is checked against facts rather than accepted on assertion.
 */
function emittedCodesProbe(root: string): { result: ConformanceProbeResult; advisory: ConformanceViolation[] } {
  const sources: Record<string, string> = {};
  for (const [path, text] of Object.entries(readTree(root, 'src', ['.ts']))) {
    if (path.endsWith(join('core', 'errors.ts'))) continue;
    sources[path] = text;
  }
  // 规范性引用源：设计/参考文档、规范、模块边界与测试。以下排除是刻意的——
  // KD/KP 知识页与 docs/appendix 是导入快照/冻结研究（权威在源文档），
  // `.mumuspec/changes/**` 是历史工件，三者都不构成引擎当前欠下的承诺。
  // `.mumuspec/roadmap/**` 是债务登记表：登记面若算作承诺源，裁决后的条目
  // 会被自己的登记文本永久钉住，裁决通道因此失效。
  // `.eval-corpus` 不算承诺：语料期望一个永不发射的码即"期望与发射面脱钩"。
  const cited = new Set<string>();
  const nonCommitting = [
    '.mumuspec/knowledge/',
    '.mumuspec/changes/',
    '.mumuspec/roadmap/',
    'docs/appendix/',
    GENERATED_ERROR_DOC.replace(/\\/g, '/'),
  ];
  for (const [dir, extensions] of [
    ['docs', ['.md', '.yaml', '.json']],
    ['.mumuspec', ['.md', '.yaml', '.json']],
    // 测试里的断言也是承诺：为永不发射的码建立期望即"期望与发射面脱钩"。
    ['tests', ['.md', '.yaml', '.json', '.ts']],
  ] as const) {
    for (const [rawPath, text] of Object.entries(readTree(root, dir, [...extensions]))) {
      const path = rawPath.replace(/\\/g, '/');
      if (nonCommitting.some((prefix) => path.startsWith(prefix) || path === prefix)) continue;
      for (const m of text.matchAll(/\b[EW]-[A-Z]+-\d{3}\b/g)) cited.add(m[0]);
    }
  }

  const corpusDir = join(root, '.eval-corpus');
  const corpusExpected = new Set<string>();
  if (existsSync(corpusDir)) {
    for (const entry of readdirSync(corpusDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const exp = loadFixtureExpectation(join(corpusDir, entry.name, 'expected.yaml'));
      for (const m of exp.mustContain.join('\n').matchAll(/\b[EW]-[A-Z]+-\d{3}\b/g)) corpusExpected.add(m[0]);
    }
  }

  return probeEmittedErrorCodes(
    Object.keys(ERROR_CODES),
    sources,
    cited,
    new Set(DECLARED_UNEMITTED_CODES),
    corpusExpected,
  );
}

/**
 * E3 · an always-enforce exception must name a check id the evaluator sees.
 * Resolvable ids are the registered codes (folding passes `id: err.code`) plus the
 * literal ids built by hook call sites.
 */
function exceptionAdvisory(root: string): ConformanceViolation[] {
  const hookIds = new Set<string>();
  for (const text of Object.values(readTsDir(join(root, 'src', 'hooks')))) {
    for (const m of text.matchAll(/\bid:\s*'([a-z0-9_]+)'/g)) hookIds.add(m[1]);
  }
  const resolvable = new Set<string>([...Object.keys(ERROR_CODES), ...hookIds]);
  return probeExceptionPointers(BUILTIN_CONSTRAINT_EXCEPTIONS, resolvable);
}

/**
 * E2 · every MCP tool declared in the tool table must have a dispatch branch.
 * A declared tool with no branch is a promise to agents that cannot be kept.
 */
function mcpSurfaceProbe(root: string): ConformanceProbeResult {
  const sources = Object.values(readTsDir(join(root, 'src', 'mcp'))).join('\n');
  const declared = [...sources.matchAll(/^\s*name:\s*'([a-z0-9_]+)'/gm)].map((m) => m[1]);
  const handled = new Set([...sources.matchAll(/\bcase\s+'([a-z0-9_]+)'/g)].map((m) => m[1]));
  return probeSurfacePairing('mcp-tool', declared, handled);
}

/**
 * E1 · nested sub-commands are registered by their parent module (the
 * knowledge-* family is wired inside knowledge.ts), so definitions are matched
 * against call sites across the whole CLI surface.
 */
function commandModuleProbe(root: string): ConformanceProbeResult | null {
  const commandsDir = join(root, 'src', 'cli', 'commands');
  if (!existsSync(commandsDir)) return null;
  const cliFiles = { ...readTsDir(join(root, 'src', 'cli')), ...readTsDir(commandsDir) };
  const callSites = new Set<string>();
  for (const text of Object.values(cliFiles)) {
    for (const m of text.matchAll(/\b(register[A-Za-z0-9]+)\s*\(/g)) callSites.add(m[1]);
  }
  const definitions = Object.entries(cliFiles)
    .map(([file, text]) => ({
      file,
      factories: [...text.matchAll(/export function (register[A-Za-z0-9]+)\b/g)].map((m) => m[1]),
    }))
    .filter((d) => d.factories.length > 0);
  return probeRegisteredCommandModules(definitions, callSites);
}

export function registerConformanceCommand(program: Command): void {
  program
    .command('conformance')
    .description('Report declaration conformance (E1 声明⊆实现 / E2 实现⊆消费 / E3 门⊆事实) — read-only')
    .option('--json', 'output structured JSON')
    .action((options: { json?: boolean }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = getDefaultConfig();
      const results: ConformanceProbeResult[] = [
        probeErrorFixStepCommands(ERROR_CODES, collectCommandIndex(program)),
        probeDeclaredImplementations([
          {
            // The graph and AST layers analyze these two languages only; any
            // other declared language would be a promise nobody keeps.
            subject: 'knowledge.code_graph.languages',
            declared: JSON.stringify([...(config.knowledge?.code_graph?.languages ?? [])].sort()),
            implemented: [JSON.stringify(['javascript', 'typescript'])],
          },
        ]),
        mcpSurfaceProbe(root),
      ];

      const moduleProbe = commandModuleProbe(root);
      if (moduleProbe) results.push(moduleProbe);

      const codeProbe = emittedCodesProbe(root);
      results.push(codeProbe.result);

      const enforcementSources = {
        ...readTsDir(join(root, 'src', 'guard')),
        ...readTsDir(join(root, 'src', 'change')),
      };
      if (Object.keys(enforcementSources).length > 0) {
        results.push(probeGatePointers(Object.keys(config.workflow ?? {}), enforcementSources));
      }

      const report = assembleReport(results, [...codeProbe.advisory, ...exceptionAdvisory(root)]);
      const totalViolations =
        report.e1.violations.length + report.e2.violations.length + report.e3.violations.length;

      if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        console.log('\nDeclaration Conformance');
        for (const [label, bucket] of [
          ['E1 声明⊆实现', report.e1],
          ['E2 实现⊆消费', report.e2],
          ['E3 门⊆事实', report.e3],
        ] as const) {
          console.log(
            `  ${label}: ${bucket.checked - bucket.violations.length}/${bucket.checked}  ratio=${bucket.ratio.toFixed(3)}`,
          );
        }
        for (const v of [...report.e1.violations, ...report.e2.violations, ...report.e3.violations]) {
          console.log(`  ✗ [${v.equation}/${v.probe}] ${v.subject} — ${v.detail}`);
        }
        if (report.advisory.length > 0) {
          console.log(`  ▲ 待裁决 ${report.advisory.length} 项（不计入比值，需人工判定补实现或撤回声明）:`);
          for (const a of report.advisory) {
            console.log(`    · [${a.probe}] ${a.subject} — ${a.detail}`);
          }
        }
        for (const cls of report.unprobed_classes) {
          console.log(`  ○ 未建探针（结论不覆盖）: ${cls}`);
        }
        console.log(`\n  违反合计: ${totalViolations}`);
      }

      if (totalViolations > 0) process.exit(1);
    });
}
