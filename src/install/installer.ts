import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// Agent types supported by the install command
export type AgentType = 'catpaw' | 'claude' | 'cursor';

// Installation target scope
export type InstallTarget = 'user' | 'workspace';

// A curated package entry in the manifest
export interface PackageManifestEntry {
  name: string;
  description: string;
  agent: AgentType;
  // For CatPaw: skill-id from the marketplace
  skillId?: number;
  // For Claude/Cursor: command slug
  command?: string;
  category: string;
}

// MCP server preset entry
export interface McpPresetEntry {
  name: string;
  description: string;
  // MCP server configuration (subset of MCP spec)
  config: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  category: string;
}

// Custom command entry (CatPaw slash commands)
export interface CommandPresetEntry {
  name: string;
  description: string;
  // Command content template
  template: string;
  category: string;
}

// Result of an install operation
export interface InstallResult {
  success: boolean;
  packageName: string;
  agent: AgentType;
  target: InstallTarget;
  path?: string;
  error?: string;
}

// Result of MCP install
export interface InstallMcpResult {
  success: boolean;
  serverName: string;
  path?: string;
  error?: string;
}

// Result of command install
export interface InstallCommandResult {
  success: boolean;
  commandName: string;
  path?: string;
  error?: string;
}

// ============================================================
// Curated packages registry
// ============================================================

// CatPaw skills (from skill marketplace)
const CATPAW_PACKAGES: PackageManifestEntry[] = [
  {
    name: 'browser',
    description: 'Browser automation — navigate pages, fill forms, screenshots, data extraction',
    agent: 'catpaw',
    skillId: 10,
    category: 'automation',
  },
  {
    name: 'pdf',
    description: 'PDF processing — extract text/tables, merge/split, rotate, encrypt, OCR',
    agent: 'catpaw',
    skillId: 11,
    category: 'document',
  },
  {
    name: 'pptx',
    description: 'PowerPoint processing — create, read, edit presentations and slides',
    agent: 'catpaw',
    skillId: 12,
    category: 'document',
  },
  {
    name: 'xlsx',
    description: 'Excel processing — create, read, edit spreadsheets with formulas and charts',
    agent: 'catpaw',
    skillId: 13,
    category: 'document',
  },
  {
    name: 'docx',
    description: 'Word processing — create, read, edit documents with formatting and styles',
    agent: 'catpaw',
    skillId: 14,
    category: 'document',
  },
  {
    name: 'settings',
    description: 'CatPaw settings management — preferences, MCP servers, app config',
    agent: 'catpaw',
    skillId: 15,
    category: 'productivity',
  },
];

// mumuspec-workflow skill (local, not from marketplace)
const MUMUSPEC_WORKFLOW_PACKAGE: PackageManifestEntry = {
  name: 'mumuspec-workflow',
  description: 'MumuSpec AI workflow orchestrator — full lifecycle change management',
  agent: 'catpaw',
  category: 'workflow',
};

// MCP server presets
const MCP_PRESETS: McpPresetEntry[] = [
  {
    name: 'mumuspec',
    description: 'MumuSpec MCP Server — code graph, spec queries, constraint validation',
    config: {
      command: 'npx',
      args: ['@mumuspec/mcp-server'],
      env: { MUMUSPEC_ROOT: '${workspaceRoot}' },
    },
    category: 'development',
  },
];

// Custom command presets
const COMMAND_PRESETS: CommandPresetEntry[] = [
  {
    name: '/mumuspec',
    description: 'MumuSpec workflow — full lifecycle change management',
    template: `# MumuSpec Workflow
# This command triggers the MumuSpec AI coding workflow
# Auto-detects project state and guides through phases

Use the mumuspec-workflow skill to drive the development workflow.`,
    category: 'workflow',
  },
];

// Future: Claude Code commands registry
const CLAUDE_PACKAGES: PackageManifestEntry[] = [];

