/**
 * Tests for team/config.ts — TeamConfig validation, loading, and scaffolding.
 */
import { describe, it, expect } from 'vitest';
import {
  validateTeamConfig,
  buildDefaultTeamConfig,
  getTeamConfigPath,
  getTeamConfigDir,
  TEAM_CONFIG_DIR,
} from '../../src/team/config.js';
import type { TeamConfig } from '../../src/core/types-team.js';

// ── Valid config fixture ──
const validConfig: TeamConfig = {
  version: 1,
  lead: 'team-lead',
  members: [
    {
      role: 'technical-solution-expert',
      instances: 3,
      orientations: ['stable', 'innovative', 'cost-effective'],
    },
  ],
  evaluator: {
    role: 'evaluation-expert',
    min_score: 80,
    dimensions: [
      { name: '技术方案', weight: 30 },
      { name: '成本核算', weight: 25 },
      { name: '技术兼容', weight: 25 },
      { name: '风险与可行性', weight: 20 },
    ],
  },
  iteration: {
    max_rounds: 5,
    stop_on_convergence: true,
  },
};

describe('team/config', () => {
  // ── validateTeamConfig ──
  describe('validateTeamConfig', () => {
    it('accepts a valid config', () => {
      const result = validateTeamConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects null input', () => {
      const result = validateTeamConfig(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('root must be an object');
    });

    it('rejects non-object input', () => {
      const result = validateTeamConfig('string');
      expect(result.valid).toBe(false);
    });

    it('rejects wrong version', () => {
      const result = validateTeamConfig({ ...validConfig, version: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('version must be 1');
    });

    it('rejects empty lead', () => {
      const result = validateTeamConfig({ ...validConfig, lead: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('lead must be a non-empty string');
    });

    it('rejects empty members array', () => {
      const result = validateTeamConfig({ ...validConfig, members: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('members must not be empty');
    });

    it('rejects member with zero instances', () => {
      const config = {
        ...validConfig,
        members: [{ role: 'expert', instances: 0 }],
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('members[0].instances must be a positive integer');
    });

    it('rejects evaluator with min_score > 100', () => {
      const config = {
        ...validConfig,
        evaluator: {
          ...validConfig.evaluator,
          min_score: 150,
        },
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('evaluator.min_score must be a number between 0 and 100');
    });

    it('warns when dimension weights do not sum to 100', () => {
      const config = {
        ...validConfig,
        evaluator: {
          ...validConfig.evaluator,
          dimensions: [
            { name: 'A', weight: 30 },
            { name: 'B', weight: 30 },
          ],
        },
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('sum to 60');
    });

    it('warns when orientations length does not match instances', () => {
      const config = {
        ...validConfig,
        members: [{
          role: 'expert',
          instances: 3,
          orientations: ['a', 'b'],
        }],
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('rejects iteration.max_rounds < 1', () => {
      const config = {
        ...validConfig,
        iteration: { max_rounds: 0, stop_on_convergence: true },
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('iteration.max_rounds must be a positive integer');
    });

    it('rejects non-boolean stop_on_convergence', () => {
      const config = {
        ...validConfig,
        iteration: { max_rounds: 5, stop_on_convergence: 'yes' as unknown as boolean },
      };
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('iteration.stop_on_convergence must be a boolean');
    });
  });

  // ── buildDefaultTeamConfig ──
  describe('buildDefaultTeamConfig', () => {
    it('creates a valid default config', () => {
      const config = buildDefaultTeamConfig('my-lead', 'Test team');
      const result = validateTeamConfig(config);
      expect(result.valid).toBe(true);
    });

    it('sets correct defaults', () => {
      const config = buildDefaultTeamConfig('lead');
      expect(config.version).toBe(1);
      expect(config.lead).toBe('lead');
      expect(config.members).toHaveLength(1);
      expect(config.members[0].instances).toBe(3);
      expect(config.evaluator.min_score).toBe(80);
      expect(config.iteration.max_rounds).toBe(5);
      expect(config.iteration.stop_on_convergence).toBe(true);
    });

    it('includes description when provided', () => {
      const config = buildDefaultTeamConfig('lead', 'My description');
      expect(config.description).toBe('My description');
    });
  });

  // ── Path helpers ──
  describe('path helpers', () => {
    it('TEAM_CONFIG_DIR is "team"', () => {
      expect(TEAM_CONFIG_DIR).toBe('team');
    });

    it('getTeamConfigDir returns .mumuspec/team', () => {
      const dir = getTeamConfigDir('/project');
      expect(dir).toContain('.mumuspec');
      expect(dir).toContain('team');
    });

    it('getTeamConfigPath includes change name', () => {
      const path = getTeamConfigPath('/project', 'my-change');
      expect(path).toContain('my-change.yaml');
    });
  });
});
