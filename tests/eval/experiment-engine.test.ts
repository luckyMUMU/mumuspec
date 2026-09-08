/**
 * Tests for experiment engine — parallel evolution loop core logic.
 *
 * Tests focus on the generateDirections function and state management
 * that don't require git operations (which need a full git repo setup).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateDirections,
} from '../../src/eval/experiment-engine.js';
import type { ExperimentConfig } from '../../../src/eval/types-experiment.js';

const testRoot = join(tmpdir(), 'mumuspec-experiment-test-' + Date.now());

function setupTestProject(withLargeFiles = false, withCliModule = false) {
  // Clean up first
  if (existsSync(testRoot)) {
    rmSync(testRoot, { recursive: true, force: true });
  }

  mkdirSync(testRoot, { recursive: true });
  mkdirSync(join(testRoot, 'src'), { recursive: true });
  mkdirSync(join(testRoot, 'src', 'core'), { recursive: true });

  // Create some source files
  const smallContent = `export function helper(): string { return 'ok'; }\nexport const VERSION = '1.0.0';\n`;
  writeFileSync(join(testRoot, 'src', 'core', 'utils.ts'), smallContent);

  if (withLargeFiles) {
    // Create a large file (>500 lines)
    let largeContent = '';
    for (let i = 0; i < 600; i++) {
      largeContent += `export function func${i}(): number { return ${i}; }\n`;
    }
    writeFileSync(join(testRoot, 'src', 'core', 'large-module.ts'), largeContent);
  }

  if (withCliModule) {
    mkdirSync(join(testRoot, 'src', 'cli', 'commands'), { recursive: true });
    writeFileSync(join(testRoot, 'src', 'cli', 'commands', 'change.ts'), smallContent);
  }

  // Create tests directory
  mkdirSync(join(testRoot, 'tests'), { recursive: true });
  writeFileSync(join(testRoot, 'tests', 'utils.test.ts'), `import { describe, it } from 'vitest';\n`);
}

function cleanup() {
  if (existsSync(testRoot)) {
    rmSync(testRoot, { recursive: true, force: true });
  }
}

describe('experiment engine — direction generation', () => {
  beforeEach(() => setupTestProject());
  afterEach(cleanup);

  it('should generate default directions (up to 5)', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    expect(directions.length).toBeGreaterThan(0);
    expect(directions.length).toBeLessThanOrEqual(5);
  });

  it('should respect direction count limit', () => {
    const config: ExperimentConfig = {
      directionCount: 2,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    expect(directions.length).toBeLessThanOrEqual(2);
  });

  it('should include performance direction when large files detected', () => {
    setupTestProject(true, false);

    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    const hasPerfDirection = directions.some((d) => d.category === 'performance');
    expect(hasPerfDirection).toBe(true);
  });

  it('should include CLI UX direction when CLI module exists', () => {
    setupTestProject(false, true);

    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    const hasCliDirection = directions.some((d) =>
      d.description.toLowerCase().includes('interactive') ||
      d.description.toLowerCase().includes('prompt') ||
      d.description.toLowerCase().includes('cli')
    );
    expect(hasCliDirection).toBe(true);
  });

  it('should filter by focus categories', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
      focusCategories: ['performance'],
    };

    const directions = generateDirections(testRoot, config);
    // All returned directions should be in the focused categories
    for (const dir of directions) {
      expect(config.focusCategories).toContain(dir.category);
    }
  });

  it('should use manual directions when provided', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: false,
      manualDirections: [
        {
          id: 'custom-1',
          name: 'Custom Direction',
          description: 'A test direction',
          category: 'feature',
          riskLevel: 1,
          affectedFiles: ['src/test.ts'],
          changeSummary: 'Test change',
          expectedBenefit: 'Testing',
        },
      ],
    };

    const directions = generateDirections(testRoot, config);
    expect(directions.length).toBe(1);
    expect(directions[0].id).toBe('custom-1');
    expect(directions[0].name).toBe('Custom Direction');
  });

  it('should assign unique IDs to each direction', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    const ids = directions.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid risk levels (1-5)', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    for (const dir of directions) {
      expect(dir.riskLevel).toBeGreaterThanOrEqual(1);
      expect(dir.riskLevel).toBeLessThanOrEqual(5);
    }
  });

  it('should set adopted=false for all new directions', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    for (const dir of directions) {
      expect(dir.adopted).toBe(false);
    }
  });
});

describe('experiment engine — direction structure', () => {
  beforeEach(() => setupTestProject());
  afterEach(cleanup);

  it('should include all required fields in directions', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    for (const dir of directions) {
      expect(dir).toHaveProperty('id');
      expect(dir).toHaveProperty('name');
      expect(dir).toHaveProperty('description');
      expect(dir).toHaveProperty('category');
      expect(dir).toHaveProperty('riskLevel');
      expect(dir).toHaveProperty('affectedFiles');
      expect(dir).toHaveProperty('changeSummary');
      expect(dir).toHaveProperty('expectedBenefit');
      expect(dir).toHaveProperty('adopted');
    }
  });

  it('should have non-empty critical fields', () => {
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    for (const dir of directions) {
      expect(dir.id.length).toBeGreaterThan(0);
      expect(dir.name.length).toBeGreaterThan(0);
      expect(dir.description.length).toBeGreaterThan(0);
      expect(dir.category.length).toBeGreaterThan(0);
    }
  });

  it('should have valid categories', () => {
    const validCategories = ['performance', 'usability', 'robustness', 'maintainability', 'feature', 'security'];
    const config: ExperimentConfig = {
      directionCount: 5,
      maxMetaRounds: 2,
      demoChangeName: 'test-change',
      demoProjectPath: join(testRoot, 'demo'),
      autoGenerate: true,
    };

    const directions = generateDirections(testRoot, config);
    for (const dir of directions) {
      expect(validCategories).toContain(dir.category);
    }
  });
});
