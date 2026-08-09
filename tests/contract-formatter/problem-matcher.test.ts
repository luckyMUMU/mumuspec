/**
 * Tests for VS Code Problem Matcher formatter (R-0006 TC-STD-05, TC-STD-07).
 */
import { describe, it, expect } from 'vitest';
import {
  toProblemMatcher,
  toProblemMatcherString,
} from '../../src/contract/formatter/problem-matcher.js';
import type { DriftReport } from '../../src/core/types-contract.js';

function makeReport(): DriftReport {
  return {
    timestamp: '2026-08-09T10:00:00Z',
    total_contracts: 2,
    drift_count: 3,
    drifts: [
      {
        type: 'unimplemented',
        severity: 'ERROR',
        id: 'DRIFT-001',
        contract_id: 'API-001',
        message: 'Contract declared but no implementation found',
        file: 'src/api/users.ts',
        line: 42,
      },
      {
        type: 'schema_mismatch',
        severity: 'WARNING',
        id: 'DRIFT-002',
        contract_id: 'DB-USERS',
        message: 'Field missing',
        file: 'src/db/schema.ts',
        line: 10,
      },
      {
        type: 'deprecated_in_use',
        severity: 'INFO',
        id: 'DRIFT-003',
        contract_id: 'API-003',
        message: 'Deprecated contract still used',
        // no file → should be filtered out
      },
    ],
    clean_contracts: [],
    scan_duration_ms: 80,
    has_critical_drifts: true,
  };
}

describe('toProblemMatcher', () => {
  // TC-STD-05
  it('converts drifts with file to problem entries', () => {
    const result = toProblemMatcher(makeReport());

    // Only drifts with file → 2 entries (the INFO without file is filtered)
    expect(result.problems).toHaveLength(2);
  });

  it('defaults line and column', () => {
    const result = toProblemMatcher(makeReport());
    const problem = result.problems[0];

    expect(problem.line).toBe(42);
    expect(problem.column).toBe(1);
  });

  it('maps severity correctly', () => {
    const result = toProblemMatcher(makeReport());

    expect(result.problems[0].severity).toBe('error');
    expect(result.problems[1].severity).toBe('warning');
  });

  it('includes contract id in message', () => {
    const result = toProblemMatcher(makeReport());

    expect(result.problems[0].message).toContain('API-001');
    expect(result.problems[0].message).toContain('Contract declared');
  });

  it('provides summary counts', () => {
    const result = toProblemMatcher(makeReport());

    expect(result.summary.total).toBe(2);
    expect(result.summary.errors).toBe(1);
    expect(result.summary.warnings).toBe(1);
    expect(result.summary.infos).toBe(0);
  });

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

    const result = toProblemMatcher(report);
    expect(result.problems).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});

describe('toProblemMatcherString', () => {
  // TC-STD-07 (indirect)
  it('serializes to valid JSON', () => {
    const str = toProblemMatcherString(makeReport());
    const parsed = JSON.parse(str);

    expect(parsed.problems).toHaveLength(2);
    expect(parsed.summary.errors).toBe(1);
  });
});
