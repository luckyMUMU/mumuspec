---
layer: 1
scope: "src/bundle"
last_updated: "2026-07-30"
---

## Requirement: 技能打包与发布

### SHALL
- 打包必须生成 manifest JSON + 文件副本结构
- 必须提供打包验证功能（validateBundle）
- 安装必须支持从包目录解压到目标 workspace

### SHALL NOT
- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止使用 tar/zip 外部二进制

### Enforcement
- BUNDLE-1: 检查无外部 import（仅 node: 前缀）
- BUNDLE-2: 检查 manifest 包含版本和文件列表
