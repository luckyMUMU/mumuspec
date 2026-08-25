/**
 * Team Orchestration — barrel export.
 *
 * MumuSpec's multi-role collaborative execution framework.
 * Exports: TeamEngine, MockRuntimeAdapter, config loader, types.
 */

export { TeamEngine, MockRuntimeAdapter } from './engine.js';
export {
  loadTeamConfig,
  saveTeamConfig,
  validateTeamConfig,
  buildDefaultTeamConfig,
  getTeamConfigDir,
  getTeamConfigPath,
  teamConfigExists,
  TEAM_CONFIG_DIR,
} from './config.js';
