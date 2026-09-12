---
id: KE-skill-plugin-standard-patterns
title: Architecture patterns from skill-plugin-standard
type: pattern
status: confirmed
scope: skill-plugin-standard
created_at: 2026-09-12
tags:
  - auto-extracted
  - pattern
  - architecture
  - skill-plugin-standard
graph_bindings: []
---
> Auto-extracted from skill-plugin-standard/design.md

# Design: skill-plugin-standard

> 阶段：Design · workflow：full · 变更：skill-plugin-standard
> 依据：`proposal.md`、`delta-specs/skill-plugin-standard.md`、`code-graph/impact-analysis.json`、
> `review/skill-composition-audit-2026-09-12.md`、宿主官方规范（`plugin-structure/manifest-reference`、`plugin-discovery/marketplace-format`）

## 0. 设计决策裁决（本变更的语义前提）

| # | 决策 | 裁决 | 理由 |
|---|---|---|---|
| D1 | 交付形态 | **新增并行路径**，不替换既有 bundle 语义 | 限制爆炸半径；既有 5 个 bundle 测试仅 1 处需改（`publishBundle` 成功断言） |
| D2 | 分发唯一形式的判定 | **宿主可识别**即为唯一形式；自研描述符降为内部工件 | 规范原文：缺 `.codebuddy-plugin/plugin.json` 宿主不识别 |
| D3 | 编排器单源化 | 包内含全部 `skills/<name>/SKILL.md`，入口唯一；中文丰富版降为被引用资源 | 插件包成为安装单元后，四处定义收敛为一处 |
| D4 | 漂移检测接入点 | `src/cli/commands/spec.ts:325-330` 的 `driftSources` 数组 | 唯一接入点；逐源隔离已在 `:331-343` 就绪 |
| D5 | `cognitive-map` 死模块 | **注册该命令**（用户裁决） | 模块已完整实现且有测试，缺的只是接线；"实现它"优于"改文本迁就" |
| D6 | 签名漂移 | **修正全部四类**（用户裁决） | 四类同源，全部落在 Requirement 5 射程内 |

## 1. 架构总览（Architecture Overview）

### 1.1 现状（问题域）

```
skills/mumuspec/**            ← 源（9 件，高频编辑）
        │ mumuspec install --force（单向快照，re-install 需人工记得）
        ▼
~/.workbuddy/skills/**        ← 模型唯一可加载集合（7 件，无漂移检测）

skills/mumuspec/workflow.yaml ← 阶段分发规则定义处之一（另有三处）
src/bundle/packager.ts        ← 自研格式：面向不存在的 .mumuspec/skills/，版本硬编码 '0.12.2'，
                                publishBundle 占位实现却 return success（fail-open）
src/cli/commands/cognitive-map.ts ← 完整实现但未注册（死模块）
```

### 1.2 目标形态

```
                       ┌──────────────────────────────────────┐
                       │  产出侧：plugin-package              │
   skills/**  ────────▶│  .codebuddy-plugin/plugin.json        │
   （唯一权威源）       │  .codebuddy-plugin/marketplace.json   │
                       │  skills/<name>/SKILL.md  × N         │
                       └───────────────┬──────────────────────┘
                                       │ 清单先过校验器（先校验器后消费者）
                                       ▼
                       ┌──────────────────────────────────────┐
                       │  安装侧：plugin-install   