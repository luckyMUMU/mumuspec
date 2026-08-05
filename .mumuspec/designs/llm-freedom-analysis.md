# LLM 自由度分析与工作流增强设计

> 日期：2026-08-02  
> 范围：MumuSpec 工作流引擎（workflow.yaml + 阶段 Skill + 阻塞点）  
> 目标：借鉴 Claude Code Dynamic Workflows 的理念，为当前工作流增加 LLM 动态决策能力

---

## 1. 当前工作流的结构与局限

### 1.1 现状

```
用户请求
    ↓
workflow.yaml 静态分发
    ↓
phase-open / phase-design / phase-build / phase-verify / phase-archive
    ↓
每个 phase 内部：固定步骤 + 阻塞点（BP-1 ~ BP-18）
    ↓
阶段 Guard 强制通过
```

工作流为**预编写静态流水线**：
- Phase 顺序硬编码（open → design → build → verify → archive）
- 每个 phase 的入口/出口条件、所需 Skill、阻塞点均在 YAML/MD 中预定义
- LLM 只是按指令执行，不参与流程决策

### 1.2 三个核心局限

| 局限 | 表现 | 影响 |
|------|------|------|
| **静态分发** | 无法根据任务特性动态选择路径 | 简单变更也必须走全流程 |
| **单线执行** | 没有探索/并行/回溯能力 | 设计阶段无法多角度探索 |
| **决策外包** | LLM 只能遵循，不能提出变更流程建议 | 需要用户手动判断"是否需要走 hotfix 预设" |

---

## 2. Claude Code Dynamic Workflows 调研

### 2.1 核心理念

> "Claude can now write and orchestrate its own multi-agent harness on the fly."

不是人提前写好固定流水线，而是 Claude 根据当次任务的特征**动态生成 Harness**，调度几十到上百个独立上下文子 Agent 并行工作。

### 2.2 解决的三类失败模式

| 失败模式 | 描述 | 动态解法 |
|---------|------|---------|
| Agentic Laziness | 复杂任务做了一部分就宣布完成 | 多子 Agent 各自聚焦子目标 |
| Self-preferential Bias | 自己生成、自己验证时偏向认可自己 | 对抗验证子 Agent |
| Goal Drift | 多轮 compaction 后原始约束和边界丢失 | 独立上下文、聚焦子目标 |

### 2.3 六种模式

| 模式 | 适用场景 | 工作方式 |
|------|---------|---------|
| Fan-out / Fan-in | 多文件独立修改 | 多个子 Agent 各自修改不同文件 → 汇总验证 |
| Pipeline | 强依赖串行 | 输出接力，前一个 Agent 产出是后一个的输入 |
| Map-Reduce | 大规模批量处理 | 分散处理 → 聚合结果 |
| Parallel Explore | 需要多角度探索 | 同时从多个方向尝试 → 比较收敛 |
| Iterative Refinement | 需要反复打磨 | 循环改进直到指标达标 |
| Adversarial | 高风险决策 | 红队对抗蓝队，交叉验证 |

### 2.4 与 MumuSpec 的对应关系

| Claude 模式 | MumuSpec 等价（现状） | 差距 |
|-------------|----------------------|------|
| Fan-out / Fan-in | 无 | Mumuspec 无子 Agent 机制 |
| Pipeline | Pipeline 隐含在 Phase 链中 | 无法动态选择或重组 |
| Map-Reduce | 无 | 无批量处理能力 |
| Parallel Explore | Hyperplan 仅做对抗审查 | 无法在 design 阶段生成并对比多个方案 |
| Iterative Refinement | Iterate on failure（rollback） | 仅失败时回退，不主动迭代打磨 |
| Adversarial | Hyperplan 有点类似 | 深度不够，只是静态审查 |

---

## 3. 自由度差距分析

### 3.1 LLM 在当前工作流中的角色

