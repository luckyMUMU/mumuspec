import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import type {
  SpecContext,
  SpecLayerContext,
  SpecIndex,
  IndexChildEntry,
  PrdFile,
  TechFile,
  Requirement,
  InheritanceConflictRef,
  SpecKnowledgeMemory,
} from '../core/types.js';
import {
  parseSpecFile,
  parsePrdFile,
  parseTechFile,
} from './parser.js';
import { parseFrontmatter } from '../core/utils.js';
import { parse as parseYaml } from 'yaml';
import type { MumuSpecConfig } from '../core/config.js';
import { Logger } from '../core/logger.js';

/**
 * Load spec context for a directory using progressive disclosure.
 * Loads 3 layers: target + parent + grandparent (plus root if deeper).
 */
export function loadSpecContext(
  targetPath: string,
  projectRoot: string,
  config: MumuSpecConfig,
): SpecContext {
  const layers: SpecLayerContext[] = [];
  const prohibitions: string[] = [];

  // Build the path chain from root to target
  const pathChain = buildPathChain(targetPath, projectRoot);

  // Determine which layers to load (progressive disclosure: load up to 3 layers)
  // Always load root (Level 0), then the target layer and its parent
  const layersToLoad = selectLayersToLoad(pathChain, config.specs.max_layer_depth);

  for (const { level, dirPath, scope } of layersToLoad) {
    const mumuDir = join(dirPath, '.mumuspec');
    const layer: SpecLayerContext = {
      level,
      scope,
      path: dirPath,
    };

    // Load tech.md (new format) — falls back to spec.md for backward compatibility
    const techPath = join(mumuDir, 'tech.md');
    if (existsSync(techPath)) {
      try {
        const content = readFileSync(techPath, 'utf8');
        const tech = parseTechFile(content, techPath);
        layer.tech = tech;
        // Collect prohibitions from tech.md
        for (const req of tech.requirements) {
          prohibitions.push(...req.shallNot);
        }
      } catch (e) {
        // Skip invalid tech.md
        Logger.error('spec.loader', 'Failed to parse tech.md', { path: techPath, error: (e as Error).message });
      }
    } else {
      // Backward compatibility: load spec.md if tech.md doesn't exist
      const specPath = join(mumuDir, 'spec.md');
      if (existsSync(specPath)) {
        try {
          const content = readFileSync(specPath, 'utf8');
          layer.spec = parseSpecFile(content, specPath);
          // Collect prohibitions
          for (const req of layer.spec.requirements) {
            prohibitions.push(...req.shallNot);
          }
        } catch (e) {
          // Skip invalid specs
          Logger.error('spec.loader', 'Failed to parse spec.md', { path: specPath, error: (e as Error).message });
        }
      }
    }

    // Load prd.md (new format) — falls back to design.md for backward compatibility
    const prdPath = join(mumuDir, 'prd.md');
    if (existsSync(prdPath)) {
      try {
        const content = readFileSync(prdPath, 'utf8');
        layer.prd = parsePrdFile(content, prdPath);
      } catch (e) {
        // Skip invalid prd.md
        Logger.warn('spec.loader', 'Failed to parse prd.md', { path: prdPath, error: (e as Error).message });
      }
    } else {
      // Backward compatibility: load design.md if prd.md doesn't exist
      const designPath = join(mumuDir, 'design.md');
      if (existsSync(designPath)) {
        const content = readFileSync(designPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
        layer.design = {
          path: designPath,
          scope: frontmatter?.scope || scope,
          layer: frontmatter?.layer || level,
          content: body,
          decisions: [],
        };
      }
    }

    layers.push(layer);
  }

  // Load index.yaml for the parent of the target (if exists)
  let index: SpecIndex | undefined;
  if (layersToLoad.length >= 2) {
    const parentLayer = layersToLoad[layersToLoad.length - 2];
    const indexPath = join(parentLayer.dirPath, '.mumuspec', 'index.yaml');
    if (existsSync(indexPath)) {
      try {
        const content = readFileSync(indexPath, 'utf8');
        index = parseYaml(content) as SpecIndex;
      } catch (e) {
        // Skip invalid index
        Logger.warn('spec.loader', 'Failed to parse index.yaml', { path: indexPath, error: (e as Error).message });
      }
    }
  }

  // Process inheritance if parent_prd / parent_tech references exist
  const conflicts = processInheritance(layers, projectRoot);

  // Load knowledge memory context for design-time AI consumption
  const knowledgeMemory = loadKnowledgeMemoryForContext(projectRoot, config, targetPath);

  return {
    targetPath,
    layers,
    prohibitions: [...new Set(prohibitions)],
    index,
    inheritance_conflicts: conflicts.length > 0 ? conflicts : undefined,
    knowledge_memory: knowledgeMemory,
  };
}

/**
 * Load LLM-Wiki knowledge memory for spec context.
 * Provides AI with relevant historical decisions, patterns, risks, and lessons
 * as external memory during new design and change creation.
 */
function loadKnowledgeMemoryForContext(
  projectRoot: string,
  config: MumuSpecConfig,
  targetPath: string,
): SpecKnowledgeMemory | undefined {
  try {
    // Compute scope from targetPath relative to projectRoot
    const relPath = relative(projectRoot, targetPath).split(sep).join('/');
    const scope = relPath || '.';

    // Lazy import to avoid circular dependency
    // ponytail: dynamic import avoids circular dep between spec → knowledge → spec
    const { getMemoryContext } = require('../knowledge/memory.js') as typeof import('../knowledge/memory.js');
    const memory = getMemoryContext(projectRoot, config, scope);

    return {
      project_summary: memory.project_summary,
      relevant_decisions: memory.relevant_decisions.map(d => ({
        id: d.id,
        title: d.title,
        summary: d.summary,
        scope: d.scope,
      })),
      relevant_patterns: memory.relevant_patterns.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        scope: p.scope,
      })),
      relevant_risks: memory.relevant_risks.map(r => ({
        id: r.id,
        title: r.title,
        summary: r.summary,
        scope: r.scope,
      })),
      recent_lessons: memory.recent_lessons.map(l => ({
        id: l.id,
        title: l.title,
        summary: l.summary,
      })),
    };
  } catch (e) {
    // Knowledge memory is best-effort — don't block spec loading
    Logger.debug('spec.loader', 'Failed to load knowledge memory context', { error: (e as Error).message });
    return undefined;
  }
}

