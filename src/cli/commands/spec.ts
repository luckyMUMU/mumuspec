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
import { loadSpecContext, searchSpecs, findAllDistributedSpecDirs } from '../../spec/loader.js';
import { validateAllSpecs } from '../../spec/validator.js';
import { checkCompliance, detectDrift, autoFixDrift } from '../../guard/checker.js';
import { loadChangeState } from '../../change/state.js';

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
  const driftCmd = program
    .command('drift')
    .description('Detect drift between specs and code')
    .option('--json', 'output as JSON')
    .option('--fix', 'auto-fix safe drift issues')
    .option('--dry-run', 'preview fixes without applying (use with --fix)');

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
  }

  driftCmd.action((options) => runDriftDetection(options));

  driftCmd
    .command('detect')
    .description('Detect drift (optionally scoped to a change)')
    .option('--change <name>', 'scope drift detection to a change')
    .option('--json', 'output as JSON')
    .option('--fix', 'auto-fix safe drift issues')
    .option('--dry-run', 'preview fixes without applying (use with --fix)')
    .action((options) => runDriftDetection(options));

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
}
