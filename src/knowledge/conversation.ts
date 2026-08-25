/**
 * Knowledge conversation engine — tell/absorb via dialogue.
 *
 * For agents that don't expose direct file read/write, knowledge transfer
 * happens through conversation:
 * - 'tell': generate a structured prompt to push knowledge into agent context
 * - 'absorb': generate an extraction prompt and parse the agent's response
 */

import { join } from 'node:path';
import {
  writeText,
  createFrontmatter,
  now,
} from '../core/utils.js';
import type {
  KnowledgePage,
  KnowledgeType,
  KnowledgeLevel,
  ExportOptions,
  ImportOptions,
  ImportConflict,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { listKnowledgePages, getKnowledgeDir } from './pages.js';
import { getPlugin } from './sync-registry.js';

// ========== Tell (Push to Agent) ==========

export interface TellResult {
  target: string;
  entryCount: number;
  prompt: string;
  instructions: string;
}

/**
 * Generate a conversation prompt to push knowledge into an agent's context.
 *
 * For skill-based export: the returned prompt is designed to be injected
 * into the target agent, making it "understand" MumuSpec knowledge.
 */
export function generateTellPrompt(
  projectRoot: string,
  config: MumuSpecConfig,
  target: string,
  options: ExportOptions = {},
): TellResult {
  const plugin = getPlugin(target);

  // Load filtered entries
  const allPages = listKnowledgePages(projectRoot, config);
  const filtered = filterPages(allPages, options);

  if (!plugin) {
    // Use generic fallback
    return generateGenericTellPrompt(filtered, target);
  }

  if (plugin.getExportPrompt) {
    const prompt = plugin.getExportPrompt(filtered, options);
    return {
      target,
      entryCount: filtered.length,
      prompt,
      instructions: generateInstructions(target, 'tell', filtered.length),
    };
  }

  // No conversation fallback; use generic
  return generateGenericTellPrompt(filtered, target);
}

/** Generic tell prompt (fallback for all targets) */
function generateGenericTellPrompt(
  pages: KnowledgePage[],
  target: string,
): TellResult {
  const lines: string[] = [];
  lines.push('## Project Knowledge (Auto-generated from MumuSpec)');
  lines.push('');
  lines.push('The following project rules and decisions MUST be applied:');
  lines.push('');

  for (const page of pages) {
    lines.push(`- **[${page.frontmatter.type}] ${page.frontmatter.title}**`);
    lines.push(`  ${page.content.slice(0, 200)}`);
  }

  lines.push('');
  lines.push('--- End of knowledge push ---');

  return {
    target,
    entryCount: pages.length,
    prompt: lines.join('\n'),
    instructions: `Paste the above content into your conversation with ${target} to sync knowledge.`,
  };
}

// ========== Absorb (Extract from Agent) ==========

export interface AbsorbPreview {
  target: string;
  extractPrompt: string;
  instructions: string;
}

export interface AbsorbResult {
  target: string;
  rawResponse: string;
  parsedEntries: KnowledgePage[];
  conflicts: ImportConflict[];
  imported: number;
}

/**
 * Generate the extraction prompt for absorbing knowledge from an agent.
 *
 * Send this prompt to the target agent and capture its response,
 * then call parseAbsorbResponse to convert.
 */
export function generateAbsorbPrompt(
  _projectRoot: string,
  _config: MumuSpecConfig,
  target: string,
): AbsorbPreview {
  const plugin = getPlugin(target);

  if (!plugin || !plugin.getExtractPrompt) {
    // Generic extraction prompt
    return {
      target,
      extractPrompt: GENERIC_EXTRACT_PROMPT,
      instructions: `Copy the above prompt and run it in ${target}. Then paste the response back into 'mumuspec knowledge absorb --parse'.`,
    };
  }

  return {
    target,
    extractPrompt: plugin.getExtractPrompt(),
    instructions: `Copy the above prompt and run it in ${target}. Then paste the response back into 'mumuspec knowledge absorb --parse'.`,
  };
}

/** Generic extraction prompt for all agents */
const GENERIC_EXTRACT_PROMPT = `You are a knowledge extraction helper. Look at your current project's rules,
configuration files, and context. Extract all project knowledge as a JSON array.

For each item provide:
{
  "type": "decision | pattern | lesson | risk | rationale",
  "title": "Short descriptive title",
  "content": "Full description (2-5 sentences)",
  "confidence": "high | medium | low",
  "tags": ["tag1", "tag2"]
}

Respond ONLY with the JSON object: { "entries": [...] }
If you have no project knowledge, respond with: { "entries": [] }`;

/**
 * Parse an agent's response from absorb and convert to KnowledgePages.
 */
export function parseAbsorbResponse(
  projectRoot: string,
  config: MumuSpecConfig,
  target: string,
  response: string,
  options: ImportOptions = { conflict: 'skip', dryRun: false },
): AbsorbResult {
  const plugin = getPlugin(target);

  let parsed: KnowledgePage[];

  if (plugin?.parseConversationResponse) {
    parsed = plugin.parseConversationResponse(response);
  } else {
    // Fallback: try JSON parse, then markdown fallback
    parsed = tryParseJsonResponse(response);
    if (parsed.length === 0) {
      parsed = tryParseMarkdownResponse(response);
    }
  }

  // Detect conflicts with existing knowledge
  const existingPages = listKnowledgePages(projectRoot, config);
  const conflicts = detectConflicts(parsed, existingPages, options.conflict);

  let imported = 0;
  if (!options.dryRun) {
    imported = importEntries(projectRoot, config, parsed, options, conflicts);
  }

  return {
    target,
    rawResponse: response,
    parsedEntries: parsed,
    conflicts,
    imported,
  };
}

// ========== Conflict Detection ==========

/** Detect title similarity conflicts between incoming and existing entries */
function detectConflicts(
  incoming: KnowledgePage[],
  existing: KnowledgePage[],
  strategy: string,
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];

  for (const entry of incoming) {
    for (const exist of existing) {
      const similarity = computeSimilarity(
        entry.frontmatter.title,
        exist.frontmatter.title,
      );

      if (similarity > 0.6) {
        conflicts.push({
          existing_id: exist.frontmatter.id,
          incoming_title: entry.frontmatter.title,
          similarity,
          strategy: strategy as ImportConflict['strategy'],
          resolved: strategy !== 'manual',
          resolution:
            strategy === 'skip'
              ? 'skipped'
              : strategy === 'overwrite'
                ? 'replaced'
                : strategy === 'new-version'
                  ? 'renamed'
                  : undefined,
        });
      }
    }
  }

  return conflicts;
}

