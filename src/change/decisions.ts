/**
 * Change decisions, status summary, and feedback logging.
 */
import { readText, writeText, computeHash, now } from '../core/utils.js';
import type { ChangeState } from '../core/types.js';
import { getChangeDir } from './paths.js';
import { loadChangeState, saveChangeState } from './state.js';
import { join } from 'node:path';

/** Append to decisions.md */
export function appendDecision(
  projectRoot: string,
  changeName: string,
  phase: string,
  decision: string,
): void {
  const changeDir = getChangeDir(projectRoot, changeName);
  const decisionsPath = join(changeDir, 'decisions.md');

  const timestamp = now();
  const entry = `\n## [${phase}] ${timestamp}\n\n${decision}\n`;

  const existing = readText(decisionsPath) || '';
  writeText(decisionsPath, existing + entry);

  const state = loadChangeState(projectRoot, changeName);
  if (state) {
    state.decisions_log.counts[phase] = (state.decisions_log.counts[phase] || 0) + 1;
    const newContent = readText(decisionsPath) || '';
    state.decisions_log.content_hash = computeHash(newContent);
    state.updated_at = now();
    saveChangeState(projectRoot, changeName, state);
  }
}

/** Get a summary of the change status */
export function getChangeStatusSummary(
  projectRoot: string,
  changeName: string,
): string {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) return `Change not found: ${changeName}`;

  const lines: string[] = [];
  lines.push(`变更: ${changeName}`);
  lines.push(`Phase: ${state.phase}`);
  lines.push(`Workflow: ${state.workflow}`);
  lines.push(`创建时间: ${state.created_at}`);
  lines.push(`更新时间: ${state.updated_at}`);

  if (state.build_layers.length > 0) {
    lines.push('');
    lines.push('Build Layers:');
    for (const layer of state.build_layers) {
      const statusIcon = layer.status === 'done' ? '✓' : layer.status === 'in-progress' ? '◐' : '○';
      lines.push(`  ${statusIcon} Layer ${layer.layer} (${layer.scope}): ${layer.status}`);
    }
  }

  lines.push('');
  lines.push(`Test Cases Locked: ${state.test_cases.design_locked}`);
  lines.push(`Suites Locked: ${state.test_cases.suites_locked}`);
  lines.push(`Rollback Count: ${state.rollback_count}/${state.rollback_limit}`);
  lines.push(`Rebuild Count: ${state.rebuild_count}/${state.rebuild_limit}`);

  if (state.cognitive_framework?.enabled) {
    lines.push('');
    lines.push('Cognitive Framework:');
    lines.push(`  Q1 entries: ${state.cognitive_framework.q1_count}`);
    lines.push(`  Q2 pending: ${state.cognitive_framework.q2_pending}`);
    lines.push(`  Q3 pending: ${state.cognitive_framework.q3_pending}`);
    lines.push(`  Q4 scans: ${state.cognitive_framework.q4_scans_completed}`);
    lines.push(`  Converged: ${state.cognitive_framework.converged}`);
    lines.push(`  Rounds: ${state.cognitive_framework.rounds_completed}`);
  }

  const nextPhase = getNextPhaseHint(state);
  if (nextPhase) {
    lines.push('');
    lines.push(`下一步: ${nextPhase}`);
  }

  return lines.join('\n');
}

/** Compute next phase hint from change state */
export function getNextPhaseHint(state: ChangeState): string | undefined {
  switch (state.phase) {
    case 'open':
      if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
        return 'mumuspec state transition <name> build (hotfix/tweak 跳过 Design)';
      }
      return 'mumuspec state transition <name> design (进入 Design 阶段)';
    case 'design':
      return 'mumuspec state transition <name> build (进入 Build 阶段)';
    case 'build':
      return 'mumuspec state transition <name> verify (进入 Verify 阶段)';
    case 'verify':
      return 'mumuspec state transition <name> archive-in-progress (进入 Archive 阶段)';
    case 'archive-in-progress':
      return 'mumuspec archive <name> (完成归档)';
    default:
      return undefined;
  }
}

/** Append a feedback reference to a change's feedback_log */
export function appendFeedbackToChange(
  projectRoot: string,
  changeName: string,
  feedbackId: string,
  sessionId?: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state) throw new Error(`Change not found: ${changeName}`);

  if (!state.feedback_log) {
    state.feedback_log = { entries: [], session_links: [] };
  }

  if (!state.feedback_log.entries.some(e => e.feedback_id === feedbackId)) {
    state.feedback_log.entries.push({
      feedback_id: feedbackId,
      linked_at: now(),
      acknowledged: false,
    });
  }

  if (sessionId && !state.feedback_log.session_links.some(
    l => l.feedback_id === feedbackId && l.session_id === sessionId
  )) {
    state.feedback_log.session_links.push({
      feedback_id: feedbackId,
      session_id: sessionId,
      linked_at: now(),
    });
  }

  state.updated_at = now();
  saveChangeState(projectRoot, changeName, state);
}

/** Get all feedback entries linked to a change */
export function getChangeFeedbacks(projectRoot: string, changeName: string): Array<{
  feedback_id: string;
  linked_at: string;
  acknowledged: boolean;
  sessionId?: string;
}> {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.feedback_log) return [];

  return state.feedback_log.entries.map(entry => {
    const link = state.feedback_log!.session_links.find(
      l => l.feedback_id === entry.feedback_id
    );
    return {
      ...entry,
      sessionId: link?.session_id,
    };
  });
}
