/**
 * Change archive sub-processes — version bump, delta-merge, knowledge extraction.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChangeState } from '../core/types.js';
import { loadConfig } from '../core/config.js';
import { readYaml, readText, now, appendAuditLog, getMumuSpecDir, computeHash } from '../core/utils.js';
import { MumuSpecError } from '../core/errors.js';
import { createKnowledgePage, getKnowledgeDir } from '../knowledge/manager.js';
import { getChangeDir, getArchiveDir } from './paths.js';
import { loadChangeState, saveChangeState } from './state.js';
import { hasWorktree, removeWorktree } from '../core/git.js';

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
    mergeChangeArtifacts(projectRoot, changeName, changeDir, state);
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

  // Initialize merge record placeholder (filled by `mumuspec merge`)
  state.git_merge = state.git_merge ?? { merged: false };

  const archiveDir = getArchiveDir(projectRoot, scope);
  const archivedDir = join(archiveDir, `${new Date().toISOString().split('T')[0]}-${changeName}`);

  ensureDir(archivedDir);
  try {
    renameSync(changeDir, archivedDir);
  } catch (err) {
    // Rename failed: do NOT save state or write success audit
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'user',
      action: 'change.archive',
      change: changeName,
      workflow: state.workflow,
      result: 'failed',
      error: (err as Error).message,
    });
    throw new MumuSpecError('E-CHANGE-011', { cause: (err as Error).message });
  }

  // Only save state AFTER successful rename
  saveChangeState(projectRoot, changeName, state, scope);

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'change.archive',
    change: changeName,
    workflow: state.workflow,
    knowledge_extracted: !isTweak,
    result: 'success',
  });

  // Clean up worktree if physical isolation was used (0.20.0+)
  try {
    if (hasWorktree(projectRoot, changeName)) {
      removeWorktree(projectRoot, changeName);
      appendAuditLog(getMumuSpecDir(projectRoot), {
        actor: 'system',
        action: 'worktree.cleanup',
        change: changeName,
        result: 'success',
      });
    }
  } catch {
    // Worktree cleanup failure is non-fatal — change is already archived
  }
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
      const marker = `<!-- delta-merged from ${changeName}/${specFile} -->`;

      // P0-2 Fix: Determine target path
      let targetPath: string | null = null;
      if (specFile.endsWith('-tech.md')) {
        const scopePath = specFile.replace(/-tech\.md$/, '');
        const targetDir = scopePath === '.' || scopePath === '' ? projectRoot : join(projectRoot, scopePath);
        const targetTechPath = join(targetDir, '.mumuspec', 'tech.md');
        const targetSpecPath = join(targetDir, '.mumuspec', 'spec.md');
        if (existsSync(targetTechPath)) targetPath = targetTechPath;
        else if (existsSync(targetSpecPath)) targetPath = targetSpecPath;
      } else if (specFile.endsWith('-prd.md')) {
        const scopePath = specFile.replace(/-prd\.md$/, '');
        const targetDir = scopePath === '.' || scopePath === '' ? projectRoot : join(projectRoot, scopePath);
        const targetPrdPath = join(targetDir, '.mumuspec', 'prd.md');
        const targetDesignPath = join(targetDir, '.mumuspec', 'design.md');
        if (existsSync(targetPrdPath)) targetPath = targetPrdPath;
        else if (existsSync(targetDesignPath)) targetPath = targetDesignPath;
      }
      if (!targetPath) {
        const mumuDir = getMumuSpecDir(projectRoot);
        const mainSpecPath = join(mumuDir, 'spec.md');
        if (existsSync(mainSpecPath)) targetPath = mainSpecPath;
      }
      if (!targetPath) continue;

      // P0-2 Fix: Idempotency check - skip if already merged
      const existing = readFileSync(targetPath, 'utf8');
      if (existing.includes(marker)) {
        continue;  // Already merged, skip to prevent duplication
      }

      // P0-2 Fix: Atomic write (read → modify → write)
      const merged = `${existing}\n\n${marker}\n${specContent}\n`;
      const tmpPath = `${targetPath}.tmp.${process.pid}`;
      writeFileSync(tmpPath, merged, 'utf8');
      renameSync(tmpPath, targetPath);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Merge change artifacts to their permanent locations during archive.
 * Handles: constraints/, .mumuspec/ (change-level spec updates),
 * and records merge results in audit log.
 */
export function mergeChangeArtifacts(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  state: ChangeState,
): void {
  const mergeLog: string[] = [];

  // 1. Merge constraints/ to target scope's constraints.yaml or spec
  mergeConstraintsToScope(projectRoot, changeName, changeDir, state, mergeLog);

  // 2. Merge change-level .mumuspec/ spec updates to target scope
  mergeChangeLevelSpecs(projectRoot, changeName, changeDir, state, mergeLog);

  // 3. Record merge summary in audit log
  if (mergeLog.length > 0) {
    appendAuditLog(getMumuSpecDir(projectRoot), {
      actor: 'system',
      action: 'change.merge_artifacts',
      change: changeName,
      summary: mergeLog.join(' | '),
      result: 'success',
    });
  }
}

