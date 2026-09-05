/**
 * Deep tests for rules/generator.ts — canonical-first AGENTS.md glue layer
 * (goal-p0-dispatch-gate C2/C3/D1/D2).
 *
 * New contract under test:
 * - Rendering + three-state decisions delegate to src/install/rules-generator.ts
 * - Return type is `{ written: string[]; skipped: SkippedRuleFile[] }`
 * - CLAUDE.md / GEMINI.md are thin-shell bridges (first line @AGENTS.md)
 * - .cursorrules / .windsurfrules are NEVER generated (hard filter, C3)
 * - agents-hash.json written with rulesFiles = written
 *
 * Uses REAL temporary directories — existsSync / readFileSync must observe
 * actual disk state for the three-state (create/update/skip) branches.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateRulesFiles, LEGACY_RULE_FILES } from '../../src/rules/generator.js';
import { MANAGED_MARKER } from '../../src/install/rules-generator.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { SpecContext, SpecFile } from '../../src/core/types.js';

const roots: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumuspec-rules-'));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const r of roots.splice(0)) {
    try { rmSync(r, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

/** Minimal config — buildRuleGenContext only consumes project + ai.rules_files */
function makeConfig(rulesFiles: string[]): MumuSpecConfig {
  return {
    version: '0.19.1',
    project: { name: 'test-proj', language: 'typescript', framework: 'React' },
    ai: { generate_rules: true, mcp_server: false, rules_files: rulesFiles },
  } as unknown as MumuSpecConfig;
}

/** Minimal SpecContext with one layer */
function makeSpecContext(partial?: Partial<SpecContext>): SpecContext {
  const spec: SpecFile = {
    path: '.mumuspec/specs/root/spec.md',
    frontmatter: { version: '0.19.1', scope: 'root', layer: 0, constraint_strength: 'high' },
    requirements: [
      { name: 'Test Requirement', shall: ['do this thing'], shallNot: ['do that thing'], enforcement: [] },
    ],
    raw: '',
  };
  return {
    targetPath: '.',
    layers: [{ level: 0, scope: 'root', path: '.mumuspec/specs/root/spec.md', spec }],
    prohibitions: [],
    ...partial,
  };
}

