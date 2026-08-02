/**
 * spec commands — context, add-spec, validate, check, drift, search.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { SpecFile, Requirement } from '../../core/types.js';
import { findProjectRoot, ensureDir, writeText, readText, now } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { formatError } from '../../core/errors.js';
import { createDefaultSpecContent, parseSpecFile, serializeSpecFile } from '../../spec/parser.js';
import { loadSpecContext, searchSpecs } from '../../spec/loader.js';
import { validateAllSpecs } from '../../spec/validator.js';
import { checkCompliance, detectDrift } from '../../guard/checker.js';

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
}
