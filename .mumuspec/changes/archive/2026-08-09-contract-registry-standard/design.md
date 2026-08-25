# Design: Contract Registry 标准化（R-0006）

## 输出模块

### 1. JSON Schema
- `.mumuspec/contracts/standard/contract-registry-schema.json`
- `.mumuspec/contracts/standard/drift-report-schema.json`
- 用 ajv 校验输出

### 2. SARIF 2.1 适配器
- 文件: `src/contract/formatter/sarif.ts`
- 输入: DriftReport
- 输出: SARIF 2.1 JSON（tool.driver + results[]）

### 3. Problem Matcher 适配器
- 文件: `src/contract/formatter/problem-matcher.ts`
- 输入: DriftReport
- 输出: VS Code Problem Matcher 格式 JSON

### 4. CLI 扩展
- `mumuspec contract drift --format sarif`
- `mumuspec contract drift --format problem-matcher`

### 5. MCP 提案文档
- `docs/standards/mcp-guard-drift-proposal.md`

## 测试锁定

| TC | 描述 |
|----|------|
| TC-STD-01 | contract-registry-schema 校验有效 registry |
| TC-STD-02 | contract-registry-schema 拒绝无效 registry |
| TC-STD-03 | drift-report-schema 校验有效报告 |
| TC-STD-04 | SARIF 输出符合 2.1 schema |
| TC-STD-05 | Problem Matcher 输出格式正确 |
| TC-STD-06 | CLI --format sarif 输出有效 |
| TC-STD-07 | CLI --format problem-matcher 输出有效 |
| TC-STD-08 | 空 DriftReport → 空 SARIF results |
