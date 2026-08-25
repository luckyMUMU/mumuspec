/**
 * 一键启动脚本 — 自动安装依赖、构建并启动服务
 * Usage: node scripts/start.mjs [--port 3100] [--data-dir ./my-data]
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx !== -1 ? args[portIdx + 1] : '3100';
const dataDirIdx = args.indexOf('--data-dir');
const dataDir = dataDirIdx !== -1 ? args[dataDirIdx + 1] : join(ROOT, '.app-data');

function ensureDirs() {
  const dirs = [dataDir, join(dataDir, 'config'), join(dataDir, 'temp'), join(dataDir, 'uploads')];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

async function main() {
  console.log('🚀 LAN Image Share — 一键启动\n');

  // Check node_modules
  if (!existsSync(join(ROOT, 'node_modules'))) {
    console.log('📦 安装依赖...\n');
    run('npm install');
  }

  // Build if dist missing
  if (!existsSync(join(ROOT, 'dist', 'server.js'))) {
    console.log('\n🔨 构建 TypeScript...\n');
    run('npm run build');
  }

  // Ensure data dirs
  ensureDirs();

  // Start server
  console.log('\n🖼️  启动服务...\n');
  const env = { ...process.env, PORT: port, DATA_DIR: dataDir };
  const child = spawn('node', ['dist/server.js'], { cwd: ROOT, stdio: 'inherit', env });

  child.on('exit', (code) => {
    console.log(`\n服务已停止 (exit code: ${code})`);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
