---
id: "KE-introduce-ua-design-decisions"
title: "Knowledge extracted from introduce-ua-design"
type: decision
status: confirmed
scope: "introduce-ua-design"
merged_from:
  - KE-introduce-ua-design-d-arch
  - KE-introduce-ua-design-d-impact
  - KE-introduce-ua-design-d-onboarding
  - KE-introduce-ua-design-d-chat
  - KE-introduce-ua-design-d-dashboard
  - KE-introduce-ua-design-cm-patterns
---

# Knowledge Extracted: introduce-ua-design

## Context

引入 Understand-Anything (UA) 混合架构模式到 Knowledge Layer：Tree-sitter 结构解析 + LLM 语义理解。在 0.13.0 版本实现 impact 分析、onboarding 路径、git 增量更新、知识覆盖度分析、chat 问答、Dashboard 增强 6 大能力。

## Decisions

### DEC-001: 采用 Understand-Anything 混合架构模式
- **决策**: 借鉴 UA 的 Tree-sitter + LLM 混合架构。结构解析确保可复现性，语义理解捕获设计意图
- **确认**: Grill-Me 验证
- **结果**: impact 分析直接影响通过 Reverse Index 确定性计算；知识预警偏离判断通过 LLM 语义分析；onboarding 路径排序通过代码图谱确定性 BFS

### DEC-002: CLI-First 设计原则
- **决策**: 可视化功能采用终端 UI 而非 Web GUI；Dashboard 作为可选浏览器模式
- **理由**: boring over clever，降低安装和切换成本

### DEC-003: Post-Commit 增量更新非阻塞
- **决策**: post-commit hook 采用非阻塞异步模式。超时 500ms 后强制终止
- **理由**: 不能阻塞开发者的 Git 操作

### DEC-D-001: 完全依赖 Code Graph 适配器
- **决策**: impact 分析使用 Code Graph 适配器进行精确代码依赖追踪（CBM/CGC）。降级为 Reverse Index 1 跳分析 + WARN

### DEC-D-002: Onboarding 两层排序策略
- **决策**: graph_bindings 初步排序 → Code Graph 子图精确化

### DEC-D-003: 偏离检测可配置
- **决策**: 默认规则检测（文件级匹配），可选 LLM 增强（语义分析）

### DEC-D-004: 知识覆盖度 importance 公式
- **决策**: importance = backwardRefCount × graphBindingsCount

### DEC-D-006: 知识图谱 JSON 向后兼容
- **决策**: JSON 格式保持与现有 Knowledge Page graph_bindings 字段一致，可双向转换

### DEC-D-007: Chat 采用关键词匹配而非 LLM
- **决策**: mumuspec chat 使用多层加权评分（ID 完全匹配 100 > 标题完全匹配 80 > ID 包含 50 > 标题包含 40...）
- **理由**: 零依赖、确定性输出、即时响应

### DEC-D-008: Dashboard 从 Knowledge Page 标签提取 Goals/Roadmap
- **决策**: Goals/Roadmap 信息从已有 Knowledge Page 的标签中提取（goal/vision/milestone / roadmap）
- **理由**: 复用已有知识资产，无需新数据格式

## Patterns

### 影响分析架构 (ImpactAnalysis)

数据流: git diff → Reverse Index 查关联 Knowledge Page → Code Graph getDependents() BFS 3 跳 → 生成 Warning → 组装推荐

类型: ImpactAnalysis / ImpactNode / KnowledgeWarning / ImpactRecommendation

### 知识问答算法 (ChatAnswer)

多层加权评分: 完全 ID 匹配 (100) > 标题匹配 (80) > 内容匹配 (20+2/词) > 标签 (15)

### Dashboard 增强

面板组成: Active Change / Knowledge Coverage / Project Goals / Roadmap / Alerts / Hooks

## Lessons

- Tree-sitter + LLM 混合适合 MumuSpec 的 Knowledge Layer
- 两层 onboarding 排序平衡精确性与兼容性
- post-commit hook 必须有超时保护（500ms）
- Dashboard 的 Goals/Roadmap 来自已有知识标签，无需新建存储

## Risks

- Code Graph 未安装时降级需要 CLI WARN + 文档说明
- 大型代码库 BFS 超时需 max_nodes=1000 上限
- chat 关键词无匹配时需返回低置信度
