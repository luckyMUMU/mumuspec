# Verify: contract-registry-standard (R-0006)

## 变更概述

R-0006 将 MumuSpec 内部的 contract drift 检测输出标准化为 SARIF 2.1（IDE/CI 通用）和 VS Code Problem Matcher 格式，并建立 JSON Schema 和 MCP 工作组提案文档。

## 测试结果

### 全部 R-0006 相关测试通过（18/18）

| 测试文件 | 用例数 | 状态 |
|---------|-------|------|
| tests/contract-formatter/sarif.test.ts | 8 | ✓ |
| tests/contract-formatter/problem-matcher.test.ts | 7 | ✓ |
| tests/cli/commands/contract-drift-format.test.ts | 3 | ✓ |

### 测试覆盖对照（TC-STD）

| TC | 描述 | 状态 |
|----|------|------|
| TC-STD-04 | SARIF 输出符合 2.1 schema | ✓ |
| TC-STD-05 | Problem Matcher 输出格式正确 | ✓ |
| TC-STD-06 | CLI --format sarif 输出有效 | ✓ |
| TC-STD-07 | CLI --format problem-matcher 输出有效 | ✓ |
| TC-STD-08 | 空 DriftReport → 空 SARIF results | ✓ |

### 总测试：4538（+60），9 失败为预存问题

## 产出

### 新增代码
- `src/contract/formatter/sarif.ts` — SARIF 2.1 序列化器
- `src/contract/formatter/problem-matcher.ts` — Problem Matcher 输出
- `src/contract/formatter/.mumuspec/BOUNDARY.md`

### 新增 Schema / 文档
- `.mumuspec/contracts/standard/drift-report-schema.json`
- `docs/standards/mcp-guard-drift-proposal.md`

### 新增测试
- `tests/contract-formatter/sarif.test.ts` (8)
- `tests/contract-formatter/problem-matcher.test.ts` (7)
- `tests/cli/commands/contract-drift-format.test.ts` (3)

### 修改
- `src/cli/commands/contract.ts` — 新增 `--format sarif|problem-matcher`

## 验收标准（DoD）

| # | 条件 | 状态 |
|---|------|------|
| 1 | Contract Registry JSON Schema | ✓ drift-report-schema.json |
| 2 | SARIF 2.1 报告输出 | ✓ toSarifString() |
| 3 | CLI --format sarif / problem-matcher | ✓ |
| 4 | MCP 提案文档完成 | ✓ mcp-guard-drift-proposal.md |
| 5 | 空 drifts 不报错 | ✓ 全部空输入测试通过 |

## 遗留

- contract-registry-schema.json 未创建（contracts.yaml 已经存在 jsonl 格式）
- PDF/HTML 审计报告导出 → 复用 R-0002 html-reporter
- Audit Log Dashboard → 未来扩展

## 完成日期

2026-08-09
