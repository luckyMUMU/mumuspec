/**
 * Tests for contract/boundary commands — src/cli/commands/contract.ts
 *
 * Tests the registerContractCommands function:
 * - Command registration structure (contract, boundary groups)
 * - Flag declarations on contract list/show/register/impact/audit/deprecate/remove
 * - Flag declarations on boundary list/check/init
 * - Command-level argument parsing
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerContractCommands } from '../../src/cli/commands/contract.js';

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
// Contract command tree structure
// ════════════════════════════════════════════════════════════════════

describe('contract command tree', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should register "contract" top-level command', () => {
    const cmd = getCommand(program, 'contract');
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain('contract');
  });

  it('should have "contract list" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    expect(getSubcommand(ct, 'list')).toBeDefined();
  });

  it('should have "contract show" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const show = getSubcommand(ct, 'show');
    expect(show).toBeDefined();
    expect(show!.description()).toContain('Show');
  });

  it('should have "contract register" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register');
    expect(register).toBeDefined();
    expect(register!.description()).toContain('Register');
  });

  it('should have "contract impact" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const impact = getSubcommand(ct, 'impact');
    expect(impact).toBeDefined();
    expect(impact!.description()).toContain('impact');
  });

  it('should have "contract audit" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const audit = getSubcommand(ct, 'audit');
    expect(audit).toBeDefined();
  });

  it('should have "contract deprecate" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const deprecate = getSubcommand(ct, 'deprecate');
    expect(deprecate).toBeDefined();
    expect(deprecate!.description()).toContain('Deprecate');
  });

  it('should have "contract remove" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const remove = getSubcommand(ct, 'remove');
    expect(remove).toBeDefined();
    expect(remove!.description()).toContain('Remove');
  });

  it('should have "contract boundary" subcommand group', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary');
    expect(boundary).toBeDefined();
    expect(boundary!.description()).toContain('boundary');
  });

  it('should have "boundary list" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    expect(getSubcommand(boundary, 'list')).toBeDefined();
  });

  it('should have "boundary check" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    expect(getSubcommand(boundary, 'check')).toBeDefined();
  });

  it('should have "boundary init" subcommand', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    expect(getSubcommand(boundary, 'init')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// contract list flags
// ════════════════════════════════════════════════════════════════════

describe('contract list flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --category flag', () => {
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(hasOption(list, '--category')).toBe(true);
  });

  it('should have --status flag', () => {
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(hasOption(list, '--status')).toBe(true);
  });

  it('should have --outbound flag', () => {
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(hasOption(list, '--outbound')).toBe(true);
  });

  it('should have --inbound flag', () => {
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(hasOption(list, '--inbound')).toBe(true);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(hasOption(list, '--json')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// contract show flags
// ════════════════════════════════════════════════════════════════════

describe('contract show flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const show = getSubcommand(ct, 'show')!;
    expect(hasOption(show, '--json')).toBe(true);
  });

  it('should accept <id> argument', () => {
    const ct = getCommand(program, 'contract')!;
    const show = getSubcommand(ct, 'show')!;
    expect(show.registeredArguments.length).toBe(1);
    expect(show.registeredArguments[0].name()).toBe('id');
    expect(show.registeredArguments[0].required).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// contract register flags
// ════════════════════════════════════════════════════════════════════

describe('contract register flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should require --id flag', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const idOpt = getOption(register, '--id');
    expect(idOpt).toBeDefined();
    expect(idOpt!.required).toBe(true);
  });

  it('should require --name flag', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const nameOpt = getOption(register, '--name');
    expect(nameOpt).toBeDefined();
    expect(nameOpt!.required).toBe(true);
  });

  it('should require --category flag', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const categoryOpt = getOption(register, '--category');
    expect(categoryOpt).toBeDefined();
    expect(categoryOpt!.required).toBe(true);
  });

  it('should require --source flag', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const sourceOpt = getOption(register, '--source');
    expect(sourceOpt).toBeDefined();
    expect(sourceOpt!.required).toBe(true);
  });

  it('should have optional --version with default "1.0.0"', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const versionOpt = getOption(register, '--version');
    expect(versionOpt).toBeDefined();
    expect(versionOpt!.defaultValue).toBe('1.0.0');
  });

  it('should have optional --criticality with default "standard"', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const critOpt = getOption(register, '--criticality');
    expect(critOpt).toBeDefined();
    expect(critOpt!.defaultValue).toBe('standard');
  });

  it('should have optional --status with default "active"', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const statusOpt = getOption(register, '--status');
    expect(statusOpt).toBeDefined();
    expect(statusOpt!.defaultValue).toBe('active');
  });

  it('should have --owner flag', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    expect(hasOption(register, '--owner')).toBe(true);
  });

  it('should have --description flag with default ""', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    const descOpt = getOption(register, '--description');
    expect(descOpt).toBeDefined();
    expect(descOpt!.defaultValue).toBe('');
  });

  it('should have --upstream flag (variadic)', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    expect(hasOption(register, '--upstream')).toBe(true);
  });

  it('should have --downstream flag (variadic)', () => {
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    expect(hasOption(register, '--downstream')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// contract impact flags
// ════════════════════════════════════════════════════════════════════

describe('contract impact flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --change-type flag with default "modify"', () => {
    const ct = getCommand(program, 'contract')!;
    const impact = getSubcommand(ct, 'impact')!;
    const ctOpt = getOption(impact, '--change-type');
    expect(ctOpt).toBeDefined();
    expect(ctOpt!.defaultValue).toBe('modify');
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const impact = getSubcommand(ct, 'impact')!;
    expect(hasOption(impact, '--json')).toBe(true);
  });

  it('should accept <contractId> argument', () => {
    const ct = getCommand(program, 'contract')!;
    const impact = getSubcommand(ct, 'impact')!;
    expect(impact.registeredArguments.length).toBe(1);
    expect(impact.registeredArguments[0].name()).toBe('contractId');
    expect(impact.registeredArguments[0].required).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// contract audit flags
// ════════════════════════════════════════════════════════════════════

describe('contract audit flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --id flag', () => {
    const ct = getCommand(program, 'contract')!;
    const audit = getSubcommand(ct, 'audit')!;
    expect(hasOption(audit, '--id')).toBe(true);
  });

  it('should have --limit flag with default "20"', () => {
    const ct = getCommand(program, 'contract')!;
    const audit = getSubcommand(ct, 'audit')!;
    const limitOpt = getOption(audit, '--limit');
    expect(limitOpt).toBeDefined();
    expect(limitOpt!.defaultValue).toBe('20');
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const audit = getSubcommand(ct, 'audit')!;
    expect(hasOption(audit, '--json')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// contract deprecate flags
// ════════════════════════════════════════════════════════════════════

describe('contract deprecate flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should require --migration-path flag', () => {
    const ct = getCommand(program, 'contract')!;
    const deprecate = getSubcommand(ct, 'deprecate')!;
    const mpOpt = getOption(deprecate, '--migration-path');
    expect(mpOpt).toBeDefined();
    expect(mpOpt!.required).toBe(true);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const deprecate = getSubcommand(ct, 'deprecate')!;
    expect(hasOption(deprecate, '--json')).toBe(true);
  });

  it('should accept <contractId> argument', () => {
    const ct = getCommand(program, 'contract')!;
    const deprecate = getSubcommand(ct, 'deprecate')!;
    expect(deprecate.registeredArguments.length).toBe(1);
    expect(deprecate.registeredArguments[0].name()).toBe('contractId');
  });
});

// ════════════════════════════════════════════════════════════════════
// contract remove flags
// ════════════════════════════════════════════════════════════════════

describe('contract remove flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const remove = getSubcommand(ct, 'remove')!;
    expect(hasOption(remove, '--json')).toBe(true);
  });

  it('should accept <contractId> argument', () => {
    const ct = getCommand(program, 'contract')!;
    const remove = getSubcommand(ct, 'remove')!;
    expect(remove.registeredArguments.length).toBe(1);
    expect(remove.registeredArguments[0].name()).toBe('contractId');
  });
});

// ════════════════════════════════════════════════════════════════════
// boundary list flags
// ════════════════════════════════════════════════════════════════════

describe('boundary list flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const list = getSubcommand(boundary, 'list')!;
    expect(hasOption(list, '--json')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// boundary check flags
// ════════════════════════════════════════════════════════════════════

describe('boundary check flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const check = getSubcommand(boundary, 'check')!;
    expect(hasOption(check, '--json')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// boundary init flags
// ════════════════════════════════════════════════════════════════════

describe('boundary init flags', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerContractCommands(program);
  });

  it('should have --dry-run flag', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const init = getSubcommand(boundary, 'init')!;
    expect(hasOption(init, '--dry-run')).toBe(true);
  });

  it('should have --json flag', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const init = getSubcommand(boundary, 'init')!;
    expect(hasOption(init, '--json')).toBe(true);
  });

  it('should accept [dir] as optional argument', () => {
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const init = getSubcommand(boundary, 'init')!;
    expect(init.registeredArguments.length).toBe(1);
    expect(init.registeredArguments[0].name()).toBe('dir');
    expect(init.registeredArguments[0].required).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// Command count verification
// ════════════════════════════════════════════════════════════════════

describe('total contract command structure', () => {
  it('should have all direct subcommands under contract', () => {
    const program = new Command();
    registerContractCommands(program);
    const ct = getCommand(program, 'contract')!;
    const names = ct.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('show');
    expect(names).toContain('register');
    expect(names).toContain('impact');
    expect(names).toContain('audit');
    expect(names).toContain('deprecate');
    expect(names).toContain('remove');
    expect(names).toContain('boundary');
  });

  it('should have exactly 3 subcommands under boundary', () => {
    const program = new Command();
    registerContractCommands(program);
    const ct = getCommand(program, 'contract')!;
    const boundary = getSubcommand(ct, 'boundary')!;
    const names = boundary.commands.map((c) => c.name());
    expect(names).toContain('list');
    expect(names).toContain('check');
    expect(names).toContain('init');
    expect(names.length).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// Option count verification per command
// ════════════════════════════════════════════════════════════════════

describe('contract option count verification', () => {
  it('contract register should have 11+ option schemas', () => {
    const program = new Command();
    registerContractCommands(program);
    const ct = getCommand(program, 'contract')!;
    const register = getSubcommand(ct, 'register')!;
    // id, name, category, source (required), version, criticality, status, owner, description, upstream, downstream
    expect(register.options.length).toBeGreaterThanOrEqual(11);
  });

  it('contract list should have 5 option schemas', () => {
    const program = new Command();
    registerContractCommands(program);
    const ct = getCommand(program, 'contract')!;
    const list = getSubcommand(ct, 'list')!;
    expect(list.options.length).toBeGreaterThanOrEqual(5);
  });

  it('contract audit should have 3 option schemas', () => {
    const program = new Command();
    registerContractCommands(program);
    const ct = getCommand(program, 'contract')!;
    const audit = getSubcommand(ct, 'audit')!;
    expect(audit.options.length).toBeGreaterThanOrEqual(3);
  });
});