/** Simple Jaccard similarity on character bigrams */
function computeSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;

  // Character bigrams
  const aGrams = new Set<string>();
  const bGrams = new Set<string>();

  for (let i = 0; i < aLower.length - 1; i++) {
    aGrams.add(aLower.slice(i, i + 2));
  }
  for (let i = 0; i < bLower.length - 1; i++) {
    bGrams.add(bLower.slice(i, i + 2));
  }

  // Include single characters for CJK support
  for (const ch of aLower) aGrams.add(ch);
  for (const ch of bLower) bGrams.add(ch);

  let intersection = 0;
  for (const gram of aGrams) {
    if (bGrams.has(gram)) intersection++;
  }
  const union = aGrams.size + bGrams.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

// ========== Import Helpers ==========

/** Write parsed entries to disk */
function importEntries(
  projectRoot: string,
  config: MumuSpecConfig,
  entries: KnowledgePage[],
  _options: ImportOptions,
  conflicts: ImportConflict[],
): number {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  let count = 0;

  for (const entry of entries) {
    // Skip if conflict says so
    const conflict = conflicts.find(
      (c) => c.incoming_title === entry.frontmatter.title && c.resolution === 'skipped',
    );
    if (conflict) continue;

    // Determine filename
    let filename = sanitizeFilename(entry.frontmatter.title);
    if (entry.frontmatter.id) {
      filename = entry.frontmatter.id;
    }

    const type = entry.frontmatter.type;
    const dirPath = join(knowledgeDir, `${type}s`);
    const filePath = join(dirPath, `${filename}.md`);

    // Build markdown content with frontmatter
    const fm = { ...entry.frontmatter };
    fm.updated_at = now();
    fm.scope = 'imported';
    fm.source_agent = fm.source_agent || 'conversation';

    const content = createFrontmatter(fm as unknown as Record<string, unknown>) + entry.content;
    writeText(filePath, content);
    count++;
  }

  return count;
}

/** Sanitize title for use as filename */
function sanitizeFilename(title: string): string {
  return (
    title
      .slice(0, 50)
      .replace(/[^a-zA-Z0-9-_一-鿿]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') ||
    `imported-${Date.now().toString(36)}`
  );
}

// ========== Response Parsing ==========

/** Try to parse JSON response from agent */
function tryParseJsonResponse(response: string): KnowledgePage[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*"entries"\s*:\s*\[[\s\S]*\]\s*\}/);
    if (!jsonMatch) return [];

    const data = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(data.entries)) return [];

    return data.entries
      .map((item: Record<string, unknown>) => buildEntryFromParsed(item))
      .filter(Boolean) as KnowledgePage[];
  } catch {
    return [];
  }
}

