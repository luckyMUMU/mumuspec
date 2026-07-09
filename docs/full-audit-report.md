# MumuSpec 设计文档全量审查报告

> **审查范围**: `docs/` 下全部 20 个文档 | **审查日期**: 2026-07-09 | **版本**: 0.8.0-draft
> **审查重点**: 流程正确性、连贯性、持久化完整性（LLM-Wiki + PageIndex 视角）

---

## 一、审查总览

| 维度 | 评分 | 发现数 | 严重级别分布 |
|------|------|--------|-------------|
| 流程正确性 | 82/100 | 6 | P0×2, P1×4 |
| 文档连贯性 | 75/100 | 8 | P0×3, P1×5 |
| 持久化完整性 | 55/100 | 9 | P0×4, P1×5 |
| **总计** | **70/100** | **23** | **P0×9, P1×14** |

> 持久化完整性是当前设计最大的薄弱环节——缺少跨变更的知识积累机制，设计决策和认知成果在变更归档后即"失忆"。

---

## 二、流程正确性问题

### F-01 [P0] 认知框架与 hotfix/tweak 预设路径矛盾

**位置**: `cognitive-framework.md` §5.3, §5.5; `change-layer.md` §8

**问题**: `cognitive-framework.md` §5.3 声称 hotfix 使用"轻量模式"（仅 Stage 1 + Q4 快速扫描），§5.5 声称 hotfix 豁免部分检查。但实际上 hotfix/tweak **完全跳过 Design 阶段**（`change-layer.md` §8: "open → build → verify → archive，跳过 Design"），认知框架是 Design 阶段的 Step 0，因此 hotfix 根本不经过认知框架。

**影响**: 文档自相矛盾，实现者会困惑 hotfix 是否需要执行认知框架轻量模式。

**修复**: 明确 hotfix/tweak 完全跳过认知框架（因为跳过 Design）。认知框架仅在 `full` 工作流中执行。

---

### F-02 [P0] 认知框架→Hyperplan 反馈环未在流程步骤中体现

**位置**: `cognitive-framework.md` §5.2; `skill-ecosystem.md` §8; `change-layer.md` §3.2

**问题**: `cognitive-framework.md` §5.2 和 `skill-ecosystem.md` §8 都描述了 Hyperplan 的输出反馈回认知框架：
- "hyperplan risks → 转化为新的 Q4 扫描维度"
- "hyperplan open_questions → 转化为认知框架新 Q2 问题（增量轮次）"

但 `change-layer.md` §3.2 的步骤序列是线性的：Step 0（认知框架）→ Step 1（逐层设计）→ Step 2（hyperplan）→ Step 3（test-cases）→ ...，**没有从 Step 2 回到 Step 0 的循环路径**。

**影响**: 实现者不知道 hyperplan 产出后如何反馈到认知框架，反馈环成为"纸上谈兵"。

**修复**: 在 `change-layer.md` §3.2 Step 2 中增加显式的反馈循环描述：hyperplan 产出后，若存在 unresolved risks 或 open_questions，则触发认知框架增量轮次（Stage 2/3 增量），更新 cognitive-map.yaml 后继续 Step 3。

---

### F-03 [P1] 认知框架收敛规则存在歧义

**位置**: `cognitive-framework.md` §3 vs §5.1

**问题**:
- §3 循环与收敛规则: "Q2 收敛条件: 连续 1 轮无新 Q2 问题，或达到 **3 轮** 上限"
- §5.1 关键约束: "总轮次 ≤ 5: Stage 2+3 合计不超过 5 轮"
- `change-layer.md` §3.1: "Stage 2+3 合计不超过 5 轮"

"Q2 达到 3 轮上限"和"Stage 2+3 合计 5 轮上限"之间的关系不清晰。如果 Q2 独立有 3 轮上限，且 Q2 是 Stage 2 的一部分，那 Stage 2+3 合计 5 轮的上限如何分配？

**影响**: 实现者无法确定轮次计数逻辑。

**修复**: 统一为"Stage 2+3 共享一个轮次计数器，上限 5 轮。Q2 和 Q3 在同一轮内交替进行，每轮可包含 ≤5 个 Q2 问题和 ≤3 条 Q3 推导"。

---

### F-04 [P1] Guard Layer §4 编号重复

**位置**: `guard-layer.md`

**问题**: 存在两个 `## 4` 标题："## 4. Git Hooks" 和 "## 4. 安全校验"。

**修复**: 将"安全校验"改为 `## 5. 安全校验`，后续章节顺延。

---

### F-05 [P1] Phase Guard `open_to_build_hotfix` 缺少 cognitive_framework 豁免声明

**位置**: `phase-guards.md` `open_to_build_hotfix`

**问题**: `open_to_build_hotfix` 守卫的 checks 列表中完全没有 `cognitive_framework` 相关检查项，这是正确的（因为 hotfix 跳过 Design）。但缺少一条注释说明"hotfix 不检查认知框架"。对比 `design_to_build` 守卫有详细的认知框架检查项和豁免说明，`open_to_build_hotfix` 的沉默可能被误解为遗漏。