```
当前：LLM = 执行者（Executor）
      - 读取 YAML/MD 指令
      - 按步骤执行
      - 遇到阻塞点等待用户
      - 不决策流程

目标：LLM = 编排者 + 执行者（Orchestrator + Executor）
      - 根据任务特征决策路径
      - 可提议跳过/合并/重组阶段
      - 可启动并行探索
      - 可在阻塞点提出解决建议
```

### 3.2 自由度等级模型

| Level | 名称 | 描述 | 示例 |
|-------|------|------|------|
| L0 | 纯执行 | LLM 按静态脚本执行 | **当前 MumuSpec 默认路径** |
| L1 | 建议 | LLM 可建议流程变更，但需用户审批 | LLM 判断 "这个 change 适合 tweak 而非 full" |
| L2 | 条件自主 | LLM 在规则集内自主决策路径 | 自动选择预设路径（hotfix/tweak/full） |
| L3 | 动态编排 | LLM 可动态生成子 Agent、并行探索 | 根据变更复杂度决定是否需要探索多方案 |
| L4 | 完全自主 | LLM 可创建全新工作流模式 | 遇到前所未有的任务形状时自创新路径 |

**当前 MumuSpec 处于 L0~L1 之间**：预设路径选择已有 L1 雏形（workflow.yaml 的条件分发），但主体仍是 L0。

---

## 4. 增强设计：增加 LLM 自由度

### 4.1 设计原则

1. **约束优先**：SHALL/SHALL NOT 约束不可违反，自由仅限于"如何满足约束"
2. **用户兜底**：L3+ 操作需显式用户确认，L1~L2 可静默
3. **渐进采用**：从 L1 起步，逐步开放到 L2/L3
4. **可观测**：所有自主决策写入 decisions.md，可追溯

### 4.2 Level 1 增强（建议模式）

#### 4.2.1 动态路径推荐

**位置**：`workflow.yaml` 分发阶段新增 `suggestion` 机制

**规则**：
```
LLM 在 Step 0（预设检测）时：
1. 评估变更规模（文件数 / 接口变更 / 风险等级）
2. 生成推荐路径 + 理由
3. 展示给用户：推荐 tweak，但检测到 5+ 文件 → 建议改为 full
4. 用户确认后进入实际路径
```

**实现**：
```yaml
# workflow.yaml 新增
suggestion:
  rules:
    - condition: "estimated_files <= 2 AND no_api_change"
      suggest: tweak
      confidence: high
      rationale: "变更范围小、无接口变更，适合 tweak 快速通道"
    - condition: "estimated_files <= 4 AND no_arch_change"
      suggest: hotfix
      confidence: medium
      rationale: "变更范围可控，可考虑 hotfix 跳过 Design"
    - condition: "cross_module = true OR new_public_api = true"
      suggest: full
      confidence: high
      rationale: "跨模块或新公共接口，必须完整设计"
```

#### 4.2.2 阻塞点自动建议

**位置**：各 phase 阻塞点（BP）处理逻辑

**规则**：
```
当阻塞点触发时，LLM 可以：
1. 分析阻塞原因
2. 提出 1-3 个解决选项
3. 推荐默认选项并说明理由
4. 等待用户选择或确认
```

### 4.3 Level 2 增强（条件自主）

#### 4.3.1 阶段压缩

LLM 在规则集内可自主决定跳过或合并阶段：

| 条件 | LLM 自主行为 |
|------|-------------|
| 变更 ≤ 2 文件 + 无新能力 | 自动以 tweak 执行，不询问 |
| 变更仅文档/注释 | 自动跳过 TDD 红绿循环 |
| 纯 bugfix + 根因已确认 | 可直接进入 RED 测试编写 |

**安全围栏**：
- 自主决策上限：tweak 范围内
- 任何跨模块/新接口/新依赖 → 必须升级确认
- 所有自主决策写入 `.mumuspec.yaml` 的 `auto_decisions` 字段

#### 4.3.2 Skill 自动装配

**当前**：Skill 在 workflow.yaml 中静态绑定到 phase

