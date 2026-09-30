/**
 * TDD tests for Environment Init Integration
 * Tests the generateEnvKnowledgePage function integrated with init flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateEnvKnowledgePage } from '../src/core/init-generator';
import type { ProjectAnalysis } from '../src/core/project-analyzer';
import type { MumuSpecConfig } from '../src/core/config';

const TEST_ROOT = join(tmpdir(), 'mumuspec-env-init-test-' + Date.now());

const mockAnalysis: ProjectAnalysis = {
  projectType: 'cli',
  framework: 'none',
  language: 'typescript',
  hasTypeScript: true,
  hasTests: true,
  hasStorybook: false,
  hasTailwind: false,
  hasCssModules: false,
  hasScss: false,
  hasUiLibrary: false,
  packageName: 'test-project',
  sourceDirs: ['src'],
  entryPoints: ['src/cli.ts'],
  totalFiles: 10,
  frontendIndicators: [],
  backendIndicators: [],
};

const mockConfig: MumuSpecConfig = {
  version: '0.13.0',
  project: { name: 'test-project', language: 'typescript' },
  specs: { root: '.mumuspec', format: 'yaml+markdown', max_layer_depth: 5, auto_index: true, require_design_doc: true },
  knowledge: {
    enabled: true,
    code_graph: { enabled: false, auto_index_on_commit: false, languages: ['typescript'] },
    wiki: { dir: '.mumuspec/knowledge', auto_extract_on_archive: false, max_pages_per_scope: 20 },
    progressive_disclosure: { max_pages_per_layer: 5, load_stale_summary: true },
    freshness: { check_on_load: true, warn_after_days: 90, error_after_days: 180 },
    drift_detection: false,
  },
  enforcement: { engine: 'builtin', severity_levels: ['error', 'warn', 'info'], fail_on: 'error' },
  changes: {
    default_workflow: 'full',
    require_brainstorming: false,
    auto_transition: false,
    default_rollback_limit: 3,
    default_rebuild_limit: 5,
    default_build_mode: 'executing-plans',
    default_tdd_mode: 'tdd',
    single_active_change: true,
    default_isolation: 'worktree',
    allow_isolation_downgrade: true,
    implementation_strategy: 'bottom-up',
    design_strategy: 'top-down',
    tdd_mode: 'tdd',
    test_immutability: true,
  },
  workflow: {
    worktree_isolation: true,
    single_active_change: true,
    top_down_design: true,
    tdd_enforced: true,
    max_active_changes: 3,
  },
  constraint_strength: { technical_design: 'high', requirement_goals: 'high', exceptions: [], overrides: {} },
  ci: { pre_commit_check: 'shall-not', test_immutability_check: true, full_check_on_push: true, drift_detection_on_pr: true },
  ai: { generate_rules: true, mcp_server: true, rules_files: ['CLAUDE.md', '.cursorrules', 'AGENTS.md'] },
  skills: { enabled: true, discovery: 'auto', ecosystems: {}, dispatch: { required_skill_missing: 'block', shall_violation: 'block', shall_not_violation: 'block', skill_timeout: '300s', parallel_dispatch: false } },
  contracts: { enabled: false, external_dir: 'contracts/external', outbound_dir: 'contracts/outbound', schemas_dir: 'contracts/schemas', registry_file: 'contracts/_registry.yaml', auto_derive: false, drift_detection: false, compat_check_on_change: false, verify_on_build: false, verify_on_archive: false },
  ponytail: { enabled: true, auto_inject_to_root: true, comment_marker: 'ponytail:', strict_no_new_deps: true },
  cognitive_framework: { enabled: true, default_mode: 'full', max_rounds: 5, q3_per_round: 3, q2_per_round: 5, q4_min_dimensions: 3, hotfix_skip: true },
  design_docs: { enabled: true, required: true, auto_sync_on_design_phase: true, drift_detection: true, inheritance: true },
  docs: { enabled: false, output_dir: 'docs', generation: { auto_on_build: false, auto_on_archive: false, stale_detection: false, context_aggregation_depth: -1 }, types: {}, templates: { custom_dir: '.mumuspec/templates', fallback_to_builtin: true }, output: { default_format: 'markdown', formats: ['markdown'] }, consistency_check: { enabled: false, on_pr: false, auto_regen_on_drift: false, block_on_manual_edit: false } },
};

describe('ENV-INIT-001: generateEnvKnowledgePage', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_ROOT, '.mumuspec'), { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should generate env knowledge page for Node.js project', async () => {
    // Create a package.json to trigger node detection
    const pkgPath = join(TEST_ROOT, 'package.json');
    const { writeFileSync } = require('node:fs');
    writeFileSync(pkgPath, JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf8');

    const result = await generateEnvKnowledgePage(TEST_ROOT, mockConfig, mockAnalysis);
    expect(result).not.toBeNull();
    expect(result?.filePath).toContain('KP-ENV-001-environment-setup.md');
    expect(result?.content).toContain('Environment setup');
    expect(result?.content).toContain('Detected Tools');
  });

  it('should return null when no tool ecosystem detected', async () => {
    // No package.json or other config files
    const result = await generateEnvKnowledgePage(TEST_ROOT, mockConfig, mockAnalysis);
    // Should return null (only 'build' ecosystem detected by default)
    // Actually 'build' is always detected, so it depends on file presence
    // For an empty directory with no config files, should still return null
    expect(result).toBeNull();
  });

  it('should include detected tools in knowledge page', async () => {
    const pkgPath = join(TEST_ROOT, 'package.json');
    const { writeFileSync } = require('node:fs');
    writeFileSync(pkgPath, JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf8');

    const result = await generateEnvKnowledgePage(TEST_ROOT, mockConfig, mockAnalysis);
    expect(result?.content).toContain('| Tool');
    expect(result?.content).toContain('|------|');
    expect(result?.content).toContain('Prerequisites');
  });

  it('should generate valid knowledge page frontmatter', async () => {
    const pkgPath = join(TEST_ROOT, 'package.json');
    const { writeFileSync } = require('node:fs');
    writeFileSync(pkgPath, JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf8');

    const result = await generateEnvKnowledgePage(TEST_ROOT, mockConfig, mockAnalysis);
    expect(result?.content).toContain('id: "KP-ENV-001"');
    expect(result?.content).toContain('type: lesson');
    expect(result?.content).toContain('status: confirmed');
  });
});
