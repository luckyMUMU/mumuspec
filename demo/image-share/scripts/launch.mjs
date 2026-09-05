/**
 * 自包含运行时启动器 — 由 SEA exe 调用
 * 在 exe 同级目录创建 .app-data/ 存储配置和临时数据
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXE_DIR = __dirname;
const DATA_DIR = join(EXE_DIR, '.app-data');
const CONFIG_DIR = join(DATA_DIR, 'config');
const TEMP_DIR = join(DATA_DIR, 'temp');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');

function setupEnvironment() {
  // Create data directories next to exe
  for (const dir of [DATA_DIR, CONFIG_DIR, TEMP_DIR, UPLOADS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Auto-generate default config.json if not exists
  const configFilePath = join(CONFIG_DIR, 'config.json');
  if (!existsSync(configFilePath)) {
    const defaultConfig = {
      port: 3100,
      host: '0.0.0.0',
      uploadDir: UPLOADS_DIR,
      maxFileSize: 52428800,
      autoScan: false,
    };
    writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2));
  }

  // Detect package source (bundled alongside exe)
  const srcDist = join(EXE_DIR, 'dist');
  if (existsSync(join(srcDist, 'server.js'))) {
    return { distDir: srcDist, mode: 'portable' };
  }

  // Fallback: use installed node_modules
  const nodeModules = join(EXE_DIR, 'node_modules');
  if (existsSync(nodeModules)) {
    return { distDir: srcDist, mode: 'portable-with-deps' };
  }

  throw new Error('找不到 dist/server.js，请确保将 dist/ 目录复制到 exe 同目录');
}

function findServerEntry(distDir) {
  // Check for pre-built server.js
  const serverJs = join(distDir, 'server.js');
  if (existsSync(serverJs)) return { type: 'dist', path: serverJs };

  // Check for src (run with tsx/node --import)
  const srcServer = join(distDir, '..', 'src', 'server.ts');
  if (existsSync(srcServer)) return { type: 'src', path: srcServer };

  throw new Error('找不到服务器入口文件');
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🖼️  局域网高清图片分享 (便携版)  🖼️        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const { distDir, mode } = setupEnvironment();
  console.log(`📁 数据目录: ${DATA_DIR}`);
  console.log(`⚙️  运行模式: ${mode}\n`);

  const entry = findServerEntry(distDir);

  // Resolve node binary (bundled or system)
  const nodeBin = process.execPath;

  // Prepare environment
  const configFileCandidate = join(CONFIG_DIR, 'config.json');
  const env = {
    ...process.env,
    PORT: process.env.PORT ?? '3100',
    HOST: process.env.HOST ?? '0.0.0.0',
    DATA_DIR,
    UPLOAD_DIR: UPLOADS_DIR,
    CONFIG_FILE: existsSync(configFileCandidate) ? configFileCandidate : undefined,
    NODE_ENV: 'production',
  };

  console.log('🚀 启动服务器...\n');

  let child;
  if (entry.type === 'dist') {
    child = spawn(nodeBin, [entry.path], { cwd: EXE_DIR, env, stdio: 'inherit' });
  } else {
    // Use tsx for TypeScript
    const tsxPath = join(EXE_DIR, 'node_modules', '.bin', 'tsx');
    const runner = existsSync(tsxPath) ? tsxPath : 'tsx';
    child = spawn(nodeBin, [runner, entry.path], { cwd: join(distDir, '..'), env, stdio: 'inherit' });
  }

  // Handle shutdown
  const shutdown = () => {
    console.log('\n🛑 正在关闭服务...');
    child.kill('SIGINT');
    setTimeout(() => child.kill('SIGTERM'), 3000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  child.on('exit', (code) => {
    console.log(`\n服务已停止 (exit code: ${code})`);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('\n❌ 启动失败:', err.message);
  console.log('\n请检查:');
  console.log('  1. dist/server.js 是否与 exe 同目录');
  console.log('  2. 端口是否被占用');
  pause();
  process.exit(1);
});

function pause() {
  if (process.stdin.isTTY) {
    console.log('\n按 Enter 退出...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(1));
  }
}
