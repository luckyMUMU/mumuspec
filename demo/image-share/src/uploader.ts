import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";

export interface ParsedFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface ParsedForm {
  files: ParsedFile[];
  fields: Record<string, string>;
}

/**
 * ponytail: 手写 multipart/form-data 解析器
 * 不引入 multer/busboy 等第三方库，标准库即可完成
 */
export async function parseMultipart(
  req: IncomingMessage
): Promise<ParsedForm> {
  const contentType = req.headers["content-type"];
  if (!contentType || !contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/);
  if (!boundaryMatch) throw new Error("Missing boundary in Content-Type");

  const boundary = boundaryMatch[1].trim().replace(/^["']|["']$/g, "");
  const buffer = await readRequestBody(req);
  const files: ParsedFile[] = [];
  const fields: Record<string, string> = {};

  const parts = splitByBoundary(buffer, `--${boundary}`);

  for (const part of parts) {
    if (part.length === 0) continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;

    const headerStr = part.subarray(0, headerEnd).toString("utf-8");
    const body = part.subarray(headerEnd + 4, part.length - 2);

    const dispMatch = headerStr.match(
      /Content-Disposition:(?:(?!name=).)*name="([^"]+)"(?:;\s*filename="([^"]*)")?/is
    );
    if (!dispMatch) continue;

    const fieldName = dispMatch[1];
    const filename = dispMatch[2];

    if (filename !== undefined) {
      const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
      files.push({
        filename,
        mimeType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
        data: Buffer.from(body),
      });
    } else {
      fields[fieldName] = body.toString("utf-8");
    }
  }

  return { files, fields };
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function splitByBoundary(buffer: Buffer, boundary: string): Buffer[] {
  const result: Buffer[] = [];
  const boundaryBytes = Buffer.from(boundary);
  let start = 0;
  let idx = findSubarray(buffer, boundaryBytes, start);

  while (idx !== -1) {
    if (idx > start) {
      result.push(buffer.subarray(start, idx));
    }
    start = idx + boundaryBytes.length;
    idx = findSubarray(buffer, boundaryBytes, start);
  }

  if (start < buffer.length) {
    result.push(buffer.subarray(start));
  }

  return result;
}

function findSubarray(buffer: Buffer, pattern: Buffer, from: number): number {
  for (let i = from; i <= buffer.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
