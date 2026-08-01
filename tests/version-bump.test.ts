import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bumpVersionForArchive } from '../src/change/manager.js';

function setupProject(dir: string, version: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'test-project', version }, null, 2) + '\n',
  );
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(
    join(dir, 'src', 'cli.ts'),
    `import { program } from 'commander';\nprogram.version('${version}');\n`,
  );
}

describe('bumpVersionForArchive', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mumuspec-version-test-'));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('should bump patch version for tweak workflow with prerelease tag', () => {
    setupProject(projectDir, '0.13.0-alpha.2');
    const result = bumpVersionForArchive(projectDir, 'tweak');
    expect(result).toBe('0.13.0-alpha.3');

    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));
    expect(pkg.version).toBe('0.13.0-alpha.3');
  });

  it('should bump patch version for hotfix workflow', () => {
    setupProject(projectDir, '1.2.3-beta.1');
    const result = bumpVersionForArchive(projectDir, 'hotfix');
    expect(result).toBe('1.2.3-beta.2');
  });

  it('should bump minor version for full workflow', () => {
    setupProject(projectDir, '0.13.0-alpha.2');
    const result = bumpVersionForArchive(projectDir, 'full');
    expect(result).toBe('0.14.0-alpha.0');
  });

  it('should add alpha.0 when no prerelease tag exists', () => {
    setupProject(projectDir, '1.0.0');
    const result = bumpVersionForArchive(projectDir, 'full');
    expect(result).toBe('1.0.1-alpha.0');
  });

  it('should add tag.0 when tag exists without number', () => {
    setupProject(projectDir, '2.0.0-rc');
    const result = bumpVersionForArchive(projectDir, 'tweak');
    expect(result).toBe('2.0.0-rc.0');
  });

  it('should sync version to src/cli.ts', () => {
    setupProject(projectDir, '0.1.0-alpha.0');
    bumpVersionForArchive(projectDir, 'tweak');

    const cliContent = readFileSync(join(projectDir, 'src', 'cli.ts'), 'utf8');
    expect(cliContent).toContain("version('0.1.0-alpha.1')");
  });

  it('should return null when package.json missing', () => {
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    // Don't create package.json
    const result = bumpVersionForArchive(projectDir, 'full');
    expect(result).toBeNull();
  });

  it('should return null when version format is invalid', () => {
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'test', version: 'invalid' }, null, 2),
    );
    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(join(projectDir, 'src', 'cli.ts'), "program.version('invalid');");
    const result = bumpVersionForArchive(projectDir, 'full');
    expect(result).toBeNull();
  });

  it('should not throw when src/cli.ts missing (json-only projects)', () => {
    setupProject(projectDir, '1.0.0');
    // Remove cli.ts
    rmSync(join(projectDir, 'src', 'cli.ts'));
    const result = bumpVersionForArchive(projectDir, 'full');
    expect(result).toBeNull();
  });
});
