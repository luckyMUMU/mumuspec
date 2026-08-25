/**
 * Handler-level tests for i18n subcommands (status, skill-path).
 *
 * Strategy: mock src/i18n/locales.js and src/core/utils.js functions via
 * vi.hoisted + vi.mock, register i18n commands on a fresh Commander program,
 * then invoke handlers via parseAsync() with { from: 'user' }.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockGetLocale,
  mockListAvailableLocales,
  mockResolveSkillPath,
  mockFindProjectRoot,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(),
  mockListAvailableLocales: vi.fn(),
  mockResolveSkillPath: vi.fn(),
  mockFindProjectRoot: vi.fn(),
}));

vi.mock('../../../src/i18n/locales.js', () => ({
  getLocale: mockGetLocale,
  listAvailableLocales: mockListAvailableLocales,
  resolveSkillPath: mockResolveSkillPath,
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('i18n command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockGetLocale.mockReset();
    mockListAvailableLocales.mockReset();
    mockResolveSkillPath.mockReset();
    mockFindProjectRoot.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── i18n status ──

  describe('i18n status handler', () => {
    it('shows current locale and available locales', async () => {
      mockGetLocale.mockReturnValue('zh');
      mockListAvailableLocales.mockReturnValue(['zh', 'en']);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['i18n', 'status'], { from: 'user' });

      expect(mockListAvailableLocales).toHaveBeenCalledWith('.');
      expect(mockGetLocale).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('\nCurrent locale: zh');
      expect(logSpy).toHaveBeenCalledWith('Available: zh, en');
      expect(logSpy).toHaveBeenCalledWith('\nSet locale: MUMUSPEC_LANG=en mumuspec ...');
      expect(logSpy).toHaveBeenCalledWith('Config: .mumuspec.yaml → language: "en"');
    });

    it('shows English locale when MUMUSPEC_LANG=en', async () => {
      mockGetLocale.mockReturnValue('en');
      mockListAvailableLocales.mockReturnValue(['zh', 'en']);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['i18n', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\nCurrent locale: en');
    });

    it('shows only zh when English locale directory is unavailable', async () => {
      mockGetLocale.mockReturnValue('zh');
      mockListAvailableLocales.mockReturnValue(['zh']);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['i18n', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Available: zh');
    });

    it('uses --workspace-path option for locale listing', async () => {
      mockGetLocale.mockReturnValue('zh');
      mockListAvailableLocales.mockReturnValue(['zh', 'en']);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['i18n', 'status', '--workspace-path', '/my/project'], { from: 'user' });

      expect(mockListAvailableLocales).toHaveBeenCalledWith('/my/project');
    });

    it('displays empty available locales gracefully', async () => {
      mockGetLocale.mockReturnValue('en');
      mockListAvailableLocales.mockReturnValue([]);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['i18n', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\nCurrent locale: en');
      expect(logSpy).toHaveBeenCalledWith('Available: ');
    });
  });

  // ── i18n skill-path ──

  describe('i18n skill-path handler', () => {
    it('prints resolved skill path when skill is found', async () => {
      mockFindProjectRoot.mockReturnValue('/project/root');
      mockGetLocale.mockReturnValue('zh');
      mockResolveSkillPath.mockReturnValue('/project/root/.mumuspec/skills/mumuspec.md');

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['skill-path', 'mumuspec'], { from: 'user' });

      expect(mockFindProjectRoot).toHaveBeenCalled();
      expect(mockResolveSkillPath).toHaveBeenCalledWith('/project/root', 'mumuspec');
      expect(logSpy).toHaveBeenCalledWith('/project/root/.mumuspec/skills/mumuspec.md');
    });

    it('exits with error when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['skill-path', 'mumuspec'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitError).not.toBeNull();
      expect(mockResolveSkillPath).not.toHaveBeenCalled();
    });

    it('exits with error when skill is not found for current locale', async () => {
      mockFindProjectRoot.mockReturnValue('/project/root');
      mockGetLocale.mockReturnValue('en');
      mockResolveSkillPath.mockReturnValue(null);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['skill-path', 'unknown-skill'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(logSpy).toHaveBeenCalledWith('No skill "unknown-skill" found for locale "en"');
      expect(exitError).not.toBeNull();
    });

    it('works with different skill names', async () => {
      mockFindProjectRoot.mockReturnValue('/repo');
      mockGetLocale.mockReturnValue('zh');
      mockResolveSkillPath.mockReturnValue('/repo/.mumuspec/skills/phase-open.md');

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['skill-path', 'phase-open'], { from: 'user' });

      expect(mockResolveSkillPath).toHaveBeenCalledWith('/repo', 'phase-open');
      expect(logSpy).toHaveBeenCalledWith('/repo/.mumuspec/skills/phase-open.md');
    });

    it('displays correct locale in error message when skill not found', async () => {
      mockFindProjectRoot.mockReturnValue('/ws');
      mockGetLocale.mockReturnValue('zh');
      mockResolveSkillPath.mockReturnValue(null);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['skill-path', 'phase-build'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(logSpy).toHaveBeenCalledWith('No skill "phase-build" found for locale "zh"');
      expect(exitError).not.toBeNull();
    });

    it('does not crash when findProjectRoot returns null and locale is en', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['skill-path', 'mumuspec'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitError).not.toBeNull();
    });

    it('resolveSkillPath receiving different locale values changes lookup', async () => {
      mockFindProjectRoot.mockReturnValue('/proj');
      mockGetLocale.mockReturnValue('en');
      mockResolveSkillPath.mockReturnValue('/proj/.mumuspec/skills/en/expert-manager.md');

      const { registerI18nCommands } = await import('../../../src/cli/commands/i18n.js');
      const program = new Command();
      registerI18nCommands(program);

      await program.parseAsync(['skill-path', 'expert-manager'], { from: 'user' });

      expect(mockResolveSkillPath).toHaveBeenCalledWith('/proj', 'expert-manager');
      expect(logSpy).toHaveBeenCalledWith('/proj/.mumuspec/skills/en/expert-manager.md');
    });
  });
});