// Future: Cursor commands registry
const CURSOR_PACKAGES: PackageManifestEntry[] = [];

// ============================================================
// Shared utilities
// ============================================================

/**
 * Resolve the paw CLI path based on platform.
 * Checks common installation paths first, falls back to PATH.
 */
function resolvePawCmd(): string {
  if (process.platform === 'win32') {
    const winPath = join(
      process.env.USERPROFILE || '',
      '.meituan-catpaw',
      'bin',
      'paw.cmd',
    );
    if (existsSync(winPath)) return winPath;
    // Also check .exe variant
    const winExe = join(
      process.env.USERPROFILE || '',
      '.meituan-catpaw',
      'bin',
      'paw.exe',
    );
    if (existsSync(winExe)) return winExe;
  } else {
    const unixPath = join(
      process.env.HOME || '',
      '.meituan-catpaw',
      'bin',
      'paw',
    );
    if (existsSync(unixPath)) return unixPath;
  }

  // Fallback: assume paw is on PATH
  return 'paw';
}

// ============================================================
// Manifest access
// ============================================================

/**
 * Get the manifest of packages available for an agent.
 */
export function getManifest(agent: AgentType): PackageManifestEntry[] {
  switch (agent) {
    case 'catpaw':
      return [...CATPAW_PACKAGES, MUMUSPEC_WORKFLOW_PACKAGE];
    case 'claude':
      return CLAUDE_PACKAGES;
    case 'cursor':
      return CURSOR_PACKAGES;
    default:
      return [];
  }
}

/**
 * Search packages by keyword for an agent.
 */
export function searchPackages(agent: AgentType, keyword: string): PackageManifestEntry[] {
  const manifest = getManifest(agent);
  const lower = keyword.toLowerCase();
  return manifest.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.category.toLowerCase().includes(lower),
  );
}

/**
 * Resolve a package entry by agent and name.
 */
export function resolvePackage(agent: AgentType, name: string): PackageManifestEntry | undefined {
  return getManifest(agent).find((p) => p.name === name);
}

/**
 * Get MCP presets
 */
export function getMcpPresets(): McpPresetEntry[] {
  return MCP_PRESETS;
}

/**
 * Get custom command presets
 */
export function getCommandPresets(): CommandPresetEntry[] {
  return COMMAND_PRESETS;
}

// ============================================================
// Core install functions
// ============================================================

/**
 * Install a package for the specified agent.
 */
export function installPackage(
  agent: AgentType,
  packageName: string,
  target: InstallTarget,
  workspacePath?: string,
): InstallResult {
  switch (agent) {
    case 'catpaw':
      return installCatpawPackage(packageName, target, workspacePath);
    case 'claude':
    case 'cursor':
      return {
        success: false,
        packageName,
        agent,
        target,
        error: `Agent "${agent}" installer not yet implemented. Coming soon.`,
      };
    default:
      return {
        success: false,
        packageName,
        agent,
        target,
        error: `Unknown agent: ${agent}`,
      };
  }
}

/**
 * Install a CatPaw skill via paw skills CLI.
 *
 * paw skills install response format:
 *   User scope: {"success":true,"skillId":"skill-directory-name"}
 *   Workspace scope: {"success":true,"skillId":"skill-directory-name"}
 *
 * The skillId in response is a STRING (directory name), NOT a numeric ID.
 */
