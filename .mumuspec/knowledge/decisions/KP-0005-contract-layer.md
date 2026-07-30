---
# === 标识 ===
id: "KP-0005"
title: "Contract Layer 契约层设计决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.8.0-contract-layer"
source_phase: "design"
source_artifact: "docs/design/contract-layer.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["contract", "external", "outbound", "service-mesh"]
related_pages:
  - "KP-0002"
  - "KP-0006"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

微服务架构中，项目既消费大量外部服务，又对外暴露自身的接口。AI 编写 RPC 调用时无从获知超时策略、重试规则；自身对外接口缺乏正式声明，变更时无法检测向后兼容性破坏。

## 决策

引入 Contract Layer（契约层），统一管理两类契约：

### 契约分类

| 契约类型 | 目录 | 核心问题 | 派生约束 |
|---------|------|---------|---------|
| **外部服务契约** | `contracts/external/` | "我如何正确调用外部服务？" | RPC 调用约束（超时、重试、错误处理、降级） |
| **自身对外契约** | `contracts/outbound/` | "外部如何正确集成我的服务？" | 向后兼容性约束（不删字段、不改语义、版本管理） |

### 契约格式

```yaml
contract:
  type: external | outbound
  name: "service-name"
  category: rpc | rest | graphql | mq | middleware | database
  protocol: "gRPC"
  version: "v2.1.0"
  stability: stable | beta | deprecated
  policies:
    timeout: "5s"
    retry:
      max_attempts: 3
      backoff: "exponential"

derived_constraints:
  scope: "src/payment"
  shall:
    - id: "PAY-EXT-001"
      desc: "所有 PaymentService RPC 调用必须设置 5s 超时"
      enforcement: { type: "ast", check: "rpc-call-timeout(service=PaymentService, max=5s)" }
      severity: ERROR
```

### 派生约束自动注入

- 契约中声明的 `policies`（超时、重试、熔断）自动派生为 SHALL 约束
- `derived_constraints.scope` 指定注入目标层级
- 注入到对应层级 `spec.md` 中，AI Agent 可感知

## 影响

- 服务接口约定不再散落在 wiki 和口头约定中
- RPC 调用错误处理策略可被 AI 感知并遵守
- 向后兼容性破坏可被检测（P2 漂移检测）
- 契约变更时自动重新派生约束

## 关联约束

- SHALL: 所有外部服务调用必须有对应契约声明
- SHALL NOT: 契约 stability 为 stable 时，不得删除响应字段或修改字段类型
