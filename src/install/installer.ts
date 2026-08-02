/**
 * Installer module — barrel re-export hub.
 * Sub-modules:
 * - registry: agent types, manifest entries, and preset data
 * - ops: core install operations for packages, MCP servers, and commands
 *
 * All imports from this file remain fully backward compatible.
 */

// Re-export types and constants from registry
export {
  CATPAW_PACKAGES,
  MUMUSPEC_WORKFLOW_PACKAGE,
  MCP_PRESETS,
  COMMAND_PRESETS,
  CLAUDE_PACKAGES,
  CURSOR_PACKAGES,
  TRAE_PACKAGES,
  WORKBUDDY_PACKAGES,
  OPENCODE_PACKAGES,
  AGENT_MANIFEST,
} from './installer-registry.js';

// Re-export type aliases
export type {
  AgentType,
  InstallTarget,
  InstallMode,
  PackageManifestEntry,
  McpPresetEntry,
  CommandPresetEntry,
  InstallResult,
  InstallMcpResult,
  InstallCommandResult,
} from './installer-registry.js';

// Re-export all operations from ops
export {
  getManifest,
  searchPackages,
  resolvePackage,
  getMcpPresets,
  getCommandPresets,
  installPackage,
  installCatpawMcp,
  installCatpawCommand,
  listInstalledMcp,
  listInstalledCatpaw,
  formatInstalledSkills,
  isAgentSupported,
  getSupportedAgents,
} from './installer-ops.js';
