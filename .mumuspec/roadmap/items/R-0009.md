---
id: "R-0009"
title: "Onboarding CLI：降低认知负荷，15 分钟首个变更"
status: planning
priority: P1
scope: "src/cli/commands, src/core/config"
created_at: "2026-08-06"
target_date: "2026-08-31"
owner: ""
depends_on: ["R-0001"]
mutex_with: []
excludes: []
capacity_cost: 3
---

# R-0009: Onboarding CLI

## 背景

> 调研表明 MumuSpec 的竞品（OpenSpec/Superpowers/GSD）只需复制文件夹或一个 init 命令即可使用，
> 而 MumuSpec 新用户需要同时理解 SHALL/SHALL NOT、Ponytail、ConstraintStrengthField、
> BOUNDARY.md、五阶段+Loop 双模式、Top-Down/Bottom-Up 混合范式、Contract Registry、
> Knowledge Layer、Hyperplan 对抗审查、Worktree 隔离、Config.yaml 多维配置等概念体系。
> 新用户完成首个变更时间约 60-120 分钟，是 OpenSpec 的 6-10 倍。
> 认知负荷是 MumuSpec 用户转化率的最大阻力。

## 范围

### 包含（Includes）
- `mumuspec onboard` 引导式交互式初始化（5-8 个问题自动生成优化配置）
- 内置项目模板（frontend / backend / fullstack）包含预配置的最佳 Guard Layer
- 渐进式功能披露：新用户默认仅展示核心功能，高级功能按需解锁
- `mumuspec tutorial` 交互式教程（15 分钟内完成首个变更全流程）
- README 首页"核心卖点 + 快速开始"从 80 行压缩至 20 行

### 不包含（Excludes）
- 图形化 Web 教程（仅 CLI 交互）
- 完整的视频课程
- 框架核心逻辑的任何修改（纯 UX 优化）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | `mumuspec onboard` 引导式问答后生成可用 config | 新用户测试：5 分钟内完成配置 |
| 2 | 内置模板包含最佳 Guard Layer 预配置 | 模板内容审查 |
| 3 | 高级功能默认隐藏，需显式开启 | `mumuspec config set advanced.enabled true` |
| 4 | Tutorial 覆盖首个变更全流程 | 新用户测试：15 分钟内完成 |
| 5 | README 首页 quick start ≤ 20 行 | 行数验证 |

## 工作量预估

`capacity_cost`: 3（≈ 6-9 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| onboard 交互流程 | 3 |
| 项目模板（3 套） | 2 |
| 渐进式功能披露 | 1 |
| Tutorial 编排 | 2 |
| README 优化 | 1 |

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| onboard 生成配置不符合复杂项目需求 | 中 | 中 | 始终提供"高级配置"手动入口 |
| 3 模板覆盖不足 | 低 | 低 | 允许社区提交模板 PR |

---

> **关联**: depends_on [R-0001] | mutex_with [] | excludes [图形化教程, 视频课程]
