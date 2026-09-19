/**
 * Tests for CLI command registration patterns.
 *
 * Verifies that registerXxxCommand functions correctly register
 * their commands onto a commander Command instance.
 *
 * Strategy: Import each register function, pass a fresh Command instance,
 * and verify the command tree structure (names, descriptions, subcommands).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';

import { registerSpecCommands } from '../../src/cli/commands/spec.js';
import { registerChangeCommands } from '../../src/cli/commands/change.js';
import { registerGuardCommand } from '../../src/cli/commands/guard.js';
import { registerStateCommands } from '../../src/cli/commands/state.js';
import { registerKnowledgeCommands } from '../../src/cli/commands/knowledge.js';
import { registerConstraintsCommands } from '../../src/cli/commands/constraints.js';
import { registerFeedbackCommands } from '../../src/cli/commands/feedback.js';
import { registerInstallCommands } from '../../src/cli/commands/install.js';
import { registerFinalizeArchiveCommand } from '../../src/cli/commands/finalize-archive.js';
import { registerHooksCommands } from '../../src/cli/commands/hooks.js';
import { registerDashboardCommands } from '../../src/cli/commands/dashboard.js';
import { registerEvalCommands } from '../../src/cli/commands/eval.js';
import { registerI18nCommands } from '../../src/cli/commands/i18n.js';
import { registerSkillCommands } from '../../src/cli/commands/skill.js';
import { registerBundleCommands } from '../../src/cli/commands/bundle.js';
import { registerEnvCommands } from '../../src/cli/commands/env.js';
import { registerDoctorCommand } from '../../src/cli/commands/doctor.js';
import { registerRecommendCommand } from '../../src/cli/commands/recommend.js';
import { registerDecisionsCommand } from '../../src/cli/commands/decisions.js';
import { registerAdviseCommand } from '../../src/cli/commands/advise.js';
import { registerContractCommands } from '../../src/cli/commands/contract.js';
import { registerLoopCommands } from '../../src/cli/commands/loop.js';
import { registerSyncCommand } from '../../src/cli/commands/sync.js';
import { registerReviewCommand } from '../../src/cli/commands/review.js';

/** Helper: get command by name from a Command instance */
function getCommand(program: Command, name: string): Command | undefined {
  return program.commands.find((c) => c.name() === name);
}

/** Helper: get subcommand by name from a Command instance */
function getSubcommand(parent: Command, name: string): Command | undefined {
  return parent.commands.find((c) => c.name() === name);
}

/** Helper: check if a command has an option with given long flag */
function hasOption(cmd: Command, longFlag: string): boolean {
  return cmd.options.some((o) => o.long === longFlag);
}

// ════════════════════════════════════════════════════════════════════
// Core Spec Commands
// ════════════════════════════════════════════════════════════════════

describe('registerSpecCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSpecCommands(program);
  });

  it('should register "context" command', () => {
    const cmd = getCommand(program, 'context');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('spec context');
  });

  it('should register "add-spec" command', () => {
    const cmd = getCommand(program, 'add-spec');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('specification');
  });

  it('should register "validate" command', () => {
    const cmd = getCommand(program, 'validate');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Validate');
  });

  it('should register "check" command', () => {
    const cmd = getCommand(program, 'check');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('compliance');
  });

  it('should register "drift" command', () => {
    const cmd = getCommand(program, 'drift');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('drift');
  });

  it('should register "search" command', () => {
    const cmd = getCommand(program, 'search');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Search');
  });

  it('should register "sync-specs" command', () => {
    const cmd = getCommand(program, 'sync-specs');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Synchronize');
  });
});

// ════════════════════════════════════════════════════════════════════
// Change Commands
// ════════════════════════════════════════════════════════════════════

