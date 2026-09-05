/**
 * Installer operations — concrete install/query logic for all supported agents.
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type {
  AgentType,
  InstallTarget,
  PackageManifestEntry,
  McpPresetEntry,
  CommandPresetEntry,
  InstallResult,
  InstallMcpResult,
  InstallCommandResult,
} from './installer-registry.js';
import {
  AGENT_MANIFEST,
  MCP_PRESETS,
  COMMAND_PRESETS,
  AGENT_RULE_TARGETS,
} from './installer-registry.js';
import { renderRuleFiles, buildRuleGenContext } from './rules-generator.js';
import type { MumuSpecConfig } from '../core/config.js';

export type InstallMode = 'install' | 'update';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ── Shared helpers ──────────────────────────────────────────

function resolvePawCmd(): string {
  if (process.platform === 'win32') {
    const winPath = join(process.env.USERPROFILE || '', '.meituan-catpaw', 'bin', 'paw.cmd');
    if (existsSync(winPath)) return winPath;
    const winExe = join(process.env.USERPROFILE || '', '.meituan-catpaw', 'bin', 'paw.exe');
    if (existsSync(winExe)) return winExe;
  } else {
    const unixPath = join(process.env.HOME || '', '.meituan-catpaw', 'bin', 'paw');
    if (existsSync(unixPath)) return unixPath;
  }
  return 'paw';
}

/**
 * 安全执行 paw 命令，返回 stdout。
 *
 * 安全策略：
 * - 参数一律走数组形式，不经手工字符串拼接
 * - Windows 上 .cmd 脚本必须经 shell 执行，此时对每个参数做元字符白名单校验，
 *   杜绝 workspacePath 等用户可控参数的命令注入
 */
function runPaw(pawCmd: string, args: string[]): string {
  const needShell = process.platform === 'win32' && /\.cmd$/i.test(pawCmd);
  if (needShell) {
    // shell 模式下 & | ^ < > " 会被解释，正常路径/ID 不含这些字符，出现即拒绝
    for (const arg of args) {
      if (/[&|^<>"]/.test(arg)) {
        throw new Error(`Illegal shell metacharacter in argument: ${arg}`);
      }
    }
  }
  const result = spawnSync(pawCmd, args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(needShell ? { shell: true } : {}),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `paw exited with status ${result.status}`);
  }
  return result.stdout ?? '';
}

function resolveCatpawDataDir(): string | undefined {
  if (process.env.CATPAW_HOME) return process.env.CATPAW_HOME;
  if (process.env.MEITPAW_HOME) return process.env.MEITPAW_HOME;
  const home = process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;
  if (home) return join(home, '.meituan-catpaw');
  return undefined;
}

function findSkillSource(packageName: string): string | undefined {
  const candidates = [
    join(process.cwd(), 'skills', `${packageName}.md`),
    join(process.cwd(), 'skills', packageName, 'SKILL.md'),
    // nested layout: skills/mumuspec/<name>/SKILL.md
    join(process.cwd(), 'skills', 'mumuspec', packageName, 'SKILL.md'),
    join(__dirname, '..', '..', 'skills', `${packageName}.md`),
    join(__dirname, '..', '..', 'skills', packageName, 'SKILL.md'),
    join(__dirname, '..', '..', 'skills', 'mumuspec', packageName, 'SKILL.md'),
    join(process.cwd(), 'node_modules', 'mumuspec', 'skills', `${packageName}.md`),
    join(process.cwd(), 'node_modules', 'mumuspec', 'skills', packageName, 'SKILL.md'),
    join(process.cwd(), 'node_modules', 'mumuspec', 'skills', 'mumuspec', packageName, 'SKILL.md'),
  ];
  return candidates.find((c) => existsSync(c));
}

