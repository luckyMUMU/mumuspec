/**
 * team commands — Multi-role collaborative orchestration (Team-Core)
 *
 * Implements the team-orchestration build mode: a lead agent spawns N parallel
 * member instances, an evaluator scores outputs, and iterations continue
 * until a quality bar is met.
 *
 * Usage:
 *   mumuspec team init <name> --config <path>   # Initialize team mode
 *   mumuspec team clarify <name> --request "..." # Run lead clarification
 *   mumuspec team run <name> --brief "..."       # Run one propose→evaluate round
 *   mumuspec team status <name>                  # View team status
 *   mumuspec team confirm <name> --select <id>   # Confirm final selection
 */

import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState, saveChangeState } from '../../change/manager.js';
import { TeamEngine, MockRuntimeAdapter } from '../../team/index.js';
import { loadTeamConfig, validateTeamConfig, buildDefaultTeamConfig, saveTeamConfig } from '../../team/config.js';
import type { TeamConfig, TeamState } from '../../core/types-team.js';

/** Format phase label with descriptive text. */
function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending (待初始化)',
    clarify: 'Clarify (需求澄清中)',
    propose: 'Propose (并行提案中)',
    evaluate: 'Evaluate (评估打分中)',
    iterate: 'Iterate (迭代反馈中)',
    converged: '✓ Converged (已收敛)',
    exhausted: '⏹ Exhausted (轮次耗尽)',
    blocked: '⛔ Blocked (阻塞中)',
  };
  return labels[phase] || phase;
}

/** Resolve team config path from options or default location. */
function resolveTeamConfigPath(_projectRoot: string, changeName: string, options: { config?: string }): string {
  if (options.config) {
    return options.config;
  }
  // Default: .mumuspec/team/<changeName>.yaml
  return `.mumuspec/team/${changeName}.yaml`;
}

/** Build or retrieve the TeamEngine for a change. */
function getTeamEngine(projectRoot: string, changeName: string): { engine: TeamEngine; state: TeamState; config: TeamConfig } {
  const changeState = loadChangeState(projectRoot, changeName);
  if (!changeState) {
    throw new Error(`Change not found: ${changeName}`);
  }

  const teamState = changeState.team_state;
  if (!teamState?.config) {
    throw new Error(`Team mode not initialized for "${changeName}". Run 'mumuspec team init ${changeName}' first.`);
  }

  // Use MockRuntimeAdapter as default; real adapter injected via skill layer
  const adapter = new MockRuntimeAdapter();
  const engine = new TeamEngine(adapter, teamState);

  return { engine, state: teamState, config: teamState.config };
}

