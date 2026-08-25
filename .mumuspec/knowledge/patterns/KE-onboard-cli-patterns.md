---
id: KE-onboard-cli-patterns
title: Architecture patterns from onboard-cli
type: pattern
status: confirmed
scope: onboard-cli
created_at: 2026-08-09
tags:
  - auto-extracted
  - pattern
  - architecture
  - onboard-cli
graph_bindings: []
---
> Auto-extracted from onboard-cli/design.md

# Design: onboard-cli

## Architecture Overview

本设计实现 R-0004（Onboarding CLI），新增两个命令并修改 README，旨在将新用户完成首个变更时间从 60-120 分钟降至 15 分钟内。

```
┌─────────────────────────────────────────────────────────┐
│  CLI Entry (src/cli/index.ts)                           │
├─────────────────────────────────────────────────────────┤
│  onboard quickstart  │  tutorial                        │
│  (新增子命令)         │  (新增顶层命令)                    │
├─────────────────────────────────────────────────────────┤
│  QuickStart Engine    │  Tutorial Engine                 │
│  - 5-question flow    │  - 6-stage walkthrough           │
│  - template selection │  - interactive prompts           │
│  - config generation  │  - progress tracking             │
├─────────────────────────────────────────────────────────┤
│  Templates (src/core/init-templates.ts)                  │
│  - frontend.yaml      │  - backend.yaml                  │
│  - fullstack.yaml                                       │
├─────────────────────────────────────────────────────────┤
│  Existing Systems (unchanged)                           │
│  - init command       │  - knowledge-onboard command     │
│  - config.yaml        │  - project-analyzer              │
└─────────────────────────────────────────────────────────┘
```

## API Contracts

### Command 1: `mumuspec onboard quickstart`

**Input**: 交互式问答（5 问）
1. 项目类型 → `[frontend | backend | fullstack]`
2. 团队规模 → `[solo | small (2-5) | medium (6-20) | large (20+)]`
3. 严格程度偏好 → `[strict | balanced | relaxed]`
4. 是否需要测试 → `[yes | no]`
5. 是否需要 hooks → `[yes | no]`

**Output**: 
- 在项目根目录生成/更新 `.mumuspec.yaml`（保留已有配置）
- 输出下一步建议：`mumuspec new <change-name>`

**副作用**:
- 写入 `.mumuspec.yaml` 配置文件
- 生成对应的 `prd.md` / `tech.md` 模板文件
- 不修改已有 spec/ 目录内容

### Command 2: `mumuspec tutorial`

**Input**: 无（交互式引导）

**Output**: 15 分钟内完成首个变更的完整 walkthrough
1. 展示欢迎信息 + 学习路径概览
2. Step 1: 运行 `onboard quickstart` 生成配置
3. Step 2: 运行 `mumuspec new tutorial-change` 创建变更
4. Step 3: 展示 design.md 模板结构
5. Step 4