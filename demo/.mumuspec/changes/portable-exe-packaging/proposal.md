# Proposal: portable-exe-packaging

## Summary
为 demo 项目增加一键启动并支持打包为独立无外部依赖的 exe 单一文件，使其能运行前后端服务，允许在同一目录创建配置及临时文件。

## Scope
- image-share/ (前端服务 + 后端服务)
- src/ (核心模块)
- 根目录 (启动脚本 + 打包脚本)

## Motivation
当前 demo 项目依赖 Node.js 环境运行，需要用户自行安装依赖。为了让非技术用户也能轻松使用，需要：
1. 一键启动脚本（无需记住命令）
2. 打包为独立 exe（无需外部依赖）
3. 自包含配置和数据目录（在同一目录创建，不污染系统）

## Requirements

### FR-001: 一键启动脚本
- 双击 `start.bat` 或 `start.sh` 即可启动
- 自动检测并安装依赖（仅首次）
- 启动前后端服务

### FR-002: Exe 打包支持
- 支持打包为独立无依赖的 exe 单文件
- 使用 Node.js SEA (Single Executable Application) 技术
- 允许指定输出路径

### FR-003: 自包含运行
- 运行时的配置文件在 exe 同级目录创建
- 临时文件和上传文件存储在 exe 同级目录
- 不依赖系统级目录

### FR-004: 前后端服务
- 后端 API 服务（Express + 文件上传）
- 前端静态页面服务
- 两个服务在同一进程或协调启动

## Plan
1. 研究 Node.js SEA 打包能力
2. 创建 `scripts/build-exe.mjs` 打包脚本
3. 创建 `scripts/start.mjs` 一键启动脚本
4. 修改服务入口支持同目录数据写入

## Risks
- Node.js SEA 有版本要求（≥ v20）
- 二进制文件体积较大（~50MB+）
