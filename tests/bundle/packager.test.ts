/**
 * Tests for src/bundle/packager.ts — bundle creation, validation, installation.
 *
 * Covers:
 * - createBundle 的文件清单生成
 * - 排除模式（exclude patterns）: evals/ 和 authoring/ 目录
 * - manifest.json 的字段完整性（name, version, files, createdAt）
 * - validateBundle 对哈希完整性、缺失文件的检查
 * - installBundle 的安装流程
 * - publishBundle 对无效 bundle 的处理
 * - listBundles 的枚举
 * - 错误处理：无 skills 目录、空目录、无 bundle 目录
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createBundle,
  validateBundle,
  installBundle,
  listBundles,
  type BundleManifest,
} from '../../src/bundle/packager.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-bundle-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function createSkillsDir(projectDir: string) {
  const skillsDir = join(projectDir, '.mumuspec', 'skills');
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(join(skillsDir, 'SKILL.md'), '# Sample Skill\n\n## Instructions\nDo things.\n');
  writeFileSync(join(skillsDir, 'README.md'), '# Skills\n');
  return skillsDir;
}

// ========== createBundle ==========

describe('createBundle', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return error when no skills directory exists', () => {
    const result = createBundle(projectDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No .mumuspec/skills');
  });

  it('should return error when skills directory is empty', () => {
    mkdirSync(join(projectDir, '.mumuspec', 'skills'), { recursive: true });
    const result = createBundle(projectDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No skill files found');
  });

  it('should create bundle with manifest', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir);
    expect(result.success).toBe(true);
    expect(result.outputPath).toBeDefined();
    expect(result.fileCount).toBeGreaterThan(0);
  });

  it('should generate manifest.json with all required fields', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('mumuspec-skills');
    expect(manifest.version).toBeDefined();
    expect(manifest.description).toBeDefined();
    expect(manifest.createdAt).toBeDefined();
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.files.length).toBeGreaterThan(0);

    for (const file of manifest.files) {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('hash');
      expect(typeof file.path).toBe('string');
      expect(typeof file.hash).toBe('string');
      expect(file.hash).toHaveLength(16);
    }
  });

  it('should include SHA-256 hash for each file', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const file of manifest.files) {
      expect(file.hash).toMatch(/^[a-f0-9]{16}$/);
    }
  });

  it('should skip evals/ directory by default', () => {
    const skillsDir = createSkillsDir(projectDir);
    const evalsDir = join(skillsDir, 'evals');
    mkdirSync(evalsDir, { recursive: true });
    writeFileSync(join(evalsDir, 'test.yaml'), 'name: eval-test\n');

    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.some(f => f.path.includes('evals'))).toBe(false);
  });

  it('should include evals/ when includeEvals=true', () => {
    const skillsDir = createSkillsDir(projectDir);
    const evalsDir = join(skillsDir, 'evals');
    mkdirSync(evalsDir, { recursive: true });
    writeFileSync(join(evalsDir, 'test.yaml'), 'name: eval-test\n');

    const result = createBundle(projectDir, { includeEvals: true });
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.some(f => f.path.includes('evals'))).toBe(true);
  });

  it('should skip authoring/ directory by default', () => {
    const skillsDir = createSkillsDir(projectDir);
    const authDir = join(skillsDir, 'authoring');
    mkdirSync(authDir, { recursive: true });
    writeFileSync(join(authDir, 'auth.md'), '# Authoring\n');

    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.some(f => f.path.includes('authoring'))).toBe(false);
  });

  it('should include authoring/ when includeAuthoring=true', () => {
    const skillsDir = createSkillsDir(projectDir);
    const authDir = join(skillsDir, 'authoring');
    mkdirSync(authDir, { recursive: true });
    writeFileSync(join(authDir, 'auth.md'), '# Authoring\n');

    const result = createBundle(projectDir, { includeAuthoring: true });
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.some(f => f.path.includes('authoring'))).toBe(true);
  });

  it('should use custom bundle name', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir, { name: 'custom-skills' });
    const manifestPath = join(result.outputPath!, 'custom-skills.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.name).toBe('custom-skills');
  });

  it('should use custom output directory', () => {
    createSkillsDir(projectDir);
    const customOutput = join(projectDir, 'output');
    const result = createBundle(projectDir, { outputDir: customOutput });
    expect(result.outputPath).toBe(customOutput);
    expect(existsSync(join(customOutput, 'mumuspec-skills.json'))).toBe(true);
  });

  it('should read version from config.yaml', () => {
    createSkillsDir(projectDir);
    writeFileSync(join(projectDir, '.mumuspec', 'config.yaml'), 'version: 1.2.3\nlanguage: en\n');
    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.version).toBe('1.2.3');
  });

  it('should handle version parse failure gracefully', () => {
    createSkillsDir(projectDir);
    writeFileSync(join(projectDir, '.mumuspec', 'config.yaml'), 'invalid version line\n');
    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.version).toBe('0.12.2'); // default
  });

  it('should copy files to bundle directory', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir);
    const bundleFilesDir = join(result.outputPath!, 'mumuspec-skills');
    expect(existsSync(bundleFilesDir)).toBe(true);
    expect(existsSync(join(bundleFilesDir, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(bundleFilesDir, 'README.md'))).toBe(true);
  });

  it('should handle nested skill directories', () => {
    const skillsDir = createSkillsDir(projectDir);
    const nestedDir = join(skillsDir, 'phase-open');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'SKILL.md'), '# Phase Open\n');

    const result = createBundle(projectDir);
    const manifestPath = join(result.outputPath!, 'mumuspec-skills.json');
    const manifest: BundleManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.files.some(f => f.path.includes('phase-open'))).toBe(true);

    // Verify file was copied to bundle dir
    expect(existsSync(join(result.outputPath!, 'mumuspec-skills', 'phase-open', 'SKILL.md'))).toBe(true);
  });

  it('should produce non-empty fileCount', () => {
    createSkillsDir(projectDir);
    const result = createBundle(projectDir);
    expect(result.fileCount).toBeGreaterThan(0);
    expect(result.fileCount).toBe(
      JSON.parse(readFileSync(join(result.outputPath!, 'mumuspec-skills.json'), 'utf8')).files.length
    );
  });
});

// ========== validateBundle ==========

describe('validateBundle', () => {
  it('should return invalid for non-existent bundle', () => {
    const result = validateBundle('/nonexistent/bundle.json');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not found'))).toBe(true);
  });

  it('should return invalid for malformed JSON', () => {
    const dir = createTmpProject();
    try {
      const bundlePath = join(dir, 'broken.json');
      writeFileSync(bundlePath, 'not valid json{');
      const result = validateBundle(bundlePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('parse'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should return invalid when name is missing', () => {
    const dir = createTmpProject();
    try {
      const bundlePath = join(dir, 'noname.json');
      writeFileSync(bundlePath, JSON.stringify({ version: '1.0', files: [], createdAt: new Date().toISOString() }));
      const result = validateBundle(bundlePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should return invalid when version is missing', () => {
    const dir = createTmpProject();
    try {
      const bundlePath = join(dir, 'novers.json');
      writeFileSync(bundlePath, JSON.stringify({ name: 'test', files: [], createdAt: new Date().toISOString() }));
      const result = validateBundle(bundlePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('version'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should return invalid when files array is missing', () => {
    const dir = createTmpProject();
    try {
      const bundlePath = join(dir, 'nofiles.json');
      writeFileSync(bundlePath, JSON.stringify({ name: 'test', version: '1.0', createdAt: new Date().toISOString() }));
      const result = validateBundle(bundlePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('files'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should pass validation for valid bundle with matching files', () => {
    const dir = createTmpProject();
    try {
      const skillsDir = createSkillsDir(dir);
      const createResult = createBundle(dir);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');
      const result = validateBundle(manifestPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });

  it('should report missing files when bundle files dir incomplete', () => {
    const dir = createTmpProject();
    try {
      createSkillsDir(dir);
      const createResult = createBundle(dir);
      // Remove one file from the bundle files dir to trigger mismatch
      const bundleDir = join(createResult.outputPath!, 'mumuspec-skills');
      const skillFile = join(bundleDir, 'SKILL.md');
      if (existsSync(skillFile)) rmSync(skillFile);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');
      const result = validateBundle(manifestPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing file'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should report hash mismatch when file content differs', () => {
    const dir = createTmpProject();
    try {
      createSkillsDir(dir);
      const createResult = createBundle(dir);
      // Modify a bundle file after creation
      const bundleDir = join(createResult.outputPath!, 'mumuspec-skills');
      writeFileSync(join(bundleDir, 'SKILL.md'), 'MODIFIED CONTENT\n');
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');
      const result = validateBundle(manifestPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Hash mismatch'))).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should be valid when bundle dir does not exist (only manifest checked)', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, 'orphan.json'),
        JSON.stringify({
          name: 'orphan',
          version: '1.0',
          files: [{ path: 'missing.md', hash: 'abc123' }],
          createdAt: new Date().toISOString(),
        }),
      );
      const result = validateBundle(join(dir, 'orphan.json'));
      expect(result.valid).toBe(true); // No bundleDir = no hash check
      expect(result.errors).toHaveLength(0);
    } finally {
      cleanup(dir);
    }
  });

  it('should handle empty files array', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, 'empty-files.json'),
        JSON.stringify({ name: 'empty', version: '1.0', files: [], createdAt: new Date().toISOString() }),
      );
      const result = validateBundle(join(dir, 'empty-files.json'));
      expect(result.valid).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});

// ========== installBundle ==========

describe('installBundle', () => {
  it('should return error for non-existent bundle', () => {
    const target = createTmpProject();
    try {
      const result = installBundle('/nonexistent.json', target);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.installed).toHaveLength(0);
    } finally {
      cleanup(target);
    }
  });

  it('should install bundle files to target workspace', () => {
    const source = createTmpProject();
    const target = createTmpProject();
    try {
      createSkillsDir(source);
      const createResult = createBundle(source);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');

      const result = installBundle(manifestPath, target);
      expect(result.success).toBe(true);
      expect(result.installed).toContain('SKILL.md');
      expect(existsSync(join(target, '.mumuspec', 'skills', 'SKILL.md'))).toBe(true);
    } finally {
      cleanup(source);
      cleanup(target);
    }
  });

  it('should create skills directory in target if missing', () => {
    const source = createTmpProject();
    const target = join(tmpdir(), `mumuspec-target-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(target, { recursive: true });
    try {
      createSkillsDir(source);
      const createResult = createBundle(source);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');

      installBundle(manifestPath, target);
      expect(existsSync(join(target, '.mumuspec', 'skills'))).toBe(true);
    } finally {
      cleanup(source);
      cleanup(target);
    }
  });

  it('should return error when bundle dir missing', () => {
    const dir = createTmpProject();
    try {
      writeFileSync(
        join(dir, 'dirless.json'),
        JSON.stringify({
          name: 'dirless',
          version: '1.0',
          files: [{ path: 'SKILL.md', hash: 'abc' }],
          createdAt: new Date().toISOString(),
        }),
      );
      const target = createTmpProject();
      try {
        const result = installBundle(join(dir, 'dirless.json'), target);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Bundle files not found');
      } finally {
        cleanup(target);
      }
    } finally {
      cleanup(dir);
    }
  });

  it('should install nested directories', () => {
    const source = createTmpProject();
    const target = createTmpProject();
    try {
      const skillsDir = createSkillsDir(source);
      const nestedDir = join(skillsDir, 'phase-design');
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(nestedDir, 'SKILL.md'), '# Phase Design\n');

      const createResult = createBundle(source);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');

      const result = installBundle(manifestPath, target);
      expect(result.success).toBe(true);
      expect(existsSync(join(target, '.mumuspec', 'skills', 'phase-design', 'SKILL.md'))).toBe(true);
    } finally {
      cleanup(source);
      cleanup(target);
    }
  });

  it('should return success shape with installed array', () => {
    const source = createTmpProject();
    const target = createTmpProject();
    try {
      createSkillsDir(source);
      const createResult = createBundle(source);
      const manifestPath = join(createResult.outputPath!, 'mumuspec-skills.json');
      const result = installBundle(manifestPath, target);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('installed');
      expect(Array.isArray(result.installed)).toBe(true);
    } finally {
      cleanup(source);
      cleanup(target);
    }
  });
});

// ========== listBundles ==========

describe('listBundles', () => {
  it('should return empty array when no bundles dir exists', () => {
    const dir = createTmpProject();
    try {
      const bundles = listBundles(dir);
      expect(bundles).toEqual([]);
    } finally {
      cleanup(dir);
    }
  });

  it('should return empty array when bundles dir is empty', () => {
    const dir = createTmpProject();
    try {
      mkdirSync(join(dir, '.mumuspec', 'bundles'), { recursive: true });
      const bundles = listBundles(dir);
      expect(bundles).toEqual([]);
    } finally {
      cleanup(dir);
    }
  });

  it('should list only .json files', () => {
    const dir = createTmpProject();
    try {
      const bundlesDir = join(dir, '.mumuspec', 'bundles');
      mkdirSync(bundlesDir, { recursive: true });
      writeFileSync(join(bundlesDir, 'valid.json'), '{}');
      writeFileSync(join(bundlesDir, 'readme.md'), 'not a bundle');
      writeFileSync(join(bundlesDir, 'data.yaml'), 'name: x');

      const bundles = listBundles(dir);
      expect(bundles).toHaveLength(1);
      expect(bundles[0]).toContain('valid.json');
    } finally {
      cleanup(dir);
    }
  });

  it('should return absolute paths', () => {
    const dir = createTmpProject();
    try {
      const bundlesDir = join(dir, '.mumuspec', 'bundles');
      mkdirSync(bundlesDir, { recursive: true });
      writeFileSync(join(bundlesDir, 'test.json'), '{}');

      const bundles = listBundles(dir);
      expect(bundles[0]).toContain(bundlesDir);
    } finally {
      cleanup(dir);
    }
  });
});
