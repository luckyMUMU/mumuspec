/**
 * merge command — Merge an archived change branch back to the main branch.
 *
 * Gate: archive-completed + branch_status handled + clean working tree + --no-ff.
 * Conflict pauses with manual resolution, local-only (no remote/PR).
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { checkMergeGate, mergeArchivedChange } from '../../change/branch.js';
import { getCurrentBranch, getMainBranch } from '../../core/git.js';
import { MumuSpecError } from '../../core/errors.js';

export function registerMergeCommand(program: Command): void {
  program
    .command('merge')
    .description('Merge an archived change branch back to the main branch (--no-ff)')
    .argument('<change>', 'change name (must be archive-completed)')
    .option('--json', 'output as JSON')
    .action((change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      if (options.json) {
        const gate = checkMergeGate(root, change);
        if (gate.passed) {
          try {
            const commitSha = mergeArchivedChange(root, change);
            console.log(JSON.stringify({ ok: true, change, commit_sha: commitSha }, null, 2));
          } catch (e) {
            console.log(JSON.stringify({ ok: false, change, error: e instanceof Error ? e.message : String(e) }, null, 2));
            process.exit(1);
          }
        } else {
          console.log(JSON.stringify({ ok: false, change, errors: gate.errors.map((e) => e.message) }, null, 2));
          process.exit(1);
        }
        return;
      }

      // Pre-check: must be on the main branch
      const currentBranch = getCurrentBranch(root);
      let mainBranch: string | undefined;
      try {
        mainBranch = getMainBranch(root);
      } catch {
        mainBranch = undefined;
      }

      if (mainBranch && currentBranch && currentBranch !== mainBranch) {
        console.warn(`⚠ 当前在分支 '${currentBranch}' 上，merge 会在主分支 '${mainBranch}' 上执行。`);
      }

      const gate = checkMergeGate(root, change);
      if (!gate.passed) {
        console.error(`✗ 合并门禁未通过: ${change}`);
        for (const err of gate.errors) {
          console.error(`  [${err.code}] ${err.message}`);
        }
        process.exit(1);
      }

      try {
        const commitSha = mergeArchivedChange(root, change);
        console.log(`✓ 变更 "${change}" 已合并到主分支`);
        console.log(`  Commit: ${commitSha}`);
        console.log(`  变更分支已删除（--no-ff）`);
      } catch (e) {
        if (e instanceof MumuSpecError && e.code === 'E-MERGE-010') {
          console.error(`✗ 合并冲突，已暂停：`);
          console.error(`  ${e.context?.['说明'] ?? '请手动解决冲突'}`);
          console.error(`  解决后执行: git add <files> && git commit && 再次执行 mumuspec merge ${change}`);
        } else {
          console.error(`✗ 合并失败: ${e instanceof Error ? e.message : String(e)}`);
        }
        process.exit(1);
      }
    });
}
