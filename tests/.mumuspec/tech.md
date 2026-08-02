---
scope: tests
layer: 1
---
# Technical Design: tests

## SHALL
- 测试文件使用 <module>.test.ts 命名格式（如 parser.test.ts、cli.test.ts）
- 测试框架统一使用 Vitest（describe/it/expect/beforeEach/afterEach）
- 端到端测试使用 mkdtempSync 创建隔离的临时项目目录，afterEach 清理
- CLI 测试从 package.json 读取版本号，避免版本变更破坏测试
- 测试导入源码使用 .js 扩展名（如 `from '../src/spec/parser.js'`），与 ESM 编译输出对齐

## SHALL NOT
- 禁止测试依赖外部网络或真实 Git 远程仓库
- 禁止测试修改项目根目录的真实文件（必须使用临时目录隔离）
- 禁止硬编码版本号（从 package.json 动态读取）

## 架构决策
- **Vitest 框架**：与项目 vitest.config.ts 配置对齐，支持 ESM 与 TypeScript
- **临时目录隔离**：端到端测试使用 os.tmpdir() + mkdtempSync，保证测试独立性与可并行
- **版本号动态读取**：CLI 测试从 package.json 读取版本，避免版本变更时手动更新测试
- **.js 导入扩展名**：源码导入使用 .js 扩展名，与 tsc 编译输出一致

## 依赖关系
- parser.test.ts 导入 src/spec/parser.ts 与 src/core/errors.ts
- cli.test.ts 导入 dist/cli.js（构建产物）并使用 child_process execSync
- constraint-strength.test.ts 导入 src/core/config.ts 与 src/core/constraints-loader.ts
- state-machine.test.ts 导入 src/change/state-machine.ts
- 环境测试（env-*.test.ts）导入 src/core/env-detector.ts
- verify-all.ts 提供批量验证入口
