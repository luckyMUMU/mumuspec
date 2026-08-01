#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { MumuSpecConfig } from './core/config.js';
import { loadConfig, saveConfig, getDefaultConfig, isInitialized } from './core/config.js';
import { findProjectRoot, getMumuSpecDir, ensureDir, writeText, readText, writeYaml, now, appendAuditLog, normalizePath } from './core/utils.js';
import { MumuSpecError, formatError } from './core/errors.js';

// Spec
import { createDefaultSpecContent, parseSpecFile, serializeSpecFile } from './spec/parser.js';
import { loadSpecContext, searchSpecs, getProhibitions, buildIndex } from './spec/loader.js';
import { validateAllSpecs, validateSpecFile } from './spec/validator.js';
import { injectPonytail, getPonytailRequirement, PONYTAIL_LADDER, NON_LAZY_DOMAINS } from './spec/ponytail.js';

// Change
import { createChange, loadChangeState, saveChangeState, listActiveChanges, listArchivedChanges, getActiveChange, discardChange, archiveChange, initTestCases, lockTestCases, verifyTestCases, initBuildLayers, updateBuildLayerStatus, appendDecision, getChangeStatusSummary, getChangeDir } from './change/manager.js';
import { canTransition, executeTransition, executeRollback, getValidTransitions, getNextPhase, getWorkflowPhases, isTerminal, requiresUserConfirmation } from './change/state-machine.js';

// Guard
import { checkCompliance, detectDrift } from './guard/checker.js';
import { runPhaseGuard } from './guard/phase-guard.js';

// Rules
import { generateRulesFiles } from './rules/generator.js';

// Knowledge
import { listKnowledgePages, getKnowledgePage, searchKnowledge, getKnowledgeContext, createKnowledgePage, verifyKnowledge, listStalePages, supersedeKnowledge, loadPageIndex, rebuildPageIndex, analyzeImpact, generateOnboardingPath, analyzeCoverage, readReverseIndex, answerQuery, getDashboardData, organizeKnowledge } from './knowledge/manager.js';

// Constraints (0.12.1+)
import { resolveConstraintTree, STRENGTH_ACTION_MAP, WORKFLOW_RULE_DIMENSION, WORKFLOW_STRENGTH_MATRIX } from './core/config.js';
import { loadAllConstraints, resolveRootStrength } from './core/constraints-loader.js';
import { resolveWorkflowRule } from './core/constraint-evaluator.js';

// Feedback (0.12.1+)
import { submitFeedback, listAllFeedbacks, getFeedbackContent, updateFeedbackStatus, createSessionSummary, ensureFeedbackStructure } from './feedback/manager.js';
import { appendFeedbackToChange, getChangeFeedbacks } from './change/manager.js';

// Install
import {
  getManifest,
  installPackage,
  searchPackages,
  listInstalledCatpaw,
  resolvePackage,
  installCatpawMcp,
  listInstalledMcp,
  installCatpawCommand,
  getMcpPresets,
  getCommandPresets,
  formatInstalledSkills,
  type AgentType,
  type InstallMode,
  type InstallResult,
  type InstallMcpResult,
  type InstallCommandResult,
} from './install/installer.js';

// Project Analysis & Init Generation (0.13.0+)
import { analyzeProject, type ProjectAnalysis } from './core/project-analyzer.js';
import { generateInitialSpec, generateInitialDesign, scaffoldKnowledgeBase, generateFrontendDesignMd, isFrontendProject, generateEnvKnowledgePage } from './core/init-generator.js';
// Document & Spec Importer (0.13.0+)
import { detectExistingDocuments, detectThirdPartySpecs, importExistingDocuments, importThirdPartySpecs, generateImportIndex, type DetectedDocument, type DetectedSpec } from './core/doc-importer.js';

// Environment Detection (0.13.0+)
import { detectEnvironment, saveEnvSpec, validateEnv, diffEnv } from './core/env-detector.js';

// Hooks
import {
  installHooks,
  uninstallHooks,
  getHookStatus,
  runHook,
  type HookInstallResult,
  type HookRunResult,
  type HookType,
} from './hooks/guard.js';

// Eval
import {
  loadScenario,
  runScenario,
  runAllEvals,
  discoverScenarios,
  initEvalsDir,
  type EvalScenario,
  type EvalReport,
} from './eval/runner.js';

// i18n
import {
  initLocale,
  getLocale,
  setLocale,
  listAvailableLocales,
  resolveSkillPath,
  uiString,
  t,
  type Locale,
} from './i18n/locales.js';

// Skill Authoring
import {
  validateSkill,
  listCustomSkills,
  scaffoldSkill,
  generateAuthoringProtocol,
  AUTHORING_PROTOCOL,
} from './skill-authoring/protocol.js';

// Bundle
import {
  createBundle,
  validateBundle,
  installBundle,
  publishBundle,
  listBundles,
  type BundleResult,
  type PublishedInstallResult,
} from './bundle/packager.js';

const program = new Command();

// Initialize locale before any command runs
initLocale();

program
  .name('mumuspec')
  .description('MumuSpec — Tree-distributed dual-constraint specification system')
  .version('0.13.0-alpha.2');

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
    const specPath = join(mumuDir, 'spec.md');
    writeText(specPath, specContent);

    // ── Step 4: Create root design.md (analysis-aware) ──
    const designPath = join(mumuDir, 'design.md');
    const designContent = analysis ? generateInitialDesign(analysis) : `# Design: ${config.project.name}\n\n## Architecture Overview\n[Describe the overall architecture]\n\n## Key Decisions\n[Document key architectural decisions]\n`;
    writeText(designPath, designContent);

    // ── Step 5: Create root prohibitions.md ──
    const prohibitionsPath = join(mumuDir, 'prohibitions.md');
    writeText(prohibitionsPath, '# Global Prohibitions\n\n## All Modules\n(Add global SHALL NOT constraints here)\n');

    // ── Step 6: Create index.yaml (with detected modules) ──
    const indexPath = join(mumuDir, 'index.yaml');
    const indexChildren = (analysis?.sourceDirs || []).map((dir) => ({
      name: dir,
      path: `${dir}`,
      summary: getDirectorySummary(dir, analysis!.projectType),
      shallNotCount: 0,
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
      generateRulesFiles(projectRoot, config);
    }

    // ── Step 11: Audit log ──
    appendAuditLog(mumuDir, { actor: 'user', action: 'init', result: 'success' });

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
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review and customize .mumuspec/spec.md');
    console.log('  2. Update .mumuspec/design.md with your architecture decisions');
    console.log('  3. Run `mumuspec new <name>` to create your first change');
    console.log('  4. Run `mumuspec doctor` to verify your environment');
  });

/** Helper: get CSS summary string */
function getCssSummary(analysis: ProjectAnalysis): string {
  const parts: string[] = [];
  if (analysis.hasTailwind) parts.push('Tailwind');
  if (analysis.hasScss) parts.push('SCSS');
  if (analysis.hasCssModules) parts.push('CSS Modules');
  if (analysis.hasUiLibrary && analysis.uiLibrary) parts.push(analysis.uiLibrary);
  return parts.length > 0 ? parts.join(' + ') : 'none detected';
}

/** Helper: get directory summary for index.yaml */
function getDirectorySummary(dir: string, type: import('./core/project-analyzer.js').ProjectType): string {
  const map: Record<string, string> = {
    src: 'Primary source code',
    lib: 'Library exports and public API',
    app: 'Application routes and pages',
    packages: 'Monorepo sub-packages',
    demo: 'Demo/example applications',
    examples: 'Usage examples',
  };
  return map[dir] || `${dir} module (${type})`;
}

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

      if (layer.spec) {
        console.log(`\nSpec (${layer.spec.requirements.length} requirements):`);
        for (const req of layer.spec.requirements) {
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
    let spec: import('./core/types.js').SpecFile;
    try {
      spec = parseSpecFile(content, specPath);
    } catch {
      spec = {
        path: specPath,
        frontmatter: { layer: scope.split('/').length, scope, last_updated: now().split('T')[0] },
        requirements: [] as import('./core/types.js').Requirement[],
        raw: content,
      } as import('./core/types.js').SpecFile;
    }

    // Find or create requirement
    let req = spec.requirements.find((r) => r.name === options.requirement);
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

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
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

    if (!result.passed) process.exit(1);
  });

// === check ===
program
  .command('check')
  .description('Full compliance check')
  .option('--shall', 'check SHALL only')
  .option('--shall-not', 'check SHALL NOT only')
  .option('--ponytail', 'check Ponytail compliance')
  .option('--test-immutability', 'check test immutability')
  .option('--staged-only', 'check staged files only')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
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

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
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

    if (!result.passed) process.exit(1);
  });

// === drift ===
program
  .command('drift')
  .description('Detect drift between specs and code')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const results = detectDrift(root);

    if (options.json) {
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
      }
    }
  });

// === new ===
program
  .command('new')
  .description('Create a new change')
  .argument('<name>', 'change name')
  .option('--workflow <type>', 'workflow type (full|hotfix|tweak)', 'full')
  .option('--scope <scope>', 'affected scope (can be repeated)', collect, [])
  .action((name, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const config = loadConfig(root);

    try {
      const state = createChange(root, name, options.workflow, config, options.scope);
      console.log(`\n✓ Change "${name}" created`);
      console.log(`  Workflow: ${state.workflow}`);
      console.log(`  Phase: ${state.phase}`);
      console.log(`  Directory: ${getChangeDir(root, name)}`);
      console.log('\nNext steps:');
      if (options.workflow === 'hotfix' || options.workflow === 'tweak') {
        console.log('  1. Edit proposal.md');
        console.log('  2. Define test-cases/layer-0-cases.md');
        console.log('  3. Lock test cases: mumuspec test-cases lock ' + name);
        console.log('  4. Transition to build: mumuspec state transition ' + name + ' build');
      } else {
        console.log('  1. Edit proposal.md');
        console.log('  2. Create delta-specs/');
        console.log('  3. Transition to design: mumuspec state transition ' + name + ' design');
      }
    } catch (err) {
      if (err instanceof MumuSpecError) {
        console.error(formatError(err.code, err.context));
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  });

// === status ===
program
  .command('status')
  .description('View change status')
  .argument('[name]', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    if (!name) {
      name = getActiveChange(root) || undefined;
      if (!name) {
        console.log('No active changes.');
        const archived = listArchivedChanges(root);
        if (archived.length > 0) {
          console.log(`\nArchived changes: ${archived.length}`);
          for (const a of archived) {
            console.log(`  - ${a}`);
          }
        }
        return;
      }
    }

    const summary = getChangeStatusSummary(root, name);
    console.log(summary);
  });

// === list ===
program
  .command('list')
  .description('List active changes')
  .option('--all', 'include archived')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const active = listActiveChanges(root);
    if (active.length > 0) {
      console.log('\nActive changes:');
      for (const name of active) {
        const state = loadChangeState(root, name);
        if (state) {
          console.log(`  ${name} [${state.phase}] (${state.workflow})`);
        }
      }
    } else {
      console.log('No active changes.');
    }

    if (options.all) {
      const archived = listArchivedChanges(root);
      if (archived.length > 0) {
        console.log('\nArchived changes:');
        for (const name of archived) {
          console.log(`  ${name}`);
        }
      }
    }
  });

