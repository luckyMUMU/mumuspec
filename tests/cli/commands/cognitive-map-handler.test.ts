/**
 * Handler-level tests for cognitive-map subcommands (show, init, sync).
 *
 * Strategy: mock lower-level modules (core/utils, change/manager), register
 * cognitive-map commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockExistsSync,
  mockReadText,
  mockReadYaml,
  mockWriteText,
  mockLoadChangeState,
  mockSaveChangeState,
  mockGetChangeDir,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadText: vi.fn(),
  mockReadYaml: vi.fn(),
  mockWriteText: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockGetChangeDir: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    readYaml: mockReadYaml,
    writeText: mockWriteText,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    loadChangeState: mockLoadChangeState,
    saveChangeState: mockSaveChangeState,
    getChangeDir: mockGetChangeDir,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('cognitive-map command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const baseState = {
    name: 'test-change',
    phase: 'open',
    workflow: 'standard',
    cognitive_framework: {
      enabled: true,
      q1_count: 1,
      q2_pending: 0,
      q3_pending: 0,
      q4_scans_completed: 3,
      converged: true,
      rounds_completed: 2,
    },
  };

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockExistsSync.mockReset();
    mockReadText.mockReset();
    mockReadYaml.mockReset();
    mockWriteText.mockReset();
    mockLoadChangeState.mockReset();
    mockSaveChangeState.mockReset();
    mockGetChangeDir.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/test-change');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── show subcommand ──

  describe('cognitive-map show handler', () => {
    it('should display cognitive map with entries', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockReturnValue(true);
      mockReadYaml.mockReturnValue({
        entries: [
          { quadrant: 'Q1', question: 'Known fact', answer: 'Yes', confidence: 'high', source: 'code' },
          { quadrant: 'Q2', question: 'Unknown', answer: '', confidence: 'low' },
          { quadrant: 'Q3', question: 'Inferred', answer: 'Likely', status: 'pending' },
          { quadrant: 'Q4', question: 'Blind spot', answer: 'Maybe', status: 'discovered' },
        ],
      });

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'show', 'test-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cognitive Map: test-change'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Q1'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Q2'));
    });

    it('should display when cognitive map file does not exist', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockReturnValue(false);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'show', 'test-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cognitive-map.yaml 不存在'));
    });

    it('should display when state has no cognitive_framework field', async () => {
      mockLoadChangeState.mockReturnValue({
        name: 'no-cf',
        phase: 'open',
      });
      mockExistsSync.mockReturnValue(false);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'show', 'no-cf'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('(状态机无 cognitive_framework 字段'),
      );
    });

    it('should exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(undefined);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'show', 'nonexistent'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: nonexistent');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'show', 'test-change'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── init subcommand ──

  describe('cognitive-map init handler', () => {
    it('should init from template when template exists', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      // target doesn't exist, first template candidate exists
      mockExistsSync.mockImplementation((p: string) => {
        if (p.includes('cognitive-map-template.yaml')) return true;
        return false;
      });
      mockReadText.mockReturnValue('template content here');

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'init', 'test-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('cognitive-map.yaml 已从模板初始化'),
      );
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('cognitive-map.yaml'),
        'template content here',
      );
    });

    it('should init with built-in template when no template file found', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockReturnValue(false); // nothing exists

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'init', 'test-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('cognitive-map.yaml 已初始化 (内置最小模板)'),
      );
      expect(mockWriteText).toHaveBeenCalledWith(
        expect.stringContaining('cognitive-map.yaml'),
        expect.stringContaining('Cognitive Map'),
      );
    });

    it('should exit(1) when target exists and no --force', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockImplementation((p: string) => {
        return p.includes('cognitive-map.yaml') && !p.includes('template');
      });

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'init', 'test-change'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('已存在 (使用 --force 覆盖)'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should overwrite when target exists and --force is given', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockReturnValue(true);
      mockReadText.mockReturnValue('forced template content');

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'init', 'test-change', '--force'], { from: 'user' });

      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  // ── sync subcommand ──

  describe('cognitive-map sync handler', () => {
    it('should sync cognitive framework and show counts', async () => {
      const state = { ...baseState, cognitive_framework: undefined };
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockReadYaml.mockReturnValue({
        entries: [
          { quadrant: 'Q1', question: 'Known', answer: 'Yes' },
          { quadrant: 'Q1', question: 'Another known', answer: 'Yes' },
          { quadrant: 'Q2', question: 'Resolved', answer: 'Resolved answer' },
          { quadrant: 'Q3', question: 'Confirmed', answer: 'Yes', status: 'confirmed' },
          { quadrant: 'Q4', category: 'security-compliance', question: 'Scanned1', answer: 'Done', status: 'done' },
          { quadrant: 'Q4', category: 'concurrency', question: 'Scanned2', answer: 'Done', status: 'done' },
          { quadrant: 'Q4', category: 'compat', question: 'Scanned3', answer: 'Done', status: 'done' },
        ],
      });

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'sync', 'test-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('cognitive_framework 已同步'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('q1_count: 2'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('converged: true'),
      );
      expect(mockSaveChangeState).toHaveBeenCalled();
    });

    it('should warn when not converged', async () => {
      const state = { ...baseState, cognitive_framework: undefined };
      mockLoadChangeState.mockReturnValue(state);
      mockExistsSync.mockReturnValue(true);
      mockReadYaml.mockReturnValue({
        entries: [
          { quadrant: 'Q1', question: 'Known', answer: 'Yes' },
          { quadrant: 'Q2', question: 'Unknown', answer: '【填写】' },
        ],
      });

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'sync', 'test-change'], { from: 'user' });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('认知地图未收敛'),
      );
    });

    it('should exit(1) when cognitive-map.yaml does not exist', async () => {
      mockLoadChangeState.mockReturnValue(baseState);
      mockExistsSync.mockReturnValue(false);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'sync', 'test-change'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cognitive-map.yaml 不存在或为空'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(undefined);

      const { registerCognitiveMapCommands } = await import('../../../src/cli/commands/cognitive-map.js');
      const program = new Command();
      registerCognitiveMapCommands(program);

      await program.parseAsync(['cognitive-map', 'sync', 'no-change'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: no-change');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
