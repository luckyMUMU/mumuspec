export interface ImageRecord {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  uploadedAt: string;
}

export interface UploadResult {
  success: boolean;
  image?: ImageRecord;
  error?: string;
}

export interface ListResult {
  images: ImageRecord[];
  total: number;
}

/**
 * 默认允许的文件类型映射：mimeType -> 扩展名
 * 可通过配置文件或环境变量覆盖（见 config.ts）
 */
export const ALLOWED_TYPES: Map<string, string> = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["image/bmp", ".bmp"],
  ["image/svg+xml", ".svg"],
]);

/** 默认最大文件大小：50MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
