# Proposal: onboard-cli

## Why

MumuSpec 新用户需要同时理解 SHALL/SHALL NOT、Ponytail、Constraint Strength、BOUNDARY.md、五阶段+Loop 双模式等 10+ 概念体系。竞品（OpenSpec/Superpowers/GSD）只需复制文件夹或一个 init 命令即可使用。新用户完成首个变更时间约 60-120 分钟，是 OpenSpec 的 6-10 倍。

## What

实现 `mumuspec onboard` + `mumuspec tutorial` 两个新命令，降低认知负荷：

1. **Quick Start 引导 5 问答** → 自动生成最佳配置
2. **三套内置模板**（frontend/backend/fullstack）→ 每套预配 Guard Layer
3. **渐进式功能披露** → 高级功能默认隐藏，需显式开启
4. **交互式 Tutorial** → 15 分钟内完成首个变更全流程
5. **README 快速开始 ≤ 20 行** → 首屏直接展示

## Impact Scope

- `src/cli/commands/onboard.ts` (新增)
- `src/core/init-templates.ts` (扩展)
- `src/knowledge/onboarding/` (扩展，合并知识层 onboarding)
- `README.md` (优化 Quick Start)
- 不影响现有 `init` 命令功能
- 不影响现有 `knowledge-onboard` 命令功能

## Workflow

full
