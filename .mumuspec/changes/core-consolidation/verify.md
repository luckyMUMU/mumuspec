# Verify: core-consolidation

## verify_result

`pass` — 六层实现全部 done，三道闭合等式实测比率 1.000 且违反合计 0；门禁全绿，残余事项均有归属条目（R-0021 / R-0022 / T1-9）。

## 测试证据

| 通道 | 命令 | 实测 |
|------|------|------|
| 全量用例 | `npm test` | 313 文件 / 5455 用例全绿，exit 0 |
| 分层套件 | `test-cases lock-suite --layer 1..6` | 六层 suite 均已锁定（`suites_locked = true`），设计级 hash 复锁 `de30a25ade654286` |
| 套件完整性 | `test-cases verify` | ✓ 通过（hash 一致） |
| 规范校验 | `mumuspec check` | exit 0 |
| 强制面 | `npm run enforce` | 0 error（2 条 W-SKILL-001，见偏差记录 D-1） |
| CI 链路 | `npm run ci:check` | 通过（with warnings） |
| 文档审计 | `npm run docs:audit` | unknown refs=0、broken links=0、unknown BP refs=0、diagram drift=none |
| 边界对账 | `mumuspec sync --check` | 18/18 模块扫描并 index 对齐，幻影声明 0（4 条归属错位为 info） |
| 闭合等式 | `mumuspec conformance` | E1 77/77、E2 153/153、E3 5/5，违反合计 0 |
| 阶段门 | `mumuspec guard core-consolidation verify` | ✓ 通过，无告警 |

本轮新增测试面：`tests/spec/aspects.test.ts`(9)、`tests/graph/render.test.ts`(16)、`tests/graph/doc-page.test.ts`(7)、`tests/core/design-skeleton.test.ts`(10)、`tests/core/metrics/declaration-conformance.test.ts`(20)、`tests/change/request-slot.test.ts`(3)、`tests/change/worktree-gate.test.ts`(5)、`tests/spec/reuse.test.ts`(9)、`tests/guard/sensitive-info.test.ts`(7)、`tests/install/skill-companions.test.ts`(2)、`tests/eval/corpus-fixtures.test.ts`(2)。

## 验收标准对照（改进计划 §5 总验收）

| 判据 | 结果 | 依据 |
|------|------|------|
| 三条闭合等式比率 1.0 | 达成 | E1 77/77、E2 153/153、E3 5/5；advisory 项属 R-0021（不参与比值，也不充当通过） |
| 计划 V1–V14 裁决落地 | 达成 | V1/V2/V3/V4/V5/V6/V7/V8/V9/V10/V11/V12/V13/V14 全部处置；V4 的引擎残留另立 R-0022 |
| Q4 门认维度不认行数 | 达成 | 同维度三条记录不再构成覆盖；缺 `security-compliance` 点名并接线伴生能力降级留痕 |
| E-SPEC-006 出路为真实命令 | 达成 | `design-init` 接线，由 E1 fixSteps 探针锁定存在性 |
| 工作树门与创建路径成对 | 达成 | 强制档建树、降档留痕、缺失阻断（E-GUARD-014 / E-CHANGE-014）三态齐备，5 条断言 |
| 四视图渲染确定性可复现 | 达成 | 字节一致断言 + CLI/MCP 双消费者共用 `src/graph/facts.ts` |
| 文档与代码差异表清零 | 达成 | 计划差异表逐项处置完毕；本轮新增的图示生成页纳入同一对账通道 |
| 全量门禁相对基线无退化 | 达成 | 基线 306/5416 → 313/5455，无弱化；未放宽任何判定 |

## SHALL / SHALL NOT 校验记录

本变更的约束增量为 `constraints/new-shall.md` 与 `constraints/new-shall-not.md`（无 DS-* 差分规范，delta-specs 目录为空），其发射通道复用既有注解/词法双通道，未新建判定引擎。约束本体经 `mumuspec check` 与 `npm run enforce` 校验，结果为 0 error；强制面中无"悬空门指针"进入（E3 门⊆事实 5/5）。

## manual 约束验证记录（E-VERIFY-003）

| 约束正文（经溯源） | 验证方式与证据 | 结论 |
|--------------------|----------------|------|
| 工具定义集中在 `TOOLS` 常量数组，分发集中在 `callTool()` 单一 switch | `src/mcp/tools.ts` 内 `export const TOOLS` 为唯一定义处，`callTool()` 内单一 `switch (name)` 分发；E2 的 surface-pairing-mcp-tool 探针逐工具比对声明与 `case` 分支，实测全部命中 | 通过 |
| 工具 handler 只做参数校验与领域函数调用，不含业务分支 | 本轮新增的 render_diagram handler 仅做路径参数校验后调用 `src/graph/facts.ts` + `render.ts`；CLI 侧 `graph render` 与 MCP 侧共用同一适配层，无第二份判定实现（结构复核：handler 体内无条件分支业务判定） | 通过 |
| 禁止工具自行读写变更状态文件（应委托 change 领域模块） | `src/mcp/tools.ts` 中状态读写均经 `change/manager.js` 导出的 `loadChangeState` / `listActiveChanges` / `getActiveChange`；无直接 `writeFileSync` 状态路径（检索确认） | 通过 |

### 受影响作用域的 manual 约束核验

`src/mcp`（本变更接入 render_diagram 与 path 参数门）：

