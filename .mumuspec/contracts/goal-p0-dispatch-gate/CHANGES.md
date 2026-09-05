# Goal P0 Dispatch Gate Contract Change Record

**日期**: 2026-09-01
**变更名称**: goal-p0-dispatch-gate
**版本**: 0.19.1 → 0.20.0（建议：分发层 +4 agent 与完备性门禁均属新能力）

---

## 变更摘要

双主线：A 分发层 canonical-first（AGENTS.md 唯一权威生成 + 薄壳桥接 + 4 个新 installer）；B 完备性门禁 v1（工件 schema v1 + artifact-validator + phase-guard 双挂钩）。

## 契约变更登记（C1–C4）

| ID | 契约变更 | 类型 | 影响面 | 裁决状态 |
|----|---------|------|--------|---------|
| C1 | `AgentType` 新增 `'codex' \| 'windsurf' \| 'gemini' \| 'copilot'` | additive | `src/install/installer-registry.ts` 枚举；`isAgentSupported`/`getSupportedAgents` 扩容至 10；`installPackage` switch 新增分支。上游消费者（CLI install/doctor/MCP）按 agent 名分发，新增值不改变既有 6 值语义 | 已征询，2026-09-01 用户裁决通过（D1–D4 裁决包） |
| C2 | `init` / `install` 开始生成 `AGENTS.md` + `CLAUDE.md` 薄壳（gemini 时 + `GEMINI.md`） | 新行为 | 用户项目根目录新增文件。冲突策略（D1 标记分路）：absent→create；managed（含标记头）→update；user→skip+warn+`--force-rules` 接管 | 已征询，2026-09-01 裁决通过 |
| C3 | **停止生成** `.cursorrules` / `.windsurfrules` | 行为移除（实为撤销宣称：生成器从未实现该目标） | 不生成、目标表不含、doctor 检测存量并给一次性迁移提示；停止生成 ≠ 删除存量 | 已征询，2026-09-01 裁决通过（D2：立即停止、不建迁移命令） |
| C4 | 变更目录新增 `open-questions.yaml` / `assumptions.yaml`（工件 schema version: 1） | additive（工件 schema 为对外格式契约） | 新文件由 LLM 在 design/build 阶段起草；guard 在 design→build / build→verify 消费（fail-closed，E-CHANGE-020/021）。schema 带 `version:` 字段保证向前兼容 | 已征询，2026-09-01 裁决通过 |

## 对外接口清单

| 接口 | 变更 | 版本标注 |
|------|------|---------|
| `AgentType`（installer-registry） | +4 枚举值 | additive |
| `AGENT_RULE_TARGETS`（installer-registry，新导出） | 声明式规则目标表：`{ rulesFile, bridges, skillsDir, marksManaged }` | 新增 |
| `renderRuleFiles(agent, ctx, opts)`（rules-generator，新导出） | 纯函数 → `{ path, content?, action: 'create'\|'update'\|'skip', diagnostics }[]` | 新增 |
| `validateArtifact(root, changeName, kind)`（artifact-validator，新导出） | 纯函数 → `{ isValid, errors: { code, path, message }[] }`，kind ∈ 'open-questions' \| 'assumptions' | 新增 |
| 错误码 E-CHANGE-020 / E-CHANGE-021（errors.ts） | 工件 schema 非法 / resolution 链断裂 | 新增，severity ERROR |
| guard design→build / build→verify | 新增工件门禁挂钩（只增不改） | 行为增强 |

## 不变量（红线）

1. LLM 完备性判定（advisory）不得单独放行门禁——双签 = 工件消解 + decisions.md 签收记录。
2. guard 不消费非法工件——拒绝执行而非降级（KP-0060 公理 3）。
3. 生成物永不覆盖用户手写文件（无 `--force-rules` 时）。
4. 机械四分类一票否决既有语义不动。

## 审计

| 时间 | 操作 | 执行者 |
|------|------|--------|
| 2026-09-01 | C1–C4 征询表闭合（D1–D4 裁决） | 韦优 + WorkBuddy |
| 2026-09-01 | design.md 确认，进入 build | 韦优 |
