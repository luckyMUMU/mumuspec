/**
 * Deep tests for rules/generator.ts — targeting 95%+ line coverage.
 * Exercises every exported function, branch, and conditional path.
 */
import { describe, it, expect, vi } from 'vitest';
import { PONYTAIL_LADDER, NON_LAZY_DOMAINS } from '../../src/spec/ponytail.js';
import type { MumuSpecConfig } from '../../src/core/config.js';
import type { SpecContext, SpecFile } from '../../src/core/types.js';

// ── hoisted mocks ──────────────────────────────────────────────────────
const { writeTextMock, capturedWrites } = vi.hoisted(() => {
  const capturedWrites: Record<string, string> = {};
  const fn = vi.fn((filePath: string, content: string) => {
    capturedWrites[filePath] = content;
  });
  // Override mockClear to also reset capturedWrites so tests stay isolated
  const origClear = fn.mockClear.bind(fn);
  fn.mockClear = () => {
    origClear();
    for (const k of Object.keys(capturedWrites)) delete capturedWrites[k];
  };
  return {
    writeTextMock: fn,
    capturedWrites,
  };
});

vi.mock('../../src/core/utils.js', async () => {
  return {
    writeText: writeTextMock,
    readText: vi.fn(),
    readYaml: vi.fn(),
    writeYaml: vi.fn(),
    computeHash: vi.fn(),
    moveFile: vi.fn(),
    ensureDir: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

import { generateRulesFiles } from '../../src/rules/generator.js';

// ── helpers ────────────────────────────────────────────────────────────
/** Minimal valid MumuSpecConfig with all optional sections off. */
function makeFullConfig(overrides?: Partial<MumuSpecConfig>): MumuSpecConfig {
  const config: MumuSpecConfig = {
    version: '0.12.0',
    project: { name: 'test-proj', language: 'typescript' },
    specs: {
      root: '.mumuspec/specs',
      format: 'yaml',
      max_layer_depth: 5,
      auto_index: true,
      require_design_doc: true,
    },
    knowledge: {
      enabled: false,
      code_graph: {
        enabled: false,
        storage: 'sqlite',
        db_path: '.mumuspec/graph.db',
        auto_index_on_commit: true,
        languages: ['typescript'],
      },
      wiki: {
        dir: '.mumuspec/wiki',
        auto_extract_on_archive: false,
        max_pages_per_scope: 10,
      },
      progressive_disclosure: {
        max_pages_per_layer: 5,
        load_stale_summary: true,
      },
      freshness: {
        check_on_load: true,
        warn_after_days: 30,
        error_after_days: 90,
      },
      drift_detection: true,
      reverse_index: {
        file: '.mumuspec/reverse-index.yaml',
        auto_rebuild: [],
        fallback: true,
      },
      commit_update: {
        enabled: false,
        timeout_ms: 5000,
        async: true,
        llm_enhancement: false,
      },
      commit_message: {
        parse_knowledge_impact: false,
      },
      coverage: {
        importance_formula: 'linear',
        gap_threshold: 0.5,
      },
    },
    enforcement: {
      engine: 'eslint',
      severity_levels: ['info', 'warn', 'error'],
      fail_on: 'error',
    },
    changes: {
      default_workflow: 'git',
      require_brainstorming: false,
      auto_transition: true,
      default_rollback_limit: 3,
      default_rebuild_limit: 3,
      default_build_mode: 'sequential',
      default_tdd_mode: 'strict',
      single_active_change: true,
      default_isolation: 'worktree',
      allow_isolation_downgrade: false,
      implementation_strategy: 'incremental',
      design_strategy: 'top-down',
      tdd_mode: 'strict',
      test_immutability: true,
    },
    workflow: {
      worktree_isolation: true,
      single_active_change: true,
      top_down_design: true,
      tdd_enforced: true,
      max_active_changes: 1,
    },
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'high',
      exceptions: [],
    },
    ci: {
      pre_commit_check: 'lint',
      test_immutability_check: true,
      full_check_on_push: true,
      drift_detection_on_pr: true,
    },
    ai: {
      generate_rules: true,
      mcp_server: false,
      rules_files: ['CLAUDE.md'],
    },
    skills: {
      enabled: false,
      discovery: 'worktree',
      ecosystems: {},
      dispatch: {},
    },
    contracts: {
      enabled: false,
      external_dir: '.mumuspec/contracts',
      outbound_dir: '.mumuspec/outbound',
      schemas_dir: '.mumuspec/schemas',
      registry_file: '.mumuspec/contract-registry.json',
      auto_derive: false,
      drift_detection: false,
      compat_check_on_change: false,
      verify_on_build: false,
      verify_on_archive: false,
    },
    ponytail: {
      enabled: false,
      auto_inject_to_root: false,
      comment_marker: '// ponytail:',
      strict_no_new_deps: false,
    },
    cognitive_framework: {
      enabled: false,
      default_mode: 'yolo',
      max_rounds: 3,
      q3_per_round: 1,
    },
  };

  // Apply overrides (shallow merge, deep-ish for ai and project and knowledge and ponytail)
  if (overrides) {
    if (overrides.ai) config.ai = { ...config.ai, ...overrides.ai };
    if (overrides.project) config.project = { ...config.project, ...overrides.project };
    if (overrides.knowledge) config.knowledge = { ...config.knowledge, ...overrides.knowledge };
    if (overrides.ponytail) config.ponytail = { ...config.ponytail, ...overrides.ponytail };
    // Allow overriding any other top-level by spreading
    Object.assign(config, overrides);
  }

  return config;
}

/** Minimal SpecFile with requirements. */
function makeSpec(partial?: Partial<SpecFile>): SpecFile {
  return {
    path: '.mumuspec/specs/root/spec.md',
    frontmatter: {
      version: '0.12.0',
      scope: 'root',
      layer: 0,
      constraint_strength: 'high',
    },
    requirements: [
      {
        name: 'Test Requirement',
        shall: ['do this thing'],
        shallNot: ['do that thing'],
        enforcement: [],
      },
    ],
    raw: '',
    ...partial,
  };
}

/** Minimal SpecContext with one layer. */
function makeSpecContext(partial?: Partial<SpecContext>): SpecContext {
  return {
    targetPath: '.',
    layers: [
      {
        level: 0,
        scope: 'root',
        path: '.mumuspec/specs/root/spec.md',
        spec: makeSpec(),
      },
    ],
    prohibitions: [],
    ...partial,
  };
}

/** Get the content written to a specific file path from captured writes.
 *  Uses fuzzy matching (looks for the relative portion of the path anywhere in the key)
 *  so tests work regardless of platform path separators. */
function getWrittenContent(filePath: string): string | undefined {
  // try exact match first
  if (capturedWrites[filePath]) return capturedWrites[filePath];
  // extract the rules_file portion (last path segment) and search for it as a substring
  const parts = filePath.split('/');
  const needle = parts[parts.length - 1]!;
  for (const [key, val] of Object.entries(capturedWrites)) {
    if (key.endsWith(needle)) return val;
  }
  return undefined;
}

// ── tests ──────────────────────────────────────────────────────────────

describe('rules/generator — generateRulesFiles (high coverage)', () => {
  // Reset mock before each test
  it('returns file paths for each rules_file in config', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md', '.cursorrules', '.opencode/rules.md'] } });

    const result = generateRulesFiles('/proj', config);

    expect(result).toHaveLength(3);
    expect(result.some((p) => p.endsWith('CLAUDE.md'))).toBe(true);
    expect(result.some((p) => p.endsWith('.cursorrules'))).toBe(true);
    expect(result.some((p) => p.endsWith('.opencode/rules.md') || p.endsWith('.opencode\\rules.md'))).toBe(true);
    expect(writeTextMock).toHaveBeenCalledTimes(3);
  });

  it('returns empty array when rules_files is empty', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: [] } });

    const result = generateRulesFiles('/proj', config);

    expect(result).toHaveLength(0);
    expect(writeTextMock).not.toHaveBeenCalled();
  });

  it('calls writeText with correct filePath derived from projectRoot + rulesFile', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/home/user/project', config);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const filePath = Object.keys(capturedWrites).find((k) => k.includes('CLAUDE.md'));
    expect(filePath).toBeDefined();
    const content = filePath ? capturedWrites[filePath] : undefined;
    expect(typeof content).toBe('string');
    expect(content!.length).toBeGreaterThan(0);
  });

  // ── header branch tests (lines 38–44) ─────────────────────────

  it('CLAUDE.md header uses "Claude Code Rules"', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('# Claude Code Rules');
    expect(content).not.toContain('# Cursor Rules');
    expect(content).not.toContain('# Agent Rules');
  });

  it('.cursorrules header uses "Cursor Rules"', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['.cursorrules'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/.cursorrules');

    expect(content).toContain('# Cursor Rules');
    expect(content).not.toContain('# Claude Code Rules');
    expect(content).not.toContain('# Agent Rules');
  });

  it('unrecognized rules_file uses generic "Agent Rules" header', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['.opencode/rules.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/.opencode/rules.md');

    expect(content).toContain('# Agent Rules');
    expect(content).not.toContain('# Claude Code Rules');
    expect(content).not.toContain('# Cursor Rules');
  });

  // ── project overview branch tests (lines 50–57) ───────────────

  it('includes Framework line when config.project.framework is set', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      project: { name: 'test', language: 'typescript' },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });
    config.project.framework = 'React';

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('- **Framework**: React');
  });

  it('omits Framework line when config.project.framework is undefined', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      project: { name: 'test', language: 'typescript' },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });
    delete config.project.framework;

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('**Framework**');
  });

  // ── always-present sections (lines 60–65, 147–153, 164–180) ─

  it('always includes workflow rules section', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Workflow Rules');
    expect(content).toContain('Worktree Isolation');
    expect(content).toContain('Single Active Change');
    expect(content).toContain('Top-Down Design');
    expect(content).toContain('Red-Green TDD');
  });

  it('always includes priority system section', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Priority System');
    expect(content).toContain('User explicit instructions');
    expect(content).toContain('MumuSpec SHALL NOT');
    expect(content).toContain('MumuSpec SHALL');
    expect(content).toContain('External Skill guidance');
    expect(content).toContain('Default system behavior');
  });

  it('always includes CLI commands reference section', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Key CLI Commands');
    expect(content).toContain('mumuspec init');
    expect(content).toContain('mumuspec context');
    expect(content).toContain('mumuspec validate');
    expect(content).toContain('mumuspec check');
    expect(content).toContain('mumuspec new');
    expect(content).toContain('mumuspec status');
    expect(content).toContain('mumuspec list');
    expect(content).toContain('mumuspec archive');
    expect(content).toContain('mumuspec discard');
    expect(content).toContain('mumuspec drift');
    expect(content).toContain('mumuspec guard');
    expect(content).toContain('mumuspec doctor');
  });

  it('always includes project name and language in header comment', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('Project: test-proj | Language: typescript');
  });

  // ── spec context layers branch (lines 67–95) ──────────────────

  it('includes spec context section when layers present with spec', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Specification Context (Progressive Disclosure)');
    expect(content).toContain('### Level 0: root');
    expect(content).toContain('Test Requirement');
    expect(content).toContain('**SHALL:**');
    expect(content).toContain('do this thing');
    expect(content).toContain('**SHALL NOT:**');
    expect(content).toContain('do that thing');
  });

  it('omits spec context section when specContext is undefined', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Specification Context');
  });

  it('omits spec context section when specContext.layers is empty', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext({ layers: [] });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Specification Context');
  });

  it('skips layers whose spec is undefined (no crash)', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext({
      layers: [
        {
          level: 0,
          scope: 'child',
          path: '.mumuspec/specs/child/spec.md',
          // spec is intentionally absent (undefined)
        },
        {
          level: 1,
          scope: 'grandchild',
          path: '.mumuspec/specs/child/grandchild/spec.md',
          spec: makeSpec({
            requirements: [{ name: 'Second', shall: ['x'], shallNot: [], enforcement: [] }],
          }),
        },
      ],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Specification Context');
    expect(content).toContain('### Level 1: grandchild');
    expect(content).toContain('Second');
  });

  it('renders Requirement with only shall (no shallNot)', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers[0]!.spec = makeSpec({
      requirements: [{ name: 'OnlyShall', shall: ['must-do'], shallNot: [], enforcement: [] }],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('**SHALL:**');
    expect(content).toContain('must-do');
    expect(content).not.toContain('**SHALL NOT:**');
  });

  it('renders Requirement with only shallNot (no shall)', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers[0]!.spec = makeSpec({
      requirements: [{ name: 'OnlyNot', shall: [], shallNot: ['must-not'], enforcement: [] }],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('**SHALL NOT:**');
    expect(content).toContain('must-not');
    expect(content).not.toContain('**SHALL:**');
  });

  it('renders Requirement with empty shall and empty shallNot (no SHALL/SHALL NOT blocks)', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers[0]!.spec = makeSpec({
      requirements: [{ name: 'EmptyReq', shall: [], shallNot: [], enforcement: [] }],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('EmptyReq');
    expect(content).not.toContain('**SHALL:**');
    expect(content).not.toContain('**SHALL NOT:**');
  });

  it('renders multiple requirements from a single layer', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers[0]!.spec = makeSpec({
      requirements: [
        { name: 'First', shall: ['a'], shallNot: ['b'], enforcement: [] },
        { name: 'Second', shall: ['c'], shallNot: ['d'], enforcement: [] },
      ],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('First');
    expect(content).toContain('a');
    expect(content).toContain('Second');
    expect(content).toContain('c');
  });

  it('renders multiple layers from specContext', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers.push({
      level: 1,
      scope: 'sub',
      path: '.mumuspec/specs/sub/spec.md',
      spec: makeSpec({
        requirements: [{ name: 'SubReq', shall: ['sub-must'], shallNot: [], enforcement: [] }],
      }),
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('### Level 0: root');
    expect(content).toContain('### Level 1: sub');
    expect(content).toContain('SubReq');
  });

  // ── prohibitions branch (lines 97–104) ────────────────────────

  it('includes prohibitions summary when prohibitions are non-empty', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext({ prohibitions: ['Must not modify CLI output format', 'No breaking changes to public API'] });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Prohibitions Summary');
    expect(content).toContain('Must not modify CLI output format');
    expect(content).toContain('No breaking changes to public API');
  });

  it('omits prohibitions summary when specContext has zero prohibitions', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext({ prohibitions: [] });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Prohibitions Summary');
  });

  it('omits prohibitions summary when specContext is undefined', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Prohibitions Summary');
  });

  // ── ponytail branch (lines 106–144) ──────────────────────────

  it('includes ponytail section when config.ponytail.enabled is true', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: '// ponytail:', strict_no_new_deps: true },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Ponytail Coding Constraints');
    expect(content).toContain('### 7-Level Priority Ladder');
    expect(content).toContain('### Hard Constraints');
    expect(content).toContain('### Non-Lazy Domains');
    expect(content).toContain('### ponytail: Comment Marker');
    // Verify ladder entries are in the table
    for (const rung of PONYTAIL_LADDER) {
      expect(content).toContain(rung.question);
      expect(content).toContain(rung.action);
      expect(content).toContain(rung.type);
    }
    // Verify non-lazy domains
    for (const domain of NON_LAZY_DOMAINS) {
      expect(content).toContain(domain);
    }
  });

  it('omits ponytail section when config.ponytail.enabled is false', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ponytail: { enabled: false, auto_inject_to_root: false, comment_marker: '// ponytail:', strict_no_new_deps: false },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Ponytail Coding Constraints');
    expect(content).not.toContain('### 7-Level Priority Ladder');
    expect(content).not.toContain('### Non-Lazy Domains');
  });

  // ── knowledge branch (lines 155–162) ──────────────────────────

  it('includes knowledge layer section when config.knowledge.enabled is true', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      knowledge: {
        enabled: true,
        code_graph: { enabled: true, storage: 'sqlite', db_path: '.mumuspec/graph.db', auto_index_on_commit: true, languages: ['typescript'] },
        wiki: { dir: '.mumuspec/wiki', auto_extract_on_archive: false, max_pages_per_scope: 10 },
        progressive_disclosure: { max_pages_per_layer: 5, load_stale_summary: true },
        freshness: { check_on_load: true, warn_after_days: 30, error_after_days: 90 },
        drift_detection: true,
        reverse_index: { file: '.mumuspec/reverse-index.yaml', auto_rebuild: [], fallback: true },
        commit_update: { enabled: false, timeout_ms: 5000, async: true, llm_enhancement: false },
        commit_message: { parse_knowledge_impact: false },
        coverage: { importance_formula: 'linear', gap_threshold: 0.5 },
      },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## Knowledge Layer');
    expect(content).toContain('Code Graph (HOW)');
    expect(content).toContain('LLM-Wiki (WHY)');
    expect(content).toContain('PageIndex (WHERE)');
  });

  it('omits knowledge layer section when config.knowledge.enabled is false', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      knowledge: { enabled: false } as MumuSpecConfig['knowledge'],
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## Knowledge Layer');
  });

  // ── MCP server branch (lines 182–198) ─────────────────────────

  it('includes MCP server section when config.ai.mcp_server is true', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: true, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('## MCP Server');
    expect(content).toContain('mcpServers');
    expect(content).toContain('@mumuspec/mcp-server');
    expect(content).toContain('MUMUSPEC_ROOT');
    expect(content).toContain('workspaceRoot');
  });

  it('omits MCP server section when config.ai.mcp_server is false', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).not.toContain('## MCP Server');
  });

  // ── full integration: all sections enabled ─────────────────────

  it('includes all optional sections when everything is enabled', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      project: { name: 'full-proj', language: 'typescript' },
      knowledge: {
        enabled: true,
        code_graph: { enabled: true, storage: 'sqlite', db_path: '.mumuspec/graph.db', auto_index_on_commit: true, languages: ['typescript'] },
        wiki: { dir: '.mumuspec/wiki', auto_extract_on_archive: false, max_pages_per_scope: 10 },
        progressive_disclosure: { max_pages_per_layer: 5, load_stale_summary: true },
        freshness: { check_on_load: true, warn_after_days: 30, error_after_days: 90 },
        drift_detection: true,
        reverse_index: { file: '.mumuspec/reverse-index.yaml', auto_rebuild: [], fallback: true },
        commit_update: { enabled: false, timeout_ms: 5000, async: true, llm_enhancement: false },
        commit_message: { parse_knowledge_impact: false },
        coverage: { importance_formula: 'linear', gap_threshold: 0.5 },
      },
      ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: '// ponytail:', strict_no_new_deps: true },
      ai: { generate_rules: true, mcp_server: true, rules_files: ['CLAUDE.md'] },
    });
    config.project.framework = 'Vue 3';
    const specCtx = makeSpecContext({
      prohibitions: ['Do not break existing APIs'],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    // Header
    expect(content).toContain('# Claude Code Rules');
    // Project overview with framework
    expect(content).toContain('**Framework**: Vue 3');
    // Workflow rules
    expect(content).toContain('## Workflow Rules');
    // Spec context
    expect(content).toContain('## Specification Context');
    // Prohibitions
    expect(content).toContain('## Prohibitions Summary');
    expect(content).toContain('Do not break existing APIs');
    // Ponytail
    expect(content).toContain('## Ponytail Coding Constraints');
    // Priority
    expect(content).toContain('## Priority System');
    // Knowledge
    expect(content).toContain('## Knowledge Layer');
    // CLI commands
    expect(content).toContain('## Key CLI Commands');
    // MCP server
    expect(content).toContain('## MCP Server');
  });

  // ── auto-generated marker line ─────────────────────────────────

  it('includes auto-generated disclaimer in every file', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md', '.cursorrules', 'AGENTS.md'] },
    });

    generateRulesFiles('/proj', config);

    for (const f of ['CLAUDE.md', '.cursorrules', 'AGENTS.md']) {
      const content = getWrittenContent(`/proj/${f}`);
      expect(content).toContain('Auto-generated by MumuSpec');
      expect(content).toContain('Do not edit manually');
    }
  });

  // ── project name and language appear for every rules_file ───────

  it('project name and language appear in every generated file', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      project: { name: 'my-app', language: 'python' },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md', '.cursorrules'] },
    });

    generateRulesFiles('/proj', config);

    const claude = getWrittenContent('/proj/CLAUDE.md');
    const cursor = getWrittenContent('/proj/.cursorrules');

    expect(claude).toContain('Project: my-app | Language: python');
    expect(cursor).toContain('Project: my-app | Language: python');
  });

  // ── nested subdirectory rules_file path resolution ──────────────

  it('returns correct paths for rules_files in nested subdirectories', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ai: { generate_rules: true, mcp_server: false, rules_files: ['.opencode/rules.md', '.factory/rules.md'] },
    });

    const result = generateRulesFiles('/workspace/proj', config);

    expect(result).toHaveLength(2);
    expect(result.some((p) => p.includes('.opencode') && p.endsWith('rules.md'))).toBe(true);
    expect(result.some((p) => p.includes('.factory') && p.endsWith('rules.md'))).toBe(true);
  });

  // ── ponytail ladder table format ───────────────────────────────

  it('renders ponytail ladder as a markdown table with 7 rows', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: '// ponytail:', strict_no_new_deps: true },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('| Level | Question | Action | Type |');
    expect(content).toContain('|-------|----------|--------|------|');
    // 7 entries in the table
    const lines = content!.split('\n');
    const tableLines = lines.filter((l) => /^\| \d+ \|/.test(l));
    expect(tableLines).toHaveLength(7);
  });

  // ── non-lazy domains count ─────────────────────────────────────

  it('renders all non-lazy domains', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: '// ponytail:', strict_no_new_deps: true },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    for (const domain of NON_LAZY_DOMAINS) {
      expect(content).toContain(`- ${domain}`);
    }
  });

  // ── ponytail comment marker code block ─────────────────────────

  it('includes ponytail comment marker TypeScript example', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: '// ponytail:', strict_no_new_deps: true },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('```typescript');
    expect(content).toContain('// ponytail: <reason for intentional simplification>');
    expect(content).toContain('```');
  });

  // ── requirements with mixed shall/shallNot across multiple layers ─

  it('renders shall and shallNot from second layer requirements', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext();
    specCtx.layers[0]!.spec = makeSpec({
      requirements: [
        { name: 'R1', shall: ['s1'], shallNot: [], enforcement: [] },
        { name: 'R2', shall: [], shallNot: ['sn1'], enforcement: [] },
        { name: 'R3', shall: ['s2'], shallNot: ['sn2'], enforcement: [] },
      ],
    });

    generateRulesFiles('/proj', config, specCtx);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('R1');
    expect(content).toContain('s1');
    expect(content).toContain('R2');
    expect(content).toContain('sn1');
    expect(content).toContain('R3');
    expect(content).toContain('s2');
    expect(content).toContain('sn2');
  });

  // ── edge: project name and language are reflected ───────────────

  it('reflects dynamic project name and language from config', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({
      project: { name: 'dynamic-name', language: 'rust' },
      ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] },
    });

    generateRulesFiles('/proj', config);
    const content = getWrittenContent('/proj/CLAUDE.md');

    expect(content).toContain('Project: dynamic-name | Language: rust');
    expect(content).toContain('- **Name**: dynamic-name');
    expect(content).toContain('- **Language**: rust');
  });

  // ── edge: specContext with layers but no spec on any layer ────────

  it('handles specContext where all layers have no spec (no crash)', () => {
    writeTextMock.mockClear();
    const config = makeFullConfig({ ai: { generate_rules: true, mcp_server: false, rules_files: ['CLAUDE.md'] } });
    const specCtx = makeSpecContext({
      layers: [
        { level: 0, scope: 'a', path: 'a/spec.md' },
        { level: 1, scope: 'b', path: 'b/spec.md' },
      ],
    });

    // Should not throw
    expect(() => generateRulesFiles('/proj', config, specCtx)).not.toThrow();
    const content = getWrittenContent('/proj/CLAUDE.md');
    // Layer headers are only emitted if spec exists
    expect(content).not.toContain('### Level 0: a');
    expect(content).not.toContain('### Level 1: b');
  });
});