| 约束原文 | 证据 |
|---------|------|
| 写工具限定为 persist_contract / deprecate_contract / remove_contract / scaffold_boundary 四个 | 声明面 36 个工具中，具备写副作用的仅这四个（`src/mcp/tools.ts` 工具名检索：scaffold_boundary、persist_contract、deprecate_contract、remove_contract）；新增的 render_diagram 为只读渲染 |
| 写操作必须经 contract 领域模块，不得直接操作 YAML 文件 | `src/mcp/tools.ts` 内 `writeFileSync` / `writeText` 出现 0 次；写分支委托 `contract/manager.js` 与 `spec/` 领域函数 |
| 禁止新增未经声明的写工具 | 写能力只存在于上述四个已声明工具；E2 的 surface-pairing-mcp-tool 探针逐条比对声明与分发分支，实测 36/36 命中，无未声明分支 |
| 每个工具必须提供 inputSchema，属性类型与必填性显式声明 | 工具定义 36 条、`inputSchema` 36 条（数量相等且逐条同现）；本轮 path 参数门正是从 `inputSchema.required` 推导必选项，而非另立清单 |
| 禁止依赖隐式参数（未出现在 inputSchema 中的参数） | handler 只读取 schema 声明的参数名；缺失 required 参数时返回 E-SECURITY-003 而非以默认值继续 |

`src/team`（本变更仅移动其边界文档路径；引擎可达性见 R-0022）：

| 约束原文 | 证据 |
|---------|------|
| TeamEngine 通过 RuntimeAdapter 接口与运行时解耦，外部依赖只经 adapter 注入 | `src/team/engine.ts` 的 import 仅两类：`types-constraint`/团队类型（type-only）与 `./config.js` 的 `validateTeamConfig`；运行时经 `RuntimeAdapter` 接口注入 |
| MockRuntimeAdapter 提供零依赖实现，用于测试与本地模拟 | `engine.ts` 内 `export class MockRuntimeAdapter implements RuntimeAdapter`，并由 `src/team/index.ts` 对外导出 |
| 禁止 TeamEngine 直接 import 具体运行时实现 | 同上 import 清单，无宿主 SDK 或运行时模块引用 |
| 配置按变更名隔离存储（getTeamConfigPath 以 changeName 定位） | `config.ts` 中 `getTeamConfigPath(projectRoot, changeName)` 返回 `<configDir>/<changeName>.yaml` |
| validateTeamConfig 返回结构化校验结果（TeamConfigValidation） | `config.ts` 中 `validateTeamConfig(config: unknown): TeamConfigValidation`，内部聚合 errors 与 warnings 数组 |
| 状态转移产生 TeamEventRecord 事件日志 | `engine.ts` 维护 `eventLog: TeamEventRecord[]` 并经 `logEvent(...)` 写入，`getEventLog()` 对外暴露 |
| confirmSelection 是人工放行的唯一入口 | `state.confirmed_selection` 在全模块仅有一处赋值，位于 `confirmSelection()` 内，并同批记录 `team_user_confirm` 事件 |
| 禁止静默跳过达标线检查（canContinue / isBarMet 不可被绕过） | 推进路径以 `if (!this.canContinue())` 前置判定；`isBarMet()` 与 `canContinue()` 同时出现在 `getStatusSummary` 输出中，判定结果对外可见而非内部吞掉 |
| 禁止配置写入变更工件目录之外的路径（TECH-TEAM-3） | 写出路径唯一来源是 `getTeamConfigPath` = `getMumuSpecDir(projectRoot)` 下的团队配置目录内 `<changeName>.yaml`；`config.ts` 内目录创建也只指向 `getTeamConfigDir`，无第二条写出通道 |

上述核验为结构复核（代码形态与出处可指认），不主张运行时行为等价：`src/team` 当前无消费者，其运行时正确性不由本变更背书（R-0022）。

### 待裁决与待人工项

| 项 | 性质 | 归属 |
|----|------|------|
| always_enforce 例外清单与求值面脱钩的处置方向（改名对齐属强度收紧） | 需人工签收 `constraint_strength` 语义变化 | R-0021，未擅自修改 |
| 无消费者的 team 引擎去留 | 需人工裁决"接入适配器"或"连同类型面撤下" | R-0022 |
| 技能副本同步（`~/.workbuddy`） | 写用户主目录，越出工作区 | T1-9，待用户执行 |
| 图样式与可读性 | 人工评审，机械通道只核对结构与来源一致性（RENDER-4） | 已按 manual 归类 |

## 偏差记录

- **D-1**：`npm run enforce` 的 2 条 W-SKILL-001 源于仓库 skill 源已改、用户主目录副本未同步。属分发面滞后而非规范违背；处置动作即 T1-9（用户执行 `mumuspec install … --force`）。未以忽略副本内容的方式消除告警。
- **D-2**：vitest 在 forks pool 下仍会打印 `onTaskUpdate` RPC 超时（`vitest.config.ts` 已记录成因：fork 在长同步段阻塞事件循环，birpc 60s 超时在 vitest 3.2.7 硬编码不可配）。`npm test` exit 0，用例断言不依赖该通道。
- **D-3**：E3 的 always-enforce 探针以 advisory 呈现而不计入比值或违反。若按"清零"压力折算为通过即成假绿，若折算为违反则等价于擅自修改受签收保护的强度语义，两者都不采取。

## 收尾绑定记录

| 项 | 状态 |
|----|------|
| build_layers 1–6 | done |
| test-cases 套件锁定 | 六层 + 设计级 hash 均已 CLI 复锁 |
| decisions.md | 逐条 `decisions append` 留痕，未手工编辑 |
| branch_status | 未处理——分支收尾涉及提交/合并与推送，属需用户确认的共享状态动作 |
| 归档（BP-17） | 未执行——归档会将差分约束并入根规范并移动变更目录，等待用户显式放行 |
