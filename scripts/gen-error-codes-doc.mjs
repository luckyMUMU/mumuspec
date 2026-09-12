#!/usr/bin/env node
/**
 * P0-6 Fix: Auto-generate error-codes.md from src/core/errors.ts
 * Run: node scripts/gen-error-codes-doc.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Read the errors.ts file and extract ERROR_CODES
const errorsFile = join(root, 'src/core/errors.ts');
const errorsContent = readFileSync(errorsFile, 'utf8');

// Extract domain comments and error code blocks
const lines = errorsContent.split('\n');
const domainMap = new Map(); // domain -> [{code, name, description, severity, fixSteps, forceable}]

let currentDomain = 'UNKNOWN';
const domainCounts = new Map();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect domain comment: // SPEC domain, // CHANGE domain, etc.
  const domainMatch = line.match(/^\s*\/\/\s*(\w+)\s+domain/i);
  if (domainMatch) {
    currentDomain = domainMatch[1].toUpperCase();
    if (!domainMap.has(currentDomain)) {
      domainMap.set(currentDomain, []);
      domainCounts.set(currentDomain, 0);
    }
    continue;
  }
  
  // Detect error code key: 'E-XXX-NNN': { / 'W-XXX-NNN': {
  //
  // The prefix is NOT a filter: the registry carries advisory codes under both
  // `E-` (legacy, severity WARN) and `W-` (current). Matching only `E-` made
  // 15 emitted codes invisible to this doc — the same "channel silently drops
  // facts" failure the codes themselves are meant to catch.
  const codeMatch = line.match(/^\s*'([EW])-(\w+)-(\d+)':\s*\{/);
  if (codeMatch) {
    domainCounts.set(currentDomain, (domainCounts.get(currentDomain) || 0) + 1);
    
    // Extract code body with proper string-aware bracket counting
    let body = '';
    let braceCount = 1;
    let j = i + 1;
    let inString = false;
    let stringChar = '';
    while (j < lines.length && braceCount > 0) {
      const currentLine = lines[j];
      let processedLine = '';
      for (let k = 0; k < currentLine.length; k++) {
        const ch = currentLine[k];
        if (inString) {
          processedLine += ch;
          if (ch === stringChar && currentLine[k - 1] !== '\\') {
            inString = false;
          }
        } else {
          if (ch === "'" || ch === '"') {
            inString = true;
            stringChar = ch;
            processedLine += ch;
          } else if (ch === '{') {
            braceCount++;
            processedLine += ch;
          } else if (ch === '}') {
            braceCount--;
            processedLine += ch;
            if (braceCount === 0) break;
          } else {
            processedLine += ch;
          }
        }
      }
      body += processedLine + '\n';
      j++;
    }
    
    // Parse fields from body
    const nameMatch = body.match(/name:\s*'([^']+)'/);
    const severityMatch = body.match(/severity:\s*'([^']+)'/);
    const descMatch = body.match(/description:\s*'([^']+)'/);
    const forceMatch = body.match(/forceable:\s*(true|false)/);
    
    // Parse fixSteps array
    const fixSteps = [];
    const fixMatch = body.match(/fixSteps:\s*\[([\s\S]*?)\]/);
    if (fixMatch) {
      const stepMatches = fixMatch[1].match(/'([^']+)'/g);
      if (stepMatches) {
        for (const step of stepMatches) {
          fixSteps.push(step.slice(1, -1));
        }
      }
    }
    
    // Keep the real prefix — do NOT hardcode `E-`, or `W-DESIGN-001` renders
    // as `E-W-DESIGN`.
    const code = `${codeMatch[1]}-${codeMatch[2]}-${codeMatch[3]}`;
    domainMap.get(currentDomain).push({
      code,
      name: nameMatch ? nameMatch[1] : 'UNKNOWN',
      severity: severityMatch ? severityMatch[1] : 'ERROR',
      description: descMatch ? descMatch[1] : '',
      forceable: forceMatch ? forceMatch[1] === 'true' : false,
      fixSteps,
    });
  }
}

// Generate markdown
const md = [];
md.push('# Error Codes Reference');
md.push('');
md.push('> **Auto-generated** from `src/core/errors.ts`. Do not edit manually.');
md.push('> Run `node scripts/gen-error-codes-doc.mjs` to regenerate.');
md.push('');
md.push(`Last updated: ${new Date().toISOString().split('T')[0]}`);
md.push('');
md.push('## Summary');
md.push('');
md.push('| Domain | Count |');
md.push('|--------|-------|');
let total = 0;
for (const [domain, count] of domainCounts) {
  md.push(`| ${domain} | ${count} |`);
  total += count;
}
md.push(`| **Total** | **${total}** |`);
md.push('');

// Generate domain sections
for (const [domain, codes] of domainMap) {
  md.push(`## ${domain} Domain`);
  md.push('');
  md.push('| Code | Name | Severity | Description | Forceable |');
  md.push('|------|------|----------|-------------|-----------|');
  for (const err of codes) {
    md.push(`| \`${err.code}\` | ${err.name} | ${err.severity} | ${err.description} | ${err.forceable ? 'Yes' : 'No'} |`);
  }
  md.push('');
  
  // Detail section for each error
  for (const err of codes) {
    md.push(`### \`${err.code}\`: ${err.name}`);
    md.push('');
    md.push(`- **Severity**: ${err.severity}`);
    md.push(`- **Forceable**: ${err.forceable ? 'Yes' : 'No'}`);
    md.push(`- **Description**: ${err.description}`);
    md.push('');
    if (err.fixSteps.length > 0) {
      md.push('**Fix Steps**:');
      for (let i = 0; i < err.fixSteps.length; i++) {
        md.push(`${i + 1}. ${err.fixSteps[i]}`);
      }
      md.push('');
    }
  }
}

// Write the file
import { mkdirSync } from 'node:fs';
const outputPath = join(root, 'docs/reference/error-codes.md');
// Ensure output directory exists
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, md.join('\n'), 'utf8');
console.log(`✅ Generated ${outputPath}`);
console.log(`   Total: ${total} error codes across ${domainMap.size} domains`);
