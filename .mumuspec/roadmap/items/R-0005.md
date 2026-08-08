---
id: "R-0005"
title: "sync 作为 init / 迁移的统一入口"
status: planned
priority: P1
scope: "src/cli/commands/init.ts, src/cli/commands/sync.ts"
created_at: "2026-08-05"
target_date: "2026-08-10"
owner: ""
depends_on: ["R-0001"]
mutex_with: []
excludes: []
capacity_cost: 2
---

# R-0005: sync 作为 init / 迁移入口

## 背景

> 当前 init 是独立命令，不会触发 sync 同步。
> 旧版本迁移也缺少规范的"差异对比 → 增量同步"流程。

## 范围

### 包含
- init 内部自动调用 sync 完成初始化
- `--migrate` 模式检测旧版格式并触发增量同步
- 同步前后生成 diff 报告

### 不包含
- 老版本数据迁移的每个字段转换逻辑（按需扩展）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | `mumuspec init` 后自动执行 sync | CLI 测试验证 |
| 2 | `mumuspec sync --migrate` 检测旧版格式 | e2e 测试 |
| 3 | 生成同步差异报告 | 输出文件验证 |

