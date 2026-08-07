/**
 * Extra tests for src/core/config-io.ts — getDefaultConfig, loadConfig, saveConfig.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadYaml = vi.fn();
const mockWriteYaml = vi.fn();
const mockGetMumuSpecDir = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  writeYaml: (...args: unknown[]) => mockWriteYaml(...args),
  getMumuSpecDir: (...args: unknown[]) => mockGetMumuSpecDir(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

import { getDefaultConfig, loadConfig, saveConfig } from '../../src/core/config-io.js';

describe('getDefaultConfig', () => {
  it('should return config with default project name', () => {
    const config = getDefaultConfig();
    expect(config).toBeDefined();
    expect(config.project.name).toBe('my-project');
    expect(config.project.language).toBe('typescript');
    expect(config.version).toBe('0.1.0');
  });

  it('should return config with custom project name', () => {
    const config = getDefaultConfig('my-app');
    expect(config.project.name).toBe('my-app');
  });

  it('should have knowledge config with all sections', () => {
    const config = getDefaultConfig();
    expect(config.knowledge).toBeDefined();
    expect(config.knowledge.code_graph).toBeDefined();
    expect(config.knowledge.wiki).toBeDefined();
    expect(config.knowledge.progressive_disclosure).toBeDefined();
    expect(config.knowledge.freshness).toBeDefined();
    expect(config.knowledge.drift_detection).toBe(true);
  });

  it('should have specs config', () => {
    const config = getDefaultConfig();
    expect(config.specs.root).toBe('.mumuspec');
    expect(config.specs.format).toBe('yaml+markdown');
    expect(config.specs.auto_index).toBe(true);
  });

  it('should have freshness thresholds', () => {
    const config = getDefaultConfig();
    expect(config.knowledge.freshness.warn_after_days).toBeGreaterThan(0);
    expect(config.knowledge.freshness.error_after_days).toBeGreaterThan(config.knowledge.freshness.warn_after_days);
  });

  it('should have code_graph enabled by default', () => {
    const config = getDefaultConfig();
    expect(config.knowledge.code_graph.enabled).toBe(true);
    expect(config.knowledge.code_graph.languages.length).toBeGreaterThan(0);
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    mockReadYaml.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockExistsSync.mockReset();
    mockGetMumuSpecDir.mockReturnValue('/root/.mumuspec');
  });

  it('should return default config when config does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadConfig('/root');
    expect(result).toBeDefined();
    expect(result!.project).toBeDefined();
  });

  it('should load config from YAML file', () => {
    const expectedConfig = getDefaultConfig('loaded-project');
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(expectedConfig);
    const result = loadConfig('/root');
    expect(result!.project.name).toBe('loaded-project');
  });

  it('should return config with correct project name', () => {
    const cfg = getDefaultConfig('test-proj');
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(cfg);
    const result = loadConfig('/root');
    expect(result!.project.name).toBe('test-proj');
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    mockWriteYaml.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockGetMumuSpecDir.mockReturnValue('/root/.mumuspec');
  });

  it('should call writeYaml with config path and data', () => {
    const config = getDefaultConfig('save-test');
    saveConfig('/root', config);
    expect(mockWriteYaml).toHaveBeenCalledWith(
      expect.stringContaining('config.yaml'),
      config
    );
  });

  it('should preserve all fields when saving', () => {
    const config = getDefaultConfig('full-config');
    saveConfig('/root', config);
    const savedArg = mockWriteYaml.mock.calls[0][1] as any;
    expect(savedArg.knowledge.code_graph.enabled).toBe(true);
    expect(savedArg.specs.auto_index).toBe(true);
  });
});
