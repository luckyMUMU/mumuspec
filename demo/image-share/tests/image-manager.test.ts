import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ImageManager,
  isValidUuid,
  isValidStoredFilename,
} from "../src/image-manager.js";

let testDir: string;
let manager: ImageManager;

beforeEach(async () => {
  testDir = join(tmpdir(), `image-share-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(testDir, { recursive: true });
  manager = new ImageManager(testDir);
  await manager.initialize();
});

afterEach(async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

describe("ImageManager Initialization", () => {
  it("creates upload directory if not exists", async () => {
    const newDir = join(testDir, "subdir");
    const m = new ImageManager(newDir);
    await m.initialize();
    const stat = await fs.stat(newDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("initializes with empty cache when no metadata exists", () => {
    expect(manager.list()).toEqual([]);
  });
});

describe("ImageManager Save Operations", () => {
  it("saves an image record and returns metadata", async () => {
    const pngBuffer = createMinimalPng();
    const record = await manager.save(pngBuffer, "test.png", "image/png");

    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(record.originalName).toBe("test.png");
    expect(record.mimeType).toBe("image/png");
    expect(record.size).toBe(pngBuffer.length);
    expect(record.width).toBe(16);
    expect(record.height).toBe(16);
    expect(record.uploadedAt).toBeDefined();
  });

  it("persists metadata to disk", async () => {
    const pngBuffer = createMinimalPng();
    await manager.save(pngBuffer, "test.png", "image/png");

    const metadataPath = join(testDir, "metadata.json");
    const raw = await fs.readFile(metadataPath, "utf-8");
    const data = JSON.parse(raw);
    expect(data.images).toHaveLength(1);
    expect(data.images[0].originalName).toBe("test.png");
  });

  it("saves file to disk with UUID name", async () => {
    const pngBuffer = createMinimalPng();
    const record = await manager.save(pngBuffer, "test.png", "image/png");

    const filePath = join(testDir, record.filename);
    const exists = await fs
      .stat(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("appends multiple images correctly", async () => {
    await manager.save(createMinimalPng(), "a.png", "image/png");
    await manager.save(createMinimalPng(), "b.png", "image/png");
    await manager.save(createMinimalGif(), "c.gif", "image/gif");

    expect(manager.list()).toHaveLength(3);
  });
});

describe("ImageManager List Operations", () => {
  it("returns images sorted by uploadedAt descending", async () => {
    await manager.save(createMinimalPng(), "first.png", "image/png");

    await new Promise((r) => setTimeout(r, 10));

    await manager.save(createMinimalPng(), "second.png", "image/png");

    const list = manager.list();
    expect(list[0].originalName).toBe("second.png");
    expect(list[1].originalName).toBe("first.png");
  });
});

describe("ImageManager Get Operations", () => {
  it("retrieves an existing image by ID", async () => {
    const record = await manager.save(createMinimalPng(), "test.png", "image/png");
    const found = manager.get(record.id);

    expect(found).toBeDefined();
    expect(found?.originalName).toBe("test.png");
  });

  it("returns undefined for non-existent ID", () => {
    expect(manager.get("non-existent-id")).toBeUndefined();
  });
});

describe("ImageManager Delete Operations", () => {
  it("deletes an existing image", async () => {
    const record = await manager.save(createMinimalPng(), "test.png", "image/png");
    const ok = await manager.delete(record.id);

    expect(ok).toBe(true);
    expect(manager.list()).toHaveLength(0);
  });

  it("returns false when deleting non-existent image", async () => {
    const ok = await manager.delete("00000000-0000-4000-8000-000000000000");
    expect(ok).toBe(false);
  });

  it("removes file from disk when deleting", async () => {
    const record = await manager.save(createMinimalPng(), "test.png", "image/png");
    const filePath = join(testDir, record.filename);

    await manager.delete(record.id);

    const exists = await fs
      .stat(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});

describe("ImageManager Validation", () => {
  it("rejects file exceeding size limit", () => {
    const tooLarge = 51 * 1024 * 1024; // 51MB
    const error = manager.validateFile(tooLarge, "image/png");
    expect(error).not.toBeNull();
    expect(error).toContain("超过限制");
  });

  it("rejects non-image MIME type", () => {
    const error = manager.validateFile(100, "application/pdf");
    expect(error).not.toBeNull();
    expect(error).toContain("不支持");
  });

  it("accepts valid image file", () => {
    const error = manager.validateFile(1024, "image/png");
    expect(error).toBeNull();
  });
});

describe("ImageManager getFilePath", () => {
  it("returns correct path for valid filename", () => {
    const path = manager.getFilePath("00000000-0000-4000-8000-000000000000.png");
    expect(path).toContain("00000000-0000-4000-8000-000000000000.png");
  });

  it("throws for invalid filename", () => {
    expect(() => manager.getFilePath("../../etc/passwd")).toThrow();
    expect(() => manager.getFilePath("metadata.json")).toThrow();
  });
});

describe("Utility: isValidUuid", () => {
  it("accepts valid v4 UUID", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("../../etc/passwd")).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });
});

describe("Utility: isValidStoredFilename", () => {
  it("accepts valid stored filename", () => {
    expect(isValidStoredFilename("550e8400-e29b-41d4-a716-446655440000.png")).toBe(true);
    expect(isValidStoredFilename("550e8400-e29b-41d4-a716-446655440000.jpg")).toBe(true);
  });

  it("rejects invalid filename", () => {
    expect(isValidStoredFilename("metadata.json")).toBe(false);
    expect(isValidStoredFilename("../../../etc/passwd")).toBe(false);
    expect(isValidStoredFilename("randomname.png")).toBe(false);
  });
});

// ponytail: minimal PNG for testing — 16x16, no external fixtures required
function createMinimalPng(): Buffer {
  // PNG signature + IHDR for 1x1 + IEND is sufficient to test parser
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x10, // width: 16
    0x00, 0x00, 0x00, 0x10, // height: 16
    0x08, 0x02, // bit depth + color type
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x91, 0x68, 0x36, // CRC (not validated)
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);
}

// ponytail: minimal GIF for testing
function createMinimalGif(): Buffer {
  return Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x01, 0x00, // width: 1
    0x01, 0x00, // height: 1
    0x80, 0x00, 0x00, // packed byte
    0x00, 0x00, 0x00, // bg color
    0xff, 0xff, 0xff, // pixel color
    0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, // graphic control ext
    0x2c, 0x00, 0x00, 0x00, 0x00, // image descriptor
    0x01, 0x00, 0x01, 0x00, 0x00, // size + packed
    0x02, 0x02, 0x44, 0x01, 0x00, // image data
    0x3b, // trailer
  ]);
}
