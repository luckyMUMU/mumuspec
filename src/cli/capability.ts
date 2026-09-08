/**
 * Command capability metadata — Capability Tier (spec「命令能力分层」) 最小实现。
 *
 * P0-A 最小版（用户签收 D1）：本模块只提供能力自描述与查询；
 * 二期范围（不在本变更）：全局 --dry-run 框架、不可逆操作的「输入变更名」二次确认。
 *
 * 设计：集中注册表 + 回落默认。未登记命令视为 general（纯只读、可组合），
 * 避免为 40+ 命令文件逐一改动注册函数签名（Ponytail: 最小可工作实现）。
 */
import type { Command } from 'commander';

export type CommandTier = 'general' | 'dedicated';
export type CommandRisk = 'none' | 'low' | 'medium' | 'high';

/**
 * CLI-first 核心命令（spec「流程执行载体」F-3 / CAP-1）。
 * 确定性工作流步骤必须经 CLI 执行，故在 Rules 速查中置顶。
 * 名单仅为排序锚点——命令不存在时静默跳过，用法签名一律取自注册表现场值。
 */
export const CLI_FIRST_COMMANDS = [
  'new',
  'state',
  'guard',
  'decisions',
  'test-cases',
  'tasks',
  'validate',
  'check',
  'drift',
  'capability',
  'finalize-archive',
  'archive',
] as const;

export interface CommandMetadata {
  tier: CommandTier;
  risk: CommandRisk;
  /** 是否需要显式 --confirm 才执行 */
  confirmRequired: boolean;
  reversible: boolean;
  /** general 可组合（链式/并行）；dedicated 不可中断或跳转 */
  composable: boolean;
}

/** 未登记命令的回落默认值：通用基础能力 = 纯只读、可组合 */
export const DEFAULT_METADATA: CommandMetadata = {
  tier: 'general',
  risk: 'none',
  confirmRequired: false,
  reversible: true,
  composable: true,
};

/**
 * 已登记命令的能力元数据（白名单；分层基于风险等级）。
 * 新增专用工具时在此登记，并同步 src/cli/commands/.mumuspec/BOUNDARY.md。
 */
export const COMMAND_METADATA: Record<string, Partial<CommandMetadata>> = {
  archive: { tier: 'dedicated', risk: 'high', confirmRequired: true, reversible: false, composable: false },
  discard: { tier: 'dedicated', risk: 'high', confirmRequired: true, reversible: false, composable: false },
  'finalize-archive': { tier: 'dedicated', risk: 'high', confirmRequired: false, reversible: false, composable: false },
  install: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  init: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: false, composable: false },
  new: { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: false, composable: false },
  state: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  'test-cases': { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: true, composable: false },
  guard: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  merge: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: false, composable: false },
  sync: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  'sync-specs': { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  hooks: { tier: 'dedicated', risk: 'medium', confirmRequired: false, reversible: true, composable: false },
  skill: { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: true, composable: false },
  bundle: { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: true, composable: false },
  'add-spec': { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: false, composable: false },
  decisions: { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: true, composable: false },
  feedback: { tier: 'dedicated', risk: 'low', confirmRequired: false, reversible: true, composable: false },
};

/** 查询单个命令的能力元数据（未登记则回落默认） */
export function getCommandMetadata(command: string): CommandMetadata {
  return { ...DEFAULT_METADATA, ...(COMMAND_METADATA[command] ?? {}) };
}

/** 列出全部已登记命令的元数据（供 `mumuspec capability` 无参调用） */
export function listCommandMetadata(): Record<string, CommandMetadata> {
  const out: Record<string, CommandMetadata> = {};
  for (const name of Object.keys(COMMAND_METADATA)) {
    out[name] = getCommandMetadata(name);
  }
  return out;
}

/**
 * 从命令注册表现场生成 CLI 速查文本（AGENTS.md「CLI 速查」节）。
 *
 * 单一事实源 = 注册表：新增命令自动进入速查，杜绝硬编码清单与实际命令漂移
 * （spec F-5：skill/规则文本引用的命令必须与注册表一致）。
 */
export function renderCliCheatSheet(program: Command): string {
  const top = program.commands.filter((c) => c.name() !== 'help');
  const byName = new Map(top.map((c) => [c.name(), c]));

  const fmt = (cmd: Command, parent?: string): string => {
    const name = parent ? `${parent} ${cmd.name()}` : cmd.name();
    const args = cmd.registeredArguments
      .map((a) => (a.required ? `<${a.name()}>` : `[${a.name()}]`))
      .join(' ');
    const usage = `mumuspec ${name}${args ? ` ${args}` : ''}`;
    return `  ${usage.padEnd(44)}# ${cmd.description()}`;
  };

  const lines: string[] = ['核心流程（CLI-first：确定性步骤必须经 CLI，禁手工编辑状态工件）:'];
  const seen = new Set<string>();
  for (const name of CLI_FIRST_COMMANDS) {
    const cmd = byName.get(name);
    if (!cmd) continue;
    seen.add(name);
    lines.push(fmt(cmd));
    for (const sub of cmd.commands) lines.push(fmt(sub, name));
  }

  lines.push('');
  lines.push('其余命令:');
  for (const cmd of top) {
    if (seen.has(cmd.name())) continue;
    lines.push(fmt(cmd));
  }
  return lines.join('\n');
}
