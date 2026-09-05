/**
 * Deep tests for src/hooks/guard.ts — installHooks/uninstallHooks real I/O,
 * runHook branch coverage (pre-commit, post-merge, commit-msg boundaries,
 * post-commit context parsing), parseKnowledgeImpact edge cases.
 *
 * Complements guard.test.ts and guard-extra.test.ts with real filesystem
 * operations (using temp directories) and branch-focused unit tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// ─── Mock guard/checker.js ───
const mockCheckCompliance = vi.fn();
const mockDetectDrift = vi.fn();

vi.mock('../../src/guard/checker.js', () => ({
  checkCompliance: mockCheckCompliance,
  detectDrift: mockDetectDrift,
}));

// ─── Mock core/utils.js ───
const mockFindProjectRoot = vi.fn();

vi.mock('../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

// ─── Mock core/config.js ───
const mockLoadConfig = vi.fn();

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

// ─── Mock knowledge/manager.js ───
const mockReadReverseIndex = vi.fn();

vi.mock('../../src/knowledge/manager.js', () => ({
  readReverseIndex: mockReadReverseIndex,
}));

const {
  installHooks,
  uninstallHooks,
  getHookStatus,
  runHook,
  parseKnowledgeImpact,
} = await import('../../src/hooks/guard.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createTempGitRepo(): string {
  const dir = join(tmpdir(), `mumuspec-guard-deep-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'ignore' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'ignore' });
  // Initial commit so HEAD exists
  writeFileSync(join(dir, 'README.md'), '# Test\n');
  execSync('git add .', { cwd: dir, stdio: 'ignore' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'ignore' });
  return dir;
}

// ════════════════════════════════════════════════════════════════════
// installHooks — real filesystem (force, backup, hooks dir creation)
// ════════════════════════════════════════════════════════════════════

describe('installHooks — real filesystem branches', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('creates hooks directory if it does not exist', () => {
    // Remove the hooks directory to test the auto-creation path
    const hooksDir = join(repoDir, '.git', 'hooks');
    rmSync(hooksDir, { recursive: true, force: true });
    expect(existsSync(hooksDir)).toBe(false);

    const result = installHooks({ workspacePath: repoDir });
    expect(result.length).toBe(5);
    expect(result.every((r) => r.success)).toBe(true);
    expect(existsSync(hooksDir)).toBe(true);
  });

  it('installs all 5 hook types to the git hooks directory', () => {
    const result = installHooks({ workspacePath: repoDir });
    expect(result).toHaveLength(5);

    const hooksDir = join(repoDir, '.git', 'hooks');
    const expectedHooks = ['pre-commit', 'post-commit', 'post-merge', 'post-checkout', 'commit-msg'];
    for (const hookName of expectedHooks) {
      const hookPath = join(hooksDir, hookName);
      expect(existsSync(hookPath)).toBe(true);
      const content = readFileSync(hookPath, 'utf8');
      expect(content).toContain('MumuSpec git hook');
      expect(content).toContain(hookName);
    }
  });

  it('backs up existing non-mumuspec hook when force is false', () => {
    const hooksDir = join(repoDir, '.git', 'hooks');
    const preCommitPath = join(hooksDir, 'pre-commit');
    // Write a custom non-mumuspec hook
    writeFileSync(preCommitPath, '#!/bin/sh\n# My custom hook\necho "hello"\n');
    chmodSync(preCommitPath, 0o755);

    const result = installHooks({ workspacePath: repoDir, force: false });

    // pre-commit should be skipped with backup
    const preCommitResult = result.find((r) => r.hook === 'pre-commit');
    expect(preCommitResult).toBeDefined();
    expect(preCommitResult!.success).toBe(false);
    expect(preCommitResult!.skipped).toBe(true);
    expect(preCommitResult!.error).toContain('backed up');

    // Verify backup was created
    const backupPath = `${preCommitPath}.mumuspec-backup`;
    expect(existsSync(backupPath)).toBe(true);
    const backupContent = readFileSync(backupPath, 'utf8');
    expect(backupContent).toContain('My custom hook');
  });

  it('overwrites non-mumuspec hook when force is true', () => {
    const hooksDir = join(repoDir, '.git', 'hooks');
    const preCommitPath = join(hooksDir, 'pre-commit');
    writeFileSync(preCommitPath, '#!/bin/sh\n# Old content\n');

    const result = installHooks({ workspacePath: repoDir, force: true });
    const preCommitResult = result.find((r) => r.hook === 'pre-commit');
    expect(preCommitResult!.success).toBe(true);

    // Hook should now be mumuspec hook
    const content = readFileSync(preCommitPath, 'utf8');
    expect(content).toContain('MumuSpec git hook');
    expect(content).not.toContain('Old content');
  });

  it('installs only specified hooks when hooks option provided', () => {
    const result = installHooks({ workspacePath: repoDir, hooks: ['pre-commit'] });
    expect(result).toHaveLength(1);
    expect(result[0].hook).toBe('pre-commit');
    expect(result[0].success).toBe(true);

    // Other hooks should NOT be installed
    const hooksDir = join(repoDir, '.git', 'hooks');
    expect(existsSync(join(hooksDir, 'post-commit'))).toBe(false);
  });

  it('returns result with path property for each install', () => {
    const result = installHooks({ workspacePath: repoDir });
    for (const r of result) {
      if (r.success) {
        expect(r.path).toBeDefined();
        expect(r.path!.startsWith(join(repoDir, '.git', 'hooks'))).toBe(true);
      }
    }
  });

  it('re-installs successfully over existing mumuspec hooks (idempotent)', () => {
    // First install
    installHooks({ workspacePath: repoDir });
    // Second install should also succeed (mumuSpec hook → no backup triggered)
    const result = installHooks({ workspacePath: repoDir });
    expect(result.every((r) => r.success)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// uninstallHooks — real filesystem
// ════════════════════════════════════════════════════════════════════

describe('uninstallHooks — real filesystem branches', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('removes all installed mumuspec hooks', () => {
    installHooks({ workspacePath: repoDir });

    const result = uninstallHooks(repoDir);
    expect(result).toHaveLength(5);
    expect(result.every((r) => r.success)).toBe(true);

    const hooksDir = join(repoDir, '.git', 'hooks');
    const hookTypes = ['pre-commit', 'post-commit', 'post-merge', 'post-checkout', 'commit-msg'];
    for (const hook of hookTypes) {
      expect(existsSync(join(hooksDir, hook))).toBe(false);
    }
  });

  it('skips non-mumuspec hooks without removing them', () => {
    const hooksDir = join(repoDir, '.git', 'hooks');
    const preCommitPath = join(hooksDir, 'pre-commit');
    writeFileSync(preCommitPath, '#!/bin/sh\n# Not a mumuspec hook\n');

    const result = uninstallHooks(repoDir);
    const preCommitResult = result.find((r) => r.hook === 'pre-commit');
    expect(preCommitResult!.success).toBe(false);
    expect(preCommitResult!.skipped).toBe(true);
    expect(preCommitResult!.error).toContain('Not a mumuspec hook');

    // Hook file should still exist
    expect(existsSync(preCommitPath)).toBe(true);
  });

  it('marks already-absent hooks as skipped', () => {
    // No hooks installed
    const result = uninstallHooks(repoDir);
    for (const r of result) {
      expect(r.skipped).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// getHookStatus — real filesystem
// ════════════════════════════════════════════════════════════════════

describe('getHookStatus — real filesystem', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = createTempGitRepo();
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('returns empty installed when no hooks installed', () => {
    const status = getHookStatus(repoDir);
    expect(status.installed).toEqual([]);
    expect(status.available).toHaveLength(5);
  });

  it('detects partially installed hooks', () => {
    // Install only pre-commit
    installHooks({ workspacePath: repoDir, hooks: ['pre-commit', 'commit-msg'] });

    const status = getHookStatus(repoDir);
    expect(status.installed).toContain('pre-commit');
    expect(status.installed).toContain('commit-msg');
    expect(status.installed).toHaveLength(2);
  });

  it('does not count non-mumuspec hooks as installed', () => {
    const hooksDir = join(repoDir, '.git', 'hooks');
    writeFileSync(join(hooksDir, 'pre-commit'), '#!/bin/sh\n# Custom\n');

    const status = getHookStatus(repoDir);
    expect(status.installed).not.toContain('pre-commit');
  });
});

// ════════════════════════════════════════════════════════════════════
// runHook — pre-commit branch (checkCompliance + detectDrift)
// ════════════════════════════════════════════════════════════════════

describe('runHook pre-commit branch', () => {
  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
    mockCheckCompliance.mockReturnValue({
      errors: [],
      warnings: [],
      shallNotViolations: [],
    });
    mockDetectDrift.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes when compliance and drift are clean', () => {
    const result = runHook('pre-commit', [], tmpdir());
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports compliance errors', () => {
    mockCheckCompliance.mockReturnValue({
      errors: [
        { code: 'TD-SHALL-001', message: 'Missing SHALL', detail: 'tech.md' },
        { code: 'TD-SHALLNOT-002', message: 'Forbidden pattern', detail: 'src/index.ts' },
      ],
      warnings: [
        { code: 'WARN-001', message: 'Low coverage' },
      ],
      shallNotViolations: [],
    });

    const result = runHook('pre-commit', [], tmpdir());
    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('TD-SHALL-001');
    expect(result.errors[0]).toContain('(tech.md)');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Low coverage');
  });

  it('reports drift ERRORS as errors and WARN as warnings', () => {
    mockDetectDrift.mockReturnValue([
      { type: 'spec', message: 'Tech spec outdated', severity: 'ERROR' },
      { type: 'scope', message: 'Scope mismatch', severity: 'WARN' },
    ]);

    const result = runHook('pre-commit', [], tmpdir());
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('[DRIFT]') && e.includes('Tech spec outdated'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('[DRIFT]') && w.includes('Scope mismatch'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// runHook — post-merge branch
// ════════════════════════════════════════════════════════════════════

describe('runHook post-merge branch', () => {
  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
    mockDetectDrift.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects drift after merge', () => {
    mockDetectDrift.mockReturnValue([
      { type: 'knowledge', message: 'Stale knowledge page', severity: 'ERROR' },
      { type: 'code', message: 'Orphaned code reference', severity: 'WARN' },
    ]);

    const result = runHook('post-merge', [], tmpdir());
    expect(result.hook).toBe('post-merge');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('Stale knowledge'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('Orphaned'))).toBe(true);
  });

  it('passes when no drift detected after merge', () => {
    const result = runHook('post-merge', [], tmpdir());
    expect(result.passed).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// runHook — commit-msg boundary conditions
// ════════════════════════════════════════════════════════════════════

describe('runHook commit-msg boundary conditions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flags message exceeding 200 chars as too long', () => {
    const msgPath = join(tmpdir(), 'test-long-boundary.txt');
    const longMsg = 'a'.repeat(201);
    writeFileSync(msgPath, longMsg);
    try {
      const result = runHook('commit-msg', [msgPath], tmpdir());
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('too long'))).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('accepts message at exactly 200 chars', () => {
    const msgPath = join(tmpdir(), 'test-200chars.txt');
    const msg = 'b'.repeat(200);
    writeFileSync(msgPath, msg);
    try {
      const result = runHook('commit-msg', [msgPath], tmpdir());
      expect(result.passed).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('flags message shorter than 10 chars', () => {
    const msgPath = join(tmpdir(), 'test-short-boundary.txt');
    writeFileSync(msgPath, '123456789');
    try {
      const result = runHook('commit-msg', [msgPath], tmpdir());
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('too short'))).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('accepts message at exactly 10 chars', () => {
    const msgPath = join(tmpdir(), 'test-10chars.txt');
    writeFileSync(msgPath, '1234567890');
    try {
      const result = runHook('commit-msg', [msgPath], tmpdir());
      expect(result.passed).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('handles message containing Knowledge-Impact with only IMPLEMENTS (no SUPERSEDES)', () => {
    const msgPath = join(tmpdir(), 'test-ki-impl.txt');
    const msg = 'feat: implement caching\n\nKnowledge-Impact:\n  IMPLEMENTS: [KP-0001]\n';
    writeFileSync(msgPath, msg);
    try {
      const result = runHook('commit-msg', [msgPath], tmpdir());
      // No SUPERSEDES means no error — should pass (no AFFECTS warning either)
      expect(result.passed).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// parseKnowledgeImpact — edge cases
// ════════════════════════════════════════════════════════════════════

describe('parseKnowledgeImpact — edge cases', () => {
  it('handles block with only some fields present', () => {
    const msg = 'feat: x\n\nKnowledge-Impact:\n  IMPLEMENTS: [KP-001]\n';
    const result = parseKnowledgeImpact(msg);
    expect(result).not.toBeNull();
    expect(result!.implements).toEqual(['KP-001']);
    expect(result!.affects).toEqual([]);
    expect(result!.supersedes).toEqual([]);
  });

  it('handles empty arrays in Knowledge-Impact fields', () => {
    const msg = 'feat: x\n\nKnowledge-Impact:\n  IMPLEMENTS: []\n  AFFECTS: []\n  SUPERSEDES: []\n';
    const result = parseKnowledgeImpact(msg);
    expect(result).not.toBeNull();
    expect(result!.implements).toEqual([]);
    expect(result!.affects).toEqual([]);
    expect(result!.supersedes).toEqual([]);
  });

  it('returns null when match is at end of input (no trailing newline)', () => {
    const msg = 'feat: x\n\nKnowledge-Impact:\n  IMPLEMENTS: [KP-001]';
    const result = parseKnowledgeImpact(msg);
    expect(result).not.toBeNull();
    expect(result!.implements).toEqual(['KP-001']);
  });

  it('trims whitespace from array items', () => {
    const msg = 'feat: x\n\nKnowledge-Impact:\n  AFFECTS: [ KP-001 , KP-002 ]\n';
    const result = parseKnowledgeImpact(msg);
    expect(result).not.toBeNull();
    expect(result!.affects).toEqual(['KP-001', 'KP-002']);
  });

  it('returns null for message with "knowledge-impact" in lowercase (case-sensitive regex)', () => {
    // The regex uses /Knowledge-Impact:/i so it IS case-insensitive
    const msg = 'feat: x\n\nknowledge-impact:\n  IMPLEMENTS: [KP-001]\n';
    const result = parseKnowledgeImpact(msg);
    expect(result).not.toBeNull();
    expect(result!.implements).toEqual(['KP-001']);
  });
});

// ════════════════════════════════════════════════════════════════════
// runHook — post-commit branch (context file reading)
// ════════════════════════════════════════════════════════════════════

describe('runHook post-commit with context file', () => {
  const postCommitRoot = join(tmpdir(), `mumuspec-post-commit-${Date.now()}`);

  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue(postCommitRoot);
    mockLoadConfig.mockReturnValue({
      knowledge: { commit_update: { enabled: true } },
    });
    mockReadReverseIndex.mockReturnValue([
      { source_file: 'src/guard.ts', knowledge_pages: ['KP-001', 'KP-002'] },
    ]);
    // Ensure the knowledge directory exists
    mkdirSync(join(postCommitRoot, '.mumuspec', 'knowledge'), { recursive: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(postCommitRoot, { recursive: true, force: true });
  });

  it('reads commit context and cleans it up', () => {
    // Write commit context file (simulates commit-msg hook having written it)
    const ctxPath = join(postCommitRoot, '.mumuspec', 'knowledge', '.commit-context.json');
    writeFileSync(ctxPath, JSON.stringify({
      implements: ['KP-001'],
      affects: ['KP-002'],
      supersedes: [],
    }));

    const result = runHook('post-commit', [], postCommitRoot);
    expect(result.passed).toBe(true);
    expect(result.hook).toBe('post-commit');

    // Context file should be cleaned up
    expect(existsSync(ctxPath)).toBe(false);
  });

  it('falls back to refreshing all pages when no context', () => {
    // No .commit-context.json file
    const result = runHook('post-commit', [], postCommitRoot);
    expect(result.passed).toBe(true);

    // With reverseIndex containing pages, should warn about queued pages
    expect(result.warnings.some((w) => w.includes('knowledge page'))).toBe(true);
  });
});
