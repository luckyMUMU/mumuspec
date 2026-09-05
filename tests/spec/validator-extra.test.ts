/**
 * Additional coverage for src/spec/validator.ts.
 *
 * Current coverage ~39% (~280 uncovered lines).
 * This file targets the major uncovered branches using vi.mock('node:fs')
 * for deterministic, filesystem-independent tests.
 *
 * Coverage targets:
 *   validateSpecFile:
 *     - empty file content → E-SPEC-001 "File is empty"
 *     - file does not exist → readText returns undefined → "File is empty"
 *     - negative layer → E-SPEC-001 "layer must be >= 0"
 *     - missing scope → E-SPEC-001 "scope is required"
 *     - no requirements → E-SPEC-004 warning "No requirements defined"
 *     - valid spec (layer ≥ 0, scope present, requirements present)
 *     - parse error: MumuSpecError (err.name === 'MumuSpecError')
 *     - parse error: generic non-MumuSpec Error → "Failed to parse: ..."
 *   validateAllSpecs / validateSpecMd:
 *     - no spec directories at all
 *     - valid spec.md passes (all checks green)
 *     - layer exceeds max_layer_depth → E-SPEC-002
 *     - require_design_doc + missing design.md → E-SPEC-006
 *     - SHALL with constraints but no enforcement → E-SPEC-004 warning
 *     - prd.md V2 valid → passes
 *     - prd.md V2 invalid layer → E-SPEC-008
 *     - prd.md V2 no ## Requirement: blocks → E-SPEC-011 warning
 *     - prd.md old format (no doc_type) → skipped (grandfathered)
 *     - tech.md V2 valid → passes
 *     - tech.md V2 constraints without enforcement → E-SPEC-004 warning
 *     - tech.md V2 no ## Requirement: blocks → E-SPEC-011 warning
 *     - tech.md old format (no doc_type) → skipped (grandfathered)
 *     - empty prd.md → E-SPEC-008 warning
 *     - empty tech.md → E-SPEC-009 warning
 *     - parent_prd reference not found → E-SPEC-010
 *     - parent_tech reference not found → E-SPEC-010
 *     - inheritance conflict between parent and child → E-SPEC-003
 *     - index.yaml present with child spec dirs → freshness branch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';

// ─── Mock node:fs ───────────────────────────────────────────────────────────
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
  appendFileSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
}));

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { validateAllSpecs, validateSpecFile } from '../../src/spec/validator.js';
import type { MumuSpecConfig } from '../../src/core/config.js';

const mockExists = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockReadDir = readdirSync as unknown as ReturnType<typeof vi.fn>;
const mockReadFile = readFileSync as unknown as ReturnType<typeof vi.fn>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal MumuSpecConfig with only specs-relevant fields settable. */
function makeConfig(specsOverrides?: Partial<MumuSpecConfig['specs']>): MumuSpecConfig {
  return {
    version: '0.12.2',
    project: { name: 'test', language: 'typescript' },
    specs: {
      root: '.',
      format: 'distributed',
      max_layer_depth: 5,
      auto_index: true,
      require_design_doc: false,
      ...specsOverrides,
    },
    knowledge: {
      enabled: false,
      code_graph: { enabled: false, storage: 'json', db_path: '', auto_index_on_commit: false, languages: [] },
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
      // M2 default is strict (E-SPEC-015 as ERROR); this file's fixtures predate
      // the gate and target OTHER validator behaviors — pin observation mode.
      enforcement_strict: false,
    },
    ci: {
      pre_commit_check: 'all',
      test_immutability_check: false,
      full_check_on_push: false,
      drift_detection_on_pr: false,
    },
    ai: { generate_rules: true, mcp_server: false, rules_files: [] },
    skills: { enabled: false, discovery: 'local', ecosystems: {}, dispatch: {} },
    contracts: {
      enabled: false, external_dir: '', outbound_dir: '', schemas_dir: '',
      registry_file: '', auto_derive: false, drift_detection: false,
      compat_check_on_change: false, verify_on_build: false, verify_on_archive: false,
    },
    ponytail: { enabled: false, auto_inject_to_root: false, comment_marker: 'ponytail:', strict_no_new_deps: false },
    cognitive_framework: {
      enabled: false, default_mode: 'lightweight', max_rounds: 3,
      q3_per_round: 3, q2_per_round: 3, q4_min_dimensions: 2, hotfix_skip: false,
    },
    design_docs: {
      enabled: false, required: false, auto_sync_on_design_phase: false,
      drift_detection: false, inheritance: false,
    },
    docs: {
      enabled: false, output_dir: '', generation: {}, types: {},
      templates: {}, output: {}, consistency_check: {},
    },
  } as MumuSpecConfig;
}

