---
scope: src/bundle
layer: 2
last_updated: '2026-08-04'
---

# Technical Design: bundle

## SHALL constraints (migrated from spec.md)

- 打包必须生成 manifest JSON + 文件副本结构
- 必须提供打包验证功能（validateBundle）
- 安装必须支持从包目录解压到目标 workspace

## SHALL NOT constraints (migrated from spec.md)

- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止使用 tar/zip 外部二进制

## Enforcement (migrated from spec.md)

- BUNDLE-1: 检查无外部 import（仅 node: 前缀）
- BUNDLE-2: 检查 manifest 包含版本和文件列表

## 架构决策 (Architecture decisions)

- **零依赖设计**：仅使用 `node:fs`、`node:path`、`node:crypto` 内置模块，不引入 tar/zip 压缩库
- **Hash 校验**：使用 sha256 截断 16 位作为文件指纹，兼顾唯一性和可读性
- **文件副本而非压缩包**：ponytail: 使用目录结构而非二进制压缩包，便于检视和调试
- **版本来源**：从 `.mumuspec/config.yaml` 读取 version 字段，缺省回退到硬编码版本号

## 接口契约 (Interface contracts)

```typescript
interface BundleManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  files: { path: string; hash: string }[];
  createdAt: string;
}

function createBundle(projectRoot: string, options?: {...}): BundleResult;
function validateBundle(bundlePath: string): { valid: boolean; errors: string[] };
function installBundle(bundlePath: string, targetWorkspace: string): PublishedInstallResult;
function publishBundle(bundlePath: string, _registry?: string): PublishResult;
function listBundles(projectRoot: string): string[];
```

## 依赖关系 (Dependencies)

- **上游**：无（零依赖模块，仅使用 Node.js 内置 API）
- **下游**：被 `src/cli/commands/bundle.ts` 命令模块调用
- **数据**：依赖 `.mumuspec/skills/` 目录作为打包源，`.mumuspec/config.yaml` 读取版本号
