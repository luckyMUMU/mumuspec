/**
 * Deep tests for src/knowledge/scanners/git-scanner.ts
 *
 * Targets: git log parsing, commit message classification, revert detection,
 * merge commit identification, hotspot analysis, project maturity signals,
 * edge cases (no git, malformed output, empty data).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock external dependencies ───

const mockExecSync = vi.fn();
const mockExistsSync = vi.fn();
const mockJoin = vi.fn((...args: string[]) => args.join('/'));

vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
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

/** Create a valid GitCommit log line for --format="%h|%aI||%an|%s" */
function commitLine(hash: string, date: string, author: string, subject: string): string {
  return `${hash}|${date}||${author}|${subject}`;
}

/** Generate a multi-line git log output */
function gitLog(...commits: Array<{ hash: string; date: string; author: string; subject: string }>): string {
  return commits.map((c) => commitLine(c.hash, c.date, c.author, c.subject)).join('\n');
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
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('returns empty array when git command produces no output', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');
      const result = scanGitHistory(PROJECT_ROOT);
      expect(result).toEqual([]);
    });

    it('returns empty array when git command throws (caught by gitExec)', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
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
      mockExecSync.mockImplementation((_cmd: string, options?: { cwd?: string }) => {
        const cmd = _cmd as string;
        const cwd = options as unknown as string;
        void cwd;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'abc1234', date: '2024-01-15T10:30:00Z', author: 'alice', subject: 'Revert "feat: add dark mode"' },
          );
        }
        if (cmd.includes('--name-only')) {
          return '';
        }
        if (cmd.includes('rev-list --count')) {
          return '10';
        }
        if (cmd.includes('log --format="%an"')) {
          return 'alice\nbob';
        }
        if (cmd.includes('--reverse')) {
          return '2024-01-01T00:00:00Z';
        }
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'def5678', date: '2024-02-10T08:00:00Z', author: 'bob', subject: 'feat: migrate database schema to v2' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'aaa1111', date: '2024-03-01T12:00:00Z', author: 'alice', subject: 'hotfix: fix critical login bug' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotfixPage = result.find((p) => p.title.includes('紧急修复'));
      expect(hotfixPage).toBeDefined();
      expect(hotfixPage!.type).toBe('risk');
      validPage(hotfixPage!);
    });

    it('detects deprecation commits and classifies as decision type', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'bbb2222', date: '2024-03-05T09:00:00Z', author: 'charlie', subject: 'chore: deprecate old API endpoints' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const deprPage = result.find((p) => p.title.includes('废弃'));
      expect(deprPage).toBeDefined();
      expect(deprPage!.type).toBe('decision');
      validPage(deprPage!);
    });

    it('detects breaking change commits and classifies as risk type', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'ccc3333', date: '2024-04-01T10:00:00Z', author: 'alice', subject: 'feat(api)!: BREAKING CHANGE remove legacy auth' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'mmm0001', date: '2024-01-20T09:00:00Z', author: 'alice', subject: 'Merge pull request #42 from feature/awesome' },
            { hash: 'mmm0002', date: '2024-01-21T09:00:00Z', author: 'bob', subject: 'Merge branch \'release/v1\' into main' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '20';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'r1aaaaa', date: '2024-01-10T09:00:00Z', author: 'alice', subject: 'Revert "feat A"' },
            { hash: 'r2bbbbb', date: '2024-01-11T09:00:00Z', author: 'bob', subject: 'Revert "feat B"' },
            { hash: 'r3ccccc', date: '2024-01-12T09:00:00Z', author: 'alice', subject: 'revert: undo last change' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '50';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2023-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'x100001', date: '2024-01-10T09:00:00Z', author: 'alice', subject: 'Revert "bad change"' },
            { hash: 'x100002', date: '2024-01-11T09:00:00Z', author: 'bob', subject: 'add migration for user table' },
            { hash: 'x100003', date: '2024-01-12T09:00:00Z', author: 'charlie', subject: 'hotfix: patch security hole' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '50';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob\ncharlie';
        if (cmd.includes('--reverse')) return '2023-06-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'dup0001', date: '2024-02-01T09:00:00Z', author: 'a', subject: 'BREAKING CHANGE: remove field X' },
            { hash: 'dup0002', date: '2024-02-02T09:00:00Z', author: 'b', subject: 'BREAKING CHANGE: remove field Y' },
            { hash: 'dup0003', date: '2024-02-03T09:00:00Z', author: 'c', subject: 'breaking-change: rename endpoint' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '30';
        if (cmd.includes('log --format="%an"')) return 'a\nb\nc';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'hs00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: init project' },
          );
        }
        if (cmd.includes('--name-only')) {
          return [
            '     12\tsrc/core/config.ts\n',
            '      8\tsrc/cli/index.ts\n',
            '      3\tsrc/spec/parser.ts\n',
          ].join('\n');
        }
        if (cmd.includes('rev-list --count')) return '50';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'lo00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: init' },
          );
        }
        if (cmd.includes('--name-only')) {
          return [
            '      4\tsrc/utils/helper.ts\n',
            '      2\tsrc/types.ts\n',
            '      1\tREADME.md\n',
          ].join('\n');
        }
        if (cmd.includes('rev-list --count')) return '20';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const hotspotPage = result.find((p) => p.tags.includes('hotspot'));
      expect(hotspotPage).toBeUndefined();
    });

    it('handles empty hotspot output (no files changed)', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'em00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'docs: update readme' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '5';
        if (cmd.includes('log --format="%an"')) return 'alice';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'sa00001', date: '2024-06-01T09:00:00Z', author: 'solo-dev', subject: 'feat: add feature' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '150';
        if (cmd.includes('log --format="%an"')) return 'solo-dev';
        if (cmd.includes('--reverse')) return '2020-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'ct00001', date: '2024-01-01T09:00:00Z', author: 'only-one', subject: 'initial commit' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '50';
        if (cmd.includes('log --format="%an"')) return 'only-one';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      expect(singleAuthorPage).toBeUndefined();
    });

    it('does NOT flag single author when multiple authors exist even with > 100 commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'ma00001', date: '2024-01-01T09:00:00Z', author: 'alice', subject: 'feat: something' },
            { hash: 'ma00002', date: '2024-01-02T09:00:00Z', author: 'bob', subject: 'fix: bug' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '200';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2022-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'id00001', date: '2024-01-01T09:00:00Z', author: 'a', subject: 'Revert "x"' },
            { hash: 'id00002', date: '2024-01-02T09:00:00Z', author: 'a', subject: 'migration: y' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('r1test1', '2024-01-01T09:00:00Z', 'a', 'Revert "first"');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          // Missing delimiter fields
          return 'hashonly\nmalformed|data\nhash3|2024-01-01T00:00:00Z||author|Revert "valid"';
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      // Should not throw
      const result = scanGitHistory(PROJECT_ROOT);
      expect(Array.isArray(result)).toBe(true);
      // The malformed lines will produce commits with default empty fields,
      // but the revert line should still be detected
      const revertPage = result.find((p) => p.tags.includes('lesson'));
      expect(revertPage).toBeDefined();
    });

    it('handles hotspot lines that do not match expected format', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('mf00001', '2024-01-01T00:00:00Z', 'a', 'feat: x');
        }
        if (cmd.includes('--name-only')) {
          return 'garbage data\nanother bad line\n';
        }
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('nn00001', '2024-01-01T00:00:00Z', 'a', 'feat: x');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return 'not-a-number';
        if (cmd.includes('log --format="%an"')) return 'a';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      // totalCommits should be 0 (parseInt returns NaN → 0)
      const result = scanGitHistory(PROJECT_ROOT);
      const singleAuthorPage = result.find((p) => p.title.includes('单一维护者'));
      // Since totalCommits = 0 (not > 100), single-author check is skipped
      expect(singleAuthorPage).toBeUndefined();
    });

    it('handles first commit date being empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('fd00001', '2024-01-01T00:00:00Z', 'a', 'feat: x');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return ''; // No first commit date
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('cs00001', '2024-01-01T00:00:00Z', 'a', 'REVERT: undo bad change');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const lessonPage = result.find((p) => p.tags.includes('lesson'));
      expect(lessonPage).toBeDefined();
    });

    it('does not match revert substring within unrelated words', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('cs00002', '2024-01-01T00:00:00Z', 'a', 'feat: delivery recovery module');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('ev00001', '2024-01-01T00:00:00Z', 'alice', 'Revert "test evidence"');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const page = result.find((p) => p.tags.includes('lesson'));
      expect(page).toBeDefined();
      expect(page!.evidence).toContain('ev00001');
      expect(page!.evidence).toContain('Revert "test evidence"');
    });

    it('includes matched commit hash in content body', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return commitLine('cb00001', '2024-01-01T00:00:00Z', 'alice', 'hotfix: urgent patch');
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      const page = result.find((p) => p.title.includes('紧急修复'));
      expect(page).toBeDefined();
      expect(page!.content).toContain('cb00001');
      expect(page!.content).toContain('hotfix: urgent patch');
    });

    it('all pages have confidence set to medium', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(
            { hash: 'cn00001', date: '2024-01-01T00:00:00Z', author: 'a', subject: 'Revert "x"' },
            { hash: 'cn00002', date: '2024-01-02T00:00:00Z', author: 'a', subject: 'migration: y' },
          );
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '10';
        if (cmd.includes('log --format="%an"')) return 'a\nb';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
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

      mockExecSync.mockImplementation((_cmd: string) => {
        const cmd = _cmd as string;
        if (cmd.includes('log --max-count')) {
          return gitLog(...commits);
        }
        if (cmd.includes('--name-only')) return '';
        if (cmd.includes('rev-list --count')) return '50';
        if (cmd.includes('log --format="%an"')) return 'alice\nbob\ncharlie\ndev';
        if (cmd.includes('--reverse')) return '2024-01-01T00:00:00Z';
        return '';
      });

      const result = scanGitHistory(PROJECT_ROOT);
      // Should have pages for revert, migration, hotfix
      expect(result.length).toBeGreaterThanOrEqual(3);
      for (const page of result) {
        validPage(page);
      }
    });
  });

  // ─── L. execSync call verification ───

  describe('execSync call behavior', () => {
    it('passes correct working directory to execSync', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      scanGitHistory(PROJECT_ROOT);

      // All execSync calls should use the project root as cwd
      for (const call of mockExecSync.mock.calls) {
        const options = call[1] as { cwd?: string } | undefined;
        expect(options?.cwd).toBe(PROJECT_ROOT);
      }
    });

    it('executes git log with max-count=50 for recent commits', () => {
      mockExistsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('');

      scanGitHistory(PROJECT_ROOT);

      const logCall = mockExecSync.mock.calls.find(
        (call) => (call[0] as string).includes('--max-count=50'),
      );
      expect(logCall).toBeDefined();
    });
  });
});
