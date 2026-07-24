/**
 * Task 数据模型层
 * 定义 Task 接口、TaskStatus 类型和验证函数
 */

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];
const MAX_TITLE_LENGTH = 200;

/** 验证 Task 输入数据 */
export function validateTask(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Input must be an object'] };
  }

  const obj = data as Record<string, unknown>;

  // title 验证
  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  } else if (obj.title.length > MAX_TITLE_LENGTH) {
    errors.push(`title must not exceed ${MAX_TITLE_LENGTH} characters`);
  }

  // status 验证（可选，默认 todo）
  if (obj.status !== undefined && !VALID_STATUSES.includes(obj.status as TaskStatus)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/** 创建 Task 对象（生成 id 和时间戳） */
export function createTaskObject(data: { title: string; status?: TaskStatus }): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: data.title,
    status: data.status || 'todo',
    createdAt: now,
    updatedAt: now,
  };
}
