---
layer: 2
scope: "src/meta-evolution"
last_updated: "2026-09-08"
doc_type: prd
---

# Product Requirements: meta-evolution

## 模块职责 (What this module does)

MumuSpec 的元进化层：让规范体系自身基于使用数据持续改进。

- `computeScore()` / `computeEffectivenessScores()` / `generateReport()` — 规范有效性评分引擎
- `analyzeFreshness()` / `analyzeAllFreshness()` / `refreshPageIndex()` — 知识层进化（R0）：新鲜度分析与页面索引刷新
- `recommendSkills()` / `recordRecommendationOutcome()` / `getRecommendationAccuracy()` — 技能推荐（R1）：带采纳率闭环追踪
- `analyzeImpact()` / `formatImpactAnalysis()` / `PRESERVATION_ANCHORS` — 变更影响分析与保留锚点
- `recordCheck()` / `readCheckRecords()` / `rotateStatsIfNeeded()` / `clearStats()` — 校验记录持久化（异步 IO + 轮转）

## 存在理由 (Why it exists)

规范不是一次性产物：哪些约束真正拦截过缺陷、哪些知识已过时、哪些技能推荐被采纳，
需要用数据回答。meta-evolution 把「规范是否有效」变成可度量、可评分、可反馈的问题。

## 用户场景 (User scenarios)

1. **有效性报告**：运行评分引擎生成 EvolutionReport，看到哪些约束被触发
2. **知识保鲜**：analyzeAllFreshness 找出过时知识页并触发刷新动作
3. **技能推荐闭环**：推荐技能给用户后记录采纳结果，用准确率修正后续推荐
4. **变更影响评估**：analyzeImpact 在动刀前指出哪些锚点不可破坏

## Requirement: Scoring & Reporting

### SHALL
- 评分必须基于持久化的 CheckRecord 数据，不得凭空编造分数

### SHALL NOT
- 禁止评分引擎修改被评分的规范文件本身

### Enforcement
- ME-1: computeEffectivenessScores 只读 CheckRecord 输入

## Requirement: Stats Persistence Discipline

### SHALL
- 校验记录必须落盘到 stats 文件并在超限时自动轮转

### SHALL NOT
- 禁止将校验记录写进变更工件或规范文件

### Enforcement
- ME-2: recordCheck 写入 getStatsFilePath 指定路径
- ME-3: rotateStatsIfNeeded 在记录超限时截断

## 验收标准 (Acceptance criteria)

- 评分、新鲜度、推荐三个子系统均可独立调用且类型完备
- 推荐采纳率可追踪、可清零（clearTracking）
- stats 文件超限自动轮转，不无限增长
