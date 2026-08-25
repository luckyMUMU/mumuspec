/**
 * Task API 测试
 * 验证 models 层验证逻辑和 storage 层 CRUD 操作
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateTask, createTaskObject, type TaskStatus } from '../src/models/task.js';
import { createTask, getTask, updateTask, deleteTask, listTasks } from '../src/storage/store.js';

describe('validateTask', () => {
  it('should accept valid task data', () => {
    const result = validateTask({ title: 'Buy groceries', status: 'todo' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty title', () => {
    const result = validateTask({ title: '', status: 'todo' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('title is required and must be a non-empty string');
  });

  it('should reject title exceeding 200 characters', () => {
    const result = validateTask({ title: 'a'.repeat(201), status: 'todo' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('200 characters');
  });

  it('should reject invalid status', () => {
    const result = validateTask({ title: 'Test', status: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('status must be one of');
  });

  it('should accept missing status (defaults to todo)', () => {
    const result = validateTask({ title: 'Test' });
    expect(result.valid).toBe(true);
  });

  it('should reject non-object input', () => {
    const result = validateTask(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Input must be an object');
  });
});

describe('createTaskObject', () => {
  it('should create a task with generated id and timestamps', () => {
    const task = createTaskObject({ title: 'Test task' });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('todo');
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });

  it('should accept custom status', () => {
    const task = createTaskObject({ title: 'Test', status: 'in-progress' });
    expect(task.status).toBe('in-progress');
  });
});

describe('Storage CRUD', () => {
  beforeEach(() => {
    // 清理存储（通过删除所有任务）
    const tasks = listTasks();
    for (const t of tasks) {
      deleteTask(t.id);
    }
  });

  it('should create and retrieve a task', () => {
    const task = createTask({ title: 'Learn MumuSpec' });
    const retrieved = getTask(task.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe('Learn MumuSpec');
  });

  it('should update a task', () => {
    const task = createTask({ title: 'Original' });
    const updated = updateTask(task.id, { title: 'Updated', status: 'done' });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated');
    expect(updated!.status).toBe('done');
    expect(updated!.updatedAt).not.toBe(task.updatedAt);
  });

  it('should delete a task', () => {
    const task = createTask({ title: 'To delete' });
    expect(deleteTask(task.id)).toBe(true);
    expect(getTask(task.id)).toBeUndefined();
  });

  it('should list all tasks', () => {
    createTask({ title: 'Task 1' });
    createTask({ title: 'Task 2' });
    const tasks = listTasks();
    expect(tasks).toHaveLength(2);
  });

  it('should return undefined for non-existent task', () => {
    expect(getTask('nonexistent-id')).toBeUndefined();
  });

  it('should return false when deleting non-existent task', () => {
    expect(deleteTask('nonexistent-id')).toBe(false);
  });

  it('should return undefined when updating non-existent task', () => {
    expect(updateTask('nonexistent-id', { title: 'Updated' })).toBeUndefined();
  });
});
