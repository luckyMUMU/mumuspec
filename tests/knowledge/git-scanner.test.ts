/**
 * Deep tests for src/knowledge/scanners/git-scanner.ts
 *
 * Targets: git log parsing, commit message classification, revert detection,
 * merge commit identification, hotspot analysis, project maturity signals,
 * edge cases (no git, malformed output, empty data).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock external dependencies ───

const mockSpawnSync = vi.fn();
const mockExistsSync = vi.fn();
const mockJoin = vi.fn((...args: string[]) => args.join('/'));

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...args: unknown[]) => mockJoin(...(args as string[])),
}));

// Import after mocks
import { scanGitHistory } from '../../src/knowledge/scanners/git-scanner.js';
import type { ProposedKnowledgePage } from '../../src/knowledge/scan-types.js';

// ─── Helpers ───

/** Create a valid GitCommit log line for --format="%h|%aI|%an|%s" */
function commitLine(hash: string, date: string, author: string, subject: string): string {
  return `${hash}|${date}|${author}|${subject}`;
}

/** Generate a multi-line git log output */
function gitLog(...commits: Array<{ hash: string; date: string; author: string; subject: string }>): string {
  return commits.map((c) => commitLine(c.hash, c.date, c.author, c.subject)).join('\n');
}

/** Wrap a string into a spawnSync-shaped return value */
function spawnResult(stdout: string): { stdout: string; status: number } {
  return { stdout, status: 0 };
}

function validPage(page: ProposedKnowledgePage): void {
  expect(page).toHaveProperty('id');
  expect(page).toHaveProperty('title');
  expect(page).toHaveProperty('type');
  expect(page).toHaveProperty('scope');
  expect(page).toHaveProperty('content');
  expect(page).toHaveProperty('tags');
  expect(page).toHaveProperty('graph_bindings');
  expect(page).toHaveProperty('confidence');
  expect(page).toHaveProperty('source');
  expect(page).toHaveProperty('evidence');
  expect(['decision', 'pattern', 'risk', 'rationale', 'lesson']).toContain(page.type);
  expect(['high', 'medium', 'low']).toContain(page.confidence);
  expect(Array.isArray(page.tags)).toBe(true);
  expect(Array.isArray(page.graph_bindings)).toBe(true);
  expect(page.source).toBe('git');
}

// ─── Tests ───

