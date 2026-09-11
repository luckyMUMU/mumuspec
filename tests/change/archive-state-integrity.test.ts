/**
 * Tests for archive state integrity — 状态随变更落入归档目录、状态解析回退、
 * tweak 携带规范工件拒绝归档、归档一致性检查、归档目录名不重复日期前缀。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

const mockLoadChangeState = vi.fn();
const mockSaveChangeState = vi.fn();
const mockSaveChangeStateInDir = vi.fn();
const mockGetChangeDir = vi.fn();
const mockGetArchiveDir = vi.fn();
const mockGetChangesDir = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockWriteText = vi.fn();
const mockReadText = vi.fn();
const mockRenameSync = vi.fn();
const mockCpSync = vi.fn();
const mockRmSync = vi.fn();
const mockReadYaml = vi.fn();
const mockEnsureDir = vi.fn();
const mockNow = vi.fn();
const mockAppendAuditLog = vi.fn();
const mockGetMumuSpecDir = vi.fn();
const mockComputeHash = vi.fn();
const mockLoadConfig = vi.fn();
const mockCreateKnowledgePage = vi.fn();
const mockGetKnowledgeDir = vi.fn();

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  saveChangeState: (...args: unknown[]) => mockSaveChangeState(...args),
  saveChangeStateInDir: (...args: unknown[]) => mockSaveChangeStateInDir(...args),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
  getArchiveDir: (...args: unknown[]) => mockGetArchiveDir(...args),
  getChangesDir: (...args: unknown[]) => mockGetChangesDir(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  renameSync: (...args: unknown[]) => mockRenameSync(...args),
  cpSync: (...args: unknown[]) => mockCpSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  now: () => mockNow(),
  appendAuditLog: (...args: unknown[]) => mockAppendAuditLog(...args),
  getMumuSpecDir: (...args: unknown[]) => mockGetMumuSpecDir(...args),
  computeHash: (...args: unknown[]) => mockComputeHash(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../../src/knowledge/manager.js', () => ({
  createKnowledgePage: (...args: unknown[]) => mockCreateKnowledgePage(...args),
  getKnowledgeDir: (...args: unknown[]) => mockGetKnowledgeDir(...args),
}));

import { archiveChange } from '../../src/change/archive.js';
import { detectArchiveStateDrift } from '../../src/change/archive-consistency.js';
import { MumuSpecError } from '../../src/core/errors.js';

const PROJECT_ROOT = '/tmp/asi-project';
const CHANGE_NAME = 'asi-change';

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE_NAME,
    phase: 'archive-in-progress',
    workflow: 'full',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    affected_scopes: ['.'],
    build_layers: [],
    test_cases: {
      design_locked: true,
      suites_locked: true,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'incremental',
    tdd_mode: 'tdd',
    isolation: 'branch',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: {}, content_hash: 'hash' },
    rollback_history: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNow.mockReturnValue('2025-06-15T10:30:00Z');
  mockGetMumuSpecDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec`);
  mockComputeHash.mockReturnValue('abc123');
  mockGetChangeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes/${CHANGE_NAME}`);
  mockGetArchiveDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes/archive`);
  mockGetChangesDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes`);
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue('{}');
  mockReadText.mockReturnValue('content');
  mockLoadConfig.mockReturnValue({ knowledge: { wiki: { dir: '.mumuspec/knowledge' } } });
  mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
  mockCreateKnowledgePage.mockReturnValue(undefined);
  mockReaddirSync.mockReturnValue([]);
});

// ════════════════════════════════════════════════════════════════════
// L0-1 归档后状态写入归档目录
// ════════════════════════════════════════════════════════════════════

describe('L0-1 归档状态写入归档目录', () => {
  it('状态写入归档目录，且不再通过名称回写活跃区', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    expect(mockSaveChangeStateInDir).toHaveBeenCalled();
    expect(mockSaveChangeState).not.toHaveBeenCalled();

    const [dir, state] = mockSaveChangeStateInDir.mock.calls[0];
    expect(dir.startsWith(`${PROJECT_ROOT}/.mumuspec/changes/archive/`)).toBe(true);
    expect(dir.endsWith(`-${CHANGE_NAME}`)).toBe(true);
    expect(state.phase).toBe('archive-completed');
  });
});

// L0-2（状态解析回退）见 tests/change/state-resolution.test.ts —— 该用例使用真实
// 的 state.js 实现，本文件的 state.js 为 mock 无法覆盖。

// ════════════════════════════════════════════════════════════════════
// L0-5 / L0-6 tweak 携带规范工件
// ════════════════════════════════════════════════════════════════════

describe('L0-5 tweak 携带 delta-spec 时拒绝归档', () => {
  it('抛出 E-CHANGE-012', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'tweak' }));
    mockReaddirSync.mockImplementation((p: string) =>
      p === `${PROJECT_ROOT}/.mumuspec/changes/${CHANGE_NAME}/delta-specs` ? ['x.md'] : [],
    );
    mockReadFileSync.mockReturnValue('# delta\n内容');

    expect(() => archiveChange(PROJECT_ROOT, CHANGE_NAME)).toThrow(MumuSpecError);
    try {
      archiveChange(PROJECT_ROOT, CHANGE_NAME);
    } catch (e) {
      expect((e as MumuSpecError).code).toBe('E-CHANGE-012');
    }
  });
});

describe('L0-6 tweak 无规范工件时正常归档', () => {
  it('不抛错并写入归档状态', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'tweak' }));
    mockReaddirSync.mockReturnValue([]);

    expect(() => archiveChange(PROJECT_ROOT, CHANGE_NAME)).not.toThrow();
    expect(mockSaveChangeStateInDir).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// L0-7 / L0-8 一致性检查
// ════════════════════════════════════════════════════════════════════

describe('L0-7 一致性检查发现残留状态目录', () => {
  it('报告 E-ARCH-001', () => {
    const archiveRoot = `${PROJECT_ROOT}/.mumuspec/changes/archive`;
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === archiveRoot) return [`2025-06-15-${CHANGE_NAME}`];
      if (p === `${PROJECT_ROOT}/.mumuspec/changes`) return [CHANGE_NAME, 'archive'];
      return [];
    });
    mockReadYaml.mockReturnValue({ phase: 'archive-completed' });

    const results = detectArchiveStateDrift(PROJECT_ROOT);
    const codes = results.map((r) => r.code);
    expect(codes).toContain('E-ARCH-001');
  });
});

describe('L0-8 一致性检查发现归档状态阶段错误', () => {
  it('报告 E-ARCH-002', () => {
    const archiveRoot = `${PROJECT_ROOT}/.mumuspec/changes/archive`;
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === archiveRoot) return [`2025-06-15-${CHANGE_NAME}`];
      if (p === `${PROJECT_ROOT}/.mumuspec/changes`) return ['archive'];
      return [];
    });
    mockReadYaml.mockReturnValue({ phase: 'archive-in-progress' });

    const results = detectArchiveStateDrift(PROJECT_ROOT);
    const hit = results.find((r) => r.code === 'E-ARCH-002');
    expect(hit).toBeTruthy();
    expect(hit!.severity).toBe('ERROR');
  });

  it('历史格式（无 phase 字段）不报错', () => {
    const archiveRoot = `${PROJECT_ROOT}/.mumuspec/changes/archive`;
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === archiveRoot) return [`2025-06-15-${CHANGE_NAME}`];
      if (p === `${PROJECT_ROOT}/.mumuspec/changes`) return ['archive'];
      return [];
    });
    mockReadYaml.mockReturnValue({ name: CHANGE_NAME });

    const results = detectArchiveStateDrift(PROJECT_ROOT);
    expect(results.some((r) => r.code === 'E-ARCH-002')).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// L0-9 归档目录名不重复添加日期前缀
// ════════════════════════════════════════════════════════════════════

describe('L0-9 归档目录名不重复日期前缀', () => {
  it('变更名已带日期前缀时不重复添加', () => {
    const dated = '2025-06-01-legacy-change';
    mockLoadChangeState.mockReturnValue(makeChangeState({ name: dated }));

    archiveChange(PROJECT_ROOT, dated);

    const [dir] = mockSaveChangeStateInDir.mock.calls[0];
    expect(dir).toBe(`${PROJECT_ROOT}/.mumuspec/changes/archive/${dated}`);
    expect(dir).not.toContain('2025-06-15-2025-06-01');
  });
});
