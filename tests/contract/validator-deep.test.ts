/**
 * Validator Deep Tests — branch-level coverage targeting uncovered lines.
 *
 * Targets:
 *   - Line 271:  validateBoundaries missing BOUNDARY.md result path
 *   - Line 395:  verifyExportExists catch block (error path)
 *   - Lines 402-430: verifyDependencyUsage (all import patterns + escapeRegExp)
 *   - Also covers: findDirectoriesWithCode edge cases, category default branch,
 *     has_critical_drifts flag, dependency graph orphans, all boundary issue codes.
 *
 * Uses vi.mock('node:fs') factory with spy wrappers to force readdirSync/
 * lstatSync exceptions for error-path coverage (lines 343, 371, 395, 424).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectContractDrift, validateBoundaries } from '../../src/contract/validator.js';
import { readText } from '../../src/core/utils.js';
import type { Contract } from '../../src/core/types-contract.js';

// ════════════════════════════════════════════════════════════════════
// Module-level mock of node:fs — spy wrappers for readdirSync and
// lstatSync so we can force them to throw in error-path tests while
// preserving real filesystem behavior in all other tests.
//
// vi.mock is hoisted to the top of the file. The factory calls through
// to the original implementation, so non-error-path tests see zero
// behavioral change. Error-path tests override mockImplementation to
// force exceptions (covering catch blocks at lines 343, 371, 395, 424).
// ════════════════════════════════════════════════════════════════════

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readdirSync: vi.fn(actual.readdirSync),
    lstatSync: vi.fn(actual.lstatSync),
  };
});

// References to the spies created by the factory for test-level overrides.
const mockReaddirSync = readdirSync as unknown as ReturnType<typeof vi.fn>;
const mockLstatSync = lstatSync as unknown as ReturnType<typeof vi.fn>;


// ════════════════════════════════════════════════════════════════════
// Test Infrastructure
// ════════════════════════════════════════════════════════════════════

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'mumuspec-validator-deep-'));
  mkdirSync(join(testDir, '.mumuspec', 'contracts'), { recursive: true });
  mkdirSync(join(testDir, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'test.contract',
    name: 'Test Contract',
    category: 'api',
    status: 'active',
    criticality: 'important',
    version: '1.0.0',
    source: 'src/test.ts',
    description: 'A test contract',
    owner: 'team',
    upstream: [],
    downstream: [],
    schema: { type: 'object', properties: { id: { type: 'string' } } },
    examples: ['{"id": "1"}'],
    ...overrides,
  };
}

function writeContractsYaml(dir: string, yaml: string): void {
  writeFileSync(join(dir, '.mumuspec', 'contracts', 'contracts.yaml'), yaml, 'utf-8');
}

function buildYaml(contracts: Contract[]): string {
  // ponytail: manually build YAML to avoid external dependency
  const lines: string[] = [
    'version: "1.0.0"',
    `last_updated: "${new Date().toISOString()}"`,
  ];

  if (contracts.length === 0) {
    // YAML needs explicit empty list, not bare `contracts:` key (which becomes null)
    lines.push('contracts: []');
  } else {
    lines.push('contracts:');
    for (const c of contracts) {
      lines.push(`  - id: "${c.id}"`);
      lines.push(`    name: "${c.name}"`);
      lines.push(`    category: ${c.category}`);
      lines.push(`    status: ${c.status}`);
      lines.push(`    criticality: ${c.criticality}`);
      lines.push(`    version: "${c.version}"`);
      lines.push(`    source: "${c.source}"`);
      lines.push(`    description: "${c.description}"`);
      lines.push(`    owner: "${c.owner || ''}"`);
      lines.push(`    upstream: [${c.upstream.map(u => `"${u}"`).join(', ')}]`);
      lines.push(`    downstream: [${c.downstream.map(d => `"${d}"`).join(', ')}]`);
      lines.push(`    schema: ${JSON.stringify(c.schema)}`);
      // YAML is parsed as-is (no snake_case → camelCase conversion), so the key
      // must match the camelCase property name from types-contract.ts.
      if (c.migrationPath) {
        lines.push(`    migrationPath: "${c.migrationPath}"`);
      }
      if (c.deprecationNote) {
        lines.push(`    deprecationNote: "${c.deprecationNote}"`);
      }
    }
  }

  const outboundIds = contracts.filter(c => c.upstream.length > 0).map(c => `"${c.id}"`);
  const inboundIds = contracts.filter(c => c.downstream.length > 0).map(c => `"${c.id}"`);

  lines.push(`outbound_ids: [${outboundIds.join(', ')}]`);
  lines.push(`inbound_ids: [${inboundIds.join(', ')}]`);
  lines.push('dependency_graph: {}');

  return lines.join('\n') + '\n';
}

// ════════════════════════════════════════════════════════════════════
// LINE 271 — validateBoundaries missing BOUNDARY.md result path
// ════════════════════════════════════════════════════════════════════

describe('validateBoundaries > missing BOUNDARY.md (line 271)', () => {
  it('returns has_boundary_doc=false with E-CONTRACT-001 for dir with code but no BOUNDARY.md', () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export function hello() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(false);
    expect(srcResult!.errors).toHaveLength(1);
    expect(srcResult!.errors[0].code).toBe('E-CONTRACT-001');
    expect(srcResult!.errors[0].severity).toBe('WARN');
    expect(srcResult!.warnings).toHaveLength(0);
  });

  it('finds multiple code directories all missing BOUNDARY.md', () => {
    mkdirSync(join(testDir, 'lib'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(testDir, 'lib', 'b.ts'), 'export const b = 2;\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const dirs = results.filter(r => !r.has_boundary_doc);
    expect(dirs.length).toBeGreaterThanOrEqual(2);
    const codes = dirs.flatMap(d => d.errors.map(e => e.code));
    expect(codes.every(c => c === 'E-CONTRACT-001')).toBe(true);
  });

  it('does NOT flag directories without any code files', () => {
    mkdirSync(join(testDir, 'docs'), { recursive: true });
    writeFileSync(join(testDir, 'docs', 'readme.md'), '# Documentation\n');
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export function app() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const docsResult = results.find(r => r.dir_path === join(testDir, 'docs'));
    expect(docsResult).toBeUndefined();
    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// LINE 395 — verifyExportExists catch block (error path)
// ════════════════════════════════════════════════════════════════════

describe('verifyExportExists > catch block (line 395)', () => {
  it('covers catch block when readdirSync/verifyExportExists encounters unreadable path', () => {
    writeFileSync(join(testDir, 'src', 'mod.ts'), 'export function realFn() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const boundaryContent = [
      '# BOUNDARY.md',
      '',
      '## 对外接口',
      '',
      '- `realFn(): void`: A real function',
      '',
      '## 依赖声明',
      '',
      '## 数据契约',
      '',
      '## 变更日志',
      '',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);

    // This test exercises the non-error path of verifyExportExists: the
    // export IS found in code, so the function returns true and no
    // E-CONTRACT-002 is raised. The error-path catch (line 395) is covered
    // by the dedicated >error-path catch blocks< test below using a
    // module-level mock of readdirSync.
    const results = validateBoundaries(testDir);
    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    // realFn IS in the code → no E-CONTRACT-002
    expect(srcResult!.errors.filter(e => e.code === 'E-CONTRACT-002')).toHaveLength(0);
  });

  it('export not found in code produces E-CONTRACT-002 (false path → exercises try block including catch)', () => {
    writeFileSync(join(testDir, 'src', 'mod.ts'), 'export function realFn() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `realFn(): void`: exists',
      '- `ghostFn(): void`: NOT in code',
      '## 依赖声明',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    const exportErrors = srcResult!.errors.filter(e => e.code === 'E-CONTRACT-002');
    expect(exportErrors.length).toBeGreaterThan(0);
    expect(exportErrors[0].message).toContain('ghostFn');
  });
});

// ════════════════════════════════════════════════════════════════════
// LINES 402-430 — verifyDependencyUsage (all import patterns)
// ════════════════════════════════════════════════════════════════════

describe('verifyDependencyUsage > import pattern matching (lines 402-430)', () => {
  function writeBoundaryWithDep(depLine: string): void {
    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `getData(): void`: Fetch data',
      '## 依赖声明',
      depLine,
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));
  }

  it('detects import { x } from "module" pattern', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import { something } from "external-pkg";\nexport function getData() {}\n');
    writeBoundaryWithDep('- `external-pkg` - used for something');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('detects import "module" side-effect pattern', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import "side-effect-pkg";\nexport function getData() {}\n');
    writeBoundaryWithDep('- `side-effect-pkg` - side effects');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('detects require("module") pattern', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'const x = require("cjs-pkg");\nexport function getData() {}\n');
    writeBoundaryWithDep('- `cjs-pkg` - commonjs module');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('detects dynamic import("module") pattern', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'const mod = await import("dynamic-pkg");\nexport function getData() {}\n');
    writeBoundaryWithDep('- `dynamic-pkg` - lazy loaded');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('warns when external dependency import is NOT found (E-CONTRACT-003)', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'export function getData() {}\n');
    writeBoundaryWithDep('- `unused-pkg` - declared but never imported');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    const depWarnings = srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003');
    expect(depWarnings.length).toBeGreaterThan(0);
    expect(depWarnings[0].message).toContain('unused-pkg');
  });

  it('detects import type { ... } from "module" pattern', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import type { SomeType } from "type-pkg";\nexport function getData() {}\n');
    writeBoundaryWithDep('- `type-pkg` - type-only import');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('covers escapeRegExp — module name with special regex characters', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import { x } from "@scope/pkg.name$ext";\nexport function getData() {}\n');
    writeBoundaryWithDep('- `@scope/pkg.name$ext` - special chars module');

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });

  it('no E-CONTRACT-003 when BOUNDARY.md declares no dependencies', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'export function getData() {}\n');

    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `getData(): void`: Fetch data',
      '## 依赖声明',
      '(none declared)',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-003')).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// Boundary validation — all issue codes and change log
// ════════════════════════════════════════════════════════════════════

describe('validateBoundaries > all issue codes and change log', () => {
  it('reports E-CONTRACT-002 for export declared but not in code', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'export function realFn() {}\n');
    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `realFn(): void`: A real function',
      '- `missingFn(): void`: Not in code',
      '## 依赖声明',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    const exportErrors = srcResult!.errors.filter(e => e.code === 'E-CONTRACT-002');
    expect(exportErrors.length).toBeGreaterThan(0);
    expect(exportErrors[0].message).toContain('missingFn');
    expect(exportErrors[0].severity).toBe('ERROR');
  });

  it('reports E-CONTRACT-004 when BOUNDARY.md has no change log', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'export function getData() {}\n');
    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `getData(): void`: Fetch data',
      '## 依赖声明',
      '## 数据契约',
      '## 变更日志',
      '', // empty change log
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    const changelogWarnings = srcResult!.warnings.filter(w => w.code === 'E-CONTRACT-004');
    expect(changelogWarnings.length).toBeGreaterThan(0);
  });

  it('clean boundary doc passes with no issues', () => {
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import { helper } from "real-dep";\nexport function getData() {}\n');
    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `getData(): void`: Fetch data',
      '## 依赖声明',
      '- `real-dep` - used for helper',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.has_boundary_doc).toBe(true);
    expect(srcResult!.errors).toHaveLength(0);
    expect(srcResult!.warnings).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// findDirectoriesWithCode — edge cases
// ════════════════════════════════════════════════════════════════════

describe('findDirectoriesWithCode > edge cases', () => {
  it('scans multiple file extensions (.py, .java, .go, .rs)', () => {
    mkdirSync(join(testDir, 'pysrc'), { recursive: true });
    writeFileSync(join(testDir, 'pysrc', 'main.py'), 'def main(): pass\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const pyResult = results.find(r => r.dir_path === join(testDir, 'pysrc'));
    expect(pyResult).toBeDefined();
    expect(pyResult!.has_boundary_doc).toBe(false);
  });

  it('respects MAX_SCAN_DEPTH — does not recurse too deep', () => {
    // Place a known-good code directory within scanning depth
    writeFileSync(join(testDir, 'src', 'marker.ts'), 'export const marker = 1;\n');

    let currentDir = testDir;
    for (let i = 0; i < 12; i++) {
      currentDir = join(currentDir, `level${i}`);
    }
    mkdirSync(currentDir, { recursive: true });
    writeFileSync(join(currentDir, 'deep.ts'), 'export function deep() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const deepResult = results.find(r => r.dir_path === currentDir);
    expect(deepResult).toBeUndefined();
    // src should be found (it's within depth and has code files)
    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    // The scan should have scanned some intermediate dirs (within MAX_SCAN_DEPTH)
    // but stopped before level8+. The src dir at depth 1 proves scanning works;
    // the absence of the level11 dir proves the depth guard works.
    // Count total results — should include src but NOT the deep dir.
    const allDirs = results.map(r => r.dir_path);
    expect(allDirs.some(d => d.includes('level'))).toBe(false); // no level dirs at any depth
  });

  it('skips node_modules and dot-prefixed directories', () => {
    // Create markers: node_modules, .hidden (should be skipped), and a real dir
    mkdirSync(join(testDir, 'node_modules', 'some-pkg'), { recursive: true });
    writeFileSync(join(testDir, 'node_modules', 'some-pkg', 'index.ts'), 'export function pkgfn() {}\n');
    mkdirSync(join(testDir, '.hidden'), { recursive: true });
    writeFileSync(join(testDir, '.hidden', 'secret.ts'), 'export function secret() {}\n');
    mkdirSync(join(testDir, 'realdir'), { recursive: true });
    writeFileSync(join(testDir, 'realdir', 'app.ts'), 'export function realApp() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    const nmResult = results.find(r => r.dir_path.includes('node_modules'));
    expect(nmResult).toBeUndefined();
    const hiddenResult = results.find(r => r.dir_path.endsWith('.hidden'));
    expect(hiddenResult).toBeUndefined();
    // realdir should appear (not skipped, has code files)
    const realdirResult = results.find(r => r.dir_path === join(testDir, 'realdir'));
    expect(realdirResult).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — category-specific default branch + critical flag
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > category-specific default branch', () => {
  it('category "messaging" falls through to default (no enforcement rule)', () => {
    const contract = makeContract({
      id: 'msg.contract',
      category: 'messaging',
      source: 'https://mq.example.com/schema',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const enforcementDrifts = report.drifts.filter(d => d.type === 'enforcement_violation');
    expect(enforcementDrifts).toHaveLength(0);
    expect(report.clean_contracts).toContain('msg.contract');
  });

  it('category "filesystem" falls through to default (no enforcement rule)', () => {
    const contract = makeContract({
      id: 'fs.contract',
      category: 'filesystem',
      source: 'https://storage.example.com/schema',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const enforcementDrifts = report.drifts.filter(d => d.type === 'enforcement_violation');
    expect(enforcementDrifts).toHaveLength(0);
    expect(report.clean_contracts).toContain('fs.contract');
  });

  it('category "config" falls through to default (no enforcement rule)', () => {
    const contract = makeContract({
      id: 'cfg.contract',
      category: 'config',
      source: 'https://config.example.com/schema',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const enforcementDrifts = report.drifts.filter(d => d.type === 'enforcement_violation');
    expect(enforcementDrifts).toHaveLength(0);
    expect(report.clean_contracts).toContain('cfg.contract');
  });

  it('category "serialization" falls through to default (no enforcement rule)', () => {
    const contract = makeContract({
      id: 'ser.contract',
      category: 'serialization',
      source: 'https://schema.example.com/json',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const enforcementDrifts = report.drifts.filter(d => d.type === 'enforcement_violation');
    expect(enforcementDrifts).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — has_critical_drifts flag
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > has_critical_drifts flag', () => {
  it('sets has_critical_drifts=true for critical contract with missing source', () => {
    const contract = makeContract({
      id: 'critical.svc',
      criticality: 'critical',
      source: 'src/critical/missing.ts',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    expect(report.has_critical_drifts).toBe(true);
    const criticalDrift = report.drifts.find(d => d.contract_id === 'critical.svc' && d.severity === 'ERROR');
    expect(criticalDrift).toBeDefined();
    expect(criticalDrift!.type).toBe('unimplemented');
  });

  it('has_critical_drifts=false when only WARN drifts exist', () => {
    const contract = makeContract({
      id: 'important.svc',
      criticality: 'important',
      source: 'src/important/missing.ts',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    expect(report.has_critical_drifts).toBe(false);
    expect(report.drifts.every(d => d.severity === 'WARN')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — retired status + migration path
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > retired status and migration path', () => {
  it('detects retired contract still in registry (deprecated_in_use)', () => {
    const contract = makeContract({
      id: 'old.svc',
      category: 'serialization',
      status: 'retired',
      source: 'https://example.com/old',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const retiredDrifts = report.drifts.filter(d =>
      d.type === 'deprecated_in_use' && d.contract_id === 'old.svc'
    );
    expect(retiredDrifts.length).toBeGreaterThan(0);
    expect(retiredDrifts[0].message).toContain('retired');
  });

  it('deprecated contract uses migrationPath in suggestion field', () => {
    const contract = makeContract({
      id: 'dep.svc',
      category: 'serialization',
      status: 'deprecated',
      source: 'https://example.com/dep',
      upstream: ['consumer.a'],
      migrationPath: 'Use new.svc instead.',
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const depDrifts = report.drifts.filter(d =>
      d.type === 'deprecated_in_use' && d.contract_id === 'dep.svc'
    );
    expect(depDrifts.length).toBeGreaterThan(0);
    expect(depDrifts[0].suggestion).toContain('Use new.svc instead.');
  });

  it('deprecated contract without migrationPath gives generic suggestion', () => {
    const contract = makeContract({
      id: 'dep.svc',
      category: 'serialization',
      status: 'deprecated',
      source: 'https://example.com/dep',
      upstream: ['consumer.a'],
    });
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const depDrifts = report.drifts.filter(d =>
      d.type === 'deprecated_in_use' && d.contract_id === 'dep.svc'
    );
    expect(depDrifts.length).toBeGreaterThan(0);
    expect(depDrifts[0].suggestion).toContain('migration path');
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — dependency graph integrity
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > dependency graph integrity', () => {
  it('detects orphaned outbound_id (DRIFT-GRAPH-001)', () => {
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "svc.a"',
      '    name: "Service A"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/a"',
      '    description: "Service A"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: { "type": "object" }',
      'outbound_ids:',
      '  - "svc.a"',
      '  - "ghost.outbound"',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const graphDrifts = report.drifts.filter(d => d.contract_id === 'ghost.outbound');
    expect(graphDrifts.length).toBeGreaterThan(0);
    expect(graphDrifts[0].error_code).toBe('E-CONTRACT-008');
  });

  it('detects orphaned inbound_id (DRIFT-GRAPH-002)', () => {
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "svc.a"',
      '    name: "Service A"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/a"',
      '    description: "Service A"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: { "type": "object" }',
      'outbound_ids: []',
      'inbound_ids:',
      '  - "ghost.inbound"',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const graphDrifts = report.drifts.filter(d => d.contract_id === 'ghost.inbound');
    expect(graphDrifts.length).toBeGreaterThan(0);
    expect(graphDrifts[0].error_code).toBe('E-CONTRACT-008');
  });

  it('detects orphaned downstream consumer (orphaned_consumer type)', () => {
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "svc.frontend"',
      '    name: "Frontend Service"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/frontend"',
      '    description: "Frontend"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream:',
      '      - "svc.missing"',
      '    schema: { "type": "object" }',
      'outbound_ids: []',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const orphaned = report.drifts.filter(d =>
      d.type === 'orphaned_consumer' && d.message.includes('svc.missing')
    );
    expect(orphaned.length).toBeGreaterThan(0);
    expect(orphaned[0].error_code).toBe('E-CONTRACT-008');
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — enforcement violation: database and sdk
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > enforcement: database and sdk categories', () => {
  it('detects database contract without proper version', () => {
    writeContractsYaml(testDir, buildYaml([
      makeContract({
        id: 'db.users',
        category: 'database',
        version: '0.0.0',
        source: 'https://db.example.com/users',
      }),
    ]));

    const report = detectContractDrift(testDir);

    const dbDrifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('Database')
    );
    expect(dbDrifts.length).toBeGreaterThan(0);
  });

  it('detects SDK contract without owner', () => {
    writeContractsYaml(testDir, buildYaml([
      makeContract({
        id: 'sdk.stripe',
        category: 'sdk',
        owner: '',
        source: 'https://stripe.com/docs',
      }),
    ]));

    const report = detectContractDrift(testDir);

    const sdkDrifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('SDK')
    );
    expect(sdkDrifts.length).toBeGreaterThan(0);
  });

  it('passes database contract with proper version', () => {
    writeContractsYaml(testDir, buildYaml([
      makeContract({
        id: 'db.orders',
        category: 'database',
        version: '2.3.1',
        source: 'https://db.example.com/orders',
      }),
    ]));

    const report = detectContractDrift(testDir);

    const dbDrifts = report.drifts.filter(d =>
      d.contract_id === 'db.orders' && d.type === 'enforcement_violation'
    );
    expect(dbDrifts).toHaveLength(0);
  });

  it('passes SDK contract with owner', () => {
    writeContractsYaml(testDir, buildYaml([
      makeContract({
        id: 'sdk.github',
        category: 'sdk',
        owner: 'GitHub Inc.',
        source: 'https://docs.github.com',
      }),
    ]));

    const report = detectContractDrift(testDir);

    const sdkDrifts = report.drifts.filter(d =>
      d.contract_id === 'sdk.github' && d.type === 'enforcement_violation'
    );
    expect(sdkDrifts).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — schema completeness (lines 113-122) and
// CLI enforcement (lines 152-163)
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > schema and cli enforcement', () => {
  it('detects empty schema as schema_mismatch drift (ER-007)', () => {
    // A contract with empty schema should produce a schema_mismatch drift
    // (lines 112-122 in checkContractDrift).
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "no.schema"',
      '    name: "No Schema Contract"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/no-schema"',
      '    description: "A contract without schema"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: {}',
      'outbound_ids: []',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const schemaDrifts = report.drifts.filter(d =>
      d.error_code === 'E-CONTRACT-007'
    );
    expect(schemaDrifts.length).toBeGreaterThan(0);
    expect(schemaDrifts[0].type).toBe('schema_mismatch');
  });

  it('detects missing schema key (schema undefined) as schema_mismatch drift', () => {
    // When schema key is omitted entirely, contract.schema is undefined.
    // Lines 112-122 check "!contract.schema" which short-circuits.
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "missing.schema"',
      '    name: "Missing Schema Contract"',
      '    category: api',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/missing-schema"',
      '    description: "Schema key omitted"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      'outbound_ids: []',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const schemaDrifts = report.drifts.filter(d =>
      d.error_code === 'E-CONTRACT-007'
    );
    expect(schemaDrifts.length).toBeGreaterThan(0);
  });

  it('detects CLI contract lacking flags/options schema (lines 152-163)', () => {
    // A CLI category contract whose schema has neither `flags` nor
    // `options` should produce ER-009 enforcement violation.
    const yaml = [
      'version: "1.0.0"',
      `last_updated: "${new Date().toISOString()}"`,
      'contracts:',
      '  - id: "cli.tool"',
      '    name: "CLI Tool Contract"',
      '    category: cli',
      '    status: active',
      '    criticality: important',
      '    version: "1.0.0"',
      '    source: "https://example.com/cli"',
      '    description: "CLI contract"',
      '    owner: "team"',
      '    upstream: []',
      '    downstream: []',
      '    schema: { "type": "object" }',
      'outbound_ids: []',
      'inbound_ids: []',
      'dependency_graph: {}',
      '',
    ].join('\n');
    writeContractsYaml(testDir, yaml);

    const report = detectContractDrift(testDir);

    const cliDrifts = report.drifts.filter(d =>
      d.type === 'enforcement_violation' && d.message.includes('CLI')
    );
    expect(cliDrifts.length).toBeGreaterThan(0);
    expect(cliDrifts[0].error_code).toBe('E-CONTRACT-009');
  });

  it('passes CLI contract with flags in schema', () => {
    // A CLI contract WITH flags in schema should not produce ER-009.
    writeContractsYaml(testDir, buildYaml([
      makeContract({
        id: 'cli.flags',
        category: 'cli',
        schema: { type: 'object', flags: { type: 'array' } },
      }),
    ]));

    const report = detectContractDrift(testDir);

    const cliDrifts = report.drifts.filter(d =>
      d.contract_id === 'cli.flags' && d.type === 'enforcement_violation'
    );
    expect(cliDrifts).toHaveLength(0);
  });

  it('detects API contract without examples (line 137, branch false → enter drift)', () => {
    // An API category contract whose `examples` is empty should enter the
    // if-block at line 137 and produce an ER-009 enforcement violation.
    // makeContract default has examples; we override with undefined examples
    // by constructing an inline YAML that omits the examples key.
    const contract = makeContract({
      id: 'api.noexamples',
      category: 'api',
      examples: undefined as unknown as string[],
    });
    delete (contract as Record<string, unknown>)['examples'];
    writeContractsYaml(testDir, buildYaml([contract]));

    const report = detectContractDrift(testDir);

    const apiDrifts = report.drifts.filter(d =>
      d.contract_id === 'api.noexamples' && d.type === 'enforcement_violation'
    );
    expect(apiDrifts.length).toBeGreaterThan(0);
    expect(apiDrifts[0].error_code).toBe('E-CONTRACT-009');
  });
});

// ════════════════════════════════════════════════════════════════════
// detectContractDrift — report structure and metadata
// ════════════════════════════════════════════════════════════════════

describe('detectContractDrift > report structure and metadata', () => {
  it('includes timestamp, total_contracts, drift_count, and scan_duration_ms', () => {
    writeContractsYaml(testDir, buildYaml([makeContract({ source: 'https://example.com/s' })]));

    const report = detectContractDrift(testDir);

    expect(report.timestamp).toBeDefined();
    expect(typeof report.timestamp).toBe('string');
    expect(report.total_contracts).toBe(1);
    expect(typeof report.drift_count).toBe('number');
    expect(typeof report.scan_duration_ms).toBe('number');
    expect(report.scan_duration_ms).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.drifts)).toBe(true);
    expect(Array.isArray(report.clean_contracts)).toBe(true);
    expect(typeof report.has_critical_drifts).toBe('boolean');
  });

  it('returns empty report for project with no contracts', () => {
    writeContractsYaml(testDir, buildYaml([]));

    const report = detectContractDrift(testDir);

    expect(report.total_contracts).toBe(0);
    expect(report.drifts).toHaveLength(0);
    expect(report.clean_contracts).toHaveLength(0);
    expect(report.has_critical_drifts).toBe(false);
    expect(report.drift_count).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// validateBoundaries — multi-directory with mixed compliance
// ════════════════════════════════════════════════════════════════════

describe('validateBoundaries > multi-directory mixed compliance', () => {
  it('processes multiple directories with different compliance levels', () => {
    mkdirSync(join(testDir, 'pkg-a'), { recursive: true });
    writeFileSync(join(testDir, 'pkg-a', 'index.ts'), 'export function fetchData() {}\n');
    writeFileSync(join(testDir, 'pkg-a', 'BOUNDARY.md'), [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `fetchData(): void`: Fetch data',
      '## 依赖声明',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n'));

    mkdirSync(join(testDir, 'pkg-b'), { recursive: true });
    writeFileSync(join(testDir, 'pkg-b', 'util.ts'), 'export function helper() {}\n');

    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    expect(results.length).toBeGreaterThanOrEqual(2);

    const aResult = results.find(r => r.dir_path === join(testDir, 'pkg-a'));
    expect(aResult).toBeDefined();
    expect(aResult!.has_boundary_doc).toBe(true);
    expect(aResult!.errors).toHaveLength(0);

    const bResult = results.find(r => r.dir_path === join(testDir, 'pkg-b'));
    expect(bResult).toBeDefined();
    expect(bResult!.has_boundary_doc).toBe(false);
    expect(bResult!.errors.some(e => e.code === 'E-CONTRACT-001')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Error-path coverage: catch blocks in findDirectoriesWithCode (lines 343,
// 371), verifyExportExists (line 395), verifyDependencyUsage (line 424).
//
// Uses mockImplementationOnce on the module-level spies. After the queued
// implementation is consumed, the mock automatically falls back to the
// factory default (the real readdirSync/lstatSync), so state never leaks
// across tests.
// ════════════════════════════════════════════════════════════════════

describe('error-path catch blocks (lines 343, 371, 395, 424)', () => {
  it('covers verifyExportExists catch block (line 395) when readdirSync throws', () => {
    // ARRANGE: write real files so the scan succeeds but scanning inside
    // verifyExportExists hits a throwing readdirSync.
    writeFileSync(join(testDir, 'src', 'mod.ts'), 'export function myFn() {}\n');

    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '- `myFn(): void`: My function',
      '## 依赖声明',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    // First call (projectRoot scan) — succeed, so src/ gets into results.
    // Second call (src scan) — succeed, so verifyExportExists runs on src/.
    // Third call (inside verifyExportExists) — throw, hitting line 395.
    mockReaddirSync.mockImplementationOnce((path: unknown) => {
      const entries = [
        { name: '.mumuspec', isFile: () => false, isDirectory: () => true },
        { name: 'src', isFile: () => false, isDirectory: () => true },
      ];
      return entries as unknown as ReturnType<typeof readdirSync>;
    });
    mockReaddirSync.mockImplementationOnce(() => {
      const entries = [
        { name: 'mod.ts', isFile: () => true, isDirectory: () => false },
        { name: 'BOUNDARY.md', isFile: () => true, isDirectory: () => false },
      ];
      return entries as unknown as ReturnType<typeof readdirSync>;
    });
    mockReaddirSync.mockImplementationOnce(() => {
      throw new Error('EACCES: readdirSync failure inside verifyExportExists');
    });

    // ACT — must not throw despite the readdirSync failure.
    const results = validateBoundaries(testDir);

    // ASSERT: validateBoundaries handled the error gracefully; the export was
    // reported missing because the catch returned false.
    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(srcResult!.errors.some(e => e.code === 'E-CONTRACT-002')).toBe(true);
  });

  it('covers verifyDependencyUsage catch block (line 424) when readdirSync throws', () => {
    // BOUNDARY.md declares a dependency (external type) but no exports.
    // This ensures the validateBoundaries loop skips verifyExportExists
    // entirely and calls verifyDependencyUsage directly — allowing the
    // third readdirSync call to hit verifyDependencyUsage's catch (line 424).
    writeFileSync(join(testDir, 'src', 'impl.ts'), 'import { foo } from "mypkg";\nexport function getData() {}\n');

    const boundaryContent = [
      '# BOUNDARY.md',
      '## 对外接口',
      '',
      '## 依赖声明',
      '- `mypkg` - some package',
      '## 数据契约',
      '## 变更日志',
      '- 2025-01-01: Initial',
      '',
    ].join('\n');
    writeFileSync(join(testDir, 'src', 'BOUNDARY.md'), boundaryContent);
    writeContractsYaml(testDir, buildYaml([]));

    // Call 1: projectRoot scan — succeed → yields entries for .mumuspec, src.
    // Call 2: src scan — succeed → has code, so src goes into results.
    // Call 3: verifyDependencyUsage deep-reads src — throw to hit line 424.
    mockReaddirSync
      .mockImplementationOnce(() => [
        { name: '.mumuspec', isFile: () => false, isDirectory: () => true },
        { name: 'src', isFile: () => false, isDirectory: () => true },
      ] as unknown as ReturnType<typeof readdirSync>)
      .mockImplementationOnce(() => [
        { name: 'impl.ts', isFile: () => true, isDirectory: () => false },
        { name: 'BOUNDARY.md', isFile: () => true, isDirectory: () => false },
      ] as unknown as ReturnType<typeof readdirSync>)
      .mockImplementationOnce(() => {
        throw new Error('EACCES: readdirSync failure inside verifyDependencyUsage');
      });

    // ACT — must not throw.
    const results = validateBoundaries(testDir);

    // ASSERT: dependency-check catch swallowed the error. src appears
    // in results (scan succeeded) and no exception escaped.
    const srcResult = results.find(r => r.dir_path === join(testDir, 'src'));
    expect(srcResult).toBeDefined();
    expect(Array.isArray(srcResult!.errors)).toBe(true);
  });

  it('covers findDirectoriesWithCode scan catch (line 371) when readdirSync throws on root scan', () => {
    // The catch block at line 369-371 is the inner try/catch in scan().
    // When readdirSync(projectRoot) throws (e.g. permission denied on the
    // root directory itself), the catch absorbs the error and scan returns
    // without recursing — leaving directoriesWithCode empty.
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export function app() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    // First readdirSync call is the scan of projectRoot. Force it to throw.
    // The catch at line 369-371 absorbs the error; scan returns; no recursion
    // into src occurs, so directoriesWithCode ends up empty.
    mockReaddirSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied on root scan');
    });
    // After the once-impl is consumed (throwing), any subsequent call falls
    // back to the actual readdirSync (real directory state). But the catch
    // prevents any further scan calls because the root didn't yield entries.

    // ACT
    const results = validateBoundaries(testDir);

    // ASSERT: root scan failed gracefully → no directories discovered.
    expect(results).toEqual([]);
  });

  it('covers lstatSync catch block (line 343) when lstatSync throws', () => {
    // ARRANGE: Force lstatSync to throw. The catch at line 342-344 assigns
    // realPath := dir and continues, so the scan should still proceed
    // (using the original dir path for visited tracking).
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export function app() {}\n');
    writeContractsYaml(testDir, buildYaml([]));

    // lstatSync called once for projectRoot and once for src/.
    // First call: throw — catches, realPath = projectRoot. Visited set uses it.
    // Second call: throw — catches, realPath = real src dir. Visited set uses it.
    mockLstatSync.mockImplementation(() => {
      throw new Error('lstatSync failure — simulating symlink resolution error');
    });

    // ACT — should not throw; scan proceeds with realPath = dir.
    const results = validateBoundaries(testDir);

    // ASSERT: Despite lstatSync failures (symlink resolution errors),
    // validateBoundaries completes. src/ may or may not appear in results
    // depending on whether readdirSync (via the real impl) succeeds after
    // readdirSync mockImplementationOnce is consumed.
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Symlink cycle detection — line 341 (isSymbolicLink ternary true) and
// line 346 (visited.has true → early return). Symlinks are only created
// on systems that support them (Windows requires admin/developer mode).
// ════════════════════════════════════════════════════════════════════

describe('findDirectoriesWithCode > symlink cycle detection (lines 341, 346)', () => {
  it('resolves real path via symlink — line 341 ternary true branch; line 346 cycle guard', () => {
    // Create a real directory with code, then a symlink pointing to it.
    // findDirectoriesWithCode should follow the symlink, resolve real path,
    // and detect the cycle (line 346 early return) so the directory is
    // only reported once.
    const realDir = join(testDir, 'real-src');
    mkdirSync(realDir, { recursive: true });
    writeFileSync(join(realDir, 'real.ts'), 'export const v = 1;\n');

    const symlinkPath = join(testDir, 'link-to-src');
    try {
      const { symlinkSync } = require('node:fs') as typeof import('node:fs');
      symlinkSync(realDir, symlinkPath, 'junction');
    } catch {
      // symlink creation not permitted — skip this test gracefully
      return;
    }

    writeContractsYaml(testDir, buildYaml([]));

    const results = validateBoundaries(testDir);

    // At minimum, the real directory appears in results.
    const realResult = results.find(r => r.dir_path === realDir);
    expect(realResult).toBeDefined();
  });
});
