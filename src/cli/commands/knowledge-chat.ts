/**
 * Chat command — Ask questions about the project using the knowledge base.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { executeChat } from '../helpers.js';

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not in a MumuSpec project.');
    process.exit(1);
  }
  return root;
}

/** Register top-level `chat` command. */
export function registerChatCommand(program: Command): void {
  program
    .command('chat')
    .description('Ask questions about your project using the knowledge base')
    .argument('[query]', 'Query to search in knowledge base (interactive if omitted)')
    .option('--json', 'Output as JSON')
    .action((query, options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const userQuery = query ?? '';

      if (!userQuery.trim()) {
        console.log('+----------------------------------------------------------+');
        console.log('|                   MUMUSPEC CHAT                          |');
        console.log('+----------------------------------------------------------+');
        console.log('');
        console.log('Ask questions about your project knowledge base.');
        console.log('Examples: "KP-0007", "Saga pattern", "payment architecture"');
        console.log('');

        process.stdout.write('Query: ');
        process.stdin.once('data', (data) => {
          const inputQuery = data.toString().trim();
          if (inputQuery) {
            executeChat(root, config, inputQuery, options.json);
          }
          process.exit(0);
        });
        return;
      }

      executeChat(root, config, userQuery, options.json);
    });
}
