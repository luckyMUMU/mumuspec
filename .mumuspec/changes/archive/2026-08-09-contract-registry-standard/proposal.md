# Proposal: Contract Registry 标准化（R-0006）

## 背景

MumuSpec 已有完整的契约漂移检测引擎（contract/validator.ts），但输出格式是内部自订的。R-0006 将其标准化为 SARIF（IDE/CI 通用）和 JSON Schema（机器可读），并向 MCP 工作组提交标准化提案。

## 范围

### 包含
- Contract Registry JSON Schema（contract-registry-schema.json）
- Drift Report JSON Schema（drift-report-schema.json）
- SARIF 2.1 适配器（内部 DriftReport → SARIF）
- Problem Matcher 输出格式（VS Code 原生消费）
- Migration Guide 文档
- MCP Tool Schema proposal 文档

### 不包含
- PDF / HTML 审计报告（R-0006 scope 精简，与 R-0002 HTML reporter 复用）
- ESLint Plugin 互操作适配
- Audit Log 跨变更聚合 Dashboard
- 创立新标准组织

## 工作量

capacity_cost: 3（精简后 ≈ 5-8 人天，标准化输出为主）
