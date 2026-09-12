#!/usr/bin/env node
/**
 * MumuSpec CLI — Main entry point.
 * Command modules are split across src/cli/commands/ for maintainability.
 */
import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { saveConfig, getDefaultConfig, isInitialized } from '../core/config.js';
import { getMumuSpecDir, ensureDir, writeText, writeYaml, now, appendAuditLog } from '../core/utils.js';

// Spec
import { createDefaultSpecContent, parseSpecFile, serializeSpecFile } from '../spec/parser.js';
import { injectPonytail } from '../spec/ponytail.js';
import { loadSpecContext } from '../spec/loader.js';
import type { SpecContext } from '../core/types-spec.js';

// Project Analysis & Init Generation (0.13.0+)
import { analyzeProject, type ProjectAnalysis } from '../core/project-analyzer.js';
import { generateInitialSpec, generateInitialDesign, scaffoldKnowledgeBase, generateFrontendDesignMd, isFrontendProject, generateEnvKnowledgePage } from '../core/init-generator.js';
import { generateGoalSpec, generateEnvSpec } from '../core/spec-scaffolder.js';
// Document & Spec Importer (0.13.0+)
import { detectExistingDocuments, detectThirdPartySpecs, importExistingDocuments, importThirdPartySpecs, generateImportIndex, type DetectedDocument, type DetectedSpec } from '../core/doc-importer.js';

// Rules
import { generateRulesFiles } from '../rules/generator.js';
import { renderCliCheatSheet } from './capability.js';
import { setCliCheatSheet } from '../install/rules-generator.js';

// i18n
import { initLocale } from '../i18n/locales.js';

// Shared helpers
import { getCssSummary, getDirectorySummary } from './helpers.js';

// Command modules
import { registerSpecCommands } from './commands/spec.js';
import { registerChangeCommands } from './commands/change.js';
import { registerGuardCommand } from './commands/guard.js';
import { registerStateCommands } from './commands/state.js';
import { registerKnowledgeCommands } from './commands/knowledge.js';
import { registerConstraintsCommands } from './commands/constraints.js';
import { registerFeedbackCommands } from './commands/feedback.js';
import { registerInstallCommands } from './commands/install.js';
import { registerTutorialCommand } from './commands/tutorial.js';
import { registerFinalizeArchiveCommand } from './commands/finalize-archive.js';
import { registerHooksCommands } from './commands/hooks.js';
import { registerDashboardCommands } from './commands/dashboard.js';
import { registerEvalCommands } from './commands/eval.js';
import { registerI18nCommands } from './commands/i18n.js';
import { registerSkillCommands } from './commands/skill.js';
import { registerBundleCommands } from './commands/bundle.js';
import { registerEnvCommands } from './commands/env.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerRecommendCommand } from './commands/recommend.js';
import { registerDecisionsCommand } from './commands/decisions.js';
import { registerAdviseCommand } from './commands/advise.js';
import { registerContractCommands } from './commands/contract.js';
import { registerLoopCommands } from './commands/loop.js';
import { registerMetricsCommands } from './commands/metrics.js';
import { registerCodeGraphCommand } from './commands/code-graph.js';
import { registerGrillMeCommand } from './commands/grill-me.js';
import { registerCognitiveMapCommands } from './commands/cognitive-map.js';
import { registerSyncCommand } from './commands/sync.js';
import { registerReviewCommand } from './commands/review.js';
import { registerMergeCommand } from './commands/merge.js';
import { registerAuditLogCommand } from './commands/audit-log.js';
import { registerTraceCommand } from './commands/trace.js';
import { registerGraphCommand } from './commands/graph.js';
import { registerMetaEvolveCommand } from './commands/meta-evolve.js';
import { registerTeamCommands } from './commands/team.js';
import { registerCapabilityCommand } from './commands/capability.js';

