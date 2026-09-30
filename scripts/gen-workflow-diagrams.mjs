#!/usr/bin/env node
/**
 * Generate docs/reference/workflow-diagrams.md from graph data.
 * Run: node scripts/gen-workflow-diagrams.mjs   (also wired into prebuild)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDiagramDocPage, DIAGRAM_DOC_RELATIVE } from '../dist/graph/doc-page.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, DIAGRAM_DOC_RELATIVE);

const content = buildDiagramDocPage(root);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content, 'utf-8');
console.log(`✅ Generated ${outputPath}`);
console.log(`   Sections: ${(content.match(/^## /gm) ?? []).length}`);
