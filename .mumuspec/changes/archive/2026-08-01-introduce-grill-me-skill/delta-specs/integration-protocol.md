# Delta Spec: grill-me 集成协议

> 类型: ADDED | 范围: Design 阶段 phase-design skill

---

## ADDED: grill-me 步骤（Step 2.5 — 位于认知框架收敛后、Hyperplan 前）

### 触发条件

认知框架已收敛（`cognitive_framework.converged == true`）且 workflow 为 `full`。

### 执行协议

```
Step 2.5: grill-me 压力测试 — NEW BLOCKING POINT (BP-4.5)

输入: cognitive-map.yaml (Q1 锚定 + Q3 确认约束 + Q4 残留)
输出: grill-me 共识记录 + cognitive-map.yaml 更新

协议:
  1. 从 cognitive-map.yaml 提取未决策的设计分支
  2. 按 DFS 顺序遍历决策树:
     a. 每个决策点: 检查是否已有 Q3 confirmed 约束覆盖
     b. 若已覆盖 → skip
     c. 若未覆盖 → 生成问题 + 推荐答案 + 事实依据
  3. 提问规则:
     - 每次只提 1 个问题
     - 附带 2-4 个选项（含 Agent 推荐标记）
     - 等待用户回答
  4. 回答处理:
     - confirmed → 写入 cognitive-map.yaml 作为新 Q3 条目
     - rejected + 替代方案 → 写入 cognitive-map.yaml 作为新 Q3 条目
     - skip/maybe → 标记为 "deferred"，写入 Q4 残留
  5. 退出条件（任一满足即退出）:
     - 用户显式确认"已达成共识"
     - 遍历完所有决策分支
     - 达到 10 轮上限
  6. 设置 cognitive-map.yaml 中 grill_me_completed: true

产出:
  - cognitive-map.yaml 更新（追加条目）
  - decisions.md 追加 grill-me 章节
```

### 问题生成规则

```
对每个设计分支节点:
  IF 节点类型 == "技术选型":
    问题模板: "你建议用 [推荐方案] 来实现 [功能]，因为 [理由]。这是最佳选择吗？"
  IF 节点类型 == "架构决策":
    问题模板: "基于 [Q1 引用]，推荐 [方案 A] 而非 [方案 B]，因为 [权衡分析]。你同意吗？"
  IF 节点类型 == "依赖关系":
    问题模板: "设计依赖 [X]，当前状态是 [Y]。这个假设成立吗？"
  IF 节点类型 == "边界条件":
    问题模板: "[场景] 情况下，行为应该是 [推荐]。这符合你的预期吗？"
```

### 事实自查规则

以下信息 Agent 应自查，不询问用户：
- 项目使用的框架/库版本（读 package.json / lockfile）
- 现有 API 接口签名（读代码）
- 数据库 schema（读 migration 文件）
- 现有模块结构（读目录 + import 分析）
- 规范文档中的已有约束（读 spec.md）

以下必须询问用户：
- 业务优先级和权衡取舍
- 兼容旧版本的需求
- 可接受的复杂度/时间成本
- 未在文档中记录的设计意图
