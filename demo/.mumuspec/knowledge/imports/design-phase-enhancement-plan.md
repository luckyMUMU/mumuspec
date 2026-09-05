# MumuSpec Design 阶段强化方案

> 基于业界调研（GitHub Spec Kit、OpenSpec、AWS Kiro、Superpowers）与当前流程评价

---

## 一、当前 Design 阶段的核心问题

### 1.1 与业界对标

| 维度 | GitHub Spec Kit | OpenSpec | Kiro (AWS) | 当前 MumuSpec |
|------|----------------|----------|------------|---------------|
| **结构化模板** | ✅ 强制模板 | ✅ Delta Spec | ✅ 分层文档 | ❌ 自由格式 |
| **澄清循环** | ✅ clarify 步骤 | ❌ | ✅ 需求确认 | ❌ |
| **AI 自审** | ✅ analyze 命令 | ❌ | ✅ 设计评审 | ❌ |
| **跨工件一致性** | ✅ analyze 检查 | ❌ | ✅ | ❌ |
| **任务粒度** | ✅ 2-5 min/任务 | ✅ 明确拆解 | ✅ | ❌ 无指导 |
| **API 契约** | ✅ 接口定义 | ✅ | ✅ | ❌ |
| **数据流规范** | ✅ | ✅ | ✅ | ❌ |
| **约束前置** | ✅ constitution.md | ✅ | ✅ | ❌ |

### 1.2 根因分析 (5 Whys)

**问题：设计文档质量低，无法直接指导实现**

1. **Why 1:** 设计文档只有架构图和分层，缺少接口定义、数据契约、错误处理规范
2. **Why 2:** 模板没有强制这些字段
3. **Why 3:** 框架没有提供结构化模板（只有文档指引）
4. **Why 4:** 设计阶段没有验证/审查机制
5. **Why 5:** 设计被视为"一次性产物"，而非"可执行规范"

**核心根因：Design 阶段在 MumuSpec 中被视为文档输出，而非可执行规范。**

---

## 二、改进计划

### 2.1 总体策略

将 Design 阶段从 **"文档模式"** 升级为 **"规范模式"**：

```
当前:  proposal.md → [human writes] → design.md → build
目标:  proposal.md → [generate design.md] → [clarify] → [AI self-review] → [cross-check] → [approve] → build
```

### 2.2 四个核心改进点

#### 改进点 1：结构化设计模板（P0）

**问题：** 当前 design.md 模板只有 Architecture、Layers、Test Strategy 三个自由段落。

**方案：** 引入强制字段的设计模板（参考 Spec Kit + Kiro）：

```markdown
# Design: {change-name}

## 1. API Contracts          ← 新增：接口契约
- Endpoint definitions (method, path, input, output, errors)
- Data schemas (JSON Schema / TypeScript types)
- Authentication/Authorization rules

## 2. Data Flow Diagram      ← 新增：数据流
- Request/Response lifecycle
- State transitions
- External service interactions

## 3. Error Specification    ← 新增：错误规范
- Error codes and messages
- Recovery strategies
- User-facing vs internal errors

## 4. Architecture Overview  ← 保留
- Component diagram
- Layer responsibilities
- Technology choices with rationale

## 5. Implementation Layers  ← 增强
- Layer 0: [what + acceptance criteria + estimated effort]
- Layer 1: [what + acceptance criteria + estimated effort]

## 6. Constraints Analysis    ← 新增：约束分析
- Performance requirements (latency, throughput)
- Security considerations
- Compatibility requirements
- Resource limits (memory, disk, CPU)

## 7. Risk Mitigation        ← 增强
- Identified risks from cognitive-map Q4
- Mitigation strategies per risk

## 8. Test Strategy          ← 增强
- Unit test plan per layer
- Integration test scenarios
- Acceptance criteria (measurable)
```

**验证方式：** 设计文档缺少任一段落时，guard 返回 E-DESIGN-009。

---

#### 改进点 2：澄清循环 (Clarification Loop)（P0）

**问题：** AI 直接基于 proposal 生成设计，没有消除歧义的环节。

方案：在 proposal → design 之间插入 clarify 步骤：

```
1. 分析 proposal，提取 SHALL 项、模糊描述、缺失信息
2. 对每个模糊点生成澄清问题（参考 Spec Kit /speckit.clarify）
3. 用户回答（交互式 / 批量）
4. 将答案整合到 design.md 的 Constraints Analysis 中
```

