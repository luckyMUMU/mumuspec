/**
 * bundle command — Bundle, validate, and publish skills.
 */
import type { Command } from 'commander';
import { resolve } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import {
  createBundle,
  validateBundle,
  installBundle,
  publishBundle,
  listBundles,
} from '../../bundle/packager.js';
import { buildPluginPackage } from '../../bundle/plugin-package.js';

export function registerBundleCommands(program: Command): void {
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
    .command('plugin')
    .description('Build a host-standard plugin package (.codebuddy-plugin/plugin.json + skills/)')
    .option('--out <dir>', 'output directory for the plugin package', 'dist-plugin')
    .option('--marketplace <name>', 'marketplace name', 'mumuspec')
    .option('--name <name>', 'plugin name (kebab-case)', 'mumuspec')
    .option('--dry-run', 'report the plan without writing anything')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const result = buildPluginPackage(root, {
        outDir: resolve(root, options.out),
        marketplaceName: options.marketplace,
        pluginName: options.name,
        dryRun: options.dryRun === true,
      });

      if (!result.ok) {
        console.error(`✗ ${result.error ?? '插件包构建失败'}`);
        for (const v of result.violations ?? []) {
          console.error(`  ✗ [${v.path}] (${v.rule}) ${v.message}`);
        }
        process.exit(1);
      }

      console.log(`${options.dryRun ? '·  计划（未写盘）' : '✓ 插件包已生成'}: ${result.outDir}`);
      console.log(`  插件名: ${result.pluginName}  版本: ${result.version}`);
      console.log(`  技能数: ${result.skills?.length ?? 0}  (${(result.skills ?? []).join(', ')})`);
      console.log(`  下一步: mumuspec install plugin --from ${result.pluginRoot}`);
    });

  bundleCmd
    .command('publish <path>')
    .description('Publish a bundle（未实现，fail-closed；请改用 bundle plugin）')
    .action((bundlePath) => {
      const result = publishBundle(bundlePath);
      if (result.success) {
        console.log(`✓ Bundle ready for publishing: ${result.bundlePath}`);
      } else {
        console.error(`✗ Publish failed: ${result.error}`);
        process.exit(1);
      }
    });

  bundleCmd.action(() => {
    console.log('Bundle, validate, and publish skills.\n');
    console.log('Usage:');
    console.log('  mumuspec bundle plugin          Build host-standard plugin package');
    console.log('  mumuspec bundle create [name]   Create skill bundle');
    console.log('  mumuspec bundle validate <path> Validate bundle');
    console.log('  mumuspec bundle install <path>  Install bundle to workspace');
    console.log('  mumuspec bundle list            List project bundles');
    console.log('  mumuspec bundle publish <path>  Publish bundle（未实现）');
  });
}
