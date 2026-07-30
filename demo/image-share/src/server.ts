import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import { join, normalize, basename } from "node:path";
import { networkInterfaces } from "node:os";
import { ImageManager } from "./image-manager.js";
import { parseMultipart } from "./uploader.js";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METADATA_FILENAME = "metadata.json";

const PORT = parseInt(process.env.PORT ?? "3100", 10);
const HOST = "0.0.0.0";
const UPLOAD_DIR = join(process.cwd(), "uploads");
const PUBLIC_DIR = join(process.cwd(), "public");

let imageManager: ImageManager;

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = url.pathname;
  const method = req.method ?? "GET";

  // CORS — 允许局域网跨域
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (method === "GET" && pathname === "/") {
      await serveStatic(res, join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8");
    } else if (method === "GET" && pathname.startsWith("/images/")) {
      await serveImage(res, pathname.slice(8));
    } else if (method === "POST" && pathname === "/api/upload") {
      await handleUpload(req, res);
    } else if (method === "GET" && pathname === "/api/images") {
      await handleList(res);
    } else if (method === "GET" && pathname.startsWith("/api/images/")) {
      await handleGetImage(res, pathname.slice(12));
    } else if (method === "DELETE" && pathname.startsWith("/api/images/")) {
      await handleDelete(res, pathname.slice(12));
    } else if (method === "GET" && pathname === "/api/info") {
      handleInfo(res);
    } else {
      jsonError(res, 404, "Not Found");
    }
  } catch (err) {
    console.error("Request error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    const safeMessage = message.length > 200 ? "Internal Server Error" : message;
    jsonError(res, 500, safeMessage);
  }
}

function isValidUuid(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

async function serveImage(res: ServerResponse, rawId: string): Promise<void> {
  const id = decodeURIComponent(rawId);

  if (!isValidUuid(id)) {
    jsonError(res, 400, "ID 格式无效");
    return;
  }

  const record = imageManager.get(id);
  if (!record) {
    jsonError(res, 404, "图片不存在");
    return;
  }

  const filePath = imageManager.getFilePath(record.filename);

  try {
    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);

    res.writeHead(200, {
      "Content-Type": record.mimeType,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(record.originalName)}"`,
    });
    res.end(buffer);
  } catch {
    jsonError(res, 404, "图片文件丢失");
  }
}

async function handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { files } = await parseMultipart(req);

  if (files.length === 0) {
    jsonError(res, 400, "请选择要上传的图片");
    return;
  }

  const file = files[0];
  const validationError = imageManager.validateFile(file.data.length, file.mimeType);
  if (validationError) {
    jsonError(res, 400, validationError);
    return;
  }

  const record = await imageManager.save(file.data, file.filename, file.mimeType);

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: true, image: record }));
}

async function handleList(res: ServerResponse): Promise<void> {
  const images = imageManager.list();
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: true, images, total: images.length }));
}

async function handleGetImage(res: ServerResponse, rawId: string): Promise<void> {
  const id = decodeURIComponent(rawId);

  if (!isValidUuid(id)) {
    jsonError(res, 400, "ID 格式无效");
    return;
  }

  const record = imageManager.get(id);
  if (!record) {
    jsonError(res, 404, "图片不存在");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: true, image: record }));
}

async function handleDelete(res: ServerResponse, rawId: string): Promise<void> {
  const id = decodeURIComponent(rawId);

  if (!isValidUuid(id)) {
    jsonError(res, 400, "ID 格式无效");
    return;
  }

  const ok = await imageManager.delete(id);
  if (!ok) {
    jsonError(res, 404, "图片不存在");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: true }));
}

function handleInfo(res: ServerResponse): void {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      service: "LAN Image Share",
      version: "1.0.0",
      lanIp: getLocalIp(),
      port: PORT,
      endpoints: {
        "GET /": "Web UI",
        "GET /api/images": "List all images",
        "POST /api/upload": "Upload image (multipart/form-data)",
        "GET /api/images/:id": "Get image metadata",
        "DELETE /api/images/:id": "Delete image",
        "GET /images/:id": "Serve image file",
      },
    })
  );
}

async function serveStatic(
  res: ServerResponse,
  filePath: string,
  contentType: string
): Promise<void> {
  const safePath = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  try {
    const content = await fs.readFile(safePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    jsonError(res, 404, "File not found");
  }
}

function jsonError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ success: false, error: message }));
}

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (!net) continue;
    for (const iface of net) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

export async function createApp() {
  imageManager = new ImageManager(UPLOAD_DIR);
  await imageManager.initialize();

  return createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) jsonError(res, 500, "Server Error");
    });
  });
}

async function main(): Promise<void> {
  const server = await createApp();
  server.listen(PORT, HOST, () => {
    const ip = getLocalIp();
    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║       🖼️  局域网高清图片分享服务  🖼️         ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║  本机访问:  http://localhost:${PORT}            ║`);
    console.log(`║  局域网:    http://${ip}:${PORT}          ║`);
    console.log("╠══════════════════════════════════════════════╣");
    console.log("║  上传目录:  uploads/                         ║");
    console.log("║  支持格式:  JPG / PNG / GIF / WebP / BMP / SVG ║");
    console.log("║  最大文件:  50MB                              ║");
    console.log("╚══════════════════════════════════════════════╝");
    console.log("");
  });
}

main().catch(console.error);
