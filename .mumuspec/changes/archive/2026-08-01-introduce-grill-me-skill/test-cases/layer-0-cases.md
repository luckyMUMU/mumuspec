# Test Cases: Layer 0 — 根层（grill-me 集成协议）

> 设计阶段锁定 | 版本: 0.14.0

---

## TC-001: 触发条件验证

**前提**：活跃变更 workflow=full，design.md 存在，cognitive-framework.converged=true

**预期**：
- grill-me 步骤 SHALL 被触发
- phase-design.md 包含 Step 2.5
- 执行进入 grill-me 协议

**验证**：`grill_me_result.completed == true`

---

## TC-002: 提问规则验证

**前提**：grill-me 步骤执行中

**预期**：
- 每轮只提问 1 个问题（不多于 1 个）
- 每个问题附带 2-4 个选项
- 每个问题附带 Agent 推荐标记 + 理由

**验证**：检查 cognitive-map.yaml grill_me.entries 每轮只有 1 个问题

---

## TC-003: 事实自查验证

**前提**：分支涉及技术事实（如框架版本、API 签名）

**预期**：
- Agent 自查 package.json / 代码，不询问用户
- 需要用户决策的业务问题才提问

**验证**：grill_me.entries 中无纯事实性问题

---

## TC-004: 上限保护验证

**前提**：grill-me 执行到第 10 轮仍有未决分支

**预期**：
- 第 10 轮结束后强制退出
- 剩余分支标记为 "deferred-limit-reached"
- 不阻塞后续 Hyperplan（consensusReached=false 仍可继续）

**验证**：`grill_me_result.rounds <= 10` 且 guard 通过

---

## TC-005: 用户退出权验证

**前提**：grill-me 执行到第 N 轮（N < 10）

**预期**：
- 用户可随时回答 "consensus" / "已共识"
- 追问立即停止
- consensus_reached = true

**验证**：`grill_me_result.consensus_reached == true` 且 rounds < 10

---

## TC-006: Phase Guard 向后兼容验证

**前提**：v0.13.0 创建的变更（无 grill_me_result 字段）进入 design_to_build

**预期**：
- Phase Guard 不因缺少 grill_me_result 而阻断
- 新变更（v0.14.0+）必须有 grill_me_result.completed == true

**验证**：旧变更 guard 跳过，新变更 guard 检查

---

## TC-007: Hyperplan 衔接验证

**前提**：grill-me 完成后进入 Hyperplan

**预期**：
- confirmed 决策不再被攻击
- deferred 项作为重点审查对象
- consensus=false 增加"遗留问题"审查维度

**验证**：Hyperplan 报告引用 grill_me.entries

---

## TC-008: 反馈循环验证

**前提**：grill-me 中用户拒绝核心设计

**预期**：
- rollback_count++
- 触发认知框架增量轮（新 Q2）
- 新 Q1 包含 grill-me 确认的约束

**验证**：cognitive_map 增量更新正确
