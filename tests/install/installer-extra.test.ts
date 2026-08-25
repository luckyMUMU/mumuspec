/**
 * Extra tests for src/install/installer.ts — barrel re-exports.
 */
import { describe, it, expect } from 'vitest';

describe('installer module — barrel exports', () => {
  it('should export CATPAW_PACKAGES', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.CATPAW_PACKAGES).toBeDefined();
    expect(Array.isArray(mod.CATPAW_PACKAGES)).toBe(true);
  });

  it('should export MUMUSPEC_WORKFLOW_PACKAGE', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.MUMUSPEC_WORKFLOW_PACKAGE).toBeDefined();
  });

  it('should export MCP_PRESETS', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.MCP_PRESETS).toBeDefined();
    expect(Array.isArray(mod.MCP_PRESETS)).toBe(true);
  });

  it('should export COMMAND_PRESETS', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.COMMAND_PRESETS).toBeDefined();
  });

  it('should export CLAUDE_PACKAGES', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.CLAUDE_PACKAGES).toBeDefined();
    expect(Array.isArray(mod.CLAUDE_PACKAGES)).toBe(true);
  });

  it('should export AGENT_MANIFEST', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(mod.AGENT_MANIFEST).toBeDefined();
  });

  it('should export installer-ops functions', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(typeof mod.getManifest).toBe('function');
    expect(typeof mod.searchPackages).toBe('function');
    expect(typeof mod.resolvePackage).toBe('function');
  });

  it('should export isAgentSupported', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(typeof mod.isAgentSupported).toBe('function');
  });

  it('should export getSupportedAgents', async () => {
    const mod = await import('../../src/install/installer.js');
    expect(typeof mod.getSupportedAgents).toBe('function');
  });

  it('should have entries in AGENT_MANIFEST', async () => {
    const mod = await import('../../src/install/installer.js');
    const agents = Object.keys(mod.AGENT_MANIFEST);
    expect(agents.length).toBeGreaterThan(0);
  });
});

describe('installer module — isAgentSupported', () => {
  it('should return true for catpaw agent', async () => {
    const { isAgentSupported } = await import('../../src/install/installer.js');
    expect(isAgentSupported('catpaw')).toBe(true);
  });

  it('should return true for claude agent', async () => {
    const { isAgentSupported } = await import('../../src/install/installer.js');
    expect(isAgentSupported('claude')).toBe(true);
  });

  it('should return false for unknown agent', async () => {
    const { isAgentSupported } = await import('../../src/install/installer.js');
    expect(isAgentSupported('unknown-agent' as any)).toBe(false);
  });

  it('should list supported agents', async () => {
    const { getSupportedAgents } = await import('../../src/install/installer.js');
    const agents = getSupportedAgents();
    expect(agents).toContain('catpaw');
    expect(agents).toContain('claude');
    expect(agents.length).toBeGreaterThanOrEqual(2);
  });
});
