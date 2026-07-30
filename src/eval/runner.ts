import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { checkCompliance, detectDrift } from '../guard/checker.js';
import { runPhaseGuard } from '../guard/phase-guard.js';
import { loadConfig } from '../core/config.js';
import { findProjectRoot } from '../core/utils.js';

// === Types ===

export interface EvalScenario {
  name: string;
  description?: string;
  type: 'compliance' | 'drift' | 'phase-guard' | 'custom';
  // For compliance/drift: project root to scan
  projectRoot?: string;
  // For phase-guard: change name and target phase
  changeName?: string;
  targetPhase?: string;
  // Expected outcomes
  expected?: {
    minErrors?: number;
    maxErrors?: number;
    minWarnings?: number;
    maxWarnings?: number;
    mustContainErrorCodes?: string[];
    mustNotContainErrorCodes?: string[];
    mustNotContainErrorMessages?: string[];
  };
  // Custom assertions (evaluated as JavaScript expressions)
  assertions?: string[];
}

export interface EvalResult {
  scenario: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: string;
  duration: number;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
  duration: number;
}

// === Scenario loading ===

/**
 * Load a scenario from a YAML-like file.
 * ponytail: using simple line-based parsing, no external YAML dep
 */
export function loadScenario(filePath: string): EvalScenario {
  if (!existsSync(filePath)) {
    throw new Error(`Scenario file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const scenario: Record<string, unknown> = {
    expected: {},
    assertions: [],
  };

  let currentSection: string | null = null;
  let currentSubSection: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    // Top-level key
    if (!rawLine.startsWith(' ') && !rawLine.startsWith('\t')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      currentSection = key;
      currentSubSection = null;

      if (value) {
        scenario[key] = parseScalar(value);
      } else if (key === 'expected') {
        scenario['expected'] = {};
      } else if (key === 'assertions') {
        scenario['assertions'] = [];
      }
      continue;
    }

    // Indented line
    if (currentSection === 'expected') {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      (scenario['expected'] as Record<string, unknown>)[key] = parseScalar(value);
    } else if (currentSection === 'assertions') {
      if (line.startsWith('- ')) {
        (scenario['assertions'] as string[]).push(line.slice(2).trim());
      }
    }
  }

  // Validation
  if (!scenario.name) {
    // Use filename as fallback
    const baseName = filePath.split(/[\\/]/).pop()?.replace(/\.ya?ml$/, '') || 'unnamed';
    scenario.name = baseName;
  }

  if (!scenario.type) {
    scenario.type = 'compliance';
  }

  return scenario as unknown as EvalScenario;
}

function parseScalar(value: string): unknown {
  if (value.startsWith('[') && value.endsWith(']')) {
    // Array
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;
  return value.replace(/^["']|["']$/g, '');
}

// === Scenario discovery ===

/**
 * Discover all eval scenarios in .mumuspec/evals/.
 */
export function discoverScenarios(projectRoot: string): string[] {
  const evalsDir = join(projectRoot, '.mumuspec', 'evals');
  if (!existsSync(evalsDir)) return [];

  const files = readdirSync(evalsDir);
  return files
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map((f) => join(evalsDir, f));
}

// === Scenario execution ===

/**
 * Run a single eval scenario.
 */
export function runScenario(scenario: EvalScenario): EvalResult {
  const startTime = Date.now();
  const resultErrors: string[] = [];
  const resultWarnings: string[] = [];
  let details = '';

  try {
    const projectRoot = scenario.projectRoot || findProjectRoot() || process.cwd();
    const expected = scenario.expected || {};

    let complianceResult: { errors: { code: string; message: string }[]; warnings: { code: string; message: string }[] } | null = null;
    let driftResults: { type: string; severity: string; message: string }[] | null = null;
    let guardResult: { errors: { code: string; message: string }[]; warnings: { code: string; message: string }[] } | null = null;

    switch (scenario.type) {
      case 'compliance':
        complianceResult = checkCompliance(projectRoot, {});
        details = `Compliance: ${complianceResult.errors.length} errors, ${complianceResult.warnings.length} warnings`;
        break;
      case 'drift':
        driftResults = detectDrift(projectRoot);
        const driftErrors = driftResults.filter((d) => d.severity === 'ERROR');
        const driftWarns = driftResults.filter((d) => d.severity !== 'ERROR');
        details = `Drift: ${driftErrors.length} errors, ${driftWarns.length} warnings`;
        break;
      case 'phase-guard':
        if (!scenario.changeName || !scenario.targetPhase) {
          resultErrors.push('phase-guard scenario requires changeName and targetPhase');
          break;
        }
        guardResult = runPhaseGuard(projectRoot, scenario.changeName, scenario.targetPhase);
        details = `Phase Guard (${scenario.changeName} → ${scenario.targetPhase}): ${guardResult.errors.length} errors`;
        break;
      default:
        resultWarnings.push(`Unknown scenario type: ${scenario.type}`);
    }

    // Collect all errors/warnings for assertion
    const allErrors: { code: string; message: string }[] = [];
    const allWarnings: { code: string; message: string }[] = [];

    if (complianceResult) {
      allErrors.push(...complianceResult.errors);
      allWarnings.push(...complianceResult.warnings);
    }
    if (driftResults) {
      for (const d of driftResults) {
        if (d.severity === 'ERROR') {
          allErrors.push({ code: 'DRIFT', message: `${d.type}: ${d.message}` });
        } else {
          allWarnings.push({ code: 'DRIFT', message: `${d.type}: ${d.message}` });
        }
      }
    }
    if (guardResult) {
      allErrors.push(...guardResult.errors);
      allWarnings.push(...guardResult.warnings);
    }

    // Run assertions
    if (expected.minErrors !== undefined && allErrors.length < expected.minErrors) {
      resultErrors.push(`Expected at least ${expected.minErrors} errors, got ${allErrors.length}`);
    }
    if (expected.maxErrors !== undefined && allErrors.length > expected.maxErrors) {
      resultErrors.push(`Expected at most ${expected.maxErrors} errors, got ${allErrors.length}`);
    }
    if (expected.minWarnings !== undefined && allWarnings.length < expected.minWarnings) {
      resultErrors.push(`Expected at least ${expected.minWarnings} warnings, got ${allWarnings.length}`);
    }
    if (expected.maxWarnings !== undefined && allWarnings.length > expected.maxWarnings) {
      resultErrors.push(`Expected at most ${expected.maxWarnings} warnings, got ${allWarnings.length}`);
    }

    // Check error codes
    if (expected.mustContainErrorCodes) {
      const actualCodes = allErrors.map((e) => e.code);
      for (const requiredCode of expected.mustContainErrorCodes as string[]) {
        if (!actualCodes.includes(requiredCode)) {
          resultErrors.push(`Expected error code "${requiredCode}" not found`);
        }
      }
    }
    if (expected.mustNotContainErrorCodes) {
      const actualCodes = allErrors.map((e) => e.code);
      for (const forbiddenCode of expected.mustNotContainErrorCodes as string[]) {
        if (actualCodes.includes(forbiddenCode)) {
          resultErrors.push(`Forbidden error code "${forbiddenCode}" found`);
        }
      }
    }

    // Run custom assertions
    for (const assertion of scenario.assertions || []) {
      try {
        // Simple assertion evaluation: supports patterns like:
        // "errors.length === 0"
        // "errors.some(e => e.code === 'E-GUARD-003')"
        const fn = new Function('errors', 'warnings', `"use strict"; return (${assertion});`);
        const assertionResult = fn(allErrors, allWarnings);
        if (!assertionResult) {
          resultErrors.push(`Assertion failed: ${assertion}`);
        }
      } catch (evalErr) {
        resultErrors.push(`Assertion error: ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`);
      }
    }

  } catch (err) {
    resultErrors.push(`Scenario execution error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    scenario: scenario.name,
    passed: resultErrors.length === 0,
    errors: resultErrors,
    warnings: resultWarnings,
    details,
    duration: Date.now() - startTime,
  };
}

/**
 * Run all discovered scenarios.
 */
export function runAllEvals(projectRoot?: string): EvalReport {
  const root = projectRoot || findProjectRoot() || process.cwd();
  const startTime = Date.now();

  const scenarioFiles = discoverScenarios(root);

  if (scenarioFiles.length === 0) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
      duration: Date.now() - startTime,
    };
  }

  const results: EvalResult[] = [];
  for (const file of scenarioFiles) {
    const scenario = loadScenario(file);
    results.push(runScenario(scenario));
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
    duration: Date.now() - startTime,
  };
}

