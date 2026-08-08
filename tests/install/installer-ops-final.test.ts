/**
 * Final coverage push for src/install/installer-ops.ts — targets remaining
 * uncovered lines/branches to go from ~89.67% to 95%+.
 *
 * Specifically targets:
 *   - Lines 212-214: installCatpawPackage outer catch block
 *   - Lines 247, 263: installCatpawPackage installPath construction + update mode
 *   - Lines 295-297: installMumuspecWorkflowSkill catch block
 *   - Lines 326-328: installCatpawMcp catch block
 *   - Lines 348-349: listInstalledMcp catch block
 *   - Lines 368-372: installCatpawCommand user target (home & no-home)
 *   - Lines 384-387: installCatpawCommand catch block
 *   - Lines 513-519: listInstalledAgentSkills catch block
 *
 * Plus additional edge cases:
 *   - installCatpawMcp: existing config without mcpServers key
 *   - listInstalledAgentSkills: claude/cursor directory entries are skipped
 *   - formatInstalledSkills: scope inference from installPath
 *   - listInstalledCatpaw: JSON edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Mock execSync ────────────────────────────────────────────────
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import {
  installPackage,
  installCatpawMcp,
  installCatpawCommand,
  listInstalledCatpaw,
  listInstalledMcp,
  listInstalledAgentSkills,
  formatInstalledSkills,
  type AgentType,
} from '../../src/install/installer-ops.js';

const uniqueId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 8);

// ════════════════════════════════════════════════════════════════════
// installCatpawPackage — outer catch block (lines 212-214)
// Triggered when execSync throws, caught by the outer try/catch
// Also covers line 247 (installPath with workspace) and line 263 (update mode)
// ════════════════════════════════════════════════════════════════════

describe('installCatpawPackage — outer catch block (lines 212-214, 247, 263)', () => {
  const testRoot = join(tmpdir(), 'mumuspec-cp-catch-' + uniqueId());

  beforeEach(async () => {
    mkdirSync(join(testRoot, '.meituan-catpaw', 'skills'), { recursive: true });
    mkdirSync(join(testRoot, '.catpaw', 'commands'), { recursive: true });
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReset();
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('returns error when execSync throws (outer catch block, lines 212-214)', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('spawn paw ENOENT');
    });

    const result = installPackage('catpaw', 'browser', 'workspace', testRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to install');
    expect(result.error).toContain('spawn paw ENOENT');
  });

  it('verifies install success response shape (line 254 path assignment)', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReturnValueOnce('skill installed successfully');

    const result = installPackage('catpaw', 'browser', 'workspace', testRoot);
    // When output is non-JSON but contains "success", installSuccess = true
    // installPath stays undefined but line 254 is still executed
    expect(result.success).toBe(true);
    expect(result.agent).toBe('catpaw');
  });

  it('returns marketplace update failed message in update mode (line 263)', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('registry timeout');
    });

    const result = installPackage('catpaw', 'browser', 'workspace', testRoot, 'update');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Marketplace update failed');
    expect(result.error).toContain('registry timeout');
  });
});

// ════════════════════════════════════════════════════════════════════
// installCatpawCommand — catch block (lines 384-387)
// Triggered by making .catpaw a FILE (not dir), causing mkdirSync to throw
// ════════════════════════════════════════════════════════════════════

describe('installCatpawCommand — catch block (lines 384-387)', () => {
  const cmdRoot = join(tmpdir(), 'mumuspec-cmd-err-' + uniqueId());
  let cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      rmSync(p, { recursive: true, force: true });
    }
    cleanupPaths = [];
  });

  it('returns error when mkdirSync fails because .catpaw exists as a file', () => {
    mkdirSync(cmdRoot, { recursive: true });
    cleanupPaths.push(cmdRoot);

    // Create .catpaw as a filesystem file — this makes mkdirSync(
    // join(cmdRoot, '.catpaw', 'commands')) fail with ENOTDIR
    writeFileSync(join(cmdRoot, '.catpaw'), 'this is a file not a dir');

    const result = installCatpawCommand('/mumuspec', 'workspace', cmdRoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed:');
  });

  it('returns error when writeFileSync fails (parent path is a file)', () => {
    mkdirSync(cmdRoot, { recursive: true });
    cleanupPaths.push(cmdRoot);

    // Make .catpaw/commands a FILE — writeFileSync to its child fails
    mkdirSync(join(cmdRoot, '.catpaw'), { recursive: true });
    writeFileSync(join(cmdRoot, '.catpaw', 'commands'), 'im a file');

    const result = installCatpawCommand('/mumuspec', 'workspace', cmdRoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('Failed:');
  });
});

// ════════════════════════════════════════════════════════════════════
// listInstalledAgentSkills — catch block (lines 513-519)
// Triggered by making the skillsDir a FILE so readdirSync throws ENOTDIR
// ════════════════════════════════════════════════════════════════════

describe('listInstalledAgentSkills — catch block (lines 513-519)', () => {
  let cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      rmSync(p, { recursive: true, force: true });
    }
    cleanupPaths = [];
  });

  it('returns error when skillsDir is actually a file (claude)', () => {
    const scanRoot = join(tmpdir(), 'mumuspec-scan-file-' + uniqueId());
    const claudeDir = join(scanRoot, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    cleanupPaths.push(scanRoot);

    // Make 'commands' a FILE instead of directory — readdirSync throws ENOTDIR
    writeFileSync(join(claudeDir, 'commands'), 'not a directory');

    const result = listInstalledAgentSkills('claude', 'workspace', scanRoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.skills).toEqual([]);
  });

  it('returns error when skillsDir is actually a file (cursor)', () => {
    const scanRoot = join(tmpdir(), 'mumuspec-scan-file-cur-' + uniqueId());
    const cursorDir = join(scanRoot, '.cursor');
    mkdirSync(cursorDir, { recursive: true });
    cleanupPaths.push(scanRoot);

    writeFileSync(join(cursorDir, 'commands'), 'not a directory');

    const result = listInstalledAgentSkills('cursor', 'workspace', scanRoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.skills).toEqual([]);
  });

  it('returns error when skillsDir is a file (trae)', () => {
    const scanRoot = join(tmpdir(), 'mumuspec-scan-file-trae-' + uniqueId());
    const traeDir = join(scanRoot, '.trae');
    mkdirSync(traeDir, { recursive: true });
    cleanupPaths.push(scanRoot);

    writeFileSync(join(traeDir, 'skills'), 'not a directory');

    const result = listInstalledAgentSkills('trae', 'workspace', scanRoot);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.skills).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// installCatpawMcp — existing config without mcpServers key (lines 312-313)
// and error path at catch block (lines 326-328)
// ════════════════════════════════════════════════════════════════════

describe('installCatpawMcp — edge cases', () => {
  const mcpRoot = join(tmpdir(), 'mumuspec-mcp-final-' + uniqueId());

  afterEach(() => {
    rmSync(mcpRoot, { recursive: true, force: true });
  });

  it('handles existing .mcp.json without mcpServers key', () => {
    mkdirSync(mcpRoot, { recursive: true });
    writeFileSync(join(mcpRoot, '.mcp.json'), JSON.stringify({ someOtherField: true }));

    const result = installCatpawMcp('mumuspec', mcpRoot);
    expect(result.success).toBe(true);

    const content = JSON.parse(readFileSync(join(mcpRoot, '.mcp.json'), 'utf8'));
    expect(content.someOtherField).toBe(true);
    expect(content.mcpServers).toBeDefined();
    expect(content.mcpServers.mumuspec).toBeDefined();
  });

  it('handles existing .mcp.json with malformed JSON (graceful fallback)', () => {
    mkdirSync(mcpRoot, { recursive: true });
    writeFileSync(join(mcpRoot, '.mcp.json'), 'not valid json{{{');

    const result = installCatpawMcp('mumuspec', mcpRoot);
    expect(result.success).toBe(true);

    const content = JSON.parse(readFileSync(join(mcpRoot, '.mcp.json'), 'utf8'));
    expect(content.mcpServers).toBeDefined();
    expect(content.mcpServers.mumuspec).toBeDefined();
  });

  it('preserves complex existing env vars and substitutes workspaceRoot', () => {
    mkdirSync(mcpRoot, { recursive: true });
    writeFileSync(join(mcpRoot, '.mcp.json'), JSON.stringify({
      mcpServers: {
        'other-server': { command: 'node', args: ['--experimental'] },
      },
    }));

    const result = installCatpawMcp('mumuspec', mcpRoot);
    expect(result.success).toBe(true);

    const content = JSON.parse(readFileSync(join(mcpRoot, '.mcp.json'), 'utf8'));
    expect(content.mcpServers['other-server']).toBeDefined();
    expect(content.mcpServers['other-server'].args).toEqual(['--experimental']);
    expect(content.mcpServers.mumuspec.env.MUMUSPEC_ROOT).toBe(mcpRoot);
  });

  it('returns error when .mcp.json exists as a directory (catch block, lines 326-328)', () => {
    mkdirSync(mcpRoot, { recursive: true });

    // Make .mcp.json a DIRECTORY — writeFileSync throws EISDIR → outer catch
    mkdirSync(join(mcpRoot, '.mcp.json'), { recursive: true });

    const result = installCatpawMcp('mumuspec', mcpRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed:');
  });
});

// ════════════════════════════════════════════════════════════════════
// installCatpawCommand — user target without home dir (lines 368-370)
// and user target with home dir set (lines 371-372)
// ════════════════════════════════════════════════════════════════════

describe('installCatpawCommand — user target edge cases (lines 368-372)', () => {
  it('returns error when home dir cannot be determined (lines 368-370)', () => {
    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;

    delete process.env.HOME;
    delete process.env.USERPROFILE;

    try {
      const result = installCatpawCommand('/mumuspec', 'user');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot determine home');
    } finally {
      process.env.HOME = origHome;
      process.env.USERPROFILE = origUserProfile;
    }
  });

  it('installs to user global .catpaw/commands when HOME is set (lines 371-372)', () => {
    const fakeHome = join(tmpdir(), 'mumuspec-fake-home-' + uniqueId());
    mkdirSync(join(fakeHome, '.catpaw', 'commands'), { recursive: true });

    const origHome = process.env.HOME;
    const origUserProfile = process.env.USERPROFILE;
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;

    try {
      const result = installCatpawCommand('/mumuspec', 'user');
      expect(result.success).toBe(true);
      expect(result.path).toContain(join(fakeHome, '.catpaw', 'commands'));
    } finally {
      process.env.HOME = origHome;
      process.env.USERPROFILE = origUserProfile;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});

// ════════════════════════════════════════════════════════════════════
// listInstalledAgentSkills — claude/cursor directory entries are skipped
// ════════════════════════════════════════════════════════════════════

describe('listInstalledAgentSkills — directory entries skipped for claude/cursor', () => {
  let cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      rmSync(p, { recursive: true, force: true });
    }
    cleanupPaths = [];
  });

  it('skips subdirectory entries in claude commands dir (only .md files)', () => {
    const dirRoot = join(tmpdir(), 'mumuspec-dir-skip-' + uniqueId());
    const skillsDir = join(dirRoot, '.claude', 'commands');
    mkdirSync(skillsDir, { recursive: true });
    cleanupPaths.push(dirRoot);

    writeFileSync(join(skillsDir, 'valid-skill.md'), '# Valid Skill');
    // Create a subdirectory (should be skipped for claude)
    mkdirSync(join(skillsDir, 'sub-dir-skill'), { recursive: true });
    writeFileSync(join(skillsDir, 'sub-dir-skill', 'SKILL.md'), '# Sub Dir');

    const result = listInstalledAgentSkills('claude', 'workspace', dirRoot);
    expect(result.success).toBe(true);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('valid-skill');
    expect(names).not.toContain('sub-dir-skill');
  });

  it('skips subdirectory entries in cursor commands dir', () => {
    const dirRoot = join(tmpdir(), 'mumuspec-dir-skip-cur-' + uniqueId());
    const skillsDir = join(dirRoot, '.cursor', 'commands');
    mkdirSync(skillsDir, { recursive: true });
    cleanupPaths.push(dirRoot);

    writeFileSync(join(skillsDir, 'cursor-cmd.md'), '# Cursor Command');
    mkdirSync(join(skillsDir, 'some-unrelated-dir'), { recursive: true });

    const result = listInstalledAgentSkills('cursor', 'workspace', dirRoot);
    expect(result.success).toBe(true);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('cursor-cmd');
    expect(names).not.toContain('some-unrelated-dir');
  });

  it('non-claude/cursor agents scan directories and match SKILL.md', () => {
    const dirRoot = join(tmpdir(), 'mumuspec-dir-skip-opencode-' + uniqueId());
    const skillsDir = join(dirRoot, '.opencode', 'skills');
    const skillDir = join(skillsDir, 'deep-skill');
    mkdirSync(skillDir, { recursive: true });
    cleanupPaths.push(dirRoot);

    writeFileSync(join(skillDir, 'SKILL.md'), '# Deep Skill');
    // Stray file at skill root level (should not match for opencode)
    writeFileSync(join(skillsDir, 'random-file.txt'), 'not a skill');

    const result = listInstalledAgentSkills('opencode', 'workspace', dirRoot);
    expect(result.success).toBe(true);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('deep-skill');
    expect(names).not.toContain('random-file');
  });
});

// ════════════════════════════════════════════════════════════════════
// formatInstalledSkills — scope inference (lines 450-453) and edge cases
// ════════════════════════════════════════════════════════════════════

describe('formatInstalledSkills — scope inference and edge cases', () => {
  it('infers user scope from installPath containing .meituan-catpaw', () => {
    const result = formatInstalledSkills([
      { name: 'path-derived', installPath: '/home/user/.meituan-catpaw/skills/path-derived', source: 'user' },
    ]);
    expect(result).toContain('user');
    expect(result).toContain('/home/user/.meituan-catpaw/skills/path-derived');
  });

  it('uses workspace scope when installPath does not contain .meituan-catpaw', () => {
    const result = formatInstalledSkills([
      { name: 'ws-skill', installPath: '/some/workspace/.catpaw/skills/ws-skill', source: 'user' },
    ]);
    expect(result).toContain('workspace');
    expect(result).toContain('/some/workspace/.catpaw/skills/ws-skill');
  });

  it('uses skill.source when source is marketplace', () => {
    const result = formatInstalledSkills([
      { name: 'market-skill', enabled: true, source: 'marketplace', scope: 'user' },
    ]);
    expect(result).toContain('marketplace');
  });

  it('marks disabled skills with disabled status', () => {
    const result = formatInstalledSkills([
      { name: 'off-skill', enabled: false, source: 'user', scope: 'user' },
    ]);
    expect(result).toContain('disabled');
  });

  it('defaults to enabled when skill.enabled is undefined', () => {
    const result = formatInstalledSkills([
      { name: 'on-skill', source: 'user', scope: 'user' },
    ]);
    expect(result).toContain('enabled');
  });
});

// ════════════════════════════════════════════════════════════════════
// listInstalledCatpaw — JSON edge cases via mocked execSync
// ════════════════════════════════════════════════════════════════════

describe('listInstalledCatpaw — JSON edge cases', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty skills when JSON has no skills field', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      JSON.stringify({ totalCount: 0, meta: {} }),
    );

    const result = listInstalledCatpaw();
    expect(result.success).toBe(true);
    expect(result.skills).toEqual([]);
  });

  it('returns empty skills when JSON result has skills as empty array', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      JSON.stringify({ skills: [] }),
    );

    const result = listInstalledCatpaw();
    expect(result.success).toBe(true);
    expect(result.skills).toEqual([]);
  });

  it('returns skills from properly structured JSON', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      JSON.stringify({
        skills: [
          { name: 'browser', installPath: '/path/to/browser', source: 'marketplace' },
          { name: 'mumuspec', installPath: '/path/to/mumuspec', source: 'user' },
        ],
      }),
    );

    const result = listInstalledCatpaw();
    expect(result.success).toBe(true);
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0].name).toBe('browser');
  });

  it('returns error when execSync throws', async () => {
    const { execSync } = await import('node:child_process');
    (execSync as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('paw not found');
    });

    const result = listInstalledCatpaw();
    expect(result.success).toBe(false);
    expect(result.skills).toEqual([]);
    expect(result.error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// listInstalledMcp — error path (catch block, lines 348-349)
// Triggered by passing invalid workspacePath causing TypeError
// ════════════════════════════════════════════════════════════════════

describe('listInstalledMcp — error path (catch block, lines 348-349)', () => {
  it('returns error when workspacePath causes a TypeError', () => {
    // Passing null as workspacePath causes join() to throw,
    // which is caught by the outer try-catch → returns error result
    const result = listInstalledMcp(null as unknown as string);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.installed).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// installPackage — additional generic agent / error paths
// ════════════════════════════════════════════════════════════════════

describe('installPackage — additional generic agent install paths', () => {
  const testRoot = join(tmpdir(), 'mumuspec-install-extra-' + uniqueId());

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('cursor agent — installs to flat .md file with command override', () => {
    mkdirSync(join(testRoot, '.cursor', 'commands'), { recursive: true });

    const result = installPackage('cursor', 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(result.path).toMatch(/\.md$/);
  });

  it('claude agent — installs to .md file in commands dir', () => {
    mkdirSync(join(testRoot, '.claude', 'commands'), { recursive: true });

    const result = installPackage('claude', 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(true);
    expect(result.path).toMatch(/\.md$/);
  });

  it('trae agent — installs to subdirectory with SKILL.md', () => {
    mkdirSync(join(testRoot, '.trae', 'skills'), { recursive: true });

    const result = installPackage('trae', 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(true);
    expect(result.path).toContain('SKILL.md');
  });

  it('workbuddy agent — installs to subdirectory with SKILL.md', () => {
    mkdirSync(join(testRoot, '.workbuddy', 'skills'), { recursive: true });

    const result = installPackage('workbuddy', 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(true);
    expect(result.path).toContain('SKILL.md');
  });

  it('opencode agent — installs to subdirectory with SKILL.md', () => {
    mkdirSync(join(testRoot, '.opencode', 'skills'), { recursive: true });

    const result = installPackage('opencode', 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(true);
    expect(result.path).toContain('SKILL.md');
  });

  it('returns error for unknown agent type', () => {
    const result = installPackage('codex' as AgentType, 'mumuspec-workflow', 'workspace', testRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown agent');
  });

  it('returns error for package not in agent manifest', () => {
    mkdirSync(join(testRoot, '.claude', 'commands'), { recursive: true });
    const result = installPackage('claude', 'package-not-exist-xyz', 'workspace', testRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ════════════════════════════════════════════════════════════════════
// installCatpawCommand — additional preset and path edge cases
// ════════════════════════════════════════════════════════════════════

describe('installCatpawCommand — additional preset and path edge cases', () => {
  const cmdRoot = join(tmpdir(), 'mumuspec-cmd-extra-' + uniqueId());

  afterEach(() => {
    rmSync(cmdRoot, { recursive: true, force: true });
  });

  it('installs command with /mumuspec preset to workspace', () => {
    mkdirSync(join(cmdRoot, '.catpaw', 'commands'), { recursive: true });
    const result = installCatpawCommand('/mumuspec', 'workspace', cmdRoot);
    expect(result.success).toBe(true);
    expect(existsSync(result.path!)).toBe(true);
  });

  it('returns error for unknown command preset', () => {
    const result = installCatpawCommand('/nonexistent-preset', 'workspace', cmdRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error when command already installed (duplicate)', () => {
    mkdirSync(join(cmdRoot, '.catpaw', 'commands'), { recursive: true });
    const r1 = installCatpawCommand('/mumuspec', 'workspace', cmdRoot);
    expect(r1.success).toBe(true);
    const r2 = installCatpawCommand('/mumuspec', 'workspace', cmdRoot);
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('already installed');
  });
});

// ════════════════════════════════════════════════════════════════════
// installMumuspecWorkflowSkill — error path (catch block, lines 295-297)
// ════════════════════════════════════════════════════════════════════

describe('installMumuspecWorkflowSkill — error path (catch block, lines 295-297)', () => {
  let cleanupPaths: string[] = [];

  afterEach(() => {
    for (const p of cleanupPaths) {
      rmSync(p, { recursive: true, force: true });
    }
    cleanupPaths = [];
  });

  it('returns error when skills component dir exists as a file (workspace target)', () => {
    const wfRoot = join(tmpdir(), 'mumuspec-wf-err-' + uniqueId());
    mkdirSync(join(wfRoot, '.meituan-catpaw'), { recursive: true });
    cleanupPaths.push(wfRoot);

    // Make 'skills' a FILE so mkdirSync(targetDir) throws
    writeFileSync(join(wfRoot, '.meituan-catpaw', 'skills'), 'this blocks dir creation');

    const result = installPackage('catpaw', 'mumuspec-workflow', 'workspace', wfRoot);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed:');
  });

  it('returns error when user target data dir component is a file', () => {
    const fakeDataDir = join(tmpdir(), 'mumuspec-datadir-err-' + uniqueId());
    mkdirSync(fakeDataDir, { recursive: true });
    cleanupPaths.push(fakeDataDir);

    // Make 'skills' a FILE so mkdirSync(join(dataDir, 'skills', 'mumuspec-workflow')) throws
    writeFileSync(join(fakeDataDir, 'skills'), 'blocking file');

    const origCatpawHome = process.env.CATPAW_HOME;
    process.env.CATPAW_HOME = fakeDataDir;

    try {
      const result = installPackage('catpaw', 'mumuspec-workflow', 'user');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed:');
    } finally {
      if (origCatpawHome !== undefined) {
        process.env.CATPAW_HOME = origCatpawHome;
      } else {
        delete process.env.CATPAW_HOME;
      }
    }
  });
});
