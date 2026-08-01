# Change Decisions

## DEC-001: 采用 Understand-Anything 混合架构模式

**心理模型**: Tree-sitter + LLM 混合

**决策**: 借鉴 Understand-Anything 的 Tree-sitter 结构解析 + LLM 语义理解的混合架构。结构解析确保可复现性，语义理解捕获设计意图。

**结果**:
- impact 分析的直接影响通过 Reverse Index 确定性计算
- 知识预警的偏离判断通过 LLM 语义分析
- onboarding 路径排序通过代码图谱确定性 BFS

## DEC-002: CLI-First 设计原则

**心理模型**: boring over clever

**决策**: 新增的可视化功能（onboarding 交互式 UI）采用终端 UI，而非 Web GUI。Dashboard 作为可选浏览器模式。

**结果**:
- 符合 Mumuspec 现有 CLI 架构
- 降低用户安装和切换成本
- Web GUI 可作为后续扩展

## DEC-003: Post-Commit 增量更新非阻塞

**心理模型**: 知识维护成本最小化

**决策**: post-commit hook 采用非阻塞异步模式。超时 500ms 后强制终止，避免阻塞开发者的 Git 操作。

**结果**:
- 正常流程：获取变更 → 查 Reverse Index → 刷新 verified_at（< 200ms）
- 超时保护：超过 500ms 记录日志但不阻塞提交

---

## Design Phase 追加

## DEC-D-001: 完全依赖 Code Graph 适配器

**来源**: Q2-001

**决策**: impact 分析使用 Code Graph 适配器进行精确代码依赖追踪（CBM/CGC）。当 Code Graph 不可用时降级为 Reverse Index 1 跳分析 + WARN。

**理由**: 用户选择了最准确方案，即使需要外部依赖。

## DEC-D-002: Onboarding 两层排序策略

**来源**: Q2-002

**决策**: onboarding 拓扑排序采用两层模式：graph_bindings 初步排序 → Code Graph 子图精确化。

**理由**: 兼容无 Code Graph 场景，同时在有 Code Graph 时提供更精确的路径。

## DEC-D-003: 偏离检测可配置

**来源**: Q2-003

**决策**: 偏离检测可配置：默认规则检测（文件级匹配，快速），可选 LLM 增强（语义分析，准确）。

**理由**: 平衡速度和准确性，默认不阻塞 hook，需要准确性时可开启 LLM。

## DEC-D-004: 知识覆盖度 importance 公式

**来源**: Q2-004

**决策**: importance = backwardRefCount × graphBindingsCount（引用次数 × 关联代码节点数）。

**理由**: 加权评估知识价值，既考虑被引用频率又考虑关联范围。

## DEC-D-005: 新增 5 个 MCP 工具

**来源**: design.md Level 4

**决策**: 新增 analyze_impact / generate_onboarding_path / get_knowledge_coverage / find_knowledge_gaps / detect_decision_deviation 5 个 MCP 工具。

**理由**: AI Agent 在设计/实现阶段需要实时获取知识上下文，MCP 工具提供标准化接口。

## DEC-D-006: 知识图谱 JSON 向后兼容

**来源**: Q3-003

**决策**: 知识图谱 JSON 格式保持与现有 Knowledge Page graph_bindings 字段一致，可双向转换。

**理由**: 确保现有知识页面无需迁移即可享受新功能。

## DEC-D-007: Chat 采用关键词匹配而非 LLM

**来源**: user explicit instruction + ponytail 原则

**决策**: `mumuspec chat` 使用基于关键词的相关性评分算法（ID/标题/内容/标签匹配），不依赖外部 LLM 服务。

**理由**: 零依赖、确定性输出、即时响应。符合 boring over clever 原则。

## DEC-D-008: Dashboard 从 Knowledge Page 标签提取 Goals/Roadmap

**来源**: ponytail 原则

**决策**: Dashboard 的 Goals 和 Roadmap 信息从已有 Knowledge Page 的标签中提取（goal/vision/milestone / roadmap），不引入新的数据存储格式。

**理由**: 复用已有知识资产，开发者只需给 Knowledge Page 打上标签即可在 Dashboard 中自动展示。

## DEC-D-009: Dashboard 覆盖度来自 analyzeCoverage

**来源**: 已有函数复用

**决策**: Dashboard 的 Knowledge Coverage 统计复用 `analyzeCoverage()` 已有函数，计算 reverse index 覆盖率。

**理由**: 单一数据源，避免重复实现。

---

## Build Phase 追加

## DEC-B-001: Chat 相关性评分算法

**来源**: Q4-001

**决策**: Chat 使用多层加权评分：ID 完全匹配 (100) > 标题完全匹配 (80) > ID 包含 (50) > 标题包含 (40) > 标签匹配 (15) > 内容匹配 (20+2/词) > 标题词频 (10/词)。

**理由**: 精确匹配优先，ID 查询最高优先级满足常见使用场景。

## DEC-B-002: Dashboard Alerts 自动生成策略

**来源**: Q4-002

**决策**: Dashboard 自动生成三类告警：stale pages > 0、coverage gaps > 0、hooks 未安装。告警为提示性质，不阻断任何操作。

**理由**: 信息驱动而非阻断驱动，符合开发工具定位。
