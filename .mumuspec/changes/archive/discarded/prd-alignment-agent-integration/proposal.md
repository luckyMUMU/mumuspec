# Proposal: prd-alignment-agent-integration

## Why

PRD 声明「渐进式披露」与「AGENTS.md canonical 分发」为核心能力，但实跑校验显示两条链路实际为空转：

- `mumuspec context <path>` 文本输出 7 行、零条约束（渐进式披露对 agent 不可用）
- 根 AGENTS.md「规范链摘要」为「尚未生成」，CLI 速查仅硬编码 8 条（实际注册 56 条）
- `mumuspec validate` 报 2 个 E-SPEC-010 ERROR 而 `check` 判定通过（门禁结论不一致）

根因有三：context 渲染未适配 0.19 起的 prd/tech 新格式；根 spec.md 被 loader 当作 tech.md 的回退文件跳过；归档 delta 合并原样搬运变更层 frontmatter 与未填写模板。

## What

1. **G1 context 渲染**：补齐 `layer.prd` / `layer.tech` 输出，与 JSON 通道同构。
2. **G1b 根全局 charter 加载**：根层（level 0）额外加载 spec.md；模块层保持回退语义。
3. **G2 规范链摘要**：改为结构摘要（层级 / 文档 / 条数）+ prohibitions 红线全文，不内联 SHALL 全文（遵守分发层「禁止内联全量规范」SHALL NOT）；init 与 install 两条链路均传入 specContext。
4. **G3 CLI 速查**：`renderCliCheatSheet(program)` 从命令注册表生成，CLI-first 命令置顶并展开子命令；`setCliCheatSheet()` 依赖倒置注入，使 install 路径与 init 同源。
5. **G4 归档合并净化**：`prepareChangeSpecContent()` 剥离变更层 frontmatter、拒绝未填写的模板占位符；清理根 prd.md / tech.md 已入库的占位符块。

## Impact Scope

- `src/cli/commands/spec.ts` — context 文本渲染
- `src/spec/loader.ts` — 根层 spec.md 加载
- `src/install/rules-generator.ts` — 规范链摘要 / CLI 速查注入点
- `src/install/installer-ops.ts` — install 链路 specContext
- `src/cli/capability.ts` — CLI 速查生成
- `src/cli/index.ts` — init 链路接线 + 注入
- `src/rules/generator.ts` — 参数透传
- `src/change/archive.ts` — 归档 delta 合并净化
- `.mumuspec/prd.md`、`.mumuspec/tech.md` — 清理归档带入的占位符块
- `AGENTS.md`、`CLAUDE.md` — 重新生成（managed 文件）

## Acceptance Criteria

- `mumuspec validate` 零 error，unverifiable 为 0
- `mumuspec context .` 输出含完整规范链（根层 94 SHALL / 56 SHALL NOT）
- AGENTS.md 四要素齐备，≤ 32KiB，CLI 速查覆盖全部注册命令
- 归档 delta 合并不再引入 parent_* 路径错位与占位符文本

## Workflow

full
