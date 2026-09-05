import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 服务配置接口
 */
export interface ServerConfig {
  port: number;
  host: string;
  uploadDir: string;
  publicDir: string;
  maxFileSize: number;
  allowedTypes: Map<string, string>;
  /** 是否在启动时自动扫描上传目录中未登记的文件 */
  autoScan: boolean;
}

/** 默认允许的文件类型 */
const DEFAULT_ALLOWED_TYPES: Map<string, string> = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/bmp", ".bmp"],
  ["image/svg+xml", ".svg"],
]);

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface RawConfig {
  port?: number;
  host?: string;
  uploadDir?: string;
  publicDir?: string;
  maxFileSize?: number;
  allowedTypes?: Record<string, string>;
  autoScan?: boolean;
}

/**
 * 加载配置：环境变量 > JSON 配置文件 > 默认值
 *
 * 优先级（从高到低）：
 * 1. 环境变量 (PORT, HOST, UPLOAD_DIR, MAX_FILE_SIZE, AUTO_SCAN)
 * 2. JSON 配置文件 (由 CONFIG_FILE 环境变量指定路径)
 * 3. 默认值
 */
export function loadConfig(): ServerConfig {
  const cwd = process.cwd();

  // 默认值
  let raw: RawConfig = {
    port: 3100,
    host: "0.0.0.0",
    uploadDir: join(cwd, "uploads"),
    publicDir: join(cwd, "public"),
    maxFileSize: DEFAULT_MAX_FILE_SIZE,
    allowedTypes: undefined,
    autoScan: false,
  };

  // 层 2: JSON 配置文件
  const configFilePath =
    process.env.CONFIG_FILE ?? join(cwd, "config.json");
  if (existsSync(configFilePath)) {
    try {
      const fileContent = readFileSync(configFilePath, "utf-8");
      const parsed = JSON.parse(fileContent) as RawConfig;
      raw = { ...raw, ...parsed };
    } catch (err) {
      console.warn(
        `配置文件解析失败，使用默认值: ${configFilePath}`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // 层 1: 环境变量覆盖
  if (process.env.PORT) raw.port = parseInt(process.env.PORT, 10);
  if (process.env.HOST) raw.host = process.env.HOST;
  if (process.env.UPLOAD_DIR) raw.uploadDir = resolve(process.env.UPLOAD_DIR);
  if (process.env.PUBLIC_DIR) raw.publicDir = resolve(process.env.PUBLIC_DIR);
  if (process.env.MAX_FILE_SIZE) {
    const parsed = parseInt(process.env.MAX_FILE_SIZE, 10);
    if (!Number.isNaN(parsed) && parsed > 0) raw.maxFileSize = parsed;
  }
  if (process.env.AUTO_SCAN) raw.autoScan = process.env.AUTO_SCAN === "true";

  // 构建 allowedTypes Map
  const allowedTypes = raw.allowedTypes
    ? new Map(Object.entries(raw.allowedTypes))
    : DEFAULT_ALLOWED_TYPES;

  return {
    port: raw.port,
    host: raw.host,
    uploadDir: raw.uploadDir,
    publicDir: raw.publicDir,
    maxFileSize: raw.maxFileSize,
    allowedTypes,
    autoScan: raw.autoScan,
  };
}
