# Verify: ci-drift-gate

## verify_result

pass

## 测试证据（design.md TC1–TC3 全部执行）

- **TC1 自举绿**：`npm run ci:check`（含 Check 4 双门）→ `✓ check: 0 error(s)` / `✓ validate: 0 error(s)` / Results 0 error 0 warning / exit 0。
- **TC2 漂移红**：真实漂移态下（spec 内容 hash 与 agents-hash 不一致）`npm run ci:check` → **exit 1**，输出 `❌ [check] E-AGENTS-001 AGENTS.md↔spec 漂移`，Results 1 error；恢复（regen-rules.mjs）后复跑 exit 0。漂移在 CI 层不再不可见。
- **TC3 dist 缺失红**：临时重命名 dist → ci:check **exit 1**，输出 `❌ dist/cli.js 不存在 — spec 强制门禁不可静默跳过，先运行 npm run build`；恢复后绿。

## 验证过程中发现并修复的实现缺陷

初版 `runEngineGate` 假设 `check --json` 顶层为 `{errors, warnings}`，实际 schema 为
`{compliance:{errors,warnings}, drift:{errors,warnings}, exitCode}`——门禁 exit 1 但解析读出 0 错误、
误判为绿（fail-open）。已修复为双 schema 归一化 + `exitCode !== 0 且无明细 → 按失败处理`（不可判定 ≠ 绿）。
该缺陷由 TC2 首轮执行暴露，修复后 TC2f 复验红路径成立。

## 附带语义发现（记录，不在本变更处理）

- 解析器为带 legacy 自由文本 `### Enforcement` 段的 Requirement 附加 `implicit-manual`（ENF-1），
  其下 SHALL NOT 一律落 R3 manual —— E-SPEC-015 仅在无任何 Enforcement 通道时触发。
  这与「机械四分类的一票否决」直觉存在落差，建议在 A3（SHALL 结构校验）立项时裁决
  implicit-manual 是否应参与一票否决（已列入 review 改进计划上下文）。
- `mumuspec check` 的漂移检测覆盖根 spec.md 与模块 spec（probe 实测两者均可触发 exit 1）。

## 验收标准对照（proposal Acceptance Criteria）

1. check/validate 存在 error → ci:check exit 1 并列出错误码 ✓（TC2f：E-AGENTS-001 透出）
2. dist 缺失 → fail 且提示构建 ✓（TC3）
3. 当前仓库 ci:check 全绿 ✓（TC1b）
4. 三件套不回退 ✓（check exit 0 / validate 0 错 / ci:check 0 错 0 警）
