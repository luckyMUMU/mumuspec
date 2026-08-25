/**
 * audit-log command — Display the append-only audit log.
 *
 * Reads the JSONL audit trail at .mumuspec/audit.log (written by appendAuditLog),
 * with optional filtering by actor, action, result, and a tail limit.
 */
import type { Command } from 'commander';
import { join } from 'node:path';
import { findProjectRoot, getMumuSpecDir, existsSync, readText } from '../../core/utils.js';
import type { AuditLogEntry } from '../../core/types-analysis.js';

export function registerAuditLogCommand(program: Command): void {
  program
    .command('audit-log')
    .description('Display the append-only audit log (JSONL at .mumuspec/audit.log)')
    .option('--limit <n>', 'show last N entries (from newest)', '50')
    .option('--actor <actor>', 'filter by actor')
    .option('--action <action>', 'filter by action')
    .option('--result <result>', 'filter by result (success|fail)')
    .option('--json', 'output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const logPath = join(getMumuSpecDir(root), 'audit.log');
      if (!existsSync(logPath)) {
        console.log('No audit log found. .mumuspec/audit.log does not exist yet.');
        return;
      }

      const raw = readText(logPath) || '';
      const entries: AuditLogEntry[] = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line) as AuditLogEntry;
          } catch {
            return null;
          }
        })
        .filter((e): e is AuditLogEntry => e !== null);

      let filtered = entries;
      if (options.actor) filtered = filtered.filter((e) => e.actor === options.actor);
      if (options.action) filtered = filtered.filter((e) => e.action === options.action);
      if (options.result) filtered = filtered.filter((e) => e.result === options.result);

      const limit = parseInt(options.limit, 10) || 50;
      const shown = filtered.slice(-Math.max(0, limit));

      if (options.json) {
        console.log(JSON.stringify({ total: filtered.length, entries: shown }, null, 2));
        return;
      }

      if (shown.length === 0) {
        console.log(`No audit log entries match (${filtered.length} total).`);
        return;
      }

      console.log(`\nAudit Log (${filtered.length} total, showing ${shown.length}):\n`);
      for (const entry of shown) {
        const icon = entry.result === 'success' ? '✓' : '✗';
        const error = entry.error ? ` (${entry.error})` : '';
        console.log(`  ${icon} [${entry.ts}] ${entry.actor} → ${entry.action}${error}`);
      }
      console.log('');
    });
}
