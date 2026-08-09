/**
 * Knowledge sync registry — plugin management for bidirectional transfer.
 *
 * Central registry for KnowledgeSyncPlugin implementations.
 * Provides lookup, registration, and capability introspection.
 */

import type { KnowledgeSyncPlugin } from '../core/types.js';

// ========== Registry ==========

/** Plugin registry: target name -> plugin instance */
const plugins = new Map<string, KnowledgeSyncPlugin>();

/**
 * Register a sync plugin for a target agent.
 * If a plugin for the same target already exists, it is replaced.
 */
export function registerPlugin(plugin: KnowledgeSyncPlugin): void {
  plugins.set(plugin.target, plugin);
}

/**
 * Get plugin for a specific target.
 * Returns undefined if no plugin is registered.
 */
export function getPlugin(target: string): KnowledgeSyncPlugin | undefined {
  return plugins.get(target);
}

/**
 * Check if a plugin is registered for a target.
 */
export function hasPlugin(target: string): boolean {
  return plugins.has(target);
}

/**
 * List all registered target names.
 */
export function listTargets(): string[] {
  return Array.from(plugins.keys()).sort();
}

/**
 * List targets that support a specific capability.
 */
export function listTargetsWithCapability(
  capability: 'directExport' | 'directImport' | 'conversationFallback',
): string[] {
  return Array.from(plugins.entries())
    .filter(([, plugin]) => plugin.capabilities[capability])
    .map(([target]) => target)
    .sort();
}

/**
 * Get full capability report for all registered plugins.
 */
export function getCapabilityReport(): Array<{
  target: string;
  capabilities: {
    directExport: boolean;
    directImport: boolean;
    conversationFallback: boolean;
    supportedTypes: string[];
  };
}> {
  return Array.from(plugins.entries()).map(([target, plugin]) => ({
    target,
    capabilities: {
      ...plugin.capabilities,
      supportedTypes: [...plugin.capabilities.supportedTypes],
    },
  }));
}

/**
 * Clear all registered plugins. Primarily for testing.
 */
export function clearRegistry(): void {
  plugins.clear();
}

// ========== Auto-discovery ==========

/**
 * Auto-register built-in plugins.
 * Called once during module initialization.
 */
export function initializeRegistry(): void {
  if (plugins.size > 0) return; // Already initialized

  // Import built-in plugins (lazy to avoid circular deps)
  const builtins = createBuiltInPlugins();
  for (const plugin of builtins) {
    registerPlugin(plugin);
  }
}

// ========== Built-in plugin factories ==========

function createBuiltInPlugins(): KnowledgeSyncPlugin[] {
  // Implemented as dynamic imports to avoid circular dependency issues
  // This allows formatter implementations to live in separate files
  return [
    createClaudePlugin(),
    createCursorPlugin(),
    createGenericPlugin(),
  ];
}

// --- Claude Code plugin ---

