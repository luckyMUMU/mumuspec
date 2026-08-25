/**
 * i18n command — Internationalization and locale management.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getLocale, listAvailableLocales, resolveSkillPath } from '../../i18n/locales.js';

export function registerI18nCommands(program: Command): void {
  program
    .command('i18n')
    .description('Manage internationalization and locale settings')
    .command('status')
    .description('Show current locale and available translations')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const root = options.workspacePath;
      const locales = listAvailableLocales(root);
      const current = getLocale();

      console.log(`\nCurrent locale: ${current}`);
      console.log(`Available: ${locales.join(', ')}`);
      console.log(`\nSet locale: MUMUSPEC_LANG=en mumuspec ...`);
      console.log(`Config: .mumuspec.yaml → language: "en"`);
    });

  program
    .command('skill-path')
    .description('Resolve a skill file path with locale fallback')
    .argument('<name>', 'skill name (e.g., mumuspec, phase-open)')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const path = resolveSkillPath(root, name);
      if (path) {
        console.log(path);
      } else {
        console.log(`No skill "${name}" found for locale "${getLocale()}"`);
        process.exit(1);
      }
    });
}