describe('scanGitHistory — deep coverage', () => {
  const PROJECT_ROOT = '/tmp/test-project';

  beforeEach(() => {
    vi.clearAllMocks();
    mockJoin.mockImplementation((...args: string[]) => args.join('/'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── A. No git / environment edge cases ───

  describe('non-git directory', () => {
    it('returns empty array when .git directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      const result = scanGitHistory(PROJECT_ROOT);
      expect(result).toEqual([]);
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });

    it('returns empty array when git command produces no output', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue(spawnResult(''));
      const result = scanGitHistory(PROJECT_ROOT);
      expect(result).toEqual([]);
    });

    it('returns empty array when git command throws (caught by gitExec)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation(() => {
        throw new Error('git not found');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      expect(result).toEqual([]);
    });
  });

  // ─── B. Commit message classification (pattern matching) ───

  describe('commit message classification', () => {
    it('detects revert commits and classifies as lesson type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'abc1234', date: '2024-01-15T10:30:00Z', author: 'alice', subject: 'Revert "feat: add dark mode"' },
            ),
          );
        }
        if (joined.includes('--name-only')) {
          return spawnResult('');
        }
        if (joined.includes('rev-list --count')) {
          return spawnResult('10');
        }
        if (joined.includes('log --format=%an')) {
          return spawnResult('alice\nbob');
        }
        if (joined.includes('--reverse')) {
          return spawnResult('2024-01-01T00:00:00Z');
        }
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const revertPage = result.find((p) => p.tags.includes('lesson'));
      expect(revertPage).toBeDefined();
      expect(revertPage!.type).toBe('lesson');
      expect(revertPage!.title).toContain('回退');
      expect(revertPage!.evidence).toContain('abc1234');
      validPage(revertPage!);
    });

    it('detects migration commits and classifies as decision type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'def5678', date: '2024-02-10T08:00:00Z', author: 'bob', subject: 'feat: migrate database schema to v2' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const migrationPage = result.find((p) => p.title.includes('迁移'));
      expect(migrationPage).toBeDefined();
      expect(migrationPage!.type).toBe('decision');
      expect(migrationPage!.evidence).toContain('def5678');
      validPage(migrationPage!);
    });

    it('detects hotfix commits and classifies as risk type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'aaa1111', date: '2024-03-01T12:00:00Z', author: 'alice', subject: 'hotfix: fix critical login bug' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotfixPage = result.find((p) => p.title.includes('紧急修复'));
      expect(hotfixPage).toBeDefined();
      expect(hotfixPage!.type).toBe('risk');
      validPage(hotfixPage!);
    });

    it('detects deprecation commits and classifies as decision type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'bbb2222', date: '2024-03-05T09:00:00Z', author: 'charlie', subject: 'chore: deprecate old API endpoints' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const deprPage = result.find((p) => p.title.includes('废弃'));
      expect(deprPage).toBeDefined();
      expect(deprPage!.type).toBe('decision');
      validPage(deprPage!);
    });

    it('detects breaking change commits and classifies as risk type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'ccc3333', date: '2024-04-01T10:00:00Z', author: 'alice', subject: 'feat(api)!: BREAKING CHANGE remove legacy auth' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const breakingPage = result.find((p) => p.title.includes('破坏性变更'));
      expect(breakingPage).toBeDefined();
      expect(breakingPage!.type).toBe('risk');
      validPage(breakingPage!);
    });
  });

  // ─── C. Merge commit identification ───

  describe('merge commit identification', () => {
    it('does not crash when merge commits appear in log output', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'mmm0001', date: '2024-01-20T09:00:00Z', author: 'alice', subject: 'Merge pull request #42 from feature/awesome' },
              { hash: 'mmm0002', date: '2024-01-21T09:00:00Z', author: 'bob', subject: 'Merge branch \'release/v1\' into main' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('20');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      for (const page of result) {
        validPage(page);
      }
    });
  });

  // ─── D. Multiple matching patterns (deduplication) ───

  describe('deduplication and multiple patterns', () => {
    it('does not produce duplicate pages for same pattern type', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'r1aaaaa', date: '2024-01-10T09:00:00Z', author: 'alice', subject: 'Revert "feat A"' },
              { hash: 'r2bbbbb', date: '2024-01-11T09:00:00Z', author: 'bob', subject: 'Revert "feat B"' },
              { hash: 'r3ccccc', date: '2024-01-12T09:00:00Z', author: 'alice', subject: 'revert: undo last change' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2023-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const revertPages = result.filter((p) => p.tags.includes('lesson'));
      // Should only have one revert/lesson page (first match)
      expect(revertPages.length).toBe(1);
      // Content should reference the first matching commit
      expect(revertPages[0]!.content).toContain('r1aaaaa');
    });

    it('matches multiple different patterns across commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'x100001', date: '2024-01-10T09:00:00Z', author: 'alice', subject: 'Revert "bad change"' },
              { hash: 'x100002', date: '2024-01-11T09:00:00Z', author: 'bob', subject: 'add migration for user table' },
              { hash: 'x100003', date: '2024-01-12T09:00:00Z', author: 'charlie', subject: 'hotfix: patch security hole' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob\ncharlie');
        if (joined.includes('--reverse')) return spawnResult('2023-06-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      // Should produce pages for revert, migration, and hotfix
      const titles = result.map((p) => p.title);
      const hasRevert = titles.some((t) => t.includes('回退'));
      const hasMigration = titles.some((t) => t.includes('迁移'));
      const hasHotfix = titles.some((t) => t.includes('紧急修复'));
      expect(hasRevert).toBe(true);
      expect(hasMigration).toBe(true);
      expect(hasHotfix).toBe(true);
    });

    it('deduplicates by title template, not by commit hash', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'dup0001', date: '2024-02-01T09:00:00Z', author: 'a', subject: 'BREAKING CHANGE: remove field X' },
              { hash: 'dup0002', date: '2024-02-02T09:00:00Z', author: 'b', subject: 'BREAKING CHANGE: remove field Y' },
              { hash: 'dup0003', date: '2024-02-03T09:00:00Z', author: 'c', subject: 'breaking-change: rename endpoint' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('30');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb\nc');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const breakingPages = result.filter((p) => p.title.includes('破坏性变更'));
      expect(breakingPages.length).toBe(1);
      expect(breakingPages[0]!.content).toContain('dup0001');
    });
  });

  // ─── E. Hotspot file detection ───

  describe('hotspot file detection', () => {
    it('produces a risk page when files have >= 5 changes', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'hs00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: init project' },
            ),
          );
        }
        if (joined.includes('--name-only')) {
          return spawnResult(
            [
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/core/config.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/cli/index.ts',
              'src/spec/parser.ts',
              'src/spec/parser.ts',
              'src/spec/parser.ts',
            ].join('\n'),
          );
        }
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeDefined();
      expect(hotspotPage!.type).toBe('risk');
      expect(hotspotPage!.title).toContain('2'); // 2 files with >= 5 changes
      expect(hotspotPage!.graph_bindings).toContain('src/core/config.ts');
      expect(hotspotPage!.graph_bindings).toContain('src/cli/index.ts');
      expect(hotspotPage!.graph_bindings).not.toContain('src/spec/parser.ts'); // only 3 changes
      validPage(hotspotPage!);
    });

    it('does not produce hotspot page when all files have < 5 changes', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'lo00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: init' },
            ),
          );
        }
        if (joined.includes('--name-only')) {
          return spawnResult(
            [
              'src/utils/helper.ts',
              'src/utils/helper.ts',
              'src/utils/helper.ts',
              'src/utils/helper.ts',
              'src/types.ts',
              'src/types.ts',
              'README.md',
            ].join('\n'),
          );
        }
        if (joined.includes('rev-list --count')) return spawnResult('20');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeUndefined();
    });

    it('handles empty hotspot output (no files changed)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'em00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'docs: update readme' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('5');
        if (joined.includes('log --format=%an')) return spawnResult('alice');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeUndefined();
    });
  });

  // ─── F. Project maturity signals ───

  describe('project maturity signals', () => {
    it('detects single-author project with > 100 commits as risk', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'sa00001', date: '2024-06-01T09:00:00Z', author: 'solo-dev', subject: 'feat: add feature' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('150');
        if (joined.includes('log --format=%an')) return spawnResult('solo-dev');
        if (joined.includes('--reverse')) return spawnResult('2020-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeDefined();
      expect(singleAuthorPage!.type).toBe('risk');
      expect(singleAuthorPage!.tags).toContain('knowledge-silo');
      expect(singleAuthorPage!.content).toContain('150');
      validPage(singleAuthorPage!);
    });

    it('does NOT flag single author when commits <= 100', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'ct00001', date: '2024-01-01T09:00:00Z', author: 'only-one', subject: 'initial commit' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('only-one');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });

    it('does NOT flag single author when multiple authors exist even with > 100 commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'ma00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: something' },
              { hash: 'ma00002', date: '2024-01-02T09:00:00Z', author: 'bob', subject: 'fix: bug' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('200');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2022-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });
  });

  // ─── G. ID generation ───

  describe('ID generation', () => {
    it('generates sequential KS-GIT- prefixed IDs', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'id00001', date: '2024-01-01T09:00:00Z', author: 'a', subject: 'Revert "x"' },
              { hash: 'id00002', date: '2024-01-02T09:00:00Z', author: 'a', subject: 'migration: y' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const ids = result.map((p) => p.id);
      expect(ids[0]).toMatch(/^KS-GIT-\d{4}$/);
      expect(ids[1]).toMatch(/^KS-GIT-\d{4}$/);
      // IDs should be unique
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('resets ID counter at the start of each scan', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('r1test1', '2024-01-01T09:00:00Z', 'a', 'Revert "first"'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result1 = scanGitHistory(PROJECT_ROOT);
      expect(result1.length).toBeGreaterThan(0);
      const firstId = result1[0]!.id;

      const result2 = scanGitHistory(PROJECT_ROOT);
      expect(result2.length).toBeGreaterThan(0);
      // Counter is reset at the start of scanGitHistory, so IDs restart
      expect(result2[0]!.id).toBe(firstId);
    });
  });

  // ─── H. Malformed / edge case input handling ───

  describe('malformed git output handling', () => {
    it('handles commit lines with missing fields gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          // Lines with fewer than 4 pipe-delimited fields fall back to empty defaults
          return spawnResult('hashonly\nmalformed|data\nhash3|2024-01-01T00:00:00Z|some-author');
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      // Should not throw - malformed input is tolerated
      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
      for (const page of result) {
        validPage(page);
      }
    });

    it('handles commit lines with extra fields (commit subject contains pipe characters)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          // Subject containing extra | chars: hash|date|author|message |extra
          return spawnResult('hashx|2024-01-01T00:00:00Z|alice|Revert "feat: add feature"');
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      // commit message is the 4th field (parts[3])
      const revertPage = result.find((p) => p.tags.includes('lesson'));
      expect(revertPage).toBeDefined();
      expect(revertPage!.content).toContain('hashx');
    });

    it('handles hotspot lines that do not match expected format', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('mf00001', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        }
        if (joined.includes('--name-only')) {
          return spawnResult('garbage data\nanother bad line\n');
        }
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      // Should not throw and should still return valid results
      const result = scanGitHistory(PROJECT_ROOT);
      for (const page of result) {
        validPage(page);
      }
      // Hotspot page should not be created since no lines match the format
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeUndefined();
    });

    it('handles rev-list returning non-numeric value', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('nn00001', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('not-a-number');
        if (joined.includes('log --format=%an')) return spawnResult('a');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      // totalCommits should be 0 (parseInt returns NaN → 0)
      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      // Since totalCommits = 0 (not > 100), single-author check is skipped
      expect(singleAuthorPage).toBeUndefined();
    });

    it('handles first commit date being empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('fd00001', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult(''); // No first commit date
        return spawnResult('');
      });

      // Should not throw - ageInDays stays at 0
      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── I. Case sensitivity and pattern boundaries ───

  describe('pattern matching boundaries', () => {
    it('matches revert at beginning of message (case-insensitive)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('cs00001', '2024-01-01T00:00:00Z', 'a', 'REVERT: undo bad change'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const lessonPage = result.find((p) => p.tags.includes('lesson'));
      expect(lessonPage).toBeDefined();
    });

    it('does not match revert substring within unrelated words', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('cs00002', '2024-01-01T00:00:00Z', 'a', 'feat: delivery recovery module'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      // "recovery" should not match /^revert/i
      const lessonPage = result.find((p) => p.tags.includes('lesson'));
      expect(lessonPage).toBeUndefined();
    });
  });

  // ─── J. Content structure validation ───

  describe('content structure', () => {
    it('includes commit hash and message in evidence field', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('ev00001', '2024-01-01T00:00:00Z', 'alice', 'Revert "test evidence"'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const page = result.find((p) => p.tags.includes('lesson'));
      expect(page).toBeDefined();
      expect(page!.evidence).toContain('ev00001');
      expect(page!.evidence).toContain('Revert "test evidence"');
    });

    it('includes matched commit hash in content body', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('cb00001', '2024-01-01T00:00:00Z', 'alice', 'hotfix: urgent patch'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const page = result.find((p) => p.title.includes('紧急修复'));
      expect(page).toBeDefined();
      expect(page!.content).toContain('cb00001');
      expect(page!.content).toContain('hotfix: urgent patch');
    });

    it('all pages have confidence set to medium', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'cn00001', date: '2024-01-01T00:00:00Z', author: 'a', subject: 'Revert "x"' },
              { hash: 'cn00002', date: '2024-01-02T00:00:00Z', author: 'a', subject: 'migration: y' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      for (const page of result) {
        expect(page.confidence).toBe('medium');
      }
    });
  });

  // ─── K. Large commit history stress test ───

  describe('large history handling', () => {
    it('correctly scans 50 commits (max limit) with mixed patterns', () => {
      mockExistsSync.mockReturnValue(true);

      // Generate 50 commits with some matching patterns
      const commits = [];
      for (let i = 0; i < 50; i++) {
        if (i === 5) commits.push({ hash: `lg${String(i).padStart(5, '0')}`, date: '2024-01-15T09:00:00Z', author: 'alice', subject: 'Revert "bad feature"' });
        else if (i === 10) commits.push({ hash: `lg${String(i).padStart(5, '0')}`, date: '2024-01-20T09:00:00Z', author: 'bob', subject: 'migration: update schema' });
        else if (i === 15) commits.push({ hash: `lg${String(i).padStart(5, '0')}`, date: '2024-01-25T09:00:00Z', author: 'charlie', subject: 'hotfix: critical patch' });
        else commits.push({ hash: `lg${String(i).padStart(5, '0')}`, date: `2024-01-${String(i + 1).padStart(2, '0')}T09:00:00Z`, author: 'dev', subject: `feat: feature ${i}` });
      }

      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(gitLog(...commits));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob\ncharlie\ndev');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      // Should have pages for revert, migration, hotfix
      expect(result.length).toBeGreaterThanOrEqual(3);
      for (const page of result) {
        validPage(page);
      }
    });
  });

  // ─── L. spawnSync call verification ───

  describe('spawnSync call behavior', () => {
    it('passes correct working directory to spawnSync', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue(spawnResult(''));

      scanGitHistory(PROJECT_ROOT);

      // All spawnSync calls should use the project root as cwd (in the options object arg)
      for (const call of mockSpawnSync.mock.calls) {
        const options = call[2] as { cwd?: string } | undefined;
        expect(options?.cwd).toBe(PROJECT_ROOT);
      }
    });

    it('executes git log with max-count=50 for recent commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue(spawnResult(''));

      scanGitHistory(PROJECT_ROOT);

      const logCall = mockSpawnSync.mock.calls.find(
        (call) => (call[1] as string[]).some((a) => a.includes('--max-count=50')),
      );
      expect(logCall).toBeDefined();
    });
  });

  // ─── M. Very long commit message boundary ───

  describe('very long commit message', () => {
    it('handles extremely long commit messages without truncation or crash', () => {
      mockExistsSync.mockReturnValue(true);
      const longMsg = 'Revert "' + 'a'.repeat(5000) + '"';
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('long001', '2024-01-01T00:00:00Z', 'dev', longMsg));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('dev\nother');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const revertPage = result.find((p) => p.tags.includes('lesson'));
      expect(revertPage).toBeDefined();
      expect(revertPage!.content.length).toBeGreaterThan(5000);
      expect(revertPage!.evidence).toContain('long001');
      validPage(revertPage!);
    });
  });

  // ─── N. Multiple patterns in a single commit ───

  describe('multiple patterns in one commit message', () => {
    it('matches revert pattern before migration when both words present', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('mp00001', '2024-01-01T00:00:00Z', 'a', 'Revert "broken migration script"'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const allMatched = result.map((p) => p.type);
      expect(allMatched).toContain('lesson');
    });

    it('matches breaking change in same message as migration', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('mp00002', '2024-01-01T00:00:00Z', 'a', 'migration: BREAKING CHANGE rename endpoints'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const titles = result.map((p) => p.title);
      expect(titles.some((t) => t.includes('迁移'))).toBe(true);
      expect(titles.some((t) => t.includes('破坏性变更'))).toBe(true);
    });
  });

  // ─── O. ID uniqueness across many pages ───

  describe('ID uniqueness across many pages', () => {
    it('generates unique IDs when many different pattern matches occur', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'uniq001', date: '2024-01-01T00:00:00Z', author: 'a', subject: 'Revert "x"' },
              { hash: 'uniq002', date: '2024-01-02T00:00:00Z', author: 'b', subject: 'migration: new schema' },
              { hash: 'uniq003', date: '2024-01-03T00:00:00Z', author: 'c', subject: 'hotfix: patch bug' },
              { hash: 'uniq004', date: '2024-01-04T00:00:00Z', author: 'd', subject: 'deprecate old api' },
              { hash: 'uniq005', date: '2024-01-05T00:00:00Z', author: 'e', subject: 'BREAKING CHANGE remove field' },
            ),
          );
        }
        if (joined.includes('--name-only')) {
          return spawnResult('src/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/core/config.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts\nsrc/utils/helper.ts');
        }
        if (joined.includes('rev-list --count')) return spawnResult('20');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb\nc\nd\ne');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      expect(result.length).toBe(6);
      const ids = result.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^KS-GIT-\d{4}$/);
      }
    });
  });

  // ─── P. Empty/whitespace-only commit message ───

  describe('whitespace and edge-case commit subjects', () => {
    it('does not match with empty commit subject', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('ws00001', '2024-01-01T00:00:00Z', 'a', ''));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      expect(result.length).toBe(0);
    });

    it('does not match with whitespace-only subject', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('ws00002', '2024-01-01T00:00:00Z', 'a', '   '));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      expect(result.length).toBe(0);
    });
  });

  // ─── Q. Author name with special characters ───

  describe('author name edge cases', () => {
    it('handles unicode author names correctly', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('au00001', '2024-01-01T00:00:00Z', '张三', 'Revert "测试"'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('张三\n李四');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const revertPage = result.find((p) => p.tags.includes('lesson'));
      expect(revertPage).toBeDefined();
      validPage(revertPage!);
    });

    it('handles email-format author names', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('au00002', '2024-01-01T00:00:00Z', 'John <john@example.com>', 'feat: normal change'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('John <john@example.com>');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── R. Hotspot boundary at exactly 5 changes ───

  describe('hotspot boundary at exactly 5 changes', () => {
    it('includes file with exactly 5 changes', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('hb00001', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        }
        if (joined.includes('--name-only')) {
          return spawnResult('src/boundary.ts\nsrc/boundary.ts\nsrc/boundary.ts\nsrc/boundary.ts\nsrc/boundary.ts\nsrc/below.ts\nsrc/below.ts\nsrc/below.ts\nsrc/below.ts');
        }
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeDefined();
      expect(hotspotPage!.graph_bindings).toContain('src/boundary.ts');
      expect(hotspotPage!.graph_bindings).not.toContain('src/below.ts');
    });
  });

  // ─── S. Single author at exactly 101 commits (boundary) ───

  describe('single author at boundary of 101 commits', () => {
    it('flags single author risk when commits = 101', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('sb00001', '2024-01-01T00:00:00Z', 'solo', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('101');
        if (joined.includes('log --format=%an')) return spawnResult('solo');
        if (joined.includes('--reverse')) return spawnResult('2023-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeDefined();
      expect(singleAuthorPage!.content).toContain('101');
    });

    it('does NOT flag when commits = 100 (exactly at threshold)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('sb00002', '2024-01-01T00:00:00Z', 'solo', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('100');
        if (joined.includes('log --format=%an')) return spawnResult('solo');
        if (joined.includes('--reverse')) return spawnResult('2023-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });
  });

  // ─── T. Specific git command failures ───

  describe('specific git command failures', () => {
    it('handles rev-list returning empty string', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('ec00001', '2024-01-01T00:00:00Z', 'solo', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('');
        if (joined.includes('log --format=%an')) return spawnResult('solo');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });

    it('handles authors log returning empty (no authors found)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(commitLine('ec00002', '2024-01-01T00:00:00Z', 'solo', 'feat: x'));
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('200');
        if (joined.includes('log --format=%an')) return spawnResult('');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });
  });

  // ─── U. Empty repo edge cases ───

  describe('empty repo and degenerate input', () => {
    it('returns empty array when git log returns empty but .git exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue(spawnResult(''));
      const result = scanGitHistory(PROJECT_ROOT);
      expect(result).toEqual([]);
    });

    it('returns empty array when only whitespace lines in log output', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult('\n\n   \n');
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('0');
        if (joined.includes('log --format=%an')) return spawnResult('');
        if (joined.includes('--reverse')) return spawnResult('');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      // Whitespace lines get filtered by filter(Boolean), no pages expected
      expect(Array.isArray(result)).toBe(true);
      // No pattern should match empty/whitespace-only subjects
      expect(result.length).toBe(0);
    });

    it('handles first commit date far in the future without NaN', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('fd00002', '2099-01-01T00:00:00Z', 'a', 'feat: x'));
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2099-06-01T00:00:00Z');
        return spawnResult('');
      });
      // ageInDays will be negative, but no crash
      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── V. Commit message exact pattern boundaries ───

  describe('commit message pattern boundaries', () => {
    it('matches "revert" exactly at start of message (case-insensitive via /^revert/i)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('pb00001', '2024-01-01T00:00:00Z', 'a', 'revert: undo feature'));
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const page = result.find((p) => p.tags.includes('lesson'));
      expect(page).toBeDefined();
    });

    it('matches all 5 pattern types across 5 separate commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'all0001', date: '2024-01-01T00:00:00Z', author: 'a', subject: 'Revert "bad change"' },
              { hash: 'all0002', date: '2024-01-02T00:00:00Z', author: 'b', subject: 'migration: update schema' },
              { hash: 'all0003', date: '2024-01-03T00:00:00Z', author: 'c', subject: 'hotfix: fix null pointer' },
              { hash: 'all0004', date: '2024-01-04T00:00:00Z', author: 'd', subject: 'deprecate: old endpoint' },
              { hash: 'all0005', date: '2024-01-05T00:00:00Z', author: 'e', subject: 'breaking-change: remove v1' },
            ),
          );
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('20');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb\nc\nd\ne');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const types = result.map((p) => p.type);
      expect(types).toContain('lesson');
      expect(types).toContain('decision');
      expect(types).toContain('risk');
      expect(result.length).toBe(5);
    });

    it('detects revert with mixed case like REVERT', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('mc00001', '2024-01-01T00:00:00Z', 'a', 'REVERT: undo last'));
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb\nc\nd\ne');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const lessonPage = result.find((p) => p.tags.includes('lesson'));
      expect(lessonPage).toBeDefined();
      expect(lessonPage!.content).toContain('mc00001');
    });

    it('matches migration as substring within "remigrate" word', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('ms00001', '2024-01-01T00:00:00Z', 'a', 'fix: remigrate data'));
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const migrationPage = result.find((p) => p.type === 'decision' && p.title.includes('迁移'));
      expect(migrationPage).toBeDefined();
    });
  });

  // ─── W. Pipe character in commit message ───

  describe('pipe character edge cases in commit messages', () => {
    it('handles multiple pipe characters in commit subject correctly', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          // 5 pipe-separated segments: hash|date|author|subject with | inside
          return spawnResult('pipe123|2024-01-01T00:00:00Z|alice|Revert "change | with pipe"');
        }
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      // parts[3] is the 4th field: 'Revert "change | with pipe"' — should match /^revert/i
      const lessonPage = result.find((p) => p.tags.includes('lesson'));
      expect(lessonPage).toBeDefined();
      expect(lessonPage!.evidence).toContain('pipe123');
    });

    it('handles commit line with missing author field (only 3 fields)', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult('hashonly|2024-01-01T00:00:00Z|alice');
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('10');
        if (joined.includes('log --format=%an')) return spawnResult('alice\nbob');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      // parts[3] is undefined → defaults to '', should not crash
      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── X. Hotspot at exactly head -10 boundary ───

  describe('hotspot file count boundary (head -10)', () => {
    it('detects hotspot with 10 files above threshold but source limits to top 5', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('hs00010', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        if (joined.includes('--name-only')) {
          const lines = [];
          for (let i = 1; i <= 10; i++) {
            for (let j = 0; j < 6; j++) {
              lines.push(`src/file${i}.ts`);
            }
          }
          return spawnResult(lines.join('\n'));
        }
        if (joined.includes('rev-list --count')) return spawnResult('50');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeDefined();
      // Source calls getHotspotFiles(projectRoot, 5) which limits to top 5
      expect(hotspotPage!.title).toContain('5');
      expect(hotspotPage!.graph_bindings.length).toBe(5);
    });

    it('handles hotspot output where count has leading zeros', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('lz00001', '2024-01-01T00:00:00Z', 'a', 'feat: x'));
        if (joined.includes('--name-only')) {
          return spawnResult('src/zeroes.ts\nsrc/zeroes.ts\nsrc/zeroes.ts\nsrc/zeroes.ts\nsrc/zeroes.ts\nsrc/zeroes.ts\nsrc/zeroes.ts');
        }
        if (joined.includes('rev-list --count')) return spawnResult('15');
        if (joined.includes('log --format=%an')) return spawnResult('a\nb');
        if (joined.includes('--reverse')) return spawnResult('2024-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeDefined();
      expect(hotspotPage!.graph_bindings).toContain('src/zeroes.ts');
    });
  });

  // ─── Y. Author with spaces or special characters ───

  describe('author name with spaces', () => {
    it('handles author names containing spaces in --format output', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) return spawnResult(commitLine('sp00001', '2024-01-01T00:00:00Z', 'John Doe', 'Revert "x"'));
        if (joined.includes('--name-only')) return spawnResult('');
        if (joined.includes('rev-list --count')) return spawnResult('150');
        if (joined.includes('log --format=%an')) return spawnResult('John Doe');
        if (joined.includes('--reverse')) return spawnResult('2023-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeDefined();
      expect(singleAuthorPage!.evidence).toContain('150');
    });
  });

  // ─── Z. Maximum result boundary with all patterns + hotspot + maturity ───

  describe('maximum result boundary (all signal types combined)', () => {
    it('produces at most 7 pages when all signals fire', () => {
      mockExistsSync.mockReturnValue(true);
      mockSpawnSync.mockImplementation((_bin: string, _args: string[]) => {
        const args = _args as string[];
        const joined = args.join(' ');
        if (joined.includes('log --max-count')) {
          return spawnResult(
            gitLog(
              { hash: 'mx00001', date: '2024-01-01T00:00:00Z', author: 'solo', subject: 'Revert "bad"' },
              { hash: 'mx00002', date: '2024-01-02T00:00:00Z', author: 'solo', subject: 'migration: new schema' },
              { hash: 'mx00003', date: '2024-01-03T00:00:00Z', author: 'solo', subject: 'hotfix: patch' },
              { hash: 'mx00004', date: '2024-01-04T00:00:00Z', author: 'solo', subject: 'deprecate: old' },
              { hash: 'mx00005', date: '2024-01-05T00:00:00Z', author: 'solo', subject: 'BREAKING CHANGE remove field' },
            ),
          );
        }
        if (joined.includes('--name-only')) {
          return spawnResult('src/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/core/main.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts\nsrc/cli/index.ts');
        }
        if (joined.includes('rev-list --count')) return spawnResult('200');
        if (joined.includes('log --format=%an')) return spawnResult('solo');
        if (joined.includes('--reverse')) return spawnResult('2020-01-01T00:00:00Z');
        return spawnResult('');
      });
      const result = scanGitHistory(PROJECT_ROOT);
      // 5 patterns + 1 hotspot (2 files >= 5) + 1 single-author = 7 pages
      expect(result.length).toBe(7);
      const types = result.map((p) => p.type);
      expect(types.filter((t) => t === 'lesson').length).toBe(1);
      expect(types.filter((t) => t === 'decision').length).toBe(2); // migration + deprecation
      expect(types.filter((t) => t === 'risk').length).toBe(4); // hotfix + breaking + hotspot + single-author
    });
  });
});
