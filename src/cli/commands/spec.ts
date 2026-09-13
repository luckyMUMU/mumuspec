/**
 * spec commands — context, add-spec, validate, check, drift, search, sync-specs.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SpecFile, Requirement } from '../../core/types.js';
import { findProjectRoot, ensureDir, writeText, readText, now, normalizePath } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { formatError } from '../../core/errors.js';
import {
  createDefaultSpecContent,
  createDefaultPrdContent,
  createDefaultTechContent,
  parseSpecFile,
  serializeSpecFile,
  parsePrdFile,
  parseTechFile,
} from '../../spec/parser.js';
import { loadSpecContext, searchSpecs, findAllDistributedSpecDirs, getProhibitions } from '../../spec/loader.js';
import { validateAllSpecs } from '../../spec/validator.js';
import { validateMumuSpecStructure } from '../../spec/structure-validator.js';
import { checkCompliance, detectDrift, autoFixDrift, detectDriftWithContracts, detectAgentsDrift } from '../../guard/checker.js';
import { detectContractDrift, validateBoundaries } from '../../contract/validator.js';
import { checkGlossary } from '../../guard/glossary-checker.js';
import type { GlossaryCheckResult } from '../../guard/glossary-checker.js';
import type { DriftResult, GuardResult } from '../../core/types-workflow.js';
import { loadChangeState } from '../../change/state.js';
import { detectArchiveStateDrift } from '../../change/archive-consistency.js';
import { detectConstraintSourceDrift } from '../../spec/constraint-provenance.js';
import { detectSkillDrift } from '../../guard/skill-drift.js';
import { listCarriedConstraintItems } from '../../guard/delta-channels.js';
import { getChangeDir } from '../../change/manager.js';
import { discoverSkills } from '../../bundle/plugin-package.js';
import { listInstalledPlugins } from '../../install/plugin-install.js';
import { homedir } from 'node:os';

/**
 * 技能漂移检测源：比对技能源正文与已安装副本正文（比对前剥离 frontmatter 版本行）。
 *
 * 只对"两侧都存在"的技能产出诊断——"未安装"属覆盖度问题而非内容漂移，
 * 若纳入本源，每个未安装技能都会恒亮一条告警，而恒亮的告警会训练读者忽略整条通道。
 */
function collectSkillDrift(root: string): DriftResult[] {
  const home = homedir();
  const userSkillsDir = join(home, '.workbuddy', 'skills');
  const cacheRoot = join(home, '.workbuddy', 'plugins', 'cache');
  const skills = discoverSkills(root);

  const pairs = skills.map((s) => ({
    name: s.name,
    sourcePath: s.path,
    installPath: join(userSkillsDir, s.name, 'SKILL.md'),
  }));

  for (const id of listInstalledPlugins(cacheRoot)) {
    const [plugin, market, version] = id.split('@');
    for (const s of skills) {
      pairs.push({
        name: `${s.name} (plugin ${id})`,
        sourcePath: s.path,
        installPath: join(cacheRoot, market, plugin, version, 'skills', s.name, 'SKILL.md'),
      });
    }
  }

  return detectSkillDrift(pairs.filter((p) => existsSync(p.installPath)));
}

/** Aggregated `mumuspec check` payload — machine-consumable (LOOP-4 L1). */
interface CheckJsonPayload {
  compliance: GuardResult;
  drift: { errors: DriftResult[]; warnings: DriftResult[] };
  glossary?: GlossaryCheckResult;
  exitCode: number;
}

/** Render one requirement-bearing artifact (spec / prd / tech) — shared across artifact kinds. */
function renderRequirements(label: string, requirements: Requirement[] | undefined): void {
  if (!requirements || requirements.length === 0) return;
  console.log(`\n${label} (${requirements.length} requirements):`);
  for (const req of requirements) {
    console.log(`  ## ${req.name}`);
    if (req.shall.length > 0) {
      console.log(`  SHALL:`);
      for (const s of req.shall) console.log(`    - ${s}`);
    }
    if (req.shallNot.length > 0) {
      console.log(`  SHALL NOT:`);
      for (const s of req.shallNot) console.log(`    - ${s}`);
    }
  }
}

