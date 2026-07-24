/**
 * 内存存储层
 * 使用 Map 存储 Task 数据，提供 CRUD 操作
 */

import { randomUUID } from 'node:crypto';
import type { Task, TaskStatus } from '../models/task.js';

const store = new Map<string, Task>();

/** 创建 Task */
export function createTask(data: { title: string; status?: TaskStatus }): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    title: data.title,
    status: data.status || 'todo',
    createdAt: now,
    updatedAt: now,
  };
  store.set(task.id, task);
  return task;
}

/** 获取单个 Task */
export function getTask(id: string): Task | undefined {
  return store.get(id);
}

/** 更新 Task */
export function updateTask(id: string, data: Partial<Pick<Task, 'title' | 'status'>>): Task | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;

  const updated: Task = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

/** 删除 Task */
export function deleteTask(id: string): boolean {
  return store.delete(id);
}

/** 列出所有 Task */
export function listTasks(): Task[] {
  return Array.from(store.values());
}
