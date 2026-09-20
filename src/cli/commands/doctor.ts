/**
 * doctor command — Environment diagnostics.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, getMumuSpecDir } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { collectStrengthDeviations } from '../../core/constraint-evaluator.js';
import { getActiveChange } from '../../change/manager.js';
import { LEGACY_RULE_FILES } from '../../rules/generator.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Environment diagnostics')
    .action(async () => {
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

      // Legacy rule files (TC-A4x / C3): 只提示迁移，不删除存量
      const legacyFound = LEGACY_RULE_FILES.filter((f) => existsSync(join(root, f)));
      if (legacyFound.length > 0) {
        console.log('');
        console.log(`⚠ Legacy rule files: ${legacyFound.join(', ')}`);
        console.log('  MumuSpec 不再生成 .cursorrules / .windsurfrules（C3 红线）。现有文件不受影响；');
        console.log('  建议将内容迁移到 AGENTS.md（canonical）后手动删除这些遗留文件。');
      }

      // Strength suggestion (strength-suggested): 确定性推导，建议 vs 实际对照，人工签收不改写。
      const deviations = collectStrengthDeviations(loadConfig(root).constraint_strength);
      console.log('');
      if (deviations.length === 0) {
        console.log('Constraint strength: ✓ 无偏差（建议值与当前维度强度一致）');
      } else {
        console.log('Constraint strength: ⚠ 建议值高于当前维度强度（仅提示，需人工签收后改动，不自动修改）');
        for (const d of deviations.slice(0, 10)) {
          console.log(`  [${d.code}] ${d.severity} → 建议 ${d.suggested}（当前 ${d.dimension}=${d.actual}）`);
        }
        if (deviations.length > 10) console.log(`  … 共 ${deviations.length} 条`);
      }

      // engine-consolidation L3: legacy 词法兜底 advisory（确定性来自本轮 coverage）。
      try {
        const { checkCompliance } = await import('../../guard/checker.js');
        const cov = checkCompliance(root, {}).coverage;
        const weakCount = cov?.legacy_weak ?? 0;
        const weakList = cov?.actionable_weak ?? [];
        if (weakCount > 0) {
          console.log('');
          console.log(`Legacy 词法兜底条目: ⚠ ${weakCount} 条无显式通道声明（建议：挂 behavior-gate 注解 / 改写为可提取文本 / 显式 manual(reason)）`);
          for (const w of weakList.slice(0, 5)) {
            console.log(`  • [${w.source}] ${w.text.slice(0, 60)}`);
          }
          if (weakList.length > 5) console.log(`  … 完整清单：mumuspec check --json → coverage.actionable_weak`);
        }
      } catch { /* advisory 通道不得影响 doctor 主体诊断 */ }

      console.log('');
    });
}
