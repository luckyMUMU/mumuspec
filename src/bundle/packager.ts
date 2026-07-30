import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export interface BundleManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  files: { path: string; hash: string }[];
  createdAt: string;
}

export interface BundleResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  fileCount?: number;
}

export interface PublishResult {
  success: boolean;
  bundlePath?: string;
  error?: string;
}

/**
 * Create a bundle (tarball-like archive descriptor) of the skills directory.
 * ponytail: no tar/binary deps — uses zip archive descriptor + individual files
 */
export function createBundle(
  projectRoot: string,
  options: {
    name?: string;
    outputDir?: string;
    includeEvals?: boolean;
    includeAuthoring?: boolean;
  } = {},
): BundleResult {
  const skillsDir = join(projectRoot, '.mumuspec', 'skills');

  if (!existsSync(skillsDir)) {
    return { success: false, error: 'No .mumuspec/skills/ directory found' };
  }

  const outputDir = options.outputDir || join(projectRoot, '.mumuspec', 'bundles');
  const bundleName = options.name || 'mumuspec-skills';

  // Collect all skill files
  const files: { path: string; hash: string }[] = [];

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip non-included directories
          if (entry.name === 'evals' && !options.includeEvals) continue;
          if (entry.name === 'authoring' && !options.includeAuthoring) continue;
          scanDir(fullPath);
        } else if (entry.isFile()) {
          // Skip locale directories except default
          const relPath = relative(skillsDir, fullPath);
          if (relPath.startsWith('en/') || relPath.startsWith('zh/')) {
            // Include locale files
          }
          const content = readFileSync(fullPath);
          const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
          files.push({ path: relPath, hash });
        }
      }
    } catch {
      // ignore
    }
  }

  scanDir(skillsDir);

  if (files.length === 0) {
    return { success: false, error: 'No skill files found to bundle' };
  }

  // Read version from package.json or config
  let version = '0.12.2';
  const pkgPath = join(projectRoot, '.mumuspec', 'config.yaml');
  if (existsSync(pkgPath)) {
    try {
      const config = readFileSync(pkgPath, 'utf8');
      const match = config.match(/^version:\s*["']?([0-9.]+)/m);
      if (match) version = match[1];
    } catch {
      // ignore
    }
  }

  const manifest: BundleManifest = {
    name: bundleName,
    version,
    description: 'MumuSpec skill bundle',
    files,
    createdAt: new Date().toISOString(),
  };

  // Write bundle descriptor + copy files
  try {
    mkdirSync(outputDir, { recursive: true });

    const manifestPath = join(outputDir, `${bundleName}.json`);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Copy bundle files for easy inspection
    const bundleFilesDir = join(outputDir, bundleName);
    mkdirSync(bundleFilesDir, { recursive: true });

    for (const file of files) {
      const srcPath = join(skillsDir, file.path);
      const destPath = join(bundleFilesDir, file.path);
      const destDir = join(destPath, '..');
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      try {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      } catch {
        // skip
      }
    }

    return {
      success: true,
      outputPath: outputDir,
      fileCount: files.length,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to write bundle: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Validate a bundle manifest.
 */
export function validateBundle(bundlePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!existsSync(bundlePath)) {
    errors.push(`Bundle not found: ${bundlePath}`);
    return { valid: false, errors };
  }

  try {
    const content = readFileSync(bundlePath, 'utf8');
    const manifest = JSON.parse(content) as BundleManifest;

    if (!manifest.name) errors.push('Missing name');
    if (!manifest.version) errors.push('Missing version');
    if (!manifest.files || !Array.isArray(manifest.files)) {
      errors.push('Missing files array');
    }

    // Verify hashes if bundle files exist
    const bundleDir = join(bundlePath.replace(/\.json$/, ''));
    if (existsSync(bundleDir) && manifest.files) {
      for (const file of manifest.files) {
        const filePath = join(bundleDir, file.path);
        if (!existsSync(filePath)) {
          errors.push(`Missing file: ${file.path}`);
          continue;
        }
        const fileContent = readFileSync(filePath);
        const actualHash = createHash('sha256').update(fileContent).digest('hex').slice(0, 16);
        if (actualHash !== file.hash) {
          errors.push(`Hash mismatch: ${file.path} (expected ${file.hash}, got ${actualHash})`);
        }
      }
    }
  } catch (err) {
    errors.push(`Failed to parse bundle: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Install a bundle into a target workspace.
 */
export function installBundle(
  bundlePath: string,
  targetWorkspace: string,
): PublishedInstallResult {
  const errors: string[] = [];
  const installed: string[] = [];

  if (!existsSync(bundlePath)) {
    return { success: false, error: `Bundle not found: ${bundlePath}`, installed };
  }

  try {
    const content = readFileSync(bundlePath, 'utf8');
    const manifest = JSON.parse(content) as BundleManifest;

    const targetSkillsDir = join(targetWorkspace, '.mumuspec', 'skills');
    mkdirSync(targetSkillsDir, { recursive: true });

    const bundleDir = bundlePath.replace(/\.json$/, '');

    if (existsSync(bundleDir)) {
      // Install from extracted files
      for (const file of manifest.files) {
        const srcPath = join(bundleDir, file.path);
        const destPath = join(targetSkillsDir, file.path);
        if (existsSync(srcPath)) {
          const destDir = join(destPath, '..');
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          const fileContent = readFileSync(srcPath);
          writeFileSync(destPath, fileContent);
          installed.push(file.path);
        } else {
          errors.push(`Missing source file: ${file.path}`);
        }
      }
    } else {
      errors.push(`Bundle files not found at ${bundleDir}`);
    }
  } catch (err) {
    errors.push(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    success: errors.length === 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    installed,
  };
}

export interface PublishedInstallResult {
  success: boolean;
  error?: string;
  installed: string[];
}

/**
 * Simulate publishing (placeholder for registry integration).
 */
export function publishBundle(
  bundlePath: string,
  _registry?: string,
): PublishResult {
  if (!existsSync(bundlePath)) {
    return { success: false, error: `Bundle not found: ${bundlePath}` };
  }

  const validation = validateBundle(bundlePath);
  if (!validation.valid) {
    return { success: false, error: `Bundle invalid: ${validation.errors.join('; ')}` };
  }

  // In a real implementation, this would:
  // 1. Upload to a registry (npm, GitHub, custom)
  // 2. Register in the registry index
  // 3. Return the registry URL

  return {
    success: true,
    bundlePath,
  };
}

/**
 * List available bundles in the project.
 */
export function listBundles(projectRoot: string): string[] {
  const bundlesDir = join(projectRoot, '.mumuspec', 'bundles');
  if (!existsSync(bundlesDir)) return [];

  try {
    return readdirSync(bundlesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => join(bundlesDir, f));
  } catch {
    return [];
  }
}