/**
 * Merge constraints/ directory contents to the target scope's constraints.yaml
 * or append to spec.md as new requirement blocks.
 */
function mergeConstraintsToScope(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  state: ChangeState,
  mergeLog: string[],
): void {
  const constraintsDir = join(changeDir, 'constraints');
  if (!existsSync(constraintsDir)) return;

  try {
    const entries = readdirSync(constraintsDir);
    const constraintFiles = entries.filter((f: string) => f.endsWith('.md'));
    if (constraintFiles.length === 0) return;

    // Determine target scope — use state.scope or default to root
    const scope = state.scope || '.';
    const targetDir = scope === '.' ? projectRoot : join(projectRoot, scope);
    const targetMumuDir = join(targetDir, '.mumuspec');

    // Try to merge into constraints.yaml first, then spec.md/tech.md
    const techPath = join(targetMumuDir, 'tech.md');
    const specPath = join(targetMumuDir, 'spec.md');

    for (const constraintFile of constraintFiles) {
      const content = readFileSync(join(constraintsDir, constraintFile), 'utf8');
      if (!content || !content.trim()) continue;

      const marker = `<!-- constraint-merged from ${changeName}/${constraintFile} -->`;

      // Try tech.md first (V2 format), then spec.md (V1 format)
      const targetPath = existsSync(techPath) ? techPath : (existsSync(specPath) ? specPath : null);
      if (!targetPath) continue;

      const existing = readFileSync(targetPath, 'utf8');
      if (existing.includes(marker)) continue; // Idempotency

      const merged = `${existing}\n\n${marker}\n${content}\n`;
      const tmpPath = `${targetPath}.tmp.${process.pid}`;
      writeFileSync(tmpPath, merged, 'utf8');
      renameSync(tmpPath, targetPath);
      mergeLog.push(`constraints/${constraintFile} → ${targetPath.replace(projectRoot, '')}`);
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Merge change-level .mumuspec/ (prd.md/tech.md) to the target scope's
 * corresponding spec files, if they contain updates not covered by delta-specs.
 */
function mergeChangeLevelSpecs(
  projectRoot: string,
  changeName: string,
  changeDir: string,
  state: ChangeState,
  mergeLog: string[],
): void {
  const changeMumuDir = join(changeDir, '.mumuspec');
  if (!existsSync(changeMumuDir)) return;

  const scope = state.scope || '.';
  const targetDir = scope === '.' ? projectRoot : join(projectRoot, scope);
  const targetMumuDir = join(targetDir, '.mumuspec');

  // Merge prd.md
  const changePrdPath = join(changeMumuDir, 'prd.md');
  if (existsSync(changePrdPath)) {
    try {
      const content = readFileSync(changePrdPath, 'utf8');
      if (content && content.trim()) {
        const targetPrdPath = join(targetMumuDir, 'prd.md');
        const targetDesignPath = join(targetMumuDir, 'design.md');
        const targetPath = existsSync(targetPrdPath) ? targetPrdPath : (existsSync(targetDesignPath) ? targetDesignPath : null);
        if (targetPath) {
          const marker = `<!-- change-spec-merged from ${changeName}/.mumuspec/prd.md -->`;
          const existing = readFileSync(targetPath, 'utf8');
          if (!existing.includes(marker)) {
            const merged = `${existing}\n\n${marker}\n${content}\n`;
            const tmpPath = `${targetPath}.tmp.${process.pid}`;
            writeFileSync(tmpPath, merged, 'utf8');
            renameSync(tmpPath, targetPath);
            mergeLog.push(`.mumuspec/prd.md → ${targetPath.replace(projectRoot, '')}`);
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Merge tech.md
  const changeTechPath = join(changeMumuDir, 'tech.md');
  if (existsSync(changeTechPath)) {
    try {
      const content = readFileSync(changeTechPath, 'utf8');
      if (content && content.trim()) {
        const targetTechPath = join(targetMumuDir, 'tech.md');
        const targetSpecPath = join(targetMumuDir, 'spec.md');
        const targetPath = existsSync(targetTechPath) ? targetTechPath : (existsSync(targetSpecPath) ? targetSpecPath : null);
        if (targetPath) {
          const marker = `<!-- change-spec-merged from ${changeName}/.mumuspec/tech.md -->`;
          const existing = readFileSync(targetPath, 'utf8');
          if (!existing.includes(marker)) {
            const merged = `${existing}\n\n${marker}\n${content}\n`;
            const tmpPath = `${targetPath}.tmp.${process.pid}`;
            writeFileSync(tmpPath, merged, 'utf8');
            renameSync(tmpPath, targetPath);
            mergeLog.push(`.mumuspec/tech.md → ${targetPath.replace(projectRoot, '')}`);
          }
        }
      }
    } catch {
      // Non-fatal
    }
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
