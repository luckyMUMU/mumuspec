---
# === 标识 ===
id: "KP-0021"
title: "Skill 生态矩阵：阶段-Skill 映射与分发模式"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/skill-ecosystem.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["skill", "ecosystem", "phase", "mapping", "distribution"]
related_pages:
  - "KP-0018"
  - "KP-0019"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 五阶段工作流需要与外部 Skill 生态（Superpowers、Comet 等）协同，不同阶段使用不同 Skill 组合。

## 设计原则

| 原则 | 说明 |
|------|------|
| **MumuSpec 管 WHAT** | 通过 SHALL/SHALL NOT 定义做什么、不做什么 |
| **外部 Skill 管 HOW** | 通过工作流方法指导怎么做 |
| **约束守卫兜底** | 外部 Skill 产出必须通过 MumuSpec 约束校验 |

## 阶段-Skill 映射

### Open 阶段

| 子步骤 | 外部 Skill | 必需 | 约束守卫 |
|--------|-----------|------|---------|
| 需求探索 | `brainstorming`, `interview-me` | 是/否 | 必须完成 brainstorming（hotfix/tweak 除外） |
| 影响分析 | `gitnexus-exploring`, `gitnexus-impact-analysis` | 是 | 结果记录到 impact-analysis.json |
| 规范草案 | `spec-driven-development` | 是 | delta-specs 必须含 SHALL 和 SHALL NOT |
| 工作区隔离 | `using-git-worktrees` | 是 | 必须创建 worktree |

### Design 阶段

| 子步骤 | 外部 Skill | 必需 | 约束守卫 |
|--------|-----------|------|---------|
| 认知框架 | `brainstorming`, `interview-me` | 是（full工作流） | cognitive-map.yaml 收敛 |
| 设计探索 | `brainstorming` | 是 | 自顶向下逐层细化 |
| 对抗审查 | `hyperplan` | 条件触发 | 硬约束必须合并到 design.md |
| 接口设计 | `api-and-interface-design` | 有API层时 | 符合各层 SHALL/SHALL NOT |
| 安全约束 | `security-and-hardening` | 否 | 安全 SHALL NOT 必须有 Enforcement |
| 决策记录 | `documentation-and-adrs` | 阶段退出时 | 关键决策记录到 design.md |
| 测试用例 | `test-case-design` | 是 | 完成后锁定 |

### Build 阶段

| 子步骤 | 外部 Skill | 必需 | 约束守卫 |
|--------|-----------|------|---------|
| 实现计划 | `writing-plans` | tasks.md 不存在时 | 按 build_layers 从叶子到根排序 |
| 上下文管理 | `context-engineering` | 是 | 使用渐进式披露加载规范 |
| TDD 实现 | `test-driven-development` | 是 | tdd_mode 固定 tdd，不可跳过 |
| 执行方式 | `executing-plans` / `subagent-driven-development` | 是 | 执行方式记录到 .mumuspec.yaml |
| 调试修复 | `systematic-debugging` | 否 | 调试不能违反 SHALL NOT |

### Verify 阶段

| 子步骤 | 外部 Skill | 必需 | 约束守卫 |
|--------|-----------|------|---------|
| 完成验证 | `verification-before-completion` | 是 | 必须有验证证据 |
| 代码审查 | `requesting-code-review` | 是 | 审查覆盖 SHALL/SHALL NOT |
| 回退决策 | `systematic-debugging` | 否 | 回退必须用户确认 + 保存快照 |

### Archive 阶段

| 子步骤 | 外部 Skill | 必需 | 约束守卫 |
|--------|-----------|------|---------|
| 分支完成 | `finishing-a-development-branch` | 是 | 合并策略必须用户确认 |
| CI/CD 集成 | `ci-cd-and-automation` | 是 | CI 必须含全量检查 |
| 文档归档 | `documentation-and-adrs` | 阶段退出时 | 归档含完整变更记录 |

## 兼容生态

| 生态 | dispatch_mode | 说明 |
|------|--------------|------|
| Superpowers | deep | 深度集成（TDD、调试、验证等） |
| Agent Skills | deep | 全生命周期覆盖 |
| Comet | interop | 状态机层互操作 |
| Custom | — | 项目可插拔扩展 |

## 影响

- Skill 编排器按阶段自动分发到对应 Skill
- 约束守卫对 Skill 产出进行兜底校验
- 新增 Skill 无需修改 MumuSpec 核心代码

## 关联约束

- SHALL: 阶段分发 SHALL 遵循"必需 Skill 必须执行"原则
- SHALL NOT: 外部 Skill 不得绕过 SHALL NOT 约束
