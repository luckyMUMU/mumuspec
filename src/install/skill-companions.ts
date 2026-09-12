/**
 * 伴随能力（companion）注册表与可用性探测。
 *
 * 背景：技能文本曾把 28 个外部 skill 标为 `required: true` 并写"跳过此步骤被禁止"，
 * 而实测可达率为 0/28（11 个只在市场目录 = 市场目录 ≠ 已安装，17 个无任何来源）。
 * 强断言与可满足性脱钩时，断言恒为空转，且 100% 静默走 fallback、不留痕。
 *
 * 本模块把"可用性判定"从模型现场判断改为**代码侧探测 + 可枚举输出**（KP-0060 引擎归代码）：
 * 缺失只出现在清单里，不阻断阶段流程；替代路径由技能文本以带编号的显式步骤给出。
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface CompanionSpec {
  name: string;
  /** 该能力在流程中承担什么（用于枚举输出的可读性） */
  purpose: string;
  /** 主要被哪个阶段使用 */
  phases: readonly string[];
}

export type ResolvedCompanion = CompanionSpec & { resolved: string | null };

/** 全部被技能文本声明的外部能力。required 一律为 false——它们都是包外增强，不是包内必须步骤。 */
export const COMPANIONS: readonly CompanionSpec[] = [
  { name: 'brainstorming', purpose: '需求探索与追问', phases: ['open', 'design'] },
  { name: 'gitnexus-impact-analysis', purpose: '代码影响分析', phases: ['open'] },
  { name: 'gitnexus-exploring', purpose: 'Q1 信息采集', phases: ['design'] },
  { name: 'using-git-worktrees', purpose: '工作区隔离', phases: ['open', 'build'] },
  { name: 'spec-driven-development', purpose: '规范草案编写', phases: ['open'] },
  { name: 'grill-me', purpose: '设计方案共识追问（BP-4.5）', phases: ['design'] },
  { name: 'hyperplan', purpose: '对抗式审查（BP-7）', phases: ['design'] },
  { name: 'subagent-driven-development', purpose: '对抗团队创建', phases: ['design', 'build'] },
  { name: 'documentation-and-adrs', purpose: '决策记录', phases: ['design', 'archive'] },
  { name: 'writing-plans', purpose: '实现计划编写', phases: ['build'] },
  { name: 'test-driven-development', purpose: '红绿 TDD 循环', phases: ['build'] },
  { name: 'executing-plans', purpose: '按计划执行', phases: ['build'] },
  { name: 'verification-before-completion', purpose: '完成前验证', phases: ['verify'] },
  { name: 'finishing-a-development-branch', purpose: '分支收尾', phases: ['verify', 'archive'] },
  { name: 'systematic-debugging', purpose: '调试前置的根因调查', phases: ['build', 'verify'] },
  { name: 'requesting-code-review', purpose: '请求代码审查', phases: ['build', 'verify'] },
  { name: 'receiving-code-review', purpose: '接收审查反馈', phases: ['verify'] },
  { name: 'context-engineering', purpose: '上下文管理', phases: ['build'] },
  { name: 'interview-me', purpose: '需求不清时的访谈', phases: ['open'] },
  { name: 'doubt-driven-development', purpose: '疑虑驱动开发', phases: ['design', 'build'] },
  { name: 'security-and-hardening', purpose: '安全盲区扫描', phases: ['design', 'build', 'verify'] },
  { name: 'performance-optimization', purpose: '性能盲区扫描', phases: ['design', 'build', 'verify'] },
  { name: 'api-and-interface-design', purpose: '接口设计', phases: ['design', 'build'] },
  { name: 'source-driven-development', purpose: '源码验证', phases: ['build'] },
  { name: 'frontend-ui-engineering', purpose: 'UI 组件构建', phases: ['build'] },
  { name: 'browser-testing-with-devtools', purpose: '浏览器验证', phases: ['verify'] },
  { name: 'ci-cd-and-automation', purpose: 'CI/CD 集成', phases: ['archive'] },
  { name: 'shipping-and-launch', purpose: '发布准备', phases: ['archive'] },
];

function homeDir(): string {
  if (process.platform === 'win32') return process.env.USERPROFILE || '';
  return process.env.HOME || '';
}

function tryReaddir(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * 探测单个能力名对应的 SKILL.md 绝对路径。
 * 搜索面（与实测一致）：用户级技能目录 → 插件缓存 → 市场目录（含 external_plugins）。
 * 市场目录命中**不等于已安装**，但作为可用来源如实上报（由调用方决定是否采信）。
 */
export function discoverCompanion(name: string): string | null {
  const home = homeDir();
  if (!home) return null;
  const pluginsRoot = join(home, '.workbuddy', 'plugins');

  const direct = join(home, '.workbuddy', 'skills', name, 'SKILL.md');
  if (existsSync(direct)) return direct;

  // 插件缓存：cache/<marketplace>/<plugin>/<version>/[skills/]<name>/SKILL.md
  for (const mk of tryReaddir(join(pluginsRoot, 'cache'))) {
    for (const pl of tryReaddir(join(pluginsRoot, 'cache', mk))) {
      for (const ver of tryReaddir(join(pluginsRoot, 'cache', mk, pl))) {
        const base = join(pluginsRoot, 'cache', mk, pl, ver);
        for (const candidate of [join(base, 'skills', name, 'SKILL.md'), join(base, name, 'SKILL.md')]) {
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  }

  // 市场目录：marketplaces/<mp>/{external_plugins,plugins}/<plugin>/skills/<name>/SKILL.md
  for (const mp of tryReaddir(join(pluginsRoot, 'marketplaces'))) {
    for (const kind of ['external_plugins', 'plugins']) {
      for (const pl of tryReaddir(join(pluginsRoot, 'marketplaces', mp, kind))) {
        const candidate = join(pluginsRoot, 'marketplaces', mp, kind, pl, 'skills', name, 'SKILL.md');
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

/** 枚举全部伴随能力的解析结果。缺失项的 resolved 为 null，不抛错、不阻断。 */
export function resolveCompanions(
  specs: readonly CompanionSpec[] = COMPANIONS,
): ResolvedCompanion[] {
  return specs.map((spec) => ({ ...spec, resolved: discoverCompanion(spec.name) }));
}

/** 缺失清单（供命令出口与技能文本前置判断）。 */
export function listMissingCompanions(specs?: readonly CompanionSpec[]): string[] {
  return resolveCompanions(specs)
    .filter((c) => c.resolved === null)
    .map((c) => c.name);
}
