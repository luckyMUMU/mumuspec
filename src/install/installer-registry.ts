/**
 * Installer registry — package manifests, MCP/command presets, and shared types.
 */
// Agent types supported by the install command
// goal-p0-dispatch-gate (C1): +codex/windsurf/gemini/copilot — additive,
// existing 6 values keep their semantics.
export type AgentType =
  | 'catpaw'
  | 'claude'
  | 'cursor'
  | 'trae'
  | 'workbuddy'
  | 'opencode'
  | 'codex'
  | 'windsurf'
  | 'gemini'
  | 'copilot';

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

// goal-p0-dispatch-gate (C1): workflow skills for the 4 new agents —
// directory-style SKILL.md distribution (解除 workbuddy 独享).
export const CODEX_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'codex', command: 'mumuspec', category: 'workflow' },
  { name: 'phase-open', description: 'Phase 1: Open', agent: 'codex', category: 'workflow' },
  { name: 'phase-design', description: 'Phase 2: Design', agent: 'codex', category: 'workflow' },
  { name: 'phase-build', description: 'Phase 3: Build', agent: 'codex', category: 'workflow' },
  { name: 'phase-verify', description: 'Phase 4: Verify', agent: 'codex', category: 'workflow' },
  { name: 'phase-archive', description: 'Phase 5: Archive', agent: 'codex', category: 'workflow' },
  { name: 'workflow-presets', description: 'Hotfix and Tweak presets', agent: 'codex', category: 'workflow' },
];

export const WINDSURF_PACKAGES: PackageManifestEntry[] = CODEX_PACKAGES.map((p) => ({ ...p, agent: 'windsurf' as AgentType }));

export const GEMINI_PACKAGES: PackageManifestEntry[] = CODEX_PACKAGES.map((p) => ({ ...p, agent: 'gemini' as AgentType }));

// ponytail: copilot 无自定义 skill 机制且 TC-A1x 禁止 .github 产生额外文件 —
// copilot 分发 = AGENTS.md canonical 规则，manifest 仅保留声明位。
export const COPILOT_PACKAGES: PackageManifestEntry[] = [
  { name: 'mumuspec-workflow', description: 'MumuSpec workflow', agent: 'copilot', command: 'mumuspec', category: 'workflow' },
];

/** Aggregated manifest per agent — single source of truth */
export const AGENT_MANIFEST: Record<AgentType, PackageManifestEntry[]> = {
  catpaw: [...CATPAW_PACKAGES, MUMUSPEC_WORKFLOW_PACKAGE],
  claude: CLAUDE_PACKAGES,
  cursor: CURSOR_PACKAGES,
  trae: TRAE_PACKAGES,
  workbuddy: WORKBUDDY_PACKAGES,
  opencode: OPENCODE_PACKAGES,
  codex: CODEX_PACKAGES,
  windsurf: WINDSURF_PACKAGES,
  gemini: GEMINI_PACKAGES,
  copilot: COPILOT_PACKAGES,
};

// ============================================================
// Rule targets — canonical-first AGENTS.md distribution (C2)
// ============================================================

/** A thin-shell bridge file that includes the canonical rules file */
export interface AgentRuleBridge {
  /** Bridge file path (relative to project root) */
  file: string;
  /** First-line include directive (e.g. '@AGENTS.md') */
  line: string;
}

/**
 * Declarative rule target per agent — the single source of truth for
 * rules generation (KP-0060: 规则归 LLM/配置，渲染归代码). Adding an agent =
 * adding an entry here; rendering logic stays untouched.
 */
export interface AgentRuleTarget {
  /** Canonical rules file (relative to project root) */
  rulesFile: string;
  /** Thin-shell bridge files keyed by bridging agent */
  bridges: Record<string, AgentRuleBridge>;
  /**
   * Directory-style skills dir (relative to install base). Empty string =
   * agent has no custom-skill mechanism (copilot: TC-A1x forbids .github extras).
   */
  skillsDir: string;
  /** Generated files carry the MumuSpec managed marker */
  marksManaged: true;
}

export const AGENTS_RULES_FILE = 'AGENTS.md';

export const AGENT_RULE_TARGETS: Partial<Record<AgentType, AgentRuleTarget>> = {
  codex: { rulesFile: AGENTS_RULES_FILE, bridges: {}, skillsDir: '.codex/skills', marksManaged: true },
  windsurf: { rulesFile: AGENTS_RULES_FILE, bridges: {}, skillsDir: '.windsurf/skills', marksManaged: true },
  gemini: {
    rulesFile: AGENTS_RULES_FILE,
    bridges: { gemini: { file: 'GEMINI.md', line: '@AGENTS.md' } },
    skillsDir: '.gemini/skills',
    marksManaged: true,
  },
  copilot: { rulesFile: AGENTS_RULES_FILE, bridges: {}, skillsDir: '', marksManaged: true },
  claude: {
    rulesFile: AGENTS_RULES_FILE,
    bridges: { claude: { file: 'CLAUDE.md', line: '@AGENTS.md' } },
    skillsDir: '.claude/skills',
    marksManaged: true,
  },
};
