/**
 * P0-D: finalize-archive 四项缺口
 *  1) code-graph snapshot 不再是占位空实现
 *  2) cache 陈旧项实际删除（此前仅计数）
 *  3) .finalized 防重跑标记（幂等）
 *  4) 关键写盘走原子写入（既有 writeText/writeYaml 保障）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// mock 掉 change/manager 与 core/git 的重依赖，隔离测试 finalize 自身的子步骤
vi.mock('../../src/change/manager.js', () => ({
  loadChangeState: () => ({ phase: 'archive-completed', workflow: 'full' }),
  getArchivedChangeDir: () => undefined,
  mergeDeltaSpecsToMain: () => undefined,
  extractKnowledgeToGlobal: () => undefined,
}));
vi.mock('../../src/core/git.js', () => ({
  getCurrentBranch: () => 'master',
  getMainBranch: () => 'master',
  switchBranch: () => undefined,
}));

// findProjectRoot() 走 process.cwd() —— 重定向到测试临时根，其余保持真实实现
let testRoot = '';
vi.mock('../../src/core/utils.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    default: { ...actual },
    findProjectRoot: () => testRoot,
  };
});

const { registerFinalizeArchiveCommand } = await import('../../src/cli/commands/finalize-archive.js');
const { Command } = await import('commander');

let root: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function setup(changeName: string) {
  root = mkdtempSync(join(tmpdir(), 'mumu-finalize-'));
  testRoot = root;
  // 最小项目骨架
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  writeFileSync(join(root, '.mumuspec', 'config.yaml'), 'project:\n  name: t\n');
  writeFileSync(join(root, '.mumuspec', 'prohibitions.md'), '# Prohibitions\n');
  writeFileSync(join(root, '.mumuspec', 'index.yaml'), 'scope: .\nlayer: 0\nchildren: []\n');
  // 归档目录
  const archived = join(root, '.mumuspec', 'changes', 'archive', changeName);
  mkdirSync(archived, { recursive: true });
  writeFileSync(join(archived, '.mumuspec.yaml'), 'phase: archive-completed\nworkflow: full\n');
  // 源码文件供 code-graph 构建
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
  return archived;
}

function run(...args: string[]) {
  const program = new Command();
  program.exitOverride();
  registerFinalizeArchiveCommand(program);
  return program.parseAsync(['node', 'mumuspec', 'finalize-archive', ...args]);
}

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (root) rmSync(root, { recursive: true, force: true });
});

describe('finalize-archive — P0-D 缺口修复', () => {
  it('① code-graph snapshot 非占位：产出实际快照文件且含节点', async () => {
    setup('chg-1');
    await run('chg-1', '--json');
    const snap = join(root, '.mumuspec', 'temp', 'codegraph.snapshot.json');
    expect(existsSync(snap)).toBe(true);
    const parsed = JSON.parse(readFileSync(snap, 'utf8'));
    expect(parsed).toBeTruthy();
    expect(typeof parsed.nodeCount === 'number' || Array.isArray(parsed.nodes)).toBe(true);
  });

  it('② cache 陈旧项实际删除（30 天前的归档目录被清理）', async () => {
    const change = 'chg-old';
    setup(change);
    const archiveBase = join(root, '.mumuspec', 'changes', 'archive');
    const stale = join(archiveBase, 'stale-entry');
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, 'x.txt'), 'stale');
    const old = Date.now() - 40 * 24 * 60 * 60 * 1000;
    utimesSync(stale, new Date(old / 1000), new Date(old / 1000));

    await run(change, '--json');
    expect(existsSync(stale)).toBe(false);
  });

  it('③ .finalized 防重跑标记：第二次运行被幂等拦截', async () => {
    const archived = setup('chg-idem');
    await run('chg-idem', '--json');
    expect(existsSync(join(archived, '.finalized'))).toBe(true);

    logSpy.mockClear();
    await run('chg-idem', '--json');
    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toMatch(/已 finalize|幂等|跳过/);
  });

  it('③b --force 可覆盖幂等标记重跑', async () => {
    const archived = setup('chg-force');
    await run('chg-force', '--json');
    expect(existsSync(join(archived, '.finalized'))).toBe(true);
    logSpy.mockClear();
    await run('chg-force', '--json', '--force');
    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).not.toMatch(/已 finalize，跳过/);
  });
});
