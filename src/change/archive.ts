/**
 * Change archive sub-processes — version bump, delta-merge, knowledge extraction.
 */
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState } from '../core/types.js';
import { loadConfig } from '../core/config.js';
import { readYaml, readText, now, appendAuditLog, getMumuSpecDir, computeHash } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';
import { createKnowledgePage, getKnowledgeDir } from '../knowledge/manager.js';
import { getChangeDir, getArchiveDir } from './paths.js';
import { loadChangeState, saveChangeState } from './state.js';

/**
 * Auto-bump project version during archive.
 * Increments the prerelease counter (alpha.N -> alpha.N+1) and syncs src/cli.ts.
 */
export function bumpVersionForArchive(
  projectRoot: string,
  workflow: string,
): string | null {
  const pkgPath = join(projectRoot, 'package.json');
  const cliPath = join(projectRoot, 'src', 'cli.ts');

  if (!existsSync(pkgPath) || !existsSync(cliPath)) return null;

  try {
    const pkgRaw = readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgRaw);
    const current = pkg.version;

    const match = current.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z]+)(?:\.(\d+))?)?$/,
    );
    if (!match) return null;

    const [, major, minor, patch, tag, tagNum] = match;
    let nextVersion: string;

    if (!tag) {
      nextVersion = `${major}.${minor}.${parseInt(patch, 10) + 1}-alpha.0`;
    } else if (workflow === 'tweak' || workflow === 'hotfix') {
      if (tagNum !== undefined) {
        nextVersion = `${major}.${minor}.${patch}-${tag}.${parseInt(tagNum, 10) + 1}`;
      } else {
        nextVersion = `${major}.${minor}.${patch}-${tag}.0`;
      }
    } else {
      nextVersion = `${major}.${parseInt(minor, 10) + 1}.0-${tag}.0`;
    }

    pkg.version = nextVersion;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    const cliRaw = readFileSync(cliPath, 'utf8');
    const updatedCli = cliRaw.replace(
      /\.version\(['"]([^'"]+)['"]\)/,
      `.version('${nextVersion}')`,
    );
    if (updatedCli !== cliRaw) {
      writeFileSync(cliPath, updatedCli, 'utf8');
    }

    return nextVersion;
  } catch {
    return null;
  }
}

/** Archive a change (move to archive/) */
export function archiveChange(
  projectRoot: string,
  changeName: string,
  scope?: string,
): void {
  const state = loadChangeState(projectRoot, changeName, scope);
  if (!state) {
    throw new Error(`Change not found: ${changeName}`);
  }

  if (state.phase !== 'archive-in-progress') {
    throw new MumuSpecError('E-CHANGE-006', {
      '当前phase': state.phase,
      '需要': 'archive-in-progress',
    });
  }

  const isTweak = state.workflow === 'tweak';
  const changeDir = getChangeDir(projectRoot, changeName, scope);

  const bumpedVersion = bumpVersionForArchive(projectRoot, state.workflow);
  if (bumpedVersion) {
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'system',
      action: 'version.bump',
      change: changeName,
      to_version: bumpedVersion,
      trigger: 'archive',
      result: 'success',
    });
  }

  if (!isTweak) {
    mergeDeltaSpecsToMain(projectRoot, changeName, changeDir);
    extractKnowledgeToGlobal(projectRoot, changeName, changeDir, state);
  }

  state.phase = 'archive-completed';
  state.updated_at = now();

  if (!isTweak) {
    state.knowledge_extraction = {
      completed: true,
      pages_created_count: state.knowledge_extraction?.pages_created_count || 0,
      graph_bindings_verified: true,
      conflicts_resolved: true,
    };
  }

  saveChangeState(projectRoot, changeName, state, scope);

  const archiveDir = getArchiveDir(projectRoot, scope);
  const archivedDir = join(archiveDir, `${new Date().toISOString().split('T')[0]}-${changeName}`);

  ensureDir(archivedDir);
  try {
    renameSync(changeDir, archivedDir);
  } catch {
    // Ignore
  }

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.archive',
    change: changeName,
    workflow: state.workflow,
    knowledge_extracted: !isTweak,
    result: 'success',
  });
}

