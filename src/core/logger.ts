/**
 * MumuSpec 结构化日志系统
 *
 * 4 级日志：trace < debug < info < warn < error
 * - 面向用户的最终输出保留 console.log/error
 * - Logger 仅用于内部诊断和环境观测
 *
 * 环境变量：
 * - MUMUSPEC_LOG_LEVEL: trace|debug|info|warn|error (默认 info)
 * - MUMUSPEC_LOG_JSON: true 输出 JSON 格式到 stderr
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  context?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/** 获取当前日志级别 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.MUMUSPEC_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'info';
}

/** 是否启用 JSON 输出 */
function isJsonMode(): boolean {
  return process.env.MUMUSPEC_LOG_JSON === 'true';
}

/** 格式化日志条目 */
function formatEntry(entry: LogEntry): string {
  if (isJsonMode()) {
    return JSON.stringify(entry);
  }
  const base = `[${entry.timestamp}] ${entry.level.toUpperCase()} [${entry.module}] ${entry.message}`;
  if (entry.context && Object.keys(entry.context).length > 0) {
    const ctxStr = Object.entries(entry.context)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ');
    return `${base} | ${ctxStr}`;
  }
  return base;
}

/** 核心日志输出函数 */
function log(level: LogLevel, module: string, message: string, context?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[getLogLevel()]) {
    return;
  }
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    context,
  };
  const formatted = formatEntry(entry);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    // trace/debug/info 走 stderr，避免污染 stdout
    console.error(formatted);
  }
}

/**  Logger 类 — 模块级日志工具  */
export class Logger {
  /** 最详细的诊断信息（函数级追踪） */
  static trace(module: string, message: string, context?: Record<string, unknown>): void {
    log('trace', module, message, context);
  }

  /** 开发调试信息（重构/排障时启用） */
  static debug(module: string, message: string, context?: Record<string, unknown>): void {
    log('debug', module, message, context);
  }

  /** 常规信息（关键操作节点） */
  static info(module: string, message: string, context?: Record<string, unknown>): void {
    log('info', module, message, context);
  }

  /** 非致命异常（可恢复的操作失败） */
  static warn(module: string, message: string, context?: Record<string, unknown>): void {
    log('warn', module, message, context);
  }

  /** 错误（影响功能的失败） */
  static error(module: string, message: string, context?: Record<string, unknown>): void {
    log('error', module, message, context);
  }
}

/** 面向用户的输出（保留 console.log 语义，不走 Logger） */
export const userOutput = {
  log: console.log,
  error: console.error,
};
