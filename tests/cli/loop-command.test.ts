/**
 * Tests for loop command — src/cli/commands/loop.ts
 *
 * Tests the registerLoopCommands function:
 * - Command registration structure
 * - Command flags and options (using .options array)
 * - Command arguments
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerLoopCommands } from '../../src/cli/commands/loop.js';

function getCommand(program: Command, name: string): Command | undefined {
  return program.commands.find((c) => c.name() === name);
}

function getSubcommand(parent: Command, name: string): Command | undefined {
  return parent.commands.find((c) => c.name() === name);
}

function hasOption(cmd: Command, longFlag: string): boolean {
  return cmd.options.some((o) => o.long === longFlag);
}

function getOption(cmd: Command, longFlag: string): ReturnType<Command['options'][number]['find']> | undefined {
  return cmd.options.find((o) => o.long === longFlag);
}

// ════════════════════════════════════════════════════════════════════
// Loop command registration structure
// ════════════════════════════════════════════════════════════════════

describe('loop command registration', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerLoopCommands(program);
  });

  it('should register "loop" top-level command', () => {
    const loop = getCommand(program, 'loop');
    expect(loop).toBeDefined();
    expect(loop!.description()).toContain('loop');
  });

  it('should register "loop grill" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const grill = getSubcommand(loop, 'grill');
    expect(grill).toBeDefined();
    expect(grill!.description()).toContain('grill');
  });

  it('should register "loop init" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init');
    expect(init).toBeDefined();
    expect(init!.description()).toContain('loop mode');
  });

  it('should register "loop round" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const round = getSubcommand(loop, 'round');
    expect(round).toBeDefined();
    expect(round!.description()).toContain('round');
  });

  it('should register "loop action" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action');
    expect(action).toBeDefined();
    expect(action!.description()).toContain('action');
  });

  it('should register "loop evaluate" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate');
    expect(evaluate).toBeDefined();
    expect(evaluate!.description()).toContain('Evaluate');
  });

  it('should register "loop status" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const status = getSubcommand(loop, 'status');
    expect(status).toBeDefined();
    expect(status!.description()).toContain('status');
  });

  it('should register "loop resume" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const resume = getSubcommand(loop, 'resume');
    expect(resume).toBeDefined();
    expect(resume!.description()).toContain('Resume');
  });

  it('should register "loop extend" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const extend = getSubcommand(loop, 'extend');
    expect(extend).toBeDefined();
    expect(extend!.description()).toContain('max rounds');
  });

  it('should register "loop exit" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const exit_ = getSubcommand(loop, 'exit');
    expect(exit_).toBeDefined();
    expect(exit_!.description()).toContain('Exit');
  });

  it('should register "loop merge" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const merge = getSubcommand(loop, 'merge');
    expect(merge).toBeDefined();
    expect(merge!.description()).toContain('Merge');
  });

  it('should register "loop cleanup" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const cleanup = getSubcommand(loop, 'cleanup');
    expect(cleanup).toBeDefined();
    expect(cleanup!.description()).toContain('worktree');
  });

  it('should register "loop info" subcommand', () => {
    const loop = getCommand(program, 'loop')!;
    const info = getSubcommand(loop, 'info');
    expect(info).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop init flags and options
// ════════════════════════════════════════════════════════════════════

describe('loop init flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerLoopCommands(program);
  });

  it('should require --goal option', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    const goalOpt = getOption(init, '--goal');
    expect(goalOpt).toBeDefined();
    expect(goalOpt!.required).toBe(true);
  });

  it('should have --criteria flag', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    expect(hasOption(init, '--criteria')).toBe(true);
  });

  it('should have --rounds flag', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    expect(hasOption(init, '--rounds')).toBe(true);
  });

  it('should have --no-worktree flag (worktree default true)', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    expect(hasOption(init, '--no-worktree')).toBe(true);
  });

  it('should have --no-auto-commit flag (autoCommit default true)', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    expect(hasOption(init, '--no-auto-commit')).toBe(true);
  });

  it('should have --skip-grill flag', () => {
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    expect(hasOption(init, '--skip-grill')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop round arguments
// ════════════════════════════════════════════════════════════════════

describe('loop round argument parsing', () => {
  it('should have <plan> as required argument', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const round = getSubcommand(loop, 'round')!;
    expect(round.registeredArguments.length).toBeGreaterThanOrEqual(1);
    expect(round.registeredArguments[0].name()).toBe('plan');
    expect(round.registeredArguments[0].required).toBe(true);
  });

  it('should have [change] as optional argument', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const round = getSubcommand(loop, 'round')!;
    expect(round.registeredArguments.length).toBe(2);
    expect(round.registeredArguments[1].name()).toBe('change');
    expect(round.registeredArguments[1].required).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop action flags
// ════════════════════════════════════════════════════════════════════

describe('loop action flags', () => {
  it('should have --type flag with default "file_edit"', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action')!;
    const typeOpt = getOption(action, '--type');
    expect(typeOpt).toBeDefined();
    expect(typeOpt!.defaultValue).toBe('file_edit');
  });

  it('should have --target flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action')!;
    expect(hasOption(action, '--target')).toBe(true);
  });

  it('should have --failed flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action')!;
    expect(hasOption(action, '--failed')).toBe(true);
  });

  it('should have --error flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action')!;
    expect(hasOption(action, '--error')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop evaluate flags
// ════════════════════════════════════════════════════════════════════

describe('loop evaluate flags', () => {
  it('should require --progress flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    const progressOpt = getOption(evaluate, '--progress');
    expect(progressOpt).toBeDefined();
    expect(progressOpt!.required).toBe(true);
  });

  it('should have --goal-chieved flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    expect(hasOption(evaluate, '--goal-achieved')).toBe(true);
  });

  it('should have --next-focus flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    expect(hasOption(evaluate, '--next-focus')).toBe(true);
  });

  it('should have --needs-user flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    expect(hasOption(evaluate, '--needs-user')).toBe(true);
  });

  it('should have --block-reason flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    expect(hasOption(evaluate, '--block-reason')).toBe(true);
  });

  it('should have repeatable --issue flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    expect(hasOption(evaluate, '--issue')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop grill flags
// ════════════════════════════════════════════════════════════════════

describe('loop grill flags', () => {
  it('should require --goal flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const grill = getSubcommand(loop, 'grill')!;
    const goalOpt = getOption(grill, '--goal');
    expect(goalOpt).toBeDefined();
    expect(goalOpt!.required).toBe(true);
  });

  it('should have --criteria flag with default []', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const grill = getSubcommand(loop, 'grill')!;
    const criteriaOpt = getOption(grill, '--criteria');
    expect(criteriaOpt).toBeDefined();
    expect(criteriaOpt!.defaultValue).toEqual([]);
  });

  it('should have --rounds flag with default "3"', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const grill = getSubcommand(loop, 'grill')!;
    const roundsOpt = getOption(grill, '--rounds');
    expect(roundsOpt).toBeDefined();
    expect(roundsOpt!.defaultValue).toBe('3');
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop extend validation
// ════════════════════════════════════════════════════════════════════

describe('loop extend argument', () => {
  it('should have <n> as required argument', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const extend = getSubcommand(loop, 'extend')!;
    expect(extend.registeredArguments.length).toBeGreaterThanOrEqual(1);
    expect(extend.registeredArguments[0].name()).toBe('n');
    expect(extend.registeredArguments[0].required).toBe(true);
  });

  it('should have [change] as optional argument', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const extend = getSubcommand(loop, 'extend')!;
    expect(extend.registeredArguments.length).toBe(2);
    expect(extend.registeredArguments[1].name()).toBe('change');
    expect(extend.registeredArguments[1].required).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop exit flags
// ════════════════════════════════════════════════════════════════════

describe('loop exit flags', () => {
  it('should have --reason flag with default "user requested exit"', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const exit_ = getSubcommand(loop, 'exit')!;
    const reasonOpt = getOption(exit_, '--reason');
    expect(reasonOpt).toBeDefined();
    expect(reasonOpt!.defaultValue).toBe('user requested exit');
  });
});

// ════════════════════════════════════════════════════════════════════
// Loop cleanup flags
// ════════════════════════════════════════════════════════════════════

describe('loop cleanup flags', () => {
  it('should have --dry-run flag', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const cleanup = getSubcommand(loop, 'cleanup')!;
    expect(hasOption(cleanup, '--dry-run')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Verify loop command has registered options count
// ════════════════════════════════════════════════════════════════════

describe('loop subcommand option/schema verification', () => {
  it('loop init should declare multiple option schemas', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const init = getSubcommand(loop, 'init')!;
    // declared options count: goal, criteria, rounds, no-worktree, no-auto-commit, skip-grill
    expect(init.options.length).toBeGreaterThanOrEqual(6);
  });

  it('loop action should declare multiple option schemas', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const action = getSubcommand(loop, 'action')!;
    // declared options: type, target, failed, error
    expect(action.options.length).toBeGreaterThanOrEqual(4);
  });

  it('loop evaluate should declare multiple option schemas', () => {
    const program = new Command();
    registerLoopCommands(program);
    const loop = getCommand(program, 'loop')!;
    const evaluate = getSubcommand(loop, 'evaluate')!;
    // declared options: progress, goal-achieved, next-focus, issue, needs-user, block-reason
    expect(evaluate.options.length).toBeGreaterThanOrEqual(6);
  });
});