function findMumuspecWorkflowSource(): string | undefined {
  const candidates = [
    join(process.cwd(), 'skills', 'mumuspec.md'),
    join(process.cwd(), 'skills', 'mumuspec-workflow', 'SKILL.md'),
    join(process.cwd(), 'skills', 'mumuspec', 'SKILL.md'),
    join(__dirname, '..', '..', 'skills', 'mumuspec.md'),
    join(__dirname, '..', '..', 'skills', 'mumuspec-workflow', 'SKILL.md'),
    join(__dirname, '..', '..', 'skills', 'mumuspec', 'SKILL.md'),
    join(process.cwd(), 'node_modules', 'mumuspec', 'skills', 'mumuspec.md'),
    join(process.cwd(), 'node_modules', 'mumuspec', 'skills', 'mumuspec', 'SKILL.md'),
    join(process.cwd(), '.catpaw', 'skills', 'mumuspec-workflow', 'SKILL.md'),
    join(
      process.platform === 'win32' ? process.env.USERPROFILE || '' : process.env.HOME || '',
      '.meituan-catpaw', 'skills', 'mumuspec-workflow', 'SKILL.md',
    ),
  ];
  return candidates.find((c) => existsSync(c));
}

function createMinimalWorkflowSkill(): string {
  return `---
name: mumuspec-workflow
description: "MumuSpec AI workflow orchestrator — guides developers through the full change lifecycle."
metadata:
  short-description: "MumuSpec workflow"
---

# MumuSpec Workflow

mumuspec init / mumuspec new <name> / mumuspec status / mumuspec guard <name> <phase>
`;
}

function getAgentSkillDir(
  agent: AgentType,
  target: InstallTarget,
  workspacePath?: string,
): { baseDir: string; skillsSubDir: string; fileExt: string } {
  const homeDir = process.platform === 'win32' ? (process.env.USERPROFILE || '') : (process.env.HOME || '');
  const workspace = workspacePath || process.cwd();

  const conventions: Record<string, { subDir: string; ext: string }> = {
    claude: { subDir: '.claude/commands', ext: '.md' },
    cursor: { subDir: '.cursor/commands', ext: '.md' },
    trae: { subDir: '.trae/skills', ext: 'SKILL.md' },
    workbuddy: { subDir: '.workbuddy/skills', ext: 'SKILL.md' },
    opencode: { subDir: '.opencode/skills', ext: 'SKILL.md' },
    // goal-p0-dispatch-gate (C1): directory-style SKILL.md for the new agents.
    // copilot deliberately absent — no custom-skill mechanism, .github untouched.
    codex: { subDir: '.codex/skills', ext: 'SKILL.md' },
    windsurf: { subDir: '.windsurf/skills', ext: 'SKILL.md' },
    gemini: { subDir: '.gemini/skills', ext: 'SKILL.md' },
  };

  const conv = conventions[agent];
  if (!conv) return { baseDir: workspace, skillsSubDir: '', fileExt: '.md' };
  return { baseDir: target === 'workspace' ? workspace : homeDir, skillsSubDir: conv.subDir, fileExt: conv.ext };
}

// ── Manifest queries ────────────────────────────────────────

/**
 * Get the package manifest for a specific agent type.
 * @param agent - The agent type (e.g., 'catpaw', 'claude', 'cursor')
 * @returns Array of package manifest entries available for the agent
 */
export function getManifest(agent: AgentType): PackageManifestEntry[] {
  return AGENT_MANIFEST[agent] ?? [];
}

/**
 * Search for packages in an agent's manifest by keyword.
 * @param agent - The agent type to search in
 * @param keyword - The search term (matches against package name or description)
 * @returns Filtered array of matching package manifest entries
 */
export function searchPackages(agent: AgentType, keyword: string): PackageManifestEntry[] {
  const lower = keyword.toLowerCase();
  return getManifest(agent).filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.category.toLowerCase().includes(lower),
  );
}

/**
 * Resolve a specific package by name from an agent's manifest.
 * @param agent - The agent type to search in
 * @param name - The exact package name to resolve
 * @returns The matching package manifest entry, or undefined if not found
 */
export function resolvePackage(agent: AgentType, name: string): PackageManifestEntry | undefined {
  return getManifest(agent).find((p) => p.name === name);
}

/**
 * Get all available MCP presets.
 * @returns Array of MCP preset entries that can be installed
 */
export function getMcpPresets(): McpPresetEntry[] {
  return MCP_PRESETS;
}