function createClaudePlugin(): KnowledgeSyncPlugin {
  return {
    target: 'claude',
    capabilities: {
      directExport: true,
      directImport: true,
      conversationFallback: true,
      supportedTypes: ['decision', 'pattern', 'risk', 'rationale', 'lesson', 'imported'],
    },

    formatForAgent(entries, _opts) {
      const sections: string[] = [];
      sections.push('# MumuSpec Project Knowledge (Auto-exported)');
      sections.push('');
      sections.push(`> Source: Mumuspec knowledge/ | Exported: ${new Date().toISOString()}`);
      sections.push('> This file is auto-generated. Changes will be overwritten on next export.');
      sections.push('');

      // L3 summaries first
      const summaries = entries.filter(
        (e) => e.frontmatter.level === 'L3' || e.frontmatter.scope === 'global',
      );
      if (summaries.length > 0) {
        sections.push('## Project Constraints (L3 Summary)');
        sections.push('');
        for (const page of summaries) {
          sections.push(`- **${page.frontmatter.title}**: ${page.content.slice(0, 200)}`);
        }
        sections.push('');
      }

      // L1 decisions
      const decisions = entries.filter((e) => e.frontmatter.type === 'decision' && e.frontmatter.level !== 'L3');
      if (decisions.length > 0) {
        sections.push('## Key Decisions (L1 Atoms)');
        sections.push('');
        for (const page of decisions) {
          sections.push(`### ${page.frontmatter.id}: ${page.frontmatter.title}`);
          sections.push(`${page.content.slice(0, 500)}`);
          sections.push('');
        }
      }

      // Patterns
      const patterns = entries.filter((e) => e.frontmatter.type === 'pattern');
      if (patterns.length > 0) {
        sections.push('## Patterns');
        sections.push('');
        for (const page of patterns) {
          sections.push(`### ${page.frontmatter.id}: ${page.frontmatter.title}`);
          sections.push(`${page.content.slice(0, 400)}`);
          sections.push('');
        }
      }

      // Lessons
      const lessons = entries.filter((e) => e.frontmatter.type === 'lesson');
      if (lessons.length > 0) {
        sections.push('## Lessons Learned');
        sections.push('');
        for (const page of lessons) {
          sections.push(`### ${page.frontmatter.id}: ${page.frontmatter.title}`);
          sections.push(`${page.content.slice(0, 300)}`);
          sections.push('');
        }
      }

      // Risks
      const risks = entries.filter((e) => e.frontmatter.type === 'risk');
      if (risks.length > 0) {
        sections.push('## Risks');
        sections.push('');
        for (const page of risks) {
          sections.push(`### ${page.frontmatter.id}: ${page.frontmatter.title}`);
          sections.push(`${page.content.slice(0, 300)}`);
          sections.push('');
        }
      }

      return {
        target: 'claude',
        content: sections.join('\n'),
        filePath: 'MEMORY.md',
        format: 'markdown',
        entryCount: entries.length,
      };
    },

    parseFromAgent(source, opts) {
      return parseMarkdownToEntries(source, opts, 'claude');
    },

    getExportPrompt(entries, _opts) {
      const sections: string[] = [];
      sections.push('## [MumuSpec Knowledge Push]');
      sections.push('');
      for (const page of entries) {
        sections.push(`- **[${page.frontmatter.type}] ${page.frontmatter.title}**`);
        sections.push(`  ${page.content.slice(0, 150)}`);
      }
      return sections.join('\n');
    },

    getExtractPrompt() {
      return `You are a knowledge extraction assistant. Please analyze your current project's rules files
(CLAUDE.md, .claude/rules/, .claude/skills/) and extract:

1. Project constraints / prohibitions ( SHALL / SHALL NOT / MUST )
2. Design decisions with rationale
3. Code patterns and conventions
4. Known lessons and risks

Respond in this JSON format:
{ "entries": [ { "type": "decision|pattern|lesson|risk|rationale", "title": "...", "content": "...", "confidence": "high|medium|low", "tags": [...] } ] }

Output only factual knowledge you actually have. Empty list if none.`;

    },

    parseConversationResponse(response) {
      return parseJsonToEntries(response);
    },
  };
}

// --- Cursor plugin ---

function createCursorPlugin(): KnowledgeSyncPlugin {
  return {
    target: 'cursor',
    capabilities: {
      directExport: true,
      directImport: true,
      conversationFallback: false,
      supportedTypes: ['decision', 'pattern', 'risk', 'rationale', 'lesson'],
    },

    formatForAgent(entries, _opts) {
      const sections: string[] = [];
      sections.push('# Auto-exported from MumuSpec knowledge/');
      sections.push(`# Exported: ${new Date().toISOString()}`);
      sections.push('');

      // Must Follow (constraints + decisions)
      const constraints = entries.filter(
        (e) => e.frontmatter.status === 'confirmed' &&
          (e.frontmatter.scope === 'global' || e.frontmatter.level === 'L3'),
      );
      if (constraints.length > 0) {
        sections.push('Must Follow:');
        for (const page of constraints) {
          sections.push(`- ${page.frontmatter.title}: ${page.content.slice(0, 120)}`);
        }
        sections.push('');
      }

      // Patterns
      const patterns = entries.filter((e) => e.frontmatter.type === 'pattern');
      if (patterns.length > 0) {
        sections.push('Patterns:');
        for (const page of patterns) {
          sections.push(`- ${page.frontmatter.title}: ${page.content.slice(0, 100)}`);
        }
        sections.push('');
      }

      // Lessons
      const lessons = entries.filter((e) => e.frontmatter.type === 'lesson');
      if (lessons.length > 0) {
        sections.push('Avoid:');
        for (const page of lessons) {
          sections.push(`- ${page.content.slice(0, 150)}`);
        }
        sections.push('');
      }

      // Risks
      const risks = entries.filter((e) => e.frontmatter.type === 'risk');
      if (risks.length > 0) {
        sections.push('Risks:');
        for (const page of risks) {
          sections.push(`- ${page.frontmatter.title}: ${page.content.slice(0, 100)}`);
        }
      }

      return {
        target: 'cursor',
        content: sections.join('\n'),
        filePath: '.cursor/rules/mumuspec-knowledge.md',
        format: 'markdown',
        entryCount: entries.length,
      };
    },

    parseFromAgent(source, opts) {
      return parseMarkdownToEntries(source, opts, 'cursor');
    },
  };
}

// --- Generic fallback plugin ---