function installCatpawPackage(
  packageName: string,
  target: InstallTarget,
  workspacePath?: string,
): InstallResult {
  // Check if this is the mumuspec-workflow local skill
  if (packageName === 'mumuspec-workflow') {
    return installMumuspecWorkflowSkill(target, workspacePath);
  }

  const pkg = resolvePackage('catpaw', packageName);

  if (!pkg) {
    return {
      success: false,
      packageName,
      agent: 'catpaw',
      target,
      error: `Package "${packageName}" not found in manifest. Run \`mumuspec install catpaw --list\` to see available packages.`,
    };
  }

  if (!pkg.skillId) {
    return {
      success: false,
      packageName,
      agent: 'catpaw',
      target,
      error: `Package "${packageName}" has no associated skill ID.`,
    };
  }

  try {
    const pawCmd = resolvePawCmd();

    // Build the install command
    const args: string[] = ['skills', 'install', '--skill-id', String(pkg.skillId)];

    if (target === 'workspace' && workspacePath) {
      args.push('--target', 'workspace', '--workspace-path', workspacePath);
    } else if (target === 'workspace' && !workspacePath) {
      return {
        success: false,
        packageName,
        agent: 'catpaw',
        target,
        error: 'Workspace target requires --workspace-path',
      };
    }

    const cmd = `"${pawCmd}" ${args.join(' ')}`;
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    // Parse result — handle both JSON and non-JSON output
    let installPath: string | undefined;
    let installSuccess = false;

    try {
      const result = JSON.parse(output);
      installSuccess = result.success === true;
      // skillId in response is a STRING (directory name)
      if (result.skillId) {
        if (target === 'workspace' && workspacePath) {
          installPath = join(workspacePath, '.meituan-catpaw', 'skills', result.skillId);
        } else {
          const homeDir = process.platform === 'win32'
            ? process.env.USERPROFILE
            : process.env.HOME;
          installPath = join(homeDir || '', '.meituan-catpaw', 'skills', result.skillId);
        }
      }
    } catch {
      // Non-JSON output from older paw CLI versions — check for success indicators
      installSuccess = output.toLowerCase().includes('success') ||
                       output.toLowerCase().includes('installed');
    }

    if (!installSuccess) {
      return {
        success: false,
        packageName,
        agent: 'catpaw',
        target,
        error: `Installation may not have completed successfully. Output: ${output.substring(0, 200)}`,
      };
    }

    return {
      success: true,
      packageName,
      agent: 'catpaw',
      target,
      path: installPath,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      packageName,
      agent: 'catpaw',
      target,
      error: `Failed to install "${packageName}": ${message}`,
    };
  }
}

/**
 * Install the mumuspec-workflow skill from local source (not marketplace).
 * Copies the SKILL.md file to the target skills directory.
 */
function installMumuspecWorkflowSkill(
  target: InstallTarget,
  workspacePath?: string,
): InstallResult {
  try {
    let targetDir: string;

    if (target === 'workspace') {
      if (!workspacePath) {
        return {
          success: false,
          packageName: 'mumuspec-workflow',
          agent: 'catpaw',
          target,
          error: 'Workspace target requires --workspace-path',
        };
      }
      targetDir = join(workspacePath, '.meituan-catpaw', 'skills', 'mumuspec-workflow');
    } else {
      const homeDir = process.platform === 'win32'
        ? process.env.USERPROFILE
        : process.env.HOME;
      if (!homeDir) {
        return {
          success: false,
          packageName: 'mumuspec-workflow',
          agent: 'catpaw',
          target,
          error: 'Cannot determine home directory for user scope install',
        };
      }
      targetDir = join(homeDir, '.meituan-catpaw', 'skills', 'mumuspec-workflow');
    }

    // Create target directory
    mkdirSync(targetDir, { recursive: true });

    // Copy SKILL.md — source is at project or user-level install
    const sourceSkill = findMumuspecWorkflowSource();
    const targetFile = join(targetDir, 'SKILL.md');

    if (sourceSkill) {
      // Read from source and write to target
      const content = readFileSync(sourceSkill, 'utf8');
      writeFileSync(targetFile, content);
    } else {
      // Fallback: write a minimal SKILL.md if source not found
      writeFileSync(targetFile, createMinimalWorkflowSkill());
    }

    return {
      success: true,
      packageName: 'mumuspec-workflow',
      agent: 'catpaw',
      target,
      path: targetDir,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      packageName: 'mumuspec-workflow',
      agent: 'catpaw',
      target,
      error: `Failed to install mumuspec-workflow: ${message}`,
    };
  }
}