/**
 * Process parent inheritance for layers with parent_prd / parent_tech references.
 * Merges parent requirements into child and detects conflicts.
 */
function processInheritance(
  layers: SpecLayerContext[],
  _projectRoot: string,
): InheritanceConflictRef[] {
  const conflicts: InheritanceConflictRef[] = [];

  for (const layer of layers) {
    if (layer.tech?.path) {
      // Read parent_tech from frontmatter
      try {
        const content = readFileSync(layer.tech.path, 'utf8');
        const { frontmatter } = parseFrontmatter<{ parent_tech?: string }>(content);
        if (frontmatter?.parent_tech) {
          const parentPath = resolve(dirname(layer.tech.path), frontmatter.parent_tech);
          if (existsSync(parentPath)) {
            try {
              const parentContent = readFileSync(parentPath, 'utf8');
              const parentTech = parseTechFile(parentContent, parentPath);
              // Merge parent requirements into child
              const mergedReqs = mergeRequirements(layer.tech.requirements, parentTech.requirements);
              layer.tech.inherited_requirements = parentTech.requirements;
              layer.tech.requirements = mergedReqs;
              layer.merged = true;
              layer.inherited_from = [parentPath];

              // Check for conflicts
              const layerConflicts = detectRequirementConflicts(
                parentTech.requirements,
                layer.tech.requirements,
                layer.tech.path,
                parentPath,
              );
              conflicts.push(...layerConflicts);
            } catch (e) {
              // Skip invalid parent
              Logger.warn('spec.loader', 'Failed to parse parent tech file', { path: parentPath, error: (e as Error).message });
            }
          }
        }
      } catch (e) {
        // Skip
        Logger.warn('spec.loader', 'Failed to read tech file for inheritance processing', { path: layer.tech?.path, error: (e as Error).message });
      }
    }
  }

  return conflicts;
}

/**
 * Detect SHALL NOT vs SHALL conflicts between parent and child requirements.
 */
