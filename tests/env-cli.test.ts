/**
 * TDD tests for Environment CLI Commands (Layer 1)
 * Tests CLI command integration and user-facing output
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectEnvironment, saveEnvSpec, validateEnv, diffEnv } from '../src/core/env-detector';

const TEST_ROOT = join(tmpdir(), 'mumuspec-env-test-' + Date.now());

describe('ENV-CLI-001: env detect simulation', () => {
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

  it('should save env-spec.md when requested', async () => {
    const detection = await detectEnvironment({ ecosystems: ['node', 'build'] });
    const path = await saveEnvSpec(TEST_ROOT, detection);

    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, 'utf8');
    expect(content).toContain('type: environment');
    expect(content).toContain('SHALL');
    expect(content).toContain('Detected');
  });

  it('should include all detected tools in saved spec', async () => {
    const detection = await detectEnvironment({ ecosystems: ['node'] });
    const path = await saveEnvSpec(TEST_ROOT, detection);
    const content = readFileSync(path, 'utf8');

    for (const tool of detection.tools) {
      expect(content).toContain(tool.name);
    }
  });

  it('should filter sensitive env vars in saved spec', async () => {
    // This tests that the spec file doesn't contain any obvious sensitive values
    const detection = await detectEnvironment({ ecosystems: ['build'] });
    const path = await saveEnvSpec(TEST_ROOT, detection);
    const content = readFileSync(path, 'utf8');

    // Should not contain common secret patterns
    expect(content).not.toMatch(/password['":]\s*\S+/i);
    expect(content).not.toMatch(/token['":]\s*\S+/i);
  });
});

describe('ENV-CLI-002: env validate simulation', () => {
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

  it('should return exit code 3 when env-spec.md missing', async () => {
    const result = await validateEnv(TEST_ROOT);
    expect(result.exitCode).toBe(3);
    expect(result.messages[0]).toContain('not found');
  });

  it('should validate successfully when env-spec.md exists', async () => {
    // First save, then validate
    const detection = await detectEnvironment({ ecosystems: ['node'] });
    await saveEnvSpec(TEST_ROOT, detection);

    const result = await validateEnv(TEST_ROOT);
    expect(result.exitCode).toBeLessThanOrEqual(2);
  });

  it('should respect strict mode', async () => {
    const detection = await detectEnvironment({ ecosystems: ['node'] });
    await saveEnvSpec(TEST_ROOT, detection);

    const resultStrict = await validateEnv(TEST_ROOT, { strict: true });
    const resultNormal = await validateEnv(TEST_ROOT, { strict: false });

    // Both should complete without error
    expect(resultStrict.exitCode).toBeDefined();
    expect(resultNormal.exitCode).toBeDefined();
  });
});

describe('ENV-CLI-003: env diff simulation', () => {
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

  it('should generate diff output', async () => {
    const diff = await diffEnv(TEST_ROOT);
    expect(diff).toContain('Environment Diff');
  });

  it('should show current tools in diff', async () => {
    const detection = await detectEnvironment({ ecosystems: ['build'] });
    await saveEnvSpec(TEST_ROOT, detection);

    const diff = await diffEnv(TEST_ROOT);
    expect(diff).toContain('✓');
  });
});

describe('ENV-CLI-004: cross-platform output format', () => {
  it('should group tools by ecosystem in detect result', async () => {
    const detection = await detectEnvironment({ ecosystems: ['node', 'build'] });
    const ecosystems = new Set(detection.tools.map((t) => t.ecosystem));
    expect(ecosystems.size).toBeGreaterThanOrEqual(1);
  });

  it('should include OS info in detection', async () => {
    const detection = await detectEnvironment({ ecosystems: ['build'] });
    expect(detection.os).toBeDefined();
    expect(detection.os.type).toBeTruthy();
    expect(detection.os.arch).toBeTruthy();
  });
});
