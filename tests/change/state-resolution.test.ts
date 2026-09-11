/**
 * Tests for change state path resolution — 归档后状态解析必须回退到归档目录，
 * 而不是让调用方看到"变更不存在"。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadYaml = vi.fn();
const mockWriteYaml = vi.fn();
const mockGetChangeStatePath = vi.fn();
const mockGetArchivedChangeDir = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  writeYaml: (...args: unknown[]) => mockWriteYaml(...args),
}));

vi.mock('../../src/core/migrations.js', () => ({
  migrateSchema: (_type: string, raw: unknown) => ({ data: raw }),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeStatePath: (...args: unknown[]) => mockGetChangeStatePath(...args),
  getArchivedChangeDir: (...args: unknown[]) => mockGetArchivedChangeDir(...args),
}));

import { join } from 'node:path';
import { resolveChangeStatePath, loadChangeState } from '../../src/change/state.js';

const PROJECT_ROOT = '/tmp/state-resolution';
const CHANGE_NAME = 'resolved-change';
const ACTIVE_PATH = join(PROJECT_ROOT, '.mumuspec', 'changes', CHANGE_NAME, '.mumuspec.yaml');
const ARCHIVED_DIR = `${PROJECT_ROOT}/.mumuspec/changes/archive/2025-06-15-${CHANGE_NAME}`;
const ARCHIVED_PATH = join(ARCHIVED_DIR, '.mumuspec.yaml');

beforeEach(() => {
  vi.clearAllMocks();
  mockGetChangeStatePath.mockReturnValue(ACTIVE_PATH);
});

describe('L0-2 状态解析回退到归档目录', () => {
  it('活跃区状态存在时使用活跃区路径', () => {
    mockExistsSync.mockImplementation((p: string) => p === ACTIVE_PATH);
    expect(resolveChangeStatePath(PROJECT_ROOT, CHANGE_NAME)).toBe(ACTIVE_PATH);
  });

  it('活跃区不存在时解析到归档目录路径', () => {
    mockExistsSync.mockImplementation((p: string) => p === ARCHIVED_PATH);
    mockGetArchivedChangeDir.mockReturnValue(ARCHIVED_DIR);

    expect(resolveChangeStatePath(PROJECT_ROOT, CHANGE_NAME)).toBe(ARCHIVED_PATH);
  });

  it('两侧都不存在时回退到活跃区路径（写场景）', () => {
    mockExistsSync.mockReturnValue(false);
    mockGetArchivedChangeDir.mockReturnValue(undefined);

    expect(resolveChangeStatePath(PROJECT_ROOT, CHANGE_NAME)).toBe(ACTIVE_PATH);
  });

  it('归档后 loadChangeState 仍能读到归档状态', () => {
    mockExistsSync.mockImplementation((p: string) => p === ARCHIVED_PATH);
    mockGetArchivedChangeDir.mockReturnValue(ARCHIVED_DIR);
    mockReadYaml.mockReturnValue({ name: CHANGE_NAME, phase: 'archive-completed' });

    const state = loadChangeState(PROJECT_ROOT, CHANGE_NAME);
    expect(state?.phase).toBe('archive-completed');
  });
});
