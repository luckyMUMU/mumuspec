import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// Read version from package.json so version bumps don't break this test.
const pkgVersion = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
).version as string;

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
    expect(output.trim()).toBe(pkgVersion);
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

    expect(output).toContain('Initialized Successfully');
    expect(output).toContain('Project Analysis');

    // Check files were created
    expect(existsSync(join(projectDir, '.mumuspec', 'config.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'spec.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'design.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'prohibitions.md'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'index.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, 'CLAUDE.md'))).toBe(true);
    // D2（goal-p0-dispatch-gate）：.cursorrules/.windsurfrules 遗留格式已停止生成
    expect(existsSync(join(projectDir, '.cursorrules'))).toBe(false);
    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(true);

    // Check knowledge base was populated
    expect(existsSync(join(projectDir, '.mumuspec', 'knowledge', '_index.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'knowledge', 'decisions'))).toBe(true);
    expect(existsSync(join(projectDir, '.mumuspec', 'knowledge', 'lessons'))).toBe(true);

    // Check spec.md has Ponytail constraints and auto-generated content
    const specContent = readFileSync(join(projectDir, '.mumuspec', 'spec.md'), 'utf8');
    expect(specContent).toContain('Ponytail');
    expect(specContent).toContain('Project Structure Standards');
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

    // Transition to design (requires --confirm for blocking point BP-3)
    const output = execSync(`node "${cliPath}" state transition feature-1 design --confirm`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    expect(output).toContain('Transitioned');
    expect(output).toContain('open → design');
    expect(output).toContain('BP-3');
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

    const output = execSync(`node "${cliPath}" discard --confirm feature-1 --reason "testing"`, {
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

  it('should list knowledge pages (auto-populated after init)', () => {
    // Init populates the knowledge base with default pages
    execSync(`node "${cliPath}" init "${projectDir}" --name test-project`, {
      cwd: projectDir,
    });

    const output = execSync(`node "${cliPath}" knowledge list`, {
      encoding: 'utf8',
      cwd: projectDir,
    });

    // After init, knowledge base contains auto-generated pages
    expect(output).toContain('KP-');
    expect(output).toContain('Project type');
  });

  it('should show install help', () => {
    const output = execSync(`node "${cliPath}" install --help`, { encoding: 'utf8' });
    expect(output).toContain('catpaw');
    expect(output).toContain('claude');
    expect(output).toContain('cursor');
  });

  it('should show install subcommand help', () => {
    const output = execSync(`node "${cliPath}" install catpaw --help`, { encoding: 'utf8' });
    expect(output).toContain('list');
    expect(output).toContain('search');
    expect(output).toContain('target');
  });

  it('should list install packages for catpaw', () => {
    const output = execSync(`node "${cliPath}" install catpaw --list`, { encoding: 'utf8' });
    expect(output).toContain('browser');
    expect(output).toContain('pdf');
    expect(output).toContain('pptx');
    expect(output).toContain('xlsx');
    expect(output).toContain('docx');
  });

  it('should search install packages', () => {
    const output = execSync(`node "${cliPath}" install catpaw --search doc`, { encoding: 'utf8' });
    expect(output).toContain('pdf');
    expect(output).toContain('docx');
  });

  it('should show no search results for unknown keyword', () => {
    const output = execSync(`node "${cliPath}" install catpaw --search nonexistent`, { encoding: 'utf8' });
    expect(output).toContain('No packages match');
  });

  it('should error on install with no packages', () => {
    expect(() => {
      execSync(`node "${cliPath}" install catpaw`, { stdio: 'pipe' });
    }).toThrow();
  });

  it('should error on unknown package', () => {
    expect(() => {
      execSync(`node "${cliPath}" install catpaw nonexistent-pkg`, { stdio: 'pipe' });
    }).toThrow();
  });

  it('should error on workspace target without workspace-path', () => {
    expect(() => {
      execSync(`node "${cliPath}" install catpaw browser --target workspace`, { stdio: 'pipe' });
    }).toThrow();
  });

  it('should require --list for claude agent install', () => {
    expect(() => {
      execSync(`node "${cliPath}" install claude`, { stdio: 'pipe' });
    }).toThrow();
  });

  it('should require --list for cursor agent install', () => {
    expect(() => {
      execSync(`node "${cliPath}" install cursor`, { stdio: 'pipe' });
    }).toThrow();
  });

  // === MCP install tests ===

  it('should list MCP presets', () => {
    const output = execSync(`node "${cliPath}" install mcp --list`, { encoding: 'utf8' });
    expect(output).toContain('mumuspec');
    expect(output).toContain('MCP server');
  });

  it('should install MCP config to workspace', () => {
    const output = execSync(
      `node "${cliPath}" install mcp mumuspec --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Installed MCP config');

    // Verify .mcp.json was created
    const mcpConfigPath = join(projectDir, '.mcp.json');
    expect(existsSync(mcpConfigPath)).toBe(true);

    // Verify content
    const config = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers.mumuspec).toBeDefined();
    expect(config.mcpServers.mumuspec.command).toBe('npx');
  });

  it('should list installed MCP configs', () => {
    // First install an MCP config
    execSync(`node "${cliPath}" install mcp mumuspec --workspace-path "${projectDir}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(
      `node "${cliPath}" install mcp --installed --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('mumuspec');
  });

  it('should error on unknown MCP preset', () => {
    expect(() => {
      execSync(`node "${cliPath}" install mcp unknown-server --workspace-path "${projectDir}"`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  // === Command install tests ===

  it('should list command presets', () => {
    const output = execSync(`node "${cliPath}" install command --list`, { encoding: 'utf8' });
    expect(output).toContain('mumuspec');
    expect(output).toContain('command');
  });

  it('should install custom command to workspace', () => {
    const output = execSync(
      `node "${cliPath}" install command /mumuspec --target workspace --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Installed command');
    expect(output).toContain('/mumuspec');

    // Verify command file was created
    const cmdPath = join(projectDir, '.catpaw', 'commands', 'mumuspec.md');
    expect(existsSync(cmdPath)).toBe(true);
  });

  it('should error on unknown command preset', () => {
    expect(() => {
      execSync(`node "${cliPath}" install command /unknown`, { stdio: 'pipe' });
    }).toThrow();
  });

  // === mumuspec-workflow skill test ===

  it('should include mumuspec-workflow in available packages', () => {
    const output = execSync(`node "${cliPath}" install catpaw --list`, { encoding: 'utf8' });
    expect(output).toContain('mumuspec-workflow');
  });

  // === Hooks tests ===

  it('should show hooks help', () => {
    const output = execSync(`node "${cliPath}" hooks --help`, { encoding: 'utf8' });
    expect(output).toContain('install');
    expect(output).toContain('uninstall');
    expect(output).toContain('status');
    expect(output).toContain('run');
  });

  it('should install hooks to workspace with git', () => {
    // Init git repo first
    execSync(`git init "${projectDir}"`, { encoding: 'utf8', stdio: 'pipe' });

    const output = execSync(
      `node "${cliPath}" hooks install --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('installed');

    // Verify pre-commit hook exists
    expect(existsSync(join(projectDir, '.git', 'hooks', 'pre-commit'))).toBe(true);
  });

  it('should show hooks status', () => {
    const output = execSync(
      `node "${cliPath}" hooks status --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('pre-commit');
  });

  it('should run pre-commit hook logic', () => {
    // Init git first so hooks can be installed/run properly
    execSync(`git init "${projectDir}"`, { encoding: 'utf8', stdio: 'pipe' });
    execSync(`node "${cliPath}" init "${projectDir}" --name hook-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(
      `node "${cliPath}" hooks run pre-commit --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Hook passed');
  });

  it('should uninstall hooks', () => {
    // Init git and install hooks first
    execSync(`git init "${projectDir}"`, { encoding: 'utf8', stdio: 'pipe' });
    execSync(
      `node "${cliPath}" hooks install --workspace-path "${projectDir}"`,
      { encoding: 'utf8', stdio: 'pipe' },
    );

    const output = execSync(
      `node "${cliPath}" hooks uninstall --workspace-path "${projectDir}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Removed');

    // Verify hooks removed
    expect(existsSync(join(projectDir, '.git', 'hooks', 'pre-commit'))).toBe(false);
  });

  it('should error running hook without git repo', () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'mumuspec-nogit-'));
    try {
      expect(() => {
        execSync(`node "${cliPath}" hooks install --workspace-path "${noGitDir}"`, {
          stdio: 'pipe',
        });
      }).toThrow();
    } finally {
      rmSync(noGitDir, { recursive: true, force: true });
    }
  });

  // === Dashboard tests ===

  it('should show dashboard help', () => {
    const output = execSync(`node "${cliPath}" dashboard --help`, { encoding: 'utf8' });
    expect(output).toContain('workspace-path');
    expect(output).toContain('json');
  });

  it('should show dashboard with no active change', () => {
    // Init a fresh project
    const dashProject = mkdtempSync(join(tmpdir(), 'mumuspec-dash-'));
    execSync(`node "${cliPath}" init "${dashProject}" --name dash-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(`node "${cliPath}" dashboard --workspace-path "${dashProject}"`, {
      encoding: 'utf8',
    });
    expect(output).toContain('DASHBOARD');
    expect(output).toContain('No active change');

    rmSync(dashProject, { recursive: true, force: true });
  });

  it('should output dashboard as JSON', () => {
    const dashProject = mkdtempSync(join(tmpdir(), 'mumuspec-dashjson-'));
    execSync(`node "${cliPath}" init "${dashProject}" --name dash-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(
      `node "${cliPath}" dashboard --workspace-path "${dashProject}" --json`,
      { encoding: 'utf8' },
    );
    const data = JSON.parse(output);
    expect(data.project).toBe('dash-test');
    expect(data.hooks).toBeDefined();

    rmSync(dashProject, { recursive: true, force: true });
  });

  // === Eval tests ===

  it('should show eval help', () => {
    const output = execSync(`node "${cliPath}" eval --help`, { encoding: 'utf8' });
    expect(output).toContain('init');
    expect(output).toContain('list');
    expect(output).toContain('run');
  });

  it('should init evals directory with samples', () => {
    const evalProject = mkdtempSync(join(tmpdir(), 'mumuspec-eval-'));
    execSync(`node "${cliPath}" init "${evalProject}" --name eval-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(`node "${cliPath}" eval init --workspace-path "${evalProject}"`, {
      encoding: 'utf8',
    });
    expect(output).toContain('sample-compliance');
    expect(output).toContain('sample-drift');

    // Verify files exist
    expect(existsSync(join(evalProject, '.mumuspec', 'evals', 'sample-compliance.yaml'))).toBe(true);

    rmSync(evalProject, { recursive: true, force: true });
  });

  it('should list eval scenarios', () => {
    const evalProject = mkdtempSync(join(tmpdir(), 'mumuspec-evallist-'));
    execSync(`node "${cliPath}" init "${evalProject}" --name eval-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    execSync(`node "${cliPath}" eval init --workspace-path "${evalProject}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(`node "${cliPath}" eval list --workspace-path "${evalProject}"`, {
      encoding: 'utf8',
    });
    expect(output).toContain('sample-compliance');
    expect(output).toContain('sample-drift');

    rmSync(evalProject, { recursive: true, force: true });
  });

  // === Bundle tests ===

  it('should show bundle help', () => {
    const output = execSync(`node "${cliPath}" bundle --help`, { encoding: 'utf8' });
    expect(output).toContain('create');
    expect(output).toContain('validate');
    expect(output).toContain('install');
  });

  it('should create a bundle', () => {
    const bundleProject = mkdtempSync(join(tmpdir(), 'mumuspec-bundle-'));
    execSync(`node "${cliPath}" init "${bundleProject}" --name bundle-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Create at least one skill file so the bundle has content
    const skillDir = join(bundleProject, '.mumuspec', 'skills', 'test-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# Test Skill\n\nA test skill for bundling.\n');

    const output = execSync(
      `node "${cliPath}" bundle create test-bundle --workspace-path "${bundleProject}"`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Bundle created');

    // Verify manifest exists
    expect(existsSync(join(bundleProject, '.mumuspec', 'bundles', 'test-bundle.json'))).toBe(true);

    rmSync(bundleProject, { recursive: true, force: true });
  });

  it('should error on bundle without skills', () => {
    const bundleProject = mkdtempSync(join(tmpdir(), 'mumuspec-bundleempty-'));
    // Don't init mumuspec in this dir — just create an empty dir
    expect(() => {
      execSync(`node "${cliPath}" bundle create --workspace-path "${bundleProject}"`, {
        stdio: 'pipe',
      });
    }).toThrow();
    rmSync(bundleProject, { recursive: true, force: true });
  });

  // === Skill authoring tests ===

  it('should show skill help', () => {
    const output = execSync(`node "${cliPath}" skill --help`, { encoding: 'utf8' });
    expect(output).toContain('init');
    expect(output).toContain('validate');
    expect(output).toContain('scaffold');
  });

  it('should scaffold a new skill', () => {
    const skillProject = mkdtempSync(join(tmpdir(), 'mumuspec-skill-'));
    execSync(`node "${cliPath}" init "${skillProject}" --name skill-test`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const output = execSync(
      `node "${cliPath}" skill scaffold my-skill --workspace-path "${skillProject}" --type analysis`,
      { encoding: 'utf8' },
    );
    expect(output).toContain('Scaffolded skill');
    expect(output).toContain('my-skill');

    // Verify files exist
    expect(existsSync(join(skillProject, '.mumuspec', 'skills', 'my-skill', 'SKILL.md'))).toBe(true);

    rmSync(skillProject, { recursive: true, force: true });
  });

  // === i18n tests ===

  it('should show i18n status', () => {
    const output = execSync(`node "${cliPath}" i18n status`, { encoding: 'utf8' });
    expect(output).toContain('Current locale');
  });
});
