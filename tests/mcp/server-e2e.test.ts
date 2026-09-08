/**
 * MCP Server E2E — stdio transport → tool registry → CLI-domain functions.
 *
 * Covers the Phase 1 rewiring end-to-end: spawns the real server binary,
 * speaks JSON-RPC over stdio, and asserts handshake, tools/list (from the
 * MCP_TOOLS registry) and tools/call dispatch against a freshly initialized
 * temp project. Also verifies registry sanity and the path-traversal guard.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER = join(ROOT, 'dist', 'mcp-server.js');
const CLI = join(ROOT, 'dist', 'cli.js');

let projectDir: string;
let child: ChildProcess;
let savedRoot: string | undefined;

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Collect JSON-RPC responses from server stdout until the given id arrives */
function waitForId(id: number, timeoutMs = 20000): Promise<JsonRpcResponse> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout waiting for response id=${id}`)),
      timeoutMs,
    );
    const onData = (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        let msg: JsonRpcResponse;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === id) {
          clearTimeout(timer);
          child.stdout?.off('data', onData);
          resolvePromise(msg);
          return;
        }
      }
    };
    child.stdout?.on('data', onData);
  });
}

function send(msg: Record<string, unknown>): void {
  child.stdin?.write(JSON.stringify(msg) + '\n');
}

beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'mumuspec-mcp-e2e-'));
  execFileSync('node', [CLI, 'init', '.', '--force'], {
    cwd: projectDir,
    stdio: 'pipe',
    timeout: 60000,
  });
  expect(existsSync(join(projectDir, '.mumuspec', 'config.yaml'))).toBe(true);

  // Isolate direct callTool() tests in the temp project (restored in afterAll)
  savedRoot = process.env.MUMUSPEC_ROOT;
  process.env.MUMUSPEC_ROOT = projectDir;

  child = spawn('node', [SERVER], {
    cwd: projectDir,
    env: { ...process.env, MUMUSPEC_ROOT: projectDir },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', () => {}); // drain
});

afterAll(async () => {
  child?.kill();
  // Windows: the child's cwd is inside projectDir — wait for process exit
  // before rmdir, otherwise EBUSY. Fall back to leaving the temp dir.
  if (child && !child.killed) {
    await new Promise<void>((r) => {
      child.once('close', () => r());
      setTimeout(r, 2000);
    });
  }
  if (savedRoot === undefined) {
    delete process.env.MUMUSPEC_ROOT;
  } else {
    process.env.MUMUSPEC_ROOT = savedRoot;
  }
  try {
    rmSync(projectDir, { recursive: true, force: true });
  } catch {
    // best-effort on Windows file locks
  }
});

describe('MCP stdio transport E2E', () => {
  it('completes JSON-RPC handshake and reports server info', async () => {
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '0.0.0' },
      },
    });
    const res = await waitForId(1);
    expect(res.error).toBeUndefined();
    const info = res.result as { serverInfo: { name: string }; protocolVersion: string };
    expect(info.serverInfo.name).toBe('mumuspec');
    expect(info.protocolVersion).toBe('2024-11-05');
  });

  it('lists all registered tools from the MCP_TOOLS registry', async () => {
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const res = await waitForId(2);
    expect(res.error).toBeUndefined();
    const tools = (res.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.length).toBeGreaterThanOrEqual(25);
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length); // no duplicates
    for (const key of [
      'get_spec_context',
      'search_knowledge',
      'list_changes',
      'detect_drift',
      'list_contracts',
    ]) {
      expect(names).toContain(key);
    }
  });

  it('dispatches tools/call against the CLI domain (list_changes)', async () => {
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_changes', arguments: {} },
    });
    const res = await waitForId(3);
    expect(res.error).toBeUndefined();
    const content = (res.result as { content: Array<{ text: string }> }).content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]!.text).toBeDefined();
  });
});

describe('MCP tool registry invariants', () => {
  it('rejects unknown tool names via callTool', async () => {
    const { callTool } = await import('../../src/mcp/tools.js');
    const result = (await callTool('no_such_tool', {})) as { error?: string };
    expect(result.error).toBeDefined();
  });

  it('blocks path traversal attempts in path arguments (E-SECURITY-001)', async () => {
    const { callTool } = await import('../../src/mcp/tools.js');
    const result = (await callTool('get_spec_context', {
      path: '../../outside',
    })) as { error?: string };
    expect(result.error).toBeDefined();
  });
});
