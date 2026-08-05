---
id: "R-0001"
title: "sync 命令：代码现状 → 双向同步到持久化"
status: active
priority: P0
scope: "src/cli/commands, src/core/"
created_at: "2026-08-05"
target_date: "2026-08-05"
owner: ""
depends_on: []
mutex_with: []
excludes: []
capacity_cost: 2
---

# R-0001: sync 命令

## 背景

> 当前 `.mumuspec/` 下的持久化文档（BOUNDARY.md、index.yaml、contracts/）与代码实际状态存在漂移风险。
> 缺少一个能将"代码现状"同步回"规范持久化"的命令。

## 范围

### 包含（Includes）
- `mumuspec sync` 命令扫描 src/ 下所有模块
- 自动更新 BOUNDARY.md 中的导出接口
- 校验 index.yaml children 完整性
- 生成 contracts/ 中的模块间契约快照
- 作为 `mumuspec init` 和迁移的统一入口

### 不包含（Excludes）
- 分布式 spec 自动生成（已有 spec-scaffolder）
- 迁移脚本之外的旧版兼容性修复

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | `mumuspec sync` 命令成功执行 | CLI 返回 success |
| 2 | 能检测并报告未登记模块 | 输出 missing modules 列表 |
| 3 | 自动更新 BOUNDARY.md 的导出接口 | diff 前后对比 |
| 4 | init 命令内部调用 sync | sync 被 init 命令引用 |
| 5 | 测试覆盖核心路径 | 至少 5 个单测 |