function createGenericPlugin(): KnowledgeSyncPlugin {
  return {
    target: 'generic',
    capabilities: {
      directExport: true,
      directImport: true,
      conversationFallback: true,
      supportedTypes: ['decision', 'pattern', 'risk', 'rationale', 'lesson', 'imported'],
    },

    formatForAgent(entries, _opts) {
      const sections: string[] = [];
      sections.push('# Project Knowledge (Exported from MumuSpec)');
      sections.push('');
      for (const page of entries) {
        sections.push(`## ${page.frontmatter.title}`);
        sections.push(`Type: ${page.frontmatter.type} | Scope: ${page.frontmatter.scope}`);
        sections.push('');
        sections.push(page.content);
        sections.push('');
      }
      return {
        target: 'generic',
        content: sections.join('\n'),
        filePath: '.mumuspec-knowledge.md',
        format: 'markdown',
        entryCount: entries.length,
      };
    },

    parseFromAgent(source, opts) {
      return parseMarkdownToEntries(source, opts, 'generic');
    },

    getExportPrompt(entries, _opts) {
      const lines = entries.map(
        (p) => `[${p.frontmatter.type}] ${p.frontmatter.title}\n${p.content}`,
      );
      return lines.join('\n\n---\n\n');
    },

    getExtractPrompt() {
      return `Please list all project rules, constraints, design decisions, patterns, and lessons you are currently following.
Format each as:
[type] title
content (1-3 sentences)

Types: decision, pattern, lesson, risk, rationale.`;
    },

    parseConversationResponse(response) {
      return parseJsonToEntries(response);
    },
  };
}

// ========== Shared parsing utilities ==========

/**
 * Parse markdown text (from agent) into MumuSpec knowledge entries.
 * Uses section-based heuristics to identify individual knowledge items.
 */
function parseMarkdownToEntries(
  source: string,
  _opts: { conflict?: string; dryRun?: boolean },
  sourceAgent: string,
): import('../core/types.js').KnowledgePage[] {
  const entries: import('../core/types.js').KnowledgePage[] = [];
  const lines = source.split('\n');

  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Detect section headers
    if (/^#{1,3}\s+/.test(line)) {
      // Save previous section
      if (currentTitle && currentContent.length > 0) {
        const entry = createEntryFromText(
          currentTitle,
          currentContent.join('\n'),
          sourceAgent,
        );
        if (entry) entries.push(entry);
      }
      currentTitle = line.replace(/^#{1,3}\s+/, '').trim();
      currentContent = [];
    } else if (line.trim() && !line.startsWith('>') && !line.startsWith('# Auto')) {
      currentContent.push(line);
    }
  }

  // Don't forget last section
  if (currentTitle && currentContent.length > 0) {
    const entry = createEntryFromText(
      currentTitle,
      currentContent.join('\n'),
      sourceAgent,
    );
    if (entry) entries.push(entry);
  }

  return entries;
}

/** Create a KnowledgePage from parsed text */
function createEntryFromText(
  title: string,
  content: string,
  sourceAgent: string,
): import('../core/types.js').KnowledgePage | null {
  if (title.length < 3 || content.trim().length < 10) return null;

  // Infer type from content keywords
  const type = inferType(title + ' ' + content);

  const id = `KP-IMP-${Date.now().toString(36)}`;

  return {
    path: `knowledge/${type}s/${id}.md`,
    frontmatter: {
      id,
      title: title.slice(0, 100),
      type,
      status: 'draft',
      scope: 'imported',
      level: 'L1',
      source_agent: sourceAgent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: [],
      cognitive_origin: {
        confidence: 'medium',
      },
    },
    content: content.trim(),
  };
}

/** Infer knowledge type from text content */
function inferType(text: string): import('../core/types.js').KnowledgeType {
  const lower = text.toLowerCase();
  if (lower.includes('risk') || lower.includes('warn') || lower.includes('danger')) return 'risk';
  if (lower.includes('lesson') || lower.includes('mistake') || lower.includes('avoid')) return 'lesson';
  if (lower.includes('pattern') || lower.includes('convention') || lower.includes('always')) return 'pattern';
  if (lower.includes('because') || lower.includes('reason') || lower.includes('trade.off')) return 'rationale';
  return 'decision';
}

/** Parse JSON response from conversation extract */
function parseJsonToEntries(
  response: string,
): import('../core/types.js').KnowledgePage[] {
  try {
    // Try to find JSON in response
    const jsonMatch = response.match(/\{[\s\S]*"entries"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[0]);
    if (!data.entries || !Array.isArray(data.entries)) return [];

    return data.entries.map((item: Record<string, unknown>) => {
      const type = (item.type as string) || 'decision';
      const id = `KP-CHAT-${Date.now().toString(36)}`;
      return {
        path: `knowledge/${type}s/${id}.md`,
        frontmatter: {
          id,
          title: (item.title as string) || 'Untitled',
          type: type as import('../core/types.js').KnowledgeType,
          status: 'draft',
          scope: 'imported',
          level: 'L1',
          source_agent: 'conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: (item.tags as string[]) || [],
          cognitive_origin: {
            confidence: (item.confidence as string) || 'medium',
          },
        },
        content: (item.content as string) || '',
      };
    });
  } catch {
    return [];
  }
}
