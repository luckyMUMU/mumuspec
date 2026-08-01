#!/usr/bin/env node
/**
 * launch.mjs — 自包含运行时启动器
 *
 * 用于被打包到 SEA exe 中
 * 自动检测 exe 所在目录并在同目录创建配置和临时文件
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── 确定数据目录 ───
// SEA 打包后，__dirname 指向 exe 所在目录
// 在 exe 同级创建 .app-data 目录
const EXE_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || join(EXE_DIR, '.app-data');
const CONFIG_DIR = process.env.CONFIG_DIR || join(DATA_DIR, 'config');
const TEMP_DIR = process.env.TEMP_DIR || join(DATA_DIR, 'temp');
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(DATA_DIR, 'uploads');

// ─── 确保目录存在 ───
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

[DATA_DIR, CONFIG_DIR, TEMP_DIR, UPLOADS_DIR].forEach(ensureDir);

// ─── 写入运行时配置 ───
const runtimeConfig = {
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
  tempDir: TEMP_DIR,
  uploadsDir: UPLOADS_DIR,
  port: process.env.PORT || '3100',
  host: process.env.HOST || '0.0.0.0',
};

// 写入配置文件
import { writeFileSync } from 'node:fs';
const configPath = join(CONFIG_DIR, 'runtime.json');
writeFileSync(configPath, JSON.stringify(runtimeConfig, null, 2));

// ─── 启动实际服务 ───
const imageSharePath = process.env.IMAGE_SHARE_PATH || join(EXE_DIR, 'image-share', 'dist', 'server.js');

// 设置环境变量供 server.js 使用
process.env.UPLOADS_DIR = UPLOADS_DIR;
process.env.DATA_DIR = DATA_DIR;
process.env.CONFIG_DIR = CONFIG_DIR;
process.env.TEMP_DIR = TEMP_DIR;

// 动态导入并启动
const { createApp } = await import(imageSharePath);
const { createServer } = await import('node:http');

const app = await createApp();
const PORT = parseInt(process.env.PORT || '3100', 10);
const HOST = process.env.HOST || '0.0.0.0';

const server = createServer((req, res) => {
  app(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       MumuSpec Demo — 自包含运行            ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  本地访问:  http://localhost:${PORT}              ║`);
  console.log(`║  数据目录:  ${DATA_DIR}  ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
