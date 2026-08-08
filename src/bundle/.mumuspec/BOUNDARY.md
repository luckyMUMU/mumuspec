---
scope: src/bundle
layer: 2
---

# Boundary Document: bundle

## 对外接口

### 导出函数

| 函数 | 签名 | 用途 |
|------|------|------|
| `createBundle` | `(root: string, options?: CreateBundleOptions) => Promise<BundleResult>` | 扫描技能目录并打包为 manifest + 文件副本 |
| `validateBundle` | `(bundlePath: string) => Promise<ValidationResult>` | 校验 bundle manifest 完整性及 hash |
| `installBundle` | `(bundlePath: string, targetRoot: string) => Promise<InstallResult>` | 解压 bundle 到目标 workspace |
| `publishBundle` | `(bundlePath: string, registry?: string) => Promise<void>` | 发布 bundle（预留） |
| `listBundles` | `(root: string) => BundleInfo[]` | 列出项目中的 bundle |

### 导出类型

| 类型 | 用途 |
|------|------|
| `BundleResult` | 打包结果 |
| `ValidationResult` | 验证结果 |
| `InstallResult` | 安装结果 |
| `BundleInfo` | bundle 元数据 |
| `CreateBundleOptions` | 打包选项 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统操作 |
| `node:path` | 路径处理 |
| `node:crypto` | SHA256 hash |

### 外部依赖

无（零运行时依赖）

## 数据契约

### 输入

- `.mumuspec/skills/` 目录中的技能文件
- Bundle manifest JSON 格式

### 输出

- Bundle 目录结构：`manifest.json` + 文件副本
- manifest schema：`{ name, version, files: [{ path, hash }] }`

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-03 | 删除冗余 spec.md 和 design.md | 无功能影响（Loader 已支持新格式） |