/**
 * Find the source path for the mumuspec-workflow skill.
 */
function findMumuspecWorkflowSource(): string | undefined {
  // Check common locations
  const candidates = [
    // Project-level
    join(process.cwd(), '.catpaw', 'skills', 'mumuspec-workflow', 'SKILL.md'),
    // User-level (existing install)
    join(
      process.platform === 'win32' ? process.env.USERPROFILE || '' : process.env.HOME || '',
      '.meituan-catpaw', 'skills', 'mumuspec-workflow', 'SKILL.md',
    ),
    // Local project relative
    join(process.cwd(), 'dist', 'mumuspec-workflow', 'SKILL.md'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return undefined;
}

/**
 * Create a minimal workflow skill definition (fallback).
 */
function createMinimalWorkflowSkill(): string {
  return `---
name: mumuspec-workflow
description: "MumuSpec AI workflow orchestrator — guides developers through the full change lifecycle (Open → Design → Build → Verify → Archive). Auto-detects project state and dispatches to appropriate phase skills."
metadata:
  short-description: "MumuSpec workflow"
---

# MumuSpec Workflow

MumuSpec is a specification-driven AI coding workflow.

## Quick Start

\`\`\`bash
mumuspec init              # Initialize project
mumuspec new <name>        # Create a change
mumuspec status            # Check current state
mumuspec guard <name> <phase>  # Run phase guard
\`\`\`

## Phases

1. **Open** — Brainstorming, scope definition, delta-specs
2. **Design** — Cognitive framework (Q1-Q4), top-down design, test-case lock
3. **Build** — Bottom-up TDD implementation, Ponytail compliance
4. **Verify** — Spec compliance, immutability check, branch handling
5. **Archive** — Merge to main spec, knowledge extraction

## Constraints

- Ponytail 7-level priority ladder is enforced
- TDD mode is always ON (tdd_mode: tdd)
- brainstorming MUST NOT be skipped
- User confirmation required at all blocking points
`;
}

// ============================================================
// MCP server install
// ============================================================

/**
 * Install an MCP server configuration for CatPaw workspace scope.
 * Creates or updates .mcp.json in the workspace root.
 */
export function installCatpawMcp(
  presetName: string,
  workspacePath: string,
): InstallMcpResult {
  const preset = MCP_PRESETS.find((p) => p.name === presetName);
  if (!preset) {
    return {
      success: false,
      serverName: presetName,
      error: `MCP preset "${presetName}" not found. Available: ${MCP_PRESETS.map(p => p.name).join(', ')}`,
    };
  }

  try {
    const mcpConfigPath = join(workspacePath, '.mcp.json');
    let existingConfig: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

    // Read existing config if present
    if (existsSync(mcpConfigPath)) {
      try {
        const content = readFileSync(mcpConfigPath, 'utf8');
        existingConfig = JSON.parse(content);
        if (!existingConfig.mcpServers) existingConfig.mcpServers = {};
      } catch {
        // Invalid JSON — start fresh
        existingConfig = { mcpServers: {} };
      }
    }

    // Substitute ${workspaceRoot} in env values
    const config = { ...preset.config };
    if (config.env) {
      config.env = Object.fromEntries(
        Object.entries(config.env).map(([k, v]) => [
          k,
          v.replace('${workspaceRoot}', workspacePath),
        ]),
      );
    }

    // Merge with existing config
    existingConfig.mcpServers[presetName] = config;

    // Write back
    writeFileSync(mcpConfigPath, JSON.stringify(existingConfig, null, 2), 'utf8');

    return {
      success: true,
      serverName: presetName,
      path: mcpConfigPath,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      serverName: presetName,
      error: `Failed to install MCP server config: ${message}`,
    };
  }
}

/**
 * List installed MCP presets (check which are configured in workspace).
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
        const content = readFileSync(mcpConfigPath, 'utf8');
        const config = JSON.parse(content);
        if (config.mcpServers) {
          installed.push(...Object.keys(config.mcpServers));
        }
      } catch {
        // unreadable
      }
    }

    return {
      success: true,
      installed,
      available: MCP_PRESETS.map(p => p.name),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      installed: [],
      available: MCP_PRESETS.map(p => p.name),
      error: message,
    };
  }
}

// ============================================================
// Custom command install
// ============================================================

/**
 * Install a CatPaw custom command (slash command).
 * Creates command definition in .catpaw/commands/ directory.
 */
export function installCatpawCommand(
  presetName: string,
  target: InstallTarget,
  workspacePath?: string,
): InstallCommandResult {
  const preset = COMMAND_PRESETS.find((p) => p.name === presetName);
  if (!preset) {
    return {
      success: false,
      commandName: presetName,
      error: `Command preset "${presetName}" not found. Available: ${COMMAND_PRESETS.map(p => p.name).join(', ')}`,
    };
  }

  try {
    let targetDir: string;

    if (target === 'workspace') {
      if (!workspacePath) {
        return {
          success: false,
          commandName: presetName,
          error: 'Workspace target requires --workspace-path',
        };
      }
      targetDir = join(workspacePath, '.catpaw', 'commands');
    } else {
      const homeDir = process.platform === 'win32'
        ? process.env.USERPROFILE
        : process.env.HOME;
      if (!homeDir) {
        return {
          success: false,
          commandName: presetName,
          error: 'Cannot determine home directory',
        };
      }
      targetDir = join(homeDir, '.catpaw', 'commands');
    }

    mkdirSync(targetDir, { recursive: true });

    // Write command file (strip leading / from name for filename)
    const filename = presetName.startsWith('/') ? presetName.slice(1) : presetName;
    const targetFile = join(targetDir, `${filename}.md`);
    writeFileSync(targetFile, preset.template, 'utf8');

    return {
      success: true,
      commandName: presetName,
      path: targetFile,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      commandName: presetName,
      error: `Failed to install command: ${message}`,
    };
  }
}

// ============================================================
// Listing installed skills
// ============================================================

/**
 * Parse installed skills from paw skills list JSON output.
 *
 * Expected format:
 *   {"skills":[{"name":"...","alias":"...","installPath":"...","source":"market","enabled":true}],"count":5}
 */
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
 * Get installed skills for CatPaw via paw CLI.
 * Returns parsed structured data.
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

    if (workspacePath) {
      args.push('--workspace-path', workspacePath);
    }

    const output = execSync(`"${pawCmd}" ${args.join(' ')}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const skills = parseInstalledSkills(output);

    return {
      success: true,
      skills,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      skills: [],
      error: message,
    };
  }
}

/**
 * Display formatted installed skills (for CLI output).
 */
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
  if (skills.length === 0) {
    return 'No skills installed.';
  }

  const lines: string[] = [`Total: ${skills.length} skill(s) installed`];

  skills.forEach((skill, index) => {
    const status = skill.enabled !== false ? '✓ enabled' : '✗ disabled';
    const scope = skill.scope || (skill.installPath?.includes('.meituan-catpaw') ? 'user' : 'workspace');
    const src = skill.source || 'user';
    lines.push(`  ${index + 1}. ${skill.name} (${status}, ${src}, ${scope})`);
    if (skill.installPath) {
      lines.push(`     ${skill.installPath}`);
    }
  });

  return lines.join('\n');
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate that a given agent type is supported.
 */
export function isAgentSupported(agent: string): agent is AgentType {
  return agent === 'catpaw' || agent === 'claude' || agent === 'cursor';
}

/**
 * Get the list of supported agents.
 */
export function getSupportedAgents(): AgentType[] {
  return ['catpaw', 'claude', 'cursor'];
}
