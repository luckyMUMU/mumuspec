/**
 * Shared helper functions for CLI commands.
 */
import type { MumuSpecConfig } from '../core/config.js';
import type { ProjectAnalysis } from '../core/project-analyzer.js';
import type { AgentType } from '../install/installer.js';
import { answerQuery } from '../knowledge/manager.js';
import {
  getManifest,
  searchPackages,
  resolvePackage,
  installPackage,
} from '../install/installer.js';

/** Helper: get CSS summary string */
export function getCssSummary(analysis: ProjectAnalysis): string {
  const parts: string[] = [];
  if (analysis.hasTailwind) parts.push('Tailwind');
  if (analysis.hasScss) parts.push('SCSS');
  if (analysis.hasCssModules) parts.push('CSS Modules');
  if (analysis.hasUiLibrary && analysis.uiLibrary) parts.push(analysis.uiLibrary);
  return parts.length > 0 ? parts.join(' + ') : 'none detected';
}

/** Helper: get directory summary for index.yaml */
export function getDirectorySummary(dir: string, type: import('../core/project-analyzer.js').ProjectType): string {
  const map: Record<string, string> = {
    src: 'Primary source code',
    lib: 'Library exports and public API',
    app: 'Application routes and pages',
    packages: 'Monorepo sub-packages',
    demo: 'Demo/example applications',
    examples: 'Usage examples',
  };
  return map[dir] || `${dir} module (${type})`;
}

/** Helper: execute chat query and output results */
export function executeChat(root: string, config: MumuSpecConfig, query: string, jsonMode?: boolean): void {
  const result = answerQuery(root, config, query);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Panel-style output
  console.log('');
  console.log('┌─── CHAT ANSWER ─────────────────────────────────────────┐');
  console.log(`│ Query: ${result.query}`);
  console.log(`│ Confidence: ${result.confidence}`);
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(result.answer);

  if (result.references.length > 0) {
    console.log('');
    console.log('References:');
    for (const ref of result.references) {
      console.log(`  [${ref.id}] ${ref.title} (${ref.type}, ${(ref.relevance * 100).toFixed(0)}%)`);
    }
  }
  console.log('');
}

/** Helper: collect multiple values (used by search --include/--exclude) */
export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

/**
 * Generic subcommand factory for non-CatPaw agents.
 * Handles claude, cursor, trae, workbuddy, opencode with the same install logic.
 */
export function createAgentInstallSubcommand(
  installCmd: import('commander').Command,
  agentName: string,
  agentType: string,
  description: string,
) {
  installCmd
    .command(agentName)
    .description(description)
    .argument('[packages...]', 'skill package names to install (e.g., mumuspec-workflow)')
    .option('--list', 'list available packages for this agent')
    .option('--force', 'force update if already installed')
    .option('--target <scope>', 'installation target: user (global) or workspace (project)', 'user')
    .option('--workspace-path <path>', 'workspace path (required when --target workspace)')
    .option('--search <keyword>', 'search available packages by keyword')
    .action((packages: string[], options: Record<string, unknown>) => {
      const target = (options.target as 'user' | 'workspace') || 'user';
      const workspacePath = options.workspacePath as string | undefined;

      // --list: show available packages
      if (options.list) {
        const manifest = getManifest(agentType as AgentType);
        console.log(`\nAvailable packages for ${agentName}:`);
        manifest.forEach((p) => {
          console.log(`  ${p.name} — ${p.description}`);
        });
        return;
      }

      // --search
      if (options.search) {
        const results = searchPackages(agentType as AgentType, options.search as string);
        console.log(`\nSearch results for "${options.search}" (${agentName}):`);
        results.forEach((p) => {
          console.log(`  ${p.name} — ${p.description}`);
        });
        return;
      }

      if (!packages || packages.length === 0) {
        console.error('Error: No packages specified. Use --list to see available packages.');
        process.exit(1);
      }

      let successCount = 0;
      let failCount = 0;

      for (const pkgName of packages) {
        const pkg = resolvePackage(agentType as AgentType, pkgName);
        if (!pkg) {
          console.error(`  Unknown package "${pkgName}" for ${agentName}.`);
          failCount++;
          continue;
        }

        console.log(`\nInstalling "${pkgName}" for ${agentName} (${target} scope)...`);
        const agentMode = options.force ? 'update' : 'install';
        const result = installPackage(agentType as AgentType, pkgName, target, workspacePath, agentMode);

        if (result.success) {
          const action = agentMode === 'update' ? 'Updated' : 'Installed';
          console.log(`✓ ${action} "${pkgName}" [${target} scope]`);
          if (result.path) console.log(`  Path: ${result.path}`);
          successCount++;
        } else {
          console.error(`✗ Failed: ${result.error}`);
          failCount++;
        }
      }

      console.log(`\nResult: ${successCount} succeeded, ${failCount} failed.`);
      if (failCount > 0) process.exit(1);
    });
}
