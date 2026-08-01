/**
 * TDD tests for Environment Detector (Layer 0)
 * Tests type definitions and core detection functions
 */

import { describe, it, expect } from 'vitest';
import {
  detectEnvironment,
  detectTool,
  detectOS,
  detectRequiredEcosystems,
  filterSensitiveVars,
} from '../src/core/env-detector';
import type {
  EnvironmentDetection,
  DetectedTool,
  EnvSpecFile,
} from '../src/core/types';

describe('ENV-001: Environment types', () => {
  it('should accept valid EnvironmentDetection structure', () => {
    const detection: EnvironmentDetection = {
      timestamp: '2026-08-01T00:00:00Z',
      os: { type: 'windows', arch: 'x64', version: '10.0.26100', envVars: {} },
      tools: [],
      missing: [],
      warnings: [],
    };
    expect(detection).toBeDefined();
    expect(detection.os.type).toBe('windows');
    expect(detection.tools).toBeInstanceOf(Array);
  });

  it('should accept valid DetectedTool structure', () => {
    const tool: DetectedTool = {
      name: 'jdk',
      ecosystem: 'java',
      version: '17.0.8',
      location: '/usr/lib/jvm/java-17',
      envVars: { JAVA_HOME: '/usr/lib/jvm/java-17' },
      status: 'ok',
    };
    expect(tool.name).toBe('jdk');
    expect(tool.ecosystem).toBe('java');
    expect(tool.status).toBe('ok');
  });

  it('should accept valid EnvSpecFile structure', () => {
    const spec: EnvSpecFile = {
      layer: 0,
      scope: '.env',
      type: 'environment',
      lastUpdated: '2026-08-01',
      environments: [],
    };
    expect(spec.scope).toBe('.env');
    expect(spec.type).toBe('environment');
  });
});

describe('ENV-002: detectOS', () => {
  it('should return valid OS info', () => {
    const os = detectOS();
    expect(os).toBeDefined();
    expect(['windows', 'linux', 'macos']).toContain(os.type);
    expect(['x64', 'arm64', 'x86']).toContain(os.arch);
    expect(os.version).toBeTruthy();
  });

  it('should include filtered env vars', () => {
    const os = detectOS();
    expect(os.envVars).toBeDefined();
  });
});

describe('ENV-003: filterSensitiveVars', () => {
  it('should filter password vars', () => {
    const input = { MY_PASSWORD: 'secret', PATH: '/usr/bin' };
    const result = filterSensitiveVars(input);
    expect(result).not.toHaveProperty('MY_PASSWORD');
    expect(result).toHaveProperty('PATH');
  });

  it('should filter token vars', () => {
    const input = { API_TOKEN: 'abc', HOME: '/home/user' };
    const result = filterSensitiveVars(input);
    expect(result).not.toHaveProperty('API_TOKEN');
    expect(result).toHaveProperty('HOME');
  });

  it('should filter secret vars', () => {
    const input = { AWS_SECRET_ACCESS_KEY: 'xxx', USER: 'test' };
    const result = filterSensitiveVars(input);
    expect(result).not.toHaveProperty('AWS_SECRET_ACCESS_KEY');
    expect(result).toHaveProperty('USER');
  });

  it('should keep non-sensitive vars', () => {
    const input = { PATH: '/usr/bin', HOME: '/home/user', JAVA_HOME: '/opt/jdk' };
    const result = filterSensitiveVars(input);
    expect(result).toHaveProperty('PATH');
    expect(result).toHaveProperty('HOME');
    expect(result).toHaveProperty('JAVA_HOME');
  });
});

describe('ENV-004: detectTool', () => {
  it('should detect node if installed', async () => {
    const config = {
      command: 'node --version',
      versionRegex: /v(\d+\.\d+\.\d+)/,
      envVars: ['NODE_PATH'],
      locationCmd: process.platform === 'win32' ? 'where node' : 'which node',
    };
    const result = await detectTool('node', config);
    expect(result).toBeDefined();
    expect(result.name).toBe('node');
    expect(['ok', 'missing']).toContain(result.status);
  });

  it('should handle missing tool gracefully', async () => {
    const config = {
      command: 'nonexistent_tool_cmd_12345 --version',
      versionRegex: /(\d+\.\d+\.\d+)/,
    };
    const result = await detectTool('nonexistent', config, 500);
    expect(result.status).toBe('missing');
  });
});

describe('ENV-005: detectEnvironment', () => {
  it('should return complete detection result', async () => {
    const result = await detectEnvironment({ ecosystems: ['node'] });
    expect(result).toBeDefined();
    expect(result.timestamp).toBeTruthy();
    expect(result.os).toBeDefined();
    expect(result.tools).toBeInstanceOf(Array);
  });

  it('should detect within 2 seconds', async () => {
    const start = Date.now();
    await detectEnvironment({ ecosystems: ['node'] });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  it('should respect ecosystem filter', async () => {
    const result = await detectEnvironment({ ecosystems: ['java'] });
    const ecosystems = new Set(result.tools.map((t) => t.ecosystem));
    for (const eco of ecosystems) {
      expect(['java']).toContain(eco);
    }
  });
});

describe('ENV-006: detectRequiredEcosystems', () => {
  it('should return array of ecosystems', () => {
    const ecosystems = detectRequiredEcosystems(process.cwd());
    expect(ecosystems).toBeInstanceOf(Array);
    expect(ecosystems).toContain('build');
  });
});
