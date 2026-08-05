/**
 * Tests for review command — module-level review dimension (D8).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeReview } from '../../src/cli/commands/review.js';

const testRoot = join(tmpdir(), 'mumuspec-review-test-' + Date.now());

function setupTestProject() {
  mkdirSync(testRoot, { recursive: true });
  mkdirSync(join(testRoot, 'src', 'core'), { recursive: true });
  mkdirSync(join(testRoot, 'src', 'utils'), { recursive: true });

  // Module with good practices
  writeFileSync(join(testRoot, 'src', 'core', 'service.ts'), `
export interface ServiceConfig { name: string; }
export class Service { 
  constructor(private cfg: ServiceConfig) {}
  execute(): string { return this.cfg.name; }
}
`);

  // Module with type issues
  writeFileSync(join(testRoot, 'src', 'utils', 'helper.ts'), `
export function parse(input: any): any { return input; }
// @ts-ignore
export const data: any = {};
`);

  // Create BOUNDARY.md for core only
  writeFileSync(join(testRoot, 'src', 'core', 'BOUNDARY.md'), `# BOUNDARY: core/

## 对外接口

| 接口 | 说明 |
|------|------|
| Service | Main service class |

## 依赖声明

None

## 数据契约

ServiceConfig — configuration object

## 变更日志

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-08-05 | Created | Initial |
`);
}

function cleanupTestProject() {
  rmSync(testRoot, { recursive: true, force: true });
}

describe('review command', () => {
  beforeAll(setupTestProject);
  afterAll(cleanupTestProject);

  it('should review all modules when no filter', () => {
    const result = executeReview(testRoot);
    expect(result.modules_reviewed).toBe(2);
  });

  it('should filter by module name', () => {
    const result = executeReview(testRoot, 'core');
    expect(result.modules_reviewed).toBe(1);
    expect(result.modules[0].module).toBe('core');
  });

  it('should score modules on all 7 dimensions', () => {
    const result = executeReview(testRoot);
    for (const mod of result.modules) {
      expect(Object.keys(mod.dimensions).length).toBe(7);
      expect(mod.overall).toBeGreaterThanOrEqual(0);
      expect(mod.overall).toBeLessThanOrEqual(10);
    }
  });

  it('should give higher score to module with BOUNDARY.md', () => {
    const result = executeReview(testRoot);
    const core = result.modules.find((m) => m.module === 'core');
    const utils = result.modules.find((m) => m.module === 'utils');
    expect(core).toBeDefined();
    expect(utils).toBeDefined();
    expect(core!.dimensions['规范层一致性']).toBeGreaterThan(
      utils!.dimensions['规范层一致性']
    );
  });

  it('should penalize any type usage', () => {
    const result = executeReview(testRoot);
    const utils = result.modules.find((m) => m.module === 'utils');
    expect(utils).toBeDefined();
    expect(utils!.dimensions['类型系统']).toBeLessThan(10);
    expect(utils!.issues.some((i) => i.includes('any'))).toBe(true);
  });

  it('should compute overall average', () => {
    const result = executeReview(testRoot);
    expect(result.overall_average).toBeGreaterThanOrEqual(0);
    expect(result.overall_average).toBeLessThanOrEqual(10);
  });

  it('return zero for missing src/', () => {
    const emptyRoot = join(tmpdir(), 'mumuspec-empty-' + Date.now());
    mkdirSync(emptyRoot, { recursive: true });
    const result = executeReview(emptyRoot);
    expect(result.modules_reviewed).toBe(0);
    expect(result.overall_average).toBe(0);
    rmSync(emptyRoot, { recursive: true, force: true });
  });
});
