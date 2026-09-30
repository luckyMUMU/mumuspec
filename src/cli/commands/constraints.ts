/**
 * constraints command — Dynamic constraint strength and tree-distributed constraints.
 */
import type { Command } from 'commander';
import { join } from 'node:path';
import {
  findProjectRoot,
  getMumuSpecDir,
  appendAuditLog,
  ensureDir,
  readYaml,
  writeYaml,
  now,
} from '../../core/utils.js';
import { buildReusedEntry, planConstraintReuse } from '../../spec/reuse.js';
import type { ConstraintStrength, ConstraintsFile } from '../../core/types-constraint.js';
import {
  loadConfig,
  saveConfig,
  resolveConstraintTree,
  STRENGTH_ACTION_MAP,
  WORKFLOW_RULE_DIMENSION,
  WORKFLOW_STRENGTH_MATRIX,
} from '../../core/config.js';
import { loadAllConstraints, resolveRootStrength } from '../../core/constraints-loader.js';
import { resolveWorkflowRule } from '../../core/constraint-evaluator.js';

const PRESETS: Record<string, { technical_design: 'high' | 'medium' | 'low'; requirement_goals: 'high' | 'medium' | 'low'; description: string }> = {
  strict: { technical_design: 'high', requirement_goals: 'high', description: 'New projects / critical systems (default)' },
  balanced: { technical_design: 'medium', requirement_goals: 'medium', description: 'Mature project regular iterations' },
  hotfix: { technical_design: 'low', requirement_goals: 'high', description: 'Emergency hotfix (keep requirements strict)' },
  exploratory: { technical_design: 'medium', requirement_goals: 'low', description: 'Exploratory prototype' },
  minimal: { technical_design: 'low', requirement_goals: 'low', description: 'Teaching demo / one-off scripts' },
};

