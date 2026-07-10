import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import type { SpecFile, SpecContext, SpecLayerContext, SpecIndex, IndexChildEntry } from '../core/types.js';
import { parseSpecFile } from './parser.js';
import { parseFrontmatter, getLayerLevel } from '../core/utils.js';
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

    // Load spec.md
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

    // Load design.md
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
  maxDepth: number,
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

  // Read the current directory's spec to get layer and scope
  const specPath = join(mumuDir, 'spec.md');
  let layer = 0;
  let scope = '.';

  if (existsSync(specPath)) {
    try {
      const content = readFileSync(specPath, 'utf8');
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

      const childSpecPath = join(childMumuDir, 'spec.md');
      let summary = '';
      let shallNotCount = 0;

      if (existsSync(childSpecPath)) {
        try {
          const content = readFileSync(childSpecPath, 'utf8');
          const spec = parseSpecFile(content, childSpecPath);
          const firstReq = spec.requirements[0];
          summary = firstReq?.name || entry.name;
          shallNotCount = spec.requirements.reduce((sum, r) => sum + r.shallNot.length, 0);
        } catch {
          summary = entry.name;
        }
      }

      children.push({
        name: entry.name,
        path: relative(projectRoot, childDir).split(sep).join('/'),
        summary,
        shallNotCount,
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
    const specPath = join(mumuDir, 'spec.md');

    if (existsSync(specPath)) {
      try {
        const content = readFileSync(specPath, 'utf8');
        const spec = parseSpecFile(content, specPath);
        const relScope = relative(projectRoot, dirPath).split(sep).join('/') || '.';

        // Filter by scope if specified
        if (options.scope && !relScope.includes(options.scope)) {
          // Continue scanning children
        } else {
          for (const req of spec.requirements) {
            if (!options.type || options.type === 'shall') {
              for (const shall of req.shall) {
                if (!options.keyword || shall.toLowerCase().includes(options.keyword.toLowerCase())) {
                  results.push({ file: specPath, requirement: req.name, text: shall, type: 'shall' });
                }
              }
            }
            if (!options.type || options.type === 'shall-not') {
              for (const shallNot of req.shallNot) {
                if (!options.keyword || shallNot.toLowerCase().includes(options.keyword.toLowerCase())) {
                  results.push({ file: specPath, requirement: req.name, text: shallNot, type: 'shall-not' });
                }
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
    const specPath = join(dirPath, '.mumuspec', 'spec.md');
    if (existsSync(specPath)) {
      try {
        const content = readFileSync(specPath, 'utf8');
        const spec = parseSpecFile(content, specPath);
        for (const req of spec.requirements) {
          for (const shallNot of req.shallNot) {
            results.push({ scope, text: shallNot, source: specPath });
          }
        }
      } catch {
        // Skip
      }
    }
  }

  return results;
}