**增强**：LLM 根据上下文选择最合适的 Skill 组合

```
Build 阶段启动时：
  LLM 评估任务类型：
    - 涉及并发代码 → 自动加载 concurrency-patterns skill
    - 涉及新依赖 → 自动加载 dependency-management skill
    - 涉及 API 变更 → 自动加载 api-design skill
  加载后按需执行，不强制全部使用
```

### 4.4 Level 3 增强（动态编排）

#### 4.4.1 方案探索模式（对应 Parallel Explore）

**位置**：Design 阶段 Q2/Q3 探索激活时

**流程**：
```
Design 探索阶段：
1. LLM 识别需要探索的维度（架构模式 / 实现方案 / 技术选型）
2. 为每个维度创建独立的探索上下文（Sub-Agent / 独立会话）
3. 各维度独立加载相关 knowledge + skill
4. 产出各自的方案草稿
5. LLM 汇总对比，生成对比报告
6. 用户选择或 LLM 给出推荐
```

**触发条件**：
- Hyperplan 检测到 3+ 个未解决问题
- 变更涉及新能力（非修复）
- 用户明确要求多角度探索

#### 4.4.2 红队/蓝队对抗（对应 Adversarial）

**位置**：Verify 阶段

**流程**：
```
Verify 阶段：
1. LLM 生成变更的实现摘要
2. 蓝队：从 spec 出发，验证实现满足所有 SHALL
3. 红队：尝试找到违反 SHALL NOT 的场景
4. 对抗收敛后输出最终验证报告
```

### 4.5 增强后的工作流总览

```
用户请求
    ↓
Step 0: LLM 意图识别 + 规模评估
    ↓
Step 1: 路径推荐（L1）← 新增
    ↓
用户确认 / L2 自动选择
    ↓
┌──────────────────────────────────────┐
│  Phase 执行（增强）                    │
│                                      │
│  - 阻塞点：LLM 建议 + 自动解决尝试     │
│  - Skill：LLM 动态装配                │
│  - 设计探索：可选 Parallel Explore    │
│  - 阶段压缩：条件触发自动 skip         │
└──────────────────────────────────────┘
    ↓
决策审计日志 → decisions.md
```

---

## 5. 实施优先级

| 优先级 | 增强项 | Level | 实施复杂度 | 价值 |
|--------|--------|-------|-----------|------|
| P0 | 动态路径推荐 | L1 | 低 | 高 |
| P1 | 阻塞点自动建议 | L1 | 低 | 高 |
| P2 | 阶段压缩逻辑 | L2 | 中 | 高 |
| P3 | Skill 自动装配 | L2 | 中 | 中 |
| P4 | 方案探索模式 | L3 | 高 | 中 |
| P5 | 红蓝对抗验证 | L3 | 高 | 中 |

**推荐实施顺序**：P0 → P1 → P2 → P3 → P4 → P5

---

## 6. 安全约束（新增 SHALL NOT）

| 编号 | 约束 |
|------|------|
| S-N-027 | LLM **不得**在未经用户确认时跳过 Design 阶段（tweak 预设除外） |
| S-N-028 | LLM **不得**自主决定绕过任何 BP-9 ~ BP-16 阻塞点 |
| S-N-029 | LLM **不得**自行修改 workflow.yaml 的分发规则 |
| S-N-030 | LLM **不得**在 Archive 阶段自动执行任何不可逆操作 |
| S-N-031 | LLM 自主决策 **必须** 写入 decisions.md 审计日志 |

---

## 7. 验收标准

1. LLM 能在 Open 阶段开始时推荐 hotfix/tweak/full 路径并说明理由
2. LLM 能在阻塞点提出 2-3 个解决选项供用户选择
3. LLM 能在规则集内自动选择 tweak 范围变更的压缩执行
4. LLM 的 Skill 加载列表根据任务上下文动态变化
5. 运行 `mumuspec decisions <change-name>` 可查看自主决策日志
