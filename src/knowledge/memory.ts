/**
 * Memory index — LLM-Wiki memory layer for design-time context loading.
 *
 * Generates and maintains `_memory.yaml` in the knowledge directory,
 * serving as a compact "external memory" entry point for AI agents
 * during new design and change creation.
 *
 * LLM-Wiki principles:
 * - L3 (Summary): High-level project memory — goals, key decisions, active risks
 * - L2 (Scenario): Aggregated patterns by scope — what worked, what didn't
 * - L1 (Decision): Individual decision records — the "why" behind choices
 * - L0 (Evidence): Raw artifacts — test results, code scans, feedback
 *
 * _memory.yaml provides L3 + L2 summaries so AI can quickly load
 * relevant context without reading every knowledge page.
 */
import { join } from 'node:path';
import type { MumuSpecConfig } from '../core/config.js';
import type { KnowledgePage } from '../core/types.js';
import { readYaml, writeYaml } from '../core/utils.js';
import { listKnowledgePages, getKnowledgeDir } from './pages.js';

/** Memory index entry — compact summary for LLM consumption */
export interface MemoryEntry {
  id: string;
  title: string;
  type: string;
  scope: string;
  status: string;
  tags: string[];
  /** L3 summary — one-line takeaway for AI context */
  summary: string;
  /** Source change that produced this knowledge */
  source_change?: string;
  /** Last verified date */
  verified_at?: string;
}

/** Memory index structure — organized by LLM-Wiki levels */
export interface MemoryIndex {
  /** Metadata about the memory index itself */
  meta: {
    project: string;
    generated_at: string;
    total_pages: number;
    total_decisions: number;
    total_patterns: number;
    total_risks: number;
    total_lessons: number;
  };
  /** L3: Project-level memory — top decisions and active risks */
  project_memory: {
    goals: string[];
    key_decisions: MemoryEntry[];
    active_risks: MemoryEntry[];
    recent_lessons: MemoryEntry[];
  };
  /** L2: Scope-grouped memory — patterns and decisions by scope */
  scope_memory: Array<{
    scope: string;
    decisions: MemoryEntry[];
    patterns: MemoryEntry[];
    risks: MemoryEntry[];
  }>;
}

/** Generate a one-line summary from a knowledge page's content */
function generateSummary(content: string, maxLength: number = 120): string {
  if (!content) return '';
  // Take first non-empty, non-header line
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('---')) continue;
    if (trimmed.startsWith('-')) continue;
    return trimmed.length > maxLength ? trimmed.substring(0, maxLength) + '...' : trimmed;
  }
  return content.substring(0, maxLength).replace(/\n/g, ' ').trim() + '...';
}

/** Convert a KnowledgePage to a compact MemoryEntry */
function pageToMemoryEntry(page: KnowledgePage): MemoryEntry {
  return {
    id: page.frontmatter.id,
    title: page.frontmatter.title,
    type: page.frontmatter.type,
    scope: page.frontmatter.scope,
    status: page.frontmatter.status,
    tags: page.frontmatter.tags || [],
    summary: generateSummary(page.content),
    source_change: page.frontmatter.source_change,
    verified_at: page.frontmatter.verified_at,
  };
}

/**
 * Build the memory index from all knowledge pages.
 * Organizes knowledge into L3 (project-level) and L2 (scope-level) summaries.
 */
