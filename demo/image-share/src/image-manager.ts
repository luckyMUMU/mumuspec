import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { join, extname, basename } from "node:path";
import type { ImageRecord } from "./types.js";
import { ALLOWED_TYPES as DEFAULT_ALLOWED_TYPES, MAX_FILE_SIZE as DEFAULT_MAX_FILE_SIZE } from "./types.js";

const METADATA_FILE = "metadata.json";

interface MetadataStore {
  images: ImageRecord[];
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;

/** 扩展名到 MIME 类型的反向映射（用于扫描导入时推断） */
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

export interface ImageManagerOptions {
  allowedTypes?: Map<string, string>;
  maxFileSize?: number;
}

export interface ScanResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function isValidUuid(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

export function isValidStoredFilename(filename: string): boolean {
  return SAFE_FILENAME_REGEX.test(filename);
}

export class ImageManager {
  private uploadDir: string;
  private metadataPath: string;
  private cache: ImageRecord[] | null = null;
  private allowedTypes: Map<string, string>;
  private maxFileSize: number;

  constructor(uploadDir: string, options?: ImageManagerOptions) {
    this.uploadDir = uploadDir;
    this.metadataPath = join(uploadDir, METADATA_FILE);
    this.allowedTypes = options?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
    this.maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.metadataPath, "utf-8");
      const data: MetadataStore = JSON.parse(raw);
      this.cache = data.images;
    } catch {
      this.cache = [];
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const data: MetadataStore = { images: this.cache ?? [] };
    await fs.writeFile(this.metadataPath, JSON.stringify(data, null, 2));
  }

  list(): ImageRecord[] {
    return [...(this.cache ?? [])].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  get(id: string): ImageRecord | undefined {
    return this.cache?.find((img) => img.id === id);
  }

  async save(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<ImageRecord> {
    const id = randomUUID();
    const ext = this.allowedTypes.get(mimeType) ?? extname(originalName) ?? "";
    const filename = `${id}${ext}`;
    const filePath = join(this.uploadDir, filename);

    await fs.writeFile(filePath, buffer);

    const dimensions = decodeImageDimensions(buffer, mimeType);

    const record: ImageRecord = {
      id,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      uploadedAt: new Date().toISOString(),
    };

    if (!this.cache) this.cache = [];
    this.cache.push(record);
    await this.persist();

    return record;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.cache?.findIndex((img) => img.id === id) ?? -1;
    if (idx < 0) return false;

    const record = this.cache![idx];
    const filePath = join(this.uploadDir, record.filename);

    try {
      await fs.unlink(filePath);
    } catch {
      // 文件可能已被手动删除
    }

    this.cache!.splice(idx, 1);
    await this.persist();
    return true;
  }

  getFilePath(filename: string): string {
    if (!isValidStoredFilename(filename)) {
      throw new Error("Invalid filename format");
    }
    return join(this.uploadDir, filename);
  }

  validateFile(size: number, mimeType: string): string | null {
    if (size > this.maxFileSize) {
      return `文件大小超过限制 (${Math.floor(this.maxFileSize / 1024 / 1024)}MB)`;
    }
    if (!this.allowedTypes.has(mimeType)) {
      return `不支持的文件类型: ${mimeType}`;
    }
    return null;
  }

  /**
   * 扫描上传目录，将未在 metadata.json 中登记的图片文件自动导入管理。
   *
   * 判定逻辑：
   * 1. 读取目录中所有文件
   * 2. 跳过 metadata.json 本身
   * 3. 跳过已在缓存中登记的文件（按 filename 匹配）
   * 4. 根据扩展名判断是否为支持的图片类型
   * 5. 读取文件内容，解析尺寸，生成 ImageRecord 并加入缓存
   *
   * @returns 导入/跳过/错误统计
   */
  async scanAndImport(): Promise<ScanResult> {
    if (!this.cache) {
      await this.initialize();
    }

    const result: ScanResult = { imported: 0, skipped: 0, errors: [] };
    const knownFilenames = new Set((this.cache ?? []).map((r) => r.filename));

    let entries: string[];
    try {
      entries = await fs.readdir(this.uploadDir);
    } catch {
      return result;
    }

    for (const entry of entries) {
      // 跳过元数据文件
      if (entry === METADATA_FILE) continue;

      // 跳过已登记文件
      if (knownFilenames.has(entry)) {
        result.skipped++;
        continue;
      }

      // 根据扩展名推断 MIME 类型
      const ext = extname(entry).toLowerCase();
      const mimeType = EXT_TO_MIME[ext];
      if (!mimeType) {
        // 非图片文件，跳过
        result.skipped++;
        continue;
      }

      // 检查是否在允许的类型白名单中
      if (!this.allowedTypes.has(mimeType)) {
        result.skipped++;
        continue;
      }

      try {
        const filePath = join(this.uploadDir, entry);
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) {
          result.skipped++;
          continue;
        }

        const buffer = await fs.readFile(filePath);
        const dimensions = decodeImageDimensions(buffer, mimeType);

        // 对于已存在的 UUID 命名文件，提取其 UUID 作为 id；
        // 否则生成新 UUID
        const baseName = basename(entry, ext);
        const id = UUID_V4_REGEX.test(baseName) ? baseName : randomUUID();

        const record: ImageRecord = {
          id,
          filename: entry,
          originalName: entry,
          mimeType,
          size: stat.size,
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
          uploadedAt: stat.mtime.toISOString(),
        };

        this.cache!.push(record);
        result.imported++;
      } catch (err) {
        result.errors.push(
          `${entry}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (result.imported > 0) {
      await this.persist();
    }

    return result;
  }
}

/**
 * ponytail: 轻量级图片尺寸解析，仅支持 JPEG/PNG/GIF/WEBP
 * 不引入 sharp 等外部依赖，保持零运行时依赖
 */
function decodeImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } | null {
  try {
    switch (mimeType) {
      case "image/png":
        return decodePng(buffer);
      case "image/jpeg":
        return decodeJpeg(buffer);
      case "image/gif":
        return decodeGif(buffer);
      case "image/webp":
        return decodeWebp(buffer);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function decodePng(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function decodeGif(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null;
  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function decodeJpeg(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2; //Skip SOI marker
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    const segLen = buffer.readUInt16BE(offset + 2);
    offset += 2 + segLen;
  }
  return null;
}

function decodeWebp(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WEBP") return null;

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8 ") {
    // Lossy WebP
    if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) return null;
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  } else if (format === "VP8L") {
    // Lossless WebP
    if (buffer[21] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  return null;
}