export function registerSpecCommands(program: Command): void {
  // === context ===
  program
    .command('context')
    .description('Get spec context for a directory (progressive disclosure)')
    .argument('<path>', 'directory path')
    .option('--json', 'output as JSON')
    .action((path, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const targetPath = resolve(path);
      const config = loadConfig(root);
      const context = loadSpecContext(targetPath, root, config);

      if (options.json) {
        console.log(JSON.stringify(context, null, 2));
        return;
      }

      console.log(`\nSpec Context for: ${targetPath}`);
      console.log(`Project root: ${root}\n`);

      for (const layer of context.layers) {
        console.log(`=== Level ${layer.level}: ${layer.scope} ===`);
        console.log(`Path: ${layer.path}`);

        // 0.19+ 格式：prd.md（WHAT）/ tech.md（HOW）；spec.md/design.md 为遗留回退
        renderRequirements('PRD', layer.prd?.requirements);
        renderRequirements('Tech', layer.tech?.requirements);
        renderRequirements('Spec', layer.spec?.requirements);

        if (layer.design) {
          console.log(`\nDesign: ${layer.design.path}`);
          const preview = layer.design.content.substring(0, 200);
          console.log(`  ${preview}${layer.design.content.length > 200 ? '...' : ''}`);
        }

        console.log('');
      }

      if (context.prohibitions.length > 0) {
        console.log('=== Prohibitions (Inherited) ===');
        for (const p of context.prohibitions) {
          console.log(`  - ${p}`);
        }
      }

      // Display knowledge memory context (LLM-Wiki)
      if (context.knowledge_memory) {
        const km = context.knowledge_memory;
        console.log('\n=== Knowledge Memory (LLM-Wiki) ===');
        console.log(km.project_summary);

        if (km.relevant_decisions.length > 0) {
          console.log('\n  Relevant Decisions:');
          for (const d of km.relevant_decisions) {
            console.log(`    - [${d.id}] ${d.title}`);
            console.log(`      ${d.summary}`);
          }
        }
        if (km.relevant_patterns.length > 0) {
          console.log('\n  Relevant Patterns:');
          for (const p of km.relevant_patterns) {
            console.log(`    - [${p.id}] ${p.title}`);
            console.log(`      ${p.summary}`);
          }
        }
        if (km.relevant_risks.length > 0) {
          console.log('\n  Active Risks:');
          for (const r of km.relevant_risks) {
            console.log(`    - [${r.id}] ${r.title}`);
            console.log(`      ${r.summary}`);
          }
        }
        if (km.recent_lessons.length > 0) {
          console.log('\n  Recent Lessons:');
          for (const l of km.recent_lessons) {
            console.log(`    - [${l.id}] ${l.title}`);
            console.log(`      ${l.summary}`);
          }
        }
      }
    });

  // === add-spec ===
  program
    .command('add-spec')
    .description('Add a specification to a scope')
    .argument('<scope>', 'scope path (e.g., src/api)')
    .option('--type <type>', 'constraint type (shall|shall-not)', 'shall')
    .option('--requirement <name>', 'requirement name', 'General')
    .option('--text <text>', 'constraint text')
    .action((scope, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      if (!options.text) {
        console.error('Error: --text is required');
        process.exit(1);
      }

      const scopePath = resolve(root, scope);
      const mumuDir = join(scopePath, '.mumuspec');
      const specPath = join(mumuDir, 'spec.md');

      if (!existsSync(mumuDir)) {
        ensureDir(mumuDir);
        // Create initial spec
        const layer = scope.split('/').length;
        writeText(specPath, createDefaultSpecContent(layer, scope));
      }

      const content = readText(specPath) || '';
      let spec: SpecFile;
      try {
        spec = parseSpecFile(content, specPath);
      } catch {
        spec = {
          path: specPath,
          frontmatter: { layer: scope.split('/').length, scope, last_updated: now().split('T')[0] },
          requirements: [] as Requirement[],
          raw: content,
        } as SpecFile;
      }

      // Find or create requirement
      let req = spec.requirements.find((r: Requirement) => r.name === options.requirement);
      if (!req) {
        req = { name: options.requirement, shall: [], shallNot: [], enforcement: [] };
        spec.requirements.push(req);
      }

      // Add constraint
      if (options.type === 'shall-not') {
        req.shallNot.push(options.text);
      } else {
        req.shall.push(options.text);
      }

      // Update last_updated
      spec.frontmatter.last_updated = now().split('T')[0];

      writeText(specPath, serializeSpecFile(spec));
      console.log(`✓ Added ${options.type} constraint to ${scope}`);
    });

  // === validate ===
  program
    .command('validate')
    .description('Validate all spec formats')
    .option('--quiet', 'only show errors')
    .option('--json', 'output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);
      const result = validateAllSpecs(root, config);
      const structureResult = validateMumuSpecStructure(root);

      // Merge structure validation errors into the main result
      result.errors.push(...structureResult.errors);
      result.warnings.push(...structureResult.warnings);
      result.passed = result.errors.length === 0;

      // E-SPEC-015 exit triad (annotate / lexical rewrite / declare manual) as a
      // per-item remediation hint — same constant feeds text and JSON channels.
      const remediationFor = (polarity: string): string =>
        polarity === 'shall-not'
          ? '(a) mumuspec annotate <scope> 补 frontmatter 注解 | (b) 改写文本使其含反引号词法锚点（长度>2） | (c) Requirement 块声明 Enforcement: manual(...)'
          : 'Requirement 块声明 Enforcement: manual(...)（SHALL 当前无自动通道）';

      const coverage = result.coverage
        ? {
            ...result.coverage,
            unverifiable_items: (result.coverage.unverifiable_items ?? []).map((it) => ({
              ...it,
              remediation: remediationFor(it.polarity),
            })),
          }
        : undefined;

      if (options.json) {
        console.log(JSON.stringify({ ...result, coverage }, null, 2));
        return;
      }

      if (result.passed && result.warnings.length === 0) {
        console.log('✓ All specs are valid');
      } else {
        if (result.errors.length > 0) {
          console.error(`\n✗ ${result.errors.length} error(s):`);
          for (const err of result.errors) {
            console.error(formatError(err.code, { message: err.message, detail: err.detail }));
            console.error('');
          }
        }
        if (!options.quiet && result.warnings.length > 0) {
          console.warn(`\n⚠ ${result.warnings.length} warning(s):`);
          for (const warn of result.warnings) {
            console.warn(`[${warn.code}] ${warn.message}`);
            if (warn.detail) console.warn(`  ${warn.detail}`);
          }
        }
      }

      // P0 verifier semantics: enforcement coverage report (proposal §3.5)
      if (coverage && coverage.total > 0) {
        const c = coverage;
        console.log(`\nEnforcement Coverage (${c.total} constraints):`);
        console.log(
          `  enforced-strong: ${c.enforced_strong}  enforced-weak: ${c.enforced_weak}` +
          `  manual: ${c.manual}  unverifiable: ${c.unverifiable}`,
        );
        console.log(
          `  declared_ratio: ${(c.declared_ratio * 100).toFixed(1)}%` +
          `  strong_ratio: ${(c.strong_ratio * 100).toFixed(1)}%`,
        );
        if (c.unverifiable_items && c.unverifiable_items.length > 0) {
          console.log('  Unverifiable (migration checklist):');
          for (const item of c.unverifiable_items) {
            console.log(`    - [${item.polarity}] ${item.text} (${item.source})`);
            console.log(`      修复路径: ${item.remediation}`);
          }
        }
      }

      if (!result.passed) process.exit(1);
    });

  // === check ===
  // ponytail: unified single top-level `check` (was duplicated in check.ts → commander collision / CLI crash)
  program
    .command('check')
    .description('Full compliance check: SHALL/SHALL NOT + drift + agents-hash sync (+ --glossary)')
    .option('--shall', 'check SHALL only')
    .option('--shall-not', 'check SHALL NOT only')
    .option('--ponytail', 'check Ponytail compliance')
    .option('--test-immutability', 'check test immutability')
    .option('--staged-only', 'check staged files only')
    .option('--glossary', 'scan terminology drift against docs/reference/glossary.md (CHG-4)')
    .option('--strict', 'with --glossary: also report `门禁` in docs/skills (default: src only)')
    .option('--fix', 'attempt auto-fix for fixable drift (contract registry etc.)')
    .option('--json', 'output as JSON')
    .action((options: {
      shall?: boolean; shallNot?: boolean; ponytail?: boolean; testImmutability?: boolean;
      stagedOnly?: boolean; glossary?: boolean; strict?: boolean; fix?: boolean; json?: boolean;
    }) => {
      // LOOP-4 L2: any subsystem throw must degrade to a formatted error + exit 1,
      // never crash the process and mask the remaining conclusions.
      try {
        const root = findProjectRoot();
        if (!root) {
          console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
          process.exit(1);
        }

        const config = loadConfig(root);
        const result = checkCompliance(root, {
          shall: options.shall,
          shallNot: options.shallNot,
          ponytail: options.ponytail,
          testImmutability: options.testImmutability,
          stagedOnly: options.stagedOnly,
          strength: config.constraint_strength,
        });

        let exitCode = result.passed ? 0 : 1;

        // Drift (spec + contract + agents-hash sync + constraint provenance)
        //
        // 每个检测源**逐源隔离**：任一源抛出异常不得中止整个 check——那会把其余源
        // 的发现全部丢在一句泛化的 E-CHECK-001 后面（check 从"报告问题"退化成
        // "自身崩溃"）。失败源记为一条恒可见的 drift（盲区必须上报，不许静默），
        // 其余源照常产出。
        const drifts: DriftResult[] = [];
        const driftSources: [string, () => DriftResult[]][] = [
          ['guard-contracts', () => detectDriftWithContracts(root)],
          ['agents-hash', () => detectAgentsDrift(root)],
          ['archive-state', () => detectArchiveStateDrift(root)],
          ['constraint-source', () => detectConstraintSourceDrift(root)],
          ['skill-drift', () => collectSkillDrift(root)],
        ];
        for (const [label, runSource] of driftSources) {
          try {
            drifts.push(...runSource());
          } catch (err) {
            drifts.push({
              type: 'drift_source_failed',
              code: 'W-CHECK-002',
              severity: 'WARN',
              message: `drift 检测源 "${label}" 抛出异常，该源本轮无结果：${(err as Error).message}`,
              fixHint: '排查该检测源的失败原因（其余检测源的结果不受影响）',
            });
          }
        }
        const driftErrors = drifts.filter((d) => d.severity === 'ERROR');
        const driftWarns = drifts.filter((d) => d.severity !== 'ERROR');
        if (driftErrors.length > 0) exitCode = 1;

        // Glossary terminology scan (CHG-4)
        let glossaryResult: GlossaryCheckResult | undefined;
        if (options.glossary) {
          glossaryResult = checkGlossary(root, { strict: options.strict });
          if (glossaryResult.count > 0 && options.strict) exitCode = 1;
        }

        // LOOP-4 L1: --json aggregates the FULL result (compliance + drift + glossary)
        // into one payload and exits with the real code — no early return, no false green.
        if (options.json) {
          const payload: CheckJsonPayload = {
            compliance: result,
            drift: { errors: driftErrors, warnings: driftWarns },
            exitCode,
          };
          if (options.glossary && glossaryResult) payload.glossary = glossaryResult;
          console.log(JSON.stringify(payload, null, 2));
          if (exitCode !== 0) process.exit(exitCode);
          return;
        }

        if (result.passed && result.warnings.length === 0) {
          console.log('✓ All checks passed');
        } else {
          if (result.errors.length > 0) {
            console.error(`\n✗ ${result.errors.length} error(s):`);
            for (const err of result.errors) {
              console.error(`[${err.code}] ${err.message}`);
              if (err.detail) console.error(`  ${err.detail}`);
            }
          }
          if (result.warnings.length > 0) {
            console.warn(`\n⚠ ${result.warnings.length} warning(s):`);
            for (const warn of result.warnings) {
              console.warn(`[${warn.code}] ${warn.message}`);
              if (warn.detail) console.warn(`  ${warn.detail}`);
            }
          }
        }

        if (driftErrors.length > 0) {
          console.log(`\n[drift] ${driftErrors.length} ERROR:`);
          for (const d of driftErrors) {
            console.log(`  [${d.code ?? d.type}] ${d.message}${d.file ? ` (${d.file})` : ''}${d.fixHint ? ` — ${d.fixHint}` : ''}`);
          }
        } else {
          console.log('\n[drift] OK');
        }
        for (const d of driftWarns) {
          console.log(`  ⚠ [${d.code ?? d.type}] ${d.message}${d.file ? ` (${d.file})` : ''}`);
        }

        if (options.glossary && glossaryResult) {
          if (glossaryResult.count > 0) {
            console.log(`\n[glossary] ${glossaryResult.count} 术语混用:`);
            for (const f of glossaryResult.findings) {
              const loc = f.line ? `${f.file}:${f.line}` : f.file;
              console.log(`  ⚠ [${f.type}] ${loc} — "${f.pattern}" → 建议 "${f.suggestion}"`);
            }
            if (options.strict) {
              console.log('  (--strict: 术语混用视为失败)');
            }
          } else {
            console.log('\n[glossary] OK');
          }
        }

        if (exitCode !== 0) process.exit(exitCode);
      } catch (err) {
        console.error(formatError('E-CHECK-001', { message: (err as Error).message }));
        process.exit(1);
      }
    });

  // === prohibitions ===
  program
    .command('prohibitions')
    .description('List SHALL NOT prohibitions applicable to a path (including inherited scopes)')
    .argument('<path>', 'target directory or file path')
    .option('--json', 'output as JSON')
    .action((path: string, options: { json?: boolean }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const targetPath = resolve(root, path);
      const prohibitions = getProhibitions(root, targetPath);
      if (options.json) {
        console.log(JSON.stringify({ prohibitions }, null, 2));
        return;
      }
      if (prohibitions.length === 0) {
        console.log('  No prohibitions found for this path.');
        return;
      }
      for (const p of prohibitions) {
        console.log(`  ✗ [${p.scope}] ${p.text}  (source: ${p.source})`);
      }
      console.log(`\n${prohibitions.length} prohibition(s)`);
    });

  // === drift ===
  const driftCmd = program
    .command('drift')
    .description('Detect drift between specs and code')
    .option('--change <name>', 'scope drift detection to a change')
    .option('--full', 'combined report: spec drift + contract drift + boundary validation')
    .option('--json', 'output as JSON')
    .option('--fix', 'auto-fix safe drift issues')
    .option('--dry-run', 'preview fixes without applying (use with --fix)');

  function runFullDriftReport(options: { json?: boolean }): void {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const specDrift = detectDrift(root);
    const contractReport = detectContractDrift(root);
    const boundaryResults = validateBoundaries(root);
    const boundaryErrors = boundaryResults.reduce((sum, r) => sum + r.errors.length, 0);
    const boundaryWarnings = boundaryResults.reduce((sum, r) => sum + r.warnings.length, 0);
    const report = {
      timestamp: new Date().toISOString(),
      spec_drift: { count: specDrift.length, drifts: specDrift },
      contract_drift: {
        count: contractReport.drift_count,
        critical: contractReport.has_critical_drifts,
        drifts: contractReport.drifts,
      },
      boundary_validation: {
        errors: boundaryErrors,
        warnings: boundaryWarnings,
        results: boundaryResults,
      },
      overall_status:
        specDrift.length === 0 && contractReport.drift_count === 0 && boundaryErrors === 0
          ? 'clean'
          : 'issues_detected',
    };
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(`\nFull Drift Report  (${report.timestamp})`);
    console.log(`  spec drift:      ${report.spec_drift.count} issue(s)`);
    console.log(`  contract drift:  ${report.contract_drift.count} issue(s)${report.contract_drift.critical ? '  [CRITICAL]' : ''}`);
    console.log(`  boundaries:      ${report.boundary_validation.errors} error(s) / ${report.boundary_validation.warnings} warning(s)`);
    console.log(`\n  overall: ${report.overall_status}`);
  }

  function runDriftDetection(options: {
    json?: boolean;
    fix?: boolean;
    dryRun?: boolean;
    change?: string;
  }): void {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    let results = detectDrift(root);

    if (options.change) {
      const state = loadChangeState(root, options.change);
      if (!state) {
        console.error(`Error: Could not load state for change "${options.change}".`);
        process.exit(1);
      }
      const changePrefix = normalizePath(`.mumuspec/changes/${options.change}/`);
      const scoped = results.filter(
        (d) => d.file && normalizePath(d.file).includes(changePrefix),
      );
      results = scoped;
    }

    if (options.fix) {
      const fixResult = autoFixDrift(root, results, options.dryRun);
      results = fixResult.remaining;

      if (options.json) {
        console.log(JSON.stringify({ fixed: fixResult.fixed, remaining: fixResult.remaining }, null, 2));
        return;
      }

      if (fixResult.fixed.length > 0) {
        console.log(`${options.dryRun ? '[DRY-RUN] Would fix' : 'Fixed'} ${fixResult.fixed.length} drift(s):`);
        for (const f of fixResult.fixed) {
          console.log(`  ✓ [${f.type}] ${f.message}${f.file ? ' → ' + f.file : ''}`);
        }
      }
    } else if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log('✓ No drift detected');
    } else {
      console.log(`\n${results.length} drift(s) detected:`);
      for (const drift of results) {
        const icon = drift.severity === 'ERROR' ? '✗' : '⚠';
        console.log(`  ${icon} [${drift.type}] ${drift.message}`);
        if (drift.file) console.log(`    File: ${drift.file}`);
        if (drift.fixHint) console.log(`    Hint: ${drift.fixHint}`);
      }
      console.log('\nRun `mumuspec drift --fix` to auto-fix safe issues.');
      console.log('Run `mumuspec drift --fix --dry-run` to preview fixes.');
    }

    // Delta preview (drift-delta-preview, 2026-09-13): what archiving this
    // change would merge into the main spec — openspec show --diff equivalent.
    if (options.change) {
      const state = loadChangeState(root, options.change);
      if (state) {
        const items = listCarriedConstraintItems(getChangeDir(root, options.change, state.scope));
        console.log('\nDelta 预览（归档将并入主规范）:');
        if (items.length === 0) {
          console.log('  （无携带约束）');
        } else {
          for (const item of items) {
            console.log(`  + [${item.polarity}] ${item.text}  ← ${item.file}`);
          }
        }
      }
    }
  }

  driftCmd.action((options) => {
    if (options.full) {
      runFullDriftReport(options);
      return;
    }
    runDriftDetection(options);
  });

  // Deprecated alias — 与 `mumuspec drift` 完全重合（--change 已提升到主命令）。
  // 保留隐藏别名以兼容既有脚本；将在下一个 minor 版本移除（2026-09-05 去重）。
  // 注意：别名与主命令共享同名选项时，commander 会把 `detect` 之后的选项吸收进
  // 父命令 opts —— 因此这里合并 parent.opts() 再转发。
  driftCmd
    .command('detect', { hidden: true })
    .description('Deprecated alias of `mumuspec drift`')
    .action(function (this: Command) {
      console.error('[deprecated] `mumuspec drift detect` is deprecated — use `mumuspec drift` instead.');
      const parentOpts = (this.parent?.opts() ?? {}) as Record<string, unknown>;
      runDriftDetection({ ...parentOpts, ...this.opts() } as Parameters<typeof runDriftDetection>[0]);
    });

  // === search ===
  program
    .command('search')
    .description('Search code/spec nodes')
    .argument('<pattern>', 'search pattern')
    .option('--scope <scope>', 'filter by scope')
    .option('--type <type>', 'filter by type (shall|shall-not)')
    .action((pattern, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const results = searchSpecs(root, { keyword: pattern, scope: options.scope, type: options.type });
      if (results.length === 0) {
        console.log('No results found.');
        return;
      }
      console.log(`\n${results.length} result(s):`);
      for (const r of results) {
        console.log(`  [${r.type}] ${r.requirement}: ${r.text}`);
        console.log(`    File: ${r.file}`);
      }
    });

  // === sync-specs ===
  program
    .command('sync-specs')
    .description('Synchronize distributed spec files (validate formats, generate missing files)')
    .option('--change <name>', 'only sync specs for a specific change')
    .option('--fix', 'auto-fix missing frontmatter or format issues')
    .option('--strict', 'treat warnings as errors')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const dirs = findAllDistributedSpecDirs(root);
      let fixed = 0;
      let errors = 0;

      for (const { dir, files } of dirs) {
        const mumuDir = join(dir, '.mumuspec');

        for (const file of files) {
          const filePath = join(mumuDir, file);

          // Try to parse each file with its appropriate parser
          try {
            const content = readText(filePath);
            if (!content) continue;

            if (file === 'prd.md') {
              parsePrdFile(content, filePath);
            } else if (file === 'tech.md') {
              parseTechFile(content, filePath);
            } else if (file === 'spec.md') {
              parseSpecFile(content, filePath);
            }

            // Check for missing scope field
            if (options.fix) {
              if (/^---\n(?:.*\n)*?layer:\s*\d+\n(?!.*scope).*---/s.test(content)) {
                // Frontmatter missing scope — auto-fix by inserting
                const fixedContent = content.replace(
                  /^(---\nlayer:\s*\d+\n)(last_updated:\s*["'][^"']*["']\n)?(---)/m,
                  (_match, prefix, existingLastUpdated) => {
                    const lastUpdated = existingLastUpdated || `last_updated: "${now().split('T')[0]}"\n`;
                    return `${prefix}scope: "."\n${lastUpdated}---`;
                  }
                );
                if (fixedContent !== content) {
                  writeText(filePath, fixedContent);
                  fixed++;
                  console.log(`  Fixed: ${filePath} (added missing scope)`);
                }
              }
            }
          } catch (err) {
            errors++;
            console.error(`  ✗ ${filePath}: ${(err as Error).message}`);
          }
        }

        // Optionally generate missing distributed spec files
        if (options.fix && !files.includes('prd.md') && files.includes('tech.md')) {
          const prdPath = join(mumuDir, 'prd.md');
          writeText(prdPath, createDefaultPrdContent(1, dir === root ? '.' : dir));
          fixed++;
          console.log(`  Created: ${prdPath}`);
        }
        if (options.fix && !files.includes('tech.md') && files.includes('prd.md')) {
          const techPath = join(mumuDir, 'tech.md');
          writeText(techPath, createDefaultTechContent(1, dir === root ? '.' : dir));
          fixed++;
          console.log(`  Created: ${techPath}`);
        }
      }

      console.log(`\n✓ Sync complete: ${fixed} fixed, ${errors} errors`);
      if (errors > 0) process.exit(1);
    });

  // === annotate (P1-1 Fix: SHALL NOT semantic annotation) ===
  program
    .command('annotate')
    .description('Auto-annotate SHALL NOT prohibitions with machine-readable constraints')
    .option('--dry-run', 'show what would be annotated without writing')
    .option('--json', 'output as JSON')
    .action(async (options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const specPath = join(root, '.mumuspec', 'spec.md');
      if (!existsSync(specPath)) {
        console.error('Error: spec.md not found. Run `mumuspec init` first.');
        process.exit(1);
      }

      const content = readText(specPath);
      if (!content) {
        console.error('Error: Failed to read spec.md');
        process.exit(1);
      }

      const spec = parseSpecFile(content, specPath);
      const frontmatter = spec.frontmatter as import('../../core/types-spec.js').SpecFrontmatter;

      // Generate annotations
      const { generateAnnotations, mergeAnnotationsIntoFrontmatter } = await import('../../spec/annotation.js');
      const { annotations, needsManual } = generateAnnotations(
        spec.requirements,
        frontmatter.prohibitions || [],
      );

      if (options.json) {
        console.log(JSON.stringify({ annotations, needsManual }, null, 2));
        return;
      }

      console.log(`\n✓ Found ${annotations.length} annotations (${needsManual.length} need manual)\n`);

      if (annotations.length > 0) {
        console.log('Auto-detected annotations:');
        for (const a of annotations) {
          console.log(`  • "${a.text.substring(0, 50)}..." → ${a.annotation.type} (${a.annotation.scope || 'any'})`);
        }
      }

      if (needsManual.length > 0) {
        console.log('\nNeed manual annotation:');
        for (const m of needsManual) {
          console.log(`  • [${m.requirementName}] "${m.prohibitionText.substring(0, 60)}..."`);
        }
      }

      if (!options.dryRun && annotations.length > 0) {
        const updatedFrontmatter = mergeAnnotationsIntoFrontmatter(frontmatter, annotations);
        const updatedSpec = { ...spec, frontmatter: updatedFrontmatter };
        const serialized = serializeSpecFile(updatedSpec);
        writeText(specPath, serialized);
        console.log(`\n✓ Annotations written to ${specPath}`);
      } else if (options.dryRun) {
        console.log('\n(Dry run — no changes written)');
      }
    });
}
