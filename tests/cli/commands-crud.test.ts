/**
 * Import + registration verification tests for 10 smaller CLI command modules.
 *
 * Strategy: dynamic import() per module to isolate initialization,
 * then assert register function exists and subcommands are present.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';

// ════════════════════════════════════════════════════════════════════
// advise command (src/cli/commands/advise.ts)
// ════════════════════════════════════════════════════════════════════

describe('advise command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerAdviseCommand } = await import('../../src/cli/commands/advise.js');
    program = new Command();
    registerAdviseCommand(program);
  });

  it('should register the advise command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('advise');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// dashboard command (src/cli/commands/dashboard.ts)
// ════════════════════════════════════════════════════════════════════

describe('dashboard command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerDashboardCommands } = await import('../../src/cli/commands/dashboard.js');
    program = new Command();
    registerDashboardCommands(program);
  });

  it('should register the dashboard command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('dashboard');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// doctor command (src/cli/commands/doctor.ts)
// ════════════════════════════════════════════════════════════════════

describe('doctor command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerDoctorCommand } = await import('../../src/cli/commands/doctor.js');
    program = new Command();
    registerDoctorCommand(program);
  });

  it('should register the doctor command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('doctor');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// env commands (src/cli/commands/env.ts)
// ════════════════════════════════════════════════════════════════════

describe('env commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerEnvCommands } = await import('../../src/cli/commands/env.js');
    program = new Command();
    registerEnvCommands(program);
  });

  it('should register the env parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('env');
  });

  it('should register expected env subcommands', () => {
    const env = program.commands.find((c) => c.name() === 'env')!;
    const subcommands = env.commands.map((c) => c.name());
    expect(subcommands).toContain('detect');
    expect(subcommands).toContain('validate');
    expect(subcommands).toContain('diff');
  });
});

// ════════════════════════════════════════════════════════════════════
// eval commands (src/cli/commands/eval.ts)
// ════════════════════════════════════════════════════════════════════

describe('eval commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerEvalCommands } = await import('../../src/cli/commands/eval.js');
    program = new Command();
    registerEvalCommands(program);
  });

  it('should register the eval parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('eval');
  });

  it('should register expected eval subcommands', () => {
    const evalCmd = program.commands.find((c) => c.name() === 'eval')!;
    const subcommands = evalCmd.commands.map((c) => c.name());
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('run');
  });
});

// ════════════════════════════════════════════════════════════════════
// feedback commands (src/cli/commands/feedback.ts)
// ════════════════════════════════════════════════════════════════════

describe('feedback commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerFeedbackCommands } = await import('../../src/cli/commands/feedback.js');
    program = new Command();
    registerFeedbackCommands(program);
  });

  it('should register the feedback parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('feedback');
  });

  it('should register expected feedback subcommands', () => {
    const feedback = program.commands.find((c) => c.name() === 'feedback')!;
    const subcommands = feedback.commands.map((c) => c.name());
    expect(subcommands).toContain('submit');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('update-status');
    expect(subcommands).toContain('session-summary');
  });

  it('should register change-feedbacks as a top-level command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('change-feedbacks');
  });
});

// ════════════════════════════════════════════════════════════════════
// hooks commands (src/cli/commands/hooks.ts)
// ════════════════════════════════════════════════════════════════════

describe('hooks commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerHooksCommands } = await import('../../src/cli/commands/hooks.js');
    program = new Command();
    registerHooksCommands(program);
  });

  it('should register the hooks parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('hooks');
  });

  it('should register expected hooks subcommands', () => {
    const hooks = program.commands.find((c) => c.name() === 'hooks')!;
    const subcommands = hooks.commands.map((c) => c.name());
    expect(subcommands).toContain('install');
    expect(subcommands).toContain('uninstall');
    expect(subcommands).toContain('status');
    expect(subcommands).toContain('run');
  });
});

// ════════════════════════════════════════════════════════════════════
// i18n commands (src/cli/commands/i18n.ts)
// ════════════════════════════════════════════════════════════════════

describe('i18n commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerI18nCommands } = await import('../../src/cli/commands/i18n.js');
    program = new Command();
    registerI18nCommands(program);
  });

  it('should register i18n-related commands', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('i18n');
    expect(cmds).toContain('skill-path');
  });

  it('should register the i18n parent command with status subcommand', () => {
    const i18n = program.commands.find((c) => c.name() === 'i18n')!;
    const subcommands = i18n.commands.map((c) => c.name());
    expect(subcommands).toContain('status');
  });
});

// ════════════════════════════════════════════════════════════════════
// recommend command (src/cli/commands/recommend.ts)
// ════════════════════════════════════════════════════════════════════

describe('recommend command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerRecommendCommand } = await import('../../src/cli/commands/recommend.js');
    program = new Command();
    registerRecommendCommand(program);
  });

  it('should register the recommend command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('recommend');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// review command (src/cli/commands/review.ts)
// ════════════════════════════════════════════════════════════════════

describe('review command registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerReviewCommand } = await import('../../src/cli/commands/review.js');
    program = new Command();
    registerReviewCommand(program);
  });

  it('should register the review command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('review');
  });

  it('should have exactly 1 top-level command registered', () => {
    expect(program.commands.length).toBe(1);
  });
});
