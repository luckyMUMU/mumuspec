/**
 * 路由处理层
 * 解析 HTTP 请求，调用 storage 层，返回 JSON 响应
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Task } from '../models/task.js';
import { validateTask } from '../models/task.js';
import { createTask, getTask, updateTask, deleteTask, listTasks } from '../storage/store.js';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 发送 JSON 响应 */
function sendJSON(res: ServerResponse, statusCode: number, body: ApiResponse): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** 解析请求体 */
function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** 路由分发主函数 */
export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost`);
  const method = req.method || 'GET';
  const pathParts = url.pathname.split('/').filter(Boolean);

  // 路由: /tasks 和 /tasks/:id
  if (pathParts[0] !== 'tasks') {
    sendJSON(res, 404, { success: false, error: 'Not found' });
    return;
  }

  const taskId = pathParts[1]; // 可选的 :id 参数

  try {
    // GET /tasks — 列出所有任务
    if (method === 'GET' && !taskId) {
      const tasks = listTasks();
      sendJSON(res, 200, { success: true, data: tasks });
      return;
    }

    // GET /tasks/:id — 获取单个任务
    if (method === 'GET' && taskId) {
      const task = getTask(taskId);
      if (!task) {
        sendJSON(res, 404, { success: false, error: 'Task not found' });
        return;
      }
      sendJSON(res, 200, { success: true, data: task });
      return;
    }

    // POST /tasks — 创建任务
    if (method === 'POST' && !taskId) {
      const bodyStr = await parseBody(req);
      const data = JSON.parse(bodyStr || '{}');
      const validation = validateTask(data);
      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.errors.join('; ') });
        return;
      }
      const task = createTask(data as { title: string; status?: Task['status'] });
      sendJSON(res, 201, { success: true, data: task });
      return;
    }

    // PATCH /tasks/:id — 更新任务
    if (method === 'PATCH' && taskId) {
      const bodyStr = await parseBody(req);
      const data = JSON.parse(bodyStr || '{}');
      const validation = validateTask({ title: data.title || 'valid', ...data });
      if (!validation.valid) {
        sendJSON(res, 400, { success: false, error: validation.errors.join('; ') });
        return;
      }
      const task = updateTask(taskId, data);
      if (!task) {
        sendJSON(res, 404, { success: false, error: 'Task not found' });
        return;
      }
      sendJSON(res, 200, { success: true, data: task });
      return;
    }

    // DELETE /tasks/:id — 删除任务
    if (method === 'DELETE' && taskId) {
      const deleted = deleteTask(taskId);
      if (!deleted) {
        sendJSON(res, 404, { success: false, error: 'Task not found' });
        return;
      }
      sendJSON(res, 200, { success: true, data: { deleted: true } });
      return;
    }

    // 不支持的 method/path 组合
    sendJSON(res, 405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    // 捕获所有未处理异常，不暴露堆栈
    sendJSON(res, 500, { success: false, error: 'Internal server error' });
  }
}
