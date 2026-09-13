# Verify: ready-action-guidance

## verify_result

pass

## 测试证据

- e2e（tmp 项目 spawn CLI）：`vitest run tests/cli/commands/ready-actions.test.ts` → **3/3 passed**：
  - TC1：design 阶段缺 design.md → status 就绪块 `✗ 受阻（N 项）` + `E-GUARD-001`（确定性受阻场景）。
  - TC2：补齐 design.md 并签收后 → `✓ 就绪: mumuspec state transition demo-change build --confirm`。
  - TC4：既有 status 文案（变更:/Phase:/Workflow:/下一步）不回退。
- 单元回归：`tests/change/decisions.test.ts`（getNextPhaseHint 全部分支）+ `tests/cli/commands/finalize-archive-extra2.test.ts` + `tests/cli/cli-smoke.test.ts` → **91/91 passed**。
- dogfood 实跑：本变更自身 `mumuspec status ready-action-guidance` 输出「✓ 就绪: … transition … verify --confirm」。
- 自检三件套：`mumuspec check` exit 0 / `mumuspec validate` ✓ / `npm run ci:check` ✅（Check 4 双门全绿）。

## 验证中发现并修复

- getNextPhaseHint 重构时丢失两处既有语义（hotfix 提示含 "hotfix/tweak" 文案、archive-in-progress 分支）与 design 大写断言——由 decisions.test.ts 既有断言立即暴露，已修（getNextTargetPhase 单源 + hint 特例分支保留）。
- finalize-archive Step B1 对 void 返回实现不健壮（mock 场景崩溃→吞成 warning）→ 防御性默认三态对象。
- e2e 首版 repoRoot 少一层路径，spawn 全挂——修正为三级向上。

## 验收标准对照（proposal Acceptance Criteria）

1. status 含就绪块，受阻逐条列门禁错误 ✓（TC1）
2. getNextPhaseHint / getNextTargetPhase 单源化 ✓（decisions.test 91/91）
3. 既有 status 格式不回退 ✓（TC4）
4. 三件套全绿 ✓