// === archive ===
program
  .command('archive')
  .description('Archive a change')
  .argument('<name>', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    try {
      archiveChange(root, name);
      console.log(`✓ Change "${name}" archived`);
    } catch (err) {
      if (err instanceof MumuSpecError) {
        console.error(formatError(err.code, err.context));
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  });

// === discard ===
program
  .command('discard')
  .description('Discard a change')
  .argument('<name>', 'change name')
  .option('--reason <reason>', 'discard reason')
  .action((name, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    try {
      discardChange(root, name, options.reason || 'No reason provided');
      console.log(`✓ Change "${name}" discarded`);
    } catch (err) {
      if (err instanceof MumuSpecError) {
        console.error(formatError(err.code, err.context));
      } else {
        console.error(`Error: ${(err as Error).message}`);
      }
      process.exit(1);
    }
  });

// === guard ===
program
  .command('guard')
  .description('Run phase guard check (use --apply to execute transition)')
  .argument('<change>', 'change name')
  .argument('<phase>', 'target phase')
  .option('--apply', 'apply transition if guard passes')
  .option('--confirm', 'user confirmed (required for blocking transitions)')
  .option('--json', 'output as JSON')
  .action((change, phase, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const config = loadConfig(root);
    const result = runPhaseGuard(root, change, phase, {
      strength: config.constraint_strength,
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.passed) {
      console.log(`✓ Phase guard passed: ${change} → ${phase}`);
    } else {
      console.error(`✗ Phase guard failed: ${change} → ${phase}`);
      for (const err of result.errors) {
        console.error(`  [${err.code}] ${err.message}`);
        if (err.detail) console.error(`    ${err.detail}`);
      }
    }

    if (result.warnings.length > 0) {
      for (const warn of result.warnings) {
        console.warn(`  ⚠ [${warn.code}] ${warn.message}`);
      }
    }

    // Apply transition if requested and guard passed
    if (options.apply && result.passed) {
      const state = loadChangeState(root, change);
      if (!state) {
        console.error(`Error: Change not found: ${change}`);
        process.exit(1);
      }

      // Enforce blocking point user confirmation
      const blockingInfo = requiresUserConfirmation(state.phase, phase);
      if (blockingInfo.required && !options.confirm) {
        console.error(`✗ 阻塞点 ${blockingInfo.bp}：${blockingInfo.description}`);
        console.error(`  必须显式确认。请使用：`);
        console.error(`  mumuspec guard ${change} ${phase} --apply --confirm`);
        process.exit(2);
      }

      const transitionResult = executeTransition(state, phase as any, { userConfirmed: options.confirm });
      if (transitionResult.success) {
        saveChangeState(root, change, transitionResult.state);
        console.log(`✓ 阶段转换已应用: ${state.phase} → ${phase}`);
        if (blockingInfo.bp) {
          console.log(`  阻塞点 ${blockingInfo.bp} 已通过 (${blockingInfo.description})`);
        }
      } else {
        if (transitionResult.error?.startsWith('E-CHANGE-007')) {
          console.log(`⊙ 已在目标阶段 '${phase}'，无需转换`);
        } else if (transitionResult.error?.startsWith('E-CHANGE-006')) {
          console.error(`✗ 无效的阶段转换: ${transitionResult.error}`);
          console.error(`  可运行 'mumuspec state next ${change}' 查看可转换目标`);
          process.exit(1);
        } else {
          console.error(`✗ 转换失败: ${transitionResult.error}`);
          process.exit(1);
        }
      }
    }

    if (!result.passed) process.exit(1);
  });

// === state ===
const stateCmd = program.command('state').description('State machine management');

stateCmd
  .command('init')
  .description('Initialize state for a change')
  .argument('<name>', 'change name')
  .argument('<workflow>', 'workflow type (full|hotfix|tweak)')
  .action((name, workflow) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    try {
      const state = createChange(root, name, workflow as 'full' | 'hotfix' | 'tweak', config);
      console.log(`✓ State initialized for "${name}" (${workflow})`);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

stateCmd
  .command('transition')
  .description('Transition state')
  .argument('<name>', 'change name')
  .argument('<event>', 'target phase')
  .option('--confirm', 'user confirmed')
  .option('--reason <reason>', 'reason for rollback')
  .action((name, event, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    // Check if it's a rollback
    if (event === 'design' && (state.phase === 'build' || state.phase === 'verify')) {
      const rollbackType = state.phase === 'build' ? 'build_to_design' : 'verify_to_design';
      const result = executeRollback(state, rollbackType, options.reason || 'No reason');
      if (result.success) {
        saveChangeState(root, name, result.state);
        console.log(`✓ Rolled back ${name}: ${state.phase} → design`);
        console.log(`  Rollback count: ${result.state.rollback_count}/${result.state.rollback_limit}`);
      } else {
        console.error(`✗ Rollback failed: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    if (event === 'build' && state.phase === 'verify') {
      const result = executeRollback(state, 'verify_to_build', options.reason || 'No reason');
      if (result.success) {
        saveChangeState(root, name, result.state);
        console.log(`✓ Rolled back ${name}: verify → build`);
        console.log(`  Rebuild count: ${result.state.rebuild_count}/${result.state.rebuild_limit}`);
      } else {
        console.error(`✗ Rollback failed: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    // Enforce blocking point user confirmation
    const blockingInfo = requiresUserConfirmation(state.phase, event);
    if (blockingInfo.required && !options.confirm) {
      console.error(`✗ 阻塞点 ${blockingInfo.bp}：${blockingInfo.description}`);
      console.error(`  此阶段转换必须用户显式确认。请使用 --confirm 标志：`);
      console.error(`  mumuspec state transition ${name} ${event} --confirm`);
      process.exit(2);
    }

    // Normal transition
    const result = executeTransition(state, event as any, { userConfirmed: options.confirm });
    if (result.success) {
      saveChangeState(root, name, result.state);
      console.log(`✓ Transitioned ${name}: ${state.phase} → ${event}`);
      if (blockingInfo.bp) {
        console.log(`  阻塞点 ${blockingInfo.bp} 已通过 (${blockingInfo.description})`);
      }
    } else {
      // Improved error messaging for known error codes
      if (result.error?.startsWith('E-CHANGE-007')) {
        console.error(`✗ 已在目标阶段 '${event}'，无需转换`);
        console.error(`  当前阶段: ${state.phase}`);
        process.exit(0);  // Not really an error, so exit 0
      } else if (result.error?.startsWith('E-CHANGE-006')) {
        console.error(`✗ 无效的阶段转换: ${result.error}`);
        console.error(`  可在当前阶段 ${state.phase} 使用 'mumuspec state next ${name}' 查看可转换目标`);
        process.exit(1);
      } else {
        console.error(`✗ Transition failed: ${result.error}`);
        process.exit(1);
      }
    }
  });

stateCmd
  .command('next')
  .description('Get next step')
  .argument('<name>', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    const next = getNextPhase(state);
    if (next) {
      console.log(`Next: ${next.phase} — ${next.description}`);
    } else {
      console.log('No next phase (terminal state).');
    }
  });

stateCmd
  .command('graph')
  .description('Visualize state machine')
  .argument('<name>', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    console.log(`\nState Machine for: ${name}`);
    console.log(`Current: ${state.phase}`);
    console.log(`Workflow: ${state.workflow}`);
    console.log(`\nValid transitions: ${getValidTransitions(state.phase).join(', ')}`);
    console.log(`Terminal: ${isTerminal(state.phase)}`);

    const phases = getWorkflowPhases(state.workflow);
    console.log(`\nWorkflow phases:`);
    for (const phase of phases) {
      const icon = phase === state.phase ? '▶' : phase === 'archive-completed' ? '✓' : '○';
      console.log(`  ${icon} ${phase}`);
    }

    if (state.rollback_history.length > 0) {
      console.log(`\nRollback history:`);
      for (const rh of state.rollback_history) {
        console.log(`  ${rh.timestamp}: ${rh.from} → ${rh.to} (${rh.event}) - ${rh.reason}`);
      }
    }
  });

stateCmd
  .command('get')
  .description('Get a state field value')
  .argument('<name>', 'change name')
  .argument('<field>', 'field name (e.g. phase, workflow, verify_mode, build_mode)')
  .action((name, field) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    const value = (state as unknown as Record<string, unknown>)[field];
    if (value === undefined) {
      console.log(`<undefined>`);
    } else if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(String(value));
    }
  });

stateCmd
  .command('set')
  .description('Set a state field value')
  .argument('<name>', 'change name')
  .argument('<field>', 'field name (e.g. verify_mode, build_mode, isolation, verify_result, branch_status)')
  .argument('<value>', 'value to set (use --json for complex structures)')
  .option('--json', 'parse value as JSON/YAML (auto-converts objects and arrays)')
  .action((name, field, value, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    let coerced: unknown = value;

    if (options.json) {
      // Parse as JSON first, fall back to treating as plain string
      try {
        coerced = JSON.parse(value);
      } catch {
        // If not valid JSON, keep as string
        console.warn('  (value is not valid JSON, storing as string)');
      }
    } else {
      // Type-coerce known numeric/boolean fields
      if (value === 'true') coerced = true;
      else if (value === 'false') coerced = false;
      else if (/^\d+$/.test(value)) coerced = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) coerced = parseFloat(value);
    }

    // Support dot notation for nested fields (e.g. cognitive_framework.q1_count)
    const target = state as unknown as Record<string, unknown>;
    const parts = field.split('.');
    let current: Record<string, unknown> = target;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = coerced;

    state.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
    saveChangeState(root, name, state);
    console.log(`✓ Set ${field} = ${JSON.stringify(coerced)}`);
  });

stateCmd
  .command('scale')
  .description('Evaluate change scale and recommend verify mode')
  .argument('<name>', 'change name')
  .action(async (name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const state = loadChangeState(root, name);
    if (!state) {
      console.error(`Error: Change not found: ${name}`);
      process.exit(1);
    }

    const changeDir = getChangeDir(root, name);
    const fs = await import('node:fs/promises');

    // Count tasks
    let taskCount = 0;
    const tasksPath = join(changeDir, 'tasks.md');
    if (existsSync(tasksPath)) {
      const tasksContent = readText(tasksPath) || '';
      taskCount = (tasksContent.match(/^- \[[ x]\]/gm) || []).length;
    }

    // Count delta specs
    let deltaSpecCount = 0;
    const deltaSpecsDir = join(changeDir, 'delta-specs');
    try {
      if (existsSync(deltaSpecsDir)) {
        const entries = await fs.readdir(deltaSpecsDir);
        deltaSpecCount = entries.filter((f: string) => f.endsWith('.md')).length;
      }
    } catch {
      // Ignore read errors
    }

    // Count build layers
    const buildLayerCount = state.build_layers.length;

    // Decision
    const isLarge = taskCount > 3 || deltaSpecCount > 1 || buildLayerCount > 4;
    const recommendedMode = isLarge ? 'full' : 'light';

    console.log(`\nScale evaluation for: ${name}`);
    console.log(`  Tasks:           ${taskCount}`);
    console.log(`  Delta specs:     ${deltaSpecCount}`);
    console.log(`  Build layers:    ${buildLayerCount}`);
    console.log(`  Verify mode:     ${recommendedMode}`);
    console.log(`\nRun: mumuspec state set ${name} verify_mode ${recommendedMode}`);
  });

// === test-cases ===
const testCmd = program.command('test-cases').description('Test case management');

testCmd
  .command('init')
  .description('Initialize test cases for a change')
  .argument('<name>', 'change name')
  .option('--layers <layers>', 'layer numbers (comma-separated)', '0')
  .action((name, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const layers = options.layers.split(',').map((n: string) => parseInt(n.trim()));
    initTestCases(root, name, layers);
    console.log(`✓ Test cases initialized for ${name} (layers: ${layers.join(', ')})`);
  });

testCmd
  .command('lock')
  .description('Lock test cases')
  .argument('<name>', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const hash = lockTestCases(root, name);
    console.log(`✓ Test cases locked for ${name}`);
    console.log(`  Hash: ${hash}`);
  });

testCmd
  .command('verify')
  .description('Verify test cases hash')
  .argument('<name>', 'change name')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const result = verifyTestCases(root, name);
    if (result.valid) {
      console.log(`✓ Test cases verified for ${name}`);
    } else {
      console.error(`✗ Test cases verification failed for ${name}`);
      console.error(`  Expected: ${result.expectedHash}`);
      console.error(`  Actual:   ${result.actualHash}`);
      process.exit(1);
    }
  });

// === knowledge ===
const knowledgeCmd = program.command('knowledge').description('Knowledge management');