export function registerConstraintsCommands(program: Command): void {
  const constraintsCmd = program
    .command('constraints')
    .description('Manage dynamic constraint strength and tree-distributed constraints (0.12.1+)');

  // --- constraints strength ---
  constraintsCmd
    .command('strength')
    .description('View or set constraint strength (TD / RG dimensions)')
    .option('--td <level>', 'technical_design strength: high|medium|low')
    .option('--rg <level>', 'requirement_goals strength: high|medium|low')
    .option('--json', 'output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);

      // If no setters, just print current.
      if (!options.td && !options.rg) {
        const cs = config.constraint_strength;
        if (options.json) {
          console.log(JSON.stringify(cs, null, 2));
          return;
        }
        console.log('\nConstraint Strength:');
        console.log(`  technical_design: ${cs.technical_design}`);
        console.log(`  requirement_goals: ${cs.requirement_goals}`);
        console.log(`\nAction mapping:`);
        console.log(`  high   → ${STRENGTH_ACTION_MAP.high} (block)`);
        console.log(`  medium → ${STRENGTH_ACTION_MAP.medium} (warn)`);
        console.log(`  low    → ${STRENGTH_ACTION_MAP.low} (info)`);
        console.log(`\nExceptions (${cs.exceptions.length}): always block regardless of strength`);
        for (const ex of cs.exceptions) {
          console.log(`  - ${ex}`);
        }
        console.log(`\nWorkflow rules (effective):`);
        const wfRules: Array<'worktree_isolation' | 'single_active_change' | 'top_down_design' | 'tdd_enforced'> = [
          'worktree_isolation',
          'single_active_change',
          'top_down_design',
          'tdd_enforced',
        ];
        for (const rule of wfRules) {
          const effective = resolveWorkflowRule(rule, cs, WORKFLOW_RULE_DIMENSION, WORKFLOW_STRENGTH_MATRIX);
          const dim = WORKFLOW_RULE_DIMENSION[rule];
          const override = cs.overrides?.workflow?.[rule];
          const source = override && override !== 'inherit' ? 'override' : `strength:${dim}`;
          console.log(`  ${rule}: ${effective ? 'enforced' : 'relaxed'} (source: ${source})`);
        }
        return;
      }

      // Validate and apply setters.
      const valid = ['high', 'medium', 'low'];
      if (options.td && !valid.includes(options.td)) {
        console.error(`Error: --td must be one of ${valid.join('|')}, got "${options.td}"`);
        process.exit(1);
      }
      if (options.rg && !valid.includes(options.rg)) {
        console.error(`Error: --rg must be one of ${valid.join('|')}, got "${options.rg}"`);
        process.exit(1);
      }

      if (options.td) config.constraint_strength.technical_design = options.td;
      if (options.rg) config.constraint_strength.requirement_goals = options.rg;
      saveConfig(root, config);
      appendAuditLog(getMumuSpecDir(root), {
        actor: 'user',
        action: 'constraints.strength',
        result: 'success',
        td: config.constraint_strength.technical_design,
        rg: config.constraint_strength.requirement_goals,
      });

      console.log(`\n✓ Constraint strength updated:`);
      console.log(`  technical_design: ${config.constraint_strength.technical_design}`);
      console.log(`  requirement_goals: ${config.constraint_strength.requirement_goals}`);
    });

  // --- constraints preset ---
  constraintsCmd
    .command('preset')
    .description('Apply a named strength preset')
    .argument('<name>', `preset name: ${Object.keys(PRESETS).join(' | ')}`)
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const preset = PRESETS[name];
      if (!preset) {
        console.error(`Error: Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
        process.exit(1);
      }

      const config = loadConfig(root);
      config.constraint_strength.technical_design = preset.technical_design;
      config.constraint_strength.requirement_goals = preset.requirement_goals;
      saveConfig(root, config);
      appendAuditLog(getMumuSpecDir(root), {
        actor: 'user',
        action: 'constraints.preset',
        result: 'success',
        preset: name,
      });

      console.log(`\n✓ Applied preset "${name}": ${preset.description}`);
      console.log(`  technical_design: ${preset.technical_design}`);
      console.log(`  requirement_goals: ${preset.requirement_goals}`);
    });

  // --- constraints list ---
  constraintsCmd
    .command('list')
    .description('List all constraints from .mumuspec/constraints.yaml files')
    .option('--dimension <dim>', 'filter by dimension: td|rg')
    .option('--type <type>', 'filter by type: shall|shall-not')
    .option('--json', 'output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const { files, warnings } = loadAllConstraints(root);
      if (warnings.length > 0) {
        for (const w of warnings) console.warn(`⚠ ${w}`);
      }

      if (files.length === 0) {
        console.log('No constraints.yaml files found. Run `mumuspec constraints init` to create one.');
        return;
      }

      const dimFilter: 'technical_design' | 'requirement_goals' | undefined =
        options.dimension === 'td' ? 'technical_design' :
        options.dimension === 'rg' ? 'requirement_goals' : undefined;

      const typeFilter: 'forward' | 'reverse' | undefined =
        options.type === 'shall' ? 'forward' :
        options.type === 'shall-not' ? 'reverse' : undefined;

      const entries: Array<{ file: string; scope: string; id: string; dimension: string; direction: string; content: string; min_strength: string; inherited?: boolean }> = [];

      for (const file of files) {
        const scope = file.scope ?? '.';
        const dims: Array<'technical_design' | 'requirement_goals'> = ['technical_design', 'requirement_goals'];
        const dirs: Array<'forward' | 'reverse'> = ['forward', 'reverse'];
        for (const dim of dims) {
          if (dimFilter && dim !== dimFilter) continue;
          for (const dir of dirs) {
            if (typeFilter && dir !== typeFilter) continue;
            const list = file[dir]?.[dim] ?? [];
            for (const e of list) {
              entries.push({
                file: scope,
                scope,
                id: e.id,
                dimension: dim === 'technical_design' ? 'TD' : 'RG',
                direction: dir === 'forward' ? 'SHALL' : 'SHALL-NOT',
                content: e.content,
                min_strength: e.min_strength,
                inherited: e.inherited,
              });
            }
          }
        }
      }

      if (options.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      console.log(`\n${entries.length} constraint(s) from ${files.length} file(s):`);
      for (const e of entries) {
        console.log(`  [${e.dimension} ${e.direction}] ${e.id} (min: ${e.min_strength}) @ ${e.scope}`);
        console.log(`    ${e.content}`);
      }
    });

  // --- constraints resolve ---
  constraintsCmd
    .command('resolve')
    .description('Resolve the tree-distributed constraint tree (inheritance + conflicts)')
    .option('--scope <scope>', 'output only the effective constraints at this scope')
    .option('--conflicts-only', 'output only the conflict list')
    .option('--json', 'output as JSON')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);
      const { files, warnings } = loadAllConstraints(root);

      if (files.length === 0) {
        console.log('No constraints.yaml files found. The constraint tree is empty.');
        return;
      }

      const rootStrength = resolveRootStrength(files, {
        technical_design: config.constraint_strength.technical_design,
        requirement_goals: config.constraint_strength.requirement_goals,
      });

      const resolution = resolveConstraintTree(files, rootStrength);

      if (warnings.length > 0 || resolution.warnings.length > 0) {
        for (const w of [...warnings, ...resolution.warnings]) console.warn(`⚠ ${w}`);
      }

      if (options.conflictsOnly) {
        if (options.json) {
          console.log(JSON.stringify(resolution.conflicts, null, 2));
          return;
        }
        if (resolution.conflicts.length === 0) {
          console.log('✓ No conflicts detected.');
        } else {
          console.log(`\n${resolution.conflicts.length} conflict(s):`);
          for (const c of resolution.conflicts) {
            console.log(`  [${c.dimension} ${c.direction}] ${c.id} — ${c.resolution}`);
            console.log(`    winner: @${c.winner.scope} min=${c.winner.min_strength}`);
            for (const loser of c.losers) {
              console.log(`    loser:  @${loser.scope} min=${loser.min_strength}`);
            }
          }
        }
        return;
      }

      if (options.scope) {
        const targetScope = options.scope.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '') || '.';
        let node = resolution.root;
        if (targetScope !== '.') {
          const parts = targetScope.split('/').filter(Boolean);
          for (const p of parts) {
            const child = node.children.get(node.scope === '.' ? p : `${node.scope}/${p}`) ?? node.children.get(p);
            if (!child) {
              console.error(`Error: scope "${targetScope}" not found in constraint tree.`);
              process.exit(1);
            }
            node = child;
          }
        }
        if (options.json) {
          console.log(JSON.stringify({
            scope: node.scope,
            layer: node.layer,
            strength: node.strength,
            forward: node.forward,
            reverse: node.reverse,
          }, null, 2));
          return;
        }
        console.log(`\nScope: ${node.scope} (layer ${node.layer})`);
        console.log(`Strength: TD=${node.strength.technical_design}, RG=${node.strength.requirement_goals}`);
        const printEntries = (label: string, entries: typeof node.forward.technical_design) => {
          if (entries.length === 0) return;
          console.log(`\n${label} (${entries.length}):`);
          for (const e of entries) {
            const inh = e.inherited ? ' [inherited]' : '';
            const tight = e.tightens ? ` [tightens @${e.tightens.scope}]` : '';
            console.log(`  - ${e.id} (min: ${e.min_strength})${inh}${tight}`);
            console.log(`    ${e.content}`);
          }
        };
        printEntries('TD SHALL', node.forward.technical_design);
        printEntries('TD SHALL-NOT', node.reverse.technical_design);
        printEntries('RG SHALL', node.forward.requirement_goals);
        printEntries('RG SHALL-NOT', node.reverse.requirement_goals);
        return;
      }

      // Full tree output.
      if (options.json) {
        console.log(JSON.stringify(resolution, (_key, value) => {
          if (value instanceof Map) {
            return Array.from(value.entries());
          }
          return value;
        }, 2));
        return;
      }

      console.log(`\nConstraint Tree (root: ${resolution.root.scope}, layer ${resolution.root.layer})`);
      console.log(`Root strength: TD=${resolution.root.strength.technical_design}, RG=${resolution.root.strength.requirement_goals}`);

      const printNode = (node: typeof resolution.root, indent: string) => {
        const tdF = node.forward.technical_design.length;
        const tdR = node.reverse.technical_design.length;
        const rgF = node.forward.requirement_goals.length;
        const rgR = node.reverse.requirement_goals.length;
        const total = tdF + tdR + rgF + rgR;
        if (total > 0 || node.scope === '.') {
          console.log(`${indent}${node.scope} (L${node.layer}) TD=${node.strength.technical_design} RG=${node.strength.requirement_goals} [${total} entries]`);
        }
        for (const [, child] of node.children) {
          printNode(child, indent + '  ');
        }
      };
      printNode(resolution.root, '');

      if (resolution.conflicts.length > 0) {
        console.log(`\n${resolution.conflicts.length} conflict(s):`);
        for (const c of resolution.conflicts) {
          console.log(`  [${c.dimension} ${c.direction}] ${c.id} — ${c.resolution}`);
        }
      } else {
        console.log('\n✓ No conflicts detected.');
      }
    });

  // --- constraints reuse ---
  constraintsCmd
    .command('reuse')
    .description('复用既有约束条目：继承上游来源，只可收紧不可放宽')
    .requiredOption('--id <id>', 'source entry id')
    .option('--from <scope>', 'source scope (default: search every loaded scope)')
    .option('--to <scope>', 'target scope', '.')
    .option('--tighten <strength>', 'raise min_strength: low|medium|high')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const { files } = loadAllConstraints(root);
      const plan = planConstraintReuse(files, {
        id: options.id,
        fromScope: options.from,
        tighten: options.tighten as ConstraintStrength | undefined,
      });

      if (!plan.ok) {
        console.error(`✗ [${plan.refusal.code}] ${plan.refusal.detail}`);
        if (plan.available && plan.available.length > 0) {
          console.error(`  可选项: ${plan.available.join(', ')}`);
        }
        process.exit(1);
      }

      const targetScope = options.to as string;
      const targetDir = join(root, targetScope, '.mumuspec');
      ensureDir(targetDir);
      const targetPath = join(targetDir, 'constraints.yaml');
      const existing: ConstraintsFile = readYaml<ConstraintsFile>(targetPath) ?? {
        version: '0.2.0',
        last_updated: now().split('T')[0],
        scope: targetScope,
        forward: {},
        reverse: {},
      };

      const reused = buildReusedEntry(plan, {
        layer: existing.layer ?? (targetScope === '.' ? 0 : targetScope.split(/[\\/]+/).length),
        scope: targetScope,
      });

      const direction = plan.located.direction;
      const dimension = plan.located.dimension;
      const section = existing[direction] ?? {};
      const list = section[dimension] ?? [];
      if (list.some((entry) => entry.id === reused.id)) {
        console.error(`✗ 目标范围已存在同名复用条目: ${reused.id}`);
        process.exit(1);
      }
      list.push(reused);
      section[dimension] = list;
      existing[direction] = section;
      existing.last_updated = now().split('T')[0];
      writeYaml(targetPath, existing);

      appendAuditLog(getMumuSpecDir(root), {
        actor: 'cli',
        action: 'constraints.reuse',
        change: targetScope,
        from: `${plan.located.scope}#${plan.located.entry.id}`,
        to: reused.id,
        result: 'success',
      });

      console.log(
        `✓ 已复用到 ${targetScope}: ${reused.id}` +
          `（来源 ${plan.located.scope}#${plan.located.entry.id}，` +
          `min_strength=${reused.min_strength}，上游 ${reused.source_specs?.join(', ')}）`,
      );
    });
}
