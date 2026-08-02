/**
 * feedback command — User feedback & session summary management + change-feedbacks.
 */
import type { Command } from 'commander';
import { resolve } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import { loadChangeState } from '../../change/manager.js';
import { appendFeedbackToChange, getChangeFeedbacks } from '../../change/manager.js';
import {
  submitFeedback,
  listAllFeedbacks,
  getFeedbackContent,
  updateFeedbackStatus,
  createSessionSummary,
} from '../../feedback/manager.js';
import type { SubmitFeedbackOptions } from '../../feedback/manager.js';
import type { CreateSessionSummaryOptions } from '../../feedback/manager.js';

export function registerFeedbackCommands(program: Command): void {
  // === feedback ===
  const feedbackCmd = program.command('feedback').description('User feedback & session summary management');

  feedbackCmd
    .command('submit')
    .description('Submit user feedback with optional change/session linkage')
    .requiredOption('--title <title>', 'feedback title')
    .option('--type <type>', 'feedback type (bug|feature-request|improvement|question|design-review)', 'improvement')
    .option('--severity <severity>', 'severity (critical|major|minor|info)', 'minor')
    .option('--submitter <name>', 'submitter name', 'anonymous')
    .option('--change <name>', 'associate with a change')
    .option('--session <id>', 'associate with a session ID')
    .option('--design <path>', 'reference to design doc path')
    .option('--expected <text>', 'expected behavior')
    .option('--actual <text>', 'actual behavior')
    .option('--detail <text>', 'detailed description')
    .option('--impact <text>', 'impact description')
    .option('--suggestion <text>', 'improvement suggestion')
    .option('--file <path>', 'read feedback body from file')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      // Read detail from file if specified
      let detail = options.detail;
      if (options.file) {
        const { readFileSync } = require('node:fs') as typeof import('node:fs');
        const filePath = resolve(options.file);
        detail = readFileSync(filePath, 'utf8');
      }

      // Validate type
      const validTypes = ['bug', 'feature-request', 'improvement', 'question', 'design-review'];
      if (!validTypes.includes(options.type)) {
        console.error(`Error: Invalid type '${options.type}'. Must be one of: ${validTypes.join(', ')}`);
        process.exit(1);
      }
      const validSeverities = ['critical', 'major', 'minor', 'info'];
      if (options.severity && !validSeverities.includes(options.severity)) {
        console.error(`Error: Invalid severity '${options.severity}'. Must be one of: ${validSeverities.join(', ')}`);
        process.exit(1);
      }

      // Validate change exists if specified
      if (options.change) {
        const state = loadChangeState(root, options.change);
        if (!state) {
          console.error(`Error: Change not found: ${options.change}`);
          process.exit(1);
        }
      }

      const result = submitFeedback(root, {
        type: options.type as SubmitFeedbackOptions['type'],
        severity: options.severity as SubmitFeedbackOptions['severity'],
        submitter: options.submitter,
        changeName: options.change,
        sessionId: options.session,
        title: options.title,
        expected: options.expected,
        actual: options.actual,
        detail,
        impact: options.impact,
        suggestion: options.suggestion,
        designRef: options.design,
      });

      // Update change state if linked
      if (options.change) {
        appendFeedbackToChange(root, options.change, result.feedbackId, options.session);
      }

      console.log(`\n✓ Feedback submitted: ${result.feedbackId}`);
      console.log(`  File: ${result.filePath}`);
      if (options.change) console.log(`  Linked to change: ${options.change}`);
      if (options.session) console.log(`  Linked to session: ${options.session}`);
    });

  feedbackCmd
    .command('list')
    .description('List feedback entries')
    .option('--status <status>', 'filter by status (open|acknowledged|in-progress|resolved|declined)')
    .option('--type <type>', 'filter by type')
    .option('--change <name>', 'filter by change name')
    .option('--limit <n>', 'limit results', '20')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const feedbacks = listAllFeedbacks(root, {
        status: options.status,
        type: options.type,
        changeName: options.change,
      });

      const limit = parseInt(options.limit);
      const display = feedbacks.slice(0, limit);

      if (display.length === 0) {
        console.log('No feedback entries found.');
        return;
      }

      console.log(`\n${display.length} feedback entry(s) (of ${feedbacks.length} total):\n`);
      for (const f of display) {
        const changeInfo = f.changeName ? ` [${f.changeName}]` : '';
        console.log(`  [${f.status}] ${f.id} — ${f.title}${changeInfo}`);
        console.log(`    Type: ${f.type} | Severity: ${f.severity} | Date: ${f.date} | By: ${f.submitter}`);
        if (f.sessionId) console.log(`    Session: ${f.sessionId}`);
      }
    });

  feedbackCmd
    .command('show')
    .description('Show full feedback content')
    .argument('<id>', 'feedback ID (e.g., FB-20260728-a1b2c3d4)')
    .action((id) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const feedback = getFeedbackContent(root, id);
      if (!feedback) {
        console.error(`Error: Feedback not found: ${id}`);
        process.exit(1);
      }

      console.log(`\n=== Feedback: ${feedback.id} ===`);
      console.log(`Title: ${feedback.title}`);
      console.log(`Type: ${feedback.type} | Severity: ${feedback.severity} | Status: ${feedback.status}`);
      console.log(`Date: ${feedback.date} | Submitter: ${feedback.submitter}`);
      if (feedback.changeName) console.log(`Change: ${feedback.changeName}`);
      if (feedback.sessionId) console.log(`Session: ${feedback.sessionId}`);
      if (feedback.designRef) console.log(`Design: ${feedback.designRef}`);
      console.log(`\n---\n${feedback.body}`);
    });

  feedbackCmd
    .command('update-status')
    .description('Update feedback status')
    .argument('<id>', 'feedback ID')
    .requiredOption('--status <status>', 'new status (open|acknowledged|in-progress|resolved|declined)')
    .option('--reason <text>', 'reason for status change')
    .action((id, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const validStatuses = ['open', 'acknowledged', 'in-progress', 'resolved', 'declined'];
      if (!validStatuses.includes(options.status)) {
        console.error(`Error: Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        process.exit(1);
      }

      updateFeedbackStatus(root, id, options.status as Parameters<typeof updateFeedbackStatus>[2], options.reason);
      console.log(`✓ Feedback ${id} status updated to: ${options.status}`);
    });

  feedbackCmd
    .command('session-summary')
    .description('Create a session summary with optional feedback linkage')
    .requiredOption('--session-id <id>', 'unique session ID')
    .requiredOption('--title <title>', 'session title')
    .requiredOption('--change-type <type>', 'change type (feature|hotfix|tweak|build|archive)')
    .requiredOption('--outcome <outcome>', 'session outcome (success|partial|failure|abandoned)')
    .option('--agent <name>', 'AI agent name', 'unknown')
    .option('--agent-version <ver>', 'AI agent version')
    .option('--change <name>', 'associated change name')
    .option('--duration <minutes>', 'session duration in minutes')
    .option('--feedback <ids>', 'comma-separated feedback IDs to link')
    .option('--summary <text>', 'session summary text')
    .option('--patterns <items>', 'comma-separated patterns observed')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const feedbackIds = options.feedback
        ? options.feedback.split(',').map((s: string) => s.trim())
        : undefined;

      const patterns = options.patterns
        ? options.patterns.split(',').map((s: string) => s.trim())
        : undefined;

      const validOutcomes = ['success', 'partial', 'failure', 'abandoned'];
      if (!validOutcomes.includes(options.outcome)) {
        console.error(`Error: Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`);
        process.exit(1);
      }

      const result = createSessionSummary(root, {
        sessionId: options.sessionId,
        agent: options.agent,
        agentVersion: options.agentVersion,
        changeType: options.changeType,
        outcome: options.outcome as CreateSessionSummaryOptions['outcome'],
        title: options.title,
        changeName: options.change,
        durationMinutes: options.duration ? parseInt(options.duration) : undefined,
        feedbackIds,
        artifactSummary: options.summary,
        patternsObserved: patterns,
      });

      console.log(`\n✓ Session summary created: ${result.sessionId}`);
      console.log(`  File: ${result.filePath}`);
      if (feedbackIds && feedbackIds.length > 0) {
        console.log(`  Linked feedback: ${feedbackIds.join(', ')}`);
      }
    });

  // === change-feedbacks (change-scoped) ===
  program
    .command('change-feedbacks')
    .description('List feedbacks linked to a change')
    .argument('<change>', 'change name')
    .action((change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const feedbacks = getChangeFeedbacks(root, change);

      if (feedbacks.length === 0) {
        console.log(`No feedback linked to change: ${change}`);
        return;
      }

      console.log(`\n${feedbacks.length} feedback(s) linked to ${change}:\n`);
      for (const f of feedbacks) {
        const ack = f.acknowledged ? '✓' : '○';
        console.log(`  [${ack}] ${f.feedback_id} (${f.linked_at?.split('T')[0] || ''})${f.sessionId ? ` [session: ${f.sessionId}]` : ''}`);
      }
    });
}
