# Design: ci-drift-gate

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

ci-check.mjs 追加 Check 4「Spec Enforcement Gate」，将引擎两道既有强制门（check / validate）纳入 CI 结论，不新增引擎能力、不新增错误码。

## 实现

### Check 4 结构（scripts/ci-check.mjs）

```js
function runGate(args) {
  const res = spawnSync(process.execPath, [join(root, 'dist/cli.js'), ...args], {
    encoding: 'utf8', cwd: root, timeout: 120_000,
  });
  // stdout 首个 '{' 起解析 JSON；解析失败按 fail 处理（不可判定 = 不通过）
}
```

1. `dist/cli.js` 不存在 → `fail('dist/cli.js 不存在 — 先运行 npm run build')`，跳过两门（fail 已计入总数，结论必红）。
2. `check --json`：解析 `{ passed, errors, warnings }`（取 JSON 起始 `{`，容忍前置文本）；`passed !== true` → 逐条 `fail('[check] <code> <message>')`；仅 warnings → 逐条 warn。
3. `validate --json`：同构处理（其 JSON 顶层为 passed/errors/warnings）。
4. spawnSync 非 0 退出但 JSON 可解析 → 以 JSON 结论为准（exit code 由 `process.exit(1)` 产生，语义一致）。
5. spawnSync error/timeout（无 JSON）→ fail 原因字符串。
6. 小节标题与现有 `console.log('\n📋 ...')` 风格一致。

### 决策点

- **dist 缺失 fail 而非 warn**：门禁可静默跳过等于无门禁（fail-open 禁止）；fresh clone 需先 build，属可接受前置。
- **JSON 解析失败按 fail**：输出不可判定时不得默认通过。
- **不并跑**：check 与 validate 串行执行，避免 I/O 竞争影响结论稳定性。
- **不将 Ponytail/glossary 等可选检查纳入**（YAGNI，保持 --json 基础面）。

## 不做什么

- 不改 check/validate 引擎逻辑与输出格式。
- 不新增错误码（结论复用既有码，经 ci:check 通道透出）。
- 不动 vitest 套件（ci:check 属 CI 脚本层，无对应单测面；验证方式为自举实跑 + 负向场景手工复现）。

## 测试用例（verify 阶段执行）

1. TC1 自举：本仓库 `npm run ci:check` 全绿（check/validate 均过）。
2. TC2 负向：临时制造 spec error（改动后恢复）→ ci:check exit 1 且列出错误码。
3. TC3 dist 缺失：重命名 dist → ci:check fail 提示 build（后恢复）。
