/**
 * 打包独立 exe 脚本 — 使用 Node.js SEA (Single Executable Application)
 * Usage: node scripts/build-exe.mjs [--output image-share.exe]
 *
 * Requirements:
 *   - Node.js >= 20.6 (推荐 22+)
 *   - sea-config.json (自动生成)
 */

import { execSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const outIdx = args.indexOf('--output');
const outputName = outIdx !== -1 ? args[outIdx + 1] : 'image-share.exe';
const outputPath = join(ROOT, 'dist', outputName);

function getNodePath() {
  return process.execPath;
}

function createSeaConfig() {
  const config = {
    main: join(ROOT, 'dist', 'sea-bundle.js'),
    output: join(ROOT, 'dist', 'sea-blob'),
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
  };
  const configPath = join(ROOT, 'dist', 'sea-config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

function checkNodeVersion() {
  const [major, minor] = process.version.slice(1).split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 6)) {
    throw new Error(`Node.js >= 20.6 required for SEA, got ${process.version}`);
  }
  console.log(`✓ Node.js ${process.version} (SEA supported)`);
}

function bundleApp() {
  console.log('\n📦 打包应用代码...\n');
  const entryCode = `
// SEA bundle entry — redirects to launch.mjs at runtime
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node.url';

// Find launch.mjs next to the exe at runtime
const exeDir = dirname(process.execPath);
const launchScript = join(exeDir, 'launch.mjs');

const result = spawnSync(process.execPath, [launchScript], { stdio: 'inherit' });
process.exit(result.status ?? 0);
`;
  const bundlePath = join(ROOT, 'dist', 'sea-bundle.js');
  writeFileSync(bundlePath, entryCode);
  return bundlePath;
}

async function main() {
  console.log('🔨 构建独立 exe — Node.js SEA\n');

  checkNodeVersion();

  // Build project first
  if (!existsSync(join(ROOT, 'dist', 'server.js'))) {
    console.log('📦 构建项目...\n');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }

  // Create SEA config
  const configPath = createSeaConfig();
  console.log(`✓ SEA config: ${configPath}`);

  // Bundle app
  const bundlePath = bundleApp();
  console.log(`✓ Bundle: ${bundlePath}`);

  // Generate blob
  console.log('\n🧬 生成 SEA blob...\n');
  execSync(`node --experimental-sea-config "${configPath}"`, { stdio: 'inherit' });

  // Copy node.exe and inject blob
  const nodeExe = getNodePath();
  console.log(`\n💉 注入 blob 到 ${outputName}...\n`);
  copyFileSync(nodeExe, outputPath);

  try {
    execSync(
      `npx --yes postject "${outputPath}" NODE_SEA_BLOB "${join(ROOT, 'dist', 'sea-blob')}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
      { stdio: 'inherit' }
    );
    console.log(`\n✓ 独立 exe 已生成: ${outputPath}`);
  } catch {
    console.log('\n⚠️  postject 不可用，使用备用方案生成 .bat/.sh 启动器');
    createLauncherScript(outputPath);
  }

  console.log('\n🚀 使用方式:');
  console.log(`  1. 将 ${outputName} 复制到任意位置`);
  console.log(`  2. 同时复制 scripts/launch.mjs 到同目录`);
  console.log(`  3. 双击 ${outputName} 启动服务`);
}

function createLauncherScript(exePath) {
  const batPath = exePath.replace('.exe', '.bat');
  const shPath = exePath.replace('.exe', '.sh');

  // Windows batch launcher
  const batContent = `@echo off
set EXE_DIR=%~dp0
node "%EXE_DIR%launch.mjs"
`;
  writeFileSync(batPath, batContent);

  // Unix shell launcher
  const shContent = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/launch.mjs"
`;
  writeFileSync(shPath, shContent);

  console.log(`  ✓ Launcher: ${batPath}`);
  console.log(`  ✓ Launcher: ${shPath}`);
}

main().catch((err) => {
  console.error('\n❌ 构建失败:', err.message);
  process.exit(1);
});
