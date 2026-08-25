#!/usr/bin/env node
/**
 * build-exe.mjs — 打包为独立无外部依赖的 exe 单一文件
 *
 * 使用 Node.js SEA (Single Executable Application) 技术
 * 需要 Node.js >= 20.0.0
 *
 * 用法：
 *   node scripts/build-exe.mjs [--output dist/app.exe] [--node path/to/node.exe]
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const IMAGE_SHARE_DIR = join(PROJECT_ROOT, 'image-share');

// ─── 解析参数 ───
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const OUTPUT_PATH = getArg('--output', join(PROJECT_ROOT, 'dist', 'image-share.exe'));
const NODE_EXE = getArg('--node', process.execPath);

// ─── 工具函数 ───
function checkNodeVersion() {
  const [major, minor] = process.version.slice(1).split('.').map(Number);
  if (major < 20) {
    console.error(`  ❌ 需要 Node.js >= 20.0.0，当前: ${process.version}`);
    console.error(`  请升级 Node.js 后重试`);
    process.exit(1);
  }
  console.log(`  ✓ Node.js ${process.version}`);
}

function buildTypeScript() {
  console.log('\n  [2/4] 构建 TypeScript');
  execSync('npm run build --prefix image-share', { stdio: 'inherit', cwd: PROJECT_ROOT });
  console.log('  ✓ 构建完成');
}

function generateSeaConfig() {
  console.log('\n  [3/4] 生成 SEA 配置');

  const config = {
    main: join(IMAGE_SHARE_DIR, 'dist', 'server.js'),
    output: join(PROJECT_ROOT, 'dist', 'sea-prep.blob'),
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: true,
    // assets: {}  // 静态资源如需内联可在此处配置
  };

  const configPath = join(PROJECT_ROOT, 'dist', 'sea-config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`  ✓ 配置已生成: ${configPath}`);
  return configPath;
}

function createExecutable(configPath) {
  console.log('\n  [4/4] 生成独立 exe');

  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Step 1: 生成 blob
  console.log('    生成 SEA blob...');
  execSync(`node --experimental-sea-config "${configPath}"`, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
  });

  // Step 2: 复制 node.exe 并注入 blob
  console.log('    注入 blob 到可执行文件...');
  const blobPath = join(PROJECT_ROOT, 'dist', 'sea-prep.blob');

  // 清理旧文件
  if (existsSync(OUTPUT_PATH)) {
    rmSync(OUTPUT_PATH);
  }

  // 复制 node 可执行文件
  copyFileSync(NODE_EXE, OUTPUT_PATH);

  // 使用 postject 注入 blob
  const postjectCmd = process.platform === 'win32'
    ? `npx postject "${OUTPUT_PATH}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`
    : `npx postject "${OUTPUT_PATH}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;

  try {
    execSync(postjectCmd, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
  } catch {
    // 降级方案：使用 node 直接运行
    console.log('  ⚠ postject 不可用，使用降级方案');
    console.log('  创建启动脚本替代...');
    createFallbackLauncher();
    return;
  }

  // 获取文件大小
  const stats = existsSync(OUTPUT_PATH) ? require('node:fs').statSync(OUTPUT_PATH) : null;
  const sizeMB = stats ? (stats.size / 1024 / 1024).toFixed(1) : '?';

  console.log(`\n  ✅ 打包成功!`);
  console.log(`  📦 输出: ${OUTPUT_PATH}`);
  console.log(`  📐 大小: ${sizeMB} MB`);
}

function createFallbackLauncher() {
  // 降级方案：创建 .bat/.sh 启动脚本
  if (process.platform === 'win32') {
    const batPath = join(PROJECT_ROOT, 'dist', 'image-share.bat');
    const content = `@echo off
set IMAGE_SHARE_ROOT=%~dp0..
cd /d %IMAGE_SHARE_ROOT%\\image-share
node dist\\server.js %*
`;
    writeFileSync(batPath, content);
    console.log(`  📄 降级启动器: ${batPath}`);
  } else {
    const shPath = join(PROJECT_ROOT, 'dist', 'image-share.sh');
    const content = `#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/../image-share"
node dist/server.js "$@"
`;
    writeFileSync(shPath, content);
    // chmod +x
    try { execSync(`chmod +x "${shPath}"`); } catch {}
    console.log(`  📄 降级启动器: ${shPath}`);
  }
}

// ─── 主入口 ───
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       MumuSpec Demo — 打包独立 exe          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  console.log('  [1/4] 检查环境');
  checkNodeVersion();

  // 确保 dist 目录存在
  const distDir = join(PROJECT_ROOT, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  buildTypeScript();
  const configPath = generateSeaConfig();
  createExecutable(configPath);

  console.log('\n  提示:');
  console.log('  1. 运行 exe 时会自动创建 .app-data/ 目录');
  console.log('  2. 配置文件保存在 .app-data/config/');
  console.log('  3. 上传文件保存在 .app-data/uploads/');
  console.log('  4. 端口可通过 PORT 环境变量配置');
  console.log('');
}

main().catch((err) => {
  console.error('打包失败:', err);
  process.exit(1);
});