/**
 * Get all available command presets.
 * @returns Array of command preset entries that can be installed
 */
export function getCommandPresets(): CommandPresetEntry[] {
  return COMMAND_PRESETS;
}

// ── Core install operations ─────────────────────────────────

/**
 * Install a package for the specified agent.
 * @param agent - The agent type to install for (e.g., 'catpaw', 'claude')
 * @param packageName - The name of the package to install
 * @param target - The installation target ('user' for global, 'workspace' for project)
 * @param workspacePath - Required when target is 'workspace'
 * @param mode - Installation mode ('install' or 'update')
 * @returns Installation result with success status and details
 */
export function installPackage(
  agent: AgentType,
  packageName: string,
  target: InstallTarget,
  workspacePath?: string,
  mode: InstallMode = 'install',
): InstallResult {
  switch (agent) {
    case 'catpaw':
      return installCatpawPackage(packageName, target, workspacePath, mode);
    case 'claude':
    case 'cursor':
    case 'trae':
    case 'workbuddy':
    case 'opencode':
      return installGenericAgentPackage(agent, packageName, target, workspacePath, mode);
    case 'codex':
    case 'windsurf':
    case 'gemini': {
      const result = installGenericAgentPackage(agent, packageName, target, workspacePath, mode);
      // goal-p0-dispatch-gate (C2): rules generation rides on workspace-scope installs
      if (result.success && target === 'workspace' && workspacePath) {
        installRuleFiles(agent, workspacePath, { forceRules: mode === 'update' });
      }
      return result;
    }
    case 'copilot':
      // C2/D1: copilot distribution IS the canonical rules file (no skill files —
      // TC-A1x forbids extra files under .github/)
      if (target === 'workspace' && workspacePath) {
        return installRuleFilesAsResult(agent, packageName, target, workspacePath, mode === 'update');
      }
      return {
        success: false,
        packageName,
        agent,
        target,
        error: 'Copilot rules are workspace-scoped; use --target workspace --workspace-path <dir>.',
      };
    default:
      return { success: false, packageName, agent, target, error: `Unknown agent: ${agent}` };
  }
}

function createMinimalAgentSkill(pkg: PackageManifestEntry): string {
  return `---
name: ${pkg.name}
description: "${pkg.description}"
---

# ${pkg.name}

${pkg.description}

mumuspec init / mumuspec new <name> / mumuspec status / mumuspec guard <name> <phase>
`;
}