knowledgeCmd
  .command('list')
  .description('List knowledge pages')
  .option('--type <type>', 'filter by type')
  .option('--scope <scope>', 'filter by scope')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const pages = listKnowledgePages(root, config, { type: options.type, scope: options.scope });

    if (pages.length === 0) {
      console.log('No knowledge pages found.');
      return;
    }

    console.log(`\n${pages.length} knowledge page(s):`);
    for (const page of pages) {
      console.log(`  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title} (${page.frontmatter.status})`);
    }
  });

knowledgeCmd
  .command('show')
  .description('Show a knowledge page')
  .argument('<id>', 'page ID')
  .action((id) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const page = getKnowledgePage(root, config, id);
    if (!page) {
      console.error(`Error: Knowledge page not found: ${id}`);
      process.exit(1);
    }
    console.log(`\nID: ${page.frontmatter.id}`);
    console.log(`Title: ${page.frontmatter.title}`);
    console.log(`Type: ${page.frontmatter.type}`);
    console.log(`Status: ${page.frontmatter.status}`);
    console.log(`Scope: ${page.frontmatter.scope}`);
    console.log(`Created: ${page.frontmatter.created_at}`);
    if (page.frontmatter.verified_at) console.log(`Verified: ${page.frontmatter.verified_at}`);
    if (page.frontmatter.tags && page.frontmatter.tags.length > 0) {
      console.log(`Tags: ${page.frontmatter.tags.join(', ')}`);
    }
    console.log(`\n---\n${page.content}`);
  });

knowledgeCmd
  .command('search')
  .description('Search knowledge pages')
  .argument('<keyword>', 'search keyword')
  .option('--tag <tag>', 'filter by tag')
  .option('--type <type>', 'filter by type')
  .action((keyword, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const pages = searchKnowledge(root, config, { keyword, tag: options.tag, type: options.type });
    console.log(`\n${pages.length} result(s):`);
    for (const page of pages) {
      console.log(`  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title}`);
    }
  });

knowledgeCmd
  .command('context')
  .description('Get knowledge context for a path')
  .argument('<path>', 'directory path')
  .action((path) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const pages = getKnowledgeContext(root, config, resolve(path));
    console.log(`\n${pages.length} knowledge page(s) for ${path}:`);
    for (const page of pages) {
      console.log(`  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title}`);
    }
  });

knowledgeCmd
  .command('verify')
  .description('Verify knowledge freshness')
  .option('--id <id>', 'verify specific page')
  .option('--all', 'verify all pages')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const results = verifyKnowledge(root, config, { id: options.id, all: options.all || !options.id });
    console.log(`\n${results.length} page(s) verified:`);
    for (const r of results) {
      const icon = r.status === 'fresh' ? '✓' : r.status === 'stale' ? '⚠' : '✗';
      console.log(`  ${icon} ${r.id}: ${r.status} (${r.days_since_verify} days)`);
    }
  });

knowledgeCmd
  .command('stale')
  .description('List stale knowledge pages')
  .action(() => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const stale = listStalePages(root, config);
    if (stale.length === 0) {
      console.log('✓ No stale knowledge pages');
    } else {
      console.log(`\n${stale.length} stale page(s):`);
      for (const s of stale) {
        console.log(`  [${s.status}] ${s.id}: ${s.title} (${s.days} days)`);
      }
    }
  });

knowledgeCmd
  .command('supersede')
  .description('Mark a knowledge page as superseded')
  .argument('<id>', 'old page ID')
  .requiredOption('--by <newId>', 'new page ID')
  .action((id, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    supersedeKnowledge(root, config, id, options.by);
    console.log(`✓ Knowledge page ${id} superseded by ${options.by}`);
  });

knowledgeCmd
  .command('organize')
  .description('Scan knowledge base for issues and optionally fix them')
  .option('--dry-run', 'scan and report issues without making changes')
  .option('--fix', 'automatically fix issues that can be auto-fixed')
  .option('--verbose', 'show detailed issue reports')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);

    const result = organizeKnowledge(root, config, {
      dryRun: options.dryRun,
      fix: options.fix,
      verbose: options.verbose,
    });

    // Print header
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              KNOWLEDGE BASE ORGANIZE                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Print stats
    console.log(`\n📊 Stats:`);
    console.log(`  Total files:          ${result.stats.total_files}`);
    console.log(`  Total index entries:  ${result.stats.total_index_entries}`);
    console.log(`  Duplicate IDs:        ${result.stats.duplicate_ids}`);
    console.log(`  Missing from index:   ${result.stats.missing_from_index}`);
    console.log(`  Orphaned index:       ${result.stats.orphaned_index_entries}`);
    console.log(`  Missing fields:       ${result.stats.missing_required_fields}`);
    console.log(`  Type mismatches:      ${result.stats.type_mismatches}`);

    // Print issues
    if (result.issues.length === 0) {
      console.log('\n✅ No issues found! Knowledge base is well organized.');
    } else {
      console.log(`\n⚠️  ${result.issues.length} issue(s) found:`);

      const errors = result.issues.filter((i) => i.severity === 'error');
      const warnings = result.issues.filter((i) => i.severity === 'warning');
      const infos = result.issues.filter((i) => i.severity === 'info');

      if (errors.length > 0) {
        console.log(`\n  🔴 Errors (${errors.length}):`);
        for (const issue of errors) {
          console.log(`    • [${issue.type}] ${issue.message}`);
          if (!issue.auto_fixable) {
            console.log(`      → Manual fix required`);
          }
        }
      }

      if (warnings.length > 0) {
        console.log(`\n  🟡 Warnings (${warnings.length}):`);
        for (const issue of warnings) {
          console.log(`    • [${issue.type}] ${issue.message}`);
          if (issue.auto_fixable) {
            console.log(`      → Auto-fixable (use --fix)`);
          }
        }
      }

      if (infos.length > 0 && options.verbose) {
        console.log(`\n  🔵 Info (${infos.length}):`);
        for (const issue of infos) {
          console.log(`    • [${issue.type}] ${issue.message}`);
        }
      }
    }

    // Print fix summary
    if (options.fix) {
      console.log(`\n🔧 Fixed ${result.fixed} issue(s).`);
    } else if (result.issues.some((i) => i.auto_fixable)) {
      const autoFixable = result.issues.filter((i) => i.auto_fixable).length;
      console.log(`\n💡 Run with --fix to auto-fix ${autoFixable} issue(s).`);
    }
  });

knowledgeCmd
  .command('rebuild-index')
  .description('Rebuild knowledge page index (_index.yaml) from filesystem')
  .action(() => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const index = rebuildPageIndex(root, config);
    console.log(`✓ PageIndex rebuilt with ${index.pages.length} entries.`);
  });