// Builds the full command tree without parsing args, so tests can import it
// and assert command-tree invariants (e.g. no duplicate registrations)
// without triggering CLI execution as a side effect.
export function buildProgram() {
const program = new Command();

// Initialize locale before any command runs
initLocale();

// CLI version reads package.json at runtime — CHANGE-3 不变式（package.json ↔ CLI
// 版本一致）由构造保证，不再依赖发布流程人工同步（2026-09-05 自洽性修复）。
const CLI_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

program
  .name('mumuspec')
  .description('MumuSpec — Tree-distributed dual-constraint specification system')
  .version(CLI_VERSION);

// === init ===
program
  .command('init')
  .description('Initialize MumuSpec with project analysis, auto-generated specs, design, and knowledge base')
  .argument('[path]', 'project path', '.')
  .option('--name <name>', 'project name')
  .option('--language <lang>', 'primary language', 'typescript')
  .option('--framework <fw>', 'framework')
  .option('--skip-analysis', 'skip project analysis and use defaults')
  .option('--no-import', 'skip importing existing documents and third-party specs')
  .option('--force', 'overwrite existing prd.md and tech.md files')
  .option('--distributed', 'use Distributed Spec V2 format (prd.md + tech.md with Requirement blocks)')
  .action(async (path, options) => {
    const projectRoot = resolve(path);

    if (isInitialized(projectRoot)) {
      console.error('Error: MumuSpec is already initialized in this directory.');
      process.exit(1);
    }

    const mumuDir = getMumuSpecDir(projectRoot);
    ensureDir(mumuDir);

    // ── Step 1: Project Analysis ──
    let analysis: ProjectAnalysis | undefined;
    if (!options.skipAnalysis) {
      try {
        analysis = analyzeProject(projectRoot);
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  MumuSpec Project Analysis                              ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`  Type:       ${analysis.projectType}`);
        console.log(`  Framework:   ${analysis.framework !== 'none' ? analysis.framework : 'none detected'}`);
        console.log(`  Language:   ${analysis.language}${analysis.hasTypeScript ? ' (strict)' : ''}`);
        console.log(`  CSS:         ${getCssSummary(analysis)}`);
        console.log(`  Testing:    ${analysis.hasTests ? 'Yes' : 'No'}`);
        console.log(`  Source:      ${analysis.sourceDirs.join(', ') || 'none'}`);
        console.log(`  Files (est): ${analysis.totalFiles}`);
        console.log('');
      } catch (err) {
        console.warn(`⚠ Project analysis failed: ${(err as Error).message}`);
        console.warn('  Falling back to defaults. Use --skip-analysis to suppress this warning.');
      }
    }

    // ── Step 2: Create config ──
    const projectName = options.name || projectRoot.split(/[\\/]/).pop() || 'my-project';
    const config = getDefaultConfig(projectName);
    config.project.language = options.language;
    if (options.framework) config.project.framework = options.framework;
    if (analysis) {
      config.project.language = analysis.language;
      if (analysis.framework !== 'none') {
        config.project.framework = analysis.framework;
      }
    }
    saveConfig(projectRoot, config);

    // ── Step 3: Create root spec.md (analysis-aware) ──
    let specContent: string;
    if (analysis) {
      specContent = generateInitialSpec(analysis);
      // Inject Ponytail on top of auto-generated spec if enabled
      if (config.ponytail.auto_inject_to_root) {
        const specPath = join(mumuDir, 'spec.md');
        // Write initial version first, then parse + inject + overwrite
        writeText(specPath, specContent);
        const spec = parseSpecFile(specContent, specPath);
        const injected = injectPonytail(spec);
        specContent = serializeSpecFile(injected);
        writeText(specPath, specContent);
      }
    } else {
      specContent = createDefaultSpecContent(0, '.');
      if (config.ponytail.auto_inject_to_root) {
        const specPath = join(mumuDir, 'spec.md');
        const spec = parseSpecFile(specContent, specPath);
        const injected = injectPonytail(spec);
        specContent = serializeSpecFile(injected);
      }
    }
    // ── Step 3: Create root spec.md (analysis-aware) — with overwrite protection ──
    const specPath = join(mumuDir, 'spec.md');
    if (options.force !== true && existsSync(specPath)) {
      console.log(`⚠ Skipped spec.md (already exists, use --force to overwrite)`);
    } else {
      writeText(specPath, specContent);
    }

    // ── Step 4: Create root design.md (analysis-aware) — with overwrite protection ──
    const designPath = join(mumuDir, 'design.md');
    const designContent = analysis ? generateInitialDesign(analysis) : `# Design: ${config.project.name}\n\n## Architecture Overview\n[Describe the overall architecture]\n\n## Key Decisions\n[Document key architectural decisions]\n`;
    if (options.force !== true && existsSync(designPath)) {
      console.log(`⚠ Skipped design.md (already exists, use --force to overwrite)`);
    } else {
      writeText(designPath, designContent);
    }

    // ── Step 4.5: Create root prd.md + tech.md (NEW) ──
    let prdFiles: string[] = [];
    let techFiles: string[] = [];
    if (analysis) {
      try {
        const { scaffoldDistributedSpecs } = await import('../core/spec-scaffolder.js');
        const created = scaffoldDistributedSpecs(projectRoot, analysis, {
          force: options.force === true,
        });
        for (const f of created) {
          if (f.endsWith('prd.md')) prdFiles.push(f);
          else if (f.endsWith('tech.md')) techFiles.push(f);
        }
      } catch {
        // Non-fatal: scaffolding failure doesn't block initialization
      }
    }

    // ── Step 5: Create root prohibitions.md ──
    const prohibitionsPath = join(mumuDir, 'prohibitions.md');
    writeText(prohibitionsPath, '# Global Prohibitions\n\n## All Modules\n(Add global SHALL NOT constraints here)\n');

    // ── Step 6: Create index.yaml (with detected modules) ──
    const indexPath = join(mumuDir, 'index.yaml');
    const indexChildren = (analysis?.sourceDirs || []).map((dir) => ({
      name: dir,
      path: `${dir}`,
      prd_summary: getDirectorySummary(dir, analysis!.projectType),
      tech_summary: getDirectorySummary(dir, analysis!.projectType),
      constraint_count: 0,
    }));
    writeYaml(indexPath, {
      scope: '.',
      layer: 0,
      ...(analysis ? { last_updated: now().split('T')[0] } : {}),
      children: indexChildren,
    });

    // ── Step 7: Create standard directories ──
    ensureDir(join(mumuDir, 'changes'));
    ensureDir(join(mumuDir, 'changes', 'archive'));
    ensureDir(join(mumuDir, 'knowledge'));
    ensureDir(join(mumuDir, 'contracts', 'external'));
    ensureDir(join(mumuDir, 'contracts', 'outbound'));
    ensureDir(join(mumuDir, 'contracts', 'schemas'));
    ensureDir(join(mumuDir, 'skills'));

    // ── Step 8: Initialize knowledge base with auto-generated pages ──
    let knowledgeFiles: string[] = [];
    if (analysis) {
      const result = scaffoldKnowledgeBase(projectRoot, config, analysis);
      knowledgeFiles = result.created;

      // ── Step 8.5: Environment detection ──
      const envResult = await generateEnvKnowledgePage(projectRoot, config, analysis);
      if (envResult) {
        const envPagePath = join(projectRoot, config.knowledge.wiki.dir, envResult.filePath);
        writeText(envPagePath, envResult.content);
        knowledgeFiles.push(envPagePath);
      }
    }

    // ── Step 8.5: Import existing documents and third-party specs ──
    let importedDocFiles: string[] = [];
    let importedSpecFiles: string[] = [];
    if (!options.noImport) {
      const detectedDocs: DetectedDocument[] = detectExistingDocuments(projectRoot);
      const detectedSpecs: DetectedSpec[] = detectThirdPartySpecs(projectRoot);

      if (detectedDocs.length > 0 || detectedSpecs.length > 0) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  Document & Spec Import                                 ║');
        console.log('╚══════════════════════════════════════════════════════════╝');

        if (detectedDocs.length > 0) {
          console.log(`  Documents detected: ${detectedDocs.length}`);
          for (const doc of detectedDocs) {
            console.log(`    - ${doc.path} (${doc.type})`);
          }
          importedDocFiles = importExistingDocuments(projectRoot, config, detectedDocs);
          console.log(`  ✓ Imported ${importedDocFiles.length} document(s) to knowledge/imports/`);
        }

        if (detectedSpecs.length > 0) {
          console.log(`  Third-party specs detected: ${detectedSpecs.length}`);
          for (const spec of detectedSpecs) {
            console.log(`    - ${spec.path} (${spec.format})`);
          }
          importedSpecFiles = importThirdPartySpecs(projectRoot, config, detectedSpecs);
          console.log(`  ✓ Imported ${importedSpecFiles.length} spec(s) to knowledge/external-specs/`);
        }

        // Generate import index
        generateImportIndex(projectRoot, config, detectedDocs, detectedSpecs);
      }
    }

    // ── Step 9: Generate root DESIGN.md for frontend projects ──
    let rootDesignMdPath: string | undefined;
    if (analysis && isFrontendProject(analysis)) {
      rootDesignMdPath = join(projectRoot, 'DESIGN.md');
      const designMdContent = generateFrontendDesignMd(analysis);
      writeText(rootDesignMdPath, designMdContent);
    }

    // ── Step 10: Generate Rules files ──
    if (config.ai.generate_rules) {
      // 规范链摘要取自 loader、CLI 速查取自命令注册表 — 均为运行时单一事实源，
      // 避免 Rules 文件与项目实际状态 / 命令集漂移。
      let ruleSpecContext: SpecContext | undefined;
      try {
        ruleSpecContext = loadSpecContext(projectRoot, projectRoot, config);
      } catch {
        // Best-effort: 规范链不可用时 Rules 仍须生成（摘要回落为"尚未生成"提示）
      }
      // goal-p0-dispatch-gate (C2/D1): consume { written, skipped } — skip 仅诊断，不写盘
      const rulesResult = generateRulesFiles(
        projectRoot,
        config,
        ruleSpecContext,
        renderCliCheatSheet(program),
      );
      if (rulesResult.written.length === 0 && rulesResult.skipped.length === 0) {
        console.log('  ⚠ No rule files generated (none configured).');
      }
      for (const f of rulesResult.skipped) {
        console.log(`  ⚠ Skipped user-owned rule file: ${f.path}${f.diagnostic ? ` (${f.diagnostic})` : ''}`);
      }
    }

    // ── Step 11: Audit log ──
    appendAuditLog(mumuDir, { actor: 'user', action: 'init', result: 'success' });

    // ── Step 12: Auto-sync (code → persistence) ──
    // Sync ensures BOUNDARY.md and index.yaml match the actual codebase,
    // serving as the entry point for both fresh init and old-version migration.
    console.log('');
    console.log('  ⟳ Syncing code state → persistent spec...');
    const { executeSync } = await import('./commands/sync.js');
    const syncResult = executeSync(projectRoot, { check: false, migrate: false });
    console.log(`    ✓ Sync complete: ${syncResult.modulesScanned} modules, ${syncResult.indexAligned} aligned`);
    if (syncResult.issues.length > 0) {
      const warns = syncResult.issues.filter((i) => i.severity === 'warning');
      if (warns.length > 0) {
        console.log(`    ⚠ ${warns.length} sync warning(s) — run 'mumuspec sync --check' for details`);
      }
    }

    // ── Summary ──
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  MumuSpec Initialized Successfully                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  ✓ Config:        ${join(mumuDir, 'config.yaml')}`);
    console.log(`  ✓ Root Spec:     ${specPath}`);
    console.log(`  ✓ Root Design:   ${designPath}`);
    console.log(`  ✓ Prohibitions:  ${prohibitionsPath}`);
    console.log(`  ✓ Index:         ${indexPath}`);
    if (prdFiles.length > 0) {
      console.log(`  ✓ Prd Files:     ${prdFiles.length} files created`);
      for (const pf of prdFiles.slice(0, 5)) {
        console.log(`    - ${pf.replace(projectRoot + '/', '')}`);
      }
      if (prdFiles.length > 5) {
        console.log(`    ... and ${prdFiles.length - 5} more`);
      }
    }
    if (techFiles.length > 0) {
      console.log(`  ✓ Tech Files:    ${techFiles.length} files created`);
      for (const tf of techFiles.slice(0, 5)) {
        console.log(`    - ${tf.replace(projectRoot + '/', '')}`);
      }
      if (techFiles.length > 5) {
        console.log(`    ... and ${techFiles.length - 5} more`);
      }
    }
    if (knowledgeFiles.length > 0) {
      console.log(`  ✓ Knowledge:     ${knowledgeFiles.length} files created`);
      for (const kf of knowledgeFiles) {
        console.log(`    - ${kf.replace(projectRoot + '/', '')}`);
      }
    }
    if (rootDesignMdPath) {
      console.log(`  ✓ Style Guide:   ${rootDesignMdPath}`);
    }
    if (importedDocFiles.length > 0 || importedSpecFiles.length > 0) {
      console.log(`  ✓ Imports:       ${importedDocFiles.length} docs, ${importedSpecFiles.length} specs`);
    }
    if (config.ai.generate_rules) {
      console.log(`  ✓ Rules Files:   ${config.ai.rules_files.join(', ')}`);
    }

    // Generate goal.md and env-spec.md if --distributed flag is set
    // or if they don't already exist (for backward compatibility)
    if (options.distributed) {
      // goal.md
      const goalPath = join(mumuDir, 'goal.md');
      let goalCreated = false;
      try {
        if (!existsSync(goalPath)) {
          writeText(goalPath, generateGoalSpec({
            projectName: options.name || basename(projectRoot),
          }));
          goalCreated = true;
        }
      } catch {
        // Best-effort
      }

      // env-spec.md
      const envPath = join(mumuDir, 'env-spec.md');
      let envCreated = false;
      try {
        if (!existsSync(envPath)) {
          writeText(envPath, generateEnvSpec({
            projectName: options.name || basename(projectRoot),
          }));
          envCreated = true;
        }
      } catch {
        // Best-effort
      }

      if (goalCreated || envCreated) {
        if (goalCreated) console.log(`  ✓ Goal Spec:    goal.md`);
        if (envCreated) console.log(`  ✓ Env Spec:     env-spec.md`);
      }
    }

    console.log('');
    console.log('Next steps:');
    console.log('  1. Review and customize .mumuspec/spec.md');
    console.log('  2. Update .mumuspec/design.md with your architecture decisions');
    console.log('  3. Run `mumuspec new <name>` to create your first change');
    console.log('  4. Run `mumuspec doctor` to verify your environment');
  });

// Register all command modules
registerSpecCommands(program);
registerChangeCommands(program);
registerGuardCommand(program);
registerStateCommands(program);
registerKnowledgeCommands(program);
registerConstraintsCommands(program);
registerFeedbackCommands(program);
registerInstallCommands(program);
registerFinalizeArchiveCommand(program);
registerHooksCommands(program);
registerDashboardCommands(program);
registerEvalCommands(program);
registerI18nCommands(program);
registerSkillCommands(program);
registerBundleCommands(program);
registerEnvCommands(program);
registerDoctorCommand(program);
registerRecommendCommand(program);
registerDecisionsCommand(program);
registerAdviseCommand(program);
registerContractCommands(program);
registerLoopCommands(program);
registerMetricsCommands(program);
registerCodeGraphCommand(program);
registerGrillMeCommand(program);
registerCognitiveMapCommands(program);
registerSyncCommand(program);
registerReviewCommand(program);
registerMergeCommand(program);
registerAuditLogCommand(program);
registerTraceCommand(program);
registerGraphCommand(program);
registerTutorialCommand(program);
registerMetaEvolveCommand(program);
registerTeamCommands(program);
registerCapabilityCommand(program);

// 命令注册表至此完备 — 注入 CLI 速查，使 install 路径生成的 AGENTS.md 与 init 路径同源
setCliCheatSheet(renderCliCheatSheet(program));

// Handle unknown commands gracefully
program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  console.error('See --help for a list of available commands.');
  process.exit(1);
});

  return program;
}