/** Try to parse markdown-style response as fallback */
function tryParseMarkdownResponse(response: string): KnowledgePage[] {
  const entries: KnowledgePage[] = [];
  const sections = response.split(/\n(?=#{1,3}\s)/);

  for (const section of sections) {
    const headerMatch = section.match(/^#{1,3}\s+(.+)$/m);
    if (!headerMatch) continue;

    const title = headerMatch[1]
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^\[.*?\]\s*/, '')
      .trim();
    const content = section.replace(/^#{1,3}\s+.+$\n*/m, '').trim();

    if (title.length >= 3 && content.length >= 10) {
      const entry = buildEntryFromParsed({ title, content, type: inferType(title + ' ' + content) });
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

/** Build a KnowledgePage from a parsed record */
function buildEntryFromParsed(item: Record<string, unknown>): KnowledgePage | null {
  const title = (item.title as string) || '';
  const content = (item.content as string) || '';

  if (title.length < 3 || content.length < 5) return null;

  const type: KnowledgeType = validateType((item.type as string) || 'decision');
  const id = `KP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    path: `knowledge/${type}s/${id}.md`,
    frontmatter: {
      id,
      title: title.slice(0, 100),
      type,
      status: 'draft',
      scope: 'imported',
      level: 'L1' as KnowledgeLevel,
      source_agent: 'conversation',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: (item.tags as string[]) || [],
      cognitive_origin: {
        confidence: ((item.confidence as string) || 'medium') as 'high' | 'medium' | 'low',
      },
    },
    content,
  };
}

/** Validate type string */
function validateType(type: string): KnowledgeType {
  const valid: KnowledgeType[] = ['decision', 'pattern', 'risk', 'rationale', 'lesson', 'imported'];
  return valid.includes(type as KnowledgeType) ? (type as KnowledgeType) : 'decision';
}

/** Infer type from text heuristics */
function inferType(text: string): KnowledgeType {
  const lower = text.toLowerCase();
  if (/(risk|warn|danger|vulnerab)/.test(lower)) return 'risk';
  if (/(lesson|mistake|avoid|pitfall|never)/.test(lower)) return 'lesson';
  if (/(pattern|convention|always|idiom)/.test(lower)) return 'pattern';
  if (/(because|rationale|reason|trade.?off)/.test(lower)) return 'rationale';
  return 'decision';
}

// ========== Filtering ==========

/** Filter knowledge page list based on export options */
function filterPages(
  pages: KnowledgePage[],
  options: ExportOptions,
): KnowledgePage[] {
  let result = pages;

  if (options.scope) {
    result = result.filter((p) =>
      p.frontmatter.scope === options.scope || p.frontmatter.scope.includes(options.scope!),
    );
  }
  if (options.type && options.type.length > 0) {
    result = result.filter((p) => options.type!.includes(p.frontmatter.type));
  }
  if (options.tags && options.tags.length > 0) {
    result = result.filter((p) =>
      options.tags!.some((tag) => (p.frontmatter.tags || []).includes(tag)),
    );
  }
  if (options.ids && options.ids.length > 0) {
    result = result.filter((p) => options.ids!.includes(p.frontmatter.id));
  }
  if (options.level && options.level.length > 0) {
    result = result.filter((p) => p.frontmatter.level && options.level!.includes(p.frontmatter.level));
  }
  if (options.since) {
    const sinceDate = new Date(options.since);
    result = result.filter((p) => {
      const updated = new Date(p.frontmatter.updated_at || p.frontmatter.created_at);
      return updated >= sinceDate;
    });
  }

  return result;
}

// ========== Message Templates ==========

export function generateInstructions(
  target: string,
  operation: 'tell' | 'absorb',
  entryCount: number,
): string {
  if (operation === 'tell') {
    return [
      `Knowledge Push to ${target}`,
      `========================`,
      ``,
      `${entryCount} knowledge entries prepared for push.`,
      ``,
      `To apply:`,
      `1. Copy the prompt below`,
      `2. Paste it into your ${target} conversation`,
      `3. The agent will then "know" your project rules`,
      ``,
      `For persistent push, use: mumuspec knowledge tell --target ${target} --output ./push.md`,
      `Then load ./push.md as a skill/rule in ${target}.`,
    ].join('\n');
  }

  return [
    `Knowledge Extraction from ${target}`,
    `================================`,
    ``,
    `To extract knowledge from ${target}:`,
    `1. Start a conversation with ${target}`,
    `2. Paste the extraction prompt below`,
    `3. Copy the agent's response`,
    `4. Run: mumuspec knowledge absorb --target ${target} --parse "<response>"`,
    ``,
    `Or pipe via stdin:`,
    `  echo "<response>" | mumuspec knowledge absorb --target ${target} --parse -`,
  ].join('\n');
}
