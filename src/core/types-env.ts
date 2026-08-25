/**
 * Environment detection types — 0.13.0+ tool detection and environment specification.
 */

/** Tool ecosystem identifiers */
export type ToolEcosystem = 'java' | 'node' | 'python' | 'go' | 'rust' | 'build' | 'container';

/** Tool status */
export type ToolStatus = 'ok' | 'warn' | 'missing';

/** Detected tool information */
export interface DetectedTool {
  name: string;
  ecosystem: ToolEcosystem;
  version: string;
  location: string;
  envVars: Record<string, string>;
  status: ToolStatus;
}

/** OS information */
export interface OSInfo {
  type: 'windows' | 'linux' | 'macos';
  arch: 'x64' | 'arm64' | 'x86';
  version: string;
  envVars: Record<string, string>;
}

/** Complete environment detection result */
export interface EnvironmentDetection {
  timestamp: string;
  os: OSInfo;
  tools: DetectedTool[];
  missing: string[];
  warnings: string[];
}

/** Environment specification entry */
export interface EnvironmentSpecEntry {
  tool: string;
  requirement: string;
  minVersion?: string;
  requiredEnvVars?: string[];
  detected?: DetectedTool;
  lastChecked?: string;
}

/** A section in the env-spec.md file */
export interface EnvSpecSection {
  category: string;
  shall: string[];
  shallNot: string[];
  detected: DetectedTool[];
  notes?: string;
}

/** env-spec.md file structure */
export interface EnvSpecFile {
  layer: 0;
  scope: '.env';
  type: 'environment';
  lastUpdated: string;
  environments: EnvSpecSection[];
}

/** Tool detector configuration */
export interface ToolDetectorConfig {
  command: string;
  versionRegex: RegExp;
  envVars?: string[];
  locationCmd?: string;
}
