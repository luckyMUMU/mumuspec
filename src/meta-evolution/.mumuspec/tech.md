---
layer: 2
scope: "src/meta-evolution"
last_updated: "2026-09-08"
doc_type: tech
---

# Technical Design: meta-evolution

## Requirement: Module Composition

### SHALL
- 五个子系统（scoring / knowledge-evolution / skill-recommender / impact-analysis / stats）经 index.ts barrel 统一导出
- stats.ts 的异步 IO 函数单独具名导出，不混入 `export *`

### SHALL NOT
- 禁止子系统间相互 import 形成环（统一经 barrel 或 types.ts 通信）

### Enforcement
- TECH-ME-1: index.ts 显式列出全部导出且无子系统环

## Requirement: Scoring Engine Purity

### SHALL
- computeScore / computeEffectivenessScores 为纯计算函数，输入配置化（ScoringConfig + DEFAULT_SCORING_CONFIG）
- generateReport 输出 EvolutionReport 结构，供 CLI 与 MCP 消费

### SHALL NOT
- 禁止评分函数内部执行文件 IO（IO 归 stats.ts）

### Enforcement
- TECH-ME-2: scoring.ts 无 fs import
- TECH-ME-3: 评分权重全部来自 ScoringConfig

## Requirement: Impact Anchors

### SHALL
- PRESERVATION_ANCHORS 显式列出不可破坏的架构锚点，analyzeImpact 以其为判定基准

### SHALL NOT
- 禁止 analyzeImpact 修改任何被分析的文件

### Enforcement
- TECH-ME-4: analyzeImpact 只读分析，输出 ImpactAnalysis + 格式化函数

## Requirement: Recommendation Feedback Loop

### SHALL
- recordRecommendationOutcome 落地每次采纳结果，getRecommendationAccuracy 由历史计算

### SHALL NOT
- 禁止推荐准确率绕过 outcome 记录直接返回常数

### Enforcement
- TECH-ME-5: 准确率 = adopted / total，来源为 outcome 记录

## 架构决策

- **读写分离**：评分/分析全部只读，唯一写路径是 stats.ts 与推荐 outcome 记录
- **数据驱动**：所有结论（评分、新鲜度、准确率）都有持久化数据支撑，杜绝拍脑袋
- **类型先行**：types.ts 集中定义 EffectivenessScore / EvolutionReport / KnowledgeEvolutionAction 等跨子系统契约
