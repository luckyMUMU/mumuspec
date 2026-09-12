/**
 * 技能副本漂移检测 —— 比对技能源正文与已安装副本正文。
 *
 * 两个刻意的设计约束：
 *  1. **不 import 安装层**（`src/install`）：路径对由调用方解析后注入。反向引用会让
 *     同层两个 scope 产生直接调用边，破坏 I2/I3（同层不可并行）。
 *  2. **比对前剥离 frontmatter 的版本字段**：`stampSkillVersion()` 会把两侧
 *     `metadata.version` 都写成运行时包版本，纳入比对等于把必然差异当漂移信号——
 *     恒亮的告警会训练读者忽略整条告警通道（与 loop 收敛判据同一教训）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { DriftResult } from '../core/types-workflow.js';

export interface SkillPair {
  name: string;
  sourcePath: string;
  installPath: string;
}

/** 仅匹配 frontmatter 区块内的版本字段行（含缩进与引号形态）。 */
const VERSION_LINE_RE = /^[ \t]*version[ \t]*:[ \t]*.*$/gm;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * 剥离 frontmatter 中的版本字段行，返回用于比对的正文字节。
 * 只动版本行，其余内容（含 name / description / 正文）逐字节保留。
 */
export function stripFrontmatterVersion(text: string): string {
  const fm = FRONTMATTER_RE.exec(text);
  if (!fm) return text;
  const head = fm[1].replace(VERSION_LINE_RE, 'version: <stripped>');
  return text.slice(0, fm.index) + '---\n' + head + '\n---' + text.slice(fm.index + fm[0].length);
}

/** 解析技能源目录下的技能名列表（一目录一技能，须含 SKILL.md）。 */
export function listSourceSkills(sourceDir: string): string[] {
  if (!existsSync(sourceDir)) return [];
  try {
    return readdirSync(sourceDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(sourceDir, e.name, 'SKILL.md')))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * 由两个根目录构造路径对（纯路径拼接，不触碰文件内容）。
 * 传入 names 时只取交集；不传则取源目录下全部技能。
 */
export function buildSkillPairs(
  sourceRoot: string,
  installRoot: string,
  names?: readonly string[],
): SkillPair[] {
  const list = names ?? listSourceSkills(sourceRoot);
  return list.map((name) => ({
    name,
    sourcePath: join(sourceRoot, name, 'SKILL.md'),
    installPath: join(installRoot, name, 'SKILL.md'),
  }));
}

/**
 * 检测技能副本漂移。每对技能最多产出一条诊断；正文一致但仅版本行不同时**不产出**诊断。
 */
export function detectSkillDrift(pairs: readonly SkillPair[]): DriftResult[] {
  const out: DriftResult[] = [];
  for (const pair of pairs) {
    if (!existsSync(pair.installPath)) {
      out.push({
        type: 'skill_drift',
        code: 'W-SKILL-001',
        severity: 'WARN',
        message: `技能 "${pair.name}" 未安装（源存在而副本缺失）`,
        file: pair.installPath,
        fixHint: 'mumuspec install --agent <agent> --force',
      });
      continue;
    }
    if (!existsSync(pair.sourcePath)) {
      out.push({
        type: 'skill_drift',
        code: 'W-SKILL-001',
        severity: 'WARN',
        message: `技能 "${pair.name}" 的源文件缺失（副本存在而源缺失）`,
        file: pair.sourcePath,
        fixHint: '从版本控制恢复源文件，或删除孤儿副本',
      });
      continue;
    }

    let source: string;
    let install: string;
    try {
      source = stripFrontmatterVersion(readFileSync(pair.sourcePath, 'utf8'));
      install = stripFrontmatterVersion(readFileSync(pair.installPath, 'utf8'));
    } catch (err) {
      out.push({
        type: 'skill_drift',
        code: 'W-SKILL-001',
        severity: 'WARN',
        message: `技能 "${pair.name}" 无法读取：${(err as Error).message}`,
        file: pair.installPath,
        fixHint: '检查文件权限后重新运行',
      });
      continue;
    }

    if (source !== install) {
      out.push({
        type: 'skill_drift',
        code: 'W-SKILL-001',
        severity: 'WARN',
        message:
          `技能 "${pair.name}" 的源与已安装副本内容不一致（已剥离版本行）` +
          `｜源：${pair.sourcePath}｜副本：${pair.installPath}`,
        file: pair.installPath,
        fixHint: 'mumuspec install --agent <agent> --force',
      });
    }
  }
  return out;
}
