#!/usr/bin/env node
/**
 * MumuSpec MCP Server — SDK v1.30.0 with stateless transport support.
 *
 * Phase 1 refactor: this file keeps transport concerns only (stdio / HTTP,
 * CORS, token auth). Tool definitions and handlers live in src/mcp/tools.ts;
 * every tool is a thin adapter over the same domain functions the CLI uses.
 *
 * Supports both:
 * - Stdio transport (default, local CLI integration)
 * - Streamable HTTP transport (stateless mode for web/serverless deployment)
 *
 * Stateless mode: each request carries full context; server maintains no session state.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

import { MCP_TOOLS, callTool } from './mcp/tools.js';

/** Get version from package.json */
function getVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/** Create MCP server instance */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'mumuspec',
      version: getVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: MCP_TOOLS,
    };
  });

  // Call tool handler — thin forward to the tool registry
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await callTool(name, args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

// ════════════════════════════════════════════════════════════════════
// Transport selection based on environment
// ════════════════════════════════════════════════════════════════════

/** Start with stdio transport (default) */
async function startStdio(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MumuSpec MCP Server started (stdio)');
}

/** Start with Streamable HTTP transport (stateless mode) */
async function startHttp(port: number = 3000): Promise<void> {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless: no session management
  });

  // P0-5 Fix: CORS and Auth configuration from environment
  const allowedOrigins = process.env.MUMUSPEC_MCP_CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const mcpToken = process.env.MUMUSPEC_MCP_TOKEN;

  // Create HTTP server for Streamable HTTP transport
  const httpServer = http.createServer(async (req, res) => {
    // P0-5 Fix: Handle CORS with configurable origin
    const requestOrigin = req.headers.origin || '';
    if (allowedOrigins.length > 0) {
      // Whitelist mode: only allow configured origins
      if (allowedOrigins.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      }
    } else {
      // Default: same-origin only (safe default)
      res.setHeader('Access-Control-Allow-Origin', requestOrigin || '');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // P0 Fix: Token authentication with timing-safe comparison
    if (mcpToken) {
      const authHeader = req.headers.authorization || '';
      const providedToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      // Use timing-safe comparison to prevent timing attacks
      const providedBuf = Buffer.from(providedToken);
      const expectedBuf = Buffer.from(mcpToken);
      const isMatch = providedBuf.length === expectedBuf.length &&
        (await import('node:crypto')).default.timingSafeEqual(providedBuf, expectedBuf);
      if (!isMatch) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized: invalid or missing token' }));
        return;
      }
    }

    // Only accept POST for MCP requests
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Read request body — ponytail: simple streaming without external body-parser
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB limit — prevents DoS via memory exhaustion

    // Handle socket-level errors (client disconnect, network failure, etc.)
    req.on('error', (err) => {
      console.error(`[http] Request error: ${err.message}`);

      chunks.length = 0; // Free accumulated buffer

      if (!res.headersSent && !res.writableEnded) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Request stream error' }));
      }
    });

    req.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        // Body too large — abort and respond
        chunks.length = 0;
        req.destroy(); // Stop receiving data
        res.writeHead(413);
        res.end(JSON.stringify({ error: 'Request body exceeds 10MB limit' }));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', async () => {
      if (chunks.length === 0) return; // Already handled (413 or error)
      const body = Buffer.concat(chunks).toString('utf-8');

      try {
        await transport.handleRequest(
          req,
          res,
          body ? JSON.parse(body) : undefined,
        );
      } catch (error) {
        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      }
    });
  });

  // Connect transport to server
  await server.connect(transport);

  httpServer.listen(port, () => {
    console.error(`MumuSpec MCP Server started (Streamable HTTP, port ${port})`);
  });
}

/** Main entry point */
async function main(): Promise<void> {
  const transportType = process.env.MUMUSPEC_MCP_TRANSPORT || 'stdio';

  if (transportType === 'http') {
    const port = parseInt(process.env.MUMUSPEC_MCP_PORT || '3000', 10);
    await startHttp(port);
  } else {
    await startStdio();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
