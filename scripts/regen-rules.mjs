/**
 * One-off recovery: regenerate Rules files (AGENTS.md etc.) + agents-hash.json
 * after archive-time spec changes, without re-running `mumuspec init`.
 *
 * Replicates cli/index.ts init Step 10: loadConfig → loadSpecContext →
 * generateRulesFiles with the CLI cheat sheet body extracted from the current
 * AGENTS.md (same renderer output; command set unchanged in this change).
 *
 * Run: node scripts/regen-rules.mjs   (from project root, uses dist build)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const dist = (...p) => new URL(`file://${projectRoot.replace(/\\/g, '/')}/dist/${p.join('/')}`);

const { loadConfig } = await import(dist('core/config-io.js'));
const { loadSpecContext } = await import(dist('spec/loader.js'));
const { generateRulesFiles } = await import(dist('rules/generator.js'));

const config = loadConfig(projectRoot);

let ruleSpecContext;
try {
  ruleSpecContext = loadSpecContext(projectRoot, projectRoot, config);
} catch (err) {
  console.warn('spec chain unavailable, generator falls back:', err.message);
}

const agentsPath = join(projectRoot, 'AGENTS.md');
const current = readFileSync(agentsPath, 'utf8');
const m = current.match(/## CLI 速查\n\n([\s\S]*?)(?=\n## |$)/);
const cheatSheet = m ? m[1].trimEnd() : undefined;

const result = await generateRulesFiles(projectRoot, config, ruleSpecContext, cheatSheet);
console.log('written:', result.written);
console.log('skipped:', (result.skipped || []).map((s) => `${s.path} (${s.diagnostic})`));
