import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

describe('CLI end-to-end', () => {
  let projectDir: string;
  const cliPath = join(process.cwd(), 'dist', 'cli.js');

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mumuspec-test-'));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('should show version', () => {
    const output = execSync(`node "${cliPath}" --version`, { encoding: 'utf8' });
    expect(output.trim()).toBe('0.10.0');
  });

  it('should show help', () => {
    const output = execSync(`node "${cliPath}" --help`, { encoding: 'utf8' });
    expect(output).toContain('mumuspec');
    expect(output).toContain('init');
    expect(output).toContain('context');
    expect(output).toContain('validate');
    expect(output).toContain('new');
  });

  it('should init a project', () => {
    const output = execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('MumuSpec initialized');

    // Check files were created
    expect(existsSync(join(projectDir, '.mumuspec', 'config.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'spec.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'design.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'prohibitions.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'index.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.cursorrules'))).toBe(true);
    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(true);

    // Check spec.md has Ponytail constraints
    const specContent = readFileSync(join(projectDir, '.mumuspec', 'spec.md'), 'utf8');
    expect(specContent).toContain('Ponytail');
  });

  it('should run doctor after init', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" doctor`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('MumuSpec Doctor');
    expect(output).toContain('Node.js');
    expect(output).toContain('Project root');
    expect(output).toContain('Config: ✓');
    expect(output).toContain('Root spec: ✓');
  });

  it('should create and list a change', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    // Create change
    const newOutput = execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(newOutput).toContain('Change "feature-1" created');
    expect(newOutput).toContain('Workflow: full');

    // List changes
    const listOutput = execSync(`node "${cliPath}" list`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(listOutput).toContain('feature-1');
    expect(listOutput).toContain('open');
  });

  it('should show change status', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      cwd: projectDir,
    });

    const statusOutput = execSync(`node "${cliPath}" status feature-1`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(statusOutput).toContain('变更: feature-1');
    expect(statusOutput).toContain('Phase: open');
    expect(statusOutput).toContain('Workflow: full');
  });

  it('should transition state', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      cwd: projectDir,
    });

    // Transition to design
    const output = execSync(`node "${cliPath}" state transition feature-1 design`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('Transitioned');
    expect(output).toContain('open → design');
  });

  it('should validate specs', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" validate`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    // Should have some output (warnings are ok, errors would cause exit code 1)
    expect(output).toBeDefined();
  });

  it('should run check', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" check --shall-not`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toBeDefined();
  });

  it('should run drift detection', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" drift`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('drift');
  });

  it('should search specs', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" search "Ponytail"`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('result');
    expect(output).toContain('Ponytail');
  });

  it('should prevent creating second active change', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      cwd: projectDir,
    });

    expect(() => {
      execSync(`node "${cliPath}" new feature-2 --workflow full`, {
        cwd: projectDir,
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('should discard a change', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" discard feature-1 --reason "testing"`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('discarded');

    // Should have no active changes
    const listOutput = execSync(`node "${cliPath}" list`, {
      encoding: 'utf8',
      cwd: projectDir,
    });
    expect(listOutput).toContain('No active changes');
  });

  it('should init and lock test cases', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    execSync(`node "${cliPath}" new feature-1 --workflow full`, {
      cwd: projectDir,
    });

    // Init test cases
    execSync(`node "${cliPath}" test-cases init feature-1 --layers 0`, {
      cwd: projectDir,
    });

    // Lock test cases
    const lockOutput = execSync(`node "${cliPath}" test-cases lock feature-1`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(lockOutput).toContain('locked');

    // Verify test cases
    const verifyOutput = execSync(`node "${cliPath}" test-cases verify feature-1`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(verifyOutput).toContain('verified');
  });

  it('should list knowledge pages (empty)', () => {
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" knowledge list`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('No knowledge pages');
  });
});