function detectRequirementConflicts(
  parentReqs: Requirement[],
  childReqs: Requirement[],
  childPath: string,
  parentPath: string,
): InheritanceConflictRef[] {
  const conflicts: InheritanceConflictRef[] = [];

  // Collect all parent SHALLs
  for (const pReq of parentReqs) {
    for (const shall of pReq.shall) {
      // Check if any child SHALL NOT conflicts
      for (const cReq of childReqs) {
        for (const shallNot of cReq.shallNot) {
          if (isPotentiallyConflicting(shall, shallNot)) {
            conflicts.push({
              type: 'shall-not-vs-parent-shall',
              child_path: childPath,
              parent_path: parentPath,
              child_requirement: `${cReq.name}: ${shallNot}`,
              parent_requirement: `${pReq.name}: ${shall}`,
              message: `"${shallNot}" conflicts with parent "${shall}"`,
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Simple heuristic to detect potential parent-child constraint conflicts.
 */
function isPotentiallyConflicting(shall: string, shallNot: string): boolean {
  const shallLower = shall.toLowerCase();
  const shallNotLower = shallNot.toLowerCase();

  // Must have conflicting polarities
  const hasPositive = /must|必须|shall|应该/.test(shallLower);
  const hasNegative = /not|禁止|不得|不可/.test(shallNotLower);
  if (!(hasPositive && hasNegative)) return false;

  // Check for significant term overlap
  const shallTerms = shallLower.split(/[\s,，。.]+/).filter(w => w.length > 2);
  const shallNotTerms = shallNotLower.split(/[\s,，。.]+/).filter(w => w.length > 2);
  const sharedTerms = shallTerms.filter(t => shallNotTerms.includes(t));

  return sharedTerms.length >= 2;
}

/**
 * Merge parent requirements into child, avoiding duplicates.
 */
function mergeRequirements(child: Requirement[], parent: Requirement[]): Requirement[] {
  const merged = child.map(r => ({ ...r, shall: [...r.shall], shallNot: [...r.shallNot], enforcement: [...r.enforcement] }));

  for (const pReq of parent) {
    const existing = merged.find(r => r.name === pReq.name);
    if (existing) {
      // Add parent items not already present
      for (const shall of pReq.shall) {
        if (!existing.shall.includes(shall)) existing.shall.push(shall);
      }
      for (const shallNot of pReq.shallNot) {
        if (!existing.shallNot.includes(shallNot)) existing.shallNot.push(shallNot);
      }
      for (const enf of pReq.enforcement) {
        if (!existing.enforcement.some(e => e.id === enf.id)) existing.enforcement.push(enf);
      }
    } else {
      merged.push({ ...pReq, shall: [...pReq.shall], shallNot: [...pReq.shallNot], enforcement: [...pReq.enforcement] });
    }
  }

  return merged;
}

/** Build the path chain from project root to target directory */
function buildPathChain(
  targetPath: string,
  projectRoot: string,
): { level: number; dirPath: string; scope: string }[] {
  const chain: { level: number; dirPath: string; scope: string }[] = [];
  const rel = relative(projectRoot, targetPath);

  // Root level
  chain.push({ level: 0, dirPath: projectRoot, scope: '.' });

  if (rel && rel !== '.') {
    const parts = rel.split(sep).filter(Boolean);
    let currentPath = projectRoot;
    for (let i = 0; i < parts.length; i++) {
      currentPath = join(currentPath, parts[i]);
      const scope = parts.slice(0, i + 1).join('/');
      const level = i + 1;
      chain.push({ level, dirPath: currentPath, scope });
    }
  }

  return chain;
}

/** Select which layers to load based on progressive disclosure (max 3 layers) */
function selectLayersToLoad(
  chain: { level: number; dirPath: string; scope: string }[],
  _maxDepth: number,
): { level: number; dirPath: string; scope: string }[] {
  // Filter to only levels that have .mumuspec/ directory
  const withSpecs = chain.filter((c) => existsSync(join(c.dirPath, '.mumuspec')));

  if (withSpecs.length <= 3) {
    return withSpecs;
  }

  // Always include root, then the target and its direct parent
  const root = withSpecs[0];
  const target = withSpecs[withSpecs.length - 1];
  const parent = withSpecs[withSpecs.length - 2];

  return [root, parent, target];
}

/** Build or update index.yaml for a directory */
export function buildIndex(
  dirPath: string,
  projectRoot: string,
): SpecIndex | undefined {
  const mumuDir = join(dirPath, '.mumuspec');
  if (!existsSync(mumuDir)) return undefined;

  // Read the current directory's tech.md (or spec.md for backward compat) to get layer and scope
  const techPath = join(mumuDir, 'tech.md');
  const specPath = join(mumuDir, 'spec.md');
  let layer = 0;
  let scope = '.';

  const layerFilePath = existsSync(techPath) ? techPath : (existsSync(specPath) ? specPath : null);
  if (layerFilePath) {
    try {
      const content = readFileSync(layerFilePath, 'utf8');
      const { frontmatter } = parseFrontmatter<{ layer: number; scope: string }>(content);
      if (frontmatter) {
        layer = frontmatter.layer;
        scope = frontmatter.scope;
      }
    } catch (e) {
      // Use defaults
      Logger.debug('spec.loader', 'Could not read frontmatter for layer info, using defaults', { path: layerFilePath, error: (e as Error).message });
    }
  }

  // Find child directories with .mumuspec/
  const children: IndexChildEntry[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const childDir = join(dirPath, entry.name);
      const childMumuDir = join(childDir, '.mumuspec');
      if (!existsSync(childMumuDir)) continue;

      // Read child's prd.md or design.md for prd_summary
      const childPrdPath = join(childMumuDir, 'prd.md');
      const childDesignPath = join(childMumuDir, 'design.md');
      let prdSummary = '';
      let techSummary = '';
      let constraintCount = 0;

      // Read prd_summary from prd.md or fallback to design.md
      if (existsSync(childPrdPath)) {
        try {
          const content = readFileSync(childPrdPath, 'utf8');
          const { body } = parseFrontmatter<{ scope: string; layer: number }>(content);
          prdSummary = body.split('\n').find((l: string) => l.trim() && !l.startsWith('#') && !l.startsWith('---')) || entry.name;
          prdSummary = prdSummary.substring(0, 200);
        } catch {
          prdSummary = entry.name;
        }
      } else if (existsSync(childDesignPath)) {
        try {
          const content = readFileSync(childDesignPath, 'utf8');
          const { body } = parseFrontmatter<{ scope: string; layer: number }>(content);
          prdSummary = body.split('\n').find((l: string) => l.trim() && !l.startsWith('#') && !l.startsWith('---')) || entry.name;
          prdSummary = prdSummary.substring(0, 200);
        } catch {
          prdSummary = entry.name;
        }
      }

      // Read tech_summary from tech.md or fallback to spec.md
      const childTechPath = join(childMumuDir, 'tech.md');
      const childSpecPath = join(childMumuDir, 'spec.md');
      if (existsSync(childTechPath)) {
        try {
          const content = readFileSync(childTechPath, 'utf8');
          const tech = parseTechFile(content, childTechPath);
          const firstReq = tech.requirements[0];
          techSummary = firstReq?.name || entry.name;
          constraintCount = tech.requirements.reduce((sum: number, r) => sum + r.shallNot.length + r.shall.length, 0);
        } catch {
          techSummary = entry.name;
        }
      } else if (existsSync(childSpecPath)) {
        try {
          const content = readFileSync(childSpecPath, 'utf8');
          const spec = parseSpecFile(content, childSpecPath);
          const firstReq = spec.requirements[0];
          techSummary = firstReq?.name || entry.name;
          constraintCount = spec.requirements.reduce((sum: number, r) => sum + r.shallNot.length + r.shall.length, 0);
        } catch {
          techSummary = entry.name;
        }
      }

      children.push({
        name: entry.name,
        path: relative(projectRoot, childDir).split(sep).join('/'),
        prd_summary: prdSummary,
        tech_summary: techSummary,
        constraint_count: constraintCount,
      });
    }
  } catch (e) {
    // Ignore errors
    Logger.warn('spec.loader', 'Could not read directory entries for index building', { path: dirPath, error: (e as Error).message });
  }

  return {
    scope,
    layer,
    children,
  };
}

/** Load a single prd.md file for a scope (on-demand loading) */
export function loadPrd(targetPath: string, _projectRoot: string): PrdFile | undefined {
  const mumuDir = join(targetPath, '.mumuspec');
  const prdPath = join(mumuDir, 'prd.md');
  if (!existsSync(prdPath)) {
    // Backward compatibility: fallback to design.md
    const designPath = join(mumuDir, 'design.md');
    if (!existsSync(designPath)) return undefined;
    const content = readFileSync(designPath, 'utf8');
    const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
    return {
      path: designPath,
      scope: frontmatter?.scope || '.',
      layer: frontmatter?.layer || 0,
      content: body,
      userScenarios: [],
      acceptanceCriteria: [],
    };
  }
  try {
    const content = readFileSync(prdPath, 'utf8');
    return parsePrdFile(content, prdPath);
  } catch (e) {
    Logger.warn('spec.loader', 'Failed to load prd.md', { path: prdPath, error: (e as Error).message });
    return undefined;
  }
}

/** Load a single tech.md file for a scope (on-demand loading) */
export function loadTech(targetPath: string, _projectRoot: string): TechFile | undefined {
  const mumuDir = join(targetPath, '.mumuspec');
  const techPath = join(mumuDir, 'tech.md');
  if (!existsSync(techPath)) {
    // Backward compatibility: fallback to spec.md
    const specPath = join(mumuDir, 'spec.md');
    if (!existsSync(specPath)) return undefined;
    try {
      const content = readFileSync(specPath, 'utf8');
      const spec = parseSpecFile(content, specPath);
      return {
        path: specPath,
        scope: spec.frontmatter.scope,
        layer: spec.frontmatter.layer,
        content: spec.raw,
        requirements: spec.requirements,
        architectureDecisions: [],
      };
    } catch (e) {
      Logger.warn('spec.loader', 'Failed to parse spec.md in loadTech fallback', { path: specPath, error: (e as Error).message });
      return undefined;
    }
  }
  try {
    const content = readFileSync(techPath, 'utf8');
    return parseTechFile(content, techPath);
  } catch (e) {
    Logger.error('spec.loader', 'Failed to parse tech.md', { path: techPath, error: (e as Error).message });
    return undefined;
  }
}

/** Search specs by keyword, scope, or type */
export function searchSpecs(
  projectRoot: string,
  options: { keyword?: string; scope?: string; type?: 'shall' | 'shall-not' },
): { file: string; requirement: string; text: string; type: string }[] {
  const results: { file: string; requirement: string; text: string; type: string }[] = [];
  const visited = new Set<string>();

  function scanDir(dirPath: string) {
    if (visited.has(dirPath)) return;
    visited.add(dirPath);

    const mumuDir = join(dirPath, '.mumuspec');

    // Search tech.md first, then fall back to spec.md
    const filesToSearch: string[] = [];
    const techPath = join(mumuDir, 'tech.md');
    const specPath = join(mumuDir, 'spec.md');
    if (existsSync(techPath)) filesToSearch.push(techPath);
    if (existsSync(specPath)) filesToSearch.push(specPath);

    for (const filePath of filesToSearch) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const spec = parseSpecFile(content, filePath);
        const relScope = relative(projectRoot, dirPath).split(sep).join('/') || '.';

        // Filter by scope if specified
        if (options.scope && !relScope.includes(options.scope)) {
          // Continue scanning children
          break;
        }
        for (const req of spec.requirements) {
          if (!options.type || options.type === 'shall') {
            for (const shall of req.shall) {
              if (!options.keyword || shall.toLowerCase().includes(options.keyword.toLowerCase())) {
                results.push({ file: filePath, requirement: req.name, text: shall, type: 'shall' });
              }
            }
          }
          if (!options.type || options.type === 'shall-not') {
            for (const shallNot of req.shallNot) {
              if (!options.keyword || shallNot.toLowerCase().includes(options.keyword.toLowerCase())) {
                results.push({ file: filePath, requirement: req.name, text: shallNot, type: 'shall-not' });
              }
            }
          }
        }
      } catch (e) {
        // Skip invalid
        Logger.debug('spec.loader', 'Could not parse spec file during search', { file: filePath, error: (e as Error).message });
      }
    }

    // Recurse into subdirectories
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scanDir(join(dirPath, entry.name));
        }
      }
    } catch (e) {
      // Ignore
      Logger.debug('spec.loader', 'Could not read directory during search', { path: dirPath, error: (e as Error).message });
    }
  }

  scanDir(projectRoot);
  return results;
}

/** Get all prohibitions for a given scope (including inherited) */
export function getProhibitions(
  projectRoot: string,
  targetPath: string,
): { scope: string; text: string; source: string }[] {
  const results: { scope: string; text: string; source: string }[] = [];
  const pathChain = buildPathChain(targetPath, projectRoot);

  for (const { dirPath, scope } of pathChain) {
    // Search tech.md first, then fall back to spec.md
    const techPath = join(dirPath, '.mumuspec', 'tech.md');
    const specPath = join(dirPath, '.mumuspec', 'spec.md');
    const filePath = existsSync(techPath) ? techPath : (existsSync(specPath) ? specPath : null);

    if (filePath) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const spec = parseSpecFile(content, filePath);
        for (const req of spec.requirements) {
          for (const shallNot of req.shallNot) {
            results.push({ scope, text: shallNot, source: filePath });
          }
        }
      } catch (e) {
        // Skip
        Logger.warn('spec.loader', 'Failed to read spec file for prohibitions', { path: filePath, error: (e as Error).message });
      }
    }
  }

  return results;
}

