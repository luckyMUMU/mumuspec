---
scope: src/bundle
layer: 2
---

# Product Requirements: bundle

## 模块职责 (What this module does)

技能打包与发布模块，负责将 `.mumuspec/skills/` 目录下的技能文件打包为可分发的 bundle。

- `createBundle()` — 扫描技能目录，生成 manifest JSON + 文件副本结构
- `validateBundle()` — 校验 bundle manifest 完整性及文件 hash 一致性
- `installBundle()` — 将 bundle 解压安装到目标 workspace
- `publishBundle()` — 发布 bundle（当前为占位，预留 registry 集成）
- `listBundles()` — 列出项目中已有的 bundle

## 存在理由 (Why it exists)

技能需要在不同 MumuSpec 项目之间共享和分发。bundle 提供了一种零依赖的打包格式，
使技能可以脱离 npm registry 独立传输和安装。manifest 中的 hash 机制保证文件完整性。

## 用户场景 (User scenarios)

1. **技能分享**：开发者 A 将自己编写的技能打包为 bundle，传给开发者 B 安装使用
2. **CI 集成**：在 CI 中验证 bundle 完整性后再部署到生产环境
3. **技能版本管理**：通过 manifest 中的 version 字段追踪技能版本

## 验收标准 (Acceptance criteria)

- 打包后生成 manifest JSON 文件，包含 name、version、files 列表
- 每个 file 条目包含 path 和 sha256 hash（截断为 16 位）
- validateBundle 能检测到文件缺失和 hash 不匹配
- installBundle 将文件正确解压到目标 workspace 的 `.mumuspec/skills/` 目录
- 支持通过 includeEvals / includeAuthoring 选项控制打包范围
