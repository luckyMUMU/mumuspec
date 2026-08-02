import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { SpecContext, SpecLayerContext, SpecIndex, IndexChildEntry, PrdFile, TechFile } from '../core/types.js';
import { parseSpecFile } from './parser.js';
import { parseFrontmatter } from '../core/utils.js';
import { parse as parseYaml } from 'yaml';
import type { MumuSpecConfig } from '../core/config.js';

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
        const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
        const spec = parseSpecFile(content, techPath);
        layer.tech = {
          path: techPath,
          scope: frontmatter?.scope || scope,
          layer: frontmatter?.layer || level,
          content: body,
          requirements: spec.requirements,
          architectureDecisions: [],
        };
        // Collect prohibitions from tech.md
        for (const req of spec.requirements) {
          prohibitions.push(...req.shallNot);
        }
      } catch {
        // Skip invalid tech.md
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
        } catch {
          // Skip invalid specs
        }
      }
    }

    // Load prd.md (new format) — falls back to design.md for backward compatibility
    const prdPath = join(mumuDir, 'prd.md');
    if (existsSync(prdPath)) {
      try {
        const content = readFileSync(prdPath, 'utf8');
        const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
        layer.prd = {
          path: prdPath,
          scope: frontmatter?.scope || scope,
          layer: frontmatter?.layer || level,
          content: body,
          userScenarios: [],
          acceptanceCriteria: [],
        };
      } catch {
        // Skip invalid prd.md
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
      } catch {
        // Skip invalid index
      }
    }
  }

  return {
    targetPath,
    layers,
    prohibitions: [...new Set(prohibitions)],
    index,
  };
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
    } catch {
      // Use defaults
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
          const spec = parseSpecFile(content, childTechPath);
          const firstReq = spec.requirements[0];
          techSummary = firstReq?.name || entry.name;
          constraintCount = spec.requirements.reduce((sum: number, r) => sum + r.shallNot.length + r.shall.length, 0);
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
        summary: techSummary,
        shallNotCount: 0,
        prd_summary: prdSummary,
        tech_summary: techSummary,
        constraint_count: constraintCount,
      });
    }
  } catch {
    // Ignore errors
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
    const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
    return {
      path: prdPath,
      scope: frontmatter?.scope || '.',
      layer: frontmatter?.layer || 0,
      content: body,
      userScenarios: [],
      acceptanceCriteria: [],
    };
  } catch {
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
    } catch {
      return undefined;
    }
  }
  try {
    const content = readFileSync(techPath, 'utf8');
    const { frontmatter, body } = parseFrontmatter<{ scope: string; layer: number }>(content);
    const spec = parseSpecFile(content, techPath);
    return {
      path: techPath,
      scope: frontmatter?.scope || '.',
      layer: frontmatter?.layer || 0,
      content: body,
      requirements: spec.requirements,
      architectureDecisions: [],
    };
  } catch {
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
      } catch {
        // Skip invalid
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
    } catch {
      // Ignore
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
      } catch {
        // Skip
      }
    }
  }

  return results;
}