function installGenericAgentPackage(
  agent: AgentType,
  packageName: string,
  target: InstallTarget,
  workspacePath?: string,
  mode: InstallMode = 'install',
): InstallResult {
  const pkg = resolvePackage(agent, packageName);
  if (!pkg) return { success: false, packageName, agent, target, error: `Package "${packageName}" not found for agent "${agent}".` };

  try {
    const dirInfo = getAgentSkillDir(agent, target, workspacePath);
    const sourceSkill = findSkillSource(packageName);

    let targetPath: string;
    if (agent === 'claude' || agent === 'cursor') {
      const cmdName = pkg.command || packageName;
      targetPath = join(dirInfo.baseDir, dirInfo.skillsSubDir, `${cmdName}${dirInfo.fileExt}`);
    } else {
      targetPath = join(dirInfo.baseDir, dirInfo.skillsSubDir, packageName, dirInfo.fileExt);
    }

    if (existsSync(targetPath) && mode === 'install') {
      return { success: false, packageName, agent, target, path: targetPath, error: `Already installed at "${targetPath}". Use --force to update.` };
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    // ponytail: fallback to minimal skill content if source not found (aligned with CatPaw's createMinimalWorkflowSkill)
    const content = sourceSkill ? readFileSync(sourceSkill, 'utf8') : createMinimalAgentSkill(pkg);
    writeFileSync(targetPath, content, 'utf8');
    return { success: true, packageName, agent, target, path: targetPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, packageName, agent, target, error: `Failed to install "${packageName}" for ${agent}: ${message}` };
  }
}

// ── Rule files distribution (goal-p0-dispatch-gate C2/D1) ─────────

export interface InstallRulesResult {
  written: string[];
  skipped: Array<{ path: string; diagnostic?: string }>;
}

/**
 * 尝试从 workspace 读取 .mumuspec/config.json 的 project 段，用于渲染 AGENTS.md
 * 的项目信息。init 之前可能不存在 → undefined，回退到静态默认内容。
 */
function tryLoadInstallConfig(workspacePath: string): MumuSpecConfig | undefined {
  try {
    const configPath = join(workspacePath, '.mumuspec', 'config.json');
    if (!existsSync(configPath)) return undefined;
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as { project?: MumuSpecConfig['project'] };
    if (!parsed.project) return undefined;
    // ponytail: 仅 project 段参与渲染（buildRuleGenContext 只消费 project 字段）
    return { project: parsed.project } as MumuSpecConfig;
  } catch {
    return undefined;
  }
}

/** 内存快照：目标规则文件（canonical + bridges）的当前磁盘内容，absent = undefined */
function snapshotRuleFiles(agent: AgentType, workspacePath: string): Record<string, string | undefined> {
  const target = AGENT_RULE_TARGETS[agent];
  const snapshot: Record<string, string | undefined> = {};
  if (!target) return snapshot;
  for (const file of [target.rulesFile, ...Object.values(target.bridges).map((b) => b.file)]) {
    const filePath = join(workspacePath, file);
    snapshot[file] = existsSync(filePath) ? readFileSync(filePath, 'utf8') : undefined;
  }
  return snapshot;
}

/**
 * 渲染并落盘某 agent 的 canonical AGENTS.md（及薄壳桥接文件）。
 * 先读现有文件（内存快照）→ renderRuleFiles 三态判定（absent→create /
 * managed→update / user→skip）→ 执行写盘；skip 只收集诊断，不写盘。
 * `forceRules`（--force-rules）接管用户手写文件（D1）。
 */
export function installRuleFiles(
  agent: AgentType,
  workspacePath: string,
  opts: { forceRules?: boolean } = {},
): InstallRulesResult {
  const plans = renderRuleFiles(agent, buildRuleGenContext(tryLoadInstallConfig(workspacePath)), {
    existingFiles: snapshotRuleFiles(agent, workspacePath),
    forceRules: opts.forceRules === true,
  });
  const written: string[] = [];
  const skipped: Array<{ path: string; diagnostic?: string }> = [];
  for (const plan of plans) {
    const filePath = join(workspacePath, plan.path);
    if (plan.action === 'skip') {
      skipped.push({ path: filePath, diagnostic: plan.diagnostic });
      continue;
    }
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, plan.content ?? '', 'utf8');
    written.push(filePath);
  }
  return { written, skipped };
}

/** 包装 installRuleFiles 为 InstallResult（copilot 分发路径：分发即 AGENTS.md） */
function installRuleFilesAsResult(
  agent: AgentType,
  packageName: string,
  target: InstallTarget,
  workspacePath: string,
  forceRules: boolean,
): InstallResult {
  try {
    const { written, skipped } = installRuleFiles(agent, workspacePath, { forceRules });
    if (written.length > 0) {
      return { success: true, packageName, agent, target, path: written[0] };
    }
    const skipDiag = skipped.map((s) => `${s.path}${s.diagnostic ? ` (${s.diagnostic})` : ''}`).join('; ');
    return {
      success: false,
      packageName,
      agent,
      target,
      error: skipDiag
        ? `规则文件未写入（MumuSpec 不覆盖用户手写文件）：${skipDiag}。确认后可用 --force 接管。`
        : 'No rule files written.',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, packageName, agent, target, error: `Failed to write rule files: ${message}` };
  }
}

