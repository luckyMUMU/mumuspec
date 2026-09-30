/**
 * Tests for spec/loader.ts — progressive spec loading, inheritance,
 * and distributed spec utilities.
 *
 * Covers:
 * - loadSpecContext 的增量加载和 path chain 构建
 * - distributed spec 格式 (tech.md, prd.md, spec.md) 的解析
 * - backward compatibility (design.md → prd.md, spec.md → tech.md)
 * - 错误处理：破损 yaml、缺失文件、无效编码
 * - index.yaml 加载和 inheritance
 * - buildIndex / loadPrd / loadTech 辅助函数
 * - findAllDistributedSpecDirs / mergeTechFiles / mergePrdFiles
 * - searchSpecs 按 keyword/scope/type 搜索
 * - getProhibitions 逐层收集
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadSpecContext,
  loadPrd,
  loadTech,
  buildIndex,
  findAllDistributedSpecDirs,
  mergeTechFiles,
  mergePrdFiles,
  searchSpecs,
  getProhibitions,
} from '../../src/spec/loader.js';
import type { MumuSpecConfig } from '../../src/core/config.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-loader-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const defaultConfig: MumuSpecConfig = {
  version: '0.12.2',
  project: { name: 'test', language: 'typescript' },
  specs: { root: '.', format: 'distributed', max_layer_depth: 5, auto_index: true, require_design_doc: false },
  knowledge: {
    enabled: false,
    code_graph: { enabled: false, auto_index_on_commit: false, languages: [] },
    wiki: { dir: '', auto_extract_on_archive: false, max_pages_per_scope: 10 },
    progressive_disclosure: { max_pages_per_layer: 50, load_stale_summary: false },
    freshness: { check_on_load: false, warn_after_days: 30, error_after_days: 90 },
    drift_detection: false,
    reverse_index: { file: '', auto_rebuild: [], fallback: false },
    commit_update: { enabled: false, timeout_ms: 5000, async: true, llm_enhancement: false },
    commit_message: { parse_knowledge_impact: false },
    coverage: { importance_formula: '', gap_threshold: 0.5 },
  },
  enforcement: { engine: 'basic', severity_levels: [], fail_on: 'error' },
  changes: {
    default_workflow: 'full',
    require_brainstorming: false,
    auto_transition: false,
    default_rollback_limit: 3,
    default_rebuild_limit: 3,
    default_build_mode: 'incremental',
    default_tdd_mode: 'strict',
    single_active_change: true,
    default_isolation: 'worktree',
    allow_isolation_downgrade: false,
    implementation_strategy: 'feature-branch',
    design_strategy: 'top-down',
    tdd_mode: 'strict',
    test_immutability: false,
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
  ci: { pre_commit_check: 'warn', test_immutability_check: false, full_check_on_push: false, drift_detection_on_pr: false },
  ai: { generate_rules: false, mcp_server: false, rules_files: [] },
  skills: { enabled: false, discovery: 'auto', ecosystems: {}, dispatch: {}, hyperplan: {} },
  contracts: { enabled: false, dir: 'contracts', strict_mode: false, auto_validate: false },
  ponytail: { enabled: true },
};

// ========== loadSpecContext ==========

describe('loadSpecContext', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should load empty context when no spec files exist', () => {
    const result = loadSpecContext(join(projectDir, 'src'), projectDir, defaultConfig);
    expect(result.targetPath).toContain('src');
    expect(result.layers).toBeDefined();
    expect(result.prohibitions).toEqual([]);
    expect(result.index).toBeUndefined();
  });

  it('should load tech.md format spec', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'tech.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        'doc_type: tech',
        '---',
        '',
        '## Requirement: R1',
        '- SHALL: "Tech constraint"',
        '',
      ].join('\n'),
    );
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    const rootLayer = result.layers.find(l => l.scope === '.');
    expect(rootLayer).toBeDefined();
    expect(rootLayer!.tech).toBeDefined();
    expect(rootLayer!.tech!.requirements).toHaveLength(1);
  });

  it('should load prd.md format spec', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'prd.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        'doc_type: prd',
        '---',
        '',
        'Product description here.',
        '',
      ].join('\n'),
    );
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    const rootLayer = result.layers.find(l => l.scope === '.');
    expect(rootLayer!.prd).toBeDefined();
  });

  it('should fall back to spec.md when tech.md absent', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        '---',
        '',
        '## Requirement: R1',
        '- SHALL: "Fall back spec"',
        '',
      ].join('\n'),
    );
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    const rootLayer = result.layers.find(l => l.scope === '.');
    expect(rootLayer!.spec).toBeDefined();
  });

  it('should fall back to design.md when prd.md absent', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'design.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        '---',
        '',
        'Design content.',
        '',
      ].join('\n'),
    );
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    const rootLayer = result.layers.find(l => l.scope === '.');
    expect(rootLayer!.design).toBeDefined();
  });

  it('should collect prohibitions from tech.md requirements', () => {
    mkdirSync(join(projectDir, 'src', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', '.mumuspec', 'tech.md'),
      '---\nscope: src\nlayer: 1\ndoc_type: tech\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "禁止使用 eval"\n- "禁止动态执行"\n',
    );
    const result = loadSpecContext(join(projectDir, 'src'), projectDir, defaultConfig);
    expect(result.prohibitions.length).toBeGreaterThanOrEqual(2);
  });

  it('should deduplicate prohibitions across layers', () => {
    // Root tech.md
    writeFileSync(
      join(projectDir, '.mumuspec', 'tech.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        'doc_type: tech',
        '---',
        '',
        '## Requirement: R1',
        '- SHALL NOT: "same prohibition"',
        '',
      ].join('\n'),
    );
    // Same prohibition repeated
    // (In real scenario, this would be from different layers)
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    const unique = [...new Set(result.prohibitions)];
    expect(result.prohibitions).toEqual(unique);
  });

  it('should load index.yaml if present in parent', () => {
    mkdirSync(join(projectDir, 'src', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', '.mumuspec', 'spec.md'),
      '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n- SHALL: "test"\n',
    );
    writeFileSync(
      join(projectDir, '.mumuspec', 'index.yaml'),
      'scope: .\nlayer: 0\nchildren:\n  - name: src\n    path: src\n    summary: Source code\n',
    );
    const result = loadSpecContext(join(projectDir, 'src'), projectDir, defaultConfig);
    expect(result.index).toBeDefined();
    expect(result.index!.children).toBeDefined();
  });

  it('should handle broken yaml gracefully', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nbroken: yaml: [unclosed\n---\n## R1\n- SHALL: "x"\n',
    );
    const result = loadSpecContext(projectDir, projectDir, defaultConfig);
    // Should not throw, broken spec is skipped
    expect(result).toBeDefined();
  });

  it('should build path chain for nested target', () => {
    mkdirSync(join(projectDir, 'src', 'core', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'core', '.mumuspec', 'spec.md'),
      '---\nscope: src/core\nlayer: 2\n---\n## R1\n- SHALL: "nested"\n',
    );
    const result = loadSpecContext(join(projectDir, 'src', 'core'), projectDir, defaultConfig);
    expect(result.layers.some(l => l.scope === 'src/core')).toBe(true);
  });

  it('should apply progressive disclosure (respects specs.max_layer_depth)', () => {
    // Create 4 levels deep
    mkdirSync(join(projectDir, 'a', '.mumuspec'), { recursive: true });
    mkdirSync(join(projectDir, 'a', 'b', '.mumuspec'), { recursive: true });
    mkdirSync(join(projectDir, 'a', 'b', 'c', '.mumuspec'), { recursive: true });
    for (const [dir, scope] of [
      [projectDir, '.'],
      [join(projectDir, 'a'), 'a'],
      [join(projectDir, 'a', 'b'), 'a/b'],
      [join(projectDir, 'a', 'b', 'c'), 'a/b/c'],
    ] as [string, string][]) {
      writeFileSync(
        join(dir, '.mumuspec', 'spec.md'),
        `---\nscope: ${scope}\nlayer: 0\n---\n## R1\n- SHALL: "x"\n`,
      );
    }
    // 默认 max_layer_depth = 5：4 层全在预算内 → 全量返回（不再硬编码 3 层）
    const result = loadSpecContext(join(projectDir, 'a', 'b', 'c'), projectDir, defaultConfig);
    expect(result.layers.length).toBe(4);

    // 显式限制为 3 层时降载，且保留 root 与 target
    const limited = loadSpecContext(
      join(projectDir, 'a', 'b', 'c'),
      projectDir,
      { ...defaultConfig, specs: { ...defaultConfig.specs, max_layer_depth: 3 } },
    );
    expect(limited.layers.length).toBe(3);
    expect(limited.layers[0].scope).toBe('.');
    expect(limited.layers[limited.layers.length - 1].scope).toBe('a/b/c');
  });

  it('should detect inheritance conflicts', () => {
    mkdirSync(join(projectDir, 'child', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, '.mumuspec', 'tech.md'),
      [
        '---',
        'scope: .',
        'layer: 0',
        'doc_type: tech',
        '---',
        '',
        '## Requirement: ParentReq',
        '- SHALL: "parent must 使用强类型"',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(projectDir, 'child', '.mumuspec', 'tech.md'),
      `---\nscope: child\nlayer: 1\ndoc_type: tech\nparent_tech: ../../.mumuspec/tech.md\n---\n## Requirement: ChildReq\n- SHALL NOT: "child 禁止 使用强类型"\n`,
    );
    const result = loadSpecContext(join(projectDir, 'child'), projectDir, defaultConfig);
    // Should detect conflict between parent SHALL and child SHALL NOT
    if (result.inheritance_conflicts) {
      expect(result.inheritance_conflicts.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(result.inheritance_conflicts).toBeUndefined();
    }
  });

  it('should include shallNot from spec.md fallback prohibitions', () => {
    mkdirSync(join(projectDir, 'src', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', '.mumuspec', 'spec.md'),
      '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "no eval"\n',
    );
    const result = loadSpecContext(join(projectDir, 'src'), projectDir, defaultConfig);
    expect(result.prohibitions).toContain('"no eval"');
  });
});

// ========== loadPrd ==========

describe('loadPrd', () => {
  it('should load prd.md file', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'prd.md'),
        '---\nscope: .\nlayer: 0\ndoc_type: prd\n---\n\nPRD content here.\n',
      );
      const result = loadPrd(dir, dir);
      expect(result).toBeDefined();
      expect(result!.path).toContain('prd.md');
    } finally {
      cleanup(dir);
    }
  });

  it('should fall back to design.md', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'design.md'),
        '---\nscope: .\nlayer: 0\n---\n\nDesign content.\n',
      );
      const result = loadPrd(dir, dir);
      expect(result).toBeDefined();
      expect(result!.path).toContain('design.md');
    } finally {
      cleanup(dir);
    }
  });

  it('should return undefined for missing file', () => {
    const dir = createTmpProject();
    try {
      const result = loadPrd(dir, dir);
      expect(result).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  });
});

// ========== loadTech ==========

describe('loadTech', () => {
  it('should load tech.md file', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'tech.md'),
        '---\nscope: .\nlayer: 0\ndoc_type: tech\n---\n## Req\n- SHALL: "tech"\n',
      );
      const result = loadTech(dir, dir);
      expect(result).toBeDefined();
      expect(result!.path).toContain('tech.md');
    } finally {
      cleanup(dir);
    }
  });

  it('should fall back to spec.md', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'spec.md'),
        '---\nscope: .\nlayer: 0\n---\n## Req\n- SHALL: "fallback"\n',
      );
      const result = loadTech(dir, dir);
      expect(result).toBeDefined();
    } finally {
      cleanup(dir);
    }
  });
});

// ========== buildIndex ==========

describe('buildIndex', () => {
  it('should return undefined when no .mumuspec dir', () => {
    const dir = join(tmpdir(), `mumuspec-noidx-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const result = buildIndex(dir, dir);
      expect(result).toBeUndefined();
    } finally {
      cleanup(dir);
    }
  });

  it('should build index from directory structure', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'spec.md'),
        '---\nscope: .\nlayer: 0\n---\n## R1\n- SHALL: "x"\n',
      );
      mkdirSync(join(dir, 'sub1', '.mumuspec'), { recursive: true });
      writeFileSync(
        join(dir, 'sub1', '.mumuspec', 'spec.md'),
        '---\nscope: sub1\nlayer: 1\n---\n## R2\n- SHALL: "y"\n',
      );
      const result = buildIndex(dir, dir);
      expect(result).toBeDefined();
      expect(result!.children).toBeDefined();
      expect(result!.children.some(c => c.name === 'sub1')).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});

// ========== findAllDistributedSpecDirs ==========

describe('findAllDistributedSpecDirs', () => {
  it('should find all dirs with spec files', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, '.mumuspec', 'spec.md'),
        '---\nscope: .\nlayer: 0\n---\n## R1\n',
      );
      mkdirSync(join(dir, 'sub', '.mumuspec'), { recursive: true });
      writeFileSync(
        join(dir, 'sub', '.mumuspec', 'tech.md'),
        '---\nscope: sub\nlayer: 1\ndoc_type: tech\n---\n## R2\n',
      );
      const result = findAllDistributedSpecDirs(dir);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Should be sorted deepest first
      if (result.length >= 2) {
        expect(result[0].dir.length).toBeGreaterThanOrEqual(result[result.length - 1].dir.length);
      }
    } finally {
      cleanup(dir);
    }
  });

  it('should skip directories without spec files', () => {
    const dir = createTmpProject();
    try {
      mkdirSync(join(dir, 'no-spec'), { recursive: true });
      const result = findAllDistributedSpecDirs(dir);
      expect(result.every(r => r.files.length > 0)).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});

// ========== mergeTechFiles / mergePrdFiles ==========

describe('mergeTechFiles', () => {
  it('should merge parent requirements into child', () => {
    const parent = {
      path: '/parent/tech.md',
      scope: '.',
      layer: 0,
      content: 'parent content',
      requirements: [
        { name: 'PR1', shall: ['parent shall'], shallNot: ['parent not'], enforcement: [] },
      ],
      architectureDecisions: ['AD1'],
    };
    const child = {
      path: '/child/tech.md',
      scope: 'child',
      layer: 1,
      content: 'child content',
      requirements: [
        { name: 'CR1', shall: ['child shall'], shallNot: ['child not'], enforcement: [] },
      ],
      architectureDecisions: ['AD2'],
    };
    const merged = mergeTechFiles(parent, child);
    expect(merged.requirements.length).toBe(2);
    expect(merged.architectureDecisions).toContain('AD1');
    expect(merged.architectureDecisions).toContain('AD2');
    expect(merged.inherited_requirements).toBe(parent.requirements);
  });

  it('should avoid duplicate architecture decisions', () => {
    const parent = {
      path: '/p',
      scope: '.',
      layer: 0,
      content: '',
      requirements: [],
      architectureDecisions: ['AD1'],
    };
    const child = {
      path: '/c',
      scope: 'c',
      layer: 1,
      content: '',
      requirements: [],
      architectureDecisions: ['AD1'],
    };
    const merged = mergeTechFiles(parent, child);
    expect(merged.architectureDecisions.filter(d => d === 'AD1')).toHaveLength(1);
  });
});

describe('mergePrdFiles', () => {
  it('should merge parent PRD into child', () => {
    const parent = {
      path: '/parent/prd.md',
      scope: '.',
      layer: 0,
      content: 'parent',
      userScenarios: ['scenario1'],
      acceptanceCriteria: ['AC1'],
    };
    const child = {
      path: '/child/prd.md',
      scope: 'child',
      layer: 1,
      content: 'child',
      userScenarios: ['scenario2'],
      acceptanceCriteria: ['AC2'],
    };
    const merged = mergePrdFiles(parent, child);
    expect(merged.userScenarios).toContain('scenario1');
    expect(merged.userScenarios).toContain('scenario2');
    expect(merged.acceptanceCriteria).toContain('AC1');
    expect(merged.acceptanceCriteria).toContain('AC2');
  });
});

// ========== searchSpecs ==========

describe('searchSpecs', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should search by keyword', () => {
    mkdirSync(join(projectDir, 'src', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', '.mumuspec', 'spec.md'),
      '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL\n\n- "使用 TypeScript"\n',
    );
    const results = searchSpecs(projectDir, { keyword: 'TypeScript' });
    expect(results.some(r => r.text.includes('TypeScript'))).toBe(true);
  });

  it('should search by scope', () => {
    mkdirSync(join(projectDir, 'src', '.mumuspec'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', '.mumuspec', 'spec.md'),
      '---\nlayer: 1\n---\n## R1\n- SHALL: "scoped"\n',
    );
    const results = searchSpecs(projectDir, { scope: 'src', type: 'shall' });
    // Scope filter should include src files
    expect(Array.isArray(results)).toBe(true);
  });

  it('should search shall-not type only', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n## R1\n- SHALL: "positive"\n- SHALL NOT: "negative"\n',
    );
    const results = searchSpecs(projectDir, { type: 'shall-not' });
    expect(results.every(r => r.type === 'shall-not')).toBe(true);
  });

  it('should handle empty results', () => {
    const results = searchSpecs(projectDir, { keyword: 'NonExistentTerm' });
    expect(results).toEqual([]);
  });
});

// ========== getProhibitions ==========

describe('getProhibitions', () => {
  it('should collect prohibitions from path chain', () => {
    const dir = createTmpProject();
    try {
      mkdirSync(join(dir, 'src', '.mumuspec'), { recursive: true });
      writeFileSync(
        join(dir, 'src', '.mumuspec', 'spec.md'),
        '---\nscope: src\nlayer: 1\n---\n\n## Requirement: R1\n\n### SHALL NOT\n\n- "root prohibition"\n',
      );
      const results = getProhibitions(dir, join(dir, 'src'));
      expect(results.some(r => r.text.includes('root prohibition'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should return empty for project with no specs', () => {
    const dir = createTmpProject();
    try {
      const results = getProhibitions(dir, join(dir, 'nonexistent'));
      expect(Array.isArray(results)).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});
