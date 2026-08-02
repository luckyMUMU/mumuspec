/**
 * Environment Detector — 自动检测开发工具和运行时位置
 *
 * 零外部依赖模块，仅使用 Node.js 内置 API。
 * ponytail: 使用Node.js内置child_process和os模块，不引入外部依赖
 */
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arch, platform, release } from 'node:os';
import { promisify } from 'node:util';
import type {
  DetectedTool,
  EnvironmentDetection,
  OSInfo,
  ToolDetectorConfig,
  ToolEcosystem,
  ToolStatus,
} from './types.js';

const execAsync = promisify(exec);

/** 敏感变量过滤模式 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /apikey/i,
  /api_key/i,
  /accesskey/i,
  /access_key/i,
  /credential/i,
  /auth/i,
  /private/i,
  /passwd/i,
];

/** 默认检测超时（毫秒） */
const DEFAULT_TIMEOUT = 1000;

/** 工具检测配置 */
const DETECTOR_CONFIGS: Record<string, ToolDetectorConfig> = {
  jdk: {
    command: 'java -version 2>&1',
    versionRegex: /version "?(1\.\d+|\d+[\d.]*)"?/,
    envVars: ['JAVA_HOME', 'JDK_HOME', 'JAVAC_HOME'],
    locationCmd: platform() === 'win32' ? 'where java 2>/dev/null || where java' : 'which java 2>/dev/null',
  },
  maven: {
    command: 'mvn -version 2>&1',
    versionRegex: /Apache Maven (\d+\.\d+\.\d+)/,
    envVars: ['MAVEN_HOME', 'M2_HOME', 'M2_REPO'],
    locationCmd: platform() === 'win32' ? 'where mvn 2>/dev/null || where mvn' : 'which mvn 2>/dev/null',
  },
  gradle: {
    command: 'gradle -version 2>&1',
    versionRegex: /Gradle (\d+\.\d+\.\d+)/,
    envVars: ['GRADLE_HOME', 'GRADLE_USER_HOME'],
    locationCmd: platform() === 'win32' ? 'where gradle 2>/dev/null || where gradle' : 'which gradle 2>/dev/null',
  },
  node: {
    command: 'node --version',
    versionRegex: /v(\d+\.\d+\.\d+)/,
    envVars: ['NODE_PATH', 'NVM_DIR', 'NVM_BIN', 'NODE_HOME'],
    locationCmd: platform() === 'win32' ? 'where node 2>/dev/null || where node' : 'which node 2>/dev/null',
  },
  npm: {
    command: 'npm --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    envVars: ['npm_config_prefix'],
    locationCmd: platform() === 'win32' ? 'where npm 2>/dev/null || where npm' : 'which npm 2>/dev/null',
  },
  pnpm: {
    command: 'pnpm --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    envVars: ['PNPM_HOME'],
    locationCmd: platform() === 'win32' ? 'where pnpm 2>/dev/null || where pnpm' : 'which pnpm 2>/dev/null',
  },
  yarn: {
    command: 'yarn --version',
    versionRegex: /(\d+\.\d+\.\d+)/,
    envVars: [],
    locationCmd: platform() === 'win32' ? 'where yarn 2>/dev/null || where yarn' : 'which yarn 2>/dev/null',
  },
  python: {
    command: 'python3 --version 2>&1 || python --version 2>&1',
    versionRegex: /Python (\d+\.\d+\.\d+)/,
    envVars: ['VIRTUAL_ENV', 'CONDA_DEFAULT_ENV', 'PYTHONPATH', 'PYENV_ROOT'],
    locationCmd: platform() === 'win32' ? 'where python3 2>/dev/null || where python 2>/dev/null || where python3 || where python' : 'which python3 2>/dev/null || which python 2>/dev/null',
  },
  go: {
    command: 'go version',
    versionRegex: /go version go(\d+\.\d+\.\d+)/,
    envVars: ['GOPATH', 'GOROOT', 'GOBIN'],
    locationCmd: platform() === 'win32' ? 'where go 2>/dev/null || where go' : 'which go 2>/dev/null',
  },
  rust: {
    command: 'rustc --version',
    versionRegex: /rustc (\d+\.\d+\.\d+)/,
    envVars: ['RUSTUP_HOME', 'CARGO_HOME'],
    locationCmd: platform() === 'win32' ? 'where rustc 2>/dev/null || where rustc' : 'which rustc 2>/dev/null',
  },
  docker: {
    command: 'docker --version',
    versionRegex: /Docker version (\d+\.\d+\.\d+)/,
    envVars: ['DOCKER_HOST', 'DOCKER_CONFIG'],
    locationCmd: platform() === 'win32' ? 'where docker 2>/dev/null || where docker' : 'which docker 2>/dev/null',
  },
  git: {
    command: 'git --version',
    versionRegex: /git version (\d+\.\d+\.\d+)/,
    envVars: ['GIT_CONFIG'],
    locationCmd: platform() === 'win32' ? 'where git 2>/dev/null || where git' : 'which git 2>/dev/null',
  },
  make: {
    command: 'make --version',
    versionRegex: /GNU Make (\d+\.\d+)/,
    envVars: [],
    locationCmd: platform() === 'win32' ? 'where make 2>/dev/null || where make' : 'which make 2>/dev/null',
  },
};

