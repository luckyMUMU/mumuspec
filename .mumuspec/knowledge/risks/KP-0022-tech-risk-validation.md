---
# === 标识 ===
id: "KP-0022"
title: "Top 3 技术风险验证 Sprint"
type: risk
status: confirmed
scope: "global"
created_at: "2026-07-29T00:00:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "risk-assessment"
source_phase: "design"
source_artifact: "docs/appendix/open-questions.md#top-3-技术风险验证"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["risk", "validation", "sprint", "ast", "performance", "conflict"]
related_pages:
  - "KP-0009"
  - "KP-0015"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q4"
  reasoning_chain: []
  confidence: high
---

## 背景

Phase 3 启动前需要验证三个关键技术不确定性，避免实现阶段返工。

## 风险识别

### 风险 1: 多语言 AST 解析抽象

**风险描述**: tree-sitter 是否能覆盖所有目标语言的 AST 解析需求？

**备选方案对比**:

| 方案 | 优势 | 劣势 | 覆盖语言 |
|------|------|------|----------|
| **tree-sitter** | 多语言、增量解析、性能好 | 需安装语法包 | 40+ 语言 |
| Babel + TypeScript | 深度支持 JS/TS | 仅 JS/TS | JS/TS |
| 各语言原生 AST | 解析最精确 | 维护成本高 | 取决于集成 |
| ripgrep + 正则 | 极轻量、无依赖 | 无法理解语义 | 任意文本 |

**验证 Sprint**:
- 周期: 3 天
- 内容: tree-sitter 解析 TypeScript + Java + Go 各 1000 文件
- 通过标准: 解析成功率 ≥ 95%，单文件解析 < 50ms
- 降级方案: 不支持的语言降级为文件级索引

### 风险 2: 10万文件图谱性能

**风险描述**: SQLite + 增量索引方案在大型代码库中是否满足性能要求？

**备选方案对比**:

| 方案 | 存储类型 | 查询性能 | 增量更新 | 运维成本 |
|------|---------|---------|---------|----------|
| **SQLite + 增量索引** | 嵌入式 | < 500ms | 支持 | 零 |
| Neo4j | 图数据库 | < 100ms | 需全量重建 | 高 |
| 内存图 + 持久化 | 内存 | < 50ms | 支持 | 低 |
| DuckDB + SQL 图查询 | 嵌入式分析 | < 200ms | 支持 | 零 |

**验证 Sprint**:
- 周期: 5 天
- 内容: 构造 10万文件模拟项目，测试全量/增量索引和查询延迟
- 通过标准: 全量索引 < 5min，增量索引 < 10s，查询 < 500ms
- 降级方案: 大型项目降级为文件级图谱

### 风险 3: 规范继承冲突检测

**风险描述**: 多层规范的 SHALL/SHALL NOT 冲突检测算法是否可行？

**备选方案对比**:

| 方案 | 检测能力 | 性能 | 实现复杂度 |
|------|---------|------|-----------|
| **规则匹配** | 浅层冲突检测 | < 100ms | 低 |
| 语义对比 | 深层冲突检测 | < 1s | 中 |
| SAT 求解器 | 完整可满足性检查 | NP-hard | 高 |
| AI 辅助检测 | 语义级冲突检测 | < 5s | 依赖外部 API |

**验证 Sprint**:
- 周期: 2 天
- 内容: 构造 20 组冲突/不冲突的 SHALL+SHALL NOT 对，测试规则匹配准确率
- 通过标准: 规则匹配准确率 ≥ 80%（剩余通过 AI 辅助补充）
- 降级方案: 冲突检测降级为 WARN 级别

## 影响

- 风险 1 决策截止时间: Phase 3 启动前 3 周
- 风险 2 决策截止时间: Phase 3 启动前 5 周
- 风险 3 决策截止时间: Phase 1 启动前 2 周

## 关联约束

- SHALL: 每个验证 Sprint SHALL 产出明确的"通过/不通过"结论
- SHALL: 不通过的风险 SHALL 启用降级方案或调整架构决策
