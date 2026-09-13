# Proposal: ci-drift-gate

## Why

`npm run ci:check`（scripts/ci-check.mjs）目前只校验版本一致性、错误码文档漂移与 CHANGELOG 完整性，**不包含任何 spec 强制门禁**——`mumuspec check`（agents-hash 漂移 / SHALL 词法检查）与 `mumuspec validate`（E-SPEC-015 强制门、覆盖率）只在本地手动执行。spec 与实现漂移（如 AGENTS.md 过期触发 E-AGENTS-001）在 CI 层不可见，违反"漂移检测应可判定且不可绕过"的 enforcement 路线。

## What

scripts/ci-check.mjs 新增 Check 4「Spec Enforcement Gate」：

1. 以 `spawnSync(process.execPath)` 运行 `dist/cli.js check --json` 与 `dist/cli.js validate --json`，解析 JSON 输出的 errors/warnings。
2. check 或 validate 存在 error → CI fail（fail() 计入错误数）；warning 计入 warning 数。
3. `dist/cli.js` 不存在 → **fail**（提示先 `npm run build`）——enforcement 门禁不可静默跳过（fail-closed 纪律）。
4. 两命令均通过时输出 pass 行，保持现有输出风格。

## Impact Scope

- `scripts/ci-check.mjs` — 新增 Check 4
- 无 src/ 引擎改动；无新错误码（复用 check/validate 既有码）

## Acceptance Criteria

- `npm run ci:check` 在 check/validate 存在 error 时 exit 1 并输出具体错误码
- dist 缺失时 ci:check fail 且提示构建
- 本仓库当前状态下 `npm run ci:check` 全绿（自举通过）
- 三件套（check / validate / ci:check）不回退

## Workflow

full