/** 工具名称到生态的映射 */
const TOOL_ECOSYSTEM: Record<string, ToolEcosystem> = {
  jdk: 'java',
  maven: 'java',
  gradle: 'java',
  node: 'node',
  npm: 'node',
  pnpm: 'node',
  yarn: 'node',
  python: 'python',
  go: 'go',
  rust: 'rust',
  docker: 'container',
  git: 'build',
  make: 'build',
};

/** 生态对应的工具列表 */
const ECOSYSTEM_TOOLS: Record<ToolEcosystem, string[]> = {
  java: ['jdk', 'maven', 'gradle'],
  node: ['node', 'npm', 'pnpm', 'yarn'],
  python: ['python'],
  go: ['go'],
  rust: ['rust'],
  build: ['git', 'make'],
  container: ['docker'],
};

/**
 * 过滤敏感环境变量
 */
export function filterSensitiveVars(vars: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(key));
    if (!isSensitive) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 获取操作系统信息
 */
export function detectOS(): OSInfo {
  const platformMap: Record<string, 'windows' | 'linux' | 'macos'> = {
    win32: 'windows',
    linux: 'linux',
    darwin: 'macos',
  };

  const archMap: Record<string, 'x64' | 'arm64' | 'x86'> = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'x86',
  };

  const captureEnvVars = ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG'];
  const envVars: Record<string, string> = {};
  for (const v of captureEnvVars) {
    const val = process.env[v];
    if (val) {
      envVars[v] = val;
    }
  }

  return {
    type: platformMap[platform()] || 'linux',
    arch: archMap[arch()] || 'x64',
    version: release(),
    envVars: filterSensitiveVars(envVars),
  };
}

/**
 * 检测单个工具
 */
