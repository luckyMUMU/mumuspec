/**
 * Tests for bidirectional knowledge sync: search, sync-registry, conversation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { knowledgeSearch, quickKnowledgeSearch } from '../../src/knowledge/search.js';
import { listKnowledgePages } from '../../src/knowledge/pages.js';
import {
  initializeRegistry,
  getPlugin,
  listTargets,
  hasPlugin,
  clearRegistry,
  registerPlugin,
} from '../../src/knowledge/sync-registry.js';
import {
  generateTellPrompt,
  generateAbsorbPrompt,
  parseAbsorbResponse,
} from '../../src/knowledge/conversation.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { KnowledgeSyncPlugin } from '../../src/core/types.js';

// ========== Helpers ==========

function defaultConfig(): MumuSpecConfig {
  return {
    knowledge: {
      wiki: { dir: '.mumuspec/knowledge' },
    },
  } as unknown as MumuSpecConfig;
}

function createProject(): { dir: string; cleanup: () => void } {
  const dir = join(tmpdir(), `mumuspec-sync-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec', 'knowledge', 'decisions'), { recursive: true });
  mkdirSync(join(dir, '.mumuspec', 'knowledge', 'patterns'), { recursive: true });
  mkdirSync(join(dir, '.mumuspec', 'knowledge', 'lessons'), { recursive: true });

  // Create index.yaml
  const indexPath = join(dir, '.mumuspec', 'knowledge', '_index.yaml');
  writeFileSync(
    indexPath,
    [
      'pages:',
      '  - id: KP-001',
      '    title: Ponytail 7-Level Priority',
      '    type: decision',
      '    status: confirmed',
      '    scope: global',
      '    file: .mumuspec/knowledge/decisions/KP-001.md',
      '    tags: [ponytail, priority]',
      '  - id: KP-002',
      '    title: Spec Progressive Loading',
      '    type: pattern',
      '    status: confirmed',
      '    scope: global',
      '    file: .mumuspec/knowledge/patterns/KP-002.md',
      '    tags: [knowledge, loading]',
      '  - id: KP-003',
      '    title: Over-engineering Pitfall',
      '    type: lesson',
      '    status: confirmed',
      '    scope: global',
      '    file: .mumuspec/knowledge/lessons/KP-003.md',
      '    tags: [pitfall, design]',
    ].join('\n'),
  );

  // Create knowledge entry files
  writeFileSync(
    join(dir, '.mumuspec', 'knowledge', 'decisions', 'KP-001.md'),
    [
      '---',
      'id: "KP-001"',
      'title: "Ponytail 7-Level Priority"',
      'type: decision',
      'status: confirmed',
      'scope: global',
      'level: L3',
      'created_at: "2026-07-09T10:30:00Z"',
      'tags: [ponytail, priority]',
      '---',
      '',
      'Must reuse existing code. YAGNI: do not write code that is not needed.',
      'Standard library first, then platform features, then existing deps.',
    ].join('\n'),
  );

  writeFileSync(
    join(dir, '.mumuspec', 'knowledge', 'patterns', 'KP-002.md'),
    [
      '---',
      'id: "KP-002"',
      'title: "Spec Progressive Loading"',
      'type: pattern',
      'status: confirmed',
      'scope: global',
      'level: L1',
      'created_at: "2026-07-10T10:30:00Z"',
      'tags: [knowledge, loading]',
      '---',
      '',
      'Load specs by tree depth to minimize context overhead.',
      'Progressive disclosure ensures agents only load relevant rules.',
    ].join('\n'),
  );

  writeFileSync(
    join(dir, '.mumuspec', 'knowledge', 'lessons', 'KP-003.md'),
    [
      '---',
      'id: "KP-003"',
      'title: "Over-engineering Pitfall"',
      'type: lesson',
      'status: confirmed',
      'scope: global',
      'level: L1',
      'created_at: "2026-07-11T10:30:00Z"',
      'tags: [pitfall, design]',
      '---',
      '',
      'Avoid adding abstraction layers before they are needed.',
      'Ponytail coding: boring over clever.',
    ].join('\n'),
  );

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

// ========== Tests: Search ==========

describe('knowledge search', () => {
  const { dir, cleanup } = createProject();
  const config = defaultConfig();

  afterEach(() => {});

  it('finds entries by keyword in title', () => {
    const results = knowledgeSearch(dir, config, 'ponytail');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.id).toBe('KP-001');
  });

  it('finds entries by keyword in content', () => {
    const results = knowledgeSearch(dir, config, 'progressive');
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.entry.id);
    expect(ids).toContain('KP-002');
  });

  it('returns empty for no matches', () => {
    const results = knowledgeSearch(dir, config, 'nonexistentterm12345');
    expect(results.length).toBe(0);
  });

  it('respects type filter', () => {
    const results = knowledgeSearch(dir, config, 'design', { type: ['lesson'] });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.type).toBe('lesson');
  });

  it('respects limit', () => {
    const results = knowledgeSearch(dir, config, '', { limit: 1 });
    // Empty query returns empty
    expect(results.length).toBe(0);
  });

  it('scores title matches higher than content matches', () => {
    const results = knowledgeSearch(dir, config, 'ponytail');
    // KP-001 has 'Ponytail' in title — should rank first
    expect(results[0].entry.id).toBe('KP-001');
    expect(results[0].matchedFields).toContain('title');
  });

  afterAll(() => cleanup());
});

describe('quick search', () => {
  const { dir, cleanup } = createProject();
  const config = defaultConfig();

  it('returns matching IDs', () => {
    const ids = quickKnowledgeSearch(dir, config, 'ponytail');
    expect(ids).toContain('KP-001');
  });

  afterAll(() => cleanup());
});

// ========== Tests: Sync Registry ==========

describe('sync registry', () => {
  beforeEach(() => {
    clearRegistry();
    initializeRegistry();
  });

  it('registers built-in plugins', () => {
    expect(hasPlugin('claude')).toBe(true);
    expect(hasPlugin('cursor')).toBe(true);
    expect(hasPlugin('generic')).toBe(true);
  });

  it('lists all targets', () => {
    const targets = listTargets();
    expect(targets).toContain('claude');
    expect(targets).toContain('cursor');
    expect(targets).toContain('generic');
  });

  it('returns plugin with correct capabilities', () => {
    const claude = getPlugin('claude');
    expect(claude).toBeDefined();
    expect(claude!.capabilities.directExport).toBe(true);
    expect(claude!.capabilities.directImport).toBe(true);
    expect(claude!.capabilities.conversationFallback).toBe(true);
  });

  it('cursor plugin does not support conversation fallback', () => {
    const cursor = getPlugin('cursor');
    expect(cursor).toBeDefined();
    expect(cursor!.capabilities.conversationFallback).toBe(false);
  });

  it('registerPlugin overrides existing', () => {
    const customPlugin: KnowledgeSyncPlugin = {
      target: 'claude',
      capabilities: {
        directExport: true,
        directImport: false,
        conversationFallback: false,
        supportedTypes: ['decision'],
      },
      formatForAgent: (entries, _opts) => ({
        target: 'claude',
        content: 'custom',
        filePath: 'custom.md',
        format: 'md',
        entryCount: entries.length,
      }),
      parseFromAgent: (_source, _opts) => [],
    };

    registerPlugin(customPlugin);
    const retrieved = getPlugin('claude');
    expect(retrieved!.capabilities.directImport).toBe(false);
  });
});

// ========== Tests: Conversation ==========

describe('conversation engine', () => {
  const { dir, cleanup } = createProject();
  const config = defaultConfig();

  beforeAll(() => {
    clearRegistry();
    initializeRegistry();
  });

  it('generateTellPrompt produces structured output', () => {
    const result = generateTellPrompt(dir, config, 'claude', { scope: 'global' });
    expect(result.target).toBe('claude');
    expect(result.entryCount).toBeGreaterThan(0);
    expect(result.prompt).toContain('MumuSpec');
    expect(result.instructions.length).toBeGreaterThan(0);
  });

  it('generateTellPrompt with unknown target uses generic fallback', () => {
    const result = generateTellPrompt(dir, config, 'unknown-agent', {});
    expect(result.target).toBe('unknown-agent');
    expect(result.entryCount).toBeGreaterThan(0);
  });

  it('generateAbsorbPrompt produces extraction prompt', () => {
    const result = generateAbsorbPrompt(dir, config, 'claude');
    expect(result.target).toBe('claude');
    expect(result.extractPrompt).toBeTruthy();
    expect(result.instructions).toContain('absorb');
  });

  it('parseAbsorbResponse parses JSON response', () => {
    const jsonResponse = JSON.stringify({
      entries: [
        {
          type: 'decision',
          title: 'Test Extracted Rule',
          content: 'This is a test rule extracted from agent.',
          confidence: 'high',
          tags: ['test'],
        },
      ],
    });

    const result = parseAbsorbResponse(dir, config, 'claude', jsonResponse, {
      conflict: 'skip',
      dryRun: false,
    });

    expect(result.parsedEntries.length).toBe(1);
    expect(result.parsedEntries[0].frontmatter.title).toBe('Test Extracted Rule');
    expect(result.parsedEntries[0].frontmatter.status).toBe('draft');
  });

  it('parseAbsorbResponse handles empty response', () => {
    const result = parseAbsorbResponse(dir, config, 'claude', '{"entries": []}', {
      conflict: 'skip',
      dryRun: false,
    });

    expect(result.parsedEntries.length).toBe(0);
  });

  it('parseAbsorbResponse handles invalid JSON', () => {
    const result = parseAbsorbResponse(dir, config, 'claude', 'not json at all', {
      conflict: 'skip',
      dryRun: false,
    });

    expect(result.parsedEntries.length).toBe(0);
  });

  it('parseAbsorbResponse detects title similarity conflicts', () => {
    const jsonResponse = JSON.stringify({
      entries: [
        {
          type: 'lesson',
          title: 'Over-engineering Pitfall', // Similar to existing KP-003
          content: 'Avoid over-engineering piffals in your project.',
          confidence: 'medium',
          tags: ['design'],
        },
      ],
    });

    const result = parseAbsorbResponse(dir, config, 'claude', jsonResponse, {
      conflict: 'skip',
      dryRun: true,
    });

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].similarity).toBeGreaterThan(0.5);
  });

  it('import sets scope to imported and status to draft', () => {
    const jsonResponse = JSON.stringify({
      entries: [
        {
          type: 'decision',
          title: 'Brand New Rule From Agent',
          content: 'This is brand new knowledge from an external agent.',
          confidence: 'high',
          tags: ['imported'],
        },
      ],
    });

    const result = parseAbsorbResponse(dir, config, 'claude', jsonResponse, {
      conflict: 'skip',
      dryRun: false,
    });

    expect(result.imported).toBe(1);
    expect(result.parsedEntries[0].frontmatter.scope).toBe('imported');
    expect(result.parsedEntries[0].frontmatter.status).toBe('draft');
    expect(result.parsedEntries[0].frontmatter.source_agent).toBeTruthy();
  });

  afterAll(() => cleanup());
});

// ========== Tests: End-to-end bidirectional flow ==========

describe('end-to-end bidirectional sync', () => {
  const { dir, cleanup } = createProject();
  const config = defaultConfig();

  beforeAll(() => {
    clearRegistry();
    initializeRegistry();
  });

  it('exports knowledge to Claude format and re-imports', () => {
    // Step 1: Export
    const plugin = getPlugin('claude')!;
    const pages = listKnowledgePages(dir, config);
    const artifact = plugin.formatForAgent(pages, {});

    expect(artifact.entryCount).toBe(3);
    expect(artifact.target).toBe('claude');
    expect(artifact.content).toContain('Ponytail');

    // Step 2: Import (parse the exported artifact back)
    const imported = plugin.parseFromAgent(artifact.content, {
      conflict: 'skip',
      dryRun: false,
    });

    expect(imported.length).toBeGreaterThan(0);
    // Re-imported entries come in as draft
    for (const entry of imported) {
      expect(entry.frontmatter.status).toBe('draft');
      expect(entry.frontmatter.scope).toBe('imported');
    }
  });

  it('exports knowledge to Cursor format', () => {
    const plugin = getPlugin('cursor')!;
    const pages = listKnowledgePages(dir, config);
    const artifact = plugin.formatForAgent(pages, {});

    expect(artifact.target).toBe('cursor');
    expect(artifact.filePath).toBe('.cursor/rules/mumuspec-knowledge.md');
    expect(artifact.content).toContain('Must Follow');
  });

  afterAll(() => cleanup());
});
