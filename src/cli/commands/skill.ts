/**
 * skill command — Skill authoring and management.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import {
  validateSkill,
  listCustomSkills,
  scaffoldSkill,
  generateAuthoringProtocol,
  AUTHORING_PROTOCOL,
} from '../../skill-authoring/protocol.js';
import { resolveCompanions } from '../../install/skill-companions.js';

export function registerSkillCommands(program: Command): void {
  const authoringCmd = program
    .command('skill')
    .description('Skill authoring and management (MumuSpec Skill Protocol)');

  // 伴随能力枚举：把"外部能力是否可用"从模型现场判断改为代码侧探测。
  // 缺失只出现在清单里，不阻断阶段流程（此前 28 个 required 声明可达率为 0，
  // 而强断言恒为空转且降级不留痕）。
  authoringCmd
    .command('companions')
    .description('Enumerate companion capabilities and their availability (missing ones do not block)')
    .option('--json', 'output as JSON')
    .option('--missing', 'only list unresolved companions')
    .action((options) => {
      const resolved = resolveCompanions();
      const rows = options.missing ? resolved.filter((r) => r.resolved === null) : resolved;

      if (options.json) {
        console.log(JSON.stringify({ total: resolved.length, items: rows }, null, 2));
        return;
      }

      const available = resolved.filter((r) => r.resolved !== null).length;
      console.log(`\nCompanion capabilities: ${available}/${resolved.length} available\n`);
      for (const r of rows) {
        const mark = r.resolved ? '✓' : '·';
        console.log(`  ${mark} ${r.name}`);
        console.log(`      ${r.purpose}  [${r.phases.join(', ')}]`);
        if (r.resolved) console.log(`      ${r.resolved}`);
      }
      const missing = resolved.length - available;
      if (missing > 0) {
        console.log(`\n${missing} companion(s) unresolved — 不阻断流程，按各阶段技能的内联步骤执行。`);
      }
    });

  authoringCmd
    .command('init')
    .description('Initialize skill authoring protocol for the project')
    .action(() => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const result = generateAuthoringProtocol(root);
      if (result.created) {
        console.log(`✓ Created: ${result.path}`);
        console.log(`Protocol version: ${AUTHORING_PROTOCOL.version}`);
        console.log(`Subagents: ${AUTHORING_PROTOCOL.subagents.join(', ')}`);
      } else {
        console.log(`Already exists: ${result.path}`);
      }
    });

  authoringCmd
    .command('validate [name]')
    .description('Validate a custom skill (or all skills)')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      if (name) {
        const result = validateSkill(root, name);
        console.log(`\nSkill: ${name}`);
        console.log(`Valid: ${result.valid ? '✓' : '✗'}`);
        for (const err of result.errors) {
          console.error(`  ✗ ${err}`);
        }
        for (const warn of result.warnings) {
          console.log(`  ⚠ ${warn}`);
        }
        if (!result.valid) process.exit(1);
      } else {
        const skills = listCustomSkills(root);
        if (skills.length === 0) {
          console.log('No custom skills found.');
          return;
        }
        console.log(`\n${skills.length} custom skill(s):\n`);
        for (const s of skills) {
          console.log(`  ${s.valid ? '✓' : '✗'} ${s.name}`);
          console.log(`    Path: ${s.path}`);
        }
      }
    });

  authoringCmd
    .command('scaffold <name>')
    .description('Scaffold a new custom skill directory')
    .option('--workspace-path <path>', 'workspace path', '.')
    .option('--type <type>', 'skill type (phase, workflow, analysis, custom)', 'custom')
    .option('--description <desc>', 'skill description')
    .action((name, options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const result = scaffoldSkill(root, name, {
        type: options.type,
        description: options.description,
      });

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`✗ ${err}`);
        }
        process.exit(1);
      }

      console.log(`✓ Scaffolded skill "${name}":`);
      for (const f of result.created) {
        console.log(`  ${f}`);
      }
    });

  authoringCmd.action(() => {
    console.log('Skill authoring and management.\n');
    console.log('Usage:');
    console.log('  mumuspec skill init           Initialize authoring protocol');
    console.log('  mumuspec skill validate [name]  Validate skill(s)');
    console.log('  mumuspec skill scaffold <name>  Create new skill scaffold');
  });
}
