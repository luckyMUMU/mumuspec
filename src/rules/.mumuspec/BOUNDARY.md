---
scope: src/rules
layer: 2
---

# Boundary Document: rules

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `generateRulesFiles` | `(root, config) => { created: string[], skipped: string[] }` | generator.ts | 生成 AI Agent 规则文件 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写 |
| `node:path` | 路径处理 |
| `../core/utils.js` | 工具函数 |
| `../core/project-analyzer.js` | 项目分析 |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径
- MumuSpec 配置

### 输出

- AI Agent 规则文件（`.cursorrules`, `AGENTS.md`, `CLAUDE.md`）

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
