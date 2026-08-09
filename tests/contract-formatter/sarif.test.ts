/**
 * Tests for SARIF 2.1 formatter (R-0006 TC-STD-04, TC-STD-06, TC-STD-08).
 */
import { describe, it, expect } from 'vitest';
import { toSarif, toSarifString } from '../../src/contract/formatter/sarif.js';
import type { DriftReport } from '../../src/core/types-contract.js';

function makeReport(): DriftReport {
  return {
    timestamp: '2026-08-09T10:00:00Z',
    total_contracts: 3,
    drift_count: 2,
    drifts: [
      {
        type: 'unimplemented',
        severity: 'ERROR',
        id: 'DRIFT-001',
        contract_id: 'API-001',
        message: 'Contract declared but no implementation found',
        file: 'src/api/users.ts',
        line: 42,
        expected: 'function getUser(id: string): Promise<User>',
        actual: 'not found',
        error_code: 'E-CONTRACT-001',
      },
      {
        type: 'schema_mismatch',
        severity: 'WARNING',
        id: 'DRIFT-002',
        contract_id: 'DB-USERS',
        message: 'Field "email" missing in schema',
        file: 'src/db/schema.ts',
        line: 10,
        error_code: 'E-CONTRACT-005',
      },
    ],
    clean_contracts: ['API-002'],
    scan_duration_ms: 150,
    has_critical_drifts: true,
  };
}

describe('toSarif', () => {
  // TC-STD-04
  it('outputs valid SARIF 2.1 structure', () => {
    const sarif = toSarif(makeReport());

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(sarif.runs).toHaveLength(1);
  });

  it('maps tool metadata correctly', () => {
    const sarif = toSarif(makeReport());
    const driver = sarif.runs[0].tool.driver;

    expect(driver.name).toBe('MumuSpec');
    expect(driver.informationUri).toContain('mumuspec');
  });

  it('converts each drift to a SARIF result', () => {
    const sarif = toSarif(makeReport());
    const results = sarif.runs[0].results;

    expect(results).toHaveLength(2);
    expect(results[0].level).toBe('error');
    expect(results[0].ruleId).toBe('unimplemented');
    expect(results[1].level).toBe('warning');
    expect(results[1].ruleId).toBe('schema_mismatch');
  });

  it('includes location with file and line', () => {
    const sarif = toSarif(makeReport());
    const loc = sarif.runs[0].results[0].locations?.[0];

    expect(loc?.physicalLocation.artifactLocation.uri).toBe('src/api/users.ts');
    expect(loc?.physicalLocation.region?.startLine).toBe(42);
  });

  it('includes properties as attachments', () => {
    const sarif = toSarif(makeReport());
    const props = sarif.runs[0].results[0].properties;

    expect(props?.contract_id).toBe('API-001');
    expect(props?.error_code).toBe('E-CONTRACT-001');
  });

  it('deduplicates rules from drift types', () => {
    const sarif = toSarif(makeReport());
    const rules = sarif.runs[0].tool.driver.rules;

    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  // TC-STD-08
  it('handles empty drifts', () => {
    const report: DriftReport = {
      timestamp: '2026-08-09T10:00:00Z',
      total_contracts: 0,
      drift_count: 0,
      drifts: [],
      clean_contracts: [],
      scan_duration_ms: 0,
      has_critical_drifts: false,
    };

    const sarif = toSarif(report);
    expect(sarif.runs[0].results).toEqual([]);
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
  });
});

describe('toSarifString', () => {
  // TC-STD-06 (indirect)
  it('serializes to valid JSON string', () => {
    const str = toSarifString(makeReport());
    const parsed = JSON.parse(str) as ReturnType<typeof toSarif>;

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0].results).toHaveLength(2);
  });
});
