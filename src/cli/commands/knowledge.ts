/**
 * Knowledge command hub — delegates to focused submodules for CRUD, analysis,
 * onboarding, chat, git, scan, and doctor command registration.
 *
 * Thin barrel: keeps the public `registerKnowledgeCommands` API exported.
 */
import type { Command } from 'commander';
import { registerKnowledgeCrud } from './knowledge-crud.js';
import { registerKnowledgeAnalysis } from './knowledge-analysis.js';
import { registerOnboardCommands } from './knowledge-onboard.js';
import { registerChatCommand } from './knowledge-chat.js';
import { registerGitCommand } from './knowledge-git.js';
import { registerKnowledgeScan } from './knowledge-scan.js';
import { registerKnowledgeDoctor } from './knowledge-doctor.js';
import { registerKnowledgeSync } from './knowledge-sync.js';

export function registerKnowledgeCommands(program: Command): void {
  const knowledgeCmd = program.command('knowledge').description('Knowledge management');

  registerKnowledgeCrud(knowledgeCmd);
  registerKnowledgeAnalysis(program, knowledgeCmd);
  registerOnboardCommands(program);
  registerChatCommand(program);
  registerGitCommand(program);
  registerKnowledgeScan(knowledgeCmd);
  registerKnowledgeDoctor(knowledgeCmd);
  registerKnowledgeSync(knowledgeCmd);
}