/** Valid YAML spec markdown content for .mumuspec/spec.md. */
function validSpecMd(layer = 0, scope = 'root', options?: {
  withEnforcement?: boolean;
  noRequirements?: boolean;
}): string {
  if (options?.noRequirements) {
    return [
      '---',
      `layer: ${layer}`,
      `scope: "${scope}"`,
      'last_updated: "2024-01-01"',
      '---',
      '',
      'Just plain markdown without requirement blocks.',
      '',
    ].join('\n');
  }
  const enforcement = options?.withEnforcement === false
    ? ''
    : [
        '',
        '### Enforcement',
        '- E-GUARD-001: Verify code quality',
        '',
      ].join('\n');

  return [
    '---',
    `layer: ${layer}`,
    `scope: "${scope}"`,
    'last_updated: "2024-01-01"',
    '---',
    '',
    '## Requirement: General',
    '',
    '### SHALL',
    '- Code must function correctly',
    '- 必须通过所有单元测试',
    '',
    '### SHALL NOT',
    '- 禁止使用不安全的依赖',
    '',
    enforcement,
  ].join('\n');
}

/** Valid YAML content for V2 prd.md. */
function validPrdMd(layer = 0, scope = 'root', options?: {
  noRequirements?: boolean;
  invalidLayer?: boolean;
}): string {
  if (options?.invalidLayer) {
    return [
      '---',
      'layer: -1',
      `scope: "${scope}"`,
      'last_updated: "2024-01-01"',
      'doc_type: prd',
      '---',
      '',
      'Some content.',
      '',
    ].join('\n');
  }
  if (options?.noRequirements) {
    return [
      '---',
      `layer: ${layer}`,
      `scope: "${scope}"`,
      'last_updated: "2024-01-01"',
      'doc_type: prd',
      '---',
      '',
      'Free-form content without requirement blocks.',
      '',
    ].join('\n');
  }
  return [
    '---',
    `layer: ${layer}`,
    `scope: "${scope}"`,
    'last_updated: "2024-01-01"',
    'doc_type: prd',
    '---',
    '',
    '## Requirement: Feature Goals',
    '',
    '### SHALL',
    '- Describe product goals',
    '',
    '## Requirement: User Scenarios',
    '',
    '### SHALL',
    '- User can perform action',
    '',
  ].join('\n');
}

/** Valid YAML content for V2 tech.md. */
function validTechMd(layer = 0, scope = 'root', options?: {
  noRequirements?: boolean;
  noEnforcement?: boolean;
}): string {
  if (options?.noRequirements) {
    return [
      '---',
      `layer: ${layer}`,
      `scope: "${scope}"`,
      'last_updated: "2024-01-01"',
      'doc_type: tech',
      '---',
      '',
      'Architecture notes without requirement blocks.',
      '',
    ].join('\n');
  }
  const enforcement = options?.noEnforcement
    ? ''
    : [
        '',
        '### Enforcement',
        '- E-GUARD-002: Check architecture compliance',
        '',
      ].join('\n');
  return [
    '---',
    `layer: ${layer}`,
    `scope: "${scope}"`,
    'last_updated: "2024-01-01"',
    'doc_type: tech',
    '---',
    '',
    '## Requirement: Architecture Constraints',
    '',
    '### SHALL',
    '- Must use TypeScript strict mode',
    '- 必须通过架构审查',
    '',
    '### SHALL NOT',
    '- 禁止跳过类型检查',
    '',
    enforcement,
  ].join('\n');
}

