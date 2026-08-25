/**
 * Installer registry — package manifests, MCP/command presets, and shared types.
 */
// Agent types supported by the install command
export type AgentType = 'catpaw' | 'claude' | 'cursor' | 'trae' | 'workbuddy' | 'opencode';

// Installation target scope
export type InstallTarget = 'user' | 'workspace';

/** Behavior when target already exists */
export type InstallMode = 'install' | 'update';

/** A curated package entry in the manifest */
export interface PackageManifestEntry {
  name: string;
  description: string;
  agent: AgentType;
  skillId?: number;
  command?: string;
  category: string;
}

/** MCP server preset entry */
export interface McpPresetEntry {
  name: string;
  description: string;
  config: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  category: string;
}

/** Custom command entry (CatPaw slash commands) */
export interface CommandPresetEntry {
  name: string;
  description: string;
  template: string;
  category: string;
}

/** Result of an install operation */
export interface InstallResult {
  success: boolean;
  packageName: string;
  agent: AgentType;
  target: InstallTarget;
  path?: string;
  error?: string;
}

/** Result of MCP install */
export interface InstallMcpResult {
  success: boolean;
  serverName: string;
  path?: string;
  error?: string;
}

/** Result of command install */
export interface InstallCommandResult {
  success: boolean;
  commandName: string;
  path?: string;
  error?: string;
}

// ============================================================
// Curated packages registry
// ============================================================

export const CATPAW_PACKAGES: PackageManifestEntry[] = [
  { name: 'browser', description: 'Browser automation', agent: 'catpaw', skillId: 10, category: 'automation' },
  { name: 'pdf', description: 'PDF processing', agent: 'catpaw', skillId: 11, category: 'document' },
  { name: 'pptx', description: 'PowerPoint processing', agent: 'catpaw', skillId: 12, category: 'document' },
  { name: 'xlsx', description: 'Excel processing', agent: 'catpaw', skillId: 13, category: 'document' },
  { name: 'docx', description: 'Word processing', agent: 'catpaw', skillId: 14, category: 'document' },
  { name: 'settings', description: 'CatPaw settings management', agent: 'catpaw', skillId: 15, category: 'productivity' },
];

export const MUMUSPEC_WORKFLOW_PACKAGE: PackageManifestEntry = {
  name: 'mumuspec-workflow',
  description: 'MumuSpec AI workflow orchestrator',
  agent: 'catpaw',
  category: 'workflow',
};

export const MCP_PRESETS: McpPresetEntry[] = [
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

export const COMMAND_PRESETS: CommandPresetEntry[] = [
  {
    name: '/mumuspec',
    description: 'MumuSpec workflow',
    template: `# MumuSpec Workflow\n`,
    category: 'workflow',
  },
];

export const CLAUDE_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'claude', command: 'mumuspec', category: 'workflow' },
];

export const CURSOR_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'cursor', command: 'mumuspec', category: 'workflow' },
];

export const TRAE_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'trae', command: 'mumuspec', category: 'workflow' },
];

export const WORKBUDDY_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'workbuddy', command: 'mumuspec', category: 'workflow' },
  { name: 'phase-open', description: 'Phase 1: Open', agent: 'workbuddy', category: 'workflow' },
  { name: 'phase-design', description: 'Phase 2: Design', agent: 'workbuddy', category: 'workflow' },
  { name: 'phase-build', description: 'Phase 3: Build', agent: 'workbuddy', category: 'workflow' },
  { name: 'phase-verify', description: 'Phase 4: Verify', agent: 'workbuddy', category: 'workflow' },
  { name: 'phase-archive', description: 'Phase 5: Archive', agent: 'workbuddy', category: 'workflow' },
  { name: 'workflow-presets', description: 'Hotfix and Tweak presets', agent: 'workbuddy', category: 'workflow' },
];

export const OPENCODE_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'opencode', command: 'mumuspec', category: 'workflow' },
];

/** Aggregated manifest per agent — single source of truth */
export const AGENT_MANIFEST: Record<AgentType, PackageManifestEntry[]> = {
  catpaw: [...CATPAW_PACKAGES, MUMUSPEC_WORKFLOW_PACKAGE],
  claude: CLAUDE_PACKAGES,
  cursor: CURSOR_PACKAGES,
  trae: TRAE_PACKAGES,
  workbuddy: WORKBUDDY_PACKAGES,
  opencode: OPENCODE_PACKAGES,
};
