/**
 * Decision Audit Trail — LLM Freedom Enhancement (L2)
 *
 * Records autonomous decisions (path compression, skill loading, etc.)
 * into change state and decisions.md for full traceability.
 */

import { join } from 'node:path';
import { readText, writeText, now } from './utils.js';
import { loadChangeState, saveChangeState } from '../change/state.js';
import { getChangeDir } from '../change/paths.js';
import type { ChangePhase, AutoDecision } from './types-workflow.js';

/** Parameters for recording an auto-decision */
export interface RecordDecisionParams {
  phase: ChangePhase;
  decision: string;
  rationale: string;
  confidence: number;
  approved_by: 'user' | 'auto_L2_rule' | string;
}

/**
 * Record an autonomous decision to:
 * 1. The change's auto_decisions[] array (in .mumuspec.yaml)
 * 2. The change's decisions.md (human-readable audit log)
 *
 * Append-only: previous entries are never modified or deleted.
 */
export function recordAutoDecision(
  projectRoot: string,
  changeName: string,
  params: RecordDecisionParams,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) return;

  // 1. Append to auto_decisions[]
  const entry: AutoDecision = {
    timestamp: now(),
    phase: params.phase,
    decision: params.decision,
    rationale: params.rationale,
    confidence: params.confidence,
    approved_by: params.approved_by,
  };

  if (!state.auto_decisions) {
    state.auto_decisions = [];
  }
  state.auto_decisions.push(entry);
  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);

  // 2. Append to decisions.md
  const changeDir = getChangeDir(projectRoot, changeName);
  const decisionsPath = join(changeDir, 'decisions.md');
  const existing = readText(decisionsPath) || '';

  const confidencePct = Math.round(params.confidence * 100);
  const mdEntry = [
    '',
    '## [AUTO:' + params.phase + '] ' + entry.timestamp,
    '',
    '**Decision:** ' + params.decision,
    '**Rationale:** ' + params.rationale,
    '**Confidence:** ' + confidencePct + '% | **Approved by:** ' + params.approved_by,
    '',
  ].join('\n');

  writeText(decisionsPath, existing + mdEntry);
}
