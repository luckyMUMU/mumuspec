/**
 * Handler-level tests for the skill command (init, validate, scaffold subcommands).
 *
 * Strategy: mock lower-level modules (core/utils, skill-authoring/protocol),
 * register the skill command on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockValidateSkill,
  mockListCustomSkills,
  mockScaffoldSkill,
  mockGenerateAuthoringProtocol,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockValidateSkill: vi.fn(),
  mockListCustomSkills: vi.fn(),
  mockScaffoldSkill: vi.fn(),
  mockGenerateAuthoringProtocol: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/skill-authoring/protocol.js', () => ({
  validateSkill: mockValidateSkill,
  listCustomSkills: mockListCustomSkills,
  scaffoldSkill: mockScaffoldSkill,
  generateAuthoringProtocol: mockGenerateAuthoringProtocol,
  AUTHORING_PROTOCOL: {
    version: '0.12.2',
    schema: 'mumuspec-skill-v1',
    subagents: ['skill-core-author', 'reference-author', 'workflow-entry-author', 'skill-reviewer'],
    templates: ['phase-skill', 'analysis-skill', 'custom-workflow'],
  },
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('skill command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockValidateSkill.mockReset();
    mockListCustomSkills.mockReset();
    mockScaffoldSkill.mockReset();
    mockGenerateAuthoringProtocol.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project (init)', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
    const program = new Command();
    registerSkillCommands(program);

    await program.parseAsync(['skill', 'init'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── skill init ──

  describe('skill init handler', () => {
    it('should print creation message when protocol file is created', async () => {
      mockGenerateAuthoringProtocol.mockReturnValue({
        path: '/fake/root/.mumuspec/skill-authoring/protocol.yaml',
        created: true,
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'init'], { from: 'user' });

      expect(mockGenerateAuthoringProtocol).toHaveBeenCalledWith('/fake/root');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created: /fake/root/.mumuspec/skill-authoring/protocol.yaml')
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Protocol version: 0.12.2'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Subagents:'));
    });

    it('should print "Already exists" when protocol file exists', async () => {
      mockGenerateAuthoringProtocol.mockReturnValue({
        path: '/fake/root/.mumuspec/skill-authoring/protocol.yaml',
        created: false,
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'init'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already exists: /fake/root/.mumuspec/skill-authoring/protocol.yaml')
      );
    });
  });

  // ── skill validate ──

  describe('skill validate handler', () => {
    it('should validate a specific skill by name and print success', async () => {
      mockValidateSkill.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['SKILL.md should start with a title'],
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'validate', 'my-skill'], { from: 'user' });

      expect(mockValidateSkill).toHaveBeenCalledWith('/fake/root', 'my-skill');
      expect(logSpy).toHaveBeenCalledWith('\nSkill: my-skill');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Valid:'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
      expect(logSpy).toHaveBeenCalledWith('  ⚠ SKILL.md should start with a title');
    });

    it('should print errors and exit(1) for invalid skill', async () => {
      mockValidateSkill.mockReturnValue({
        valid: false,
        errors: ['Missing SKILL.md'],
        warnings: [],
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'validate', 'bad-skill'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('  ✗ Missing SKILL.md');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should validate all custom skills when no name given', async () => {
      mockListCustomSkills.mockReturnValue([
        { name: 'skill-a', path: '/fake/root/.mumuspec/skills/skill-a', valid: true },
        { name: 'skill-b', path: '/fake/root/.mumuspec/skills/skill-b', valid: false },
      ]);

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'validate'], { from: 'user' });

      expect(mockListCustomSkills).toHaveBeenCalledWith('/fake/root');
      expect(logSpy).toHaveBeenCalledWith('\n2 custom skill(s):\n');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ skill-a'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✗ skill-b'));
    });

    it('should print "No custom skills found" when list is empty', async () => {
      mockListCustomSkills.mockReturnValue([]);

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'validate'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No custom skills found.');
    });

    it('should exit(1) when not in a MumuSpec project (validate)', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'validate'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── skill scaffold ──

  describe('skill scaffold handler', () => {
    it('should scaffold a skill with default type', async () => {
      mockFindProjectRoot.mockReturnValueOnce('/fake/root');
      mockScaffoldSkill.mockReturnValue({
        created: [
          '/fake/root/.mumuspec/skills/new-skill',
          '/fake/root/.mumuspec/skills/new-skill/SKILL.md',
        ],
        errors: [],
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'scaffold', 'new-skill'], { from: 'user' });

      expect(mockScaffoldSkill).toHaveBeenCalledWith('/fake/root', 'new-skill', { type: 'custom', description: undefined });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Scaffolded skill "new-skill"'));
      expect(logSpy).toHaveBeenCalledWith('  /fake/root/.mumuspec/skills/new-skill');
      expect(logSpy).toHaveBeenCalledWith('  /fake/root/.mumuspec/skills/new-skill/SKILL.md');
    });

    it('should scaffold a skill with custom type and description', async () => {
      mockFindProjectRoot.mockReturnValueOnce('/fake/root');
      mockScaffoldSkill.mockReturnValue({
        created: ['/fake/root/.mumuspec/skills/phase-skill'],
        errors: [],
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(
        ['skill', 'scaffold', 'phase-skill', '--type', 'phase', '--description', 'A phase skill'],
        { from: 'user' }
      );

      expect(mockScaffoldSkill).toHaveBeenCalledWith('/fake/root', 'phase-skill', {
        type: 'phase',
        description: 'A phase skill',
      });
    });

    it('should exit(1) when scaffold reports errors', async () => {
      mockFindProjectRoot.mockReturnValueOnce('/fake/root');
      mockScaffoldSkill.mockReturnValue({
        created: [],
        errors: ['Skill "dup-skill" already exists'],
      });

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'scaffold', 'dup-skill'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Skill "dup-skill" already exists');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a MumuSpec project (scaffold)', async () => {
      mockFindProjectRoot.mockReturnValueOnce(undefined);

      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill', 'scaffold', 'test'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── default action (no subcommand) ──

  describe('skill default action', () => {
    it('should print usage information', async () => {
      const { registerSkillCommands } = await import('../../../src/cli/commands/skill.js');
      const program = new Command();
      registerSkillCommands(program);

      await program.parseAsync(['skill'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Skill authoring and management.\n');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec skill init           Initialize authoring protocol');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec skill validate [name]  Validate skill(s)');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec skill scaffold <name>  Create new skill scaffold');
    });
  });
});
