/**
 * VS Code Problem Matcher formatter — converts DriftReport to a format
 * consumable by VS Code tasks (problemMatcher).
 *
 * Output format follows Microsoft's problem matcher schema:
 * https://code.visualstudio.org/docs/editor/tasks#_processing-task-output-with-problem-matchers
 *
 * ponytail: single-pattern matcher output. Multi-location or file-owner
 * ownershipSeverity modes deferred until VS Code extension integration.
 */

import type { DriftReport } from '../../core/types-contract.js';

/** A single Problem Matcher entry. */
export interface ProblemMatcherEntry {
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based), defaults to 1 */
  column: number;
  /** Severity: 'error' | 'warning' | 'info' */
  severity: 'error' | 'warning' | 'info';
  /** Diagnostic message */
  message: string;
  /** Rule/constraint id */
  code?: string;
}

/** VS Code ProblemMatcher output envelope. */
export interface ProblemMatcherOutput {
  problems: ProblemMatcherEntry[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
}

function toPmSeverity(severity: string): ProblemMatcherEntry['severity'] {
  switch (severity) {
    case 'ERROR': return 'error';
    case 'WARNING': return 'warning';
    default: return 'info';
  }
}

/** Convert internal DriftReport to VS Code Problem Matcher output. */
export function toProblemMatcher(report: DriftReport): ProblemMatcherOutput {
  const problems: ProblemMatcherEntry[] = report.drifts
    .filter((d) => d.file)
    .map((d) => ({
      file: d.file!,
      line: d.line ?? 1,
      column: 1,
      severity: toPmSeverity(d.severity),
      message: `[${d.contract_id}] ${d.message}`,
      code: d.type,
    }));

  return {
    problems,
    summary: {
      total: problems.length,
      errors: problems.filter((p) => p.severity === 'error').length,
      warnings: problems.filter((p) => p.severity === 'warning').length,
      infos: problems.filter((p) => p.severity === 'info').length,
    },
  };
}

/** Serialize Problem Matcher output to JSON string. */
export function toProblemMatcherString(report: DriftReport): string {
  return JSON.stringify(toProblemMatcher(report), null, 2);
}
