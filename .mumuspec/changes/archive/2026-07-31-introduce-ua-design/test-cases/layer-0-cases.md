# Layer 0 — 根层测试用例

> 类型: TDD 测试用例 | 层级: Level 0 (类型定义 + core 函数)

---

## TC-0-01: ImpactAnalysis 类型完整性

**Given**: 新类型 `ImpactAnalysis` 定义
**When**: TypeScript 编译
**Then**:
- ImpactAnalysis 包含 `generated_at`, `diff_range`, `changed_files`, `direct_impact`, `indirect_impact`, `knowledge_warnings`, `recommendations`
- ChangedFile 包含 `path`, `change_type`, `lines_changed`
- ImpactNode 包含 `node_path`, `node_type`, `distance`, `dependents?`, `impacted_specs?`, `impacted_knowledge?`
- KnowledgeWarning 包含 `knowledge_id`, `warning_type`, `message`, `suggestion`, `severity`

---

## TC-0-02: LearningPath 类型完整性

**Given**: 新类型 `LearningPath` 定义
**When**: TypeScript 编译
**Then**:
- LearningPath 包含 `scope`, `generated_at`, `generated_for`, `steps`, `total_steps`, `estimated_minutes`
- LearningStep 包含 `order`, `code_node`, `code_node_type`, `reason`, `knowledge_pages`, `learning_objectives`, `check_questions`

---

## TC-0-03: CoverageReport 类型完整性

**Given**: 新类型 `CoverageReport` 定义
**When**: TypeScript 编译
**Then**:
- CoverageReport 包含 `scope`, `generated_at`, `coverage`, `gaps`, `overloads`
- CoverageStats 包含 `total_code_nodes`, `covered_nodes`, `coverage_ratio`, `by_type`
- CoverageGap 包含 `node`, `node_type`, `importance`, `suggested_type`

---

## TC-0-04: analyzeImpact 基础功能（有 Code Graph）

**Given**: 存在 Code Graph 适配器，变更文件 A 调用了 B
**When**: 调用 `analyzeImpact()` 分析变更
**Then**:
- `changed_files` 包含文件 A
- `direct_impact` 包含 B（distance=1）
- 返回完整 ImpactAnalysis 结构

---

## TC-0-05: analyzeImpact 降级模式（无 Code Graph）

**Given**: Code Graph 不可用
**When**: 调用 `analyzeImpact()`
**Then**:
- 降级为仅使用 Reverse Index
- 输出 WARN: "Code Graph 不可用，降级为 1 跳分析"
- `direct_impact` 包含 Reverse Index 查到的关联节点
- `indirect_impact` 为空

---

## TC-0-06: analyzeImpact 知识预警

**Given**: 变更文件关联到 Knowledge Page KP-0007（Saga 决策）
**When**: 调用 `analyzeImpact({ withKnowledge: true })`
**Then**:
- `knowledge_warnings` 包含 KP-0007 的预警
- warning_type = "SCOPE_OVERLAP"
- severity = "high"（因为 Saga 是核心架构决策）

---

## TC-0-07: generateOnboardingPath 拓扑排序

**Given**: src/payment 模块，3 个文件有依赖关系：routes → service → repository
**When**: 调用 `generateOnboardingPath("src/payment", "junior")`
**Then**:
- steps 按依赖顺序排列：routes 在前（入口），repository 在后（底层）
- 每步关联 Knowledge Page（如 KP-0007）
- generated_for = "junior"

---

## TC-0-08: generateOnboardingPath 降级模式

**Given**: Code Graph 不可用
**When**: 调用 `generateOnboardingPath()`
**Then**:
- 使用文件系统目录结构近似排序
- Output WARN: "使用近似排序，建议安装 Code Graph"

---

## TC-0-09: analyzeCoverage 覆盖度计算

**Given**: 代码图谱有 100 个节点，Reverse Index 覆盖 60 个
**When**: 调用 `analyzeCoverage()`
**Then**:
- `coverage.total_code_nodes` = 100
- `coverage.coverage_ratio` = 0.6
- `gaps` 包含 40 个未覆盖节点，按 importance 降序

---

## TC-0-10: Knowledge-Impact 提交消息解析

**Given**: 提交消息包含 Knowledge-Impact 块
**When**: commit-msg hook 解析
**Then**:
- 正确解析 IMPLEMENTS/AFFECTS/SUPERSEDES
- 结果写入 `.commit-context.json`

---

## TC-0-11: post-commit Hook 增量更新

**Given**: 提交改变了 KP-0007 关联的代码
**When**: post-commit hook 触发
**Then**:
- KP-0007 的 `verified_at` 更新为当前时间
- 耗时 < 500ms

---

## TC-0-12: post-commit Hook 超时保护

**Given**: 知识库有 10000 个 Knowledge Page（极端场景）
**When**: post-commit hook 触发
**Then**:
- 500ms 内未完成则超时返回
- 写入 `.pending-update.json` 队列
- git commit 不阻塞
