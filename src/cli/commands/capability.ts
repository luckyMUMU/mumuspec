/**
 * capability command — 查询命令的能力分层属性（Capability Tier）。
 *
 * `mumuspec capability`            列出全部已登记命令的元数据
 * `mumuspec capability <command>`  查询单个命令（未登记回落到 general 默认）
 * `mumuspec capability <command> --json`  机器可读输出
 *
 * P0-A 最小版：仅查询能力属性。dry-run 框架与名称二次确认属二期。
 */
import type { Command } from 'commander';
import {
  COMMAND_METADATA,
  getCommandMetadata,
  listCommandMetadata,
} from '../capability.js';

export function registerCapabilityCommand(program: Command): void {
  program
    .command('capability [command]')
    .description('Query command capability tier (general/dedicated, risk, confirm, composable)')
    .option('--json', 'output as JSON')
    .action((command: string | undefined, options: { json?: boolean }) => {
      // ── 单命令查询 ──
      if (command) {
        const meta = getCommandMetadata(command);
        if (options.json) {
          console.log(JSON.stringify({ command, ...meta }, null, 2));
          return;
        }
        console.log(`命令: ${command}`);
        console.log(`  tier:            ${meta.tier}`);
        console.log(`  risk:            ${meta.risk}`);
        console.log(`  confirmRequired: ${meta.confirmRequired}`);
        console.log(`  reversible:      ${meta.reversible}`);
        console.log(`  composable:      ${meta.composable}`);
        if (!COMMAND_METADATA[command]) {
          console.log('  （未登记，回落 general 默认）');
        }
        return;
      }

      // ── 列出全部 ──
      const all = listCommandMetadata();
      if (options.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      console.log('已登记命令的能力属性：');
      console.log('');
      console.log('  COMMAND              TIER        RISK    CONFIRM  REVERSIBLE  COMPOSABLE');
      console.log('  ' + '-'.repeat(76));
      for (const [name, m] of Object.entries(all)) {
        console.log(
          `  ${name.padEnd(20)}${m.tier.padEnd(12)}${m.risk.padEnd(8)}${String(m.confirmRequired).padEnd(9)}${String(m.reversible).padEnd(12)}${m.composable}`,
        );
      }
      console.log('');
      console.log('注：未登记命令回落到 general（只读、可组合）。');
    });
}