function installCatpawPackage(
  packageName: string,
  target: InstallTarget,
  workspacePath?: string,
  mode: InstallMode = 'install',
): InstallResult {
  if (packageName === 'mumuspec-workflow') return installMumuspecWorkflowSkill(target, workspacePath, mode);

  const pkg = resolvePackage('catpaw', packageName);
  if (!pkg) return { success: false, packageName, agent: 'catpaw', target, error: `Package "${packageName}" not found.` };
  if (!pkg.skillId) return { success: false, packageName, agent: 'catpaw', target, error: `No skill ID.` };

  try {
    const pawCmd = resolvePawCmd();
    const args: string[] = ['skills', 'install', '--skill-id', String(pkg.skillId)];
    if (target === 'workspace') {
      if (!workspacePath) return { success: false, packageName, agent: 'catpaw', target, error: 'Workspace requires --workspace-path' };
      args.push('--target', 'workspace', '--workspace-path', workspacePath);
    }

    // 安全执行：统一走 runPaw（spawnSync 数组形式 + 元字符校验）
    const output = runPaw(pawCmd, args);

    let installPath: string | undefined;
    let installSuccess = false;
    try {
      const result = JSON.parse(output);
      installSuccess = result.success === true;
      if (result.skillId) {
        installPath = target === 'workspace' && workspacePath
          ? join(workspacePath, '.meituan-catpaw', 'skills', result.skillId)
          : join(resolveCatpawDataDir() || '', 'skills', result.skillId);
      }
    } catch {
      installSuccess = output.toLowerCase().includes('success') || output.toLowerCase().includes('installed');
    }

    if (!installSuccess) return { success: false, packageName, agent: 'catpaw', target, error: `Install may not have completed.` };
    return { success: true, packageName, agent: 'catpaw', target, path: installPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      packageName,
      agent: 'catpaw',
      target,
      error: mode === 'update'
        ? `Marketplace update failed for "${packageName}": ${message}`
        : `Failed to install "${packageName}": ${message}`,
    };
  }
}

function installMumuspecWorkflowSkill(
  target: InstallTarget,
  workspacePath?: string,
  mode: InstallMode = 'install',
): InstallResult {
  try {
    let targetDir: string;
    if (target === 'workspace') {
      if (!workspacePath) return { success: false, packageName: 'mumuspec-workflow', agent: 'catpaw', target, error: 'Workspace requires --workspace-path' };
      targetDir = join(workspacePath, '.meituan-catpaw', 'skills', 'mumuspec-workflow');
    } else {
      const dataDir = resolveCatpawDataDir();
      if (!dataDir) return { success: false, packageName: 'mumuspec-workflow', agent: 'catpaw', target, error: 'Cannot determine data dir' };
      targetDir = join(dataDir, 'skills', 'mumuspec-workflow');
    }

    const targetFile = join(targetDir, 'SKILL.md');
    if (existsSync(targetFile) && mode === 'install') {
      return { success: false, packageName: 'mumuspec-workflow', agent: 'catpaw', target, path: targetDir, error: `Already installed at "${targetDir}".` };
    }

    mkdirSync(targetDir, { recursive: true });
    const source = findMumuspecWorkflowSource();
    writeFileSync(targetFile, source ? readFileSync(source, 'utf8') : createMinimalWorkflowSkill());
    return { success: true, packageName: 'mumuspec-workflow', agent: 'catpaw', target, path: targetDir };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, packageName: 'mumuspec-workflow', agent: 'catpaw', target, error: `Failed: ${message}` };
  }
}

// ── MCP server install ──────────────────────────────────────

/**
 * Install an MCP server preset into a workspace.
 * @param presetName - The name of the MCP preset to install
 * @param workspacePath - The workspace root path where .mcp.json resides
 * @returns Installation result with success status and server details
 */
export function installCatpawMcp(presetName: string, workspacePath: string): InstallMcpResult {
  const preset = MCP_PRESETS.find((p) => p.name === presetName);
  if (!preset) return { success: false, serverName: presetName, error: `MCP preset "${presetName}" not found.` };

  try {
    const mcpConfigPath = join(workspacePath, '.mcp.json');
    let existingConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };
    if (existsSync(mcpConfigPath)) {
      try {
        existingConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
      } catch { /* ignore */ }
      if (!existingConfig.mcpServers) existingConfig.mcpServers = {};
    }

    const config = { ...preset.config };
    if (config.env) {
      config.env = Object.fromEntries(
        Object.entries(config.env).map(([k, v]) => [k, v.replace('${workspaceRoot}', workspacePath)]),
      );
    }
    existingConfig.mcpServers[presetName] = config;
    writeFileSync(mcpConfigPath, JSON.stringify(existingConfig, null, 2), 'utf8');
    return { success: true, serverName: presetName, path: mcpConfigPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, serverName: presetName, error: `Failed: ${message}` };
  }
}

