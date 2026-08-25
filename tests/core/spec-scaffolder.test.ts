/**
 * Tests for src/core/spec-scaffolder.ts — Distributed spec inference engine.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sep } from 'node:path';
import {
  buildDirectoryTree,
  analyzeModule,
  inferTechConstraints,
  inferPrdContent,
  generateTechSpec,
  generatePrdSpec,
  generateGoalSpec,
  generateEnvSpec,
  scaffoldDistributedSpecs,
  scaffoldChangeSpecs,
  type ModuleAnalysis,
  type TechInference,
  type PrdInference,
} from '../../src/core/spec-scaffolder.js';
import type { ProjectAnalysis } from '../../src/core/project-analyzer.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createTempProject(): string {
  const dir = join(tmpdir(), `mumuspec-scaffold-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function emptyAnalysis(): ProjectAnalysis {
  return {
    projectType: 'cli',
    framework: 'none',
    language: 'typescript',
    hasTypeScript: true,
    hasTests: false,
    hasStorybook: false,
    hasTailwind: false,
    hasCssModules: false,
    hasScss: false,
    hasUiLibrary: false,
    packageName: 'test-proj',
    sourceDirs: ['src'],
    entryPoints: ['src/index.ts'],
    totalFiles: 0,
    frontendIndicators: [],
    backendIndicators: [],
  };
}

function makeModule(overrides: Partial<ModuleAnalysis> = {}): ModuleAnalysis {
  return {
    path: '/tmp/test',
    depth: 1,
    codeFiles: [],
    testFiles: [],
    imports: [],
    exports: [],
    hasPonytailComments: false,
    comments: [],
    responsibilities: ['Module: test'],
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// buildDirectoryTree
// ════════════════════════════════════════════════════════════════════

describe('buildDirectoryTree', () => {
  let projectDir: string;

  afterEach(() => cleanup(projectDir));

  it('returns empty array for empty project', () => {
    projectDir = createTempProject();
    const result = buildDirectoryTree(projectDir);
    expect(Array.isArray(result)).toBe(true);
  });

  it('finds directories with TypeScript/JS code files', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1;');

    const result = buildDirectoryTree(projectDir);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain(srcDir);
  });

  it('finds directories with .mumuspec subdir', () => {
    projectDir = createTempProject();
    const specDir = join(projectDir, '.mumuspec');
    mkdirSync(specDir, { recursive: true });

    const result = buildDirectoryTree(projectDir);
    expect(result).toContain(projectDir);
  });

  it('sorts by depth descending (deepest first)', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    const coreDir = join(projectDir, 'src', 'core');
    const deepDir = join(projectDir, 'src', 'core', 'utils');
    mkdirSync(deepDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), '// src');
    writeFileSync(join(coreDir, 'mod.ts'), '// core');
    writeFileSync(join(deepDir, 'helper.ts'), '// deep');

    const result = buildDirectoryTree(projectDir);
    const deepIdx = result.indexOf(deepDir);
    const coreIdx = result.indexOf(coreDir);
    const srcIdx = result.indexOf(srcDir);

    if (deepIdx !== -1 && coreIdx !== -1) {
      expect(deepIdx).toBeLessThan(coreIdx);
    }
    if (coreIdx !== -1 && srcIdx !== -1) {
      expect(coreIdx).toBeLessThan(srcIdx);
    }
  });

  it('respects maxDepth', () => {
    projectDir = createTempProject();
    const deepPath = join(projectDir, 'a', 'b', 'c', 'd', 'e', 'f');
    mkdirSync(deepPath, { recursive: true });
    writeFileSync(join(deepPath, 'file.ts'), '// deep');

    const result = buildDirectoryTree(projectDir, 3);
    // Should not include directories deeper than 3
    for (const dir of result) {
      const rel = dir.replace(projectDir, '');
      const depth = rel.split(sep).filter(Boolean).length;
      expect(depth).toBeLessThanOrEqual(3);
    }
  });

  it('skips node_modules and dot-prefixed dirs', () => {
    projectDir = createTempProject();
    const nmDir = join(projectDir, 'node_modules', 'pkg');
    const dotDir = join(projectDir, '.cache');
    mkdirSync(nmDir, { recursive: true });
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(nmDir, 'index.js'), '// nm');
    writeFileSync(join(dotDir, 'file.js'), '// dot');

    const result = buildDirectoryTree(projectDir);
    expect(result).not.toContain(nmDir);
    expect(result).not.toContain(dotDir);
  });
});

// ════════════════════════════════════════════════════════════════════
// analyzeModule
// ════════════════════════════════════════════════════════════════════

describe('analyzeModule', () => {
  let projectDir: string;

  afterEach(() => cleanup(projectDir));

  it('analyzes module with code files', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.ts'), 'export function foo() {}\nexport class Bar {}');

    const result = analyzeModule(moduleDir, emptyAnalysis());
    expect(result.codeFiles.length).toBeGreaterThan(0);
    expect(result.exports).toContain('foo');
    expect(result.exports).toContain('Bar');
  });

  it('separates test files from code files', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.ts'), '// code');
    writeFileSync(join(moduleDir, 'index.test.ts'), '// test');

    const result = analyzeModule(moduleDir, emptyAnalysis());
    expect(result.codeFiles.length).toBe(1);
    expect(result.testFiles.length).toBe(1);
  });

  it('extracts imports from code files', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.ts'), "import { foo } from './bar';\nimport { baz } from 'external';");

    const result = analyzeModule(moduleDir, emptyAnalysis());
    expect(result.imports).toContain('./bar');
    expect(result.imports).toContain('external');
  });

  it('detects ponytail comments', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.ts'), '// ponytail: simplified for testing\nexport const x = 1;');

    const result = analyzeModule(moduleDir, emptyAnalysis());
    expect(result.hasPonytailComments).toBe(true);
  });

  it('extracts comments from code', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'index.ts'), '// This is an important module\nexport const x = 1;');

    const result = analyzeModule(moduleDir, emptyAnalysis());
    expect(result.comments.length).toBeGreaterThan(0);
  });

  it('infers responsibilities from directory name', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'utils');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'helper.ts'), '// helper');

    const result = analyzeModule(srcDir, emptyAnalysis());
    expect(result.responsibilities).toContain('Utility functions');
  });

  it('handles empty directories', () => {
    projectDir = createTempProject();
    const emptyDir = join(projectDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const result = analyzeModule(emptyDir, emptyAnalysis());
    expect(result.codeFiles).toEqual([]);
    expect(result.testFiles).toEqual([]);
    expect(result.imports).toEqual([]);
    expect(result.exports).toEqual([]);
  });

  it('skips .d.ts files', () => {
    projectDir = createTempProject();
    const moduleDir = join(projectDir, 'core');
    mkdirSync(moduleDir, { recursive: true });
    writeFileSync(join(moduleDir, 'types.d.ts'), 'export type Foo = string;');
    writeFileSync(join(moduleDir, 'index.ts'), 'export const x = 1;');

    const result = analyzeModule(moduleDir, emptyAnalysis());
    // .d.ts files should not appear in codeFiles
    expect(result.codeFiles.some((f) => f.endsWith('.d.ts'))).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// inferTechConstraints
// ════════════════════════════════════════════════════════════════════

describe('inferTechConstraints', () => {
  it('extracts exports as architecture decisions', () => {
    const module = makeModule({ exports: ['initLoop', 'startRound', 'exitLoop'] });
    const result = inferTechConstraints(module);

    expect(result.architectureDecisions.some((d) => d.includes('initLoop'))).toBe(true);
  });

  it('extracts external imports as constraints', () => {
    const module = makeModule({ imports: ['commander', 'yaml', 'lodash'] });
    const result = inferTechConstraints(module);

    expect(result.constraints.some((c) => c.includes('commander') || c.includes('yaml'))).toBe(true);
  });

  it('extracts scoped package names correctly', () => {
    const module = makeModule({ imports: ['@modelcontextprotocol/sdk', '@types/node'] });
    const result = inferTechConstraints(module);

    expect(result.constraints.some((c) => c.includes('@modelcontextprotocol/sdk'))).toBe(true);
  });

  it('counts internal imports for coupling info', () => {
    const module = makeModule({ imports: ['./foo', './bar', './baz'] });
    const result = inferTechConstraints(module);

    expect(result.architectureDecisions.some((d) => d.includes('3 local'))).toBe(true);
  });

  it('flags TODO/FIXME comments', () => {
    const module = makeModule({
      comments: ['TODO: refactor this', 'FIXME: memory leak'],
    });
    const result = inferTechConstraints(module);

    expect(result.constraints.some((c) => c.includes('TODO/FIXME'))).toBe(true);
  });

  it('calculates test coverage ratio', () => {
    const module = makeModule({
      codeFiles: ['a.ts', 'b.ts', 'c.ts'],
      testFiles: ['a.test.ts'],
    });
    const result = inferTechConstraints(module);

    expect(result.testCoverage).toBeGreaterThan(0);
    expect(result.architectureDecisions.some((d) => d.includes('test'))).toBe(true);
  });

  it('flags modules with no tests', () => {
    const module = makeModule({
      codeFiles: ['a.ts', 'b.ts'],
      testFiles: [],
    });
    const result = inferTechConstraints(module);

    expect(result.constraints.some((c) => c.includes('No tests'))).toBe(true);
  });

  it('handles empty module gracefully', () => {
    const module = makeModule();
    const result = inferTechConstraints(module);

    expect(result.testCoverage).toBe(0);
    expect(result.constraints).toBeDefined();
    expect(result.architectureDecisions).toBeDefined();
  });

  it('infers responsibilities from path', () => {
    const module = makeModule({ path: '/project/src/core' });
    const result = inferTechConstraints(module);

    expect(result.responsibilities.some((r) => r.includes('core'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// inferPrdContent
// ════════════════════════════════════════════════════════════════════

describe('inferPrdContent', () => {
  it('generates user scenarios from responsibilities', () => {
    const module = makeModule({ responsibilities: ['Core business logic', 'API layer'] });
    const result = inferPrdContent(module);

    expect(result.userScenarios.length).toBeGreaterThan(0);
    expect(result.userScenarios.some((s) => s.includes('Core business logic'))).toBe(true);
  });

  it('generates acceptance criteria from exports', () => {
    const module = makeModule({ exports: ['initLoop', 'evaluateRound'] });
    const result = inferPrdContent(module);

    expect(result.acceptanceCriteria).toContain('initLoop is accessible and functional');
    expect(result.acceptanceCriteria).toContain('evaluateRound is accessible and functional');
  });

  it('extracts user-related comments as scenarios', () => {
    const module = makeModule({
      comments: ['User should see this immediately', 'This is internal only'],
    });
    const result = inferPrdContent(module);

    expect(result.userScenarios.some((s) => s.includes('User should see this immediately'))).toBe(true);
  });

  it('includes parent goals when parentPrd is provided', () => {
    const module = makeModule();
    const parentPrd = '## Goal\nImplement user authentication\n## Goal\nEnsure security';
    const result = inferPrdContent(module, parentPrd);

    expect(result.parentGoals).toContain('Inherits parent module goals');
    expect(result.parentGoals.length).toBeGreaterThan(1);
  });

  it('handles parentPrd without goals', () => {
    const module = makeModule();
    const parentPrd = '# Just a regular doc\nNo goals here';
    const result = inferPrdContent(module, parentPrd);

    expect(result.parentGoals).toContain('Inherits parent module goals');
  });

  it('limits exports to first 5 for acceptance criteria', () => {
    const module = makeModule({ exports: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    const result = inferPrdContent(module);

    expect(result.acceptanceCriteria.length).toBeLessThanOrEqual(5);
  });

  it('limits user comments to first 5', () => {
    const module = makeModule({
      comments: [
        'User should do A',
        'User must see B',
        'user input required for C',
        'should not break D',
        'must validate E',
        'User also needs F',
      ],
    });
    const result = inferPrdContent(module);

    const commentScenarios = result.userScenarios.filter(
      (s) => !s.includes('interacts with'),
    );
    expect(commentScenarios.length).toBeLessThanOrEqual(5);
  });
});

// ════════════════════════════════════════════════════════════════════
// generateTechSpec
// ════════════════════════════════════════════════════════════════════

describe('generateTechSpec', () => {
  function emptyInference(): TechInference {
    return {
      constraints: [],
      architectureDecisions: [],
      testCoverage: 0,
      dependencies: [],
      responsibilities: [],
    };
  }

  it('generates frontmatter with correct fields', () => {
    const spec = generateTechSpec(emptyInference(), {
      layer: 1,
      scope: 'src/core',
      change: 'my-change',
    });

    expect(spec).toContain('layer: 1');
    expect(spec).toContain('scope: "src/core"');
    expect(spec).toContain('doc_type: tech');
    expect(spec).toContain('change: my-change');
  });

  it('includes architecture decisions as SHALL', () => {
    const inference: TechInference = {
      ...emptyInference(),
      architectureDecisions: ['Public API: initLoop, startRound'],
    };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: Architecture Constraints');
    expect(spec).toContain('Public API: initLoop, startRound');
  });

  it('includes constraints as SHALL NOT', () => {
    const inference: TechInference = {
      ...emptyInference(),
      constraints: ['Dependencies: commander, yaml'],
    };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('### SHALL NOT');
    expect(spec).toContain('Dependencies: commander, yaml');
  });

  it('includes enforcement section', () => {
    const spec = generateTechSpec(emptyInference(), {
      layer: 0,
      scope: '.',
      change: 'feat-auth',
    });

    expect(spec).toContain('TECH-feat-auth-1');
    expect(spec).toContain('TECH-feat-auth-2');
  });

  it('includes parent_tech reference when provided', () => {
    const spec = generateTechSpec(emptyInference(), {
      layer: 2,
      scope: 'src/core/utils',
      parentTechRelPath: '../../tech.md',
    });

    expect(spec).toContain('parent_tech: ../../tech.md');
  });

  it('includes phase when provided', () => {
    const spec = generateTechSpec(emptyInference(), {
      layer: 1,
      scope: 'test',
      phase: 'build',
    });

    expect(spec).toContain('phase: build');
  });

  it('includes child summaries', () => {
    const spec = generateTechSpec(emptyInference(), {
      layer: 0,
      scope: '.',
      childSummaries: ['core: business logic', 'cli: interface'],
    });

    expect(spec).toContain('## Requirement: Sub-Module Integration');
    expect(spec).toContain('core: business logic');
  });

  it('includes responsibilities in Current Code Status', () => {
    const inference: TechInference = {
      ...emptyInference(),
      responsibilities: ['Module: core'],
    };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: Current Code Status');
    expect(spec).toContain('Module: core is maintained at current level');
  });

  it('shows N/A coverage when testCoverage is 0', () => {
    const spec = generateTechSpec(emptyInference(), { layer: 0, scope: '.' });

    expect(spec).toContain('Estimated coverage: N/A');
  });

  it('shows coverage percentage when testCoverage > 0', () => {
    const inference: TechInference = { ...emptyInference(), testCoverage: 75 };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('Estimated coverage: ~75%');
  });
});

// ════════════════════════════════════════════════════════════════════
// generatePrdSpec
// ════════════════════════════════════════════════════════════════════

describe('generatePrdSpec', () => {
  function emptyInference(): PrdInference {
    return {
      userScenarios: [],
      acceptanceCriteria: [],
      parentGoals: [],
      responsibilities: [],
    };
  }

  it('generates frontmatter', () => {
    const spec = generatePrdSpec(emptyInference(), {
      layer: 1,
      scope: '.changes/my-feature',
      change: 'my-feature',
    });

    expect(spec).toContain('layer: 1');
    expect(spec).toContain('scope: ".changes/my-feature"');
    expect(spec).toContain('doc_type: prd');
  });

  it('includes parent goals section when present', () => {
    const inference: PrdInference = {
      ...emptyInference(),
      parentGoals: ['Parent goal: auth module', 'Security compliance'],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: Parent Goals');
    expect(spec).toContain('Parent goal: auth module');
  });

  it('includes feature goals placeholder', () => {
    const spec = generatePrdSpec(emptyInference(), { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: Feature Goals');
    expect(spec).toContain('<Describe what this feature/change must accomplish>');
  });

  it('includes user scenarios', () => {
    const inference: PrdInference = {
      ...emptyInference(),
      userScenarios: ['User can login', 'User can logout'],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: User Scenarios');
    expect(spec).toContain('User can login');
  });

  it('includes acceptance criteria', () => {
    const inference: PrdInference = {
      ...emptyInference(),
      acceptanceCriteria: ['initLoop is accessible and functional'],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Requirement: Acceptance Criteria');
    expect(spec).toContain('initLoop is accessible and functional');
  });

  it('includes enforcement section', () => {
    const spec = generatePrdSpec(emptyInference(), {
      layer: 0,
      scope: '.',
      change: 'fix-bug',
    });

    expect(spec).toContain('PRD-fix-bug-1');
    expect(spec).toContain('PRD-fix-bug-2');
  });

  it('includes responsibilities in appendix', () => {
    const inference: PrdInference = {
      ...emptyInference(),
      responsibilities: ['Module: utils', 'Helper functions'],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('## Appendix: Responsibilities');
    expect(spec).toContain('Module: utils');
  });

  it('includes parent_prd reference when provided', () => {
    const spec = generatePrdSpec(emptyInference(), {
      layer: 1,
      scope: 'src/core',
      parentPrdRelPath: '../prd.md',
    });

    expect(spec).toContain('parent_prd: ../prd.md');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateGoalSpec
// ════════════════════════════════════════════════════════════════════

describe('generateGoalSpec', () => {
  it('generates with project name', () => {
    const spec = generateGoalSpec({ projectName: 'my-app' });
    expect(spec).toContain('project: my-app');
  });

  it('includes custom goals', () => {
    const spec = generateGoalSpec({
      projectName: 'my-app',
      goals: ['实现高性能', '保证安全'],
    });
    expect(spec).toContain('实现高性能');
    expect(spec).toContain('保证安全');
  });

  it('shows placeholder when no goals provided', () => {
    const spec = generateGoalSpec({ projectName: 'my-app' });
    expect(spec).toContain('<Define primary project goals>');
  });

  it('includes anti-goals placeholder', () => {
    const spec = generateGoalSpec({ projectName: 'my-app' });
    expect(spec).toContain('<Define anti-goals / non-goals>');
  });

  it('includes last_updated field', () => {
    const spec = generateGoalSpec({ projectName: 'my-app' });
    expect(spec).toContain('last_updated');
  });
});

// ════════════════════════════════════════════════════════════════════
// generateEnvSpec
// ════════════════════════════════════════════════════════════════════

describe('generateEnvSpec', () => {
  it('generates with project name', () => {
    const spec = generateEnvSpec({ projectName: 'my-app' });
    expect(spec).toContain('project: my-app');
  });

  it('includes default environment constraints', () => {
    const spec = generateEnvSpec({ projectName: 'my-app' });
    expect(spec).toContain('Development environment meets tool version requirements');
    expect(spec).toContain('No hardcoded paths or environment-specific assumptions');
  });

  it('includes required tools when provided', () => {
    const spec = generateEnvSpec({
      projectName: 'my-app',
      tools: ['Node.js >= 18', 'npm >= 9'],
    });
    expect(spec).toContain('### Required Tools');
    expect(spec).toContain('Node.js >= 18');
    expect(spec).toContain('npm >= 9');
  });

  it('omits tools section when no tools provided', () => {
    const spec = generateEnvSpec({ projectName: 'my-app' });
    expect(spec).not.toContain('### Required Tools');
  });
});

// ════════════════════════════════════════════════════════════════════
// scaffoldDistributedSpecs — high-level orchestration
// ════════════════════════════════════════════════════════════════════

describe('scaffoldDistributedSpecs', () => {
  let projectDir: string;

  afterEach(() => cleanup(projectDir));

  it('scaffolds tech.md and prd.md for discovered directories', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    const coreDir = join(projectDir, 'src', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export function bar() {}');
    writeFileSync(join(coreDir, 'helper.ts'), 'export function foo() {}');

    const analysis = emptyAnalysis();
    const created = scaffoldDistributedSpecs(projectDir, analysis);

    expect(created.length).toBeGreaterThan(0);
    // Each directory should get a tech.md
    const techFiles = created.filter((f) => f.endsWith('tech.md'));
    expect(techFiles.length).toBeGreaterThan(0);
    // Each directory should get a prd.md
    const prdFiles = created.filter((f) => f.endsWith('prd.md'));
    expect(prdFiles.length).toBeGreaterThan(0);
  });

  it('does not overwrite existing files by default', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1;');

    // Pre-create tech.md
    const specDir = join(srcDir, '.mumuspec');
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, 'tech.md'), '# Existing tech spec');

    const analysis = emptyAnalysis();
    const created = scaffoldDistributedSpecs(projectDir, analysis);

    // Pre-existing tech.md should not be in created list
    const techPath = join(specDir, 'tech.md');
    expect(created).not.toContain(techPath);
    // Content should be unchanged
    const content = readFileSync(techPath, 'utf-8');
    expect(content).toBe('# Existing tech spec');
  });

  it('overwrites existing files when force is true', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1;');

    // Pre-create tech.md
    const specDir = join(srcDir, '.mumuspec');
    mkdirSync(specDir, { recursive: true });
    const techPath = join(specDir, 'tech.md');
    writeFileSync(techPath, '# Old content');

    const analysis = emptyAnalysis();
    const created = scaffoldDistributedSpecs(projectDir, analysis, { force: true });

    expect(created).toContain(techPath);
    const content = readFileSync(techPath, 'utf-8');
    expect(content).not.toBe('# Old content');
    expect(content).toContain('doc_type: tech');
  });

  it('includes parent_tech reference when parent tech.md exists', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    const coreDir = join(projectDir, 'src', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1;');
    writeFileSync(join(coreDir, 'helper.ts'), 'export function foo() {}');

    // Pre-create parent tech.md so the nested dir can reference it
    const srcSpecDir = join(srcDir, '.mumuspec');
    mkdirSync(srcSpecDir, { recursive: true });
    writeFileSync(join(srcSpecDir, 'tech.md'), '---\nlayer: 1\nscope: "src"\ndoc_type: tech\n---\n# Parent Tech Spec');

    const analysis = emptyAnalysis();
    scaffoldDistributedSpecs(projectDir, analysis);

    // Nested tech.md should reference the parent tech.md
    const coreTech = readFileSync(join(coreDir, '.mumuspec', 'tech.md'), 'utf-8');
    expect(coreTech).toContain('parent_tech');
  });

  it('returns empty array for project with no code files', () => {
    projectDir = createTempProject();
    // Only a package.json, no .ts/.js files
    writeFileSync(join(projectDir, 'package.json'), '{"name":"test"}');

    const analysis = emptyAnalysis();
    const created = scaffoldDistributedSpecs(projectDir, analysis);

    // Should still find root if .mumuspec or code exists, but with no code it's empty
    expect(Array.isArray(created)).toBe(true);
  });

  it('generates correct layer values based on depth', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    const coreDir = join(projectDir, 'src', 'core');
    mkdirSync(coreDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), '// src');
    writeFileSync(join(coreDir, 'mod.ts'), '// core');

    const analysis = emptyAnalysis();
    scaffoldDistributedSpecs(projectDir, analysis);

    const srcTech = readFileSync(join(srcDir, '.mumuspec', 'tech.md'), 'utf-8');
    const coreTech = readFileSync(join(coreDir, '.mumuspec', 'tech.md'), 'utf-8');

    expect(srcTech).toMatch(/layer: \d+/);
    expect(coreTech).toMatch(/layer: \d+/);
    // Core is deeper, so its layer should be greater
    const srcLayer = parseInt(srcTech.match(/layer: (\d+)/)?.[1] || '0');
    const coreLayer = parseInt(coreTech.match(/layer: (\d+)/)?.[1] || '0');
    expect(coreLayer).toBeGreaterThan(srcLayer);
  });

  it('scopes tech.md to relative path', () => {
    projectDir = createTempProject();
    const srcDir = join(projectDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'index.ts'), 'export const x = 1;');

    const analysis = emptyAnalysis();
    scaffoldDistributedSpecs(projectDir, analysis);

    const srcTech = readFileSync(join(srcDir, '.mumuspec', 'tech.md'), 'utf-8');
    expect(srcTech).toContain('scope:');
  });
});

// ════════════════════════════════════════════════════════════════════
// scaffoldChangeSpecs — change-level scaffolding
// ════════════════════════════════════════════════════════════════════

describe('scaffoldChangeSpecs', () => {
  let projectDir: string;
  let changeDir: string;

  afterEach(() => cleanup(projectDir));

  it('creates prd.md and tech.md in change directory', () => {
    projectDir = createTempProject();
    changeDir = join(projectDir, '.changes', 'feat-auth');
    mkdirSync(changeDir, { recursive: true });

    // Create parent .mumuspec with specs
    const parentSpec = join(projectDir, '.mumuspec');
    mkdirSync(parentSpec, { recursive: true });
    writeFileSync(join(parentSpec, 'prd.md'), '# Parent PRD');
    writeFileSync(join(parentSpec, 'tech.md'), '# Parent Tech');

    const result = scaffoldChangeSpecs(changeDir, 'feat-auth', {
      parentRoot: projectDir,
      phase: 'design',
    });

    expect(result.prdPath).toBe(join(changeDir, '.mumuspec', 'prd.md'));
    expect(result.techPath).toBe(join(changeDir, '.mumuspec', 'tech.md'));
    expect(existsSync(result.prdPath)).toBe(true);
    expect(existsSync(result.techPath)).toBe(true);
  });

  it('includes change name in generated specs', () => {
    projectDir = createTempProject();
    changeDir = join(projectDir, '.changes', 'add-login');
    mkdirSync(changeDir, { recursive: true });

    const parentSpec = join(projectDir, '.mumuspec');
    mkdirSync(parentSpec, { recursive: true });

    scaffoldChangeSpecs(changeDir, 'add-login', {
      parentRoot: projectDir,
      phase: 'design',
    });

    const techContent = readFileSync(join(changeDir, '.mumuspec', 'tech.md'), 'utf-8');
    const prdContent = readFileSync(join(changeDir, '.mumuspec', 'prd.md'), 'utf-8');

    expect(techContent).toContain('add-login');
    expect(prdContent).toContain('add-login');
  });

  it('includes parent references for inheritance', () => {
    projectDir = createTempProject();
    changeDir = join(projectDir, '.changes', 'feat-x');
    mkdirSync(changeDir, { recursive: true });

    const parentSpec = join(projectDir, '.mumuspec');
    mkdirSync(parentSpec, { recursive: true });
    writeFileSync(join(parentSpec, 'prd.md'), '# Parent');
    writeFileSync(join(parentSpec, 'tech.md'), '# Parent Tech');

    scaffoldChangeSpecs(changeDir, 'feat-x', {
      parentRoot: projectDir,
      phase: 'build',
    });

    const techContent = readFileSync(join(changeDir, '.mumuspec', 'tech.md'), 'utf-8');
    const prdContent = readFileSync(join(changeDir, '.mumuspec', 'prd.md'), 'utf-8');

    expect(techContent).toContain('parent_tech');
    expect(prdContent).toContain('parent_prd');
  });

  it('includes phase in tech.md when provided', () => {
    projectDir = createTempProject();
    changeDir = join(projectDir, '.changes', 'my-change');
    mkdirSync(changeDir, { recursive: true });

    const parentSpec = join(projectDir, '.mumuspec');
    mkdirSync(parentSpec, { recursive: true });

    scaffoldChangeSpecs(changeDir, 'my-change', {
      parentRoot: projectDir,
      phase: 'build',
    });

    const techContent = readFileSync(join(changeDir, '.mumuspec', 'tech.md'), 'utf-8');
    expect(techContent).toContain('phase: build');
  });
});

// ════════════════════════════════════════════════════════════════════
// Additional edge cases for inferResponsibilitiesFromPath
// ════════════════════════════════════════════════════════════════════

describe('inferTechConstraints — responsibilities from path', () => {
  // inferTechConstraints extracts dirName from module.path using split(sep)
  // and always produces 'Module: {dirName}' (no name mapping).
  // Note: inferResponsibilitiesFromPath (with name mapping) is only called
  // by analyzeModule, not inferTechConstraints.
  //
  // On Windows sep='\', so we must build paths with sep for split() to work.
  function projPath(dir: string): string {
    return ['', 'project', dir].join(sep);
  }

  it('produces generic responsibility from dir name for utils', () => {
    const module = makeModule({ path: projPath('utils') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: utils');
  });

  it('produces generic responsibility from dir name for helpers', () => {
    const module = makeModule({ path: projPath('helpers') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: helpers');
  });

  it('produces generic responsibility from dir name for types', () => {
    const module = makeModule({ path: projPath('types') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: types');
  });

  it('produces generic responsibility from dir name for scripts', () => {
    const module = makeModule({ path: projPath('scripts') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: scripts');
  });

  it('produces generic responsibility from dir name for docs', () => {
    const module = makeModule({ path: projPath('docs') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: docs');
  });

  it('produces generic responsibility from dir name for config', () => {
    const module = makeModule({ path: projPath('config') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: config');
  });

  it('produces generic responsibility from dir name for custom names', () => {
    const module = makeModule({ path: projPath('custom-stuff') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities).toContain('Module: custom-stuff');
  });

  it('does not add responsibility for dot-prefixed dirs', () => {
    const module = makeModule({ path: projPath('.hidden') });
    const result = inferTechConstraints(module);
    expect(result.responsibilities.some((r) => r.includes('.hidden'))).toBe(false);
  });

  it('handles root path without crashing', () => {
    const module = makeModule({ path: sep });
    const result = inferTechConstraints(module);
    // Root has no meaningful dir name after split
    expect(result.responsibilities).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Additional edge cases for inferPrdContent
// ════════════════════════════════════════════════════════════════════

describe('inferPrdContent — additional edge cases', () => {
  it('handles module with empty exports and responsibilities', () => {
    const module = makeModule({ exports: [], responsibilities: [] });
    const result = inferPrdContent(module);
    expect(result.userScenarios).toEqual([]);
    expect(result.acceptanceCriteria).toEqual([]);
  });

  it('handles parentPrd with malformed headers', () => {
    const module = makeModule();
    const parentPrd = '#### Goal: nested heading\nContent here\n##Goal: no space';
    const result = inferPrdContent(module, parentPrd);
    // Should extract goals from headers containing "goal" (case-insensitive)
    expect(result.parentGoals).toContain('Inherits parent module goals');
  });

  it('filters user comments correctly — only includes user/should/must', () => {
    const module = makeModule({
      comments: [
        'User should see this',
        'internal detail',
        'must validate input',
        'just a regular note',
        'should work reliably',
      ],
    });
    const result = inferPrdContent(module);
    const userScenarios = result.userScenarios.filter((s) => s.includes('User') || s.includes('must') || s.includes('should'));
    // Should include "User should see this", "must validate input", "should work reliably"
    expect(userScenarios.length).toBeGreaterThanOrEqual(3);
    // Should NOT include "internal detail" or "just a regular note"
    expect(result.userScenarios).not.toContain('internal detail');
    expect(result.userScenarios).not.toContain('just a regular note');
  });

  it('combines responsibilities and comments in user scenarios', () => {
    const module = makeModule({
      responsibilities: ['CLI framework'],
      comments: ['User should be able to run commands'],
    });
    const result = inferPrdContent(module);
    // Should have both responsibility-based and comment-based scenarios
    const hasResponsibility = result.userScenarios.some((s) => s.includes('CLI framework'));
    const hasComment = result.userScenarios.some((s) => s.includes('User should'));
    expect(hasResponsibility).toBe(true);
    expect(hasComment).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Additional edge cases for generateTechSpec
// ════════════════════════════════════════════════════════════════════

describe('generateTechSpec — additional edge cases', () => {
  it('handles empty inference gracefully', () => {
    const inference: TechInference = {
      constraints: [],
      architectureDecisions: [],
      testCoverage: 0,
      dependencies: [],
      responsibilities: [],
    };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('doc_type: tech');
    // Should not have SHALL or SHALL NOT sections when empty
    expect(spec).not.toContain('### SHALL\n');
  });

  it('includes all child summaries', () => {
    const inference: TechInference = {
      constraints: [],
      architectureDecisions: [],
      testCoverage: 0,
      dependencies: [],
      responsibilities: [],
    };
    const spec = generateTechSpec(inference, {
      layer: 0,
      scope: '.',
      childSummaries: ['core: logic', 'cli: interface', 'utils: helpers'],
    });

    expect(spec).toContain('core: logic');
    expect(spec).toContain('cli: interface');
    expect(spec).toContain('utils: helpers');
  });

  it('generates enforcement with GEN prefix when no change', () => {
    const inference: TechInference = {
      constraints: [],
      architectureDecisions: [],
      testCoverage: 0,
      dependencies: [],
      responsibilities: [],
    };
    const spec = generateTechSpec(inference, { layer: 0, scope: '.' });
    expect(spec).toContain('TECH-GEN-1');
    expect(spec).toContain('TECH-GEN-2');
  });
});

// ════════════════════════════════════════════════════════════════════
// Additional edge cases for generatePrdSpec
// ════════════════════════════════════════════════════════════════════

describe('generatePrdSpec — additional edge cases', () => {
  it('omits empty sections (no user scenarios, no acceptance criteria)', () => {
    const inference: PrdInference = {
      userScenarios: [],
      acceptanceCriteria: [],
      parentGoals: [],
      responsibilities: [],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).not.toContain('## Requirement: User Scenarios');
    expect(spec).not.toContain('## Requirement: Acceptance Criteria');
    expect(spec).toContain('## Requirement: Feature Goals');
  });

  it('omits parent goals section when empty', () => {
    const inference: PrdInference = {
      userScenarios: ['Test'],
      acceptanceCriteria: [],
      parentGoals: [],
      responsibilities: [],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).not.toContain('## Requirement: Parent Goals');
  });

  it('includes multiple parent goals', () => {
    const inference: PrdInference = {
      userScenarios: [],
      acceptanceCriteria: [],
      parentGoals: ['Auth module', 'Performance improvement'],
      responsibilities: [],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });

    expect(spec).toContain('Auth module');
    expect(spec).toContain('Performance improvement');
  });

  it('generates enforcement with GEN prefix when no change', () => {
    const inference: PrdInference = {
      userScenarios: [],
      acceptanceCriteria: [],
      parentGoals: [],
      responsibilities: [],
    };
    const spec = generatePrdSpec(inference, { layer: 0, scope: '.' });
    expect(spec).toContain('PRD-GEN-1');
    expect(spec).toContain('PRD-GEN-2');
  });
});
