---
id: DS-001
layer: 1
scope: scripts
delta: ADDED
---

## SHALL
- SHALL 提供 scripts/build-exe.mjs 打包脚本
- SHALL 支持 Node.js SEA (Single Executable Application) 生成独立 exe
- SHALL 输出文件路径可配置（默认 ./dist/）
- SHALL 自动检测 Node.js 版本（要求 ≥ v20.0.0）

## SHALL NOT
- SHALL NOT 依赖外部打包工具（仅使用 Node.js 内置能力）
- SHALL NOT 修改源代码结构（仅打包，不改写源码）