describe('rules/generator — generateRulesFiles (canonical-first glue)', () => {
  it('returns { written, skipped } structure', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['AGENTS.md']));

    expect(result).toHaveProperty('written');
    expect(result).toHaveProperty('skipped');
    expect(Array.isArray(result.written)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
    expect(result.written).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('creates AGENTS.md with managed marker + four contract sections', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['AGENTS.md']));
    const filePath = join(root, 'AGENTS.md');

    expect(result.written).toContain(filePath);
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf8');

    // marker header
    expect(content).toContain(MANAGED_MARKER);
    // four sections
    expect(content).toContain('## 规范链摘要');
    expect(content).toContain('## Ponytail 编码约束');
    expect(content).toContain('## CLI 速查');
    expect(content).toContain('## MCP 入口');
    // project overview from config
    expect(content).toContain('**Project**: test-proj (typescript, React)');
  });

  it('renders spec context requirements into 规范链摘要', () => {
    const root = makeRoot();
    const ctx = makeSpecContext();
    generateRulesFiles(root, makeConfig(['AGENTS.md']), ctx);
    const content = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    expect(content).toContain('### root');
    expect(content).toContain('Test Requirement');
    expect(content).toContain('SHALL: do this thing');
    expect(content).toContain('SHALL NOT: do that thing');
  });

  it('renders prohibitions into 规范链摘要', () => {
    const root = makeRoot();
    const ctx = makeSpecContext({ prohibitions: ['No breaking API changes'] });
    generateRulesFiles(root, makeConfig(['AGENTS.md']), ctx);
    const content = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    expect(content).toContain('No breaking API changes');
  });

  it('falls back to 兜底文案 when no spec context', () => {
    const root = makeRoot();
    generateRulesFiles(root, makeConfig(['AGENTS.md']));
    const content = readFileSync(join(root, 'AGENTS.md'), 'utf8');

    expect(content).toContain('规范链尚未生成');
  });

  it('renders CLAUDE.md as thin-shell bridge (first line @AGENTS.md)', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['CLAUDE.md']));
    const filePath = join(root, 'CLAUDE.md');

    expect(result.written).toContain(filePath);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    expect(lines[0]).toBe('@AGENTS.md');
    expect(content).toContain(MANAGED_MARKER);
    // bridge must NOT duplicate canonical sections
    expect(content).not.toContain('## Ponytail 编码约束');
  });

  it('renders GEMINI.md as thin-shell bridge', () => {
    const root = makeRoot();
    generateRulesFiles(root, makeConfig(['GEMINI.md']));
    const lines = readFileSync(join(root, 'GEMINI.md'), 'utf8').split('\n');
    expect(lines[0]).toBe('@AGENTS.md');
  });

  // ── C3/D2: legacy hard filter ─────────────────────────────────

  it('NEVER writes .cursorrules even when configured (C3 red line)', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['.cursorrules']));

    expect(result.written).toHaveLength(0);
    expect(existsSync(join(root, '.cursorrules'))).toBe(false);
  });

  it('NEVER writes .windsurfrules even when configured (C3 red line)', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['.windsurfrules']));

    expect(result.written).toHaveLength(0);
    expect(existsSync(join(root, '.windsurfrules'))).toBe(false);
  });

  it('filters legacy files out of a mixed rules_files list', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['AGENTS.md', '.cursorrules', '.windsurfrules']));

    // only AGENTS.md written
    expect(result.written).toHaveLength(1);
    expect(result.written[0]).toBe(join(root, 'AGENTS.md'));
    expect(existsSync(join(root, '.cursorrules'))).toBe(false);
    expect(existsSync(join(root, '.windsurfrules'))).toBe(false);
  });

  it('exposes the legacy rule files constant', () => {
    expect(LEGACY_RULE_FILES).toContain('.cursorrules');
    expect(LEGACY_RULE_FILES).toContain('.windsurfrules');
  });

  // ── three-state conflict policy (D1) ─────────────────────────

  it('absent → create (written)', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['AGENTS.md']));
    expect(result.written).toContain(join(root, 'AGENTS.md'));
  });

  it('managed (marker present) → update, overwrites with new content', () => {
    const root = makeRoot();
    const filePath = join(root, 'AGENTS.md');
    writeFileSync(filePath, `> ${MANAGED_MARKER}\nold stale content\n`, 'utf8');

    const result = generateRulesFiles(root, makeConfig(['AGENTS.md']));
    expect(result.written).toContain(filePath);
    expect(result.skipped).toHaveLength(0);
    expect(readFileSync(filePath, 'utf8')).toContain('## CLI 速查');
  });

  it('user-owned (no marker) → skip, file untouched, diagnostic collected', () => {
    const root = makeRoot();
    const filePath = join(root, 'AGENTS.md');
    const userContent = '# My Handwritten Rules\nkeep me\n';
    writeFileSync(filePath, userContent, 'utf8');

    const result = generateRulesFiles(root, makeConfig(['AGENTS.md']));
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]!.path).toBe(filePath);
    expect(result.skipped[0]!.diagnostic).toContain('user-owned');
    expect(readFileSync(filePath, 'utf8')).toBe(userContent);
  });

  it('user-owned CLAUDE.md → skip, not overwritten by bridge', () => {
    const root = makeRoot();
    const filePath = join(root, 'CLAUDE.md');
    const userContent = '# Claude Code Rules (custom)\n';
    writeFileSync(filePath, userContent, 'utf8');

    const result = generateRulesFiles(root, makeConfig(['CLAUDE.md']));
    expect(result.written).toHaveLength(0);
    expect(result.skipped[0]!.path).toBe(filePath);
    expect(readFileSync(filePath, 'utf8')).toBe(userContent);
  });

  // ── agents-hash.json ─────────────────────────────────────────

  it('writes agents-hash.json with rulesFiles = written', () => {
    const root = makeRoot();
    generateRulesFiles(root, makeConfig(['AGENTS.md']));

    const hashPath = join(root, '.mumuspec', 'agents-hash.json');
    expect(existsSync(hashPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(hashPath, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.rulesFiles).toContain(join(root, 'AGENTS.md'));
    expect(parsed.specHash).toBeDefined();
  });

  it('writes agents-hash.json even when everything is skipped', () => {
    const root = makeRoot();
    writeFileSync(join(root, 'AGENTS.md'), '# user\n', 'utf8');
    generateRulesFiles(root, makeConfig(['AGENTS.md']));

    const hashPath = join(root, '.mumuspec', 'agents-hash.json');
    expect(existsSync(hashPath)).toBe(true);
    const parsed = JSON.parse(readFileSync(hashPath, 'utf8'));
    expect(parsed.rulesFiles).toEqual([]);
  });

  // ── edge cases ───────────────────────────────────────────────

  it('returns empty written/skipped when rules_files is empty', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig([]));
    expect(result.written).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });

  it('does not crash when specContext layers lack spec', () => {
    const root = makeRoot();
    const ctx = makeSpecContext({
      layers: [
        { level: 0, scope: 'a', path: 'a/spec.md' },
        { level: 1, scope: 'b', path: 'b/spec.md' },
      ],
    });
    expect(() => generateRulesFiles(root, makeConfig(['AGENTS.md']), ctx)).not.toThrow();
  });

  it('writes AGENTS.md and CLAUDE.md together from config (mixed managed set)', () => {
    const root = makeRoot();
    const result = generateRulesFiles(root, makeConfig(['AGENTS.md', 'CLAUDE.md']));
    expect(result.written).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'CLAUDE.md'))).toBe(true);
  });

  it('does not create any rule file outside the configured list', () => {
    const root = makeRoot();
    generateRulesFiles(root, makeConfig(['AGENTS.md']));
    // no stray .cursorrules/.windsurfrules anywhere in the tree
    const stray = readdirSync(root).filter(
      (f) => f === '.cursorrules' || f === '.windsurfrules',
    );
    expect(stray).toEqual([]);
  });
});