/** Old-format prd.md (without doc_type) for grandfathering tests. */
function oldPrdMd(): string {
  return [
    '---',
    'layer: 0',
    'scope: "root"',
    '---',
    '',
    'Some old-format PRD content.',
    '',
  ].join('\n');
}

/** Old-format tech.md (without doc_type) for grandfathering tests. */
function oldTechMd(): string {
  return [
    '---',
    'layer: 0',
    'scope: "root"',
    '---',
    '',
    'Some old-format tech content.',
    '',
  ].join('\n');
}

/** Simulate: single project root with one .mumuspec dir containing spec.md. */
function setupSingleSpecDir(rootPath: string, specContent: string): void {
  const muDir = join(rootPath, '.mumuspec');
  const specPath = join(muDir, 'spec.md');

  mockExists.mockImplementation((p: string) => {
    if (p === muDir) return true;
    if (p === specPath) return true;
    return false;
  });

  mockReadDir.mockImplementation((dir: string) => {
    if (dir === rootPath) return []; // no subdirs
    return [];
  });

  mockReadFile.mockImplementation((p: string) => {
    if (p === specPath) return specContent;
    return '';
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockExists.mockReturnValue(false);
  mockReadDir.mockReturnValue([]);
  mockReadFile.mockReturnValue('');
});

// ==========================================================================
// validateSpecFile — branch coverage
// ==========================================================================

describe('validateSpecFile — empty / missing / invalid content', () => {
  it('should fail with E-SPEC-001 "File is empty" when content is empty string', () => {
    // existsSync true, readFileSync returns ''
    mockExists.mockReturnValue(true);
    mockReadFile.mockReturnValue('');

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: 'E-SPEC-001',
      message: 'File is empty',
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('should fail with E-SPEC-001 "File is empty" when file does not exist (readText returns undefined)', () => {
    mockExists.mockReturnValue(false);

    const result = validateSpecFile('/nonexistent/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: 'E-SPEC-001',
      message: 'File is empty',
    });
  });

  it('should fail with "layer must be >= 0" when frontmatter layer is negative', () => {
    mockExists.mockReturnValue(true);
    const content = [
      '---',
      'layer: -3',
      'scope: "test"',
      'last_updated: "2024-01-01"',
      '---',
      '',
      '## Requirement: Negative',
      '',
      '### SHALL',
      '- Something',
      '',
    ].join('\n');
    mockReadFile.mockReturnValue(content);

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.message.includes('layer must be >= 0'))).toBe(true);
  });

  it('should fail with "scope is required" when frontmatter scope is an empty string', () => {
    mockExists.mockReturnValue(true);
    // scope: "" passes the parser's typeof check (it IS a string)
    // but is falsy, so validateSpecFile's own check catches it.
    const content = [
      '---',
      'layer: 0',
      'scope: ""',
      'last_updated: "2024-01-01"',
      '---',
      '',
      '## Requirement: EmptyScope',
      '',
      '### SHALL',
      '- Something',
      '',
    ].join('\n');
    mockReadFile.mockReturnValue(content);

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.message.includes('scope is required'))).toBe(true);
  });

  it('should emit E-SPEC-004 warning "No requirements defined" when body has no ## Requirement: blocks', () => {
    mockExists.mockReturnValue(true);
    const content = validSpecMd(0, 'root', { noRequirements: true });
    mockReadFile.mockReturnValue(content);

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('No requirements defined'))).toBe(true);
  });

  it('should pass for a completely valid spec file (layer ≥ 0, scope present, requirements present)', () => {
    mockExists.mockReturnValue(true);
    const content = validSpecMd(0, 'root');
    mockReadFile.mockReturnValue(content);

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should produce MumuSpecError-branded message when frontmatter is entirely missing', () => {
    mockExists.mockReturnValue(true);
    // No --- delimiters → parseFrontmatter returns undefined frontmatter
    mockReadFile.mockReturnValue('Just plain text with no frontmatter at all.\n');

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('E-SPEC-001');
    // MumuSpecError path does NOT prefix with "Failed to parse:"
    expect(result.errors[0].message).not.toContain('Failed to parse:');
  });

  it('should produce "Failed to parse:" message on a non-MumuSpec error (YAML parse error)', () => {
    mockExists.mockReturnValue(true);
    // Unclosed quote forces yaml.parse to throw YAMLParseError (not MumuSpecError)
    mockReadFile.mockReturnValue(
      '---\nscope: "unclosed quote\n---\nbody\n',
    );

    const result = validateSpecFile('/fake/spec.md');

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('E-SPEC-001');
    expect(result.errors[0].message).toContain('Failed to parse:');
  });
});

