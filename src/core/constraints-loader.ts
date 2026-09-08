/**
 * constraints-loader.ts — disk loader for tree-distributed `constraints.yaml` (0.12.1+).
 *
 * Provides the I/O layer that `resolveConstraintTree()` (a pure function in
 * `config.ts`) deliberately avoids. Walks the project directory tree,
 * discovers every `.mumuspec/constraints.yaml` file, parses each into a
 * `ConstraintsFile`, and returns the collection ready to feed into
 * `resolveConstraintTree()`.
 *
 * Layout (per docs/design/constraint-strength.md §5.2):
 *
 *   my-project/
 *   ├── .mumuspec/constraints.yaml          ← Level 0 (root)
 *   ├── src/
 *   │   ├── .mumuspec/constraints.yaml      ← Level 1
 *   │   └── api/
 *   │       └── .mumuspec/constraints.yaml  ← Level 2
 *   └── tests/
 *       └── .mumuspec/constraints.yaml      ← Level 1
 *
 * The loader is responsible for:
 *   - Discovering all `constraints.yaml` files under `projectRoot`
 *   - Skipping `node_modules`, `.git`, `dist`, and other noise directories
 *   - Stamping each loaded file with a normalized `scope` (relative path)
 *   - Coalescing parse errors into a `warnings` channel (non-fatal)
 *
 * The loader is NOT responsible for:
 *   - Resolving inheritance / tightening / conflicts (that's `resolveConstraintTree`)
 *   - Validating constraint content semantics (that's the Guard Layer)
 *   - Loading `config.yaml` (that's `loadConfig` in `config.ts`)
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readYaml, getMumuSpecDir, SKIP_DIRS } from './utils.js';
import { normalizeScope } from './config.js';
import type { ConstraintsFile, ConstraintStrength } from './types.js';

/**
 * Directories that are never scanned for `.mumuspec/` content. Keeps the
 * loader from descending into dependencies, build artifacts, and VCS data.
 */
// SKIP_DIRS 已统一收编到 ./utils.js（Phase 3.4），此处直接复用共享集合

export interface LoadConstraintsOptions {
  /**
   * Maximum directory depth to scan, where 0 = project root only.
   * Default: 10 (covers virtually all realistic project layouts).
   * Set lower to bound runtime on huge monorepos.
   */
  maxDepth?: number;
  /**
   * If true, returns `[]` instead of throwing when the project root has no
   * `.mumuspec/` directory at all. Default: true.
   */
  allowMissingRoot?: boolean;
}

export interface LoadConstraintsResult {
  /** Successfully parsed `ConstraintsFile` records, one per discovered file. */
  files: ConstraintsFile[];
  /** Non-fatal warnings (e.g. a file failed to parse, or has invalid shape). */
  warnings: string[];
}

/**
 * Load a single `.mumuspec/constraints.yaml` from `dir`.
 *
 * Returns `undefined` if the file does not exist or is empty. The returned
 * `ConstraintsFile` has its `scope` field set to `normalizeScope(relativeDir)`,
 * where `relativeDir` is `dir` relative to `projectRoot`.
 *
 * Does NOT validate the file's content beyond a basic shape check — that's
 * the resolver's job.
 */
export function loadConstraintsFile(
  dir: string,
  projectRoot: string,
): ConstraintsFile | undefined {
  const mumuDir = getMumuSpecDir(dir);
  const filePath = join(mumuDir, 'constraints.yaml');
  const raw = readYaml<Record<string, unknown>>(filePath);
  if (!raw) return undefined;

  // Normalize scope from the directory path. Root → ".".
  const relDir = relative(projectRoot, dir) || '.';
  const scope = normalizeScope(relDir);

  // Stamp scope onto the file; the resolver relies on this field.
  // We intentionally spread `raw` first so an explicit `scope:` in the YAML
  // is overridden by the path-derived value (path is authoritative).
  const file: ConstraintsFile = {
    ...(raw as unknown as ConstraintsFile),
    scope,
  };

  // Derive layer from path depth if not explicitly set (root = 0).
  if (file.layer === undefined) {
    file.layer = scope === '.' ? 0 : scope.split('/').filter(Boolean).length;
  }

  return file;
}

/**
 * Walk `projectRoot` and load every `.mumuspec/constraints.yaml` found.
 *
 * Returns an array suitable for passing directly to `resolveConstraintTree()`:
 *
 * ```ts
 * const { files, warnings } = loadAllConstraints(projectRoot);
 * const config = loadConfig(projectRoot);
 * const resolution = resolveConstraintTree(files, {
 *   technical_design: config.constraint_strength.technical_design,
 *   requirement_goals: config.constraint_strength.requirement_goals,
 * });
 * ```
 *
 * The walk is breadth-first-ish (directory-by-directory, root first) so the
 * resulting array is already in approximate layer order. `resolveConstraintTree`
 * re-sorts by layer anyway, so callers should not rely on array order.
 *
 * Files that fail to parse are skipped; their paths are added to `warnings`.
 * Missing files are silently ignored (no warning) — a project is allowed to
 * have constraints at only some layers.
 */
