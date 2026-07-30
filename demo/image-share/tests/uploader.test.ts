import { describe, it, expect, afterAll, beforeAll } from "vitest";
import http, { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { parseMultipart, type ParsedForm } from "../src/uploader.js";

let server: Server;
let port: number;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      parseMultipart(req)
        .then((result: ParsedForm) => {
          // Convert Buffer to base64 for JSON serialization
          const serializable = {
            files: result.files.map((f) => ({
              filename: f.filename,
              mimeType: f.mimeType,
              data: f.data.toString("base64"),
              encoding: "base64",
            })),
            fields: result.fields,
          };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(serializable));
        })
        .catch((err: Error) => {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        });
    });

    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      port = addr.port;
      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

function buildMultipartBody(
  boundary: string,
  parts: Array<{
    name: string;
    value?: string;
    filename?: string;
    contentType?: string;
    data?: Buffer;
  }>
): Buffer {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));

    if (part.filename !== undefined) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
        )
      );
      if (part.contentType) {
        chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
      }
      chunks.push(Buffer.from("\r\n"));
      chunks.push(part.data ?? Buffer.from(part.value ?? ""));
    } else {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"\r\n\r\n`
        )
      );
      chunks.push(Buffer.from(part.value ?? ""));
    }
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function sendMultipart(body: Buffer, boundary: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode ?? 200, data: JSON.parse(text) });
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

describe("parseMultipart via HTTP", () => {
  it("parses a simple file upload", async () => {
    const boundary = "testboundary123";
    const fileData = Buffer.from("fake image data");
    const body = buildMultipartBody(boundary, [
      {
        name: "image",
        filename: "test.jpg",
        contentType: "image/jpeg",
        data: fileData,
      },
    ]);

    const result = await sendMultipart(body, boundary);

    expect(result.status).toBe(200);
    expect(result.data.files).toHaveLength(1);
    expect(result.data.files[0].filename).toBe("test.jpg");
    expect(result.data.files[0].mimeType).toBe("image/jpeg");
    expect(result.data.files[0].encoding).toBe("base64");
    expect(Buffer.from(result.data.files[0].data, "base64").toString()).toBe("fake image data");
  });

  it("parses text fields alongside files", async () => {
    const boundary = "testboundary456";
    const body = buildMultipartBody(boundary, [
      { name: "description", value: "A test image" },
      {
        name: "image",
        filename: "photo.png",
        contentType: "image/png",
        data: Buffer.from("pngdata"),
      },
    ]);

    const result = await sendMultipart(body, boundary);

    expect(result.status).toBe(200);
    expect(result.data.fields.description).toBe("A test image");
    expect(result.data.files).toHaveLength(1);
    expect(result.data.files[0].filename).toBe("photo.png");
  });

  it("handles empty file data", async () => {
    const boundary = "testboundary789";
    const body = buildMultipartBody(boundary, [
      {
        name: "image",
        filename: "empty.jpg",
        contentType: "image/jpeg",
        data: Buffer.alloc(0),
      },
    ]);

    const result = await sendMultipart(body, boundary);

    expect(result.status).toBe(200);
    expect(result.data.files).toHaveLength(1);
    expect(result.data.files[0].data).toBe("");
  });

  it("handles binary file data with special characters", async () => {
    const boundary = "binboundary";
    const binaryData = Buffer.alloc(256);
    for (let i = 0; i < 256; i++) binaryData[i] = i;

    const body = buildMultipartBody(boundary, [
      {
        name: "image",
        filename: "binary.bin",
        contentType: "image/jpeg",
        data: binaryData,
      },
    ]);

    const result = await sendMultipart(body, boundary);

    expect(result.status).toBe(200);
    expect(result.data.files).toHaveLength(1);
    const decoded = Buffer.from(result.data.files[0].data, "base64");
    expect(decoded.length).toBe(256);
    for (let i = 0; i < 256; i++) {
      expect(decoded[i]).toBe(i);
    }
  });
});