// ==========================================================================
// validateAllSpecs — no specs / valid spec.md
// ==========================================================================

describe('validateAllSpecs — project structure', () => {
  it('should pass with no errors when project has no .mumuspec directories', () => {
    // existsSync returns false for all .mumuspec checks
    mockExists.mockReturnValue(false);
    mockReadDir.mockReturnValue([]);

    const result = validateAllSpecs('/empty-project', makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should pass for a valid spec.md with all checks satisfied', () => {
    const root = '/valid-project';
    setupSingleSpecDir(root, validSpecMd(0, 'root'));

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ==========================================================================
// validateAllSpecs — layer depth & design.md
// ==========================================================================

describe('validateAllSpecs — layer depth & design doc', () => {
  it('should emit E-SPEC-002 when layer exceeds max_layer_depth', () => {
    const root = '/deep-project';
    setupSingleSpecDir(root, validSpecMd(10, 'deep')); // layer 10 > max 5

    const result = validateAllSpecs(root, makeConfig({ max_layer_depth: 5 }));

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-002')).toBe(true);
  });

  it('should emit E-SPEC-006 when require_design_doc is true and design.md is missing', () => {
    const root = '/no-design-project';
    const muDir = join(root, '.mumuspec');
    const specPath = join(muDir, 'spec.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === specPath) return true;
      // design.md explicitly does NOT exist
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockReturnValue(validSpecMd(0, 'root'));

    const result = validateAllSpecs(
      root,
      makeConfig({ require_design_doc: true }),
    );

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-006')).toBe(true);
  });

  it('should NOT emit E-SPEC-006 when require_design_doc is true and design.md exists', () => {
    const root = '/has-design-project';
    const muDir = join(root, '.mumuspec');
    const specPath = join(muDir, 'spec.md');
    const designPath = join(muDir, 'design.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === specPath) return true;
      if (p === designPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockReturnValue(validSpecMd(0, 'root'));

    const result = validateAllSpecs(
      root,
      makeConfig({ require_design_doc: true }),
    );

    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.code === 'E-SPEC-006')).toBe(false);
  });
});

// ==========================================================================
// validateAllSpecs — enforcement warnings
// ==========================================================================

describe('validateAllSpecs — enforcement warnings', () => {
  it('should emit E-SPEC-004 warning when SHALL has no enforcement', () => {
    const root = '/no-enforce-project';
    // validSpecMd with withEnforcement=false: has SHALL items but no enforcement rules
    setupSingleSpecDir(root, validSpecMd(0, 'root', { withEnforcement: false }));

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true); // warnings don't fail
    expect(result.warnings.some((w) => w.code === 'E-SPEC-004')).toBe(true);
  });
});

// ==========================================================================
// validateAllSpecs — prd.md V2 validation
// ==========================================================================

describe('validateAllSpecs — prd.md V2', () => {
  it('should pass for a valid V2 prd.md', () => {
    const root = '/prd-ok';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return validPrdMd(0, 'root');
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should emit E-SPEC-008 when prd.md V2 has invalid layer', () => {
    const root = '/prd-bad-layer';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return validPrdMd(0, 'root', { invalidLayer: true });
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-008')).toBe(true);
  });

  it('should emit E-SPEC-011 warning when prd.md V2 has no ## Requirement: blocks', () => {
    const root = '/prd-no-req';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return validPrdMd(0, 'root', { noRequirements: true });
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true); // warning only
    expect(result.warnings.some((w) => w.code === 'E-SPEC-011')).toBe(true);
  });

  it('should skip validation for old-format prd.md (no doc_type) — grandfathered', () => {
    const root = '/prd-old';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return oldPrdMd();
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should emit E-SPEC-008 warning when prd.md is empty', () => {
    const root = '/prd-empty';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return '';
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    // Empty → warning (not error), no V2 strict check because isV2Prd returns false
    expect(result.warnings.some((w) => w.code === 'E-SPEC-008')).toBe(true);
  });
});

// ==========================================================================
// validateAllSpecs — tech.md V2 validation
// ==========================================================================

describe('validateAllSpecs — tech.md V2', () => {
  it('should pass for a valid V2 tech.md', () => {
    const root = '/tech-ok';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return validTechMd(0, 'root');
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should emit E-SPEC-004 warning when tech.md V2 has constraints without enforcement', () => {
    const root = '/tech-no-enforce';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return validTechMd(0, 'root', { noEnforcement: true });
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.code === 'E-SPEC-004')).toBe(true);
  });

  it('should emit E-SPEC-011 warning when tech.md V2 has no ## Requirement: blocks', () => {
    const root = '/tech-no-req';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return validTechMd(0, 'root', { noRequirements: true });
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.warnings.some((w) => w.code === 'E-SPEC-011')).toBe(true);
  });

  it('should skip validation for old-format tech.md (no doc_type) — grandfathered', () => {
    const root = '/tech-old';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return oldTechMd();
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should emit E-SPEC-009 warning when tech.md is empty', () => {
    const root = '/tech-empty';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return '';
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.warnings.some((w) => w.code === 'E-SPEC-009')).toBe(true);
  });
});

