/**
 * SARIF 2.1 formatter — converts internal DriftReport to SARIF 2.1 JSON.
 *
 * SARIF (Static Analysis Results Interoperability Format) is the standard
 * format consumed by GitHub Advanced Security, VS Code, and most CI/CD tools.
 *
 * ponytail: minimal SARIF 2.1 output (tool.driver + results). Full schema
 * compliance (invocations, artifacts) deferred until IDE integration requires it.
 */

import type { DriftReport, ContractDrift } from '../../core/types-contract.js';

/** SARIF 2.1 Log object. */
export interface SarifLog {
  version: '2.1.0';
  $schema: string;
  runs: SarifRun[];
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      informationUri: string;
      version: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  helpUri?: string;
  properties?: Record<string, string>;
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: SarifLocation[];
  properties?: Record<string, string | number | boolean>;
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine?: number };
  };
}

const SARIF_SCHEMA_URI = 'https://json.schemastore.org/sarif-2.1.0.json';
const TOOL_NAME = 'MumuSpec';
const TOOL_VERSION = '0.19.0';

/** Severity → SARIF level mapping. */
function toSarifLevel(severity: string): SarifResult['level'] {
  switch (severity) {
    case 'ERROR': return 'error';
    case 'WARNING': return 'warning';
    default: return 'note';
  }
}

/** Extract unique drift types as SARIF rules. */
function rulesFromDrifts(drifts: ContractDrift[]): SarifRule[] {
  const seen = new Set<string>();
  const rules: SarifRule[] = [];

  for (const d of drifts) {
    if (seen.has(d.type)) continue;
    seen.add(d.type);
    rules.push({
      id: d.type,
      name: d.type,
      shortDescription: { text: `Contract drift detected: ${d.type}` },
    });
  }

  return rules;
}

/** Convert internal DriftReport to SARIF 2.1 log. */
export function toSarif(report: DriftReport): SarifLog {
  const results: SarifResult[] = report.drifts.map((d) => ({
    ruleId: d.type,
    level: toSarifLevel(d.severity),
    message: { text: d.message },
    ...(d.file ? {
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: d.file },
          ...(d.line ? { region: { startLine: d.line } } : {}),
        },
      }],
    } : {}),
    properties: {
      contract_id: d.contract_id,
      ...(d.expected ? { expected: d.expected } : {}),
      ...(d.actual ? { actual: d.actual } : {}),
      ...(d.suggestion ? { suggestion: d.suggestion } : {}),
      ...(d.error_code ? { error_code: d.error_code } : {}),
    },
  }));

  return {
    version: '2.1.0',
    $schema: SARIF_SCHEMA_URI,
    runs: [{
      tool: {
        driver: {
          name: TOOL_NAME,
          informationUri: 'https://github.com/meituan/mumuspec',
          version: TOOL_VERSION,
          rules: rulesFromDrifts(report.drifts),
        },
      },
      results,
    }],
  };
}

/** Serialize SARIF log to JSON string. */
export function toSarifString(report: DriftReport): string {
  return JSON.stringify(toSarif(report), null, 2);
}