export function registerTeamCommands(program: Command): void {
  const teamCmd = program.command('team').description('Multi-role collaborative orchestration (Team mode)');

  // ── init ──
  teamCmd
    .command('init')
    .description('Initialize team orchestration mode for a change')
    .argument('<name>', 'change name')
    .option('--config <path>', 'team config YAML path (default: .mumuspec/team/<name>.yaml)')
    .option('--lead <agent>', 'override lead agent identifier')
    .option('--min-score <n>', 'override minimum passing score (0-100)')
    .option('--generate-config', 'generate a default team config scaffold')
    .option('--max-rounds <n>', 'override max iteration rounds', '5')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const changeState = loadChangeState(root, name);
        if (!changeState) {
          console.error(`Error: Change not found: ${name}`);
          process.exit(1);
        }

        if (changeState.team_state?.enabled) {
          console.error(`Error: Team mode already initialized for "${name}".`);
          process.exit(1);
        }

        let configPath = resolveTeamConfigPath(root, name, options);
        let config: TeamConfig | undefined;

        if (options.generateConfig) {
          // Generate a default config scaffold
          const defaultConfig = buildDefaultTeamConfig(
            options.lead ?? 'team-lead',
            `Team config for change: ${name}`,
          );
          // Apply CLI overrides
          if (options.minScore) {
            defaultConfig.evaluator.min_score = parseInt(options.minScore, 10);
          }
          if (options.maxRounds) {
            defaultConfig.iteration.max_rounds = parseInt(options.maxRounds, 10);
          }
          saveTeamConfig(root, name, defaultConfig);
          config = defaultConfig;
          console.log(`✓ Generated team config: ${configPath}`);
        } else {
          // Load existing config
          config = loadTeamConfig(root, name);
          if (!config) {
            console.error(`Error: Team config not found at ${configPath}`);
            console.error('Use --generate-config to create a scaffold, or provide --config <path>.');
            process.exit(1);
          }
        }

        // Validate config
        const validation = validateTeamConfig(config);
        if (!validation.valid) {
          console.error('Error: Invalid team config:');
          for (const err of validation.errors) {
            console.error(`  - ${err}`);
          }
          process.exit(1);
        }
        if (validation.warnings.length > 0) {
          console.log('Config warnings:');
          for (const warn of validation.warnings) {
            console.log(`  ⚠ ${warn}`);
          }
        }

        // Apply CLI overrides
        if (options.lead) config.lead = options.lead;
        if (options.minScore) config.evaluator.min_score = parseInt(options.minScore, 10);
        if (options.maxRounds) config.iteration.max_rounds = parseInt(options.maxRounds, 10);

        // Initialize state
        const teamState: TeamState = {
          enabled: true,
          config_path: configPath,
          config,
          phase: 'clarify',
          current_round: 0,
          rounds: [],
          proposal_refs: {},
          best_score: 0,
          best_round: 0,
        };

        // Save to change state
        changeState.team_state = teamState;
        changeState.build_mode = 'team-orchestration';
        saveChangeState(root, name, changeState);

        const memberCount = config.members.reduce((sum, m) => sum + m.instances, 0);
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  Team Mode Initialized                                  ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`  Lead:       ${config.lead}`);
        console.log(`  Members:    ${config.members.length} roles × ${memberCount} instances`);
        console.log(`  Evaluator:  ${config.evaluator.role}`);
        console.log(`  Min Score:  ${config.evaluator.min_score}`);
        console.log(`  Max Rounds: ${config.iteration.max_rounds}`);
        console.log(`  Config:     ${configPath}`);
        console.log('');
        console.log('Next: mumuspec team clarify --request "<your request>"');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── clarify ──
  teamCmd
    .command('clarify')
    .description('Run lead agent to clarify requirements and produce a task brief')
    .argument('[change]', 'change name (optional, uses active change)')
    .requiredOption('--request <text>', 'initial request / task description')
    .action(async (change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const { engine } = getTeamEngine(root, changeName);
        const result = await engine.clarify(options.request);

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  Clarification Result                                   ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Brief:');
        console.log(`  ${result.brief}`);
        console.log('');

        if (result.scoring_notes) {
          console.log('Scoring Notes:');
          console.log(`  ${result.scoring_notes}`);
          console.log('');
        }

        if (!result.clarification_complete && result.pending_questions?.length) {
          console.log('Pending Questions:');
          for (const q of result.pending_questions) {
            console.log(`  ? ${q}`);
          }
          console.log('');
        } else {
          console.log('✓ Clarification complete. Ready for propose phase.');
          console.log('');
          console.log('Next: mumuspec team run --brief "<brief text>"');
        }

        // Persist state back
        const changeState2 = loadChangeState(root, changeName)!;
        changeState2.team_state = engine.getState();
        saveChangeState(root, changeName, changeState2);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── run ──
  teamCmd
    .command('run')
    .description('Run one propose→evaluate round')
    .argument('[change]', 'change name (optional, uses active change)')
    .requiredOption('--brief <text>', 'task brief to distribute to member instances')
    .action(async (change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const { engine, config } = getTeamEngine(root, changeName);

        if (!engine.canContinue()) {
          const summary = engine.getStatusSummary(changeName);
          console.error(`Error: Team cannot continue (phase=${summary.phase}, round=${summary.currentRound}/${summary.maxRounds})`);
          process.exit(1);
        }

        const round = await engine.runRound(options.brief);
        const summary = engine.getStatusSummary(changeName);

        console.log('');
        console.log(`  ┌──────────────────────────────────────────────────────────┐`);
        console.log(`  │  Round ${round.round} Complete${' '.repeat(39)}│`);
        console.log(`  └──────────────────────────────────────────────────────────┘`);

        // Member results
        console.log(`\n  Members (${round.member_results.length}):`);
        for (const r of round.member_results) {
          const status = r.completed ? '✓' : '✗';
          const orientStr = r.orientation !== 'default' ? ` [${r.orientation}]` : '';
          console.log(`    ${status} ${r.instance_id}${orientStr}`);
          if (r.error) console.log(`      Error: ${r.error}`);
        }

        // Evaluation
        if (round.evaluation) {
          const ev = round.evaluation;
          console.log(`\n  Evaluation:`);
          console.log(`    Best:    ${ev.best_instance_id} → ${ev.best_score}/100`);
          console.log(`    Bar Met: ${ev.bar_met ? '✓ Yes' : '✗ No'} (threshold: ${config.evaluator.min_score})`);
          console.log(`    Ranking:`);

          for (const id of ev.ranking.slice(0, 5)) {
            const score = ev.scores[id];
            const indicator = score?.passed ? '✓' : '✗';
            console.log(`      ${indicator} ${id}: ${score?.total ?? '?'}/100`);
          }

          // Feedback summary
          const feedbackCount = Object.keys(ev.feedback).length;
          if (feedbackCount > 0) {
            console.log(`\n  Improvement Feedback (${feedbackCount} instances):`);
            for (const [id, fb] of Object.entries(ev.feedback).slice(0, 3)) {
              console.log(`    → ${id}: ${fb.substring(0, 60)}${fb.length > 60 ? '...' : ''}`);
            }
          }
        }

        // Phase transition guidance
        console.log('');
        if (summary.phase === 'converged') {
          console.log('  ──────────────────────────────────────');
          console.log('  ✓ Quality bar met! Team converged.');
          console.log(`  Next: mumuspec team confirm --select <instance_id>`);
        } else if (summary.phase === 'exhausted') {
          console.log('  ──────────────────────────────────────');
          console.log('  ⏹ Max rounds reached without convergence.');
          console.log(`  Best score: ${summary.bestScore}/100 (Round ${summary.bestRound})`);
          console.log('  Next: mumuspec team confirm --select <instance_id>  (accept best so far)');
        } else if (summary.canContinue) {
          console.log('  ──────────────────────────────────────');
          console.log(`  Below bar. Ready for round ${summary.currentRound + 1}.`);
          console.log('  Next: mumuspec team run --brief "<refined brief>"');
        }
        console.log('');

        // Persist state back
        const changeState3 = loadChangeState(root, changeName)!;
        changeState3.team_state = engine.getState();
        saveChangeState(root, changeName, changeState3);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── status ──
  teamCmd
    .command('status')
    .description('View team orchestration status and progress')
    .argument('[change]', 'change name (optional, uses active change)')
    .action((change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const { engine } = getTeamEngine(root, changeName);
        const summary = engine.getStatusSummary(changeName);
        const config = engine.getState().config;

        const progressBar = (p: number) => {
          const filled = Math.round(p * 20);
          return '█'.repeat(filled) + '░'.repeat(20 - filled);
        };

        console.log('');
        console.log('  ╔══════════════════════════════════════════════════════════╗');
        console.log(`  ║  Team: ${changeName.padEnd(49)}║`);
        console.log('  ╚══════════════════════════════════════════════════════════╝');
        console.log(`  Phase:     ${phaseLabel(summary.phase)}`);
        console.log(`  Round:     ${summary.currentRound} / ${summary.maxRounds}`);
        console.log(`  Members:   ${summary.memberCount} instances`);
        console.log(`  Best:      ${summary.bestScore}/100 (Round ${summary.bestRound})`);

        // Per-round history if available
        const rounds = engine.getState().rounds;
        if (rounds.length > 0) {
          console.log('');
          console.log('  Round History:');
          for (const r of rounds) {
            const best = r.evaluation?.best_score ?? 0;
            const bar = progressBar(best / 100);
            const indicator = r.evaluation?.bar_met ? '✓' : '✗';
            console.log(`    ${indicator} Round ${r.round}: ${bar} ${best}/100`);
          }
        }

        // Config summary
        if (config) {
          console.log('');
          console.log(`  Evaluator: ${config.evaluator.role} (min: ${config.evaluator.min_score})`);
          console.log('  Dimensions:');
          for (const d of config.evaluator.dimensions) {
            console.log(`    - ${d.name}: ${d.weight}${d.description ? ` (${d.description})` : ''}`);
          }
        }

        // Event log (last 5)
        const events = engine.getEventLog();
        if (events.length > 0) {
          console.log('');
          console.log('  Recent Events:');
          for (const ev of events.slice(-5)) {
            console.log(`    [${ev.phase}] ${ev.event}: ${ev.detail}`);
          }
        }
        console.log('');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── confirm ──
  teamCmd
    .command('confirm')
    .description('Confirm final selection and exit team mode')
    .argument('[change]', 'change name (optional, uses active change)')
    .requiredOption('--select <instance_id>', 'instance identifier to select as final')
    .action((change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const { engine } = getTeamEngine(root, changeName);
        engine.confirmSelection(options.select);

        // Persist state
        const changeState4 = loadChangeState(root, changeName)!;
        changeState4.team_state = engine.getState();
        saveChangeState(root, changeName, changeState4);

        console.log(`✓ Selection confirmed: ${options.select}`);
        console.log('  Team mode complete. Proceed with implementation.');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── scaffold ──
  teamCmd
    .command('scaffold')
    .description('Generate a team config YAML scaffold')
    .argument('<name>', 'change name (used for config filename)')
    .option('--lead <agent>', 'lead agent identifier', 'team-lead')
    .option('--members <n>', 'number of member instances', '3')
    .option('--min-score <n>', 'minimum passing score', '80')
    .option('--max-rounds <n>', 'max iteration rounds', '5')
    .option('--output <path>', 'output path (default: .mumuspec/team/<name>.yaml)')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const config = buildDefaultTeamConfig(options.lead, `Team config for: ${name}`);
        config.members[0].instances = parseInt(options.members, 10);
        config.evaluator.min_score = parseInt(options.minScore, 10);
        config.iteration.max_rounds = parseInt(options.maxRounds, 10);

        const outputPath = options.output || `.mumuspec/team/${name}.yaml`;
        saveTeamConfig(root, name, config);

        console.log(`✓ Team config scaffolded: ${outputPath}`);
        console.log(`  Members: ${options.members} instances, Lead: ${options.lead}`);
        console.log('');
        console.log('Customize the config, then run:');
        console.log(`  mumuspec team init ${name}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── info (help) ──
  teamCmd
    .command('info')
    .description('Show team orchestration help and workflow overview')
    .action(() => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Team Orchestration — Multi-Role Collaborative Mode    ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Pattern: Clarify → Propose (parallel) → Evaluate → Iterate');
      console.log('');
      console.log('A lead agent clarifies requirements, then spawns N parallel');
      console.log('member instances. An evaluator scores proposals; iterations');
      console.log('continue until the quality bar is met.');
      console.log('');
      console.log('Workflow:');
      console.log('  1. Scaffold:  mumuspec team scaffold <name>');
      console.log('  2. Initialize: mumuspec team init <name> [--generate-config]');
      console.log('  3. Clarify:   mumuspec team clarify --request "..."');
      console.log('  4. Run round:  mumuspec team run --brief "..."');
      console.log('  5. Check:      mumuspec team status');
      console.log('  6. Confirm:    mumuspec team confirm --select <id>');
      console.log('');
      console.log('Config: .mumuspec/team/<name>.yaml');
      console.log('');
    });
}
