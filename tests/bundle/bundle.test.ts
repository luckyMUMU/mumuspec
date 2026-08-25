/**
 * Tests for src/bundle/packager.ts — bundle creation and validation utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  validateBundle,
  listBundles,
} from '../../src/bundle/packager.js';

describe('bundle module', () => {
  const testDir = join(tmpdir(), `mumuspec-bundle-test-${Date.now()}`);
  const projectDir = join(testDir, 'project');

  beforeEach(() => {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, '.mumuspec'), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('validateBundle returns valid=false for nonexistent path', () => {
    const result = validateBundle('/nonexistent/path');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validateBundle returns valid=false for invalid tarball', () => {
    const invalidPath = join(projectDir, 'invalid.tgz');
    writeFileSync(invalidPath, 'not a valid tarball');
    const result = validateBundle(invalidPath);
    expect(result.valid).toBe(false);
  });

  it('listBundles returns empty array when no bundles exist', () => {
    const bundles = listBundles(projectDir);
    expect(bundles).toBeInstanceOf(Array);
    expect(bundles).toHaveLength(0);
  });
});
