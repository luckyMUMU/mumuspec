# Proposal: introduce-ua-design

## Why

MumuSpec 的 Knowledge Layer 已经定义了 Knowledge Page 数据模型、LLM-Wiki 知识库、PageIndex 索引系统和新鲜度管理机制。但在实际使用中存在以下缺口：

1. **变更影响不自知**：开发者修改代码时，无法快速获知本次修改会影响哪些已有决策（Knowledge Page），容易无意中偏离架构决策。
2. **新人入职门槛高**：新成员面对代码库时，缺少基于代码拓扑结构的引导式学习路径，只能盲目阅读代码。
3. **知识维护成本高**：Knowledge Page 的 `verified_at` 需要手动刷新，过期知识不能自动检测。
4. **知识覆盖盲区**：无法识别哪些核心代码缺少知识页面覆盖。

Understand-Anything（72k+ Stars）通过 Tree-sitter 静态解析 + LLM 语义理解的混合架构，完美解决了上述问题。本变更引入其核心设计理念，增强 MumuSpec Knowledge Layer 的实用性。

## What

引入 4 个核心能力：

### A. Diff 影响分析 + 知识预警
- 新增 `mumuspec impact` 命令
- 分析未提交变更对代码结构的影响范围
- 自动关联已有 Knowledge Page，生成预警（如"本次修改可能影响 Saga 补偿事务决策"）
- 提供回归测试范围建议

### B. Onboarding 引导式学习路径
- 新增 `mumuspec onboard` 命令族
- 基于代码拓扑依赖排序生成学习路径
- 终端交互式浏览 UI
- 进度持久化

### C. Git 提交增量知识更新
- post-commit hook 自动刷新受影响 Knowledge Page 的 `verified_at`
- 提交消息支持 `Knowledge-Impact` 语法（VERIFY/AFFECTS/SUPERSEDES）
- 代码偏离决策自动检测

### D. 知识覆盖度分析
- 新增 `mumuspec knowledge coverage / gaps` 命令
- 识别缺少知识覆盖的重要代码
- 按重要度排序输出覆盖缺口

## Impact Scope

- `src/knowledge/manager.ts` — 新增 analyzeImpact、generateOnboardingPath、analyzeCoverage 函数
- `src/cli.ts` — 新增 impact / onboard / knowledge coverage / knowledge gaps 子命令
- `src/hooks/guard.ts` — post-commit 增量更新、Knowledge-Impact 解析
- `src/core/types.ts` — 新增 LearningPath、CoverageReport、ImpactAnalysis 类型
- `src/mcp-server.ts` — 新增 analyze_impact、generate_onboarding_path、get_knowledge_coverage MCP 工具

## Constraints

- 增量更新 MUST NOT 需要重跑 LLM 分析流水线
- Dashboard MUST NOT 成为核心依赖（CLI-first）
- post-commit hook MUST 在 500ms 内完成（避免阻塞提交流程）

## Workflow

full
