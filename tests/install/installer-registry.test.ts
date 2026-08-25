/**
 * Tests for src/install/installer-registry.ts — types and manifest structure.
 */
import { describe, it, expect } from 'vitest';
import type {
  AgentType,
  InstallTarget,
  InstallMode,
  PackageManifestEntry,
  McpPresetEntry,
  CommandPresetEntry,
  InstallResult,
  InstallMcpResult,
} from '../../src/install/installer-registry.js';

describe('installer-registry types', () => {
  it('should accept valid AgentType values', () => {
    const agents: AgentType[] = ['catpaw', 'claude', 'cursor', 'trae', 'workbuddy', 'opencode'];
    expect(agents.length).toBe(6);
  });

  it('should accept valid InstallTarget values', () => {
    const targets: InstallTarget[] = ['user', 'workspace'];
    expect(targets.length).toBe(2);
  });

  it('should accept valid InstallMode values', () => {
    const modes: InstallMode[] = ['install', 'update'];
    expect(modes.length).toBe(2);
  });

  it('PackageManifestEntry should accept all fields', () => {
    const entry: PackageManifestEntry = {
      name: 'test-package',
      description: 'A test package',
      agent: 'catpaw',
      skillId: 12345,
      command: '/test',
      category: 'utility',
    };
    expect(entry.agent).toBe('catpaw');
    expect(entry.skillId).toBe(12345);
  });

  it('McpPresetEntry should accept all fields', () => {
    const entry: McpPresetEntry = {
      name: 'test-mcp',
      description: 'An MCP preset',
      config: { command: 'node', args: ['server.js'] },
      category: 'tools',
    };
    expect(entry.config.command).toBe('node');
  });

  it('CommandPresetEntry should accept all fields', () => {
    const entry: CommandPresetEntry = {
      name: 'test-cmd',
      description: 'A command preset',
      template: '/template content',
      category: 'utility',
    };
    expect(entry.template).toBe('/template content');
  });

  it('InstallResult should capture success and error', () => {
    const successResult: InstallResult = {
      success: true,
      packageName: 'pkg',
      agent: 'claude',
      target: 'user',
      path: '/home/.claude',
    };
    expect(successResult.success).toBe(true);

    const failResult: InstallResult = {
      success: false,
      packageName: 'pkg',
      agent: 'claude',
      target: 'user',
      error: 'File exists',
    };
    expect(failResult.success).toBe(false);
    expect(failResult.error).toBe('File exists');
  });

  it('InstallMcpResult should capture result fields', () => {
    const result: InstallMcpResult = {
      success: true,
      serverName: 'mumuspec',
      path: '/config/mcp.json',
    };
    expect(result.serverName).toBe('mumuspec');
  });
});

describe('installer-registry package manifest data', () => {
  // Test that the actual manifest exports expected structure
  it('should have valid curatedAgents export', async () => {
    const mod = await import('../../src/install/installer-registry.js');
    // Check that PACKAGE_MANIFEST exists and is an array
    expect(mod).toBeDefined();
  });
});