/**
 * Init a sample evals directory with starter scenarios.
 */
export function initEvalsDir(projectRoot: string): { created: string[]; errors: string[] } {
  const evalsDir = join(projectRoot, '.mumuspec', 'evals');
  const created: string[] = [];
  const errors: string[] = [];

  if (!existsSync(evalsDir)) {
    try {
      mkdirSync(evalsDir, { recursive: true });
    } catch (err) {
      errors.push(`Failed to create evals dir: ${err instanceof Error ? err.message : String(err)}`);
      return { created, errors };
    }
  }

  // Sample: basic compliance check
  const complianceFile = join(evalsDir, 'sample-compliance.yaml');
  if (!existsSync(complianceFile)) {
    try {
      writeFileSync(complianceFile, `# Sample compliance eval
name: sample-compliance
description: Verify no SHALL NOT violations in committed code
type: compliance
expected:
  maxErrors: 0
  mustNotContainErrorCodes: ["E-GUARD-003"]
`);
      created.push(complianceFile);
    } catch (err) {
      errors.push(`Failed to write sample: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Sample: drift detection
  const driftFile = join(evalsDir, 'sample-drift.yaml');
  if (!existsSync(driftFile)) {
    try {
      writeFileSync(driftFile, `# Sample drift detection eval
name: sample-drift
description: Check spec-code drift after changes
type: drift
expected:
  maxWarnings: 5
`);
      created.push(driftFile);
    } catch (err) {
      errors.push(`Failed to write sample: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { created, errors };
}