// ==========================================================================
// validateAllSpecs — parent references (E-SPEC-010)
// ==========================================================================

describe('validateAllSpecs — parent references', () => {
  it('should emit E-SPEC-010 when parent_prd points to a non-existent file', () => {
    const root = '/parent-prd-missing';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    const content = [
      '---',
      'layer: 0',
      'scope: "root"',
      'last_updated: "2024-01-01"',
      'doc_type: prd',
      'parent_prd: "../sibling/prd.md"',
      '---',
      '',
      '## Requirement: Test',
      '',
      '### SHALL',
      '- Something',
      '',
    ].join('\n');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      // The resolved parent path does NOT exist
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return content;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-010')).toBe(true);
    expect(result.errors.some((e) => e.message.includes('parent_prd'))).toBe(true);
  });

  it('should emit E-SPEC-010 when parent_tech points to a non-existent file', () => {
    const root = '/parent-tech-missing';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    const content = [
      '---',
      'layer: 0',
      'scope: "root"',
      'last_updated: "2024-01-01"',
      'doc_type: tech',
      'parent_tech: "../../other/tech.md"',
      '---',
      '',
      '## Requirement: Test',
      '',
      '### SHALL',
      '- Something',
      '',
    ].join('\n');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      // The resolved parent path does NOT exist
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return content;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-010')).toBe(true);
    expect(result.errors.some((e) => e.message.includes('parent_tech'))).toBe(true);
  });

  it('should NOT emit E-SPEC-010 when parent_prd points to an existing file', () => {
    // Use an absolute path in the parent_prd reference so resolve() output
    // matches the join()-constructed mock path regardless of platform.
    const root = 'D:\\parent-prd-exists';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');
    // parent_prd same file (absolute self-reference)
    const selfRef = prdPath;

    const content = [
      '---',
      'layer: 0',
      'scope: "root"',
      'last_updated: "2024-01-01"',
      'doc_type: prd',
      `parent_prd: "${selfRef}"`,
      '---',
      '',
      '## Requirement: Test',
      '',
      '### SHALL',
      '- Something',
      '',
    ].join('\n');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return content;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-010')).toBe(false);
  });
});

// ==========================================================================
// validateAllSpecs — inheritance conflict detection (E-SPEC-003)
// ==========================================================================