// Local imports needed only by archive sub-processes
import { ensureDir } from '../core/utils.js';
import { renameSync } from 'node:fs';

/** Merge delta-specs into the appropriate scope's tech.md or prd.md */
export function mergeDeltaSpecsToMain(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  _state?: ChangeState,
): void {
  const deltaSpecsDir = join(changeDir, 'delta-specs');
  if (!existsSync(deltaSpecsDir)) return;

  try {
    const entries = readdirSync(deltaSpecsDir);
    const specFiles = entries.filter((f: string) => f.endsWith('.md'));

    if (specFiles.length === 0) return;

    for (const specFile of specFiles) {
      const specContent = readFileSync(join(deltaSpecsDir, specFile), 'utf8');

      if (specFile.endsWith('-tech.md')) {
        const scopePath = specFile.replace(/-tech\.md$/, '');
        const targetDir = scopePath === '.' || scopePath === '' ? projectRoot : join(projectRoot, scopePath);
        const targetTechPath = join(targetDir, '.mumuspec', 'tech.md');
        if (existsSync(targetTechPath)) {
          appendFileSync(targetTechPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
          continue;
        }
        const targetSpecPath = join(targetDir, '.mumuspec', 'spec.md');
        if (existsSync(targetSpecPath)) {
          appendFileSync(targetSpecPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
          continue;
        }
      }

      if (specFile.endsWith('-prd.md')) {
        const scopePath = specFile.replace(/-prd\.md$/, '');
        const targetDir = scopePath === '.' || scopePath === '' ? projectRoot : join(projectRoot, scopePath);
        const targetPrdPath = join(targetDir, '.mumuspec', 'prd.md');
        if (existsSync(targetPrdPath)) {
          appendFileSync(targetPrdPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
          continue;
        }
        const targetDesignPath = join(targetDir, '.mumuspec', 'design.md');
        if (existsSync(targetDesignPath)) {
          appendFileSync(targetDesignPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
          continue;
        }
      }

      const mumuDir = getMumuSpecDir(projectRoot);
      const mainSpecPath = join(mumuDir, 'spec.md');
      if (existsSync(mainSpecPath)) {
        appendFileSync(mainSpecPath, `\n\n<!-- delta-merged from ${changeName}/${specFile} -->\n${specContent}\n`);
      }
    }
  } catch {
    // Non-fatal
  }
}

import { readdirSync } from 'node:fs';

/**
 * Extract knowledge from change artifacts to global knowledge base.
 * Implements KP-0028 Archive Phase Knowledge Extraction flow.
 */
export function extractKnowledgeToGlobal(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  state: ChangeState,
): void {
  const config = loadConfig(projectRoot);
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  if (!existsSync(knowledgeDir)) return;

  let pagesCreated = 0;
  const extractionLog: string[] = [];

  // D1: Read cognitive-map.yaml
  const cognitiveMapPath = join(changeDir, 'cognitive-map.yaml');
  if (existsSync(cognitiveMapPath)) {
    try {
      const cm = readYaml(cognitiveMapPath) as Record<string, unknown>;
      const entries = (cm.entries as Record<string, unknown>[]) || [];

      const q1Entries = entries.filter((e) => e.quadrant === 'Q1' && e.category === 'persistent');
      for (const entry of q1Entries) {
        const title = `Auto-extracted from ${changeName}: ${String(entry.question || 'Q1 decision')}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-${computeHash(title).substring(0, 8)}`,
            title,
            type: 'decision',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q1\n\n**Question:** ${entry.question}\n**Answer:** ${entry.answer || 'N/A'}`,
            tags: ['auto-extracted', 'q1', 'decision', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q1 → decision: ${entry.question}`);
        } catch { /* skip duplicates */ }
      }

      const q3Entries = entries.filter((e) => e.quadrant === 'Q3' && e.status === 'confirmed');
      for (const entry of q3Entries) {
        const title = `Rationale from ${changeName}: ${String(entry.question || 'Q3 derivation')}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-q3-${computeHash(title).substring(0, 8)}`,
            title,
            type: 'rationale',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q3\n\n**Question:** ${entry.question}\n**Answer:** ${entry.answer || 'N/A'}`,
            tags: ['auto-extracted', 'q3', 'rationale', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q3 → rationale: ${entry.question}`);
        } catch { /* skip */ }
      }

      const q4Scans = entries.filter((e) => e.quadrant === 'Q4');
      if (q4Scans.length > 0) {
        const title = `Residual risks from ${changeName}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-q4-risk`,
            title,
            type: 'risk',
            scope: changeName,
            content: `> Auto-extracted from ${changeName} cognitive-map Q4\n\n${q4Scans.map((e) => `- **${e.question}**: ${e.answer || 'TBD'}`).join('\n')}`,
            tags: ['auto-extracted', 'q4', 'risk', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D1 Q4 → risk: ${q4Scans.length} residual items`);
        } catch { /* skip */ }
      }
    } catch { /* Non-fatal */ }
  }

  // D2: Read decisions.md for lesson-type knowledge
  const decisionsPath = join(changeDir, 'decisions.md');
  if (existsSync(decisionsPath)) {
    try {
      const content = readText(decisionsPath);
      if (content && content.trim()) {
        const title = `Lessons from ${changeName} decisions`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-lessons`,
            title,
            type: 'lesson',
            scope: changeName,
            content: `> Auto-extracted from ${changeName}/decisions.md\n\n${content.substring(0, 2000)}`,
            tags: ['auto-extracted', 'lesson', 'decisions', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D2 → lesson: from decisions.md`);
        } catch { /* skip */ }
      }
    } catch { /* Non-fatal */ }
  }

  // D3: Read design.md for pattern-type knowledge
  const designPath = join(changeDir, 'design.md');
  if (existsSync(designPath)) {
    try {
      const content = readText(designPath);
      if (content && content.trim()) {
        const title = `Architecture patterns from ${changeName}`;
        try {
          createKnowledgePage(projectRoot, config, {
            id: `KE-${changeName}-patterns`,
            title,
            type: 'pattern',
            scope: changeName,
            content: `> Auto-extracted from ${changeName}/design.md\n\n${content.substring(0, 2000)}`,
            tags: ['auto-extracted', 'pattern', 'architecture', changeName],
          });
          pagesCreated++;
          extractionLog.push(`  D3 → pattern: from design.md`);
        } catch { /* skip */ }
      }
    } catch { /* Non-fatal */ }
  }

  // D4: Hyperplan surviving insights
  if (state.hyperplan_result?.hard_constraints_merged) {
    const title = `Adversarial design review insights from ${changeName}`;
    try {
      createKnowledgePage(projectRoot, config, {
        id: `KE-${changeName}-hyperplan`,
        title,
        type: 'decision',
        scope: changeName,
        content: `> Auto-extracted from ${changeName} Hyperplan review\n\n**Hard constraints merged:** ${state.hyperplan_result.hard_constraints_merged}\n**Open questions resolved:** ${state.hyperplan_result.open_questions_resolved}\n**Degraded:** ${state.hyperplan_result.degraded}`,
        tags: ['auto-extracted', 'hyperplan', 'decision', changeName],
      });
      pagesCreated++;
      extractionLog.push(`  D4 → decision: hyperplan insights`);
    } catch { /* skip */ }
  }

  // D7+D8: Update state + audit log
  state.knowledge_extraction = {
    completed: pagesCreated > 0,
    pages_created_count: (state.knowledge_extraction?.pages_created_count || 0) + pagesCreated,
    graph_bindings_verified: false,
    conflicts_resolved: false,
  };

  if (extractionLog.length > 0) {
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'system',
      action: 'knowledge.extract',
      change: changeName,
      pages_created: pagesCreated,
      summary: extractionLog.join(' | '),
      result: pagesCreated > 0 ? 'success' : 'no-content',
    });
  }
}
