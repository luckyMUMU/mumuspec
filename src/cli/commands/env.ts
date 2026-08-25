/**
 * env command — Environment detection and validation.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { detectEnvironment, saveEnvSpec, validateEnv, diffEnv } from '../../core/env-detector.js';
import { collect } from '../helpers.js';
import type { DetectedTool } from '../../core/types.js';

export function registerEnvCommands(program: Command): void {
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
        const missingCount = detection.tools.filter((t: DetectedTool) => t.status === 'missing').length;
        const warnCount = detection.tools.filter((t: DetectedTool) => t.status === 'warn').length;

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
}