// ════════════════════════════════════════════════════════════════════
// Distributed Spec V2 — Utility Exports
// ════════════════════════════════════════════════════════════════════

/**
 * Find all directories containing .mumuspec/ with spec.md, prd.md, or tech.md.
 * Returns entries sorted bottom-up (deepest first).
 */
export function findAllDistributedSpecDirs(
  root: string,
): { dir: string; files: string[] }[] {
  const result: { dir: string; files: string[]; depth: number }[] = [];

  function walk(dir: string, depth: number): void {
    try {
      const mumuDir = join(dir, '.mumuspec');
      if (existsSync(mumuDir)) {
        const specFiles = ['spec.md', 'prd.md', 'tech.md'].filter(f =>
          existsSync(join(mumuDir, f))
        );
        if (specFiles.length > 0) {
          result.push({ dir, files: specFiles, depth });
        }
      }

      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules'
        ) {
          walk(join(dir, entry.name), depth + 1);
        }
      }
    } catch (e) {
      // Skip
      Logger.debug('spec.loader', 'Could not walk directory during spec discovery', { path: dir, error: (e as Error).message });
    }
  }

  walk(root, 0);
  // Sort deepest first
  result.sort((a, b) => b.depth - a.depth);
  return result.map(({ dir, files }) => ({ dir, files }));
}