**实现方式：**
- 新增 CLI 命令 `mumuspec clarify <change>` 触发澄清
- 或作为 guard 的前置步骤自动执行
- 澄清结果存储在 `clarification-log.md`

---

#### 改进点 3：AI 自审协议 (AI Self-Review)（P1）

**问题：** 设计文档生成后直接进入 build，没有质量检查。

**方案：** 设计阶段的"内部 Code Review"（参考 Kiro 设计评审 + Spec Kit analyze）：

```
AI Self-Review Checklist:
□ 完整性：是否覆盖所有 FR（功能需求）？
□ 一致性：Architecture 与 Layers 描述是否一致？
□ 接口匹配：API Contracts 是否与 FR 中的用户交互对应？
□ 风险闭环：每个 Q4 risk 是否都有对应的 mitigation？
□ 约束可行：Performance/Security 要求是否可实现？
□ 测试可执行：Test Strategy 是否有可量化的验收标准？
```

**输出：** 生成 `design-review.md`，列出发现的问题和修复建议。

---

#### 改进点 4：跨工件一致性检查（P1）

**问题：** design.md 与 proposal.md 可能不一致（如改了方案但未同步）。

**方案：** guard --apply 时自动执行一致性检查（参考 Spec Kit /analyze）：

```
Cross-Artifact Consistency Check:
1. design.md 的 Layers 是否覆盖 proposal.md 的所有 Plan 步骤？
2. design.md 的 API Contracts 是否满足 proposal.md 的所有 FR？
3. cognitive-map Q4 risks 是否都有对应的 mitigation？
4. delta-specs 与 design.md 的 Layers 是否对齐？
```

**不一致时：** 返回 E-DESIGN-010，列出差异项。

---

#### 改进点 5：任务粒度规范（P2）

**问题：** hyperplan 生成的任务可能粒度过大或过小。

**方案：** 引入 2-5 分钟/任务的粒度参考（参考 OpenSpec 任务分解原则）：

```
Task Granularity Guide:
- Atomic: 1-2 min — single file edit, simple function
- Micro:  2-5 min — one API endpoint, one component
- Macro:  5-15 min — should be decomposed further
- Mega:   >15 min — MUST be decomposed

Rule: No task in hyperplan_result should exceed 15 min.
```

**guard 检查：** 如果 hyperplan_result 中存在 >15min 任务，返回 W-DESIGN-001。

---

## 三、实施计划

### Phase 1: 结构化模板（1-2 天）
- [ ] 定义 design.md schema（JSON Schema / YAML）
- [ ] 更新 proposal template，增加"约束前置"字段
- [ ] 更新 guard 逻辑，检查新增字段的完整性
- [ ] 更新 tests/cli.test.ts 添加设计模板验证用例

### Phase 2: 澄清循环（2-3 天）
- [ ] 实现 clarify 命令的核心逻辑
- [ ] 定义澄清问题的触发规则
- [ ] 实现 clarification-log.md 生成
- [ ] 与 guard 集成，未执行 clarify 时给出警告

### Phase 3: AI 自审（2-3 天）
- [ ] 实现 design-review.md 模板和生成逻辑
- [ ] 定义自审检查清单的优先级
- [ ] 与 archive 阶段集成，记录自审结果到知识库

### Phase 4: 一致性检查 + 任务粒度（1-2 天）
- [ ] 实现跨工件对比算法
- [ ] 更新 guard --apply 流程
- [ ] 添加 W-DESIGN-001 警告码

---

## 四、期望效果

| 指标 | 当前 | 目标 |
|------|------|------|
| 设计文档字段完整率 | ~40% | >90% |
| 需求-设计一致性 | 未检查 | 100% 自动检查 |
| AI 设计返工率 | ~40% | <15% |
| 任务可执行粒度 | 无约束 | 2-15 min/任务 |
| 风险闭环率 | ~50% | >90% |

---

## 五、风险与权衡

| 风险 | 缓解措施 |
|------|----------|
| 模板过重，小变更成本太高 | 引入 preset 机制：tweak 使用轻量模板 |
| 澄清循环增加交互次数 | 支持批量回答和默认选项 |
| AI 自审可能误报 | 分级：CRITICAL 阻塞, MAJOR 警告, MINOR 提示 |
| 一致性检查性能 | 仅检查文本差异，不做语义分析 |
