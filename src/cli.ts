#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
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
import { canTransition, executeTransition, executeRollback, getValidTransitions, getNextPhase, getWorkflowPhases, isTerminal } from './change/state-machine.js';

// Guard
import { checkCompliance, detectDrift } from './guard/checker.js';
import { runPhaseGuard } from './guard/phase-guard.js';

// Rules
import { generateRulesFiles } from './rules/generator.js';

// Knowledge
import { listKnowledgePages, getKnowledgePage, searchKnowledge, getKnowledgeContext, createKnowledgePage, verifyKnowledge, listStalePages, supersedeKnowledge, loadPageIndex, rebuildPageIndex } from './knowledge/manager.js';

const program = new Command();

program
  .name('mumuspec')
  .description('MumuSpec — Tree-distributed dual-constraint specification system')
  .version('0.10.0');

// === init ===
program
  .command('init')
  .description('Initialize MumuSpec in the current or specified directory')
  .argument('[path]', 'project path', '.')
  .option('--name <name>', 'project name')
  .option('--language <lang>', 'primary language', 'typescript')
  .option('--framework <fw>', 'framework')
  .action((path, options) => {
    const projectRoot = resolve(path);

    if (isInitialized(projectRoot)) {
      console.error('Error: MumuSpec is already initialized in this directory.');
      process.exit(1);
    }

    const mumuDir = getMumuSpecDir(projectRoot);
    ensureDir(mumuDir);

    // Create config
    const config = getDefaultConfig(options.name || projectRoot.split(/[\\/]/).pop() || 'my-project');
    config.project.language = options.language;
    if (options.framework) config.project.framework = options.framework;
    saveConfig(projectRoot, config);

    // Create root spec.md
    const specPath = join(mumuDir, 'spec.md');
    let specContent = createDefaultSpecContent(0, '.');

    // Inject Ponytail constraints if enabled
    if (config.ponytail.auto_inject_to_root) {
      const spec = parseSpecFile(specContent, specPath);
      const injected = injectPonytail(spec);
      specContent = serializeSpecFile(injected);
    }
    writeText(specPath, specContent);

    // Create root design.md
    const designPath = join(mumuDir, 'design.md');
    writeText(designPath, `# Design: ${config.project.name}\n\n## Architecture Overview\n[Describe the overall architecture]\n\n## Key Decisions\n[Document key architectural decisions]\n`);

    // Create root prohibitions.md
    const prohibitionsPath = join(mumuDir, 'prohibitions.md');
    writeText(prohibitionsPath, '# Global Prohibitions\n\n## All Modules\n(Add global SHALL NOT constraints here)\n');

    // Create index.yaml
    const indexPath = join(mumuDir, 'index.yaml');
    writeYaml(indexPath, { scope: '.', layer: 0, children: [] });

    // Create changes directory
    ensureDir(join(mumuDir, 'changes'));
    ensureDir(join(mumuDir, 'changes', 'archive'));

    // Create knowledge directory
    ensureDir(join(mumuDir, 'knowledge'));

    // Create contracts directory
    ensureDir(join(mumuDir, 'contracts', 'external'));
    ensureDir(join(mumuDir, 'contracts', 'outbound'));
    ensureDir(join(mumuDir, 'contracts', 'schemas'));

    // Create skills directory
    ensureDir(join(mumuDir, 'skills'));

    // Generate Rules files
    if (config.ai.generate_rules) {
      generateRulesFiles(projectRoot, config);
    }

    // Audit log
    appendAuditLog(mumuDir, { actor: 'user', action: 'init', result: 'success' });

    console.log(`\n✓ MumuSpec initialized in ${projectRoot}`);
    console.log(`  Config: ${join(mumuDir, 'config.yaml')}`);
    console.log(`  Spec: ${specPath}`);
    console.log(`  Design: ${designPath}`);
    console.log(`  Prohibitions: ${prohibitionsPath}`);
    console.log(`  Index: ${indexPath}`);
    if (config.ai.generate_rules) {
      console.log(`  Rules: ${config.ai.rules_files.join(', ')}`);
    }
    console.log('\nNext steps:');
    console.log('  1. Edit .mumuspec/spec.md to define your project specifications');
    console.log('  2. Run `mumuspec new <name>` to create your first change');
    console.log('  3. Run `mumuspec doctor` to verify your environment');
  });

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

    const result = checkCompliance(root, {
      shall: options.shall,
      shallNot: options.shallNot,
      ponytail: options.ponytail,
      testImmutability: options.testImmutability,
      stagedOnly: options.stagedOnly,
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
  .description('Run phase guard check')
  .argument('<change>', 'change name')
  .argument('<phase>', 'target phase')
  .option('--json', 'output as JSON')
  .action((change, phase, options) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project.');
      process.exit(1);
    }

    const result = runPhaseGuard(root, change, phase);

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

    // Normal transition
    const result = executeTransition(state, event as any, { userConfirmed: options.confirm });
    if (result.success) {
      saveChangeState(root, name, result.state);
      console.log(`✓ Transitioned ${name}: ${state.phase} → ${event}`);
    } else {
      console.error(`✗ Transition failed: ${result.error}`);
      process.exit(1);
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

program.parse();