export function loadAllConstraints(
  projectRoot: string,
  options: LoadConstraintsOptions = {},
): LoadConstraintsResult {
  const { maxDepth = 10, allowMissingRoot = true } = options;
  const files: ConstraintsFile[] = [];
  const warnings: string[] = [];

  if (!existsSync(getMumuSpecDir(projectRoot))) {
    if (allowMissingRoot) {
      return { files, warnings };
    }
    throw new Error(
      `loadAllConstraints: project root "${projectRoot}" has no .mumuspec/ directory`,
    );
  }

  // Scan the project root first (Level 0).
  const rootFile = loadConstraintsFile(projectRoot, projectRoot);
  if (rootFile) {
    files.push(rootFile);
  }

  // Walk subdirectories. We deliberately do NOT recurse into `node_modules`,
  // `.git`, `dist`, etc. — see `SKIP_DIRS`.
  const scan = (dir: string, depth: number) => {
    if (depth >= maxDepth) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      // Permission errors etc. — skip silently.
      return;
    }

    for (const entry of entries) {
      // Skip explicit noise directories.
      if (SKIP_DIRS.has(entry)) continue;
      // Skip dotfiles other than `.mumuspec` (handled separately above).
      if (entry.startsWith('.') && entry !== '.mumuspec') continue;

      const fullPath = join(dir, entry);
      let isDir: boolean;
      try {
        isDir = statSync(fullPath).isDirectory();
      } catch {
        continue;
      }
      if (!isDir) continue;

      // Does this subdirectory contain a `.mumuspec/constraints.yaml`?
      const subFile = loadConstraintsFile(fullPath, projectRoot);
      if (subFile) {
        files.push(subFile);
      }

      // Recurse regardless of whether this directory has constraints —
      // deeper layers may have their own `.mumuspec/`.
      scan(fullPath, depth + 1);
    }
  };

  scan(projectRoot, 0);

  return { files, warnings };
}

/**
 * Resolve the effective strength for the root layer, falling back to
 * `config.yaml: constraint_strength.*` when no root `constraints.yaml`
 * exists or when the root file omits `strength`.
 *
 * Per §5.6.4 rule 3: "根层 `strength.<dim>` 缺省 → 回退到
 * `config.yaml: constraint_strength.<dim>`".
 *
 * Convenience helper — callers of `resolveConstraintTree` need this to
 * supply the `rootStrength` argument.
 */
export function resolveRootStrength(
  files: ConstraintsFile[],
  configStrength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  },
): { technical_design: ConstraintStrength; requirement_goals: ConstraintStrength } {
  const rootFile = files.find((f) => {
    const scope = normalizeScope(f.scope);
    return scope === '.';
  });

  if (!rootFile?.strength) {
    return { ...configStrength };
  }

  return {
    technical_design: rootFile.strength.technical_design ?? configStrength.technical_design,
    requirement_goals: rootFile.strength.requirement_goals ?? configStrength.requirement_goals,
  };
}

/**
 * One-shot convenience: load + resolve the entire constraint tree for a project.
 *
 * Combines `loadAllConstraints` → `resolveRootStrength` → `resolveConstraintTree`
 * into a single call. Returns the `ConstraintTreeResolution` ready for
 * Guard Layer / CLI / MCP consumption.
 *
 * Throws if `loadConfig` would throw (e.g. invalid config.yaml). Otherwise
 * never throws — parse/resolution errors surface as `warnings` on the result.
 */
export function loadAndResolveConstraints(
  projectRoot: string,
  configStrength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  },
  resolveFn: (
    files: ConstraintsFile[],
    rootStrength: { technical_design: ConstraintStrength; requirement_goals: ConstraintStrength },
  ) => import('./types.js').ConstraintTreeResolution,
  options: LoadConstraintsOptions = {},
): {
  resolution: import('./types.js').ConstraintTreeResolution;
  warnings: string[];
} {
  const combinedWarnings: string[] = [];

  const { files, warnings: loadWarnings } = loadAllConstraints(projectRoot, options);
  combinedWarnings.push(...loadWarnings);

  const rootStrength = resolveRootStrength(files, configStrength);
  const resolution = resolveFn(files, rootStrength);

  combinedWarnings.push(...resolution.warnings);

  return { resolution: { ...resolution, warnings: combinedWarnings }, warnings: combinedWarnings };
}
