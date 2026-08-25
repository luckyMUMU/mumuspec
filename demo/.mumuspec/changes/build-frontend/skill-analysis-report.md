# MumuSpec Skill 系统分析报告

> 基于 demo 项目 `build-frontend` 变更调研的完整实践

## 1. 问题全景

### 1.1 Required Skill 缺失清单

| Skill 名称 | 被谁引用 | required | 可用状态 | 影响 |
|-----------|---------|----------|---------|------|
| `brainstorming` | phase-open (Step 1), phase-design (Step 2.5) | true | ❌ 不存在 | 无法加载需求探索流程 |
| `gitnexus-impact-analysis` | phase-open (Step 3) | true | ❌ 不存在 | 无法执行代码影响分析 |
| `gitnexus-exploring` | phase-design (Q1 锚定) | true | ❌ 不存在 | 无法自动采集代码结构信息 |
| `using-git-worktrees` | phase-open (Step 6) | true | ❌ 不存在 | 无法创建隔离工作区 |
| `spec-driven-development` | phase-open (delta-specs) | true | ❌ 不存在 | 无法获得规范编写指导 |
| `writing-plans` | phase-build (Step 2) | true | ❌ 不存在 | 无法加载实现计划编写流程 |
| `grill-me` | phase-design (Step 2.5) | true | ❌ 不存在 | 无法执行共识追问 |
| `hyperplan` | phase-design (Step 4) | conditional | ❌ 不存在 | 无法执行对抗式审查 |
| `subagent-driven-development` | phase-design (Hyperplan) | true | ❌ 不存在 | 无法创建对抗团队 |
| `documentation-and-adrs` | phase-design (Step 8) | true | ❌ 不存在 | 无法获得决策记录指导 |

**结论**：phase-open 和 phase-design 中声明的 required skill **全部缺失**。

### 1.2 cognitive-map.yaml 格式错配

| 位置 | 文档中的格式 | 实际 guard 校验的格式 |
|------|------------|-------------------|
| phase-design skill（乔哈里窗变体） | `q1_anchors:`, `q2_questions:`, `q3_reasoning:`, `q4_blind_spots:` | — |
| portable-exe-packaging 真实文件 | `entries: []` + `quadrant: Q1/Q2/Q3/Q4` | ✓ 这才是被 guard 接受的格式 |
| 实现后的 cognitive-map.yaml（第一次） | `q1_anchors:`, `q2_questions:` 结构 | ✗ guard 报 "Q1 已知的已知为空" |

**问题**：phase-design skill 文档中描述的格式与实际生效的格式不一致。Agent 按照文档编写，但 guard 校验失败。

### 1.3 Guard 错误信息误导

```
mumuspec guard build-frontend build --apply
✗ Phase guard failed: build-frontend → build
  [E-DESIGN-001] cognitive-map.yaml 不存在    ← 文件确实存在
  [E-DESIGN-002] Q1 已知的已知为空           ← 原因是 YAML 格式不对
```

实际 guard 校验的是 `.mumuspec.yaml` 中的 `cognitive_framework` 字段值，而不是 `cognitive-map.yaml` 的内容。错误信息与根因不一致。

### 1.4 Guard vs State Transition 双重标准

```bash
mumuspec guard build-frontend build --apply  → 失败 (严格校验)
mumuspec state transition build-frontend verify --confirm  → 成功
```

两条路径的校验标准不统一。

## 2. 根因分析

### 2.1 Skill 生态断裂

MumuSpec 的设计理念是"编排器管 WHAT，外部 Skill 管 HOW"。但当 required skill 全部缺失时，这个设计就变成了"编排器定义了 WHAT，但没有 HOW 的执行者"。

当前系统缺少两类关键 skill：
- **认知层 skill**：brainstorming（需求探索）、grill-me（共识追问）
- **工具层 skill**：gitnexus 系列（代码图谱分析）、worktree 隔离、plans 编写

### 2.2 文档与实现脱节

`cognitive-map.yaml` 是 MumuSpec 的核心认知追踪文件，但其格式规范散落在：
- phase-design skill 文档（描述的是一种格式）
- portable-exe-packaging 变更的 YAML 文件（实际是另一种格式）
- `mumuspec status` 输出（读取的是 `.mumuspec.yaml` 的 `cognitive_framework` 字段）

三处信息不一致，Agent 无从判断正确格式。

### 2.3 降级策略缺失

phase-open 明确要求"加载 brainstorming skill"，但没有定义：
- skill 不存在时怎么做？
- 有哪些内置的 fallback 步骤？
- 如何保证流程完整性？

## 3. 影响评估

| 维度 | 严重程度 | 说明 |
|------|---------|------|
| 流程完整性 | 🔴 高 | required skill 全缺导致设计阶段形同虚设 |
| 用户体验 | 🔴 高 | Agent 需要大量自行摸索，额外消耗大量 token |
| 规范准确性 | 🟡 中 | 认知地图格式错配导致返工 |
| CLI 工具一致性 | 🟡 中 | guard 与 state 标准不统一 |
| 可信度 | 🟡 中 | 多次失败后用户对系统产生怀疑 |

## 4. 改进优先级

```
P0 — 立即可做
  ├── 创建 cognitive-map.yaml 模板（解决格式错配）
  └── 改进 guard 错误信息（准确指向根因）

P1 — 短期
  ├── 为 phase-open / phase-design 添加 inline fallback
  └── 统一 guard 与 state 的校验逻辑

P2 — 中期
  ├── 创建核心内置 skill（brainstorming、writing-plans）
  └── 模板自动生成（mumuspec new 时生成符合格式的工件）

P3 — 长期
  ├── 建立 skill 注册表和健康检查
  └── worktree 隔离在 Windows 上的稳定性改进
```

## 5. 附录：实际使用命令对照

| 预期命令 | 实际行为 | 备注 |
|---------|---------|------|
| `mumuspec context --scopes public,scripts` | error: unknown option '--scopes' | 使用 `mumuspec knowledge context .` |
| `mumuspec impact` | "No changes detected" | 需要不同的调用上下文 |
| `mumuspec contract list` | Invalid command: contract list | 命令不存在 |
| `mumuspec guard build-frontend open --apply` | 报"未知阶段: open" | 需要用 `mumuspec state transition` |
