/**
 * install command — Install skills, MCP servers, and commands for AI coding agents.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import {
  getManifest,
  searchPackages,
  resolvePackage,
  installPackage,
  installCatpawMcp,
  listInstalledMcp,
  installCatpawCommand,
  getMcpPresets,
  getCommandPresets,
  listInstalledCatpaw,
  formatInstalledSkills,
} from '../../install/installer.js';
import { createAgentInstallSubcommand } from '../helpers.js';
import { join, resolve } from 'node:path';
import { installPluginPackage } from '../../install/plugin-install.js';

export function registerInstallCommands(program: Command): void {
  const installCmd = program
    .command('install')
    .description('Install skills, MCP servers, and commands for AI coding agents');

  // --- host-standard plugin package install ---
  installCmd
    .command('plugin')
    .description('安装宿主标准插件包到插件缓存并登记（幂等，登记失败即整体失败）')
    .option('--from <dir>', '插件包目录', 'dist-plugin')
    .option('--marketplace <name>', '市场名', 'mumuspec')
    .option('--scope <scope>', '安装范围：user 或 project', 'user')
    .option('--dry-run', '只报告计划，不写盘')
    .action((options) => {
      const home =
        process.platform === 'win32' ? process.env.USERPROFILE || '' : process.env.HOME || '';
      if (!home) {
        console.error('✗ 无法解析用户主目录（USERPROFILE / HOME 均未设置）');
        process.exit(1);
      }
      const pluginsRoot = join(home, '.workbuddy', 'plugins');

      const result = installPluginPackage(resolve(options.from), {
        cacheRoot: join(pluginsRoot, 'cache'),
        registryPath: join(pluginsRoot, 'installed_plugins.json'),
        marketplaceName: options.marketplace,
        scope: options.scope === 'project' ? 'project' : 'user',
        dryRun: options.dryRun === true,
      });

      if (!result.ok) {
        console.error(`✗ ${result.error}`);
        for (const v of result.violations ?? []) {
          console.error(`  ✗ [${v.path}] (${v.rule}) ${v.message}`);
        }
        process.exit(1);
      }

      console.log(`${options.dryRun ? '·  计划（未写盘）' : '✓ 已安装'}: ${result.installPath}`);
      if (result.registryEntry) {
        console.log(
          `  登记键: ${options.marketplace} (version=${result.registryEntry.version}, scope=${result.registryEntry.scope})`,
        );
      }
      if (options.dryRun) {
        console.log('  注册表未改动（--dry-run）；去掉该开关即实际写入。');
      }
    });

  // --- catpaw skill install ---
  installCmd
    .command('catpaw')
    .description('Install CatPaw skills from the curated manifest')
    .argument('[packages...]', 'skill package names to install (e.g., browser pdf pptx)')
    .option('--list', 'list available packages in the manifest')
    .option('--installed', 'list currently installed skills via paw CLI')
    .option('--force', 'force update if already installed')
    .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
    .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
    .option('--search <keyword>', 'search available packages by keyword')
    .action((packages, options) => {

      // --list: show available packages
      if (options.list) {
        const manifest = getManifest('catpaw');
        if (manifest.length === 0) {
          console.log('No packages available for CatPaw in the manifest.');
          return;
        }
        console.log('\nAvailable CatPaw skill packages:\n');
        const categories = new Map<string, typeof manifest>();
        for (const pkg of manifest) {
          const list = categories.get(pkg.category) || [];
          list.push(pkg);
          categories.set(pkg.category, list);
        }
        for (const [category, pkgs] of categories) {
          console.log(`  [${category}]`);
          for (const pkg of pkgs) {
            const idStr = pkg.skillId ? ` (skill-id: ${pkg.skillId})` : ' (local)';
            console.log(`    ${pkg.name}${idStr}`);
            console.log(`      ${pkg.description}`);
          }
        }
        console.log('\nUsage: mumuspec install catpaw <package1> [package2 ...]');
        console.log('       mumuspec install catpaw mumuspec-workflow     # Install workflow orchestrator');
        return;
      }

      // --search: search packages
      if (options.search) {
        const results = searchPackages('catpaw', options.search);
        if (results.length === 0) {
          console.log(`No packages match "${options.search}".`);
          return;
        }
        console.log(`\n${results.length} package(s) matching "${options.search}":`);
        for (const pkg of results) {
          console.log(`  ${pkg.name} — ${pkg.description}`);
        }
        return;
      }

      // --installed: show currently installed skills
      if (options.installed) {
        const workspacePath = options.workspacePath || undefined;
        const result = listInstalledCatpaw(workspacePath);
        if (result.success) {
          console.log('\nInstalled CatPaw Skills:');
          console.log(formatInstalledSkills(result.skills));
        } else {
          console.error(`Error listing installed skills: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Install packages
      if (!packages || packages.length === 0) {
        console.error('Error: No packages specified. Use --list to see available packages, or provide package names.');
        console.error('Example: mumuspec install catpaw browser pdf');
        process.exit(1);
      }

      const target = options.target as 'user' | 'workspace';
      const workspacePath = options.workspacePath;

      // Validate workspace path requirement
      if (target === 'workspace' && !workspacePath) {
        console.error('Error: --workspace-path is required when --target workspace');
        console.error('       Use --workspace-path . for current directory');
        process.exit(1);
      }

      // For workspace installs, validate directory exists
      if (workspacePath) {
        if (!existsSync(workspacePath)) {
          console.error(`Error: Workspace path does not exist: ${workspacePath}`);
          process.exit(1);
        }
      }

      let successCount = 0;
      let failCount = 0;

      for (const pkgName of packages) {
        const pkg = resolvePackage('catpaw', pkgName);
        if (!pkg) {
          console.error(`✗ Unknown package: "${pkgName}" (use --list to see available packages)`);
          failCount++;
          continue;
        }

        console.log(`\nInstalling "${pkgName}" (${pkg.description})...`);
        const mode = options.force ? 'update' : 'install';
        const result = installPackage('catpaw', pkgName, target, workspacePath, mode);

        if (result.success) {
          const action = mode === 'update' ? 'Updated' : 'Installed';
          console.log(`✓ ${action} "${pkgName}" [${target} scope]`);
          if (result.path) console.log(`  Path: ${result.path}`);
          successCount++;
        } else {
          console.error(`✗ Failed to install "${pkgName}": ${result.error}`);
          failCount++;
        }
      }

      console.log(`\nDone: ${successCount} succeeded, ${failCount} failed.`);
      if (failCount > 0) process.exit(1);
    });

  // --- catpaw MCP server install ---
  installCmd
    .command('mcp')
    .description('Install MCP server workspace configuration for CatPaw')
    .argument('[server]', 'MCP server preset name (e.g., mumuspec)')
    .option('--list', 'list available MCP server presets')
    .option('--installed', 'list currently installed MCP configs in workspace')
    .option('--workspace-path <path>', 'workspace path (required)', '.')
    .action((server, options) => {
      const workspacePath = options.workspacePath;

      // --list: show available MCP presets
      if (options.list) {
        const presets = getMcpPresets();
        console.log('\nAvailable MCP server presets:\n');
        for (const preset of presets) {
          console.log(`  ${preset.name}`);
          console.log(`    ${preset.description}`);
          console.log(`    Command: ${preset.config.command} ${(preset.config.args || []).join(' ')}`);
        }
        console.log('\nUsage: mumuspec install mcp <server-name> --workspace-path .');
        return;
      }

      // --installed: show workspace MCP configs
      if (options.installed) {
        const result = listInstalledMcp(workspacePath);
        console.log(`\nMCP servers in ${workspacePath}:`);
        if (result.installed.length > 0) {
          for (const name of result.installed) {
            console.log(`  ✓ ${name}`);
          }
        } else {
          console.log('  (none configured)');
        }
        if (result.available.length > 0) {
          console.log(`\nAvailable presets: ${result.available.join(', ')}`);
        }
        return;
      }

      // Install MCP server config
      if (!server) {
        console.error('Error: No MCP server specified. Use --list to see presets.');
        process.exit(1);
      }

      console.log(`Installing MCP server "${server}" to ${workspacePath}...`);
      const result = installCatpawMcp(server, workspacePath);

      if (result.success) {
        console.log(`✓ Installed MCP config: ${result.serverName}`);
        console.log(`  Config file: ${result.path}`);
        console.log('\nRestart CatPaw or reload workspace to activate the MCP server.');
      } else {
        console.error(`✗ Failed to install MCP server: ${result.error}`);
        process.exit(1);
      }
    });

  // --- catpaw command install ---
  installCmd
    .command('command')
    .description('Install CatPaw custom slash commands')
    .argument('[command]', 'command preset name (e.g., /mumuspec)')
    .option('--list', 'list available command presets')
    .option('--force', 'force update if already installed')
    .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
    .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
    .action((command, options) => {
      const target = options.target as 'user' | 'workspace';
      const workspacePath = options.workspacePath;

      if (target === 'workspace' && !workspacePath) {
        console.error('Error: --workspace-path is required when --target workspace');
        process.exit(1);
      }

      // --list: show available command presets
      if (options.list) {
        const presets = getCommandPresets();
        console.log('\nAvailable command presets:\n');
        for (const preset of presets) {
          console.log(`  ${preset.name}`);
          console.log(`    ${preset.description}`);
        }
        console.log('\nUsage: mumuspec install command <command-name>');
        return;
      }

      // Install command
      if (!command) {
        console.error('Error: No command specified. Use --list to see presets.');
        process.exit(1);
      }

      console.log(`Installing custom command "${command}" [${target} scope]...`);
      const cmdMode = options.force ? 'update' : 'install';
      const result = installCatpawCommand(command, target, workspacePath, cmdMode);

      if (result.success) {
        const action = cmdMode === 'update' ? 'Updated' : 'Installed';
        console.log(`✓ ${action} command: ${result.commandName}`);
        console.log(`  Command file: ${result.path}`);
        console.log('\nUse /' + (result.commandName.startsWith('/') ? result.commandName.slice(1) : result.commandName) + ' in CatPaw to invoke.');
      } else {
        console.error(`✗ Failed to install command: ${result.error}`);
        process.exit(1);
      }
    });

  // Claude Code commands install
  createAgentInstallSubcommand(installCmd, 'claude', 'claude', 'Install Claude Code slash commands');

  // Cursor IDE commands install
  createAgentInstallSubcommand(installCmd, 'cursor', 'cursor', 'Install Cursor IDE slash commands');

  // TraeCode / TraeWork skills install (install-trae-agents: trae → traecode + traework)
  createAgentInstallSubcommand(installCmd, 'traecode', 'traecode', 'Install TraeCode skills + AGENTS.md rules');
  createAgentInstallSubcommand(installCmd, 'traework', 'traework', 'Install TraeWork skills + AGENTS.md rules');

  // WorkBuddy commands install
  createAgentInstallSubcommand(installCmd, 'workbuddy', 'workbuddy', 'Install WorkBuddy skills');

  // OpenCode commands install
  createAgentInstallSubcommand(installCmd, 'opencode', 'opencode', 'Install OpenCode skills');

  // goal-p0-dispatch-gate (C1): new agents — installs skills AND canonical AGENTS.md rules
  createAgentInstallSubcommand(installCmd, 'codex', 'codex', 'Install Codex skills + canonical AGENTS.md rules');
  createAgentInstallSubcommand(installCmd, 'windsurf', 'windsurf', 'Install Windsurf skills + canonical AGENTS.md rules');
  createAgentInstallSubcommand(installCmd, 'gemini', 'gemini', 'Install Gemini skills + GEMINI.md bridge + AGENTS.md rules');
  // copilot: distribution IS the canonical rules file (TC-A1x — no .github extras)
  createAgentInstallSubcommand(installCmd, 'copilot', 'copilot', 'Install GitHub Copilot AGENTS.md rules (workspace-scoped)');

  // Default: show help when no subcommand given
  installCmd.action(() => {
    console.log('Install skills, MCP servers, and commands for AI coding agents.\n');
    console.log('Agents:');
    console.log('  mumuspec install catpaw [packages...]        Install CatPaw skills');
    console.log('  mumuspec install claude [packages...]        Install Claude Code slash commands');
    console.log('  mumuspec install cursor [packages...]        Install Cursor IDE slash commands');
    console.log('  mumuspec install traecode [packages...]      Install TraeCode skills + AGENTS.md rules');
    console.log('  mumuspec install traework [packages...]      Install TraeWork skills + AGENTS.md rules');
    console.log('  mumuspec install workbuddy [packages...]     Install WorkBuddy skills');
    console.log('  mumuspec install opencode [packages...]      Install OpenCode skills');
    console.log('  mumuspec install codex [packages...]         Install Codex skills + AGENTS.md rules');
    console.log('  mumuspec install windsurf [packages...]      Install Windsurf skills + AGENTS.md rules');
    console.log('  mumuspec install gemini [packages...]        Install Gemini skills + GEMINI.md bridge');
    console.log('  mumuspec install copilot <pkg>               Install Copilot AGENTS.md rules (workspace only)');
    console.log('  mumuspec install mcp <server>                Install MCP server config to workspace');
    console.log('  mumuspec install command <name>              Install custom slash command (CatPaw)');
    console.log('\nCommon options (per agent):');
    console.log('  --list                List available packages');
    console.log('  --search <keyword>    Search packages by keyword');
    console.log('  --target user         Install to user scope (default)');
    console.log('  --target workspace    Install to workspace scope');
    console.log('  --project-only        Install to current project only (workspace target, cwd)');
    console.log('  --workspace-path      Path for workspace installation');
    console.log('  --force               Force update (overwrites managed rule files)');
    console.log('\nMCP options:');
    console.log('  --list                List available MCP presets');
    console.log('  --installed           Show workspace MCP configs');
    console.log('  --workspace-path      Workspace path (default: current directory)');
  });
}
