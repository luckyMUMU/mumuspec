import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
    // Windows 兼容：threads pool 在加载完整 CLI 命令树（src/cli/index.ts → buildProgram，
    // cli-smoke.test.ts）时 worker 崩溃且无输出；forks pool 使用独立进程，稳定。
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/cli.ts', 'src/mcp-server.ts'],
      thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 },
    },
  },
});
