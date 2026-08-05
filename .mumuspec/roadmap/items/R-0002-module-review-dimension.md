---
id: "R-0002"
title: "模块级审查维度 + 各模块独立评分"
status: active
priority: P0
scope: "src/cli/commands, src/guard/"
created_at: "2026-08-05"
target_date: "2026-08-05"
owner: ""
depends_on: ["R-0001"]
mutex_with: []
excludes: []
capacity_cost: 1
---

# R-0002: 模块级审查维度

## 背景

> 当前七维度审查仅覆盖全局级指标，缺少对每个模块（core/change/cli/...）的独立评价。
> 用户需要对每个模块获得单独的评分和诊断。

## 范围

### 包含（Includes）
- 新增审查维度 D8 = 模块级审查
- 对 src/ 下每个已注册模块生成独立评分卡
- 输出修复建议

### 不包含（Excludes）
- 第三方依赖的模块评分
- 自动化修复

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | `mumuspec review --module <name>` 可运行 | CLI 调用成功 |
| 2 | 输出包含模块名 + 7 维度子评分 | JSON 格式验证 |
| 3 | 完整审查后输出模块维度汇总 | 集成测试 |

