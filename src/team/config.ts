/**
 * Team Configuration — load, validate, and resolve team YAML configs.
 *
 * Config path: .mumuspec/team/<name>.yaml
 *
 * ponytail: Minimal validation — only check structural correctness. Semantic
 * validation (e.g., agent exists, dimensions sum to 100) is left to the engine
 * at runtime, not at load time.
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readYaml, writeYaml, ensureDir, getMumuSpecDir } from '../core/utils.js';
import type { TeamConfig, TeamConfigValidation } from '../core/types-team.js';

/** Subdirectory within .mumuspec where team configs live */
export const TEAM_CONFIG_DIR = 'team';

/**
 * Get the team config directory for a project.
 */
export function getTeamConfigDir(projectRoot: string): string {
  return join(getMumuSpecDir(projectRoot), TEAM_CONFIG_DIR);
}

/**
 * Get the file path for a team config by change name.
 */
export function getTeamConfigPath(projectRoot: string, changeName: string): string {
  return join(getTeamConfigDir(projectRoot), `${changeName}.yaml`);
}

/**
 * Check if a team config exists for the given change.
 */
export function teamConfigExists(projectRoot: string, changeName: string): boolean {
  return existsSync(getTeamConfigPath(projectRoot, changeName));
}

/**
 * Load a team config from YAML.
 * Returns undefined if the file doesn't exist or fails to parse.
 */
export function loadTeamConfig(projectRoot: string, changeName: string): TeamConfig | undefined {
  const path = getTeamConfigPath(projectRoot, changeName);
  return readYaml<TeamConfig>(path);
}

/**
 * Save a team config to YAML.
 */
export function saveTeamConfig(projectRoot: string, changeName: string, config: TeamConfig): void {
  const path = getTeamConfigPath(projectRoot, changeName);
  ensureDir(getTeamConfigDir(projectRoot));
  writeYaml(path, config);
}

/**
 * Validate a team config for structural correctness.
 * Checks required fields, array lengths, numeric ranges, and version.
 */
export function validateTeamConfig(config: unknown): TeamConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['root must be an object'], warnings: [] };
  }

  const c = config as Record<string, unknown>;

  // version
  if (c.version !== 1) {
    errors.push('version must be 1');
  }

  // lead
  if (typeof c.lead !== 'string' || c.lead.length === 0) {
    errors.push('lead must be a non-empty string');
  }

  // description (optional)
  if (c.description !== undefined && typeof c.description !== 'string') {
    errors.push('description must be a string');
  }

  // members
  if (!Array.isArray(c.members)) {
    errors.push('members must be an array');
  } else if (c.members.length === 0) {
    errors.push('members must not be empty');
  } else {
    for (const [i, member] of c.members.entries()) {
      const prefix = `members[${i}]`;
      if (!member || typeof member !== 'object') {
        errors.push(`${prefix} must be an object`);
        continue;
      }
      const m = member as Record<string, unknown>;
      if (typeof m.role !== 'string' || m.role.length === 0) {
        errors.push(`${prefix}.role must be a non-empty string`);
      }
      if (typeof m.instances !== 'number' || m.instances < 1) {
        errors.push(`${prefix}.instances must be a positive integer`);
      }
      if (m.orientations !== undefined) {
        if (!Array.isArray(m.orientations)) {
          errors.push(`${prefix}.orientations must be an array`);
        } else if (m.orientations.length !== m.instances) {
          warnings.push(`${prefix}.orientations length (${m.orientations.length}) doesn't match instances (${m.instances})`);
        }
      }
      if (m.label !== undefined && typeof m.label !== 'string') {
        errors.push(`${prefix}.label must be a string`);
      }
    }
  }

  // evaluator
  if (!c.evaluator || typeof c.evaluator !== 'object') {
    errors.push('evaluator must be an object');
  } else {
    const ev = c.evaluator as Record<string, unknown>;
    if (typeof ev.role !== 'string' || ev.role.length === 0) {
      errors.push('evaluator.role must be a non-empty string');
    }
    if (typeof ev.min_score !== 'number' || ev.min_score < 0 || ev.min_score > 100) {
      errors.push('evaluator.min_score must be a number between 0 and 100');
    }
    if (!Array.isArray(ev.dimensions)) {
      errors.push('evaluator.dimensions must be an array');
    } else if (ev.dimensions.length === 0) {
      errors.push('evaluator.dimensions must not be empty');
    } else {
      let totalWeight = 0;
      for (const [i, dim] of ev.dimensions.entries()) {
        const prefix = `evaluator.dimensions[${i}]`;
        if (!dim || typeof dim !== 'object') {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        const d = dim as Record<string, unknown>;
        if (typeof d.name !== 'string' || d.name.length === 0) {
          errors.push(`${prefix}.name must be a non-empty string`);
        }
        if (typeof d.weight !== 'number' || d.weight < 0) {
          errors.push(`${prefix}.weight must be a non-negative number`);
        }
        totalWeight += d.weight as number;
        if (d.description !== undefined && typeof d.description !== 'string') {
          errors.push(`${prefix}.description must be a string`);
        }
      }
      if (totalWeight !== 100) {
        warnings.push(`evaluator dimension weights sum to ${totalWeight}, not 100`);
      }
    }
    if (ev.label !== undefined && typeof ev.label !== 'string') {
      errors.push('evaluator.label must be a string');
    }
  }

  // iteration
  if (!c.iteration || typeof c.iteration !== 'object') {
    errors.push('iteration must be an object');
  } else {
    const it = c.iteration as Record<string, unknown>;
    if (typeof it.max_rounds !== 'number' || it.max_rounds < 1) {
      errors.push('iteration.max_rounds must be a positive integer');
    }
    if (typeof it.stop_on_convergence !== 'boolean') {
      errors.push('iteration.stop_on_convergence must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Build a default team config skeleton for scaffolding.
 */
export function buildDefaultTeamConfig(lead: string, description?: string): TeamConfig {
  return {
    version: 1,
    lead,
    description,
    members: [
      {
        role: 'member',
        instances: 3,
        orientations: ['stable', 'innovative', 'cost-effective'],
      },
    ],
    evaluator: {
      role: 'evaluator',
      min_score: 80,
      dimensions: [
        { name: '质量', weight: 40 },
        { name: '成本', weight: 30 },
        { name: '可行性', weight: 30 },
      ],
    },
    iteration: {
      max_rounds: 5,
      stop_on_convergence: true,
    },
  };
}