// === impact (Understand-A style) ===
program
  .command('impact')
  .description('Analyze change impact with knowledge correlation')
  .option('--diff <range>', 'Git diff range (e.g., "HEAD~3..HEAD")')
  .option('--scope <path>', 'Limit analysis to scope')
  .option('--json', 'Output as JSON')
  .option('--with-knowledge', 'Include knowledge warnings', true)
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);

    try {
      const result = analyzeImpact(root, config, {
        diffRange: options.diff,
        scope: options.scope,
        withKnowledge: options.withKnowledge,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Terminal output
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║                   IMPACT ANALYSIS                        ║');
      console.log('╚══════════════════════════════════════════════════════════╝');

      if (result.changed_files.length === 0) {
        console.log('\n  No changes detected.');
        return;
      }

      console.log(`\n📁 Changed Files (${result.changed_files.length}):`);
      for (const f of result.changed_files.slice(0, 10)) {
        console.log(`   [${f.change_type}] ${f.path}`);
      }

      if (result.direct_impact.length > 0) {
        console.log(`\n🔗 Direct Impact (${result.direct_impact.length}):`);
        for (const n of result.direct_impact.slice(0, 10)) {
          console.log(`   [d=${n.distance}] ${n.node_path}`);
        }
      }

      if (result.knowledge_warnings.length > 0) {
        console.log(`\n⚠️  Knowledge Warnings (${result.knowledge_warnings.length}):`);
        for (const w of result.knowledge_warnings) {
          console.log(`   ${w.severity === 'high' ? '🔴' : w.severity === 'medium' ? '🟡' : '⚪'} ${w.knowledge_id}: ${w.message}`);
          console.log(`     Suggestion: ${w.suggestion}`);
        }
      }

      const rec = result.recommendations;
      if (rec.regression_scope.length > 0 || rec.knowledge_pages_to_review.length > 0) {
        console.log('\n📋 Recommendations:');
        if (rec.regression_scope.length > 0) {
          console.log(`   Regression: ${rec.regression_scope.join(', ')}`);
        }
        if (rec.knowledge_pages_to_review.length > 0) {
          console.log(`   Knowledge: ${rec.knowledge_pages_to_review.join(', ')}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// === onboard (Understand-A style) ===
const onboardCmd = program.command('onboard').description('Onboarding guided learning paths');

onboardCmd
  .command('init')
  .description('Generate learning path for scope')
  .requiredOption('--scope <path>', 'Code scope path')
  .option('--role <role>', 'Target role (junior|mid|senior|pm)', 'junior')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const path = generateOnboardingPath(root, config, options.scope, options.role);

    // Save to .mumuspec/onboarding/
    const onboardDir = join(root, '.mumuspec', 'onboarding');
    try {
      const { mkdirSync, writeFileSync } = require('node:fs');
      mkdirSync(onboardDir, { recursive: true });
      const fileName = `${options.scope.replace(/[\/\\]/g, '-')}-${options.role}.yaml`;
      const { dumpYaml } = require('../dist/core/utils');
      writeFileSync(join(onboardDir, fileName), dumpYaml(path));
      console.log(`✓ Learning path generated: ${path.total_steps} steps (${path.estimated_minutes} min)`);
    } catch {
      console.log(`Generated path: ${path.total_steps} steps (${path.estimated_minutes} min)`);
      console.log(JSON.stringify(path, null, 2));
    }
  });

onboardCmd
  .command('start')
  .description('Start interactive learning path')
  .requiredOption('--scope <path>', 'Code scope path')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const path = generateOnboardingPath(root, config, options.scope, 'junior');

    if (path.total_steps === 0) {
      console.log('No learning path available. Run `mumuspec onboard init` first.');
      return;
    }

    console.log(`\nOnboarding: ${path.scope} (${path.total_steps} steps, ~${path.estimated_minutes} min)\n`);
    console.log(`Step 1: ${path.steps[0]?.code_node ?? 'N/A'}`);
    console.log(`  ${path.steps[0]?.reason ?? ''}`);
    if (path.steps[0]?.knowledge_pages.length) {
      console.log(`  📚 Knowledge: ${path.steps[0].knowledge_pages.join(', ')}`);
    }
    console.log('\n[Interactive mode — use "next" command to advance]');
  });

onboardCmd
  .command('next')
  .description('Show next step in learning path')
  .requiredOption('--scope <path>', 'Code scope path')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const path = generateOnboardingPath(root, config, options.scope, 'junior');
    console.log(`Learning path: ${path.total_steps} steps. Run 'onboard start' to begin.`);
  });

onboardCmd
  .command('complete-step')
  .description('Mark a step as complete')
  .requiredOption('--scope <path>', 'Code scope path')
  .requiredOption('--step <n>', 'Step number')
  .action((options) => {
    console.log(`✓ Step ${options.step} marked complete (scope: ${options.scope})`);
  });

onboardCmd
  .command('progress')
  .description('Show learning progress')
  .requiredOption('--scope <path>', 'Code scope path')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const path = generateOnboardingPath(root, config, options.scope, 'junior');
    console.log(`Progress for ${options.scope}: ${path.total_steps} total steps`);
  });

// === chat (Understand-A Style Knowledge Q&A) ===
program
  .command('chat')
  .description('Ask questions about your project using the knowledge base')
  .argument('[query]', 'Query to search in knowledge base (interactive if omitted)')
  .option('--json', 'Output as JSON')
  .action((query, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const config = loadConfig(root);

    // Interactive mode: prompt for query if not provided
    const userQuery = query ?? '';
    if (!userQuery.trim()) {
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                   MUMUSPEC CHAT                          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Ask questions about your project knowledge base.');
      console.log('Examples: "KP-0007", "Saga pattern", "payment architecture"');
      console.log('');

      // Simple readline-based interactive prompt
      process.stdout.write('Query: ');
      process.stdin.once('data', (data) => {
        const inputQuery = data.toString().trim();
        if (inputQuery) {
          executeChat(root, config, inputQuery, options.json);
        }
        process.exit(0);
      });
      return;
    }

    executeChat(root, config, userQuery, options.json);
  });

function executeChat(root: string, config: MumuSpecConfig, query: string, jsonMode?: boolean): void {
  const result = answerQuery(root, config, query);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Panel-style output
  console.log('');
  console.log('┌─── CHAT ANSWER ─────────────────────────────────────────┐');
  console.log(`│ Query: ${result.query}`);
  console.log(`│ Confidence: ${result.confidence}`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(result.answer);

  if (result.references.length > 0) {
    console.log('');
    console.log('References:');
    for (const ref of result.references) {
      console.log(`  [${ref.id}] ${ref.title} (${ref.type}, ${(ref.relevance * 100).toFixed(0)}%)`);
    }
  }
  console.log('');
}

// === knowledge coverage / gaps / graph-export ===
knowledgeCmd
  .command('coverage')
  .description('Show knowledge coverage report')
  .option('--scope <path>', 'Limit to scope')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const report = analyzeCoverage(root, config, options.scope);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              KNOWLEDGE COVERAGE REPORT                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    const cov = report.coverage;
    const ratio = (cov.coverage_ratio * 100).toFixed(1);
    const barLen = 20;
    const filled = Math.round(cov.coverage_ratio * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    console.log(`\n📊 Overall: ${cov.covered_nodes}/${cov.total_code_nodes} nodes (${ratio}%)`);
    console.log(`   [${bar}]`);

    if (report.gaps.length > 0) {
      console.log(`\n🔍 Coverage Gaps (top ${Math.min(report.gaps.length, 5)}):`);
      for (const g of report.gaps.slice(0, 5)) {
        console.log(`   ${g.node} (importance: ${g.importance.toFixed(1)})`);
      }
    }

    if (report.overloads.length > 0) {
      console.log(`\n⚠️  Knowledge Overloads: ${report.overloads.length}`);
    }
  });

knowledgeCmd
  .command('gaps')
  .description('List knowledge coverage gaps')
  .requiredOption('--scope <path>', 'Code scope path')
  .option('--min-importance <n>', 'Minimum importance threshold', '5')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);
    const report = analyzeCoverage(root, config, options.scope);
    const minImp = parseFloat(options.minImportance);
    const filtered = report.gaps.filter((g) => g.importance >= minImp);

    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (filtered.length === 0) {
      console.log('✓ No gaps found above threshold.');
      return;
    }

    console.log(`\n${filtered.length} coverage gap(s):`);
    for (const g of filtered) {
      console.log(`  [${g.importance.toFixed(1)}] ${g.node} → suggest: ${g.suggested_type}`);
    }
  });

knowledgeCmd
  .command('graph-export')
  .description('Export knowledge graph as UA-style JSON (Git-compatible)')
  .option('--output <path>', 'Output path')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }
    const config = loadConfig(root);

    // Build UA-style graph JSON
    const pages = listKnowledgePages(root, config);
    const reverseIdx = readReverseIndex(root, config);

    const graph = {
      version: '1.0',
      generated_at: new Date().toISOString(),
      generator: `mumuspec@${require('../../package.json').version}`,
      nodes: pages.map((p) => ({
        id: p.frontmatter.id,
        type: p.frontmatter.type,
        title: p.frontmatter.title,
        scope: p.frontmatter.scope,
        status: p.frontmatter.status,
        bindings: p.frontmatter.graph_bindings ?? [],
      })),
      edges: pages.flatMap((p) =>
        (p.frontmatter.graph_bindings ?? []).map((binding) => ({
          type: 'COVERED_BY',
          from: binding,
          to: p.frontmatter.id,
        }))
      ),
      reverse_index: reverseIdx.slice(0, 100),  // Sample for size
    };

    const outputPath = options.output ?? join(root, '.mumuspec', 'knowledge', 'knowledge-graph.json');
    try {
      const { mkdirSync, writeFileSync } = require('node:fs');
      const { dirname } = require('node:path');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(graph, null, 2));
      console.log(`✓ Knowledge graph exported: ${outputPath}`);
      console.log(`  Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
    } catch {
      console.log(JSON.stringify(graph, null, 2));
    }
  });

// === git (git-master style) ===
program
  .command('git')
  .description('Git operations — commit, push, tag, flow (git-master style)')
  .argument('<subcommand>', 'git subcommand: status|commit|push|tag|flow')
  .argument('[args...]', 'additional arguments')
  .option('-m, --message <msg>', 'commit message (for commit subcommand)')
  .option('-b, --branch <name>', 'branch name (for flow subcommand)')
  .option('--dry-run', 'preview without executing')
  .option('--scope <scope>', 'commit scope (auto-detected from change name)')
  .action((subcommand, args, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('✗ Not initialized. Run `mumuspec init` first.');
      process.exit(1);
    }
    const exec = (cmd: string): string => {
      if (options.dryRun) {
        console.log(`[dry-run] ${cmd}`);
        return '';
      }
      const result = spawnSync(cmd, { shell: true, cwd: root, encoding: 'utf8' });
      if (result.status !== 0 && result.stderr) {
        console.error(result.stderr);
      }
      return (result.stdout ?? '').trim();
    };

    switch (subcommand) {
      case 'status':
      case 'st': {
        console.log('Git status:\n');
        const status = exec('git status --short --branch');
        console.log(status || 'No changes');
        // Also show recent commits
        const recent = exec('git log --oneline -5');
        if (recent) {
          console.log('\nRecent commits:');
          console.log(recent);
        }
        break;
      }

      case 'commit':
      case 'ci': {
        // Auto-detect scope from active change if not provided
        let scope = options.scope || '';
        if (!scope) {
          try {
            const active = getActiveChange(root);
            if (active) {
              scope = active.replace(/[^a-zA-Z0-9-]/g, '-');
            }
          } catch {
            // No active change
          }
        }
        const msg = options.message;
        if (!msg) {
          console.error('✗ Commit message required. Use -m "message"');
          process.exit(1);
        }
        // Conventional commit format: type(scope): message
        const fullMsg = scope ? `feat(${scope}): ${msg}` : `feat: ${msg}`;
        console.log(`Committing: ${fullMsg}`);
        exec('git add -A');
        exec(`git commit -m "${fullMsg.replace(/"/g, '\\"')}"`);
        console.log('✓ Committed');
        break;
      }

      case 'push': {
        const branch = exec('git branch --show-current');
        console.log(`Pushing to origin/${branch}...`);
        exec(`git push -u origin ${branch}`);
        console.log('✓ Pushed');
        break;
      }

      case 'tag': {
        // Create version tag from package.json
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
        const tag = `v${pkg.version}`;
        console.log(`Creating tag ${tag}...`);
        exec(`git tag -a ${tag} -m "Release ${tag}"`);
        exec(`git push origin ${tag}`);
        console.log(`✓ Tagged and pushed: ${tag}`);
        break;
      }

      case 'flow': {
        const sub = args[0];
        const name = options.branch || args[1];
        if (!sub || !['start', 'finish'].includes(sub)) {
          console.error('Usage: mumuspec git flow <start|finish> [-b <branch-name>]');
          console.error('  start feature/my-feature   • Create feature branch');
          console.error('  finish feature/my-feature  • Merge and cleanup');
          process.exit(1);
        }
        if (!name) {
          console.error('✗ Branch name required. Use -b <name> or pass as argument.');
          process.exit(1);
        }
        if (sub === 'start') {
          console.log(`Starting flow: ${name}`);
          exec('git checkout main 2>/dev/null || git checkout master');
          exec('git pull');
          exec(`git checkout -b ${name}`);
          console.log(`✓ Created branch: ${name}`);
        } else {
          console.log(`Finishing flow: ${name}`);
          // Find the base branch (main or master)
          const branches = exec('git branch --list main master --format="%(refname:short)"');
          const base = branches.split('\n').map(b => b.trim()).filter(Boolean)[0] || 'main';
          exec(`git checkout ${base}`);
          exec('git pull');
          exec(`git merge --no-ff ${name} -m "Merge branch '${name}'"`);
          exec(`git branch -d ${name}`);
          console.log(`✓ Merged and removed: ${name}`);
        }
        break;
      }

      default:
        console.error(`Unknown git subcommand: ${subcommand}`);
        console.error('Available: status, commit, push, tag, flow');
        process.exit(1);
    }
  });

// === doctor ===
program
  .command('doctor')
  .description('Environment diagnostics')
  .action(() => {
    const root = findProjectRoot();
    console.log('\n=== MumuSpec Doctor ===\n');

    // Node.js version
    console.log(`Node.js: ${process.version} ${parseInt(process.version.slice(1)) >= 20 ? '✓' : '✗ (requires >=20)'}`);

    // Project root
    if (root) {
      console.log(`Project root: ${root} ✓`);
    } else {
      console.log('Project root: Not found ✗ (run `mumuspec init`)');
      return;
    }

    const mumuDir = getMumuSpecDir(root);

    // Config
    const configPath = join(mumuDir, 'config.yaml');
    console.log(`Config: ${existsSync(configPath) ? '✓' : '✗'}`);

    // Spec.md
    const specPath = join(mumuDir, 'spec.md');
    console.log(`Root spec: ${existsSync(specPath) ? '✓' : '✗'}`);

    // Design.md
    const designPath = join(mumuDir, 'design.md');
    console.log(`Root design: ${existsSync(designPath) ? '✓' : '✗'}`);

    // Prohibitions
    const prohibitionsPath = join(mumuDir, 'prohibitions.md');
    console.log(`Prohibitions: ${existsSync(prohibitionsPath) ? '✓' : '✗'}`);

    // Index
    const indexPath = join(mumuDir, 'index.yaml');
    console.log(`Index: ${existsSync(indexPath) ? '✓' : '✗'}`);

    // Changes
    const changesDir = join(mumuDir, 'changes');
    console.log(`Changes dir: ${existsSync(changesDir) ? '✓' : '✗'}`);

    // Knowledge
    const knowledgeDir = join(mumuDir, 'knowledge');
    console.log(`Knowledge dir: ${existsSync(knowledgeDir) ? '✓' : '✗'}`);

    // Active changes
    const active = getActiveChange(root);
    console.log(`Active change: ${active || 'none'}`);

    // Audit log
    const auditPath = join(mumuDir, 'audit.log');
    console.log(`Audit log: ${existsSync(auditPath) ? '✓' : '(empty)'}`);

    // Rules files
    if (root) {
      const config = loadConfig(root);
      for (const rulesFile of config.ai.rules_files) {
        const rulesPath = join(root, rulesFile);
        console.log(`Rules (${rulesFile}): ${existsSync(rulesPath) ? '✓' : '✗'}`);
      }
    }

    console.log('');
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

// Helper: collect multiple values
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

// === constraints (0.12.1+) ===
const constraintsCmd = program
  .command('constraints')
  .description('Manage dynamic constraint strength and tree-distributed constraints (0.12.1+)');

// --- constraints strength ---
constraintsCmd
  .command('strength')
  .description('View or set constraint strength (TD / RG dimensions)')
  .option('--td <level>', 'technical_design strength: high|medium|low')
  .option('--rg <level>', 'requirement_goals strength: high|medium|low')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const config = loadConfig(root);

    // If no setters, just print current.
    if (!options.td && !options.rg) {
      const cs = config.constraint_strength;
      if (options.json) {
        console.log(JSON.stringify(cs, null, 2));
        return;
      }
      console.log('\nConstraint Strength:');
      console.log(`  technical_design: ${cs.technical_design}`);
      console.log(`  requirement_goals: ${cs.requirement_goals}`);
      console.log(`\nAction mapping:`);
      console.log(`  high   → ${STRENGTH_ACTION_MAP.high} (block)`);
      console.log(`  medium → ${STRENGTH_ACTION_MAP.medium} (warn)`);
      console.log(`  low    → ${STRENGTH_ACTION_MAP.low} (info)`);
      console.log(`\nExceptions (${cs.exceptions.length}): always block regardless of strength`);
      for (const ex of cs.exceptions) {
        console.log(`  - ${ex}`);
      }
      console.log(`\nWorkflow rules (effective):`);
      const wfRules: Array<'worktree_isolation' | 'single_active_change' | 'top_down_design' | 'tdd_enforced'> = [
        'worktree_isolation',
        'single_active_change',
        'top_down_design',
        'tdd_enforced',
      ];
      for (const rule of wfRules) {
        const effective = resolveWorkflowRule(rule, cs, WORKFLOW_RULE_DIMENSION, WORKFLOW_STRENGTH_MATRIX);
        const dim = WORKFLOW_RULE_DIMENSION[rule];
        const override = cs.overrides?.workflow?.[rule];
        const source = override && override !== 'inherit' ? 'override' : `strength:${dim}`;
        console.log(`  ${rule}: ${effective ? 'enforced' : 'relaxed'} (source: ${source})`);
      }
      return;
    }

    // Validate and apply setters.
    const valid = ['high', 'medium', 'low'];
    if (options.td && !valid.includes(options.td)) {
      console.error(`Error: --td must be one of ${valid.join('|')}, got "${options.td}"`);
      process.exit(1);
    }
    if (options.rg && !valid.includes(options.rg)) {
      console.error(`Error: --rg must be one of ${valid.join('|')}, got "${options.rg}"`);
      process.exit(1);
    }

    if (options.td) config.constraint_strength.technical_design = options.td;
    if (options.rg) config.constraint_strength.requirement_goals = options.rg;
    saveConfig(root, config);
    appendAuditLog(getMumuSpecDir(root), {
      actor: 'user',
      action: 'constraints.strength',
      result: 'success',
      td: config.constraint_strength.technical_design,
      rg: config.constraint_strength.requirement_goals,
    });

    console.log(`\n✓ Constraint strength updated:`);
    console.log(`  technical_design: ${config.constraint_strength.technical_design}`);
    console.log(`  requirement_goals: ${config.constraint_strength.requirement_goals}`);
  });

// --- constraints preset ---
const PRESETS: Record<string, { technical_design: 'high' | 'medium' | 'low'; requirement_goals: 'high' | 'medium' | 'low'; description: string }> = {
  strict: { technical_design: 'high', requirement_goals: 'high', description: 'New projects / critical systems (default)' },
  balanced: { technical_design: 'medium', requirement_goals: 'medium', description: 'Mature project regular iterations' },
  hotfix: { technical_design: 'low', requirement_goals: 'high', description: 'Emergency hotfix (keep requirements strict)' },
  exploratory: { technical_design: 'medium', requirement_goals: 'low', description: 'Exploratory prototype' },
  minimal: { technical_design: 'low', requirement_goals: 'low', description: 'Teaching demo / one-off scripts' },
};

constraintsCmd
  .command('preset')
  .description('Apply a named strength preset')
  .argument('<name>', `preset name: ${Object.keys(PRESETS).join(' | ')}`)
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const preset = PRESETS[name];
    if (!preset) {
      console.error(`Error: Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }

    const config = loadConfig(root);
    config.constraint_strength.technical_design = preset.technical_design;
    config.constraint_strength.requirement_goals = preset.requirement_goals;
    saveConfig(root, config);
    appendAuditLog(getMumuSpecDir(root), {
      actor: 'user',
      action: 'constraints.preset',
      result: 'success',
      preset: name,
    });

    console.log(`\n✓ Applied preset "${name}": ${preset.description}`);
    console.log(`  technical_design: ${preset.technical_design}`);
    console.log(`  requirement_goals: ${preset.requirement_goals}`);
  });

// --- constraints list ---
constraintsCmd
  .command('list')
  .description('List all constraints from .mumuspec/constraints.yaml files')
  .option('--dimension <dim>', 'filter by dimension: td|rg')
  .option('--type <type>', 'filter by type: shall|shall-not')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const { files, warnings } = loadAllConstraints(root);
    if (warnings.length > 0) {
      for (const w of warnings) console.warn(`⚠ ${w}`);
    }

    if (files.length === 0) {
      console.log('No constraints.yaml files found. Run `mumuspec constraints init` to create one.');
      return;
    }

    const dimFilter: 'technical_design' | 'requirement_goals' | undefined =
      options.dimension === 'td' ? 'technical_design' :
      options.dimension === 'rg' ? 'requirement_goals' : undefined;

    const typeFilter: 'forward' | 'reverse' | undefined =
      options.type === 'shall' ? 'forward' :
      options.type === 'shall-not' ? 'reverse' : undefined;

    const entries: Array<{ file: string; scope: string; id: string; dimension: string; direction: string; content: string; min_strength: string; inherited?: boolean }> = [];

    for (const file of files) {
      const scope = file.scope ?? '.';
      const dims: Array<'technical_design' | 'requirement_goals'> = ['technical_design', 'requirement_goals'];
      const dirs: Array<'forward' | 'reverse'> = ['forward', 'reverse'];
      for (const dim of dims) {
        if (dimFilter && dim !== dimFilter) continue;
        for (const dir of dirs) {
          if (typeFilter && dir !== typeFilter) continue;
          const list = file[dir]?.[dim] ?? [];
          for (const e of list) {
            entries.push({
              file: scope,
              scope,
              id: e.id,
              dimension: dim === 'technical_design' ? 'TD' : 'RG',
              direction: dir === 'forward' ? 'SHALL' : 'SHALL-NOT',
              content: e.content,
              min_strength: e.min_strength,
              inherited: e.inherited,
            });
          }
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    console.log(`\n${entries.length} constraint(s) from ${files.length} file(s):`);
    for (const e of entries) {
      console.log(`  [${e.dimension} ${e.direction}] ${e.id} (min: ${e.min_strength}) @ ${e.scope}`);
      console.log(`    ${e.content}`);
    }
  });

// --- constraints resolve ---
constraintsCmd
  .command('resolve')
  .description('Resolve the tree-distributed constraint tree (inheritance + conflicts)')
  .option('--scope <scope>', 'output only the effective constraints at this scope')
  .option('--conflicts-only', 'output only the conflict list')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const config = loadConfig(root);
    const { files, warnings } = loadAllConstraints(root);

    if (files.length === 0) {
      console.log('No constraints.yaml files found. The constraint tree is empty.');
      return;
    }

    const rootStrength = resolveRootStrength(files, {
      technical_design: config.constraint_strength.technical_design,
      requirement_goals: config.constraint_strength.requirement_goals,
    });

    const resolution = resolveConstraintTree(files, rootStrength);

    if (warnings.length > 0 || resolution.warnings.length > 0) {
      for (const w of [...warnings, ...resolution.warnings]) console.warn(`⚠ ${w}`);
    }

    if (options.conflictsOnly) {
      if (options.json) {
        console.log(JSON.stringify(resolution.conflicts, null, 2));
        return;
      }
      if (resolution.conflicts.length === 0) {
        console.log('✓ No conflicts detected.');
      } else {
        console.log(`\n${resolution.conflicts.length} conflict(s):`);
        for (const c of resolution.conflicts) {
          console.log(`  [${c.dimension} ${c.direction}] ${c.id} — ${c.resolution}`);
          console.log(`    winner: @${c.winner.scope} min=${c.winner.min_strength}`);
          for (const loser of c.losers) {
            console.log(`    loser:  @${loser.scope} min=${loser.min_strength}`);
          }
        }
      }
      return;
    }

    if (options.scope) {
      const targetScope = options.scope.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '') || '.';
      let node = resolution.root;
      if (targetScope !== '.') {
        const parts = targetScope.split('/').filter(Boolean);
        for (const p of parts) {
          const child = node.children.get(node.scope === '.' ? p : `${node.scope}/${p}`) ?? node.children.get(p);
          if (!child) {
            console.error(`Error: scope "${targetScope}" not found in constraint tree.`);
            process.exit(1);
          }
          node = child;
        }
      }
      if (options.json) {
        console.log(JSON.stringify({
          scope: node.scope,
          layer: node.layer,
          strength: node.strength,
          forward: node.forward,
          reverse: node.reverse,
        }, null, 2));
        return;
      }
      console.log(`\nScope: ${node.scope} (layer ${node.layer})`);
      console.log(`Strength: TD=${node.strength.technical_design}, RG=${node.strength.requirement_goals}`);
      const printEntries = (label: string, entries: typeof node.forward.technical_design) => {
        if (entries.length === 0) return;
        console.log(`\n${label} (${entries.length}):`);
        for (const e of entries) {
          const inh = e.inherited ? ' [inherited]' : '';
          const tight = e.tightens ? ` [tightens @${e.tightens.scope}]` : '';
          console.log(`  - ${e.id} (min: ${e.min_strength})${inh}${tight}`);
          console.log(`    ${e.content}`);
        }
      };
      printEntries('TD SHALL', node.forward.technical_design);
      printEntries('TD SHALL-NOT', node.reverse.technical_design);
      printEntries('RG SHALL', node.forward.requirement_goals);
      printEntries('RG SHALL-NOT', node.reverse.requirement_goals);
      return;
    }

    // Full tree output.
    if (options.json) {
      console.log(JSON.stringify(resolution, (key, value) => {
        if (value instanceof Map) {
          return Array.from(value.entries());
        }
        return value;
      }, 2));
      return;
    }

    console.log(`\nConstraint Tree (root: ${resolution.root.scope}, layer ${resolution.root.layer})`);
    console.log(`Root strength: TD=${resolution.root.strength.technical_design}, RG=${resolution.root.strength.requirement_goals}`);

    const printNode = (node: typeof resolution.root, indent: string) => {
      const tdF = node.forward.technical_design.length;
      const tdR = node.reverse.technical_design.length;
      const rgF = node.forward.requirement_goals.length;
      const rgR = node.reverse.requirement_goals.length;
      const total = tdF + tdR + rgF + rgR;
      if (total > 0 || node.scope === '.') {
        console.log(`${indent}${node.scope} (L${node.layer}) TD=${node.strength.technical_design} RG=${node.strength.requirement_goals} [${total} entries]`);
      }
      for (const [, child] of node.children) {
        printNode(child, indent + '  ');
      }
    };
    printNode(resolution.root, '');

    if (resolution.conflicts.length > 0) {
      console.log(`\n${resolution.conflicts.length} conflict(s):`);
      for (const c of resolution.conflicts) {
        console.log(`  [${c.dimension} ${c.direction}] ${c.id} — ${c.resolution}`);
      }
    } else {
      console.log('\n✓ No conflicts detected.');
    }
  });

// === feedback ===
const feedbackCmd = program.command('feedback').description('User feedback & session summary management');

feedbackCmd
  .command('submit')
  .description('Submit user feedback with optional change/session linkage')
  .requiredOption('--title <title>', 'feedback title')
  .option('--type <type>', 'feedback type (bug|feature-request|improvement|question|design-review)', 'improvement')
  .option('--severity <severity>', 'severity (critical|major|minor|info)', 'minor')
  .option('--submitter <name>', 'submitter name', 'anonymous')
  .option('--change <name>', 'associate with a change')
  .option('--session <id>', 'associate with a session ID')
  .option('--design <path>', 'reference to design doc path')
  .option('--expected <text>', 'expected behavior')
  .option('--actual <text>', 'actual behavior')
  .option('--detail <text>', 'detailed description')
  .option('--impact <text>', 'impact description')
  .option('--suggestion <text>', 'improvement suggestion')
  .option('--file <path>', 'read feedback body from file')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    // Read detail from file if specified
    let detail = options.detail;
    if (options.file) {
      const { readFileSync } = require('node:fs') as typeof import('node:fs');
      const filePath = resolve(options.file);
      detail = readFileSync(filePath, 'utf8');
    }

    // Validate type
    const validTypes = ['bug', 'feature-request', 'improvement', 'question', 'design-review'];
    if (!validTypes.includes(options.type)) {
      console.error(`Error: Invalid type '${options.type}'. Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    // Validate change exists if specified
    if (options.change) {
      const state = loadChangeState(root, options.change);
      if (!state) {
        console.error(`Error: Change not found: ${options.change}`);
        process.exit(1);
      }
    }

    const result = submitFeedback(root, {
      type: options.type as any,
      severity: options.severity as any,
      submitter: options.submitter,
      changeName: options.change,
      sessionId: options.session,
      title: options.title,
      expected: options.expected,
      actual: options.actual,
      detail,
      impact: options.impact,
      suggestion: options.suggestion,
      designRef: options.design,
    });

    // Update change state if linked
    if (options.change) {
      appendFeedbackToChange(root, options.change, result.feedbackId, options.session);
    }

    console.log(`\n✓ Feedback submitted: ${result.feedbackId}`);
    console.log(`  File: ${result.filePath}`);
    if (options.change) console.log(`  Linked to change: ${options.change}`);
    if (options.session) console.log(`  Linked to session: ${options.session}`);
  });

feedbackCmd
  .command('list')
  .description('List feedback entries')
  .option('--status <status>', 'filter by status (open|acknowledged|in-progress|resolved|declined)')
  .option('--type <type>', 'filter by type')
  .option('--change <name>', 'filter by change name')
  .option('--limit <n>', 'limit results', '20')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const feedbacks = listAllFeedbacks(root, {
      status: options.status,
      type: options.type,
      changeName: options.change,
    });

    const limit = parseInt(options.limit);
    const display = feedbacks.slice(0, limit);

    if (display.length === 0) {
      console.log('No feedback entries found.');
      return;
    }

    console.log(`\n${display.length} feedback entry(s) (of ${feedbacks.length} total):\n`);
    for (const f of display) {
      const changeInfo = f.changeName ? ` [${f.changeName}]` : '';
      console.log(`  [${f.status}] ${f.id} — ${f.title}${changeInfo}`);
      console.log(`    Type: ${f.type} | Severity: ${f.severity} | Date: ${f.date} | By: ${f.submitter}`);
      if (f.sessionId) console.log(`    Session: ${f.sessionId}`);
    }
  });

