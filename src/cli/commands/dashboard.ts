/**
 * dashboard command — Real-time status dashboard.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { getActiveChange, loadChangeState, getChangeStatusSummary } from '../../change/manager.js';
import { getHookStatus } from '../../hooks/guard.js';
import { getDashboardData } from '../../knowledge/manager.js';

export function registerDashboardCommands(program: Command): void {
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
}