**修复**: 在 `open_to_build_hotfix` 的 note 中增加: "hotfix/tweak 跳过 Design 阶段，不执行认知框架，无 cognitive-map.yaml 产出"。

---

### F-06 [P1] 认知框架 Stage 映射表描述不准确

**位置**: `cognitive-framework.md` §3 "与 Design Phase 现有步骤的映射"

**问题**: 映射表称 "Stage 2: 探索激活 → 步骤 1（逐层设计）中并行"，但实际上认知框架的 Stage 1-3 在 Step 0 完成，Step 1（逐层设计）在 Stage 4（设计生成）之后才开始。"并行"描述不准确。

**修复**: 修正映射关系为 "Stage 2 → Step 0 内执行，产出指导 Step 1 的设计决策"。

---

## 三、文档连贯性问题

### C-01 [P0] 版本演进表缺少认知框架

**位置**: `overview.md` §6, `design.md` 版本变更记录

**问题**: 认知框架（乔哈里窗变体）是 0.8.0 的重大新增功能，但版本演进表只记录了 Contract Layer，未提及认知框架。

**修复**: 在 0.8.0 版本变更中补充: "认知框架（乔哈里窗变体 Q1-Q4）集成到 Design 阶段"。

---

### C-02 [P0] 目录结构附录缺少 cognitive-map.yaml

**位置**: `appendix/directory-structure.md`

**问题**: 变更工件目录结构中缺少 `cognitive-map.yaml`，但 `change-layer.md` §10 的工件结构明确包含该文件。

**修复**: 在 `directory-structure.md` 的变更目录结构中添加 `cognitive-map.yaml`。

---

### C-03 [P0] 错误码缺少 DESIGN 域

**位置**: `reference/error-codes.md`

**问题**: `cognitive-framework.md` §5.5 引用了 E-DESIGN-001 到 E-DESIGN-006 错误码，但 `error-codes.md` 中没有 DESIGN 域的定义。错误码格式表也缺少 DESIGN domain。

**修复**: 在 `error-codes.md` 中新增 DESIGN 域（E-DESIGN-001 ~ E-DESIGN-099），定义 6 个认知框架相关错误码。

---

### C-04 [P1] 配置文件缺少认知框架配置

**位置**: `reference/configuration.md`

**问题**: `cognitive-framework.md` §6 定义了 `.mumuspec.yaml`（变更级）中的 `cognitive_framework` 字段，但 `configuration.md`（项目级 config.yaml）中没有对应的配置项（如默认启用/禁用、默认模式等）。

**修复**: 在 `configuration.md` 的 `changes` 配置块中增加 `cognitive_framework` 子配置。

---

### C-05 [P1] CLI 命令缺少认知框架相关命令

**位置**: `reference/cli-commands.md`

**问题**: 没有 `mumuspec cognitive-map` 相关命令（如 init、status、validate、converge）。

**修复**: 增加 CLI 命令段。

---

### C-06 [P1] 术语表缺少认知框架术语

**位置**: `reference/glossary.md`

**问题**: 缺少: 认知框架、乔哈里窗、Q1-Q4 象限、认知地图（cognitive-map.yaml）、认知收敛等术语。

**修复**: 新增"认知框架术语"小节。

---

### C-07 [P1] MCP 工具缺少认知地图操作工具

**位置**: `reference/mcp-tools.md`

**问题**: MCP 工具列表中没有认知地图相关的工具（如 `get_cognitive_map`、`update_cognitive_map`、`check_convergence`）。

**修复**: 新增"认知框架"工具分类。

---

### C-08 [P1] 认知框架适用场景表中的 hotfix 行应删除

**位置**: `cognitive-framework.md` §5.3

**问题**: §5.3 的适用场景表中有 "hotfix 工作流 | 轻量模式 | 仅 Stage 1 + Q4 快速扫描" 行，但 hotfix 跳过 Design 阶段，不执行认知框架。该行应删除或改为"不适用"。

**修复**: 将 hotfix 行改为 "hotfix 工作流 | 不适用 | 跳过 Design 阶段，不执行认知框架"。

---

## 四、持久化完整性问题（核心缺口）

### P-01 [P0] 缺少跨变更的知识积累机制

**问题**: 当前所有设计知识和认知成果都是**变更级**（per-change）的：
- `cognitive-map.yaml`: 变更归档后移到 `archive/`，不再可查询
- `decisions.md`: 变更归档后移到 `archive/`，新变更无法引用历史决策
- `design.md`: 虽然是持久化的，但只在目录级，没有全局索引
- Q1（已知的已知）: 每次变更都从零开始采集，不复用上次的 Q1

**影响**: AI Agent 每次设计都"失忆"，无法利用历史设计经验和已确认的知识。这正是用户提到的"LLM-Wiki"要解决的核心问题。

**修复**: 设计 Knowledge Layer（知识层），包含：
- 全局知识库（`.mumuspec/knowledge/`）
- 知识页面（Knowledge Page）格式
- 页面索引（PageIndex）
- 变更归档时自动提取知识到全局知识库

