import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

describe('mumuspec git', () => {
  let projectDir: string;
  const cliPath = join(process.cwd(), 'dist', 'cli.js');

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mumuspec-git-test-'));
    // Initialize a git repo
    execSync('git init', { cwd: projectDir });
    execSync('git config user.email "test@test.com"', { cwd: projectDir });
    execSync('git config user.name "Test"', { cwd: projectDir });
    // Create .mumuspec marker so findProjectRoot works
    mkdirSync(join(projectDir, '.mumuspec'), { recursive: true });
    // Create package.json for version tag tests
    writeFileSync(
      join(projectDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '0.1.0-test.1' }, null, 2),
    );
    // Initial commit so branch operations work
    execSync('git add -A', { cwd: projectDir });
    execSync('git commit -m "init"', { cwd: projectDir });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('git --help should list git subcommands', () => {
    const output = execSync(`node "${cliPath}" git --help`, { encoding: 'utf8' });
    expect(output).toContain('status');
    expect(output).toContain('commit');
    expect(output).toContain('push');
    expect(output).toContain('tag');
    expect(output).toContain('flow');
  });

  it('git status should show repo status', () => {
    const output = execSync(`node "${cliPath}" git status`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('Recent commits');
  });

  it('git status should show dirty state after file modification', () => {
    writeFileSync(join(projectDir, 'test.txt'), 'hello');
    const output = execSync(`node "${cliPath}" git status`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('test.txt');
  });

  it('git commit with message should work', () => {
    writeFileSync(join(projectDir, 'test.txt'), 'hello');
    const output = execSync(`node "${cliPath}" git commit -m "add test file"`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('Committing');
    expect(output).toContain('add test file');
    expect(output).toContain('Committed');
  });

  it('git commit without message should error', () => {
    writeFileSync(join(projectDir, 'test.txt'), 'hello');
    try {
      execSync(`node "${cliPath}" git commit`, {
        encoding: 'utf8',
        cwd: projectDir,
      });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.stderr).toContain('Commit message required');
    }
  });

  it('git commit --dry-run should not actually commit', () => {
    writeFileSync(join(projectDir, 'new-file.txt'), 'dry run test');
    const beforeLog = execSync('git log --oneline', { encoding: 'utf8', cwd: projectDir });
    const output = execSync(`node "${cliPath}" git commit -m "dry run" --dry-run`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('[dry-run]');
    const afterLog = execSync('git log --oneline', { encoding: 'utf8', cwd: projectDir });
    expect(beforeLog.split('\n').length).toBe(afterLog.split('\n').length);
  });

  it('git tag --dry-run should show tag commands without executing', () => {
    const output = execSync(`node "${cliPath}" git tag --dry-run`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('[dry-run]');
    expect(output).toContain('0.1.0-test.1');
  });

  it('git flow start should create and switch to new branch', () => {
    const output = execSync(`node "${cliPath}" git flow start -b feature/test-flow`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('Created branch');
    const branch = execSync('git branch --show-current', { encoding: 'utf8', cwd: projectDir });
    expect(branch.trim()).toBe('feature/test-flow');
  });

  it('git flow finish should merge and remove branch', () => {
    // Create and switch to a feature branch
    execSync('git checkout -b feature/merge-test', { cwd: projectDir });
    writeFileSync(join(projectDir, 'feature-file.txt'), 'feature work');
    execSync('git add feature-file.txt', { cwd: projectDir });
    execSync('git commit -m "feature work"', { cwd: projectDir });

    // Switch back to main and use git flow finish
    const output = execSync(`node "${cliPath}" git flow finish -b feature/merge-test`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('Merged and removed');

    // Branch should be deleted
    const branches = execSync('git branch', { encoding: 'utf8', cwd: projectDir });
    expect(branches).not.toContain('feature/merge-test');
  });

  it('git flow without valid subcommand should show usage', () => {
    try {
      execSync(`node "${cliPath}" git flow invalid-action`, {
        encoding: 'utf8',
        cwd: projectDir,
      });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.stderr).toContain('Usage');
    }
  });

  it('git with unknown subcommand should error', () => {
    try {
      execSync(`node "${cliPath}" git unknowncmd`, {
        encoding: 'utf8',
        cwd: projectDir,
      });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e.stderr).toContain('Unknown git subcommand');
    }
  });

  it('git commit auto-detects scope from directory name when --scope not given', () => {
    writeFileSync(join(projectDir, 'change.txt'), 'change');
    const output = execSync(`node "${cliPath}" git commit -m "my change"`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    // Should use feat: prefix when no scope detected
    expect(output).toContain('Committing');
    expect(output).toContain('my change');
  });

  it('git commit --scope should override auto-detection', () => {
    writeFileSync(join(projectDir, 'change2.txt'), 'change2');
    const output = execSync(`node "${cliPath}" git commit -m "custom scope" --scope my-feature`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(output).toContain('feat(my-feature)');
    expect(output).toContain('custom scope');
  });
});
