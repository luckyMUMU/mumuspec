import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http, { type Server } from "node:http";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AddressInfo } from "node:net";
import { createApp } from "../src/server.js";

let server: Server;
let port: number;
let originalCwd: string;
let testUploadDir: string;
let uploadedImageId: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  testUploadDir = join(tmpdir(), `server-test-${Date.now()}`);

  await fs.mkdir(testUploadDir, { recursive: true });
  await fs.mkdir(join(testUploadDir, "uploads"), { recursive: true });
  await fs.mkdir(join(testUploadDir, "public"), { recursive: true });

  // Create minimal index.html for the server to serve
  await fs.writeFile(
    join(testUploadDir, "public", "index.html"),
    '<!DOCTYPE html><html><body>Test</body></html>'
  );

  process.chdir(testUploadDir);
  server = await createApp();

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      port = addr.port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  process.chdir(originalCwd);

  try {
    await fs.rm(testUploadDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

beforeEach(async () => {
  // Clean uploads directory before each test
  const uploadsDir = join(testUploadDir, "uploads");
  const files = await fs.readdir(uploadsDir).catch(() => []);
  for (const file of files) {
    if (file !== "metadata.json") {
      await fs.unlink(join(uploadsDir, file)).catch(() => {});
    }
  }
  const metadataPath = join(uploadsDir, "metadata.json");
  await fs.writeFile(metadataPath, '{"images":[]}', "utf-8").catch(() => {});
});

function apiRequest(
  method: string,
  path: string,
  body?: Buffer,
  contentType?: string
): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (body) {
      headers["Content-Length"] = body.length.toString();
    }
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          try {
            resolve({
              status: res.statusCode ?? 200,
              data: JSON.parse(text),
              headers: res.headers,
            });
          } catch {
            resolve({ status: res.statusCode ?? 200, data: text, headers: res.headers });
          }
        });
      }
    );

    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

describe("Server: GET /api/info", () => {
  it("returns service info with CORS headers", async () => {
    const result = await apiRequest("GET", "/api/info");

    expect(result.status).toBe(200);
    expect(result.data.service).toBe("LAN Image Share");
    expect(result.data.version).toBe("1.0.0");
    expect(result.headers["access-control-allow-origin"]).toBe("*");
  });

  it("returns valid response structure", async () => {
    const result = await apiRequest("GET", "/api/info");
    expect(result.data.lanIp).toBeDefined();
    expect(typeof result.data.port).toBe("number");
    expect(result.data.port).toBeGreaterThan(0);
    expect(result.data.endpoints).toBeDefined();
  });
});

describe("Server: GET /api/images", () => {
  it("returns valid list structure", async () => {
    const result = await apiRequest("GET", "/api/images");

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(Array.isArray(result.data.images)).toBe(true);
    expect(typeof result.data.total).toBe("number");
    expect(result.data.total).toBeGreaterThanOrEqual(0);
  });
});

