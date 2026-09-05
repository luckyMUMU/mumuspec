/**
 * E2E: goal-p0-dispatch-gate rule distribution (TC-A1 / TC-A1x / TC-A4 / C3).
 *
 * Real temporary workspaces + real installer pipeline — no mocks:
 * - TC-A1: codex e2e — skills land in .codex/skills, canonical AGENTS.md rides along
 * - TC-A1x: 4-agent smoke — copilot writes zero extra files under .github/
 * - TC-A4: full-agent generation tree contains no .cursorrules/.windsurfrules
 * - C3: 存量 legacy 文件不被删除、不被覆盖（停止生成 ≠ 删除存量）
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPackage } from '../../src/install/installer.js';
import { MANAGED_MARKER } from '../../src/install/rules-generator.js';
import type { AgentType } from '../../src/install/installer.js';

const roots: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumuspec-e2e-rules-'));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const r of roots.splice(0)) {
    try { rmSync(r, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

/** Recursively collect all file paths under a directory */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('TC-A1 — codex e2e: skills + canonical AGENTS.md', () => {
  it('installs mumuspec-workflow to .codex/skills and drops canonical AGENTS.md', () => {
    const root = makeRoot();

    const result = installPackage('codex', 'mumuspec-workflow', 'workspace', root, 'install');

    expect(result.success).toBe(true);
    expect(result.path).toMatch(/\.codex[\\/]skills[\\/]mumuspec-workflow[\\/]SKILL\.md$/);
    expect(existsSync(join(root, '.codex', 'skills', 'mumuspec-workflow', 'SKILL.md'))).toBe(true);

    const rulesPath = join(root, 'AGENTS.md');
    expect(existsSync(rulesPath)).toBe(true);
    const content = readFileSync(rulesPath, 'utf8');
    expect(content).toContain(MANAGED_MARKER);
    expect(content).toContain('## CLI 速查');
    expect(content).toContain('## MCP 入口');
  });

  it('second install (mode=install) → Already installed; update succeeds', () => {
    const root = makeRoot();
    installPackage('codex', 'mumuspec-workflow', 'workspace', root, 'install');

    const again = installPackage('codex', 'mumuspec-workflow', 'workspace', root, 'install');
    expect(again.success).toBe(false);
    expect(again.error).toContain('Already installed');

    const updated = installPackage('codex', 'mumuspec-workflow', 'workspace', root, 'update');
    expect(updated.success).toBe(true);
  });
});

describe('TC-A1x — 4-agent smoke (copilot .github 零额外文件)', () => {
  it('codex / windsurf / gemini distribute directory-style skills + rules', () => {
    const root = makeRoot();

    for (const agent of ['codex', 'windsurf', 'gemini'] as AgentType[]) {
      const result = installPackage(agent, 'mumuspec-workflow', 'workspace', root, 'install');
      expect(result.success).toBe(true);
      // 当前 agent 的 skills 目录必须存在（目录式 SKILL.md）
      const skillsFile = join(root, `.${agent}`, 'skills', 'mumuspec-workflow', 'SKILL.md');
      expect(existsSync(skillsFile)).toBe(true);
      expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    }
  });

  it('gemini also receives GEMINI.md thin-shell bridge (first line @AGENTS.md)', () => {
    const root = makeRoot();
    installPackage('gemini', 'mumuspec-workflow', 'workspace', root, 'install');

    const bridgePath = join(root, 'GEMINI.md');
    expect(existsSync(bridgePath)).toBe(true);
    const lines = readFileSync(bridgePath, 'utf8').split('\n');
    expect(lines[0]).toBe('@AGENTS.md');
  });

  it('copilot: AGENTS.md written, ZERO extra files under .github/', () => {
    const root = makeRoot();
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
    // 预置 .github 存量文件，验证未被触碰
    const existing = join(root, '.github', 'workflows', 'ci.yml');
    writeFileSync(existing, '# pre-existing\n', 'utf8');

    const result = installPackage('copilot', 'mumuspec-workflow', 'workspace', root, 'install');

    expect(result.success).toBe(true);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);

    const githubFiles = walk(join(root, '.github'));
    expect(githubFiles).toEqual([existing]);
    expect(readFileSync(existing, 'utf8')).toBe('# pre-existing\n');
  });

  it('copilot: user-owned AGENTS.md is skipped with diagnostic (no clobber)', () => {
    const root = makeRoot();
    const userContent = '# Handwritten Copilot Rules\n';
    writeFileSync(join(root, 'AGENTS.md'), userContent, 'utf8');

    const result = installPackage('copilot', 'mumuspec-workflow', 'workspace', root, 'install');

    expect(result.success).toBe(false);
    expect(result.error).toContain('未写入');
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe(userContent);
  });

  it('copilot: --force (update) takes over user-owned AGENTS.md', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'AGENTS.md'), '# Handwritten Copilot Rules\n', 'utf8');

    const result = installPackage('copilot', 'mumuspec-workflow', 'workspace', root, 'update');

    expect(result.success).toBe(true);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain(MANAGED_MARKER);
  });
});

describe('TC-A4 — 生成树无 legacy 规则文件（C3 红线）', () => {
  it('full 4-agent install tree contains no .cursorrules/.windsurfrules', () => {
    const root = makeRoot();
    for (const agent of ['codex', 'windsurf', 'gemini', 'copilot'] as AgentType[]) {
      installPackage(agent, 'mumuspec-workflow', 'workspace', root, 'install');
    }

    const allFiles = walk(root);
    expect(allFiles.some((f) => f.endsWith('.cursorrules'))).toBe(false);
    expect(allFiles.some((f) => f.endsWith('.windsurfrules'))).toBe(false);
  });

  it('C3: 存量 .cursorrules 不被删除也不被覆盖（停止生成 ≠ 删除存量）', () => {
    const root = makeRoot();
    const legacyPath = join(root, '.cursorrules');
    const legacyContent = '# legacy cursor rules (user-authored)\n';
    writeFileSync(legacyPath, legacyContent, 'utf8');

    installPackage('codex', 'mumuspec-workflow', 'workspace', root, 'install');

    expect(existsSync(legacyPath)).toBe(true);
    expect(readFileSync(legacyPath, 'utf8')).toBe(legacyContent);
  });
});
