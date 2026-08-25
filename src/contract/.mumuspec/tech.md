---
scope: src/contract
layer: 2
title: 契约层 — 技术规格
last_updated: '2026-08-08'
---

# 技术规格: Contract Layer

## 模块架构

```
src/contract/
├── index.ts            # barrel re-export
├── constants.ts        # 路径常量定义
├── loader.ts           # BOUNDARY.md 加载与契约发现
├── validator.ts        # 漂移检测
├── impact-analyzer.ts  # 变更影响分析
└── manager.ts          # 契约持久化、审计日志
```

## 文件职责

| 文件 | 职责 |
|------|------|
| `constants.ts` | MUMUSPEC_DIR、CONTRACTS_SUBDIR、AUDIT_LOG_FILE、BOUNDARY_FILE 等路径常量 |
| `loader.ts` | 发现、加载、解析所有 `.mumuspec/BOUNDARY.md` 与 contracts.yaml；支持表格+列表双格式解析 |
| `validator.ts` | 将文档声明与代码实际 export 交叉验证；覆盖 .ts/.tsx/.js/.jsx/.mjs/.cjs 等扩展名 |
| `impact-analyzer.ts` | 针对外部契约变更输出影响清单 |
| `manager.ts` | 契约 CRUD、审计日志读写、BOUNDARY.md 脚手架生成（写入 `dir/.mumuspec/BOUNDARY.md`） |

## 类型系统

核心类型定义在 `src/core/types-contract.ts`：

| 类型 | 用途 |
|------|------|
| `Contract` | 外部契约实体 |
| `ContractRegistry` | 契约注册表 |
| `ContractDrift` / `DriftReport` | 漂移检测记录 |
| `BoundaryDocument` / `BoundaryExport` / `BoundaryDependency` | BOUNDARY.md 结构化解析类型 |
| `ContractImpactAnalysis` / `ImpactEntry` | 影响分析输出 |

## 依赖

- **内部**: `node:fs` / `node:path` / `yaml` / `../core/types-contract.js`
- **外部**: 零外部运行时依赖（除 yaml）

## BOUNDARY.md 存储位置

BOUNDARY.md 存储在 `dir/.mumuspec/BOUNDARY.md`，与该目录的 `prd.md`、`tech.md` 同级。
loader 向后兼容直接位于 `dir/BOUNDARY.md` 的旧格式。

## 解析器格式支持

loader 的 `parseExports`/`parseDependencies`/`parseDataContracts`/`parseChangeLog` 同时支持：
1. **列表格式**：`- \`name\` signature: description`
2. **表格格式**：`| \`name\` | signature | description |`

表格解析跳过表头行和分隔线（`|---|---|`），提取首列为符号名、末列为描述。

## 性能约束

- 全项目扫描（findAllBoundaryDocuments）应 < 500ms
- 单次 drift 检测应 < 100ms
- 审计日志写入应为追加模式，不影响主流程性能
