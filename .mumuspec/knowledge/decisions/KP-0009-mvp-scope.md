---
# === 标识 ===
id: "KP-0009"
title: "Phase 1 MVP 范围收敛决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-24T00:00:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.11.0-mvp-scope"
source_phase: "design"
source_artifact: "overview.md#71-mvp-范围"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["mvp", "scope", "phase1", "prioritization"]
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

MumuSpec 六层架构设计完备（100%），但实现进度约 5%。需明确 Phase 1 MVP 的核心能力边界，聚焦最小可工作集。

## 决策

Phase 1 MVP SHALL 仅包含以下核心能力：

### Phase 1 MVP 包含

| 层 | 包含 | 推迟 |
|----|------|------|
| **Spec Layer** | 树状规范 + SHALL/SHALL NOT + 渐进式披露 | Ponytail 编码约束（Phase 2） |
| **Change Layer** | 五阶段状态机 + 基础回退 | TDD 强制、认知框架（Phase 2，可配置） |
| **Guard Layer** | Pre-commit SHALL NOT 检查 + 基础规范漂移（P0） | 全量漂移检测（Phase 4） |
| **AI Integration** | Rules 文件生成（CLAUDE.md/.cursorrules） + AI 工具适配层 | MCP Server、Skill Bridge（Phase 3） |

### Phase 1 MVP 推迟

- Ponytail 编码约束（Phase 2）
- 认知框架 Q1-Q4（Phase 2，默认关闭，用户显式开启）
- TDD 强制与测试不可变性（Phase 2，可配置）
- Contract Layer（Phase 3）
- Hyperplan 对抗式规划（Phase 5）
- Skill Bridge 外部生态兼容（Phase 3）
- Knowledge Layer 代码图谱（Phase 3）
- LLM-Wiki 与 PageIndex（Phase 3）

### 量化目标

| 维度 | 指标 | 目标值 |
|------|------|--------|
| **性能** | Pre-commit 检查耗时 | < 5s（1万文件） |
| **性能** | 规范加载 token 消耗 | 较全量加载减少 ≥ 60% |
| **质量** | SHALL NOT 违规阻断率 | 100% |
| **效率** | 变更回退率（rollback/total） | < 20% |
| **采纳** | `mumuspec init` 成功率 | ≥ 95% |
| **采纳** | 新项目首次变更完成时间 | < 30min（hotfix） |

## 影响

- 新用户首次使用 MVP 时，30 分钟内可完成首个变更（hotfix 路径）
- Phase 2-5 功能可渐进式解锁，降低初期学习曲线
- 每个 Phase 有明确的 DoD 验收标准

## 关联约束

- SHALL: Phase 1 MVP SHALL 通过 DoD 验收后才能进入 Phase 2
- SHALL NOT: Phase 1 实现不得超出 MVP 范围（防范围蔓延）
