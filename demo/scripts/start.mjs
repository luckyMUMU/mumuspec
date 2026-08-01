#!/usr/bin/env node
/**
 * start.mjs — 一键启动脚本
 *
 * 功能：
 *   1. 自动检测并安装依赖
 *   2. 构建 TypeScript
 *   3. 启动后端 API 服务 + 前端静态页面
 *   4. 支持同目录创建配置和临时文件
 *
 * 用法：
 *   node scripts/start.mjs [--port 3100] [--data-dir .app-data]
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── 解析参数 ───
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const PORT = getArg('--port', '3100');
const DATA_DIR = getArg('--data-dir', join(PROJECT_ROOT, '.app-data'));
const CONFIG_DIR = join(DATA_DIR, 'config');
const TEMP_DIR = join(DATA_DIR, 'temp');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');

// ─── 工具函数 ───
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`  📁 创建目录: ${dir}`);
  }
}

function run(cmd, opts = {}) {
  console.log(`  ▶ ${cmd}`);
  return execSync(cmd, {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...opts.env },
    ...opts,
  });
}

function checkNodeVersion() {
  const [major] = process.version.slice(1).split('.').map(Number);
  if (major < 20) {
    console.error(`  ❌ 需要 Node.js >= 20，当前版本: ${process.version}`);
    process.exit(1);
  }
  console.log(`  ✓ Node.js ${process.version}`);
}

function checkDependencies() {
  const nodeModulesPath = join(PROJECT_ROOT, 'image-share', 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.log('  📦 安装依赖...');
    run('npm install --prefix image-share');
  } else {
    console.log('  ✓ 依赖已安装');
  }
}

// ─── 启动服务 ───
async function startServices() {
  console.log('\n  正在启动服务...\n');

  const imageShareDir = join(PROJECT_ROOT, 'image-share');
  const distPath = join(imageShareDir, 'dist', 'server.js');

  // 确保数据目录存在
  ensureDir(DATA_DIR);
  ensureDir(CONFIG_DIR);
  ensureDir(TEMP_DIR);
  ensureDir(UPLOADS_DIR);

  // 检查是否需要构建
  if (!existsSync(distPath)) {
    console.log('  🔨 构建项目...');
    run('npm run build --prefix image-share');
  }

  // 启动后端
  const serverEnv = {
    PORT,
    HOST: '0.0.0.0',
    DATA_DIR,
    CONFIG_DIR,
    TEMP_DIR,
    UPLOADS_DIR,
  };

  console.log('  🚀 启动服务...\n');

  const child = spawn('node', [distPath], {
    cwd: imageShareDir,
    env: { ...process.env, ...serverEnv },
    stdio: 'inherit',
  });

  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`\n  服务退出，代码: ${code}`);
    }
    process.exit(code || 0);
  });

  // 处理 Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n  正在停止服务...');
    child.kill('SIGINT');
  });
}

// ─── 主入口 ───
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       MumuSpec Demo — 一键启动              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  console.log('  [1/3] 检查环境');
  checkNodeVersion();

  console.log('\n  [2/3] 检查依赖');
  checkDependencies();

  console.log('\n  [3/3] 启动服务');
  await startServices();
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
