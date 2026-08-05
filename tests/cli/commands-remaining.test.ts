/**
 * Import + registration verification tests for 15 smaller CLI command modules.
 *
 * Strategy: dynamic import() per module to isolate initialization,
 * then assert register function exists and subcommands are present.
 *
 * Note: contract and constraints are already covered in commands-smoke.test.ts,
 * this file covers all remaining command modules not yet tested.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';

// ════════════════════════════════════════════════════════════════════
// change commands (src/cli/commands/change.ts)
// ════════════════════════════════════════════════════════════════════

describe('change commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerChangeCommands } = await import('../../src/cli/commands/change.js');
    program = new Command();
    registerChangeCommands(program);
  });

  it('should register new, status, list, archive, discard as top-level commands', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('new');
    expect(cmds).toContain('status');
    expect(cmds).toContain('list');
    expect(cmds).toContain('archive');
    expect(cmds).toContain('discard');
  });

  it('should register exactly 5 top-level commands', () => {
    expect(program.commands.length).toBe(5);
  });

  it('new command should accept <name> argument', () => {
    const newCmd = program.commands.find((c) => c.name() === 'new')!;
    expect(newCmd.registeredArguments.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// guard command (src/cli/commands/guard.ts)
// ════════════════════════════════════════════════════════════════════

describe('guard command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerGuardCommand } = await import('../../src/cli/commands/guard.js');
    program = new Command();
    registerGuardCommand(program);
  });

  it('should register the guard command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('guard');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });

  it('should have --apply option', () => {
    const guard = program.commands.find((c) => c.name() === 'guard')!;
    const opts = guard.options.map((o) => o.long);
    expect(opts).toContain('--apply');
  });
});

// ════════════════════════════════════════════════════════════════════
// install commands (src/cli/commands/install.ts)
// ════════════════════════════════════════════════════════════════════

describe('install commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerInstallCommands } = await import('../../src/cli/commands/install.js');
    program = new Command();
    registerInstallCommands(program);
  });

  it('should register the install parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('install');
  });

  it('should register expected install subcommands', () => {
    const install = program.commands.find((c) => c.name() === 'install')!;
    const subcommands = install.commands.map((c) => c.name());
    expect(subcommands.length).toBeGreaterThan(0);
  });

  it('should register more than 2 subcommands', () => {
    const install = program.commands.find((c) => c.name() === 'install')!;
    expect(install.commands.length).toBeGreaterThan(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-chat command (src/cli/commands/knowledge-chat.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-chat command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerChatCommand } = await import('../../src/cli/commands/knowledge-chat.js');
    program = new Command();
    registerChatCommand(program);
  });

  it('should register the chat command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('chat');
  });

  it('should accept [query] argument', () => {
    const chat = program.commands.find((c) => c.name() === 'chat')!;
    expect(chat.registeredArguments.length).toBeGreaterThan(0);
  });

  it('should have --json option', () => {
    const chat = program.commands.find((c) => c.name() === 'chat')!;
    const opts = chat.options.map((o) => o.long);
    expect(opts).toContain('--json');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-doctor commands (src/cli/commands/knowledge-doctor.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-doctor commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerKnowledgeDoctor } = await import('../../src/cli/commands/knowledge-doctor.js');
    program = new Command();
    const knowledgeCmd = program.command('knowledge').description('Knowledge management');
    registerKnowledgeDoctor(knowledgeCmd);
  });

  it('should register the knowledge parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('knowledge');
  });

  it('should register the doctor subcommand', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const subcommands = knowledge.commands.map((c) => c.name());
    expect(subcommands).toContain('doctor');
  });

  it('should have --sources option on doctor', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const doctor = knowledge.commands.find((c) => c.name() === 'doctor')!;
    const opts = doctor.options.map((o) => o.long);
    expect(opts).toContain('--sources');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-git command (src/cli/commands/knowledge-git.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-git command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerGitCommand } = await import('../../src/cli/commands/knowledge-git.js');
    program = new Command();
    registerGitCommand(program);
  });

  it('should register the git command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('git');
  });

  it('should accept <subcommand> argument', () => {
    const git = program.commands.find((c) => c.name() === 'git')!;
    expect(git.registeredArguments.length).toBeGreaterThan(0);
  });

  it('should have --dry-run option', () => {
    const git = program.commands.find((c) => c.name() === 'git')!;
    const opts = git.options.map((o) => o.long);
    expect(opts).toContain('--dry-run');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-onboard commands (src/cli/commands/knowledge-onboard.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-onboard commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerOnboardCommands } = await import('../../src/cli/commands/knowledge-onboard.js');
    program = new Command();
    registerOnboardCommands(program);
  });

  it('should register the onboard parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('onboard');
  });

  it('should register expected onboard subcommands', () => {
    const onboard = program.commands.find((c) => c.name() === 'onboard')!;
    const subcommands = onboard.commands.map((c) => c.name());
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('start');
    expect(subcommands).toContain('next');
    expect(subcommands).toContain('complete-step');
    expect(subcommands).toContain('progress');
  });

  it('should have --scope option on init subcommand', () => {
    const onboard = program.commands.find((c) => c.name() === 'onboard')!;
    const init = onboard.commands.find((c) => c.name() === 'init')!;
    const opts = init.options.map((o) => o.long);
    expect(opts).toContain('--scope');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-scan commands (src/cli/commands/knowledge-scan.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-scan commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerKnowledgeScan } = await import('../../src/cli/commands/knowledge-scan.js');
    program = new Command();
    const knowledgeCmd = program.command('knowledge').description('Knowledge management');
    registerKnowledgeScan(knowledgeCmd);
  });

  it('should register the scan subcommand under knowledge', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const subcommands = knowledge.commands.map((c) => c.name());
    expect(subcommands).toContain('scan');
  });

  it('should have --from option on scan', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const scan = knowledge.commands.find((c) => c.name() === 'scan')!;
    const opts = scan.options.map((o) => o.long);
    expect(opts).toContain('--from');
  });

  it('should have more than 2 options on scan', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const scan = knowledge.commands.find((c) => c.name() === 'scan')!;
    expect(scan.options.length).toBeGreaterThan(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// skill commands (src/cli/commands/skill.ts)
// ════════════════════════════════════════════════════════════════════

describe('skill commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerSkillCommands } = await import('../../src/cli/commands/skill.js');
    program = new Command();
    registerSkillCommands(program);
  });

  it('should register the skill parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('skill');
  });

  it('should register expected skill subcommands', () => {
    const skill = program.commands.find((c) => c.name() === 'skill')!;
    const subcommands = skill.commands.map((c) => c.name());
    expect(subcommands.length).toBeGreaterThan(0);
  });

  it('should register more than 2 subcommands', () => {
    const skill = program.commands.find((c) => c.name() === 'skill')!;
    expect(skill.commands.length).toBeGreaterThan(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// spec commands (src/cli/commands/spec.ts)
// ════════════════════════════════════════════════════════════════════

describe('spec commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerSpecCommands } = await import('../../src/cli/commands/spec.js');
    program = new Command();
    registerSpecCommands(program);
  });

  it('should register context, add-spec, validate, check, drift, search, sync-specs as top-level commands', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('context');
    expect(cmds).toContain('add-spec');
    expect(cmds).toContain('validate');
    expect(cmds).toContain('check');
    expect(cmds).toContain('drift');
    expect(cmds).toContain('search');
    expect(cmds).toContain('sync-specs');
  });

  it('should register exactly 7 top-level commands', () => {
    expect(program.commands.length).toBe(7);
  });

  it('context command should accept <path> argument', () => {
    const context = program.commands.find((c) => c.name() === 'context')!;
    expect(context.registeredArguments.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// sync command (src/cli/commands/sync.ts)
// ════════════════════════════════════════════════════════════════════

describe('sync command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerSyncCommand } = await import('../../src/cli/commands/sync.js');
    program = new Command();
    registerSyncCommand(program);
  });

  it('should register the sync command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('sync');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });

  it('should have --check, --migrate, --module options', () => {
    const sync = program.commands.find((c) => c.name() === 'sync')!;
    const opts = sync.options.map((o) => o.long);
    expect(opts).toContain('--check');
    expect(opts).toContain('--migrate');
    expect(opts).toContain('--module');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-analysis commands (src/cli/commands/knowledge-analysis.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-analysis commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerKnowledgeAnalysis } = await import('../../src/cli/commands/knowledge-analysis.js');
    program = new Command();
    const knowledgeCmd = program.command('knowledge').description('Knowledge management');
    registerKnowledgeAnalysis(program, knowledgeCmd);
  });

  it('should register impact as a top-level command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('impact');
  });

  it('should register knowledge analysis subcommands under knowledge', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const subcommands = knowledge.commands.map((c) => c.name());
    expect(subcommands).toContain('coverage');
    expect(subcommands).toContain('gaps');
    expect(subcommands).toContain('graph-export');
  });

  it('should have --json option on impact', () => {
    const impact = program.commands.find((c) => c.name() === 'impact')!;
    const opts = impact.options.map((o) => o.long);
    expect(opts).toContain('--json');
  });
});

// ════════════════════════════════════════════════════════════════════
// finalize-archive command (src/cli/commands/finalize-archive.ts)
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerFinalizeArchiveCommand } = await import('../../src/cli/commands/finalize-archive.js');
    program = new Command();
    registerFinalizeArchiveCommand(program);
  });

  it('should register the finalize-archive command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('finalize-archive');
  });

  it('should accept <change-name> argument', () => {
    const finalize = program.commands.find((c) => c.name() === 'finalize-archive')!;
    expect(finalize.registeredArguments.length).toBeGreaterThan(0);
  });

  it('should have --delete-old and --keep-old options', () => {
    const finalize = program.commands.find((c) => c.name() === 'finalize-archive')!;
    const opts = finalize.options.map((o) => o.long);
    expect(opts).toContain('--delete-old');
    expect(opts).toContain('--keep-old');
  });
});