/**
 * Merge parent and child TechFiles.
 * Child inherits parent's requirements and architectureDecisions.
 */
export function mergeTechFiles(parent: TechFile, child: TechFile): TechFile {
  const mergedReqs = mergeRequirements(child.requirements, parent.requirements);
  const mergedArch = [...child.architectureDecisions];
  for (const d of parent.architectureDecisions) {
    if (!mergedArch.includes(d)) mergedArch.push(d);
  }
  return {
    ...child,
    requirements: mergedReqs,
    architectureDecisions: mergedArch,
    inherited_requirements: parent.requirements,
  };
}

/**
 * Merge parent and child PrdFiles.
 * Child inherits parent's userScenarios and acceptanceCriteria.
 */
export function mergePrdFiles(parent: PrdFile, child: PrdFile): PrdFile {
  const mergedScenarios = [...child.userScenarios];
  for (const s of parent.userScenarios) {
    if (!mergedScenarios.includes(s)) mergedScenarios.push(s);
  }
  const mergedCriteria = [...child.acceptanceCriteria];
  for (const c of parent.acceptanceCriteria) {
    if (!mergedCriteria.includes(c)) mergedCriteria.push(c);
  }
  return {
    ...child,
    userScenarios: mergedScenarios,
    acceptanceCriteria: mergedCriteria,
  };
}