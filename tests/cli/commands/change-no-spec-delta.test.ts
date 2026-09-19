/**
 * CLI 集成 — `mumuspec new --no-spec-delta`（lightweight-freeze-gate）：
 * 选项应把 state.skip_specs 置 true 并持久化。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';

const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockCreateChange,
  mockSaveChangeState,
  mockGetChangeDir,
  mockReadText,
  mockWriteText,
  mockComputeSkillSet,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCreateChange: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockGetChangeDir: vi.fn(),
  mockReadText: vi.fn(),
  mockWriteText: vi.fn(),
  mockComputeSkillSet: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot, readText: mockReadText, writeText: mockWriteText };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return { ...actual, loadConfig: mockLoadConfig };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return { ...actual, createChange: mockCreateChange, saveChangeState: mockSaveChangeState, getChangeDir: mockGetChangeDir };
});

vi.mock('../../../src/core/skill-loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/skill-loader.js')>();
  return { ...actual, computeSkillSet: mockComputeSkillSet };
});

import { registerChangeCommands } from '../../../src/cli/commands/change.js';

describe('mumuspec new --no-spec-delta (TC-L0-07)', () => {
  let program: Command;
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(async () => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockCreateChange.mockImplementation((_root: string, name: string) => ({
      name,
      phase: 'open',
      workflow: 'tweak',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      affected_scopes: [],
      build_layers: [],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0,
      rebuild_count: 0,
      rollback_limit: 3,
      rebuild_limit: 5,
      build_mode: 'executing-plans',
      tdd_mode: 'tdd',
      isolation: 'branch',
      single_active_change: true,
      user_confirmed: false,
      decisions_log: { counts: {} },
      rollback_history: [],
      scope: '.',
      dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
    }));
    mockSaveChangeState.mockImplementation(() => undefined);
    mockSaveChangeState.mockClear();
    mockGetChangeDir.mockImplementation((root: string, name: string) => root + '/.mumuspec/changes/' + name);
    mockReadText.mockReturnValue('# Proposal\n');
    mockWriteText.mockImplementation(() => undefined);
    mockComputeSkillSet.mockReturnValue([]);

    program = new Command();
    registerChangeCommands(program);
    consoleSpy.mockClear();
  });

  it('sets state.skip_specs = true and persists', async () => {
    await program.parseAsync(['node', 'test', 'new', 'chg-no-delta', '--workflow', 'tweak', '--no-spec-delta']);
    expect(mockSaveChangeState).toHaveBeenCalledTimes(1);
    const saved = mockSaveChangeState.mock.calls[0][2] as { skip_specs?: boolean };
    expect(saved.skip_specs).toBe(true);
  });

  it('without --no-spec-delta skip_specs stays absent', async () => {
    await program.parseAsync(['node', 'test', 'new', 'chg-normal', '--workflow', 'tweak']);
    const saved = mockSaveChangeState.mock.calls[0][2] as { skip_specs?: boolean };
    expect(saved.skip_specs).toBeUndefined();
  });
});