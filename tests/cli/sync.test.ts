/**
 * Tests for sync command — code state → persistent spec synchronization.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeSync } from '../../src/cli/commands/sync.js';

const testRoot = join(tmpdir(), 'mumuspec-sync-test-' + Date.now());

function setupTestProject() {
  mkdirSync(testRoot, { recursive: true });
  mkdirSync(join(testRoot, 'src', 'core'), { recursive: true });
  mkdirSync(join(testRoot, '.mumuspec'), { recursive: true });

  // Create a module with exports
  writeFileSync(join(testRoot, 'src', 'core', 'utils.ts'), `
export function helper(): string { return 'ok'; }
export const VERSION = '1.0.0';
export interface Config { name: string; }
`);

  // Create index.yaml
  writeFileSync(join(testRoot, '.mumuspec', 'index.yaml'), `
modules:
  - name: core
    path: src/core
`);
}

function cleanupTestProject() {
  rmSync(testRoot, { recursive: true, force: true });
}

describe('sync command', () => {
  beforeAll(setupTestProject);
  afterAll(cleanupTestProject);

  it('should scan modules in src/', () => {
    const result = executeSync(testRoot, { check: true });
    expect(result.modulesScanned).toBeGreaterThanOrEqual(1);
  });

  it('should warn about missing BOUNDARY.md in check mode', () => {
    const result = executeSync(testRoot, { check: true });
    const hasMissingBoundaryWarning = result.issues.some(
      (i) => i.module === 'core' && i.message.includes('Missing BOUNDARY.md')
    );
    expect(hasMissingBoundaryWarning).toBe(true);
  });

  it('should create BOUNDARY.md when not in check mode', () => {
    const result = executeSync(testRoot, { check: false });
    expect(result.boundaryUpdated).toBeGreaterThanOrEqual(1);
    const boundaryPath = join(testRoot, 'src', 'core', '.mumuspec', 'BOUNDARY.md');
    expect(existsSync(boundaryPath)).toBe(true);
  });

  it('generates a responsibility/boundary document rather than an export dump', () => {
    const boundaryPath = join(testRoot, 'src', 'core', '.mumuspec', 'BOUNDARY.md');
    if (!existsSync(boundaryPath)) return; // creation is asserted by the previous case
    const content = readFileSync(boundaryPath, 'utf8');
    expect(content).toContain('# BOUNDARY: core/');
    expect(content).toContain('## 职责');
    expect(content).toContain('## 边界');
    // Export enumeration is code-derived; a generated table of names with
    // "(description pending)" is boilerplate nobody maintains.
    expect(content).not.toContain('(description pending) |');
  });

  it('should validate index.yaml alignment', () => {
    const result = executeSync(testRoot, { check: true });
    expect(result.indexAligned).toBeGreaterThanOrEqual(1);
  });

  it('should record contract snapshots when not in check mode', () => {
    executeSync(testRoot, { check: false });
    const contractsDir = join(testRoot, '.mumuspec', 'contracts', 'schemas');
    expect(existsSync(contractsDir)).toBe(true);
  });

  it('should filter by --module option', () => {
    const result = executeSync(testRoot, { check: true, module: 'core' });
    expect(result.modulesScanned).toBe(1);
  });

  it('should detect old-format files in migrate mode', () => {
    // Create an old-format file
    writeFileSync(join(testRoot, '.mumuspec', 'spec.yaml'), 'old: true');
    const result = executeSync(testRoot, { migrate: true });
    const hasOldFormatInfo = result.issues.some(
      (i) => i.message.includes('spec.yaml') && i.severity === 'info'
    );
    expect(hasOldFormatInfo).toBe(true);
    rmSync(join(testRoot, '.mumuspec', 'spec.yaml'));
  });
});
