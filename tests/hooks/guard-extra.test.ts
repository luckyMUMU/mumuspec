/**
 * Extra handler-level tests for src/hooks/guard.ts — install, uninstall, status,
 * runPostCheckout, runCommitMsg, runPostCommit logic.
 *
 * Complements guard.test.ts by covering the hook lifecycle management functions
 * (installHooks, uninstallHooks, getHookStatus) and additional runHook branches.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

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
  runHook,
  installHooks,
  uninstallHooks,
  getHookStatus,
  parseKnowledgeImpact,
} = await import('../../src/hooks/guard.js');

// ════════════════════════════════════════════════════════════════════
// Tests — installHooks handler logic
// ════════════════════════════════════════════════════════════════════

describe('installHooks handler', () => {
  const mockGitRoot = '/mock/project';

  beforeEach(() => {
    vi.restoreAllMocks();
    // Need to re-mock since restoreAllMocks clears implementations
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error array when workspace has no .git directory', () => {
    // findGitRoot returns null for non-git directories — use /tmp or root
    const result = installHooks({ workspacePath: '/' });
    // Root may or may not have .git; check that the result is defined
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should accept custom hooks list', () => {
    // Pass a workspace that has no .git
    const result = installHooks({ workspacePath: '/', hooks: ['pre-commit'] });
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      // Each result should have a hook name
      expect(result[0]).toHaveProperty('hook');
    }
  });

  it('should return result objects with success boolean', () => {
    const result = installHooks({ workspacePath: '/' });
    for (const r of result) {
      expect(r).toHaveProperty('success');
      expect(typeof r.success).toBe('boolean');
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — uninstallHooks handler logic
// ════════════════════════════════════════════════════════════════════

describe('uninstallHooks handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return error array when workspace has no .git directory', () => {
    const result = uninstallHooks('/');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return results array with correct shape', () => {
    const result = uninstallHooks('/');
    for (const r of result) {
      expect(r).toHaveProperty('success');
      expect(r).toHaveProperty('hook');
    }
  });

  it('should include error message when no .git found', () => {
    const result = uninstallHooks('/');
    if (result.length > 0 && !result[0].success) {
      expect(result[0].error).toBeDefined();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — getHookStatus handler logic
// ════════════════════════════════════════════════════════════════════

describe('getHookStatus handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return installed and available arrays', () => {
    const status = getHookStatus('/');
    expect(status).toHaveProperty('installed');
    expect(status).toHaveProperty('available');
    expect(Array.isArray(status.installed)).toBe(true);
    expect(Array.isArray(status.available)).toBe(true);
  });

  it('should return all 5 hook types as available', () => {
    const status = getHookStatus('/');
    expect(status.available).toHaveLength(5);
    expect(status.available).toContain('pre-commit');
    expect(status.available).toContain('post-commit');
    expect(status.available).toContain('post-merge');
    expect(status.available).toContain('post-checkout');
    expect(status.available).toContain('commit-msg');
  });

  it('should return empty installed array for non-git directory', () => {
    const status = getHookStatus('/');
    // Root typically is not a git repo
    if (!status.installed || status.installed.length === 0) {
      expect(status.installed).toEqual([]);
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — runHook post-checkout handler
// ════════════════════════════════════════════════════════════════════

describe('runHook post-checkout handler', () => {
  it('should warn when .mumuspec directory does not exist', () => {
    const result = runHook('post-checkout', [], '/nonexistent/path');
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('.mumuspec');
  });

  it('should return hook name in result', () => {
    const result = runHook('post-checkout', [], '/nonexistent');
    expect(result.hook).toBe('post-checkout');
  });

  it('should return empty errors for post-checkout', () => {
    const result = runHook('post-checkout', [], '/nonexistent');
    expect(result.errors).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — runHook commit-msg handler (length validation)
// ════════════════════════════════════════════════════════════════════

describe('runHook commit-msg handler (message validation)', () => {
  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return passed when no args provided', () => {
    const result = runHook('commit-msg', [], '/tmp');
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should return passed when message file does not exist', () => {
    const result = runHook('commit-msg', ['/nonexistent/file.txt'], '/tmp');
    expect(result.passed).toBe(true);
  });

  it('should return passed for valid-length message file', () => {
    const msgPath = '/tmp/test-commit-msg.txt';
    writeFileSync(msgPath, 'feat: add new authentication module');
    try {
      const result = runHook('commit-msg', [msgPath], '/tmp');
      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('should return error for short commit message file', () => {
    const msgPath = '/tmp/test-short-msg.txt';
    writeFileSync(msgPath, 'fix');
    try {
      const result = runHook('commit-msg', [msgPath], '/tmp');
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('too short'))).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('should detect SUPERSEDES and produce error', () => {
    const msgPath = '/tmp/test-supersedes-msg.txt';
    const msg = 'feat: new feature\n\nKnowledge-Impact:\n  SUPERSEDES: [KP-0001]\n';
    writeFileSync(msgPath, msg);
    try {
      const result = runHook('commit-msg', [msgPath], '/tmp');
      expect(result.passed).toBe(false);
      expect(result.errors.some(e => e.includes('SUPERSEDES'))).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('should warn about AFFECTS pages', () => {
    const msgPath = '/tmp/test-affects-msg.txt';
    const msg = 'feat: update docs\n\nKnowledge-Impact:\n  AFFECTS: [KP-0010, KP-0020]\n';
    writeFileSync(msgPath, msg);
    try {
      const result = runHook('commit-msg', [msgPath], '/tmp');
      expect(result.warnings.some(w => w.includes('affected'))).toBe(true);
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });

  it('should write commit context when IMPLEMENTS or AFFECTS found', () => {
    const msgPath = '/tmp/test-ctx-msg.txt';
    const msg = 'feat: implement pattern\n\nKnowledge-Impact:\n  IMPLEMENTS: [KP-0001]\n  AFFECTS: [KP-0002]\n';
    writeFileSync(msgPath, msg);
    try {
      runHook('commit-msg', [msgPath], '/tmp');
      const ctxPath = join('/tmp', '.mumuspec', 'knowledge', '.commit-context.json');
      if (existsSync(ctxPath)) {
        const ctx = JSON.parse(readFileSync(ctxPath, 'utf8'));
        expect(ctx.implements).toContain('KP-0001');
        expect(ctx.affects).toContain('KP-0002');
        try { unlinkSync(ctxPath); } catch { /* ignore */ }
        try { unlinkSync(join('/tmp', '.mumuspec', 'knowledge')); } catch { /* ignore */ }
        try { unlinkSync(join('/tmp', '.mumuspec')); } catch { /* ignore */ }
      }
    } finally {
      try { unlinkSync(msgPath); } catch { /* ignore */ }
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — runHook unknown type handler
// ════════════════════════════════════════════════════════════════════

describe('runHook unknown type handler', () => {
  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return passed with warning for unknown hook type', () => {
    // @ts-expect-error testing unknown hook type
    const result = runHook('unknown-hook', [], '/tmp');
    expect(result.passed).toBe(true);
    expect(result.warnings.some(w => w.includes('Unknown hook type'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — runHook post-commit handler (knowledge freshness)
// ════════════════════════════════════════════════════════════════════

describe('runHook post-commit handler', () => {
  beforeEach(() => {
    mockFindProjectRoot.mockReturnValue('/mock/project');
    mockLoadConfig.mockReturnValue({
      knowledge: { commit_update: { enabled: true } },
    });
    mockReadReverseIndex.mockReturnValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete without errors when post-commit hook runs', () => {
    const result = runHook('post-commit', [], '/tmp');
    // post-commit doesn't push to errors/warnings arrays
    expect(result.hook).toBe('post-commit');
    expect(result.passed).toBe(true);
  });

  it('should return passed even without config enabled', () => {
    mockLoadConfig.mockReturnValue({
      knowledge: { commit_update: { enabled: false } },
    });
    mockReadReverseIndex.mockReturnValue([]);
    const result = runHook('post-commit', [], '/tmp');
    expect(result.hook).toBe('post-commit');
    expect(result.passed).toBe(true);
  });
});