describe('registerChangeCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerChangeCommands(program);
  });

  it('should register "new" command', () => {
    const cmd = getCommand(program, 'new');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('change');
  });

  it('should register "status" command', () => {
    const cmd = getCommand(program, 'status');
    expect(cmd).toBeDefined();
  });

  it('should register "list" command', () => {
    const cmd = getCommand(program, 'list');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('changes');
  });

  it('should register "archive" command', () => {
    const cmd = getCommand(program, 'archive');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Archive');
  });

  it('should register "discard" command', () => {
    const cmd = getCommand(program, 'discard');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Guard Command
// ════════════════════════════════════════════════════════════════════

describe('registerGuardCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerGuardCommand(program);
  });

  it('should register "guard" command', () => {
    const cmd = getCommand(program, 'guard');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('guard');
  });

  it('should accept --apply and --confirm and --json flags', () => {
    const cmd = getCommand(program, 'guard')!;
    expect(hasOption(cmd, '--apply')).toBe(true);
    expect(hasOption(cmd, '--confirm')).toBe(true);
    expect(hasOption(cmd, '--json')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// State Machine Commands
// ════════════════════════════════════════════════════════════════════

describe('registerStateCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerStateCommands(program);
  });

  it('should register "state" command', () => {
    const cmd = getCommand(program, 'state');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('State');
  });

  it('should have "state init" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const init = getSubcommand(state, 'init');
    expect(init).toBeDefined();
    expect(init!.description()).toContain('Initialize');
  });

  it('should have "state transition" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const transition = getSubcommand(state, 'transition');
    expect(transition).toBeDefined();
    expect(transition!.description()).toContain('Transition');
  });

  it('should have "state next" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const next = getSubcommand(state, 'next');
    expect(next).toBeDefined();
    expect(next!.description()).toContain('next');
  });

  it('should have "state graph" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const graph = getSubcommand(state, 'graph');
    expect(graph).toBeDefined();
  });

  it('should have "state get" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const get = getSubcommand(state, 'get');
    expect(get).toBeDefined();
  });

  it('should have "state set" subcommand', () => {
    const state = getCommand(program, 'state')!;
    const set = getSubcommand(state, 'set');
    expect(set).toBeDefined();
  });

  it('should have "test-cases" command', () => {
    const cmd = getCommand(program, 'test-cases');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Test case');
  });

  it('should have "test-cases init/lock/verify" subcommands', () => {
    const tc = getCommand(program, 'test-cases')!;
    expect(getSubcommand(tc, 'init')).toBeDefined();
    expect(getSubcommand(tc, 'lock')).toBeDefined();
    expect(getSubcommand(tc, 'verify')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Knowledge Commands
// ════════════════════════════════════════════════════════════════════

describe('registerKnowledgeCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerKnowledgeCommands(program);
  });

  it('should register "knowledge" command', () => {
    const cmd = getCommand(program, 'knowledge');
    expect(cmd).toBeDefined();
  });

  it('should have "knowledge list" subcommand', () => {
    const kw = getCommand(program, 'knowledge')!;
    expect(getSubcommand(kw, 'list')).toBeDefined();
  });

  it('should have "knowledge context" subcommand', () => {
    const kw = getCommand(program, 'knowledge')!;
    expect(getSubcommand(kw, 'context')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Contract Commands
// ════════════════════════════════════════════════════════════════════

describe('registerContractCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should register "contract" command', () => {
    const cmd = getCommand(program, 'contract');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('contract');
  });

  it('should have "contract list/show/register/impact/audit/deprecate/remove" subcommands', () => {
    const ct = getCommand(program, 'contract')!;
    expect(getSubcommand(ct, 'list')).toBeDefined();
    expect(getSubcommand(ct, 'show')).toBeDefined();
    expect(getSubcommand(ct, 'register')).toBeDefined();
    expect(getSubcommand(ct, 'impact')).toBeDefined();
    expect(getSubcommand(ct, 'audit')).toBeDefined();
    expect(getSubcommand(ct, 'deprecate')).toBeDefined();
    expect(getSubcommand(ct, 'remove')).toBeDefined();
  });

  it('should have "contract boundary" subcommand group', () => {
    const ct = getCommand(program, 'contract')!;
    expect(getSubcommand(ct, 'boundary')).toBeDefined();
  });

  it('should have "contract boundary list/check/init" subcommands', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    expect(getSubcommand(boundary, 'list')).toBeDefined();
    expect(getSubcommand(boundary, 'check')).toBeDefined();
    expect(getSubcommand(boundary, 'init')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop Commands
// ════════════════════════════════════════════════════════════════════

describe('registerLoopCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerLoopCommands(program);
  });

  it('should register "loop" command', () => {
    const cmd = getCommand(program, 'loop');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('loop');
  });

  it('should have all expected subcommands', () => {
    const loop = getCommand(program, 'loop')!;
    const expected = ['grill', 'init', 'round', 'action', 'evaluate', 'status', 'resume', 'extend', 'exit', 'merge', 'cleanup', 'info'];
    for (const name of expected) {
      expect(getSubcommand(loop, name), `Missing subcommand: loop ${name}`).toBeDefined();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Hooks Commands
// ════════════════════════════════════════════════════════════════════

describe('registerHooksCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerHooksCommands(program);
  });

  it('should register "hooks" command', () => {
    const cmd = getCommand(program, 'hooks');
    expect(cmd).toBeDefined();
  });

  it('should have "hooks install/uninstall/status/run" subcommands', () => {
    const hooks = getCommand(program, 'hooks')!;
    expect(getSubcommand(hooks, 'install')).toBeDefined();
    expect(getSubcommand(hooks, 'uninstall')).toBeDefined();
    expect(getSubcommand(hooks, 'status')).toBeDefined();
    expect(getSubcommand(hooks, 'run')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Dashboard Commands
// ════════════════════════════════════════════════════════════════════

describe('registerDashboardCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerDashboardCommands(program);
  });

  it('should register "dashboard" command', () => {
    const cmd = getCommand(program, 'dashboard');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Eval Commands
// ════════════════════════════════════════════════════════════════════

describe('registerEvalCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerEvalCommands(program);
  });

  it('should register "eval" command', () => {
    const cmd = getCommand(program, 'eval');
    expect(cmd).toBeDefined();
  });

  it('should have "eval init/list/run" subcommands', () => {
    const evalGroup = getCommand(program, 'eval')!;
    expect(getSubcommand(evalGroup, 'init')).toBeDefined();
    expect(getSubcommand(evalGroup, 'list')).toBeDefined();
    expect(getSubcommand(evalGroup, 'run')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Skill Commands
// ════════════════════════════════════════════════════════════════════

describe('registerSkillCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSkillCommands(program);
  });

  it('should register "skill" command', () => {
    const cmd = getCommand(program, 'skill');
    expect(cmd).toBeDefined();
  });

  it('should have "skill init/validate/scaffold" subcommands', () => {
    const skill = getCommand(program, 'skill')!;
    expect(getSubcommand(skill, 'init')).toBeDefined();
    expect(getSubcommand(skill, 'validate')).toBeDefined();
    expect(getSubcommand(skill, 'scaffold')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Bundle Commands
// ════════════════════════════════════════════════════════════════════

describe('registerBundleCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerBundleCommands(program);
  });

  it('should register "bundle" command', () => {
    const cmd = getCommand(program, 'bundle');
    expect(cmd).toBeDefined();
  });

  it('should have "bundle create/validate/install" subcommands', () => {
    const bundle = getCommand(program, 'bundle')!;
    expect(getSubcommand(bundle, 'create')).toBeDefined();
    expect(getSubcommand(bundle, 'validate')).toBeDefined();
    expect(getSubcommand(bundle, 'install')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Env Commands
// ════════════════════════════════════════════════════════════════════

describe('registerEnvCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerEnvCommands(program);
  });

  it('should register "env" command', () => {
    const cmd = getCommand(program, 'env');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Doctor Command
// ════════════════════════════════════════════════════════════════════

describe('registerDoctorCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerDoctorCommand(program);
  });

  it('should register "doctor" command', () => {
    const cmd = getCommand(program, 'doctor');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('diagnostic');
  });
});

// ════════════════════════════════════════════════════════════════════
// Install Commands
// ════════════════════════════════════════════════════════════════════

describe('registerInstallCommands', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerInstallCommands(program);
  });

  it('should register "install" command', () => {
    const cmd = getCommand(program, 'install');
    expect(cmd).toBeDefined();
  });

  it('should have agent subcommands (catpaw, claude, cursor)', () => {
    const install = getCommand(program, 'install')!;
    const agentNames = install.commands.map((c) => c.name());
    expect(agentNames).toContain('catpaw');
    expect(agentNames).toContain('claude');
    expect(agentNames).toContain('cursor');
    expect(agentNames).toContain('traecode');
    expect(agentNames).toContain('traework');
  });
});

// ════════════════════════════════════════════════════════════════════
// Sync Command
// ════════════════════════════════════════════════════════════════════

describe('registerSyncCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSyncCommand(program);
  });

  it('should register "sync" command', () => {
    const cmd = getCommand(program, 'sync');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('Sync');
  });
});

// ════════════════════════════════════════════════════════════════════
// Review Command
// ════════════════════════════════════════════════════════════════════

describe('registerReviewCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerReviewCommand(program);
  });

  it('should register "review" command', () => {
    const cmd = getCommand(program, 'review');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Finalize-Archive Command
// ════════════════════════════════════════════════════════════════════

describe('registerFinalizeArchiveCommand', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerFinalizeArchiveCommand(program);
  });

  it('should register "finalize-archive" command', () => {
    const cmd = getCommand(program, 'finalize-archive');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Other single-function commands
// ════════════════════════════════════════════════════════════════════

describe('registerConstraintsCommands', () => {
  it('should register "constraints" command', () => {
    const program = new Command();
    registerConstraintsCommands(program);
    const cmd = getCommand(program, 'constraints');
    expect(cmd).toBeDefined();
  });
});

describe('registerFeedbackCommands', () => {
  it('should register "feedback" command', () => {
    const program = new Command();
    registerFeedbackCommands(program);
    const cmd = getCommand(program, 'feedback');
    expect(cmd).toBeDefined();
  });
});

describe('registerI18nCommands', () => {
  it('should register "i18n" command', () => {
    const program = new Command();
    registerI18nCommands(program);
    const cmd = getCommand(program, 'i18n');
    expect(cmd).toBeDefined();
  });

  it('should have "i18n status" subcommand', () => {
    const program = new Command();
    registerI18nCommands(program);
    const i18n = getCommand(program, 'i18n')!;
    expect(getSubcommand(i18n, 'status')).toBeDefined();
  });
});

describe('registerRecommendCommand', () => {
  it('should register "recommend" command', () => {
    const program = new Command();
    registerRecommendCommand(program);
    const cmd = getCommand(program, 'recommend');
    expect(cmd).toBeDefined();
  });
});

describe('registerDecisionsCommand', () => {
  it('should register "decisions" command', () => {
    const program = new Command();
    registerDecisionsCommand(program);
    const cmd = getCommand(program, 'decisions');
    expect(cmd).toBeDefined();
  });
});

describe('registerAdviseCommand', () => {
  it('should register "advise" command', () => {
    const program = new Command();
    registerAdviseCommand(program);
    const cmd = getCommand(program, 'advise');
    expect(cmd).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Command flag verification using options array
// ════════════════════════════════════════════════════════════════════

describe('command-line flag verification', () => {
  it('validate command should have --json and --quiet flags', () => {
    const program = new Command();
    registerSpecCommands(program);
    const validate = getCommand(program, 'validate')!;
    expect(hasOption(validate, '--json')).toBe(true);
    expect(hasOption(validate, '--quiet')).toBe(true);
  });

  it('check command should have --shall --shall-not --ponytail flags', () => {
    const program = new Command();
    registerSpecCommands(program);
    const check = getCommand(program, 'check')!;
    expect(hasOption(check, '--shall')).toBe(true);
    expect(hasOption(check, '--shall-not')).toBe(true);
    expect(hasOption(check, '--ponytail')).toBe(true);
  });

  it('drift command should have --json --fix --dry-run flags', () => {
    const program = new Command();
    registerSpecCommands(program);
    const drift = getCommand(program, 'drift')!;
    expect(hasOption(drift, '--json')).toBe(true);
    expect(hasOption(drift, '--fix')).toBe(true);
    expect(hasOption(drift, '--dry-run')).toBe(true);
  });

  it('contract list should have --category --status --outbound --inbound --json flags', () => {
    const program = new Command();
    registerContractCommands(program);
    const contract = getCommand(program, 'contract')!;
    const list = getSubcommand(contract, 'list')!;
    expect(hasOption(list, '--category')).toBe(true);
    expect(hasOption(list, '--status')).toBe(true);
    expect(hasOption(list, '--outbound')).toBe(true);
    expect(hasOption(list, '--inbound')).toBe(true);
    expect(hasOption(list, '--json')).toBe(true);
  });
});
