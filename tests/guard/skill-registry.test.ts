/**
 * 技能注册表守卫 —— 把"技能文本与引擎事实一致"从人工核对变为机械断言。
 *
 * 四项不变量（对应 delta-spec Requirement 5 的 ENF-14..17）：
 *  1. 技能文本不引用引擎不存在的字段（幽灵字段零命中）
 *  2. 阶段技能的守卫目标阶段合法（`guard <change> <phase>` 的 <phase> 是**目标**阶段）
 *  3. 技能文本引用的 CLI 命令及其签名命中命令注册表
 *  4. 命令模块 ↔ 注册表双向闭包（有模块无注册即失败）
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildProgram } from '../../src/cli/index.js';

const ROOT = process.cwd();
const SKILLS_DIR = join(ROOT, 'skills');
const COMMANDS_DIR = join(ROOT, 'src', 'cli', 'commands');

/** 引擎中并不存在的字段名——出现在技能文本里就是"文档有、代码无"的第三态 */
const GHOST_FIELDS = [
  'design_layers_covered',
  'each_layer_shall_defined',
  'build_layers_completed_in_bottom_up_order',
  'ponytail_constraints_defined',
  'ponytail_compliance_checked',
  'subagent_dispatch',
];

function collectSkillTextFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) collectSkillTextFiles(p, acc);
    else if (/\.(md|ya?ml)$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

const skillFiles = collectSkillTextFiles(SKILLS_DIR);
const rel = (f: string) => f.replace(ROOT, '').replace(/\\/g, '/');

describe('技能文本：幽灵字段零命中（ENF-14）', () => {
  it('skills/** 不出现引擎不存在的字段名', () => {
    const hits: string[] = [];
    for (const file of skillFiles) {
      const text = readFileSync(file, 'utf8');
      for (const ghost of GHOST_FIELDS) {
        if (text.includes(ghost)) hits.push(`${file.replace(ROOT, '')} → ${ghost}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('阶段分发规则的定义处唯一（无第二份复写）', () => {
    // 分发表的权威定义在 workflow.yaml；其余位置应引用而非复写
    const definers = skillFiles.filter((f) =>
      /^\s*dispatch:\s*$/m.test(readFileSync(f, 'utf8')),
    );
    expect(definers.map(rel)).toEqual(['/skills/mumuspec/workflow.yaml']);
  });
});

describe('阶段技能：守卫目标阶段合法（ENF-15）', () => {
  const TARGET_BY_PHASE: Record<string, string> = {
    open: 'design',
    design: 'build',
    build: 'verify',
    verify: 'archive-in-progress',
  };
  const ALLOWED = new Set(['design', 'build', 'verify', 'archive-in-progress']);

  const phaseSkills = skillFiles.filter((f) => /phase-(open|design|build|verify|archive)/.test(f));

  it('每个阶段技能的 guard 实参都是目标阶段，且不等于当前阶段', () => {
    const problems: string[] = [];
    for (const file of phaseSkills) {
      const current = /phase-(open|design|build|verify|archive)/.exec(file)?.[1] as string;
      const text = readFileSync(file, 'utf8');
      const calls = [...text.matchAll(/mumuspec guard\s+\S+\s+([a-z-]+)/g)].map((m) => m[1]);
      for (const phase of calls) {
        if (!ALLOWED.has(phase)) problems.push(`${file.replace(ROOT, '')}: 非法目标阶段 ${phase}`);
        if (phase === current) {
          problems.push(`${file.replace(ROOT, '')}: guard 实参填了当前阶段 ${phase}（应为 ${TARGET_BY_PHASE[current]}）`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('技能文本：命令签名命中注册表（ENF-16）', () => {
  const program = buildProgram();
  const topLevel = new Map<string, Set<string>>();
  for (const cmd of program.commands) {
    topLevel.set(
      cmd.name(),
      new Set(cmd.commands.map((sub) => sub.name())),
    );
  }

  it('技能文本引用的顶层命令都存在', () => {
    const unknown = new Set<string>();
    for (const file of skillFiles) {
      const text = readFileSync(file, 'utf8');
      // 用水平空白而非 \s：\s 会跨换行，把 YAML 的 "name: mumuspec" 与下一行
      // "description:" 粘成伪命令 "mumuspec description"。
      for (const m of text.matchAll(/mumuspec[ \t]+([a-z][a-z-]*)/g)) {
        if (!topLevel.has(m[1])) unknown.add(`${m[1]}  (${rel(file)})`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('技能文本引用的子命令都存在', () => {
    const unknown = new Set<string>();
    for (const file of skillFiles) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/mumuspec[ \t]+([a-z][a-z-]*)[ \t]+([a-z][a-z-]*)/g)) {
        const [, top, sub] = m;
        const subs = topLevel.get(top);
        if (subs && subs.size > 0 && !subs.has(sub)) {
          unknown.add(`mumuspec ${top} ${sub}  (${rel(file)})`);
        }
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('四类已知漂移已消失', () => {
    const all = skillFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    // state check 只接受 <name>（+ --recover），不接受阶段位置参数
    expect(all).not.toMatch(/state check[ \t]+\S+[ \t]+(open|design|build|verify|archive)\b/);
    // contract list --scopes 是无值开关（后接注释或行尾都合法，后接值才是漂移）
    expect(all).not.toMatch(/contract list[ \t]+--scopes[ \t]+[^ \t#`]/);
    // knowledge context 需要 path 位置参数
    expect(all).not.toMatch(/knowledge context[ \t]+--scopes/);
  });

  it('cognitive-map 命令已注册且含 init/sync', () => {
    expect(topLevel.has('cognitive-map')).toBe(true);
    const subs = topLevel.get('cognitive-map')!;
    expect(subs.has('init')).toBe(true);
    expect(subs.has('sync')).toBe(true);
  });

  it('新增的命令面已注册', () => {
    expect(topLevel.get('bundle')?.has('plugin')).toBe(true);
    expect(topLevel.get('install')?.has('plugin')).toBe(true);
    expect(topLevel.get('skill')?.has('companions')).toBe(true);
  });
});

describe('命令模块 ↔ 注册表双向闭包（ENF-17）', () => {
  it('每个导出 register* 的命令模块都在 src/ 内被引用（无死模块）', () => {
    // 判据是"被引用"而非"必须在 index.ts 被引用"——knowledge-*/loop-* 等模块
    // 由聚合模块（knowledge.ts / loop.ts）接线，仍属已接线。
    // 真正要拦的是 cognitive-map 那类：导出完整实现、有测试、却**无人调用**。
    const cliSources: Array<{ path: string; text: string }> = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.name.endsWith('.ts') && !p.endsWith('.d.ts')) {
          cliSources.push({ path: p, text: readFileSync(p, 'utf8') });
        }
      }
    };
    walk(join(ROOT, 'src'));

    const unregistered: string[] = [];
    for (const entry of readdirSync(COMMANDS_DIR, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      const ownPath = join(COMMANDS_DIR, entry.name);
      const source = readFileSync(ownPath, 'utf8');
      const fns = [...source.matchAll(/export function (register\w+)\s*\(/g)].map((m) => m[1]);
      for (const fn of fns) {
        const referencedElsewhere = cliSources.some(
          (s) => s.path !== ownPath && s.text.includes(fn),
        );
        if (!referencedElsewhere) unregistered.push(`${entry.name} → ${fn}`);
      }
    }

    expect(unregistered).toEqual([]);
  });
});
