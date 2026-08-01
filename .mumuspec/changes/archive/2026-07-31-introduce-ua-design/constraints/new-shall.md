# 新增 SHALL 约束

## Impact Analysis
- SHALL: `mumuspec impact` SHALL 关联已有 Knowledge Page 并生成 warnings
- SHALL: 影响分析 SHALL 支持 `--diff` 参数指定 Git diff 范围
- SHALL: 影响分析 SHALL 支持 `--scope` 参数限定分析范围
- SHALL: 影响分析 JSON 输出 SHALL 符合 `ImpactAnalysis` schema

## Onboarding
- SHALL: `mumuspec onboard init` SHALL 基于代码拓扑生成学习路径
- SHALL: 学习路径 SHALL 按依赖顺序排列（入度为 0 的节点优先）
- SHALL: `mumuspec onboard start` SHALL 提供终端交互式浏览
- SHALL: 学习进度 SHALL 持久化到 `.mumuspec/onboarding/` 目录

## Git 增量更新
- SHALL: post-commit hook SHALL 增量更新受影响 Knowledge Page 的 `verified_at`
- SHALL: 提交消息 `Knowledge-Impact` 块 SHALL 被 commit-msg hook 解析
- SHALL: `IMPLEMENTS` 关联的知识页面 SHALL 自动刷新 verified_at
- SHALL: `AFFECTS` 关联的知识页面 SHALL 触发偏离检测

## 覆盖度分析
- SHALL: `mumuspec knowledge coverage` SHALL 计算 Knowledge Page 覆盖率
- SHALL: `mumuspec knowledge gaps` SHALL 按 importance 降序排列未覆盖节点
- SHALL: importance 计算 SHALL 基于入度和调用频率

## MCP 工具
- SHALL: MCP Server SHALL 提供 `analyze_impact` 工具
- SHALL: MCP Server SHALL 提供 `generate_onboarding_path` 工具
- SHALL: MCP Server SHALL 提供 `get_knowledge_coverage` 工具
- SHALL: MCP Server SHALL 提供 `find_knowledge_gaps` 工具
- SHALL: MCP Server SHALL 提供 `detect_decision_deviation` 工具
