# Proposal: 在 Design 阶段引入 grill-me Skill

> 变更类型：Skill 机制引入 | 影响范围：Design 阶段工作流 | 版本: 0.14.0

---

## 1. 问题背景

### 1.1 当前痛点

MumuSpec Design 阶段已有认知框架（Q1-Q4）和 Hyperplan 对抗审查，但在实际使用中存在以下缺口：

1. **认知框架 Q2 提问不够深入**：Q2 一轮最多问 5 个问题，且采用批量提问方式，用户容易"填问卷式"回答，未真正触发深度思考
2. **事实与决策混同**：Q2 中没有区分"可通过代码库/文档查到的事实"和"需要用户做出的决策"，浪费用户时间在可由 Agent 自查的信息上
3. **缺乏显式共识确认门**：认知框架收敛后直接进入设计生成，缺少"双方已达成共识"的显式验证
4. **设计盲区发现机制不足**：Q4 盲区扫描是 Agent 主导的，缺少用户参与的"拷问"环节来暴露隐性假设

### 1.2 外部参考

mattpocock/skills 的 **grill-me** skill（全网安装量前 3 的 AI Agent skill）提供了经过验证的解决方案：

- **决策树 DFS 式追问**：每次只问一个问题，沿设计分支深入
- **事实与决策分离**：Agent 自查代码库可解答的事实，只把真正的决策抛给用户
- **显式共识门禁**：不达成 shared understanding 不开始行动
- **推荐答案机制**：每个问题附带 AI 推荐方案，降低用户决策负担

---

## 2. 目标与非目标

### 2.1 目标

- 在 Design 阶段引入 grill-me 机制作为**设计方案的压力测试环节**
- grill-me 作为认知框架与 Hyperplan 之间的**中间验证层**
- 保持轻量级：不增加新的 CLI 命令，仅在 phase-design skill 内部增加追问协议

### 2.2 非目标

- 不替代认知框架（Q1-Q4）— 两者互补
- 不替代 Hyperplan 多维对抗 — grill-me 是 1-on-1 深度追问
- 不修改 CLI 命令结构
- 不引入新的外部依赖

---

## 3. 设计方案概述

### 3.1 引入位置

```
Cognitive Framework (Q1-Q4) 收敛
        ↓
  grill-me 压力测试（新增）
        ↓
  Hyperplan 对抗审查（条件触发）
        ↓
  测试用例锁定
```

### 3.2 核心机制

|  grill-me 规则  |  说明  |
|----------------|--------|
| 决策树 DFS | 沿设计方案的分支结构逐层深入 |
| 每次一问 | 每轮只提 1 个问题，等待回答后再继续 |
| 推荐答案 | 每个问题附带 Agent 的推荐选项 + 理由 |
| 事实自查 | Agent 可通过文件系统/代码库查到的信息不问用户 |
| 显式门禁 | 用户确认"已达成共识"后才能进入 Hyperplan |
| 最大轮次 | 上限 10 轮，避免无限追问 |

### 3.3 与认知框架的集成点

| 认知框架产出 | grill-me 消费方式 |
|-------------|------------------|
| Q1 锚定声明 | 作为追问的事实基础，Q1 中的 high-confidence 条目不再追问 |
| Q3 confirmed 约束 | 已确认的约束跳过，仅追问未确认的设计决策 |
| Q4 残留盲区 | 每个 Q4 盲区转化为 1-2 个追问 |

---

## 4. 影响范围

### 4.1 代码/配置影响

| 文件 | 修改类型 |
|------|---------|
| `.mumuspec/bundles/mumuspec-skills/phase-design.md` | 追加 grill-me 步骤 |
| `skills/phase-design.md` | 同步追加 |
| `.mumuspec/knowledge/patterns/KP-00XX-grill-me-integration.md` | 新增知识页面 |

### 4.2 工作流影响

- Design 阶段增加 1 个阻塞点（BP-4.5: grill-me 共识确认）
- Phase Guard 检查项增加 `grill_me_completed` 标志
- 不影响 Open/Build/Verify/Archive 阶段

---

## 5. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 追问轮次过多导致用户疲劳 | 上限 10 轮 + 用户可随时声明"已共识"退出 |
| 与认知框架功能重叠 | 明确的职责边界：认知框架=结构化认知，grill-me=深度验证 |
| Agent 自查不准确误判为"事实" | 关键决策即使 Agent 认为可自查，也标注为"待确认" |

---

## 6. 验收标准

- [ ] phase-design.md 包含 grill-me 步骤说明
- [ ] grill-me 协议遵循"每次一问 + 推荐答案 + 事实自查"
- [ ] 认知框架收敛后自动触发 grill-me
- [ ] grill-me 完成标志写入 cognitive-map.yaml
- [ ] Phase Guard 检查 grill_me_completed 标志
- [ ] 文档和知识页面同步更新

---

> **导航**: [Delta Specs](./delta-specs/) | [约束](./constraints/) | [决策记录](./decisions.md)
