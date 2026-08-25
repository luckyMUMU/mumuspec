/**
 * CHG-1 — pre-commit 变更归属校验（AC-01/AC-02 及边界用例）。
 *
 * 覆盖：
 *   TC-1-1  非白名单分支无 change + strength high → pre-commit 阻断（E-HOOK-001 + 引导 mumuspec new）
 *   TC-1-2  有活跃 change → 放行
 *   TC-1-3  main 分支无 change → 不误报
 *   TC-1-4  detached HEAD → 跳过
 *   TC-1-5  strength medium → warning 不阻断
 *   TC-1-6  post-commit 无 change → audit.log 含 commit.unregistered
 *   TC-1-7  config 关闭 → 跳过
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mockLoadConfig, mockGetCurrentBranch, mockGetActiveChangeOnBranch } = vi.hoisted(() => ({
  mockLoadConfig: vi.fn(),
  mockGetCurrentBranch: vi.fn(),
  mockGetActiveChangeOnBranch: vi.fn(),
}));

vi.mock('../src/guard/checker.js', () => ({
  checkCompliance: vi.fn(() => ({ passed: true, errors: [], warnings: [] })),
  detectDrift: vi.fn(() => []),
}));

vi.mock('../src/knowledge/manager.js', () => ({
  readReverseIndex: vi.fn(() => []),
}));

vi.mock('../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/config.js')>();
  return { ...actual, loadConfig: mockLoadConfig };
});

vi.mock('../src/core/git.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/git.js')>();
  return { ...actual, getCurrentBranch: mockGetCurrentBranch };
});

vi.mock('../src/change/branch.js', () => ({
  getActiveChangeOnBranch: mockGetActiveChangeOnBranch,
}));

const { runHook } = await import('../src/hooks/guard.js');

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    ci: {
      pre_commit_ownership_check: true,
      ownership_ci_branches: ['main', 'master'],
    },
    knowledge: { commit_update: { enabled: false } },
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'high',
      exceptions: [],
      overrides: {},
    },
    ...overrides,
  };
}

let root: string;

beforeEach(() => {
  root = join(tmpdir(), `mumuspec-hooks-ownership-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  mockLoadConfig.mockReset();
  mockGetCurrentBranch.mockReset();
  mockGetActiveChangeOnBranch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('CHG-1 pre-commit 变更归属校验', () => {
  it('TC-1-1 非白名单分支无 change + strength high → 阻断（E-HOOK-001 + mumuspec new 引导）', () => {
    mockLoadConfig.mockReturnValue(baseConfig());
    mockGetCurrentBranch.mockReturnValue('feat/foo');
    mockGetActiveChangeOnBranch.mockReturnValue(undefined);

    const result = runHook('pre-commit', [], root);
    expect(result.passed).toBe(false);
    const hit = result.errors.find((e) => e.includes('E-HOOK-001') && e.includes('mumuspec new'));
    expect(hit).toBeDefined();
    expect(hit).toContain("分支 'feat/foo' 无活跃变更");
  });

  it('TC-1-2 有活跃 change → 放行，无 E-HOOK-001', () => {
    mockLoadConfig.mockReturnValue(baseConfig());
    mockGetCurrentBranch.mockReturnValue('mumuspec/my-change');
    mockGetActiveChangeOnBranch.mockReturnValue('my-change');

    const result = runHook('pre-commit', [], root);
    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.includes('E-HOOK-001'))).toBe(false);
  });

  it('TC-1-3 边界：main 分支无 change → 不误报', () => {
    mockLoadConfig.mockReturnValue(baseConfig());
    mockGetCurrentBranch.mockReturnValue('main');
    mockGetActiveChangeOnBranch.mockReturnValue(undefined);

    const result = runHook('pre-commit', [], root);
    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.includes('E-HOOK-001'))).toBe(false);
    expect(result.warnings.some((w) => w.includes('E-HOOK-001'))).toBe(false);
  });

  it('TC-1-4 边界：detached HEAD → 跳过', () => {
    mockLoadConfig.mockReturnValue(baseConfig());
    mockGetCurrentBranch.mockReturnValue(undefined);

    const result = runHook('pre-commit', [], root);
    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.includes('E-HOOK-001'))).toBe(false);
  });

  it('TC-1-5 边界：strength medium → warning 不阻断', () => {
    mockLoadConfig.mockReturnValue(
      baseConfig({
        constraint_strength: { technical_design: 'medium', requirement_goals: 'medium', exceptions: [], overrides: {} },
      }),
    );
    mockGetCurrentBranch.mockReturnValue('feat/foo');
    mockGetActiveChangeOnBranch.mockReturnValue(undefined);

    const result = runHook('pre-commit', [], root);
    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.includes('E-HOOK-001'))).toBe(false);
    expect(result.warnings.some((w) => w.includes('E-HOOK-001'))).toBe(true);
  });

  it('TC-1-6 post-commit 无 change → audit.log 含 commit.unregistered', () => {
    mockLoadConfig.mockReturnValue(baseConfig());
    mockGetCurrentBranch.mockReturnValue('feat/foo');
    mockGetActiveChangeOnBranch.mockReturnValue(undefined);

    const result = runHook('post-commit', [], root);
    expect(result).toBeDefined();

    const auditPath = join(root, '.mumuspec', 'audit.log');
    expect(existsSync(auditPath)).toBe(true);
    const content = readFileSync(auditPath, 'utf8');
    expect(content).toContain('"action":"commit.unregistered"');
    expect(content).toContain('"branch":"feat/foo"');
    expect(content).toContain('"result":"warn"');
  });

  it('TC-1-7 边界：config 关闭 → 跳过（pre-commit 不阻断，post-commit 无审计）', () => {
    mockLoadConfig.mockReturnValue(baseConfig({ ci: { pre_commit_ownership_check: false, ownership_ci_branches: ['main', 'master'] } }));
    mockGetCurrentBranch.mockReturnValue('feat/foo');
    mockGetActiveChangeOnBranch.mockReturnValue(undefined);

    const pre = runHook('pre-commit', [], root);
    expect(pre.passed).toBe(true);
    expect(pre.errors.some((e) => e.includes('E-HOOK-001'))).toBe(false);

    runHook('post-commit', [], root);
    const auditPath = join(root, '.mumuspec', 'audit.log');
    expect(existsSync(auditPath)).toBe(false);
  });
});
