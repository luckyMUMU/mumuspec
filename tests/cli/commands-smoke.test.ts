/**
 * Smoke tests — verify the 5 largest CLI command modules can be imported
 * and register their subcommands without errors.
 *
 * Strategy: dynamic import() per module to isolate initialization,
 * then assert register function exists and subcommands are present.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';

// ════════════════════════════════════════════════════════════════════
// loop commands (src/cli/commands/loop.ts)
// ════════════════════════════════════════════════════════════════════

describe('loop commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerLoopCommands } = await import('../../src/cli/commands/loop.js');
    program = new Command();
    registerLoopCommands(program);
  });

  it('should register the loop parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('loop');
  });

  it('should register expected loop subcommands', () => {
    const loop = program.commands.find((c) => c.name() === 'loop')!;
    const subcommands = loop.commands.map((c) => c.name());
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('round');
    expect(subcommands).toContain('action');
    expect(subcommands).toContain('evaluate');
    expect(subcommands).toContain('status');
    expect(subcommands).toContain('resume');
    expect(subcommands).toContain('extend');
    expect(subcommands).toContain('exit');
    expect(subcommands).toContain('merge');
    expect(subcommands).toContain('cleanup');
    expect(subcommands).toContain('grill');
  });
});

// ════════════════════════════════════════════════════════════════════
// contract commands (src/cli/commands/contract.ts)
// ════════════════════════════════════════════════════════════════════

describe('contract commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerContractCommands } = await import('../../src/cli/commands/contract.js');
    program = new Command();
    registerContractCommands(program);
  });

  it('should register the contract parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('contract');
  });

  it('should register expected contract subcommands', () => {
    const contract = program.commands.find((c) => c.name() === 'contract')!;
    const subcommands = contract.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('register');
    expect(subcommands).toContain('boundary');
    expect(subcommands).toContain('impact');
    expect(subcommands).toContain('audit');
    expect(subcommands).toContain('deprecate');
    expect(subcommands).toContain('remove');
  });

  it('should register boundary sub-subcommands', () => {
    const contract = program.commands.find((c) => c.name() === 'contract')!;
    const boundary = contract.commands.find((c) => c.name() === 'boundary')!;
    const subs = boundary.commands.map((c) => c.name());
    expect(subs).toContain('list');
    expect(subs).toContain('check');
  });
});

// ════════════════════════════════════════════════════════════════════
// constraints commands (src/cli/commands/constraints.ts)
// ════════════════════════════════════════════════════════════════════

describe('constraints commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerConstraintsCommands } = await import('../../src/cli/commands/constraints.js');
    program = new Command();
    registerConstraintsCommands(program);
  });

  it('should register the constraints parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('constraints');
  });

  it('should register expected constraints subcommands', () => {
    const constraints = program.commands.find((c) => c.name() === 'constraints')!;
    const subcommands = constraints.commands.map((c) => c.name());
    expect(subcommands).toContain('strength');
    expect(subcommands).toContain('preset');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('resolve');
  });
});

// ════════════════════════════════════════════════════════════════════
// knowledge-crud commands (src/cli/commands/knowledge-crud.ts)
// ════════════════════════════════════════════════════════════════════

describe('knowledge-crud commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerKnowledgeCrud } = await import('../../src/cli/commands/knowledge-crud.js');
    // registerKnowledgeCrud takes a parent Command (like 'knowledge') and adds CRUD subcommands
    program = new Command();
    const knowledgeCmd = program.command('knowledge').description('Knowledge management');
    registerKnowledgeCrud(knowledgeCmd);
  });

  it('should register the knowledge parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('knowledge');
  });

  it('should register expected knowledge CRUD subcommands', () => {
    const knowledge = program.commands.find((c) => c.name() === 'knowledge')!;
    const subcommands = knowledge.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('search');
    expect(subcommands).toContain('context');
    expect(subcommands).toContain('verify');
    expect(subcommands).toContain('stale');
    expect(subcommands).toContain('supersede');
    expect(subcommands).toContain('organize');
    expect(subcommands).toContain('rebuild-index');
  });
});

// ════════════════════════════════════════════════════════════════════
// state commands (src/cli/commands/state.ts)
// ════════════════════════════════════════════════════════════════════

describe('state commands registration', () => {
  let program: Command;

  beforeEach(async () => {
    const { registerStateCommands } = await import('../../src/cli/commands/state.js');
    program = new Command();
    registerStateCommands(program);
  });

  it('should register the state parent command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('state');
  });

  it('should register expected state subcommands', () => {
    const state = program.commands.find((c) => c.name() === 'state')!;
    const subcommands = state.commands.map((c) => c.name());
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('transition');
    expect(subcommands).toContain('next');
    expect(subcommands).toContain('graph');
    expect(subcommands).toContain('get');
    expect(subcommands).toContain('set');
    expect(subcommands).toContain('scale');
  });

  it('should also register test-cases as a top-level command', () => {
    const cmds = program.commands.map((c) => c.name());
    expect(cmds).toContain('test-cases');
  });

  it('should register test-cases subcommands', () => {
    const testCases = program.commands.find((c) => c.name() === 'test-cases')!;
    const subcommands = testCases.commands.map((c) => c.name());
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('lock');
    expect(subcommands).toContain('verify');
  });
});
