#!/usr/bin/env node
/**
 * start.mjs — 统一启动脚本
 *
 * 功能：
 *   1. 启动 Task API 后端服务 (port 3000)
 *   2. 启动前端静态文件服务 (port 3001)
 *   3. 支持 CORS 跨域访问
 *
 * 用法：
 *   node scripts/start.mjs [--api-port 3000] [--frontend-port 3001]
 */

import { spawn, execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── 解析参数 ───
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const API_PORT = parseInt(getArg('--api-port', '3000'));
const FRONTEND_PORT = parseInt(getArg('--frontend-port', '3001'));

// ─── 静态文件服务 (前端) ───
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function startFrontendServer(port) {
  const publicDir = join(PROJECT_ROOT, 'public');

  const server = createServer((req, res) => {
    // 安全路径处理：防止目录遍历
    let pathname = decodeURIComponent(req.url.split('?')[0]);
    if (pathname === '/') pathname = '/index.html';

    const filePath = join(publicDir, pathname);

    // 安全检查：确保路径在 publicDir 内
    if (!filePath.startsWith(publicDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // 检查文件存在
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    // 读取并返回文件
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  });

  server.listen(port, () => {
    console.log(`  🌐 Frontend running on http://localhost:${port}`);
  });

  return server;
}

// ─── 启动 API 服务 ───
function startApiService(port) {
  const apiSrcPath = join(PROJECT_ROOT, 'src', 'api', 'server.ts');
  const distPath = join(PROJECT_ROOT, 'dist', 'api', 'server.js');

  // 优先使用 dist 构建产物，否则用 tsx 运行源码
  const useTsx = !existsSync(distPath);

  let command, cmdArgs;
  if (useTsx) {
    command = 'npx';
    cmdArgs = ['tsx', apiSrcPath];
  } else {
    command = 'node';
    cmdArgs = [distPath];
  }

  const child = spawn(command, cmdArgs, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
  });

  return child;
}

// ─── 构建项目（如果需要） ───
function buildProject() {
  const distPath = join(PROJECT_ROOT, 'dist', 'api', 'server.js');
  if (!existsSync(distPath)) {
    console.log('  🔨 构建 TypeScript...');
    const { execSync } = require('node:child_process');
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  }
}

// ─── 主入口 ───
function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       Task Manager — 统一启动              ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // 检查 public 目录
  const publicDir = join(PROJECT_ROOT, 'public');
  if (!existsSync(publicDir)) {
    console.error('  ❌ public/ 目录不存在，请先构建前端文件');
    process.exit(1);
  }

  // 构建 TypeScript（如果需要）
  const distPath = join(PROJECT_ROOT, 'dist', 'api', 'server.js');
  if (!existsSync(distPath)) {
    console.log('  [1/3] 构建 TypeScript...');
    try {
      execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
    } catch (e) {
      console.error('  ❌ 构建失败，尝试使用 tsx 运行...');
    }
  }

  console.log('\n  [2/3] 启动 API 后端...');
  const apiChild = startApiService(API_PORT);

  console.log('\n  [3/3] 启动前端服务...');
  const frontendServer = startFrontendServer(FRONTEND_PORT);

  console.log('');
  console.log('  ✓ 所有服务已启动');
  console.log(`  📍 API:      http://localhost:${API_PORT}`);
  console.log(`  📍 Frontend: http://localhost:${FRONTEND_PORT}`);
  console.log('');

  // 处理退出
  const shutdown = () => {
    console.log('\n  正在停止服务...');
    apiChild.kill('SIGINT');
    frontendServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  apiChild.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`  ❌ API 服务退出，代码: ${code}`);
    }
    frontendServer.close();
    process.exit(code || 0);
  });
}

try {
  main();
} catch (err) {
  console.error('启动失败:', err);
  process.exit(1);
}
