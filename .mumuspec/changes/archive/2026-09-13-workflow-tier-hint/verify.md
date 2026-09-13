# Verify: workflow-tier-hint

## verify_result

pass

## 测试证据

- 回归：`vitest run tests/cli/commands/ready-actions.test.ts tests/change/decisions.test.ts` → 2 files / **48 tests passed**（new 输出区改动未破坏 ready-actions e2e 与 hint 单元断言）。
- dogfood 实跑（TC1）：`mumuspec new tier-probe --files 1`（full 默认档 + 小信号）→ 输出
  `Recommended: tweak (85%)` + `⚠ 规模建议: tweak —— Small change…` + `如需调整: … discard … --workflow tweak 重建`；探针已 discard 清理。
- 自检三件套：`mumuspec check` exit 0（drift OK）/ `npm run ci:check` ✅（Check 4 双门）/ validate 前轮已验 ✓。
- TC2（档位一致 → ✓ 档位匹配）与 TC3（无信号无提示）由代码路径直读：提示块整体位于 hasScopeSignals 分支内，else 分支输出匹配行——同构逻辑，与 TC1 共用同一 diff 面。

## 验收标准对照（proposal Acceptance Criteria）

1. 失配 → ⚠ 规模建议行 + 调整指引 ✓（dogfood）
2. 一致 → ✓ 档位匹配 ✓（else 分支）
3. 无信号 → 无提示 ✓（hasScopeSignals 门控）
4. 三件套不回退 ✓
