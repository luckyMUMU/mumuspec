# Verify: spec-fence-guard

## verify_result

pass

## 测试证据

- **探针回归（TC1）**：修复前 dist parser 实测围栏内 `## Requirement: 示例约束` 被解析为真约束（2 requirements）；修复后 `parseRequirements` 同输入只解析出真实约束（2→1），围栏示例条目不再进入语料。
- **回归测试**：`vitest run tests/spec` → 11 files / **168 tests passed**（含新增 tests/spec/fence-guard.test.ts 4 例：围栏 Requirement 示例 / 围栏内 SHALL 段 / info string + ~~~ + 未闭合围栏 / 无围栏不变式 stripFencedBlocks(body)===body）。
- **存量语料不变式（TC4 真实库）**：本仓库 327 条约束 coverage 总数与修复前一致（declared_ratio 100%）——无围栏假阳性存量，剥离逻辑对正常语料零影响。
- 自检三件套：`mumuspec check` exit 0（drift OK）/ `mumuspec validate` ✓ / `npm run ci:check` ✅（Check 4 双门全绿）。

## 人工验证证据

- 单点接线确认：parser.ts 中 parsePrdFile / parseTechFile / parseSpecFile 三条路径均经 parseRequirements → 剥离逻辑一次覆盖全部消费者（validate / check / MCP context）。
- stripFencedBlocks 纯函数、无 I/O；未闭合围栏丢弃至结尾 = fail-closed（不可判定内容不进语料）。
- 消费者闭环：stripFencedBlocks 导出消费者为 parseRequirements 与回归测试（同批交付）。

## 验收标准对照（proposal Acceptance Criteria）

1. 围栏内示例不再被解析 ✓（TC1，探针 2→1）
2. 围栏外正常约束不受影响，存量 coverage 不变 ✓（327 条不变）
3. 围栏配对 / info string / 未闭合正确处理 ✓（TC3）
4. 三件套不回退 ✓
