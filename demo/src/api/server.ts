/**
 * HTTP 服务器
 * 使用 Node.js 原生 http 模块创建服务器
 */

import { createServer, type Server } from 'node:http';
import { pathToFileURL } from 'node:url';
import { handleRequest } from './routes.js';

const DEFAULT_PORT = 3000;

export function startServer(port?: number): Server {
  const actualPort = port || parseInt(process.env.PORT || '') || DEFAULT_PORT;

  const server = createServer((req, res) => {
    handleRequest(req, res);
  });

  server.listen(actualPort, () => {
    console.log(`Task API server running on http://localhost:${actualPort}`);
  });

  return server;
}

// 直接运行时启动服务器（兼容 Windows 路径格式）
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