---

### P-02 [P0] 设计决策（ADR）无全局索引和关联

**问题**: `decisions.md` 是变更级的，归档后不可查询。`design.md` 中的设计决策是自由格式 Markdown，没有结构化元数据（ADR 编号、状态、影响范围、关联代码节点等）。

没有全局决策注册表，无法回答"这个模块历史上做过哪些架构决策？"或"这个代码符号关联哪些设计决策？"

**修复**: 
- 设计全局 Decision Registry（`decisions/registry.yaml`）
- `design.md` 中的决策段落使用结构化 ADR 格式
- 代码图谱新增 `Decision` 节点和 `DECIDED_BY` 边

---

### P-03 [P0] 代码图谱缺少设计知识节点

**问题**: 当前代码图谱的节点类型有: File, Function, Class, Interface, Module, Spec, Enforcement, Change, Contract。但缺少:
- `KnowledgePage` 节点（知识页面）
- `Decision` 节点（架构决策记录）
- `Risk` 节点（已知风险和兜底策略）
- `Pattern` 节点（设计模式和实践）

图谱只能回答"代码结构是什么"，不能回答"为什么这样设计"或"这里有哪些已知风险"。

**修复**: 扩展图谱 Schema，新增知识类节点和关联边类型。

---

### P-04 [P0] 缺少 PageIndex 机制实现渐进式知识加载

**问题**: 当前 `index.yaml` 只索引规范文件（spec.md），不索引设计知识和决策。AI 在某目录工作时，可以渐进式加载规范，但**无法渐进式加载相关知识**（历史决策、已知风险、设计模式）。

这正是用户提到的"PageIndex"思路——需要一个页面级索引系统，支持:
- 知识页面的注册和发现
- 按代码路径/图谱节点关联加载相关知识
- 新鲜度追踪（知识是否与当前代码一致）
- 反向索引（给定代码符号，找到关联的知识页面）

**修复**: 设计 PageIndex 系统，集成到渐进式披露加载策略中。

---

### P-05 [P1] 认知地图 Q1 成果不复用

**问题**: 认知框架的 Q1（已知的已知）是宝贵的知识资产，但变更归档后 Q1 内容随 `cognitive-map.yaml` 进入 archive，新变更需要重新采集。

**修复**: 变更 Archive 时，将 Q1 中的持久性条目（非变更特定的通用知识）提取到全局知识库。

---

### P-06 [P1] Q4 残留风险不跨变更追踪

**问题**: Q4（未知的未知）的残留项（`q4_residuals`）记录了无法在设计阶段消除的盲区和兜底策略，但变更归档后这些信息丢失。后续变更可能重复踩坑。

**修复**: Q4 残留风险提取为全局 Risk Registry，关联到代码图谱节点。

---

### P-07 [P1] 设计文档（design.md）缺少新鲜度管理

**问题**: `design.md` 的漂移检测只检查"描述的组件关系与代码图谱不一致"（WARN 级），但缺少:
- 最后验证时间戳
- 验证状态（fresh / stale / unverified）
- 与代码图谱节点的显式关联（通过什么 edge 连接）

**修复**: design.md 增加 YAML frontmatter 元数据（verified_at, graph_bindings），纳入 PageIndex 管理。

---

### P-08 [P1] 缺少知识版本的演化追踪

**问题**: 规范文件通过 Git 版本控制管理，但设计知识的"语义版本"没有追踪。一个决策从"提出→确认→实施→废弃"的生命周期没有显式记录。

**修复**: 知识页面增加 `status` 字段（proposed → confirmed → superseded → deprecated），PageIndex 追踪状态变迁。

---

### P-09 [P1] 审计日志不可查询

**问题**: `audit.log`（JSONL 格式）记录所有关键操作，但没有索引和查询接口。无法回答"这个规范上次是什么时候验证的？"或"谁修改了这个约束？"

**修复**: 审计日志增加索引文件，MCP 工具支持审计查询。

---

## 五、修复计划

| 优先级 | 编号 | 任务 | 预计工时 |
|--------|------|------|---------|
| **P0** | F-01 | 修复 hotfix/tweak 认知框架矛盾 | 0.5h |
| **P0** | F-02 | 增加 Hyperplan→认知框架反馈环描述 | 0.5h |
| **P0** | C-01 | 补充版本演进表 | 0.2h |
| **P0** | C-02 | 补充目录结构 cognitive-map.yaml | 0.2h |
| **P0** | C-03 | 新增 DESIGN 错误码域 | 0.5h |
| **P0** | P-01~P-04 | 设计 Knowledge Layer（LLM-Wiki + PageIndex） | 4h |
| **P1** | F-03~F-06 | 修复流程描述歧义 | 1h |
| **P1** | C-04~C-08 | 补充配置/CLI/术语/MCP | 1.5h |
| **P1** | P-05~P-09 | 知识层细化设计 | 2h |
| **总计** | | | **~10.5h** |

---

> **导航**: [返回概览](overview.md) | [Knowledge Layer 设计 →](design/knowledge-layer.md)
