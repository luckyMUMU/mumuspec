/**
 * doctor command — Environment diagnostics.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, getMumuSpecDir } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { getActiveChange } from '../../change/manager.js';

export function registerDoctorCommand(program: Command): void {
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
}