export async function detectTool(
  name: string,
  config: ToolDetectorConfig,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<DetectedTool> {
  const ecosystem = TOOL_ECOSYSTEM[name] || 'build';
  const result: DetectedTool = {
    name,
    ecosystem,
    version: 'unknown',
    location: '',
    envVars: {},
    status: 'missing' as ToolStatus,
  };

  try {
    // 提取环境变量
    if (config.envVars) {
      for (const envName of config.envVars) {
        const val = process.env[envName];
        if (val) {
          result.envVars[envName] = val;
        }
      }
      result.envVars = filterSensitiveVars(result.envVars);
    }

    // 执行版本查询
    const { stdout, stderr } = await execAsync(config.command, {
      timeout,
      windowsHide: true,
    });
    const output = stdout + stderr;
    const match = config.versionRegex.exec(output);
    if (match) {
      result.version = match[1];
      result.status = 'ok';
    }
  } catch {
    result.status = 'missing';
  }

  // 查询位置
  if (config.locationCmd && result.status === 'ok') {
    try {
      const { stdout } = await execAsync(config.locationCmd, {
        timeout: Math.min(timeout, 500),
        windowsHide: true,
      });
      result.location = stdout.trim().split('\n')[0] || '';
    } catch {
      result.location = '';
    }
  }

  return result;
}

/**
 * 根据项目配置文件推断需要检测的生态
 */
export function detectRequiredEcosystems(projectRoot: string): ToolEcosystem[] {
  const ecosystems = new Set<ToolEcosystem>();

  const fileToEcosystem: Record<string, ToolEcosystem> = {
    'pom.xml': 'java',
    'build.gradle': 'java',
    'build.gradle.kts': 'java',
    'gradlew': 'java',
    'package.json': 'node',
    'go.mod': 'go',
    'Cargo.toml': 'rust',
    'pyproject.toml': 'python',
    'requirements.txt': 'python',
    'setup.py': 'python',
    'setup.cfg': 'python',
    'Pipfile': 'python',
    'poetry.lock': 'python',
    'Makefile': 'build',
    'Dockerfile': 'container',
    '.dockerignore': 'container',
  };

  for (const [file, eco] of Object.entries(fileToEcosystem)) {
    if (existsSync(join(projectRoot, file))) {
      ecosystems.add(eco);
    }
  }

  // 始终检测 build 容器
  ecosystems.add('build');

  return Array.from(ecosystems);
}

/**
 * 执行完整环境检测
 */
export async function detectEnvironment(options?: {
  ecosystems?: ToolEcosystem[];
  projectRoot?: string;
  timeout?: number;
}): Promise<EnvironmentDetection> {
  const timeout = options?.timeout || DEFAULT_TIMEOUT;
  const ecosystems = options?.ecosystems ||
    (options?.projectRoot ? detectRequiredEcosystems(options.projectRoot) : ['build']);

  const os = detectOS();
  const tools: DetectedTool[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  // 收集需要检测的工具
  const toolsToDetect = new Set<string>();
  for (const eco of ecosystems) {
    const ecoTools = ECOSYSTEM_TOOLS[eco] || [];
    for (const tool of ecoTools) {
      toolsToDetect.add(tool);
    }
  }

  // 并行检测所有工具
  const detectionTasks = Array.from(toolsToDetect).map(async (toolName) => {
    const config = DETECTOR_CONFIGS[toolName];
    if (!config) return null;
    return detectTool(toolName, config, timeout);
  });

  const results = await Promise.all(detectionTasks);

  for (const result of results) {
    if (!result) continue;
    tools.push(result);
    if (result.status === 'missing') {
      missing.push(result.name);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    os,
    tools,
    missing,
    warnings,
  };
}

/**
 * 将环境检测结果保存为 env-spec.md 文件
 */
export async function saveEnvSpec(
  projectRoot: string,
  detection: EnvironmentDetection
): Promise<string> {
  const envSpecPath = join(projectRoot, '.mumuspec', 'env-spec.md');

  // Group tools by ecosystem
  const grouped = new Map<string, DetectedTool[]>();
  for (const tool of detection.tools) {
    const list = grouped.get(tool.ecosystem) || [];
    list.push(tool);
    grouped.set(tool.ecosystem, list);
  }

  // Build markdown content
  const lines: string[] = [];
  lines.push('---');
  lines.push('layer: 0');
  lines.push('scope: ".env"');
  lines.push('type: environment');
  lines.push(`last_updated: "${detection.timestamp.split('T')[0]}"`);
  lines.push('---');
  lines.push('');
  lines.push('# Environment Specification');
  lines.push('');
  lines.push(`> Auto-generated by \`mumuspec env detect --save\` at ${detection.timestamp}`);
  lines.push('> Detected OS: ' + `${detection.os.type} ${detection.os.version} (${detection.os.arch})`);
  lines.push('');
  lines.push('');

  for (const [eco, tools] of grouped) {
    lines.push(`## Environment: ${eco.charAt(0).toUpperCase() + eco.slice(1)}`);
    lines.push('');

    // SHALL section based on detected tools
    lines.push('### SHALL');
    for (const tool of tools) {
      if (tool.status === 'ok' && tool.version && tool.version !== 'unknown') {
        lines.push(`- ${tool.name} version MUST be ${tool.version} or compatible`);
      }
    }
    lines.push('');

    // SHALL NOT
    lines.push('### SHALL NOT');
    lines.push('- Do not modify system environment without team agreement');
    lines.push('');

    // Detected section (auto-generated)
    lines.push('### Detected');
    for (const tool of tools) {
      lines.push(`- ${tool.name}: ${tool.version} | ${tool.location || 'N/A'} | status: ${tool.status}`);
    }
    lines.push('');
  }

  const content = lines.join('\n');
  writeText(envSpecPath, content);
  return envSpecPath;
}

/**
 * 验证当前环境是否符合 env-spec.md 声明
 */
export async function validateEnv(
  projectRoot: string,
  options?: { strict?: boolean }
): Promise<{ exitCode: number; messages: string[]; suggestions: string[] }> {
  const envSpecPath = join(projectRoot, '.mumuspec', 'env-spec.md');
  const messages: string[] = [];
  const suggestions: string[] = [];

  if (!existsSync(envSpecPath)) {
    messages.push('env-spec.md not found. Run `mumuspec env detect --save` first.');
    return { exitCode: 3, messages, suggestions };
  }

  // Run fresh detection
  const detection = await detectEnvironment({ projectRoot });

  // ponytail: saved spec comparison deferred; only fresh detection validated
  let exitCode = 0;

  // Check each saved requirement against detected
  for (const tool of detection.tools) {
    if (tool.status === 'missing') {
      messages.push(`✗ ${tool.name}: REQUIRED but NOT FOUND`);
      suggestions.push(`Install ${tool.name} or update env-spec.md`);
      exitCode = 2;
    } else if (tool.status === 'warn') {
      messages.push(`⚠ ${tool.name}: version may not meet requirements`);
      if (options?.strict && exitCode < 2) {
        exitCode = 1;
      }
    } else {
      messages.push(`✓ ${tool.name}: ${tool.version}`);
    }
  }

  return { exitCode, messages, suggestions };
}

/**
 * 对比当前环境与已保存的环境规范
 */
export async function diffEnv(
  projectRoot: string,
  againstFile?: string
): Promise<string> {
  // ponytail: minimal stub — saved-diff comparison not yet implemented
  const envSpecPath = againstFile || join(projectRoot, '.mumuspec', 'env-spec.md');
  if (existsSync(envSpecPath)) {
    try {
      readFileSync(envSpecPath, 'utf8');
    } catch {
      // ignore read errors
    }
  }

  // Run current detection
  const current = await detectEnvironment({ projectRoot });

  const lines: string[] = [];
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║  Environment Diff                                       ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`OS: ${current.os.type} ${current.os.version} (${current.os.arch})`);
  lines.push('');

  for (const tool of current.tools) {
    const icon = tool.status === 'ok' ? '✓' : tool.status === 'warn' ? '⚠' : '✗';
    lines.push(`  ${icon} ${tool.name.padEnd(10)} ${tool.version}${tool.location ? `  ${tool.location}` : ''}`);
  }

  lines.push('');
  if (current.missing.length > 0) {
    lines.push(`Missing: ${current.missing.join(', ')}`);
  }

  return lines.join('\n');
}

/** Helper: ensure directory and write text file */
function writeText(filePath: string, content: string): void {
  const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
  ensureDir(dir);
  const { writeFileSync } = require('node:fs');
  writeFileSync(filePath, content, 'utf8');
}

/** Helper: ensure directory exists */
function ensureDir(dirPath: string): void {
  const { existsSync, mkdirSync } = require('node:fs');
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}
