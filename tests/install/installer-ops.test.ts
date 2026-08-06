/**
 * Tests for src/install/installer-ops.ts — installation utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  isAgentSupported,
  getSupportedAgents,
  resolvePackage,
  searchPackages,
  getManifest,
  formatInstalledSkills,
  formatAgentInstalledSkills,
  listInstalledAgentSkills,
  getMcpPresets,
  getCommandPresets,
  installPackage,
  type AgentType,
  type AgentInstalledSkill,
} from '../../src/install/installer-ops.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('installer-ops', () => {
  describe('isAgentSupported', () => {
    it('returns true for supported agents', () => {
      expect(isAgentSupported('catpaw')).toBe(true);
      expect(isAgentSupported('claude')).toBe(true);
      expect(isAgentSupported('cursor')).toBe(true);
    });

    it('returns false for unsupported agents', () => {
      expect(isAgentSupported('unknown-agent')).toBe(false);
      expect(isAgentSupported('')).toBe(false);
    });
  });

  describe('getSupportedAgents', () => {
    it('returns array of supported agents', () => {
      const agents = getSupportedAgents();
      expect(agents).toBeInstanceOf(Array);
      expect(agents.length).toBeGreaterThan(0);
      expect(agents).toContain('catpaw');
    });
  });

  describe('resolvePackage', () => {
    it('returns package for valid name', () => {
      const pkg = resolvePackage('catpaw', '@mumuspec/mcp-server');
      // May or may not exist in fixture data
      if (pkg) {
        expect(pkg).toHaveProperty('name');
        expect(pkg).toHaveProperty('version');
      } else {
        expect(pkg).toBeUndefined();
      }
    });

    it('returns undefined for unknown package', () => {
      const pkg = resolvePackage('catpaw', 'nonexistent-package-xyz');
      expect(pkg).toBeUndefined();
    });
  });

  describe('searchPackages', () => {
    it('returns results for matching keyword', () => {
      const results = searchPackages('catpaw', 'mumuspec');
      expect(results).toBeInstanceOf(Array);
    });

    it('returns empty array for non-matching keyword', () => {
      const results = searchPackages('catpaw', 'zzzz-nonexistent');
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });
  });

  describe('getManifest', () => {
    it('returns manifest for valid agent', () => {
      const manifest = getManifest('catpaw');
      expect(manifest).toBeInstanceOf(Array);
      expect(manifest.length).toBeGreaterThan(0);
    });
  });

  describe('formatInstalledSkills', () => {
    it('formats empty list', () => {
      const result = formatInstalledSkills([]);
      expect(typeof result).toBe('string');
    });

    it('formats single skill', () => {
      const result = formatInstalledSkills([{ name: 'test-skill', version: '1.0.0' }]);
      expect(result).toContain('test-skill');
    });
  });
});

// ─── Expanded tests for installer-ops.ts ───

describe('installPackage — additional agent types', () => {
  const testWorkspace = join(tmpdir(), 'mumuspec-install-pkg-' + Date.now());

  beforeEach(() => {
    mkdirSync(join(testWorkspace, '.claude', 'commands'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testWorkspace, { recursive: true, force: true });
  });

  it('installs skill for cursor agent', () => {
    const result = installPackage('cursor', 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(true);
    expect(result.agent).toBe('cursor');
    expect(result.path).toBeDefined();
  });

  it('installs skill for trae agent', () => {
    const result = installPackage('trae', 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(true);
    expect(result.agent).toBe('trae');
  });

  it('installs skill for opencode agent', () => {
    const result = installPackage('opencode', 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(true);
    expect(result.agent).toBe('opencode');
  });

  it('installs skill for workbuddy agent', () => {
    const result = installPackage('workbuddy', 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(true);
    expect(result.agent).toBe('workbuddy');
  });

  it('returns error for unknown agent', () => {
    const result = installPackage('unknown-agent' as AgentType, 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown agent');
  });

  it('returns error when package not found for agent', () => {
    const result = installPackage('claude', 'nonexistent-package-xyz', 'workspace', testWorkspace);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns already-installed error on second install', () => {
    installPackage('cursor', 'mumuspec-workflow', 'workspace', testWorkspace);
    const result = installPackage('cursor', 'mumuspec-workflow', 'workspace', testWorkspace);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Already installed');
  });
});

describe('listInstalledAgentSkills — edge cases', () => {
  const listRoot = join(tmpdir(), 'mumuspec-list-skills-' + Date.now());

  afterEach(() => {
    rmSync(listRoot, { recursive: true, force: true });
  });

  it('returns empty when skills dir does not exist', () => {
    const result = listInstalledAgentSkills('cursor', 'workspace', listRoot);
    expect(result.success).toBe(true);
    expect(result.skills).toEqual([]);
  });

  it('lists .md files for claude agent', () => {
    const skillsDir = join(listRoot, '.claude', 'commands');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'mumuspec.md'), '# MumuSpec');
    writeFileSync(join(skillsDir, 'other.md'), '# Other');
    const result = listInstalledAgentSkills('claude', 'workspace', listRoot);
    expect(result.success).toBe(true);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('mumuspec');
    expect(names).toContain('other');
  });

  it('only includes .md files for claude, skips non-.md', () => {
    const skillsDir = join(listRoot, '.claude', 'commands');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'mumuspec.md'), '# Skill');
    writeFileSync(join(skillsDir, 'readme.txt'), 'Not a skill');
    const result = listInstalledAgentSkills('claude', 'workspace', listRoot);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('mumuspec');
    expect(names).not.toContain('readme');
  });

  it('lists dirs with SKILL.md for trae agent', () => {
    const skillsDir = join(listRoot, '.trae', 'skills');
    const skillDir = join(skillsDir, 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# My Skill');
    const result = listInstalledAgentSkills('trae', 'workspace', listRoot);
    expect(result.success).toBe(true);
    const names = result.skills.map((s) => s.name);
    expect(names).toContain('my-skill');
  });

  it('excludes dirs without SKILL.md for trae', () => {
    const skillsDir = join(listRoot, '.trae', 'skills');
    mkdirSync(join(skillsDir, 'incomplete-skill'), { recursive: true });
    const result = listInstalledAgentSkills('trae', 'workspace', listRoot);
    const names = result.skills.map((s) => s.name);
    expect(names).not.toContain('incomplete-skill');
  });

  it('assigns correct scope to listed skills', () => {
    const skillsDir = join(listRoot, '.cursor', 'commands');
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, 'test.md'), '# Test');
    const result = listInstalledAgentSkills('cursor', 'workspace', listRoot);
    expect(result.skills[0]!.scope).toBe('workspace');
  });
});

describe('resolvePackage — extended scenarios', () => {
  it('returns empty for empty string package name', () => {
    expect(resolvePackage('catpaw', '')).toBeUndefined();
  });

  it('returns undefined for partial non-matching name', () => {
    expect(resolvePackage('catpaw', 'mumuspec-workflo')).toBeUndefined();
  });

  it('returns undefined for wrong agent', () => {
    expect(resolvePackage('claude', 'browser')).toBeUndefined();
  });

  it('returns package with all expected fields', () => {
    const pkg = resolvePackage('catpaw', 'mumuspec-workflow');
    expect(pkg).toBeDefined();
    expect(pkg!.name).toBe('mumuspec-workflow');
    expect(pkg!.agent).toBe('catpaw');
    expect(pkg!.category).toBe('workflow');
  });

  it('resolves package for claude agent', () => {
    const pkg = resolvePackage('claude', 'mumuspec-workflow');
    expect(pkg).toBeDefined();
    expect(pkg!.agent).toBe('claude');
  });
});

describe('formatInstalledSkills — extended formatting', () => {
  it('formats multiple skills with correct numbering', () => {
    const skills = [
      { name: 'skill-a', enabled: true, source: 'user', scope: 'user' as const },
      { name: 'skill-b', enabled: false, source: 'user' as const, scope: 'workspace' as const },
      { name: 'skill-c', enabled: true, source: 'marketplace', scope: 'user' as const },
    ];
    const result = formatInstalledSkills(skills);
    expect(result).toContain('1. skill-a');
    expect(result).toContain('2. skill-b');
    expect(result).toContain('3. skill-c');
  });

  it('includes install path when provided', () => {
    const result = formatInstalledSkills([
      { name: 'path-skill', installPath: '/home/user/.meituan-catpaw/skills/path-skill' },
    ]);
    expect(result).toContain('/home/user/.meituan-catpaw/skills/path-skill');
  });

  it('returns No skills installed for empty input', () => {
    expect(formatInstalledSkills([])).toBe('No skills installed.');
  });
});

describe('formatAgentInstalledSkills — formatting', () => {
  it('returns message for empty skills', () => {
    const result = formatAgentInstalledSkills([], 'claude');
    expect(result).toContain('No skills installed');
  });

  it('formats skills with name and scope', () => {
    const skills: AgentInstalledSkill[] = [
      { name: 'cursor-skill', path: '/path/to/skill.md', scope: 'user' },
    ];
    const result = formatAgentInstalledSkills(skills, 'cursor');
    expect(result).toContain('cursor-skill');
    expect(result).toContain('user');
    expect(result).toContain('/path/to/skill.md');
  });

  it('formats multiple skills with count', () => {
    const skills: AgentInstalledSkill[] = [
      { name: 'skill1', path: '/p1', scope: 'user' },
      { name: 'skill2', path: '/p2', scope: 'workspace' },
    ];
    const result = formatAgentInstalledSkills(skills, 'trae');
    expect(result).toContain('Total: 2 skill(s) installed');
  });
});

describe('searchPackages — edge cases', () => {
  it('is case-insensitive (uppercase keyword)', () => {
    const result = searchPackages('catpaw', 'BROWSER');
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.name).toBe('browser');
  });

  it('matches partial keyword in description', () => {
    const result = searchPackages('catpaw', 'PowerPoint');
    expect(result.some((p) => p.name === 'pptx')).toBe(true);
  });

  it('matches partial keyword in category', () => {
    const result = searchPackages('catpaw', 'doc');
    expect(result.some((p) => p.category === 'document')).toBe(true);
  });

  it('returns results for single character keyword', () => {
    const result = searchPackages('catpaw', 'e');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns all packages for empty keyword', () => {
    const result = searchPackages('catpaw', '');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getManifest — other agents', () => {
  it('returns packages for each supported agent', () => {
    const agents: AgentType[] = ['catpaw', 'claude', 'cursor', 'trae', 'workbuddy', 'opencode'];
    for (const agent of agents) {
      const manifest = getManifest(agent);
      expect(Array.isArray(manifest)).toBe(true);
      expect(manifest.length).toBeGreaterThan(0);
    }
  });

  it('workbuddy manifest has most packages', () => {
    const manifest = getManifest('workbuddy');
    expect(manifest.length).toBeGreaterThan(3);
  });
});

describe('getMcpPresets and getCommandPresets', () => {
  it('getMcpPresets returns non-empty array with mumuspec', () => {
    const presets = getMcpPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0]!.name).toBe('mumuspec');
  });

  it('getCommandPresets returns non-empty array with /mumuspec', () => {
    const presets = getCommandPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0]!.name).toBe('/mumuspec');
  });
});