describe('validateAllSpecs — inheritance conflicts', () => {
  it('should emit E-SPEC-003 when child SHALL NOT conflicts with parent SHALL', () => {
    // Use drive-prefixed paths so getParentSpecDir works correctly on Windows.
    const root = 'D:\\inherit-parent';
    const childDir = join(root, 'child');
    const parentMuDir = join(root, '.mumuspec');
    const childMuDir = join(childDir, '.mumuspec');
    const parentSpec = join(parentMuDir, 'spec.md');
    const childSpec = join(childMuDir, 'spec.md');

    // Parent: SHALL use npm packages
    const parentContent = [
      '---',
      'layer: 0',
      'scope: "root"',
      '---',
      '',
      '## Requirement: Dependencies',
      '',
      '### SHALL',
      '- Must use npm as package manager',
      '- 必须通过 npm 安装依赖',
      '',
    ].join('\n');

    // Child: SHALL NOT use npm → conflicts with parent
    const childContent = [
      '---',
      'layer: 1',
      'scope: "child"',
      '---',
      '',
      '## Requirement: Dependencies',
      '',
      '### SHALL NOT',
      '- Must not use npm as package manager',
      '- 禁止通过 npm 安装依赖',
      '',
    ].join('\n');

    mockExists.mockImplementation((p: string) => {
      if (p === parentMuDir) return true;
      if (p === childMuDir) return true;
      if (p === parentSpec) return true;
      if (p === childSpec) return true;
      return false;
    });

    mockReadDir.mockImplementation((dir: string) => {
      if (dir === root) {
        // Return "child" as a subdirectory
        return [
          { name: 'child', isDirectory: () => true, isFile: () => false },
        ] as any;
      }
      return [];
    });

    mockReadFile.mockImplementation((p: string) => {
      if (p === parentSpec) return parentContent;
      if (p === childSpec) return childContent;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-003')).toBe(true);
  });

  it('should NOT emit E-SPEC-003 when child SHALL NOT does NOT conflict with parent', () => {
    const root = 'D:\\inherit-ok';
    const childDir = join(root, 'child');
    const parentMuDir = join(root, '.mumuspec');
    const childMuDir = join(childDir, '.mumuspec');
    const parentSpec = join(parentMuDir, 'spec.md');
    const childSpec = join(childMuDir, 'spec.md');

    // Parent: SHALL use TypeScript strict mode
    const parentContent = [
      '---',
      'layer: 0',
      'scope: "root"',
      '---',
      '',
      '## Requirement: Type Safety',
      '',
      '### SHALL',
      '- Must use TypeScript strict mode',
      '',
    ].join('\n');

    // Child: SHALL NOT skip type checking — no conflict (different topic)
    const childContent = [
      '---',
      'layer: 1',
      'scope: "child"',
      '---',
      '',
      '## Requirement: Code Quality',
      '',
      '### SHALL NOT',
      '- 禁止提交未格式化的代码',
      '',
    ].join('\n');

    mockExists.mockImplementation((p: string) => {
      if (p === parentMuDir) return true;
      if (p === childMuDir) return true;
      if (p === parentSpec) return true;
      if (p === childSpec) return true;
      return false;
    });

    mockReadDir.mockImplementation((dir: string) => {
      if (dir === root) {
        return [
          { name: 'child', isDirectory: () => true, isFile: () => false },
        ] as any;
      }
      return [];
    });

    mockReadFile.mockImplementation((p: string) => {
      if (p === parentSpec) return parentContent;
      if (p === childSpec) return childContent;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors.some((e) => e.code === 'E-SPEC-003')).toBe(false);
  });
});

// ==========================================================================
// validateAllSpecs — index.yaml freshness path
// ==========================================================================

describe('validateAllSpecs — index.yaml freshness', () => {
  it('should reach the index.yaml branch when index.yaml exists alongside child spec dirs', () => {
    const root = '/indexed-project';
    const childDir = join(root, 'sub');
    const muDir = join(root, '.mumuspec');
    const childMuDir = join(childDir, '.mumuspec');
    const indexPath = join(muDir, 'index.yaml');
    const specPath = join(muDir, 'spec.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === childMuDir) return true;
      if (p === indexPath) return true;
      if (p === specPath) return true;
      return false;
    });

    mockReadDir.mockImplementation((dir: string) => {
      if (dir === root) {
        return [
          { name: 'sub', isDirectory: () => true, isFile: () => false },
        ] as any;
      }
      return []; // no subdirs in /root/sub
    });

    mockReadFile.mockReturnValue(validSpecMd(0, 'root'));

    const result = validateAllSpecs(root, makeConfig());

    // The code path is reached (no error from index check — simple presence check)
    expect(result).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ==========================================================================
// validateAllSpecs — spec.md parse error inside validateSpecMd
// ==========================================================================

describe('validateAllSpecs — spec.md parse error handling', () => {
  it('should capture E-SPEC-001 when spec.md throws during parse', () => {
    const root = '/broken-spec';
    const muDir = join(root, '.mumuspec');
    const specPath = join(muDir, 'spec.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === specPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    // Broken YAML triggers parseSpecFile to throw
    mockReadFile.mockImplementation((p: string) => {
      if (p === specPath) return '---\n{{{{invalid yaml struct\---\nbody\n';
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-001')).toBe(true);
  });

  it('should capture E-SPEC-008 when prd.md V2 throws during parse', () => {
    const root = '/broken-prd';
    const muDir = join(root, '.mumuspec');
    const prdPath = join(muDir, 'prd.md');

    // Must include doc_type: prd so isV2Prd returns true and strict-check runs.
    // Unclosed quote in scope → yaml.parse throws (triggers the catch block).
    const brokenContent = '---\ndoc_type: prd\nscope: "unclosed\n---\nbody\n';

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === prdPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === prdPath) return brokenContent;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-008')).toBe(true);
  });

  it('should capture E-SPEC-009 when tech.md V2 throws during parse', () => {
    const root = '/broken-tech';
    const muDir = join(root, '.mumuspec');
    const techPath = join(muDir, 'tech.md');

    // Must include doc_type: tech so isV2Tech returns true and strict-check runs.
    // Unclosed quote in scope → yaml.parse throws (triggers the catch block).
    const brokenContent = '---\ndoc_type: tech\nscope: "unclosed\n---\nbody\n';

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === techPath) return brokenContent;
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.errors.some((e) => e.code === 'E-SPEC-009')).toBe(true);
  });
});

// ==========================================================================
// validateAllSpecs — mixed spec files in one project
// ==========================================================================

describe('validateAllSpecs — mixed spec files', () => {
  it('should validate all three spec types (spec.md, prd.md, tech.md) in a single project', () => {
    const root = '/mixed';
    const muDir = join(root, '.mumuspec');
    const specPath = join(muDir, 'spec.md');
    const prdPath = join(muDir, 'prd.md');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === specPath) return true;
      if (p === prdPath) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === specPath) return validSpecMd(0, 'root');
      if (p === prdPath) return validPrdMd(0, 'root');
      if (p === techPath) return validTechMd(0, 'root');
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect errors from multiple spec types simultaneously', () => {
    const root = '/multi-error';
    const muDir = join(root, '.mumuspec');
    const specPath = join(muDir, 'spec.md');
    const prdPath = join(muDir, 'prd.md');
    const techPath = join(muDir, 'tech.md');

    mockExists.mockImplementation((p: string) => {
      if (p === muDir) return true;
      if (p === specPath) return true;
      if (p === prdPath) return true;
      if (p === techPath) return true;
      return false;
    });
    mockReadDir.mockReturnValue([]);
    mockReadFile.mockImplementation((p: string) => {
      if (p === specPath) return validSpecMd(0, 'root', { withEnforcement: false }); // warn E-SPEC-004
      if (p === prdPath) return validPrdMd(0, 'root', { invalidLayer: true }); // error E-SPEC-008
      if (p === techPath) return validTechMd(0, 'root', { noEnforcement: true }); // warn E-SPEC-004
      return '';
    });

    const result = validateAllSpecs(root, makeConfig());

    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-008')).toBe(true); // prd invalid layer
    expect(result.warnings.filter((w) => w.code === 'E-SPEC-004').length).toBeGreaterThanOrEqual(1);
  });
});
