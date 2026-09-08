# Spec ↔ 代码校准报告（2026-09-05）

基线：`.mumuspec/spec.md`（12 个 Requirement 块）↔ `src/` 实现。dist 为编译产物，以 src 为准。

## 汇总

| 状态 | 数量 |
|------|------|
| 一致 | 22 |
| 部分实现 | 9 |
| 未实现 / 矛盾 | 14 |

## 逐块结果

| Spec 块 | 结论 | 关键证据 |
|---------|------|---------|
| Ponytail 基础编码约束 | 一致 | `src/spec/ponytail.ts:3-47` 七级阶梯；`src/guard/checker.ts:170-187`；MCP `check_compliance` ponytail 开关 |
| 临时目录管理规范 | 未实现 + 内部矛盾 | `src/core/structure-validator.ts:13-28` DEFINED_DIRECTORIES 不含 `temp`（temp 存在即 E-SPEC-013）；finalize-archive 无 temp 清理提示；`.mumuspec/audit.log` 实际违反白名单 |
| 项目结构规范 | 部分实现 | layer 数字校验 `src/spec/parser.ts:24`；scope 仅校验 string 非有效路径；SHALL→Enforcement 存在性无硬校验 |
| 变更管理 | 部分实现 | E-CHANGE-008 创建时拒绝 `src/change/lifecycle.ts:56-64`；Design/Build 阶段动态 overflow 检测未实现；finalize-archive 缺原子性/回滚、code-graph snapshot 占位空实现（`finalize-archive.ts:322-330`）、cache 陈旧项仅计数不删、无防重跑标记 |
| 术语表管理规范 | 未实现 + 路径矛盾 | `src/guard/glossary-checker.ts:60` 校验 `docs/reference/glossary.md`，非规范定义的 `.mumuspec/glossary.md`；三要素/新增命令同步校验均缺失 |
| 命令能力分层（Capability Tier） | 整块未实现 | 全 src 无 `CommandMetadata` 类型与 `capability` 命令；dry-run 仅散见 ad-hoc；不可逆确认用 `--confirm` 标志非输入变更名 |
| Verifier 语义与可验证性 | 部分实现 | `src/spec/verifier-classify.ts` 纯函数四分类 ✓；E-SPEC-015 `src/spec/errors.ts:129-139`、E-VERIFY-003 `:276-286` ✓；coverage 五桶在 validate + MCP 输出，`check --json` 缺第三处 |
| 流程执行载体（CLI-first） | 一致 | `tasks next`/`lock-suite`/`state layer`/`decisions append`/`state set` 均注册（`src/cli/commands/state.ts:601-660` 等）；E-CHANGE-007 篡改检测 `phase-guard.ts:258`；E-STATE-001 `state.ts:326-342`；hash 仅 CLI 写入 `lifecycle.ts:426,498` |
| 完备性门禁（结构化工件 + 双签） | 一致 | `src/change/artifact-validator.ts:98-146` schema+枚举+version 强制、resolved↔decisions 交叉断言 `:193-199`；guard open+无签收→block `phase-guard.ts:72-81`，fail-closed |
| 分发层 — AGENTS.md canonical | 部分实现 | 四要素 `src/install/rules-generator.ts:56-80` ✓；10 agent `installer-registry.ts:7-17` ✓；legacy 格式禁令 ✓；用户手写文件保护 `rules-generator.ts:93-102` ✓；32KiB 容量断言全仓缺失；GEMINI.md 缺 settings.json context.fileName 提示 |
| 分发层 — phase skill 平权 | 部分实现 | 仅 codex/windsurf/gemini/workbuddy 含五阶段 skill（`installer-registry.ts:151-169`）；claude/cursor/trae/opencode/catpaw 仅 mumuspec-workflow，copilot 仅声明位 |
| 规则-实现分离（KP-0060） | 一致（结构性） | verifier-classify、状态机边校验（E-CHANGE-006 `state-machine.ts:196-205`）、workflow 同构校验 `phase-graph-loader.ts:143` 均为"校验器先于消费者"实例 |

## 渐进式披露（跨块专项）

- **矛盾**：`src/spec/loader.ts:358-376` 硬编码 max 3 layers；`max_layer_depth` 配置项（`config.ts:97`）传入后命名为 `_maxDepth` 未使用——直接违反 spec「SHALL NOT hardcode a fixed number of layers」（spec 101/130 行）。

## init 行为

- 分布式生成顺序正确（tech 自底向上 `spec-scaffolder.ts:616-656`、prd 自顶向下 `:658-687`）；不覆盖已有文件、无交互 ✓。
- **矛盾**：`goal.md` / `env-spec.md` 仅在 `--distributed` 标志下生成（`src/cli/index.ts:370-405`），spec 要求 init 无条件创建。

## 版本规则

- 运行时一致性由 `src/cli/index.ts:77-84` 读 package.json 构造保证（当前 0.19.2-alpha.1）；`src/cli.ts` 无版本字面量，`archive.ts:56-63` 对 `.version()` 的改写为空操作——spec「同步更新 package.json 和 src/cli.ts 版本号」文本已过时，需校准为单一事实源。

## 问题清单（按优先级）

**P0 — SHALL 硬性缺口/矛盾**
1. Capability Tier 整块未实现（无 CommandMetadata / capability 命令 / 全局 dry-run 框架 / 名称二次确认）
2. loader 硬编码 3 层，`max_layer_depth` 形同虚设
3. TEMP-1/TEMP-3 未实现且与 structure-validator 自相矛盾（temp 目录被 E-SPEC-013 拒绝）
4. 32KiB Rules 容量断言缺失
5. phase skill 未平权分发（6/10 agent 缺失）
6. finalize-archive 四项缺口：原子性/回滚、code-graph snapshot 占位、cache 陈旧项不删、防重跑标记缺失

**P1 — 部分实现**
7. GLOSSARY 校验路径错位（docs/ vs .mumuspec/），三要素与同步检查缺失
8. `check --json` 缺 enforcement_coverage 输出（三处输出缺一）
9. Design/Build 阶段 scope overflow 动态检测缺失
10. GEMINI.md 缺 context.fileName 提示
11. init 的 goal.md/env-spec.md 需 --distributed 才生成
12. STRUCT-1 scope 非有效路径校验、STRUCT-2 Enforcement 存在性硬校验缺失
13. 版本规则 spec 文本过时（src/cli.ts 改写为空操作）

**P2 — 卫生项**
14. `.mumuspec/audit.log`、`agents-hash.json`、`constraints.yaml` 在根目录但不在 TEMP-4 声明白名单（DEFINED_FILES 为超集）——建议白名单文本与 DEFINED_FILES 对齐，并迁移 audit.log
