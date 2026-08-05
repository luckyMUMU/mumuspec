---
scope: src/contract
layer: 2
title: 契约层 — 技术规格
last_updated: '2026-08-04'
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
| `constants.ts` | MUMUSPEC_DIR、CONTRACTS_SUBDIR、AUDIT_LOG_FILE 等路径常量 |
| `loader.ts` | 发现、加载、解析所有 BOUNDARY.md 与 contracts.yaml |
| `validator.ts` | 将文档声明与代码实际 export 交叉验证 |
| `impact-analyzer.ts` | 针对外部契约变更输出影响清单 |
| `manager.ts` | 契约 CRUD、审计日志读写、BOUNDARY.md 脚手架生成 |

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

## 性能约束

- 全项目扫描（findAllBoundaryDocuments）应 < 500ms
- 单次 drift 检测应 < 100ms
- 审计日志写入应为追加模式，不影响主流程性能
