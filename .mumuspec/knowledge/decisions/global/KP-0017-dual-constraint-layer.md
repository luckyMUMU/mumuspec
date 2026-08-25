---
# === 标识 ===
id: "KP-0017"
title: "双层约束体系：业务约束层（spec.md）+ 行为约束层（constraints.yaml）"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-27T00:00:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.12.0-dual-constraint"
source_phase: "design"
source_artifact: "docs/design/spec-layer.md#11-双层约束体系"

# === 图谱关联 ===
graph_bindings:
  - src/spec/loader.ts
  - src/guard/checker.ts
  - src/core/types.ts

# === 索引 ===
tags: ["dual-constraint", "spec", "constraints", "behavior", "architecture", "goal"]
related_pages:
  - "KP-0001"
  - "KP-0008"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 需要同时管理"项目技术规范"和"AI Agent 行为准则"，两者性质不同但需要协同。

## 决策

采用双层约束体系，分离业务约束与行为约束：

### 业务约束层（spec.md / prohibitions.md）

| 维度 | 说明 |
|------|------|
| **文件位置** | `.mumuspec/spec.md`、`.mumuspec/prohibitions.md` |
| **内容** | 业务级 SHALL / SHALL NOT 约束 |
| **与代码关系** | 与代码强绑定（定义 Enforcement 可执行校验） |
| **组织结构** | 按目录树分层 |
| **演变方式** | 随变更演进（delta spec → Archive 合并到主规范） |
| **漂移检测** | 规范与代码不一致时阻断（P0） |

### 行为约束层（constraints.yaml）

| 维度 | 说明 |
|------|------|
| **文件位置** | `.mumuspec/constraints.yaml` |
| **内容** | 行为级正反向约束（agent 行为准则） |
| **与代码关系** | 独立于代码（描述"应做/不应做"而非"做什么"） |
| **组织结构** | 按双维度（TD 技术设计 + RG 需求目标） |
| **演变方式** | 持久化，跨变更存在 |
| **强度可调** | 三档强度（high/medium/low），按维度独立配置 |

### 两层关系

```
业务约束层 --[mumuspec constraints sync]--> 行为约束层（单向派生）
行为约束层 --[不回写]--> 业务约束层（避免循环依赖）
```

- 行为约束层可从业务约束层自动派生（`mumuspec constraints sync`）
- 行为约束层不回写业务约束层（避免循环依赖）
- 项目可在行为约束层手工添加团队规范、合规要求等自定义约束

## 影响

- 行为约束层的约束独立于代码实现细节，更稳定
- 业务约束层随项目演进变化，行为约束层保持持久化指导
- Agent 在做设计决策时，两层约束共同作用

## 关联约束

- SHALL: 行为约束层 SHALL 独立于代码路径描述
- SHALL NOT: 不得通过修改业务约束层来绕过行为约束层
- SHALL: `mumuspec constraints sync` SHALL 保持两层语义一致