describe("Server: POST /api/upload", () => {
  it("uploads a valid PNG image", async () => {
    const boundary = "----ServerTestBoundary";
    const pngData = createMinimalPng();

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(
        `Content-Disposition: form-data; name="image"; filename="test.png"\r\n`
      ),
      Buffer.from("Content-Type: image/png\r\n\r\n"),
      pngData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const result = await apiRequest(
      "POST",
      "/api/upload",
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.image.originalName).toBe("test.png");
    expect(result.data.image.mimeType).toBe("image/png");
    expect(result.data.image.width).toBe(16);
    expect(result.data.image.height).toBe(16);

    uploadedImageId = result.data.image.id;
  });

  it("rejects empty upload", async () => {
    const boundary = "----EmptyBoundary";
    const body = Buffer.from(`--${boundary}\r\n--${boundary}--\r\n`);

    const result = await apiRequest(
      "POST",
      "/api/upload",
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it("rejects non-image MIME type", async () => {
    const boundary = "----PdfBoundary";
    const pdfData = Buffer.from("%PDF-1.4 fake");

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(
        `Content-Disposition: form-data; name="image"; filename="test.pdf"\r\n`
      ),
      Buffer.from("Content-Type: application/pdf\r\n\r\n"),
      pdfData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const result = await apiRequest(
      "POST",
      "/api/upload",
      body,
      `multipart/form-data; boundary=${boundary}`
    );

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });
});

describe("Server: GET /api/images/:id", () => {
  it("returns image metadata for valid UUID", async () => {
    const id = await uploadTestPng();
    const result = await apiRequest("GET", `/api/images/${id}`);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);
    expect(result.data.image.id).toBe(id);
  });

  it("returns 404 for non-existent UUID", async () => {
    const result = await apiRequest(
      "GET",
      "/api/images/00000000-0000-4000-8000-000000000000"
    );

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
  });

  it("returns 400 for invalid UUID format", async () => {
    const result = await apiRequest("GET", "/api/images/not-a-uuid");

    expect(result.status).toBe(400);
    expect(result.data.success).toBe(false);
  });

  it("returns 404 or 400 for path traversal attempt", async () => {
    const result = await apiRequest("GET", "/api/images/../../etc/passwd");

    expect([400, 404]).toContain(result.status);
    expect(result.data.success).toBe(false);
  });
});

describe("Server: GET /images/:id", () => {
  it("serves image file for valid UUID", async () => {
    const id = await uploadTestPng();
    const result = await apiRequest("GET", `/images/${id}`);

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toBe("image/png");
  });

  it("returns 404 for non-existent UUID", async () => {
    const result = await apiRequest(
      "GET",
      "/images/00000000-0000-4000-8000-000000000000"
    );

    expect(result.status).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const result = await apiRequest("GET", "/images/../../../etc/passwd");

    expect([400, 404]).toContain(result.status);
  });
});

describe("Server: DELETE /api/images/:id", () => {
  it("deletes an existing image", async () => {
    const id = await uploadTestPng();
    const beforeList = await apiRequest("GET", "/api/images");
    const beforeTotal = beforeList.data.total;

    const result = await apiRequest("DELETE", `/api/images/${id}`);

    expect(result.status).toBe(200);
    expect(result.data.success).toBe(true);

    // Verify it's gone - total should have decreased by 1
    const afterList = await apiRequest("GET", "/api/images");
    expect(afterList.data.total).toBe(beforeTotal - 1);
  });

  it("returns 404 for non-existent image", async () => {
    const result = await apiRequest(
      "DELETE",
      "/api/images/00000000-0000-4000-8000-000000000000"
    );

    expect(result.status).toBe(404);
    expect(result.data.success).toBe(false);
  });

  it("returns 404 or 400 for path traversal DELETE", async () => {
    const result = await apiRequest("DELETE", "/api/images/../../etc/passwd");

    expect([400, 404]).toContain(result.status);
  });
});

describe("Server: CORS", () => {
  it("responds to OPTIONS preflight", async () => {
    const result = await new Promise<{ status: number; headers: any }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: "/api/upload",
            method: "OPTIONS",
          },
          (res) => {
            resolve({
              status: res.statusCode ?? 200,
              headers: res.headers,
            });
          }
        );
        req.on("error", reject);
        req.end();
      }
    );

    expect(result.status).toBe(204);
    expect(result.headers["access-control-allow-origin"]).toBe("*");
  });
});

describe("Server: GET /", () => {
  it("serves index.html", async () => {
    const result = await apiRequest("GET", "/");

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("text/html");
  });
});

// Helper to upload a valid PNG through the API
async function uploadTestPng(): Promise<string> {
  const boundary = "----HelperBoundary";
  const pngData = createMinimalPng();

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(
      `Content-Disposition: form-data; name="image"; filename="helper.png"\r\n`
    ),
    Buffer.from("Content-Type: image/png\r\n\r\n"),
    pngData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const result = await apiRequest(
    "POST",
    "/api/upload",
    body,
    `multipart/form-data; boundary=${boundary}`
  );

  if (!result.data.success) {
    throw new Error("Test helper upload failed");
  }

  return result.data.image.id;
}

function createMinimalPng(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, 0x36, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}