export function buildMemoryIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): MemoryIndex {
  const pages = listKnowledgePages(projectRoot, config);

  // Group pages by type and scope
  const decisions = pages.filter(p => p.frontmatter.type === 'decision' && p.frontmatter.status === 'confirmed');
  const patterns = pages.filter(p => p.frontmatter.type === 'pattern' && p.frontmatter.status === 'confirmed');
  const risks = pages.filter(p => p.frontmatter.type === 'risk' && (p.frontmatter.status === 'confirmed' || p.frontmatter.status === 'proposed'));
  const lessons = pages.filter(p => p.frontmatter.type === 'lesson' && p.frontmatter.status === 'confirmed');

  // L3: Key decisions — sort by verified_at desc, take top 10
  const keyDecisions = decisions
    .sort((a, b) => (b.frontmatter.verified_at || b.frontmatter.created_at).localeCompare(a.frontmatter.verified_at || a.frontmatter.created_at))
    .slice(0, 10)
    .map(pageToMemoryEntry);

  // L3: Active risks — sort by verified_at desc, take top 5
  const activeRisks = risks
    .sort((a, b) => (b.frontmatter.verified_at || b.frontmatter.created_at).localeCompare(a.frontmatter.verified_at || a.frontmatter.created_at))
    .slice(0, 5)
    .map(pageToMemoryEntry);

  // L3: Recent lessons — sort by created_at desc, take top 5
  const recentLessons = lessons
    .sort((a, b) => b.frontmatter.created_at.localeCompare(a.frontmatter.created_at))
    .slice(0, 5)
    .map(pageToMemoryEntry);

  // L3: Goals — extract from tags
  const goals = pages
    .filter(p => (p.frontmatter.tags || []).some(t => ['goal', 'vision', 'milestone'].includes(t)))
    .map(p => p.frontmatter.title)
    .slice(0, 10);

  // L2: Scope-grouped memory
  const scopeMap = new Map<string, { decisions: MemoryEntry[]; patterns: MemoryEntry[]; risks: MemoryEntry[] }>();

  for (const page of pages) {
    const scope = page.frontmatter.scope || '.';
    if (!scopeMap.has(scope)) {
      scopeMap.set(scope, { decisions: [], patterns: [], risks: [] });
    }
    const entry = scopeMap.get(scope)!;
    const memEntry = pageToMemoryEntry(page);

    if (page.frontmatter.type === 'decision') entry.decisions.push(memEntry);
    else if (page.frontmatter.type === 'pattern') entry.patterns.push(memEntry);
    else if (page.frontmatter.type === 'risk') entry.risks.push(memEntry);
  }

  const scope_memory = Array.from(scopeMap.entries()).map(([scope, entries]) => ({
    scope,
    decisions: entries.decisions.slice(0, 10),
    patterns: entries.patterns.slice(0, 5),
    risks: entries.risks.slice(0, 5),
  }));

  return {
    meta: {
      project: config.project.name,
      generated_at: new Date().toISOString(),
      total_pages: pages.length,
      total_decisions: decisions.length,
      total_patterns: patterns.length,
      total_risks: risks.length,
      total_lessons: lessons.length,
    },
    project_memory: {
      goals,
      key_decisions: keyDecisions,
      active_risks: activeRisks,
      recent_lessons: recentLessons,
    },
    scope_memory,
  };
}

/**
 * Rebuild and write _memory.yaml to the knowledge directory.
 */
export function rebuildMemoryIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): MemoryIndex {
  const memoryIndex = buildMemoryIndex(projectRoot, config);
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const memoryPath = join(knowledgeDir, '_memory.yaml');
  writeYaml(memoryPath, memoryIndex);
  return memoryIndex;
}

/**
 * Load the memory index from disk, or rebuild if missing/stale.
 */
export function loadMemoryIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): MemoryIndex {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const memoryPath = join(knowledgeDir, '_memory.yaml');

  const existing = readYaml<MemoryIndex>(memoryPath);
  if (existing) return existing;

  return rebuildMemoryIndex(projectRoot, config);
}

/**
 * Get memory context for a specific scope — used during design phase
 * to provide AI with relevant historical decisions and patterns.
 *
 * Returns a compact summary suitable for inclusion in design prompts.
 */
export function getMemoryContext(
  projectRoot: string,
  config: MumuSpecConfig,
  targetScope?: string,
): {
  project_summary: string;
  relevant_decisions: MemoryEntry[];
  relevant_patterns: MemoryEntry[];
  relevant_risks: MemoryEntry[];
  recent_lessons: MemoryEntry[];
} {
  const memory = loadMemoryIndex(projectRoot, config);

  // Find scope-specific memory
  let scopeMemory = memory.scope_memory.find(s => s.scope === targetScope);
  if (!scopeMemory && targetScope) {
    // Try parent scope
    const parentScope = targetScope.split('/').slice(0, -1).join('/');
    scopeMemory = memory.scope_memory.find(s => s.scope === parentScope);
  }

  const projectSummary = [
    `Project: ${memory.meta.project}`,
    `Knowledge: ${memory.meta.total_pages} pages (${memory.meta.total_decisions} decisions, ${memory.meta.total_patterns} patterns, ${memory.meta.total_risks} risks, ${memory.meta.total_lessons} lessons)`,
    `Goals: ${memory.project_memory.goals.join('; ') || 'none'}`,
  ].join('\n');

  return {
    project_summary: projectSummary,
    relevant_decisions: scopeMemory?.decisions || memory.project_memory.key_decisions,
    relevant_patterns: scopeMemory?.patterns || [],
    relevant_risks: scopeMemory?.risks || memory.project_memory.active_risks,
    recent_lessons: memory.project_memory.recent_lessons,
  };
}
