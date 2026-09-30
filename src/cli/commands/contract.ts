/**
 * Contract CLI commands — manage external contracts, boundaries, and drift.
 *
 * Commands:
 * - mumuspec contract list         List all contracts
 * - mumuspec contract show <id>    Show contract details
 * - mumuspec contract register     Register a new contract
 * - mumuspec boundary list         List all boundary documents
 * - mumuspec boundary check        Validate boundary documents
 */

import { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { planContractImport } from '../../contract/reuse.js';
import {
  loadAllContracts,
  findAllBoundaryDocuments,
} from '../../contract/loader.js';
import {
  validateBoundaries,
  detectContractDrift,
} from '../../contract/validator.js';
import { persistContract } from '../../contract/manager.js';
import { toSarifString } from '../../contract/formatter/sarif.js';
import { toProblemMatcherString } from '../../contract/formatter/problem-matcher.js';
import { findProjectRoot, readText, readdirSync } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/state.js';
import type { Contract, ContractRegistry } from '../../core/types-contract.js';

/** Recursively collect .md files under a directory */
function collectMarkdownFiles(dir: string, files: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(full, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
}

export function registerContractCommands(program: Command): void {
  const contract = program
    .command('contract')
    .description('Manage external contracts and boundaries');

  // ─── contract list ───────────────────────────────────────────
  contract
    .command('list')
    .description('List all registered contracts')
    .option('--category <cat>', 'Filter by category (api, database, sdk, cli, ...)')
    .option('--status <status>', 'Filter by status (draft, active, deprecated, retired)')
    .option('--outbound', 'Show only outbound contracts')
    .option('--inbound', 'Show only inbound contracts')
    .option('--scopes', 'List distinct source scopes instead of contracts')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const registry = loadAllContracts(root);
      let contracts = registry.contracts;

      if (options.category) {
        contracts = contracts.filter((c: Contract) => c.category === options.category);
      }
      if (options.status) {
        contracts = contracts.filter((c: Contract) => c.status === options.status);
      }
      if (options.outbound) {
        contracts = contracts.filter((c: Contract) => registry.outbound_ids.includes(c.id));
      }
      if (options.inbound) {
        contracts = contracts.filter((c: Contract) => registry.inbound_ids.includes(c.id));
      }

      if (options.scopes) {
        const scopes = [...new Set(contracts.map((c: Contract) => c.source).filter(Boolean))].sort();
        if (options.json) {
          console.log(JSON.stringify({ scopes }, null, 2));
          return;
        }
        console.log(`\nContract source scopes (${scopes.length}):\n`);
        for (const s of scopes) console.log(`  ${s}`);
        console.log();
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ contracts, total: contracts.length }, null, 2));
        return;
      }

      if (contracts.length === 0) {
        console.log('No contracts registered. Add contracts to .mumuspec/contracts/contracts.yaml');
        return;
      }

      console.log(`\nContracts (${contracts.length} total):\n`);
      for (const c of contracts) {
        const statusIcon = c.status === 'active' ? '[active]' : '[deprecated]';
        const dirIcon = registry.outbound_ids.includes(c.id) ? '-> OUT' : '<- IN ';
        console.log(`  ${statusIcon} [${dirIcon}] ${c.id}  v${c.version}  (${c.category})  ${c.name}`);
        if (c.upstream.length > 0) console.log(`         upstream: ${c.upstream.join(', ')}`);
        if (c.downstream.length > 0) console.log(`         downstream: ${c.downstream.join(', ')}`);
      }
      console.log();
    });

  // ─── contract verify ─────────────────────────────────────────
  contract
    .command('verify')
    .description('Verify contract drift (optionally scoped to a change)')
    .option('--change <name>', 'change name (verifies the change exists first)')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      if (options.change) {
        const state = loadChangeState(root, options.change);
        if (!state) {
          console.error(`Error: Change "${options.change}" not found.`);
          process.exit(1);
        }
      }

      const report = detectContractDrift(root);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        if (report.has_critical_drifts) process.exit(1);
        return;
      }

      console.log(`\nContract Drift Report (${report.timestamp}):`);
      console.log(`  Contracts scanned: ${report.total_contracts}`);
      console.log(`  Drifts detected:   ${report.drift_count}`);
      console.log(`  Clean contracts:   ${report.clean_contracts.length}`);
      console.log(`  Scan duration:     ${report.scan_duration_ms}ms`);
      console.log(`  Critical drifts:   ${report.has_critical_drifts ? 'YES' : 'no'}`);

      for (const drift of report.drifts) {
        const icon = drift.severity === 'ERROR' ? '✗' : '⚠';
        console.log(`  ${icon} [${drift.type}] ${drift.contract_id}: ${drift.message}`);
        if (drift.file) console.log(`         File: ${drift.file}${drift.line ? `:${drift.line}` : ''}`);
        if (drift.suggestion) console.log(`         Fix:  ${drift.suggestion}`);
      }

      if (report.has_critical_drifts) {
        console.log('\n✗ Critical contract drift found — run `mumuspec contract drift --json` for details.');
        process.exit(1);
      }
      console.log('\n✓ No critical contract drift.');
    });

  // ─── contract compat-check ───────────────────────────────────
  contract
    .command('compat-check')
    .description('Check change references against the contract registry (missing/deprecated/retired)')
    .option('--change <name>', 'change name (uses active change if omitted)')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const changeName = options.change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify --change or run inside a change directory.');
        process.exit(1);
      }

      const state = loadChangeState(root, changeName);
      if (!state) {
        console.error(`Error: Change "${changeName}" not found.`);
        process.exit(1);
      }

      const registry = loadAllContracts(root);
      const registered = new Map(registry.contracts.map((c: Contract) => [c.id, c.status]));

      // Collect contract IDs referenced by the change's markdown files
      const changeDir = join(root, '.mumuspec', 'changes', changeName);
      const files: string[] = [];
      collectMarkdownFiles(changeDir, files);

      const referenced = new Set<string>();
      // 契约 ID 形态为 <字母2-8>-<数字1-4>（如 AA-01 / API-001 / CONTRACT-001）。
      //
      // 两个必须的收窄（此前缺失，导致系统性假阳性）：
      //  1. 负向后视 (?<![A-Z0-9-])：切断错误码里的片段——E-SPEC-015 中的
      //     "SPEC-015"、W-SKILL-001 中的 "SKILL-001" 都不是契约 ID。
      //  2. 显式排除项目内既有的编号约定（Enforcement / 阻塞点 / 开放问题 /
      //     grill-me 条目），它们是变更工件的编号，不是契约注册表的键。
      // 教训与 60 条 E-GUARD-003 同族：约定无关的模式套在合法含有其它 ID 约定的文本上。
      const idPattern = /(?<![A-Z0-9-])([A-Z]{2,8}-\d{1,4})(?![\dA-Z-])/g;
      const NON_CONTRACT_PREFIXES = new Set(['ENF', 'BP', 'OQ', 'GM', 'DS']);

      function collectContractIds(content: string): void {
        let match: RegExpExecArray | null;
        idPattern.lastIndex = 0;
        while ((match = idPattern.exec(content)) !== null) {
          const id = match[1];
          const prefix = id.slice(0, id.indexOf('-'));
          if (NON_CONTRACT_PREFIXES.has(prefix)) continue;
          referenced.add(id);
        }
      }

      for (const file of files) {
        const content = readText(file);
        if (!content) continue;
        collectContractIds(content);
      }

      const problems: Array<{ id: string; status?: string; file?: string }> = [];
      const ok: string[] = [];
      for (const id of [...referenced].sort()) {
        const status = registered.get(id);
        if (!status) {
          problems.push({ id });
        } else if (status === 'deprecated' || status === 'retired') {
          problems.push({ id, status });
        } else {
          ok.push(id);
        }
      }

      if (options.json) {
        console.log(JSON.stringify({ change: changeName, referenced: [...referenced].sort(), problems, ok }, null, 2));
        if (problems.length > 0) process.exit(1);
        return;
      }

      console.log(`\nContract Compat Check: ${changeName}`);
      console.log(`  Referenced contract IDs: ${referenced.size}`);
      if (ok.length > 0) console.log(`  ✓ Compatible: ${ok.join(', ')}`);
      if (problems.length === 0) {
        console.log('\n✓ All referenced contracts are compatible.');
        return;
      }
      console.log(`  ✗ Problems (${problems.length}):`);
      for (const p of problems) {
        const reason = p.status ? `is ${p.status}` : 'not found in registry';
        console.log(`    - ${p.id} ${reason}`);
      }
      console.log('\n✗ Compat check failed — update the change or register the contracts.');
      process.exit(1);
    });

  // ─── contract drift ──────────────────────────────────────────
  contract
    .command('drift')
    .description('Detect contract drift (full report)')
    .option('--change <name>', 'change name (verifies the change exists first)')
    .option('--json', 'Output as JSON')
    .option('--format <fmt>', 'Output format: sarif, problem-matcher', 'default')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const report = detectContractDrift(root);

      // Standardized output formats (R-0006)
      if (options.format === 'sarif') {
        console.log(toSarifString(report));
        if (report.has_critical_drifts) process.exit(1);
        return;
      }
      if (options.format === 'problem-matcher') {
        console.log(toProblemMatcherString(report));
        if (report.has_critical_drifts) process.exit(1);
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        if (report.has_critical_drifts) process.exit(1);
        return;
      }

      console.log(`\nContract Drift (${report.timestamp}):`);
      console.log(`  Total contracts: ${report.total_contracts}`);
      console.log(`  Drift count:     ${report.drift_count}`);
      for (const drift of report.drifts) {
        const icon = drift.severity === 'ERROR' ? '✗' : '⚠';
        console.log(`  ${icon} [${drift.type}] ${drift.contract_id}: ${drift.message}`);
        if (drift.file) console.log(`         File: ${drift.file}${drift.line ? `:${drift.line}` : ''}`);
      }
      if (report.clean_contracts.length > 0) {
        console.log(`  Clean: ${report.clean_contracts.join(', ')}`);
      }
      if (report.has_critical_drifts) process.exit(1);
    });

  // ─── contract show ───────────────────────────────────────────
  contract
    .command('show <id>')
    .description('Show contract details')
    .option('--json', 'Output as JSON')
    .action((id: string, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const registry = loadAllContracts(root);
      const contract = registry.contracts.find((c: Contract) => c.id === id);

      if (!contract) {
        console.error(`Contract not found: ${id}`);
        console.log(`Available: ${registry.contracts.map((c: Contract) => c.id).join(', ') || '(none)'}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(contract, null, 2));
        return;
      }

      const dirLabel = registry.outbound_ids.includes(contract.id) ? 'OUTBOUND' : 'INBOUND';
      console.log(`\nContract: ${contract.id} [${dirLabel}]\n`);
      console.log(`  Name:         ${contract.name}`);
      console.log(`  Category:     ${contract.category}`);
      console.log(`  Status:       ${contract.status}`);
      console.log(`  Criticality:  ${contract.criticality}`);
      console.log(`  Version:      ${contract.version}`);
      console.log(`  Source:       ${contract.source}`);
      console.log(`  Description:  ${contract.description}`);
      if (contract.owner) console.log(`  Owner:        ${contract.owner}`);
      if (contract.upstream.length > 0) console.log(`  Upstream:     ${contract.upstream.join(', ')}`);
      if (contract.downstream.length > 0) console.log(`  Downstream:   ${contract.downstream.join(', ')}`);
      if (contract.migrationPath) console.log(`  Migration:    ${contract.migrationPath}`);
      console.log(`  Schema:       ${JSON.stringify(contract.schema, null, 2)}`);
      if (contract.examples && contract.examples.length > 0) {
        console.log(`  Examples:\n${contract.examples.map((e) => `    - ${e}`).join('\n')}`);
      }
      if (contract.deprecationNote) console.log(`  Deprecation:  ${contract.deprecationNote}`);
      console.log();
    });

  // ─── contract import ─────────────────────────────────────────
  contract
    .command('import')
    .description('按范围导入已注册契约（来源可追溯；只读来源，不改上游）')
    .requiredOption('--from <scope>', 'source scope holding the contracts (e.g. src/guard)')
    .option('--id <contractId>', 'import a single contract by id')
    .option('--to <scope>', 'target scope', '.')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const srcRoot = resolve(root, options.from);
      if (!existsSync(srcRoot)) {
        console.error(`✗ 来源范围不存在: ${options.from}`);
        process.exit(1);
      }

      let sourceRegistry: ContractRegistry;
      try {
        sourceRegistry = loadAllContracts(srcRoot);
      } catch (err) {
        // A malformed upstream registry is a real failure: report it structured
        // and exit non-zero — never fall back to "nothing to import".
        console.error(
          `✗ 读取来源契约注册表失败: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(1);
      }

      const plan = planContractImport(sourceRegistry, {
        fromScope: options.from,
        id: options.id,
      });

      if (plan.missing.length > 0) {
        console.error(`✗ 来源 ${options.from} 未声明契约: ${plan.missing.join(', ')}`);
        console.error(`  该范围可选项: ${plan.available.join(', ') || '（无已注册契约）'}`);
        process.exit(1);
      }
      if (plan.items.length === 0) {
        console.error(`✗ 来源 ${options.from} 没有可导入的契约`);
        process.exit(1);
      }

      const targetRoot = resolve(root, options.to);
      let imported = 0;
      for (const item of plan.items) {
        const result = persistContract(targetRoot, item, { create: true, actor: 'cli' });
        if (result.success) imported++;
        else console.error(`  ✗ ${item.id}: ${result.message}`);
      }

      console.log(
        `✓ 导入 ${imported}/${plan.items.length} 个契约到 ${options.to}（来源标注为 ${options.from}）`,
      );
      console.log('  上游变更后由 contract verify / compat-check 报出，导入方无需手工比对');
      if (imported < plan.items.length) process.exit(1);
    });

  // ─── contract register ───────────────────────────────────────
  contract
    .command('register')
    .description('Register a new contract interactively')
    .requiredOption('--id <id>', 'Contract unique identifier')
    .requiredOption('--name <name>', 'Contract name')
    .requiredOption('--category <cat>', 'Contract category')
    .requiredOption('--source <path>', 'Source file path')
    .option('--version <ver>', 'Contract version', '1.0.0')
    .option('--criticality <level>', 'Criticality (critical/standard/low)', 'standard')
    .option('--status <status>', 'Initial status (draft/active deprecated/retired)', 'active')
    .option('--owner <owner>', 'Contract owner/team')
    .option('--description <desc>', 'Contract description', '')
    .option('--upstream <ids...>', 'Upstream consumer IDs')
    .option('--downstream <ids...>', 'Downstream provider IDs')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const newContract: Contract = {
        id: options.id,
        name: options.name,
        category: options.category as Contract['category'],
        status: options.status as Contract['status'],
        criticality: options.criticality as Contract['criticality'],
        version: options.version,
        source: options.source,
        owner: options.owner,
        description: options.description,
        upstream: options.upstream || [],
        downstream: options.downstream || [],
        schema: {},
        examples: [],
      };

      const result = persistContract(root, newContract);
      if (!result.success) {
        console.error(`Failed: ${result.message}`);
        process.exit(1);
      }
      console.log(`Contract registered: ${options.id}`);
      console.log(`  ${result.message}`);
      console.log();
    });

  // ─── boundary commands ───────────────────────────────────────
  const boundary = contract
    .command('boundary')
    .description('Manage directory boundary documents');

  boundary
    .command('list')
    .description('List all boundary documents')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const docs = findAllBoundaryDocuments(root);

      if (options.json) {
        console.log(JSON.stringify({ boundaries: docs, total: docs.length }, null, 2));
        return;
      }

      if (docs.length === 0) {
        console.log('No BOUNDARY.md files found. Add BOUNDARY.md to directories with public APIs.');
        return;
      }

      console.log(`\nBoundary Documents (${docs.length} found):\n`);
      for (const doc of docs) {
        console.log(`  ${doc.dir_path}`);
        console.log(`     Exports: ${doc.exports.length}, Deps: ${doc.dependencies.length}, Data: ${doc.data_contracts.length}`);
      }
      console.log();
    });

  boundary
    .command('check')
    .description('Validate boundary documents against code')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const results = validateBoundaries(root);

      if (options.json) {
        console.log(JSON.stringify({ results }, null, 2));
        return;
      }

      console.log(`\nBoundary Validation Results:\n`);
      let totalErrors = 0;
      let totalWarnings = 0;

      for (const result of results) {
        const icon = result.has_boundary_doc ? '[doc]' : '[MISSING]';
        console.log(`  ${icon} ${result.dir_path}`);
        for (const err of result.errors) {
          totalErrors++;
          console.log(`     [ERROR] [${err.code}] ${err.message}`);
        }
        for (const warn of result.warnings) {
          totalWarnings++;
          console.log(`     [WARN]  [${warn.code}] ${warn.message}`);
        }
      }

      console.log(`\n  Summary: ${totalErrors} errors, ${totalWarnings} warnings\n`);
      if (totalErrors > 0) process.exit(1);
    });

  // ─── contract impact ────────────────────────────────────────
  contract
    .command('impact <contractId>')
    .description('Analyze impact of modifying/removing a contract')
    .option('--change-type <type>', 'Change type: modify, remove, deprecate', 'modify')
    .option('--json', 'Output as JSON')
    .action(async (contractId: string, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const { analyzeContractImpact, formatImpactReport } = await import('../../contract/impact-analyzer.js');
      const changeType = options.change_type as 'modify' | 'remove' | 'deprecate';

      if (!['modify', 'remove', 'deprecate'].includes(changeType)) {
        console.error(`Invalid change type: ${changeType}. Must be modify, remove, or deprecate.`);
        process.exit(1);
      }

      const analysis = analyzeContractImpact(root, contractId, changeType);

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
        return;
      }

      // Print report
      console.log(formatImpactReport(analysis));

      // Exit non-zero if breaking change detected
      if (analysis.breaking) {
        console.log('  BREAKING CHANGE — user confirmation required before proceeding\n');
        process.exit(2);
      }
    });

  // ─── contract audit ──────────────────────────────────────────
  contract
    .command('audit')
    .description('View contract change audit log')
    .option('--id <id>', 'Filter by contract ID')
    .option('--limit <n>', 'Limit number of entries', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const { readAuditLog } = await import('../../contract/manager.js');
      let entries = readAuditLog(root);

      if (options.id) {
        entries = entries.filter((e: { contract_id: string }) => e.contract_id === options.id);
      }

      const limit = parseInt(options.limit, 10);
      entries = entries.slice(-limit);

      if (options.json) {
        console.log(JSON.stringify({ entries, total: entries.length }, null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log('No audit entries found.');
        return;
      }

      console.log(`\nContract Audit Log (${entries.length} entries):\n`);
      for (const entry of entries) {
        const riskIcon = entry.impact_risk === 'high' ? '[HIGH]' : entry.impact_risk === 'medium' ? '[MED] ' : '[LOW] ';
        console.log(`  ${entry.timestamp}  ${riskIcon} [${entry.action}] ${entry.contract_id}`);
        console.log(`    Actor: ${entry.actor}`);
        console.log(`    ${entry.details}`);
        if (entry.impact_risk) console.log(`    Risk: ${entry.impact_risk}`);
        console.log();
      }
    });

  // ─── contract deprecate ──────────────────────────────────────
  contract
    .command('deprecate <contractId>')
    .description('Deprecate a contract (with impact analysis)')
    .requiredOption('--migration-path <path>', 'Migration path / replacement contract ID')
    .option('--json', 'Output as JSON')
    .action(async (contractId: string, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const { deprecateContract } = await import('../../contract/manager.js');
      const result = deprecateContract(root, contractId, {
        migrationPath: options.migrationPath,
        actor: 'cli-user',
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!result.success) {
        console.error(`\nDeprecation failed: ${result.message}\n`);
        if (result.impact) {
          console.log(result.impact.mitigations.join('\n'));
        }
        process.exit(1);
      }

      console.log(`\nContract ${contractId} deprecated successfully`);
      if (result.impact) {
        console.log(`\n  Risk: ${result.impact.risk}`);
        console.log(`  Mitigations:`);
        for (const m of result.impact.mitigations) {
          console.log(`    - ${m}`);
        }
      }
      console.log();
    });

  // ─── contract remove ─────────────────────────────────────────
  contract
    .command('remove <contractId>')
    .description('Remove a contract (safety check: blocks if upstream consumers exist)')
    .option('--json', 'Output as JSON')
    .action(async (contractId: string, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const { removeContract } = await import('../../contract/manager.js');
      const result = removeContract(root, contractId, {
        actor: 'cli-user',
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (!result.success) {
        console.error(`\nRemoval blocked: ${result.message}\n`);
        if (result.impact) {
          console.log('Upstream consumers that would break:');
          for (const entry of result.impact.upstream_impact) {
            console.log(`  - ${entry.id} (${entry.description})`);
          }
        }
        console.log('\nUse contract deprecate instead, or notify consumers first.\n');
        process.exit(1);
      }

      console.log(`\nContract ${contractId} removed successfully\n`);
    });

  // ─── boundary init ───────────────────────────────────────────
  boundary
    .command('init [dir]')
    .description('Auto-generate BOUNDARY.md from code analysis')
    .option('--dry-run', 'Preview without writing')
    .option('--json', 'Output as JSON')
    .action(async (dir: string | undefined, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('MumuSpec not initialized. Run `mumuspec init` first.');
        process.exit(1);
      }

      const path = await import('node:path');
      const targetDir = dir ? path.resolve(root, dir) : root;

      const { scaffoldBoundary, writeBoundary } = await import('../../contract/manager.js');
      const content = scaffoldBoundary(targetDir);

      if (options.dryRun) {
        if (options.json) {
          console.log(JSON.stringify({ directory: targetDir, content }, null, 2));
        } else {
          console.log(content);
        }
        return;
      }

      const filePath = writeBoundary(targetDir, content);

      if (options.json) {
        console.log(JSON.stringify({ filePath, directory: targetDir }, null, 2));
        return;
      }

      console.log(`\nBOUNDARY.md generated: ${filePath}`);
      console.log('Written to .mumuspec/BOUNDARY.md — review and customize before committing.\n');
    });
}