feedbackCmd
  .command('show')
  .description('Show full feedback content')
  .argument('<id>', 'feedback ID (e.g., FB-20260728-a1b2c3d4)')
  .action((id) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const feedback = getFeedbackContent(root, id);
    if (!feedback) {
      console.error(`Error: Feedback not found: ${id}`);
      process.exit(1);
    }

    console.log(`\n=== Feedback: ${feedback.id} ===`);
    console.log(`Title: ${feedback.title}`);
    console.log(`Type: ${feedback.type} | Severity: ${feedback.severity} | Status: ${feedback.status}`);
    console.log(`Date: ${feedback.date} | Submitter: ${feedback.submitter}`);
    if (feedback.changeName) console.log(`Change: ${feedback.changeName}`);
    if (feedback.sessionId) console.log(`Session: ${feedback.sessionId}`);
    if (feedback.designRef) console.log(`Design: ${feedback.designRef}`);
    console.log(`\n---\n${feedback.body}`);
  });

feedbackCmd
  .command('update-status')
  .description('Update feedback status')
  .argument('<id>', 'feedback ID')
  .requiredOption('--status <status>', 'new status (open|acknowledged|in-progress|resolved|declined)')
  .option('--reason <text>', 'reason for status change')
  .action((id, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const validStatuses = ['open', 'acknowledged', 'in-progress', 'resolved', 'declined'];
    if (!validStatuses.includes(options.status)) {
      console.error(`Error: Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      process.exit(1);
    }

    updateFeedbackStatus(root, id, options.status as any, options.reason);
    console.log(`✓ Feedback ${id} status updated to: ${options.status}`);
  });

feedbackCmd
  .command('session-summary')
  .description('Create a session summary with optional feedback linkage')
  .requiredOption('--session-id <id>', 'unique session ID')
  .requiredOption('--title <title>', 'session title')
  .requiredOption('--change-type <type>', 'change type (feature|hotfix|tweak|build|archive)')
  .requiredOption('--outcome <outcome>', 'session outcome (success|partial|failure|abandoned)')
  .option('--agent <name>', 'AI agent name', 'unknown')
  .option('--agent-version <ver>', 'AI agent version')
  .option('--change <name>', 'associated change name')
  .option('--duration <minutes>', 'session duration in minutes')
  .option('--feedback <ids>', 'comma-separated feedback IDs to link')
  .option('--summary <text>', 'session summary text')
  .option('--patterns <items>', 'comma-separated patterns observed')
  .action((options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const feedbackIds = options.feedback
      ? options.feedback.split(',').map((s: string) => s.trim())
      : undefined;

    const patterns = options.patterns
      ? options.patterns.split(',').map((s: string) => s.trim())
      : undefined;

    const result = createSessionSummary(root, {
      sessionId: options.sessionId,
      agent: options.agent,
      agentVersion: options.agentVersion,
      changeType: options.changeType,
      outcome: options.outcome as any,
      title: options.title,
      changeName: options.change,
      durationMinutes: options.duration ? parseInt(options.duration) : undefined,
      feedbackIds,
      artifactSummary: options.summary,
      patternsObserved: patterns,
    });

    console.log(`\n✓ Session summary created: ${result.sessionId}`);
    console.log(`  File: ${result.filePath}`);
    if (feedbackIds && feedbackIds.length > 0) {
      console.log(`  Linked feedback: ${feedbackIds.join(', ')}`);
    }
  });

// === feedback (change-scoped) ===
program
  .command('change-feedbacks')
  .description('List feedbacks linked to a change')
  .argument('<change>', 'change name')
  .action((change) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const feedbacks = getChangeFeedbacks(root, change);

    if (feedbacks.length === 0) {
      console.log(`No feedback linked to change: ${change}`);
      return;
    }

    console.log(`\n${feedbacks.length} feedback(s) linked to ${change}:\n`);
    for (const f of feedbacks) {
      const ack = f.acknowledged ? '✓' : '○';
      console.log(`  [${ack}] ${f.feedback_id} (${f.linked_at?.split('T')[0] || ''})${f.sessionId ? ` [session: ${f.sessionId}]` : ''}`);
    }
  });

// === install ===
const installCmd = program
  .command('install')
  .description('Install skills, MCP servers, and commands for AI coding agents');

// --- catpaw skill install ---
installCmd
  .command('catpaw')
  .description('Install CatPaw skills from the curated manifest')
  .argument('[packages...]', 'skill package names to install (e.g., browser pdf pptx)')
  .option('--list', 'list available packages in the manifest')
  .option('--installed', 'list currently installed skills via paw CLI')
  .option('--force', 'force update if already installed')
  .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
  .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
  .option('--search <keyword>', 'search available packages by keyword')
  .action((packages, options) => {

    // --list: show available packages
    if (options.list) {
      const manifest = getManifest('catpaw');
      if (manifest.length === 0) {
        console.log('No packages available for CatPaw in the manifest.');
        return;
      }
      console.log('\nAvailable CatPaw skill packages:\n');
      const categories = new Map<string, typeof manifest>();
      for (const pkg of manifest) {
        const list = categories.get(pkg.category) || [];
        list.push(pkg);
        categories.set(pkg.category, list);
      }
      for (const [category, pkgs] of categories) {
        console.log(`  [${category}]`);
        for (const pkg of pkgs) {
          const idStr = pkg.skillId ? ` (skill-id: ${pkg.skillId})` : ' (local)';
          console.log(`    ${pkg.name}${idStr}`);
          console.log(`      ${pkg.description}`);
        }
      }
      console.log('\nUsage: mumuspec install catpaw <package1> [package2 ...]');
      console.log('       mumuspec install catpaw mumuspec-workflow     # Install workflow orchestrator');
      return;
    }

    // --search: search packages
    if (options.search) {
      const results = searchPackages('catpaw', options.search);
      if (results.length === 0) {
        console.log(`No packages match "${options.search}".`);
        return;
      }
      console.log(`\n${results.length} package(s) matching "${options.search}":`);
      for (const pkg of results) {
        console.log(`  ${pkg.name} — ${pkg.description}`);
      }
      return;
    }

    // --installed: show currently installed skills
    if (options.installed) {
      const workspacePath = options.workspacePath || undefined;
      const result = listInstalledCatpaw(workspacePath);
      if (result.success) {
        console.log('\nInstalled CatPaw Skills:');
        console.log(formatInstalledSkills(result.skills));
      } else {
        console.error(`Error listing installed skills: ${result.error}`);
        process.exit(1);
      }
      return;
    }

    // Install packages
    if (!packages || packages.length === 0) {
      console.error('Error: No packages specified. Use --list to see available packages, or provide package names.');
      console.error('Example: mumuspec install catpaw browser pdf');
      process.exit(1);
    }

    const target = options.target as 'user' | 'workspace';
    const workspacePath = options.workspacePath;

    // Validate workspace path requirement
    if (target === 'workspace' && !workspacePath) {
      console.error('Error: --workspace-path is required when --target workspace');
      console.error('       Use --workspace-path . for current directory');
      process.exit(1);
    }

    // For workspace installs, validate directory exists
    if (workspacePath) {
      if (!existsSync(workspacePath)) {
        console.error(`Error: Workspace path does not exist: ${workspacePath}`);
        process.exit(1);
      }
    }

    let successCount = 0;
    let failCount = 0;

    for (const pkgName of packages) {
      const pkg = resolvePackage('catpaw', pkgName);
      if (!pkg) {
        console.error(`✗ Unknown package: "${pkgName}" (use --list to see available packages)`);
        failCount++;
        continue;
      }

      console.log(`\nInstalling "${pkgName}" (${pkg.description})...`);
      const mode = options.force ? 'update' : 'install';
      const result = installPackage('catpaw', pkgName, target, workspacePath, mode);

      if (result.success) {
        const action = mode === 'update' ? 'Updated' : 'Installed';
        console.log(`✓ ${action} "${pkgName}" [${target} scope]`);
        if (result.path) console.log(`  Path: ${result.path}`);
        successCount++;
      } else {
        console.error(`✗ Failed to install "${pkgName}": ${result.error}`);
        failCount++;
      }
    }

    console.log(`\nDone: ${successCount} succeeded, ${failCount} failed.`);
    if (failCount > 0) process.exit(1);
  });

// --- catpaw MCP server install ---
installCmd
  .command('mcp')
  .description('Install MCP server workspace configuration for CatPaw')
  .argument('[server]', 'MCP server preset name (e.g., mumuspec)')
  .option('--list', 'list available MCP server presets')
  .option('--installed', 'list currently installed MCP configs in workspace')
  .option('--workspace-path <path>', 'workspace path (required)', '.')
  .action((server, options) => {
    const workspacePath = options.workspacePath;

    // --list: show available MCP presets
    if (options.list) {
      const presets = getMcpPresets();
      console.log('\nAvailable MCP server presets:\n');
      for (const preset of presets) {
        console.log(`  ${preset.name}`);
        console.log(`    ${preset.description}`);
        console.log(`    Command: ${preset.config.command} ${(preset.config.args || []).join(' ')}`);
      }
      console.log('\nUsage: mumuspec install mcp <server-name> --workspace-path .');
      return;
    }

    // --installed: show workspace MCP configs
    if (options.installed) {
      const result = listInstalledMcp(workspacePath);
      console.log(`\nMCP servers in ${workspacePath}:`);
      if (result.installed.length > 0) {
        for (const name of result.installed) {
          console.log(`  ✓ ${name}`);
        }
      } else {
        console.log('  (none configured)');
      }
      if (result.available.length > 0) {
        console.log(`\nAvailable presets: ${result.available.join(', ')}`);
      }
      return;
    }

    // Install MCP server config
    if (!server) {
      console.error('Error: No MCP server specified. Use --list to see presets.');
      process.exit(1);
    }

    console.log(`Installing MCP server "${server}" to ${workspacePath}...`);
    const result = installCatpawMcp(server, workspacePath);

    if (result.success) {
      console.log(`✓ Installed MCP config: ${result.serverName}`);
      console.log(`  Config file: ${result.path}`);
      console.log('\nRestart CatPaw or reload workspace to activate the MCP server.');
    } else {
      console.error(`✗ Failed to install MCP server: ${result.error}`);
      process.exit(1);
    }
  });

// --- catpaw command install ---
installCmd
  .command('command')
  .description('Install CatPaw custom slash commands')
  .argument('[command]', 'command preset name (e.g., /mumuspec)')
  .option('--list', 'list available command presets')
  .option('--force', 'force update if already installed')
  .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
  .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
  .action((command, options) => {
    const target = options.target as 'user' | 'workspace';
    const workspacePath = options.workspacePath;

    if (target === 'workspace' && !workspacePath) {
      console.error('Error: --workspace-path is required when --target workspace');
      process.exit(1);
    }

    // --list: show available command presets
    if (options.list) {
      const presets = getCommandPresets();
      console.log('\nAvailable command presets:\n');
      for (const preset of presets) {
        console.log(`  ${preset.name}`);
        console.log(`    ${preset.description}`);
      }
      console.log('\nUsage: mumuspec install command <command-name>');
      return;
    }

    // Install command
    if (!command) {
      console.error('Error: No command specified. Use --list to see presets.');
      process.exit(1);
    }

    console.log(`Installing custom command "${command}" [${target} scope]...`);
    const cmdMode = options.force ? 'update' : 'install';
    const result = installCatpawCommand(command, target, workspacePath, cmdMode);

    if (result.success) {
      const action = cmdMode === 'update' ? 'Updated' : 'Installed';
      console.log(`✓ ${action} command: ${result.commandName}`);
      console.log(`  Command file: ${result.path}`);
      console.log('\nUse /' + (result.commandName.startsWith('/') ? result.commandName.slice(1) : result.commandName) + ' in CatPaw to invoke.');
    } else {
      console.error(`✗ Failed to install command: ${result.error}`);
      process.exit(1);
    }
  });

/**
 * Generic subcommand factory for non-CatPaw agents.
 * Handles claude, cursor, trae, workbuddy, opencode with the same install logic.
 */
function createAgentInstallSubcommand(
  agentName: string,
  agentType: string,
  description: string,
) {
  installCmd
    .command(agentName)
    .description(description)
    .argument('[packages...]', 'skill package names to install (e.g., mumuspec-workflow)')
    .option('--list', 'list available packages for this agent')
    .option('--force', 'force update if already installed')
    .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
    .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
    .option('--search <keyword>', 'search available packages by keyword')
    .action((packages: string[], options: Record<string, unknown>) => {
      const target = (options.target as 'user' | 'workspace') || 'user';
      const workspacePath = options.workspacePath as string | undefined;

      // --list: show available packages
      if (options.list) {
        const manifest = getManifest(agentType as AgentType);
        console.log(`\nAvailable packages for ${agentName}:`);
        manifest.forEach((p) => {
          console.log(`  ${p.name} — ${p.description}`);
        });
        return;
      }

      // --search
      if (options.search) {
        const results = searchPackages(agentType as AgentType, options.search as string);
        console.log(`\nSearch results for "${options.search}" (${agentName}):`);
        results.forEach((p) => {
          console.log(`  ${p.name} — ${p.description}`);
        });
        return;
      }

      if (!packages || packages.length === 0) {
        console.error('Error: No packages specified. Use --list to see available packages.');
        process.exit(1);
      }

      let successCount = 0;
      let failCount = 0;

      for (const pkgName of packages) {
        const pkg = resolvePackage(agentType as AgentType, pkgName);
        if (!pkg) {
          console.error(`  Unknown package "${pkgName}" for ${agentName}.`);
          failCount++;
          continue;
        }

        console.log(`\nInstalling "${pkgName}" for ${agentName} (${target} scope)...`);
        const agentMode = options.force ? 'update' : 'install';
        const result = installPackage(agentType as AgentType, pkgName, target, workspacePath, agentMode);

        if (result.success) {
          const action = agentMode === 'update' ? 'Updated' : 'Installed';
          console.log(`✓ ${action} "${pkgName}" [${target} scope]`);
          if (result.path) console.log(`  Path: ${result.path}`);
          successCount++;
        } else {
          console.error(`✗ Failed: ${result.error}`);
          failCount++;
        }
      }

      console.log(`\nResult: ${successCount} succeeded, ${failCount} failed.`);
      if (failCount > 0) process.exit(1);
    });
}

// Claude Code commands install
createAgentInstallSubcommand('claude', 'claude', 'Install Claude Code slash commands');

// Cursor IDE commands install
createAgentInstallSubcommand('cursor', 'cursor', 'Install Cursor IDE slash commands');

// Trae commands install
createAgentInstallSubcommand('trae', 'trae', 'Install Trae skills');

// WorkBuddy commands install
createAgentInstallSubcommand('workbuddy', 'workbuddy', 'Install WorkBuddy skills');

// OpenCode commands install
createAgentInstallSubcommand('opencode', 'opencode', 'Install OpenCode skills');

// Default: show help when no subcommand given
installCmd.action(() => {
  console.log('Install skills, MCP servers, and commands for AI coding agents.\n');
  console.log('Agents:');
  console.log('  mumuspec install catpaw [packages...]        Install CatPaw skills');
  console.log('  mumuspec install claude [packages...]        Install Claude Code slash commands');
  console.log('  mumuspec install cursor [packages...]        Install Cursor IDE slash commands');
  console.log('  mumuspec install trae [packages...]          Install Trae AI skills');
  console.log('  mumuspec install workbuddy [packages...]     Install WorkBuddy skills');
  console.log('  mumuspec install opencode [packages...]      Install OpenCode skills');
  console.log('  mumuspec install mcp <server>                Install MCP server config to workspace');
  console.log('  mumuspec install command <name>              Install custom slash command (CatPaw)');
  console.log('\nCommon options (per agent):');
  console.log('  --list                List available packages');
  console.log('  --search <keyword>    Search packages by keyword');
  console.log('  --target user         Install to user scope (default)');
  console.log('  --target workspace    Install to workspace scope');
  console.log('  --workspace-path      Path for workspace installation');
  console.log('\nMCP options:');
  console.log('  --list                List available MCP presets');
  console.log('  --installed           Show workspace MCP configs');
  console.log('  --workspace-path      Workspace path (default: current directory)');
});

// === hooks (Native Hook Guard) ===
const hooksCmd = program
  .command('hooks')
  .description('Manage git hooks that auto-trigger MumuSpec guard checks');

hooksCmd
  .command('install')
  .description('Install Mumuspec guard hooks into .git/hooks/')
  .option('--force', 'overwrite existing non-mumuspec hooks')
  .option('--workspace-path <path>', 'workspace path', '.')
  .action((options) => {
    const results = installHooks({
      workspacePath: options.workspacePath,
      force: options.force,
    });

    let installed = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of results) {
      if (r.success && !r.skipped) {
        console.log(`✓ Installed: ${r.hook} → ${r.path}`);
        installed++;
      } else if (r.skipped) {
        console.log(`⊘ Skipped: ${r.hook} — ${r.error}`);
        skipped++;
      } else {
        console.error(`✗ Failed: ${r.hook} — ${r.error}`);
        failed++;
      }
    }

    console.log(`\nDone: ${installed} installed, ${skipped} skipped, ${failed} failed.`);
    console.log('\nHooks will auto-run on git events (pre-commit, post-merge, etc.)');
    if (failed > 0) process.exit(1);
  });

hooksCmd
  .command('uninstall')
  .description('Remove Mumuspec hooks from .git/hooks/')
  .option('--workspace-path <path>', 'workspace path', '.')
  .action((options) => {
    const results = uninstallHooks(options.workspacePath);

    for (const r of results) {
      if (r.success && !r.skipped) {
        console.log(`✓ Removed: ${r.hook}`);
      } else if (r.skipped) {
        console.log(`⊘ Skipped: ${r.hook} — ${r.error}`);
      } else {
        console.error(`✗ Failed: ${r.hook} — ${r.error}`);
      }
    }
  });

hooksCmd
  .command('status')
  .description('Show installed hooks status')
  .option('--workspace-path <path>', 'workspace path', '.')
  .action((options) => {
    const status = getHookStatus(options.workspacePath);

    console.log('\nMumuSpec Git Hooks Status:\n');
    for (const hook of status.available) {
      const isInstalled = status.installed.includes(hook);
      console.log(`  ${isInstalled ? '✓' : '○'} ${hook}`);
    }
    console.log(`\n${status.installed.length}/${status.available.length} hooks installed.`);
  });

hooksCmd
  .command('run <type>')
  .description('Manually execute hook guard logic (pre-commit, post-merge, post-checkout, commit-msg)')
  .option('--workspace-path <path>', 'workspace path', '.')
  .option('--args <args>', 'additional args (comma-separated)', '')
  .action((type, options) => {
    const hookType = type as HookType;
    const validHooks: HookType[] = ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'];

    if (!validHooks.includes(hookType)) {
      console.error(`Error: Unknown hook type "${type}". Valid: ${validHooks.join(', ')}`);
      process.exit(1);
    }

    const extraArgs = options.args ? options.args.split(',') : [];
    const result = runHook(hookType, extraArgs, options.workspacePath);

    console.log(`\nHook: ${result.hook}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      for (const e of result.errors) {
        console.error(`  ✗ ${e}`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      for (const w of result.warnings) {
        console.log(`  ⚠ ${w}`);
      }
    }

    if (result.passed) {
      console.log('\n✓ Hook passed.');
    } else {
      console.error(`\n✗ Hook failed with ${result.errors.length} error(s).`);
      process.exit(1);
    }
  });

hooksCmd.action(() => {
  console.log('Manage git hooks for automatic MumuSpec guard checks.\n');
  console.log('Usage:');
  console.log('  mumuspec hooks install        Install hooks to .git/hooks/');
  console.log('  mumuspec hooks uninstall      Remove hooks from .git/hooks/');
  console.log('  mumuspec hooks status         Show hook installation status');
  console.log('  mumuspec hooks run <type>     Manually run guard logic');
  console.log('\nHook types: pre-commit, post-merge, post-checkout, commit-msg');
});

// === dashboard (Enhanced: Status + Roadmap + Goals + Coverage) ===
program
  .command('dashboard')
  .description('Show real-time status dashboard for the active change')
  .option('--workspace-path <path>', 'workspace path', '.')
  .option('--json', 'output as JSON')
  .action((options) => {
    const root = findProjectRoot(options.workspacePath);
    if (!root) {
      console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
      process.exit(1);
    }

    const config = loadConfig(root);
    const activeChange = getActiveChange(root);
    const hookStatus = getHookStatus(options.workspacePath);

    // Parse phase/workflow from state
    let changePhase = '';
    let changeWorkflow = '';
    let changeSummary = '';
    if (activeChange) {
      changeSummary = getChangeStatusSummary(root, activeChange);
      try {
        const stateData = loadChangeState(root, activeChange);
        if (stateData) {
          changePhase = stateData.phase;
          changeWorkflow = stateData.workflow;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Build enhanced dashboard data
    const dashboard = getDashboardData(root, config, {
      activeChange: activeChange ?? null,
      hookStatus,
      changePhase,
      changeWorkflow,
      changeSummary,
    });

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(dashboard, null, 2));
      return;
    }

    // Text output — panel style
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                   MUMUSPEC DASHBOARD                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Project: ${dashboard.project}`);
    console.log(`Root:    ${dashboard.projectRoot}`);
    console.log('');

    // Active change section
    if (dashboard.activeChange) {
      const ac = dashboard.activeChange;
      console.log('┌─── Active Change ───────────────────────────────────────┐');
      console.log(`│ Name:     ${ac.name}`);
      console.log(`│ Phase:    ${ac.phase}`);
      console.log(`│ Workflow: ${ac.workflow}`);
      console.log(`│ Hooks:    ${ac.hookInstalled ? '✓ installed' : '○ not installed'}`);
      console.log(`│ Knowledge: ${ac.knowledgePages} pages (${ac.stalePages} stale)`);
      console.log('└─────────────────────────────────────────────────────────┘');
      console.log('');
      console.log(ac.summary);
    } else {
      console.log('No active change.');
      console.log('  Run `mumuspec new <name>` to create one.');
    }

    console.log('');

    // Knowledge Coverage section
    console.log('─── Knowledge Coverage ─────────────────────────────────────');
    const cov = dashboard.coverage;
    const ratio = (cov.coverageRatio * 100).toFixed(1);
    console.log(`  Pages: ${cov.totalPages} total, ${cov.stalePages} stale`);
    console.log(`  Coverage: ${ratio}%`);
    console.log('');

    // Goals section
    if (dashboard.goals.length > 0) {
      console.log('─── Project Goals ──────────────────────────────────────────');
      for (const goal of dashboard.goals) {
        const statusIcon = goal.status === 'completed' ? '✓' : goal.status === 'in_progress' ? '►' : '○';
        console.log(`  ${statusIcon} [${goal.id}] ${goal.title} (${goal.status})`);
      }
      console.log('');
    }

    // Roadmap section
    if (dashboard.roadmap.length > 0) {
      console.log('─── Roadmap ────────────────────────────────────────────────');
      for (const item of dashboard.roadmap) {
        const statusIcon = item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '►' : '○';
        console.log(`  ${statusIcon} [${item.id}] ${item.title} — ${item.milestone} (${item.status})`);
      }
      console.log('');
    }

    // Alerts section
    if (dashboard.alerts.length > 0) {
      console.log('─── Alerts ─────────────────────────────────────────────────');
      for (const alert of dashboard.alerts) {
        console.log(`  ⚠ ${alert}`);
      }
      console.log('');
    }

    // Hooks section
    console.log('─── Hooks ─────────────────────────────────────────────────');
    for (const hook of hookStatus.available) {
      const isInstalled = hookStatus.installed.includes(hook);
      console.log(`  ${isInstalled ? '✓' : '○'} ${hook}`);
    }

    console.log('');
  });

// === eval (Lightweight Eval Framework) ===
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
  .action((name, options) => {
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

// === i18n (Internationalization) ===
program
  .command('i18n')
  .description('Manage internationalization and locale settings')
  .command('status')
  .description('Show current locale and available translations')
  .option('--workspace-path <path>', 'workspace path', '.')
  .action((options) => {
    const root = options.workspacePath;
    const locales = listAvailableLocales(root);
    const current = getLocale();

    console.log(`\nCurrent locale: ${current}`);
    console.log(`Available: ${locales.join(', ')}`);
    console.log(`\nSet locale: MUMUSPEC_LANG=en mumuspec ...`);
    console.log(`Config: .mumuspec.yaml → language: "en"`);
  });

program
  .command('skill-path')
  .description('Resolve a skill file path with locale fallback')
  .argument('<name>', 'skill name (e.g., mumuspec, phase-open)')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const path = resolveSkillPath(root, name);
    if (path) {
      console.log(path);
    } else {
      console.log(`No skill "${name}" found for locale "${getLocale()}"`);
      process.exit(1);
    }
  });

// === skill-authoring (Authoring Protocol) ===
const authoringCmd = program
  .command('skill')
  .description('Skill authoring and management (MumuSpec Skill Protocol)');

authoringCmd
  .command('init')
  .description('Initialize skill authoring protocol for the project')
  .action(() => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const result = generateAuthoringProtocol(root);
    if (result.created) {
      console.log(`✓ Created: ${result.path}`);
      console.log(`Protocol version: ${AUTHORING_PROTOCOL.version}`);
      console.log(`Subagents: ${AUTHORING_PROTOCOL.subagents.join(', ')}`);
    } else {
      console.log(`Already exists: ${result.path}`);
    }
  });

authoringCmd
  .command('validate [name]')
  .description('Validate a custom skill (or all skills)')
  .action((name) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    if (name) {
      const result = validateSkill(root, name);
      console.log(`\nSkill: ${name}`);
      console.log(`Valid: ${result.valid ? '✓' : '✗'}`);
      for (const err of result.errors) {
        console.error(`  ✗ ${err}`);
      }
      for (const warn of result.warnings) {
        console.log(`  ⚠ ${warn}`);
      }
      if (!result.valid) process.exit(1);
    } else {
      const skills = listCustomSkills(root);
      if (skills.length === 0) {
        console.log('No custom skills found.');
        return;
      }
      console.log(`\n${skills.length} custom skill(s):\n`);
      for (const s of skills) {
        console.log(`  ${s.valid ? '✓' : '✗'} ${s.name}`);
        console.log(`    Path: ${s.path}`);
      }
    }
  });

authoringCmd
  .command('scaffold <name>')
  .description('Scaffold a new custom skill directory')
  .option('--workspace-path <path>', 'workspace path', '.')
  .option('--type <type>', 'skill type (phase, workflow, analysis, custom)', 'custom')
  .option('--description <desc>', 'skill description')
  .action((name, options) => {
    const root = findProjectRoot(options.workspacePath);
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const result = scaffoldSkill(root, name, {
      type: options.type,
      description: options.description,
    });

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.error(`✗ ${err}`);
      }
      process.exit(1);
    }

    console.log(`✓ Scaffolded skill "${name}":`);
    for (const f of result.created) {
      console.log(`  ${f}`);
    }
  });

authoringCmd.action(() => {
  console.log('Skill authoring and management.\n');
  console.log('Usage:');
  console.log('  mumuspec skill init           Initialize authoring protocol');
  console.log('  mumuspec skill validate [name]  Validate skill(s)');
  console.log('  mumuspec skill scaffold <name>  Create new skill scaffold');
});

// === bundle (Bundle/Publish Workflow) ===
const bundleCmd = program
  .command('bundle')
  .description('Bundle, validate, and publish skills');

bundleCmd
  .command('create [name]')
  .description('Create a bundle from .mumuspec/skills/')
  .option('--workspace-path <path>', 'workspace path', '.')
  .option('--include-evals', 'include eval scenarios')
  .option('--include-authoring', 'include authoring protocol')
  .action((name, options) => {
    const root = findProjectRoot(options.workspacePath);
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const result = createBundle(root, {
      name: name || undefined,
      includeEvals: options.includeEvals,
      includeAuthoring: options.includeAuthoring,
    });

    if (result.success) {
      console.log(`✓ Bundle created: ${result.outputPath}`);
      console.log(`  Files: ${result.fileCount}`);
    } else {
      console.error(`✗ Bundle failed: ${result.error}`);
      process.exit(1);
    }
  });

bundleCmd
  .command('validate <path>')
  .description('Validate a bundle manifest')
  .action((bundlePath) => {
    const result = validateBundle(bundlePath);
    console.log(`\nBundle: ${bundlePath}`);
    console.log(`Valid: ${result.valid ? '✓' : '✗'}`);
    for (const err of result.errors) {
      console.error(`  ✗ ${err}`);
    }
    if (!result.valid) process.exit(1);
  });

bundleCmd
  .command('install <path>')
  .description('Install a bundle into a workspace')
  .option('--target <path>', 'target workspace', '.')
  .action((bundlePath, options) => {
    const result = installBundle(bundlePath, options.target);
    if (result.success) {
      console.log(`✓ Installed ${result.installed.length} file(s)`);
    } else {
      console.error(`✗ Install failed: ${result.error}`);
      process.exit(1);
    }
  });

bundleCmd
  .command('list')
  .description('List available bundles in the project')
  .action(() => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const bundles = listBundles(root);
    if (bundles.length === 0) {
      console.log('No bundles found.');
      return;
    }

    console.log(`\n${bundles.length} bundle(s):`);
    for (const b of bundles) {
      console.log(`  ${b}`);
    }
  });

bundleCmd
  .command('publish <path>')
  .description('Publish a bundle (placeholder for registry integration)')
  .action((bundlePath) => {
    const result = publishBundle(bundlePath);
    if (result.success) {
      console.log(`✓ Bundle ready for publishing: ${result.bundlePath}`);
      console.log('  (Registry integration coming soon)');
    } else {
      console.error(`✗ Publish failed: ${result.error}`);
      process.exit(1);
    }
  });

bundleCmd.action(() => {
  console.log('Bundle, validate, and publish skills.\n');
  console.log('Usage:');
  console.log('  mumuspec bundle create [name]   Create skill bundle');
  console.log('  mumuspec bundle validate <path> Validate bundle');
  console.log('  mumuspec bundle install <path>  Install bundle to workspace');
  console.log('  mumuspec bundle list            List project bundles');
  console.log('  mumuspec bundle publish <path>  Publish bundle');
});

// === env (Environment Detection) ===
const envCmd = program
  .command('env')
  .description('Environment detection and validation');

envCmd
  .command('detect')
  .description('Detect current development environment and installed tools')
  .option('--save', 'save results to .mumuspec/env-spec.md')
  .option('--ecosystem <name>', 'detect only specified ecosystem (java/node/python/go/rust/build/container)', collect, [])
  .option('--json', 'output in JSON format')
  .action(async (options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    try {
      const ecosystems = options.ecosystem.length > 0 ? options.ecosystem : undefined;
      const detection = await detectEnvironment({ ecosystems, projectRoot: root });

      if (options.json) {
        console.log(JSON.stringify(detection, null, 2));
        return;
      }

      // Format output
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Environment Detection                                  ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`OS: ${detection.os.type} ${detection.os.version} (${detection.os.arch})`);
      console.log('');

      // Group tools by ecosystem
      const grouped = new Map<string, typeof detection.tools>();
      for (const tool of detection.tools) {
        const list = grouped.get(tool.ecosystem) || [];
        list.push(tool);
        grouped.set(tool.ecosystem, list);
      }

      for (const [eco, tools] of grouped) {
        console.log(`${eco.toUpperCase()}:`);
        for (const tool of tools) {
          const icon = tool.status === 'ok' ? '✓' : tool.status === 'warn' ? '⚠' : '✗';
          const version = tool.version !== 'unknown' ? tool.version : '';
          const location = tool.location ? `  ${tool.location}` : '';
          console.log(`  ${icon} ${tool.name.padEnd(10)} ${version}${location}`);
        }
        console.log('');
      }

      // Summary
      const missingCount = detection.tools.filter((t) => t.status === 'missing').length;
      const warnCount = detection.tools.filter((t) => t.status === 'warn').length;

      if (missingCount > 0 || warnCount > 0) {
        console.log(`Result: ${missingCount} missing, ${warnCount} warnings`);
      } else {
        console.log('Result: all detected ✓');
      }

      // Save if requested
      if (options.save) {
        await saveEnvSpec(root, detection);
        console.log('');
        console.log('✓ Saved to .mumuspec/env-spec.md');
      }
    } catch (err) {
      console.error(`✗ Environment detection failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

envCmd
  .command('validate')
  .description('Validate current environment against env-spec.md declarations')
  .option('--fix', 'auto-fix minor issues (generate suggestions only)')
  .option('--strict', 'strict mode: warnings become errors')
  .action(async (options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    try {
      const result = await validateEnv(root, { strict: options.strict });
      if (result.exitCode === 0) {
        if (options.fix && result.suggestions.length > 0) {
          console.log('');
          console.log('Suggestions:');
          for (const s of result.suggestions) {
            console.log(`  • ${s}`);
          }
        }
      }
      process.exit(result.exitCode);
    } catch (err) {
      console.error(`✗ Validation failed: ${(err as Error).message}`);
      process.exit(3);
    }
  });

envCmd
  .command('diff')
  .description('Compare current environment with saved env-spec.md or another spec file')
  .option('--against <file>', 'path to another env-spec.md to compare against')
  .action(async (options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    try {
      const result = await diffEnv(root, options.against);
      console.log(result);
    } catch (err) {
      console.error(`✗ Diff failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

envCmd.action(() => {
  console.log('Environment detection and validation.\n');
  console.log('Usage:');
  console.log('  mumuspec env detect           Detect installed tools');
  console.log('  mumuspec env detect --save    Detect and save to env-spec.md');
  console.log('  mumuspec env validate         Validate environment against spec');
  console.log('  mumuspec env diff             Compare with saved env-spec.md');
});

program.parse();