/**
 * List installed MCP servers in a workspace.
 * @param workspacePath - The workspace root path where .mcp.json resides
 * @returns Object containing installed server names and available presets
 */
export function listInstalledMcp(workspacePath: string): {
  success: boolean;
  installed: string[];
  available: string[];
  error?: string;
} {
  try {
    const mcpConfigPath = join(workspacePath, '.mcp.json');
    const installed: string[] = [];
    if (existsSync(mcpConfigPath)) {
      try {
        const config = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
        if (config.mcpServers) installed.push(...Object.keys(config.mcpServers));
      } catch { /* ignore */ }
    }
    return { success: true, installed, available: MCP_PRESETS.map((p) => p.name) };
  } catch (err: unknown) {
    return { success: false, installed: [], available: MCP_PRESETS.map((p) => p.name), error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Custom command install ──────────────────────────────────

/**
 * Install a custom command preset for CatPaw agent.
 * @param presetName - The name of the command preset to install
 * @param target - The installation target ('user' for global, 'workspace' for project)
 * @param workspacePath - Required when target is 'workspace'
 * @param mode - Installation mode ('install' or 'update')
 * @returns Installation result with success status and command details
 */
export function installCatpawCommand(
  presetName: string,
  target: InstallTarget,
  workspacePath?: string,
  mode: InstallMode = 'install',
): InstallCommandResult {
  const preset = COMMAND_PRESETS.find((p) => p.name === presetName);
  if (!preset) return { success: false, commandName: presetName, error: `Command preset "${presetName}" not found.` };

  try {
    let targetDir: string;
    if (target === 'workspace') {
      if (!workspacePath) return { success: false, commandName: presetName, error: 'Workspace requires --workspace-path' };
      targetDir = join(workspacePath, '.catpaw', 'commands');
    } else {
      const homeDir = process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME;
      if (!homeDir) return { success: false, commandName: presetName, error: 'Cannot determine home' };
      targetDir = join(homeDir, '.catpaw', 'commands');
    }

    mkdirSync(targetDir, { recursive: true });
    const filename = presetName.startsWith('/') ? presetName.slice(1) : presetName;
    const targetFile = join(targetDir, `${filename}.md`);

    if (existsSync(targetFile) && mode === 'install') {
      return { success: false, commandName: presetName, path: targetFile, error: `Command already installed at "${targetFile}".` };
    }

    writeFileSync(targetFile, preset.template, 'utf8');
    return { success: true, commandName: presetName, path: targetFile };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, commandName: presetName, error: `Failed: ${message}` };
  }
}

// ── Listing installed skills ────────────────────────────────

function parseInstalledSkills(output: string): Array<{
  name: string;
  alias?: string;
  installPath?: string;
  source?: string;
  enabled?: boolean;
  scope?: 'user' | 'workspace';
  workspacePath?: string;
}> {
  try {
    const result = JSON.parse(output);
    return result.skills || [];
  } catch {
    return [];
  }
}

/**
 * List installed skills for CatPaw agent.
 * @param workspacePath - Optional workspace path to scope the listing
 * @returns Object containing installed skills and optional error
 */
export function listInstalledCatpaw(workspacePath?: string): {
  success: boolean;
  skills: Array<{
    name: string;
    alias?: string;
    installPath?: string;
    source?: string;
    enabled?: boolean;
    scope?: 'user' | 'workspace';
    workspacePath?: string;
  }>;
  error?: string;
} {
  try {
    const pawCmd = resolvePawCmd();
    const args = ['skills', 'list'];
    if (workspacePath) args.push('--workspace-path', workspacePath);

    // 安全执行：统一走 runPaw（spawnSync 数组形式 + 元字符校验）
    const output = runPaw(pawCmd, args);
    return { success: true, skills: parseInstalledSkills(output) };
  } catch (err: unknown) {
    return { success: false, skills: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export function formatInstalledSkills(
  skills: Array<{
    name: string;
    alias?: string;
    installPath?: string;
    source?: string;
    enabled?: boolean;
    scope?: 'user' | 'workspace';
  }>,
): string {
  if (skills.length === 0) return 'No skills installed.';
  const lines: string[] = [`Total: ${skills.length} skill(s) installed`];
  skills.forEach((skill, index) => {
    const status = skill.enabled !== false ? '✓ enabled' : '✗ disabled';
    const scope = skill.scope || (skill.installPath?.includes('.meituan-catpaw') ? 'user' : 'workspace');
    const src = skill.source || 'user';
    lines.push(`  ${index + 1}. ${skill.name} (${status}, ${src}, ${scope})`);
    if (skill.installPath) lines.push(`     ${skill.installPath}`);
  });
  return lines.join('\n');
}

// ── Generic agent installed skills listing (aligned with CatPaw) ──

export interface AgentInstalledSkill {
  name: string;
  path: string;
  scope: 'user' | 'workspace';
}

/**
 * Scan the agent's skill directory for installed skills.
 * Works by reading the filesystem directly (no CLI dependency).
 */
export function listInstalledAgentSkills(
  agent: AgentType,
  target: InstallTarget,
  workspacePath?: string,
): { success: boolean; skills: AgentInstalledSkill[]; error?: string } {
  try {
    const dirInfo = getAgentSkillDir(agent, target, workspacePath);
    const skillsDir = join(dirInfo.baseDir, dirInfo.skillsSubDir);

    // copilot 等无自定义 skill 机制的 agent（skillsSubDir 为空）：无可列技能
    if (!dirInfo.skillsSubDir) {
      return { success: true, skills: [] };
    }

    if (!existsSync(skillsDir)) {
      return { success: true, skills: [] };
    }

    const skills: AgentInstalledSkill[] = [];
    const entries = readdirSync(skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(skillsDir, entry.name);

      if (agent === 'claude' || agent === 'cursor') {
        // These agents use flat .md files in commands dir
        if (entry.isFile() && entry.name.endsWith(dirInfo.fileExt)) {
          skills.push({
            name: entry.name.replace(/\.md$/, ''),
            path: fullPath,
            scope: target,
          });
        }
      } else if (entry.isDirectory()) {
        // trae, workbuddy, opencode use subdirectories with SKILL.md
        const skillFile = join(fullPath, dirInfo.fileExt);
        if (existsSync(skillFile)) {
          skills.push({
            name: entry.name,
            path: skillFile,
            scope: target,
          });
        }
      }
    }

    return { success: true, skills };
  } catch (err: unknown) {
    return {
      success: false,
      skills: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Format installed skills for display — matches CatPaw's formatInstalledSkills style.
 */
export function formatAgentInstalledSkills(
  skills: AgentInstalledSkill[],
  agentName: string,
): string {
  if (skills.length === 0) return `No skills installed for ${agentName}.`;
  const lines: string[] = [`Total: ${skills.length} skill(s) installed`];
  skills.forEach((skill, index) => {
    lines.push(`  ${index + 1}. ${skill.name} (${skill.scope})`);
    lines.push(`     ${skill.path}`);
  });
  return lines.join('\n');
}

// ── Validation ──────────────────────────────────────────────

/**
 * Check if an agent type is supported.
 * @param agent - The agent identifier to check
 * @returns True if the agent is supported, false otherwise
 */
export function isAgentSupported(agent: string): agent is AgentType {
  return ['catpaw', 'claude', 'cursor', 'trae', 'workbuddy', 'opencode', 'codex', 'windsurf', 'gemini', 'copilot'].includes(agent);
}

/**
 * Get all supported agent types.
 * @returns Array of supported agent type identifiers
 */
export function getSupportedAgents(): AgentType[] {
  return ['catpaw', 'claude', 'cursor', 'trae', 'workbuddy', 'opencode', 'codex', 'windsurf', 'gemini', 'copilot'];
}
