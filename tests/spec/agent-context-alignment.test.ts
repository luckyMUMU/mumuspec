/**
 * PRD ↔ 实现对齐（变更 prd-alignment-agent-integration）锁定用例。
 *
 * G1 根层全局 charter 加载（loader）
 * G2 规范链摘要粒度（结构摘要 + 红线全文，禁止内联全量）
 * G3 CLI 速查取自命令注册表（单一事实源）
 * G4 归档 delta 合并净化（剥离 frontmatter + 拒绝占位符模板）
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Command } from 'commander';

import {
  buildRuleGenContext,
  renderCanonicalRules,
  resolveCliCheatSheet,
  setCliCheatSheet,
  MAX_RULES_BYTES,
} from '../../src/install/rules-generator.js';
import { renderCliCheatSheet } from '../../src/cli/capability.js';
import { prepareChangeSpecContent } from '../../src/change/archive.js';
import { loadSpecContext } from '../../src/spec/loader.js';
import { loadConfig } from '../../src/core/config.js';
import type { SpecContext } from '../../src/core/types-spec.js';

// ── G1: 根层 spec.md 全局 charter 必须与 prd/tech 共存加载 ──
describe('G1: 根层全局 charter 加载', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-g1-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('根层同时存在 spec.md + prd.md + tech.md 时三者均加载（spec.md 是全局 charter，非 tech 回退）', () => {
    writeFileSync(
      join(dir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n## Requirement: Global Charter\n\n### SHALL NOT\n- 禁止全局红线 A\n',
    );
    writeFileSync(join(dir, '.mumuspec', 'prd.md'), '---\nlayer: 0\nscope: "."\n---\n\n# PRD\n');
    writeFileSync(
      join(dir, '.mumuspec', 'tech.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n## Requirement: Tech\n\n### SHALL\n- 技术约束 B\n',
    );

    const ctx = loadSpecContext(dir, dir, loadConfig(dir));
    const layer0 = ctx.layers.find((l) => l.level === 0)!;

    expect(layer0.spec).toBeDefined();
    expect(layer0.prd).toBeDefined();
    expect(layer0.tech).toBeDefined();
    // 全局 charter 的红线必须进入继承 prohibitions，否则 agent 拿不到根约束
    expect(ctx.prohibitions).toContain('禁止全局红线 A');
  });

  it('模块层 spec.md 仍为 tech.md 的回退（不得因根层例外而破坏模块层语义）', () => {
    const modDir = join(dir, 'src', 'mod');
    mkdirSync(join(modDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(modDir, '.mumuspec', 'tech.md'),
      '---\nlayer: 1\nscope: "src/mod"\n---\n\n## Requirement: M\n\n### SHALL\n- 模块约束\n',
    );
    writeFileSync(
      join(modDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\nscope: "src/mod"\n---\n\n## Requirement: Legacy\n\n### SHALL\n- 不应加载\n',
    );
    writeFileSync(
      join(dir, '.mumuspec', 'prd.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n# PRD\n',
    );
    writeFileSync(
      join(dir, '.mumuspec', 'tech.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n## Requirement: T\n\n### SHALL\n- root\n',
    );

    const ctx = loadSpecContext(modDir, dir, loadConfig(dir));
    const modLayer = ctx.layers.find((l) => l.scope === 'src/mod')!;

    expect(modLayer.tech).toBeDefined();
    expect(modLayer.spec).toBeUndefined();
  });
});

// ── G2: 规范链摘要粒度 ──
describe('G2: 规范链摘要 = 结构摘要 + 红线全文', () => {
  const specContext: SpecContext = {
    targetPath: '/p',
    layers: [
      {
        level: 0,
        scope: '.',
        path: '/p',
        prd: { path: '/p/.mumuspec/prd.md', scope: '.', layer: 0, content: '', userScenarios: [], acceptanceCriteria: [],
          requirements: [{ name: 'R1', shall: ['正向 1', '正向 2'], shallNot: ['红线 1'], should: [], enforcement: [] }] },
        tech: { path: '/p/.mumuspec/tech.md', scope: '.', layer: 0, content: '', requirements: [
          { name: 'R2', shall: ['正向 3'], shallNot: [], should: [], enforcement: [] }], architectureDecisions: [] },
        spec: { path: '/p/.mumuspec/spec.md', frontmatter: { layer: 0, scope: '.' }, requirements: [
          { name: 'Global', shall: ['正向 4'], shallNot: ['红线 2'], should: [], enforcement: [] }], raw: '' },
      },
    ],
    prohibitions: ['红线 1', '红线 2'],
  };

  it('摘要含结构表（层级/文档/条数）与红线全文', () => {
    const { specSummary } = buildRuleGenContext(undefined, specContext);
    expect(specSummary).toContain('| Layer | Scope | Docs | SHALL | SHALL NOT |');
    expect(specSummary).toContain('prd+tech+spec');
    expect(specSummary).toContain('- 红线 1');
    expect(specSummary).toContain('- 红线 2');
  });

  it('摘要不内联 SHALL 全文（分发层 SHALL NOT：禁止内联全量规范）', () => {
    const { specSummary } = buildRuleGenContext(undefined, specContext);
    expect(specSummary).not.toContain('正向 1');
    expect(specSummary).not.toContain('正向 3');
  });

  it('红线取 prohibitions（含父层继承），指向 MCP 渐进式加载', () => {
    const { specSummary } = buildRuleGenContext(undefined, specContext);
    expect(specSummary).toContain('含父层继承');
    expect(specSummary).toContain('get_spec_context');
  });

  it('无规范链时回落提示而非空白', () => {
    const { specSummary } = buildRuleGenContext(undefined, undefined);
    expect(specSummary).toContain('规范链尚未生成');
  });

  it('渲染产物仍在 32KiB 预算内', () => {
    const ctx = buildRuleGenContext(undefined, specContext, 'mumuspec x');
    expect(Buffer.byteLength(renderCanonicalRules(ctx), 'utf8')).toBeLessThanOrEqual(MAX_RULES_BYTES);
  });
});

// ── G3: CLI 速查取自命令注册表 ──
describe('G3: CLI 速查注册表化', () => {
  function buildProgram(): Command {
    const program = new Command();
    program.command('new').argument('<name>').description('Create new change');
    program.command('context').argument('<path>').description('Get spec context');
    program.command('doctor').description('Environment diagnostics');
    const state = program.command('state').description('State machine management');
    state.command('transition').argument('[args...]').description('Transition phase');
    return program;
  }

  it('速查覆盖注册表中全部命令（不再硬编码 8 条）', () => {
    const sheet = renderCliCheatSheet(buildProgram());
    expect(sheet).toContain('mumuspec new <name>');
    expect(sheet).toContain('mumuspec context <path>');
    expect(sheet).toContain('mumuspec doctor');
  });

  it('CLI-first 命令置顶并展开子命令（state transition 等）', () => {
    const sheet = renderCliCheatSheet(buildProgram());
    const coreIdx = sheet.indexOf('核心流程');
    expect(coreIdx).toBe(0);
    expect(sheet).toContain('mumuspec state transition');
    // 置顶段先于其余命令段出现
    expect(sheet.indexOf('mumuspec state transition')).toBeLessThan(sheet.indexOf('其余命令'));
  });

  it('优先级：显式参数 > 注册表注入值 > 静态默认', () => {
    setCliCheatSheet('注入值');
    expect(resolveCliCheatSheet()).toBe('注入值');
    expect(resolveCliCheatSheet('显式值')).toBe('显式值');
    setCliCheatSheet(undefined);
    expect(resolveCliCheatSheet()).not.toBe('注入值');
  });
});

// ── G4: 归档 delta 合并净化 ──
describe('G4: 归档 delta 合并净化', () => {
  it('剥离变更层 frontmatter（消除 parent_* 相对路径错位导致的 E-SPEC-010）', () => {
    const content = '---\nlayer: 1\nscope: ".changes/x"\nparent_tech: ..\\..\\..\\tech.md\n---\n\n## Requirement: R\n\n### SHALL\n- 真实约束\n';
    const prepared = prepareChangeSpecContent(content);
    expect(prepared).not.toBeNull();
    expect(prepared).not.toContain('parent_tech');
    expect(prepared).not.toContain('---\nlayer: 1');
    expect(prepared).toContain('真实约束');
  });

  it('拒绝合并未填写的 init 模板占位符（spec STRUCT SHALL NOT）', () => {
    expect(prepareChangeSpecContent('### SHALL\n- <Describe what this feature/change must accomplish>\n')).toBeNull();
    expect(prepareChangeSpecContent('### SHALL\n- Module: x is maintained at current level\n')).toBeNull();
  });

  it('空内容返回 null', () => {
    expect(prepareChangeSpecContent('')).toBeNull();
    expect(prepareChangeSpecContent('   \n\n')).toBeNull();
  });

  it('真实填写的变更规范照常保留', () => {
    const prepared = prepareChangeSpecContent('## Requirement: R\n\n### SHALL\n- 已填写的真实约束\n');
    expect(prepared).toBe('## Requirement: R\n\n### SHALL\n- 已填写的真实约束');
  });
});
