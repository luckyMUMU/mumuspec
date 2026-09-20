---
scope: .
layer: 0
last_updated: '2026-09-05'
---

# 技术概览: MumuSpec

## 六层架构

MumuSpec 采用六层架构，从上到下依次为：

```
┌─────────────────────────────────────────────────────┐
│  Entry Layer   │ cli.ts / mcp-server.ts / index.ts  │
├─────────────────────────────────────────────────────┤
│  Change Layer  │ manager.ts / state-machine.ts       │
├─────────────────────────────────────────────────────┤
│  Guard Layer   │ checker.ts / phase-guard.ts         │
├─────────────────────────────────────────────────────┤
│  Spec Layer    │ parser / loader / validator / ...    │
├─────────────────────────────────────────────────────┤
│  Knowledge Layer│ manager.ts (PageIndex + LLM-Wiki)   │
├─────────────────────────────────────────────────────┤
│  Core Layer    │ config / utils / errors / types      │
└─────────────────────────────────────────────────────┘
```

### 设计原则

1. **规范驱动** — 规范是行为的唯一真相来源，代码是规范的实现
2. **Ponytail 优先** — 能不写就不写，能复用就复用，能简单就简单
3. **渐进式披露** — 规范按需加载，Layer 0 → 1 → 2 逐步深入
4. **双向约束** — SHALL（正向要求）+ SHALL NOT（反向禁止）
5. **动态强度** — 约束按 high/medium/low 分级，映射到 block/warn/info
6. **零运行时依赖偏好** — install、bundle、i18n、skill-authoring 模块零外部依赖

## 模块分组

| 层 | 模块 | 职责 | 外部依赖 |
|----|------|------|----------|
| Entry | cli.ts | CLI 命令编排 | commander |
| Entry | mcp-server.ts | MCP 工具暴露给 LLM | @modelcontextprotocol/sdk |
| Change | manager.ts | 变更 CRUD + 构建层管理 | — |
| Change | state-machine.ts | 5 阶段状态机 + 回滚 | — |
| Change | phase-graph.ts | workflow 图构建（PHASE_ORDER 同构基准） | — |
| Change | phase-graph-loader.ts | 声明式 workflow YAML 加载 + 项目级 override | yaml |
| Guard | checker.ts | 合规检查 + 漂移检测 + 强度降级 | — |
| Guard | phase-guard.ts | 5 种阶段转换门禁 | — |
| Spec | parser.ts | spec.md 解析/序列化 | yaml |
| Spec | loader.ts | 渐进式上下文加载 | yaml |
| Spec | validator.ts | 全项目规范校验 | — |
| Spec | inheritance.ts | 继承冲突检测 | — |
| Spec | ponytail.ts | Ponytail 约束定义与注入 | — |
| Knowledge | manager.ts | 知识库 CRUD + PageIndex | — |
| Core | config.ts | 配置加载 + 约束树解析 + 强度矩阵 | — |
| Core | utils.ts | FS/YAML/Hash/审计工具 | — |
| Core | errors.ts | 标准化错误码 | — |
| Core | constraint-evaluator.ts | 运行时约束求值 | — |
| Core | constraints-loader.ts | 磁盘 I/O + 树加载 | — |
| Helper | generator.ts | AI 规则文件生成 | — |
| Helper | installer.ts | Skills/MCP/Commands 安装 | 零依赖 |
| Helper | packager.ts | 技能打包/验证 | 零依赖 |
| Helper | feedback.ts | 用户反馈管理 | — |
| Helper | hooks.ts | Git Hooks 管理 | — |
| Helper | eval.ts | 评估场景运行 | — |
| Helper | locales.ts | 国际化 | 零依赖 |
| Helper | protocol.ts | 技能创作协议 | 零依赖 |

## 关键决策

### D-001: 六层架构分离
**Decision**: 采用六层架构，每层有清晰的职责边界。Spec 层只管解析，Guard 层只管检查，Change 层只管状态，Knowledge 层只管存储。
**Consequence**: 各层可独立测试和替换；新增功能只需在对应层添加模块。

### D-002: 树状约束系统
**Decision**: 实现 ConstraintTreeNode，支持继承 + 收紧 + 冲突检测。根层 ConstraintStrength 由 config.yaml 控制，子层可覆盖。
**Consequence**: 灵活的分层约束；收紧合法；放松非法（产生冲突）。

### D-003: 动态强度映射
**Decision**: high→block, medium→warn, low→info。9 条 always_enforce 异常始终阻断。
**Consequence**: 通过切换 strict/balanced/hotfix 预设适应不同场景。

### D-004: 零运行时依赖偏好
**Decision**: install、bundle、i18n、skill-authoring 四个模块仅使用 Node.js 内置模块。
**Consequence**: 更小的安装体积、更快的启动、更少的 breaking changes。

### D-005: 5 阶段变更生命周期
**Decision**: open → design → build → verify → archive。支持回退（build→design, verify→design, verify→build）和热修复跳过设计。
**Consequence**: 清晰的进度追踪；阶段门禁保证质量；回滚机制提供安全感。

### D-006: Workflow 声明式外化（CHG-6 / CHG-7）
**Decision**: 阶段状态机的 phases / edges / breakpoints 以声明式 YAML 定义（`src/change/workflow.default.yaml` 为单一事实源，由 phase-graph-loader.ts 加载，AC-01 测试锁定与 PHASE_ORDER 同构）；项目可通过 `.mumuspec/workflow.yaml` override，在 guard 入口由 activateProjectWorkflow() 加载——存在且合法即生效，损坏/非法时 WARN 并回退内置默认。
**Consequence**: 流程定义与引擎代码分离（KP-0060 规则-实现分离）；项目可裁剪 BP、调整回退边而无需改代码；非法 override 被 loader 校验拒绝。

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 语言 | TypeScript (ESM) | 全栈类型安全 |
| 运行时 | Node.js >= 20.0.0 | 唯一运行时依赖 |
| CLI 框架 | commander | 命令行解析 |
| MCP SDK | @modelcontextprotocol/sdk | AI 工具集成 |
| YAML | yaml 库 | spec.md / config.yaml 解析 |
| 测试 | vitest | 单元测试 + 集成测试 |
| 构建 | tsc (TypeScript compiler) | ESM 编译 |
| Lint | ESLint + Prettier | 代码风格检查 |
| 零依赖模块 | Node.js 内置模块 | install/bundle/i18n/skill-authoring |


<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-prune-safety/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-prune-safety/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-state-integrity/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-state-integrity/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from loop-convergence-judgment/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from loop-convergence-judgment/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from evaluator-data-source-fix/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-data-source-fix/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from loop-signal-bandwidth/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from loop-signal-bandwidth/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from skill-plugin-standard/new-shall-not.md -->
- 清单中的 source 不得指向不存在的目录
- 不得以自研清单格式作为分发的唯一形式——宿主无法识别的格式等于不可分发
- 不得以占位实现返回成功——动作未实现时的正确行为是失败并给出理由
- 不得覆盖目标位置中非本包管理的内容
- 不得只比对存在性而不比对内容（存在即被信任）
- 不得让技能源目录的高频编辑与副本之间不存在任何到期校验
- 不得声明无实体来源的必须加载项——强断言与可满足性脱钩时，断言恒为空转
- 不得以静默替换代替降级留痕
- 不得保留引擎不存在的字段名作为守卫检查项
- 不得让同一语义的既有正确内容在迁移中丢失
- 不得以技能不可用为由静默跳过高风险门禁
- 不得因合并询问而减少用户可选项或自动选默认值



<!-- constraint-merged from skill-plugin-standard/new-shall.md -->
- 单插件清单必须位于包根的 .codebuddy-plugin/plugin.json，包含 name / version / description / license 字段
- 市场清单必须位于 .codebuddy-plugin/marketplace.json，其 plugins 条目的 source 必须以相对路径指向包内实际存在的目录
- 包内容布局必须为 skills/<skill-name>/SKILL.md，使宿主无需转换即可加载
- 包版本必须取自包版本单一源（运行时包版本）
- 安装必须落到 plugins/cache/<marketplace>/<plugin>/<version>/ 布局，版本段来自包版本
- 安装必须幂等：同一版本重复安装不得产生重复条目，也不得失败退出
- 安装必须在宿主插件登记文件中登记或更新条目，键为 name@marketplace
- 安装必须在登记文件不可写或格式不可解析时 fail-closed 并给出理由
- 漂移检测必须比对源技能正文与安装副本正文，并在不一致时产出诊断
- 比对必须先剥离 frontmatter 的版本字段再比较
- 漂移诊断必须接入 mumuspec check 的 drift 数组与 CI 检查，作为可强制告警
- 漂移检测必须对自身生效：改动任一技能正文后必须产生诊断
- 技能文本中的外部能力必须分为两类：包内自足的必须步骤，与包外增强的伴随能力
- 伴随能力的可用性必须由代码侧探测并枚举
- 伴随能力缺失必须只出现在枚举清单中，不得阻断阶段流程
- 伴随能力的替代路径必须为带编号与产出的显式步骤
- 阶段分发规则必须只在一处定义，其余位置引用而非复写
- 技能文本引用的状态字段与配置键必须存在引擎消费者
- 每个门禁必须声明其为不可跳过，或声明可降级且降级须留痕
- 高风险门禁（安全、代码审查、调试前置）不得存在无条件跳过表述
- 相邻的人工确认点必须在保持选项集不变的前提下合并为一次询问



<!-- constraint-merged from enforcement-coverage/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: Delta Merge Integrity

Enforcement: manual(MRGT-01: verify 阶段以负向测试断言静默丢弃路径已消除)

- SHALL NOT 归档时静默丢弃无法合并的 delta-spec 文件（`E-CHANGE-022` 强制中断，不可静默降级为警告）



<!-- constraint-merged from enforcement-coverage/new-shall.md -->
# New SHALL Constraints

## Requirement: Delta Merge Integrity

归档时的 delta-spec 合并必须留下可判定事实：合并成功、幂等跳过或显式失败三态之一，不允许静默丢弃。

- SHALL: 归档合并 delta-spec 时，对每个无法解析合并目标或读写失败的 delta 文件以 `E-CHANGE-022` 中断归档并留 audit 记录
- SHALL: `mergeDeltaSpecsToMain` 返回包含已合并文件与未解决文件（含原因）的结果对象



<!-- constraint-merged from ci-drift-gate/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from ci-drift-gate/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from shall-structure-lint/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from shall-structure-lint/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from spec-fence-guard/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from spec-fence-guard/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from fail-open-audit/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from fail-open-audit/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from delta-channel-gate/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from delta-channel-gate/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from ready-action-guidance/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from ready-action-guidance/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from drift-delta-preview/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from drift-delta-preview/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from workflow-tier-hint/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from workflow-tier-hint/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from bp-into-graph/new-shall-not.md -->
# New SHALL NOT Constraints

- SHALL NOT 在 workflows 段缺少 phase_bps 时改变既有解析与校验行为（缺省合法，向后兼容）。
- SHALL NOT 因 phase_bps 非法而崩溃，必须走既有 fail-safe 路径（console.warn 加内置默认配置）。
- SHALL NOT 让 W-GRAPH-001 以 error 级别发出，也不得在 skill 侧 workflow.yaml 缺失时阻断 graph verify。
- SHALL NOT 改变任何既有 BP 的存在性或人工确认机制。



<!-- constraint-merged from bp-into-graph/new-shall.md -->
# New SHALL Constraints

- SHALL 支持 workflows.<workflow>.phase_bps 可选键（phase 到 BP id 列表的映射），loader 校验键为已知 phase、id 格式 BP-<数字>[.<数字>]、全配置内唯一。
- SHALL graph verify 输出当前 workflow 的 phase_bps 清单，并将 skills/mumuspec/workflow.yaml 声明的 BP 集合与引擎 phase_bps 对比，差异以 W-GRAPH-001 告警（WARN 级）。
- SHALL full workflow 的 phase_bps 并集覆盖 BP-1 至 BP-18 全部 18 个 BP。



<!-- constraint-merged from legacy-cleanup-fix/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from legacy-cleanup-fix/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from eval-corpus/new-shall-not.md -->
# New SHALL NOT Constraints

- SHALL NOT corpus 聚合与 kill 判定引入 LLM 判定或手写指标值
- SHALL NOT 新评估器改变既有 loop composite 权重之和、收敛阈值与稳定窗口
- SHALL NOT 语料文件位于 tests、temp 等会被规范 walker 递归扫描的路径
- SHALL NOT custom 场景类型落入未知类型分支输出 warning
- SHALL NOT report 输出改变 check 与 validate 命令的既有 JSON schema
- SHALL NOT 将探针启动失败或输出不可解析的 fixture 计为漏检
- SHALL NOT 静默丢弃无 expected.yaml 声明的语料子目录
- SHALL NOT 静默跳过已声明聚合阈值的断言



<!-- constraint-merged from eval-corpus/new-shall.md -->
# New SHALL Constraints

- eval runner corpus 场景类型按 corpusDir 下 fixture 子目录独立运行并聚合 recall 与 noise，kill 判定采用多信号 diff（新增码 ∪ coverage 五字段 delta）
- corpus 语料样本输出 Wilson 95% 置信区间，样本数不足 3 时标注置信不足
- custom 场景类型仅执行 assertions 断言，不执行引擎动作
- verifiable-ratio 评估器以 weight 0 注册，value 为 validate coverage 的 strong_ratio
- fail-open-count 评估器以 weight 0 注册，统计 audit.log 中 result 非 success 条目并按 action 分组
- 评测语料库位于 .eval-corpus/ 隐藏目录，位置隔离经 fixture-location 断言验证
- eval 命令提供 --report 汇总输出（文本与 JSON 双形态）
- corpus 聚合区分 killed、missed、errored 三态，探针启动失败或输出不可解析的 fixture 不计入 recall 分母并作为场景 warning 列明
- 未声明 corpusExpect 聚合阈值时输出 report-only 模式 warning，不改变 passed 语义
- 被声明的聚合阈值（minRecall、recallBySeverity、maxNoise）对应分母为 0 时报配置错误（fail-closed）
- corpusDir 下含 .mumuspec 子目录但缺 expected.yaml 的子目录发出 warning 并计数，不计入任何分母
- report 汇总附 corpus 聚合精度（mustContainSatisfied 命中比率），仅展示、不设阈值
- bad-case 语料覆盖可发射集 15 码各至少 1 例（E-SPEC-001、E-SPEC-002、E-SPEC-003、E-SPEC-004、E-SPEC-006、E-SPEC-008、E-SPEC-009、E-SPEC-010、E-SPEC-011、E-SPEC-013、E-SPEC-014、E-SPEC-015、W-SPEC-016、E-GUARD-010、E-CHANGE-022）；E-SPEC-005、E-SPEC-007、E-SPEC-012 为 registered-but-not-emitted（M1 出范围），不建必须命中语料



<!-- constraint-merged from install-trae-agents/new-shall-not.md -->
# New SHALL NOT Constraints

- SHALL NOT 在 trae → traecode 迁移后保留幽灵引用（AgentType / 子命令 / 测试 / 文档须一次性替换）。
- SHALL NOT 让 --project-only 与 --target user 并存时静默选择其一（fail-closed，报错退出）。
- SHALL NOT 为 traecode / traework 引入 registry 之外的 agent-specific 逻辑。



<!-- constraint-merged from install-trae-agents/new-shall.md -->
# New SHALL Constraints

- SHALL 使 traecode 与 traework 在 workspace 目标安装时生成/更新项目根 AGENTS.md（复用 renderRuleFiles 三态策略与 managed 标记，TraeWork 桌面版亦读取该文件）。
- SHALL 使 --project-only 等价于 --target workspace 且 --workspace-path 缺省取 process.cwd()，并与显式 --target user 互斥（冲突即报错退出）。



<!-- delta-merged from lightweight-freeze-gate/.-tech.md -->
# Delta Spec: 轻量路径需求冻结与最小可解析单元

## Requirement: 需求冻结确认门（freeze gate）

轻量档（tweak/hotfix）变更可声明影响可见结果的用户决策，进入实现前须完成人工签收。

- SHALL: 解析 proposal 的 `## User Decisions` 段，`- [blocking]` 前缀条目识别为阻塞性用户决策。
- SHALL: open→build 守卫在存在未签收 blocking 决策项时报错（E-GUARD-011）并逐项列出条目；全部经 decisions.md 签收后才放行。
- SHALL: proposal 未声明 blocking 决策时，open→build 守卫行为与现状完全一致（无新增约束）。
- SHALL NOT: 禁止在无 blocking 声明时为轻量档新增硬性门禁（保持 CHG-5 兼容）。

Enforcement:

- ENF-1: manual(phase-guard 断言：blocking 未签收 → E-GUARD-011 且列表非空；无声明 → 与改动前一致。tests/guard/phase-guard-freeze-gate.test.ts)

## Requirement: spec 最小可解析单元

轻量档变更的最小合法 delta 为单条 Requirement 与单条 SHALL 项，不因内容少被拒。

- SHALL: 轻量档 delta 校验接受单条 `## Requirement:` + 一条 `- SHALL:`（或 `- SHALL NOT:`）项为最小合法单元。
- SHALL: isMinParseableUnit 谓词对上述最小单元返回 true。
- SHALL NOT: 禁止将最小单元规则扩大到 full workflow（E-SPEC-004 仍在零 requirements 时告警，行为与改动前一致）。

Enforcement:

- ENF-2: manual(tests/spec/validator-min-unit.test.ts 锁定：最小单元 true / 零 requirements 与无主体 false)

## Requirement: 零行为变更免 delta 逃生舱

纯重构/工具/文档类行为变更可通过显式声明跳过 spec delta，不以凑校验为目的强写 requirement。

- SHALL: `mumuspec new --no-spec-delta` 将 `skip_specs` 写入变更状态；此类变更 open→build 不提示 delta-specs 缺失。
- SHALL: verify 结果约束（测试绿 + 漂移检查）对该类变更照常收口。
- SHALL NOT: 禁止以 `skip_specs` 绕过 verify 结果约束（非旁路）。

Enforcement:

- ENF-3: manual(tests/cli/commands/change-no-spec-delta.test.ts 断言：--no-spec-delta 置 skip_specs；缺省不置)


<!-- constraint-merged from lightweight-freeze-gate/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: 轻量路径需求冻结与最小可解析单元

- SHALL NOT: 禁止在 proposal 未声明 blocking 用户决策时为轻量档新增任何硬性阶段门禁（保持 CHG-5「只增不改」，默认行为与现状完全一致）。
- SHALL NOT: 禁止将最小可解析单元规则或 `skip_specs` 语义扩大到 full workflow（full 的守卫与校验行为必须零变化）。
- SHALL NOT: 禁止以 `--no-spec-delta` 作为绕过 verify 结果约束的旁路（verify 测试绿 + 漂移检查为最终收口，不可豁免）。

Enforcement:

- ENF-1: manual(回归测试：TC-L0-01/06 锁定无声明与 full 行为不变)


<!-- constraint-merged from lightweight-freeze-gate/new-shall.md -->
# New SHALL Constraints

## Requirement: 轻量路径需求冻结与最小可解析单元

- SHALL: 轻量档（tweak/hotfix）变更在 proposal 中声明 `## User Decisions` 段时，其中的 blocking 决策项在进入 build 前须逐项经 decisions.md 签收；全部签收后才可放行 open→build。
- SHALL: 轻量档 delta spec 校验接受「单条 `## Requirement:` + 一条 `- SHALL:`（或 `- SHALL NOT:`）项」为合法最小单元，不得因内容少而拒绝。
- SHALL: 通过 `mumuspec new --no-spec-delta` 声明零行为变更的轻量档变更允许无 delta-specs 通过 open→build，并由 verify 结果约束收口。

Enforcement:

- ENF-1: manual(phase-guard freeze-gate 测试 + validator 最小单元测试 + CLI 选项测试锁定)


<!-- delta-merged from shall-annotation-channel/.-tech.md -->
# Delta Spec: SHALL 约束机器可验证通道

## Requirement: SHALL 约束机器可验证性

SHALL 与 SHALL NOT 进入机器通道的判据对极性中立；SHALL 仅复用既有注解/AST 通道，不新增引擎。

- SHALL: SHALL 约束与 SHALL NOT 约束的分类判定对极性中立——同一机读注解（非 custom）或显式 `ast:` 前缀对两种极性等价地路由到既有 AST 机器通道（enforced-strong）。
- SHALL: 带非 custom 机读注解或 `ast:` 前缀的 SHALL 约束由 guard 执行注解对应检查；检查命中（要求未被满足）时报告错误并定位到文件行。
- SHALL NOT: 禁止为 SHALL 引入新的检查引擎（仅复用既有 `MachineReadableAnnotation.type` 与既有 AST provider，no-new-engines 契约不变）。
- SHALL NOT: 禁止改变无通道 SHALL 与无通道 SHALL NOT 的既有判定路径（无通道 SHALL → E-SPEC-004 恒可见告警；无通道 SHALL NOT → E-SPEC-015 语义保持不变）。

Enforcement:

- ENF-1: manual(回归测试锁定：分类对称、ast: 通道执行、无通道回落、E-SPEC-004/015 不变。tests/guard/shall-annotation-channel.test.ts + tests/spec/verifier-classify-shall.test.ts)


<!-- constraint-merged from shall-annotation-channel/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: SHALL 约束机器可验证性

- SHALL NOT: 禁止为 SHALL 引入新检查引擎（仅复用既有 annotation 类型与 AST provider）。
- SHALL NOT: 禁止改变无通道 SHALL（E-SPEC-004）与无通道 SHALL NOT（E-SPEC-015）的既有判定路径。

Enforcement:

- ENF-1: manual(回归测试：无通道回落与 E-SPEC-004/015 行为不变)


<!-- constraint-merged from shall-annotation-channel/new-shall.md -->
# New SHALL Constraints

## Requirement: SHALL 约束机器可验证性

- SHALL: SHALL/SHALL NOT 分类判定对极性中立，同一机读注解或 `ast:` 前缀对两种极性等价路由到既有 AST 通道。
- SHALL: 带注解或 `ast:` 前缀的 SHALL 约束执行注解对应检查，违规报 E-GUARD-012。

Enforcement:

- ENF-1: manual(测试锁定：分类对称 + ast: 通道执行 + 范围过滤)


<!-- change-spec-merged from shall-annotation-channel/.mumuspec/tech.md -->
## Requirement: Architecture Constraints

### SHALL
- R1 判定（注解/`ast:` → enforced-strong）对 polarity 中立，`classifyConstraint` 单通道单语义（R2 词法兜底仅限 SHALL NOT）。
- `checkShall` 对 `enforced-strong` + `shall` 条目执行既有 `checkAstViolation` 链路，命中报 E-GUARD-012。
- `typeToConstraint` 映射提取为模块级共享常量（checker 内单一权威源）。
- 测试执行语义沿用 checkShallNot：跳过测试文件、agent-behavior 豁免、isFileInScope 范围过滤。

### SHALL NOT
- 禁止为 SHALL 另立检查逻辑或词法 weak 层（no-new-engines 契约）。
- 禁止修改 checkShallNot 的既有通道与 E-SPEC-004/015 判定。

### Enforcement
- TECH-shall-annotation-channel-1: 分类对称由 verifier-classify 单测锁定
- TECH-shall-annotation-channel-2: E-GUARD-012 执行与豁免语义由 checker 单测锁定

## Requirement: Current Code Status

### SHALL
- Module: src/spec/verifier-classify.ts（分类）、src/guard/checker.ts（执行）、src/core/errors.ts（E-GUARD-012）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/guard/shall-annotation-channel.test.ts、tests/spec/verifier-classify-shall.test.ts（TC-L0-01~06）。


<!-- delta-merged from annotation-primary-r2/.-tech.md -->
# Delta Spec: 词法通道显式化（annotation-first）

## Requirement: 词法通道显式化

SHALL NOT 的 enforced-weak 词法通道由默认隐式降级为显式 opt-in（`lex:` 前缀或 legacy 配置），注解/AST 成为机器通道唯一主入口。

- SHALL: SHALL NOT 约束的 enforced-weak 仅经显式 `lex:` 前缀，或 `specs.legacy_lexical_channel=true`（兼容期兜底）生效。
- SHALL: `legacy_lexical_channel=false` 时，无注解、无 `ast:`/`lex:` 前缀的 SHALL NOT 回落 unverifiable，validate/check 的 E-SPEC-015 给出可操作出口（补 annotation / `ast:` / `lex:` / 声明 `manual(reason)`），不再静默走词法兜底。
- SHALL: `computeEnforcementCoverage` 对 legacy 兜底生效的 weak 项以**新增追加字段**承载"需补注解"行动项数量与清单（不改写 `unverifiable_items` 既有语义，不改变 check/validate 既有 JSON schema）。
- SHALL NOT: 禁止改变 `legacy_lexical_channel=true` 时无前缀文本的既有 R2 行为（兼容面与现状逐字节一致）。
- SHALL NOT: 禁止为 annotation 主入口引入新检查引擎（仅复用既有 `MachineReadableAnnotation.type` 与既有 AST 通道）。

Enforcement:

- ENF-1: manual(回归测试锁定：legacy 两态行为、lex: 前缀显式入口、覆盖报告追加字段、E-SPEC-015 出口三分法。tests/guard/annotation-primary-r2.test.ts + tests/spec/verifier-classify-policy.test.ts)


<!-- constraint-merged from annotation-primary-r2/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: 词法通道显式化

- SHALL NOT: 禁止改变 `legacy_lexical_channel=true` 时无前缀文本的既有 R2 行为（兼容面与现状一致）。
- SHALL NOT: 禁止为 annotation 主入口引入新检查引擎（仅复用既有类型与 AST 通道）。

Enforcement:

- ENF-1: manual(回归测试：legacy 默认兼容 + 无新引擎)


<!-- constraint-merged from annotation-primary-r2/new-shall.md -->
# New SHALL Constraints

## Requirement: 词法通道显式化

- SHALL: SHALL NOT 的 enforced-weak 仅经显式 `lex:` 前缀或 `specs.legacy_lexical_channel=true` 兜底生效。
- SHALL: legacy 关闭时无注解无前缀的 SHALL NOT 回落 unverifiable，E-SPEC-015 引导补 annotation / `ast:` / `lex:` / manual。
- SHALL: `computeEnforcementCoverage` 以追加字段输出 legacy 兜底 weak 的"需补注解"行动项。

Enforcement:

- ENF-1: manual(legacy 两态 + lex: 前缀 + 覆盖报告追加字段测试锁定)


<!-- change-spec-merged from annotation-primary-r2/.mumuspec/tech.md -->
## Requirement: Architecture Constraints

### SHALL
- `specs.legacy_lexical_channel` 新增配置键默认 `true`，`classifyConstraint` 经可选 opts 显式接收；缺省路径行为与现状一致。
- enforced-weak 仅经 `lex:` 前缀或 legacy 兜底（legacy=false 时无注解无前缀 SHALL NOT 回落 unverifiable，E-SPEC-015 出口三分法）。
- `computeEnforcementCoverage` 以追加字段 `legacy_weak` / `actionable_weak` 输出行动项，`unverifiable_items` 语义不变。

### SHALL NOT
- 禁止改变 `legacy_lexical_channel=true` 时的既有 R2 行为（兼容面零变化）。
- 禁止为 annotation 主入口引入新引擎（no-new-engines 契约）。

### Enforcement
- TECH-annotation-primary-r2-1: legacy 两态 + lex: 前缀由 verifier-classify 策略测试锁定
- TECH-annotation-primary-r2-2: 配置接线与覆盖报告追加字段由 guard 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/spec/verifier-classify.ts（R2 门控 + 覆盖报告）、src/core/config-io.ts / config.ts / migrations.ts（新键）、src/guard/checker.ts + src/spec/validator.ts（接线）、docs/reference/configuration.md（文档）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/verifier-classify-policy.test.ts、tests/guard/annotation-primary-r2.test.ts（TC-L0-01~06）。


<!-- delta-merged from manual-explicit/.-tech.md -->
# Delta Spec: manual 显式化与统一通道

## Requirement: manual 显式化

- SHALL: validate 对 `implicit-manual`（legacy 自由文本）enforcement 报 `W-SPEC-017` advisory，指引改写为显式 `manual(reason)`；分类结果与阻断语义不变。
- SHALL: `missingManualEvidence` 识别结构化证据记录 `{constraintId, user, verdict, timestamp, evidence_hash}`——结构合法时按 id 匹配，否则回落既有文本锚点匹配（向后兼容）。
- SHALL: `classifyConstraintEntry` 对 enforcement 为空的条目按 `isRegexCheckable(content)` 判 enforced-weak，否则 unverifiable；`manual(...)` 声明判 manual。
- SHALL NOT: 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- SHALL NOT: 禁止改变 check/validate 既有 JSON schema（新增字段仅追加）。

Enforcement:

- ENF-1: manual(测试锁定：W-SPEC-017 触发、结构化证据解析与回落、classifyConstraintEntry weak/manual/unverifiable 三分)


<!-- constraint-merged from manual-explicit/new-shall-not.md -->
# New SHALL NOT Constraints

## Requirement: manual 显式化

- SHALL NOT: 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- SHALL NOT: 禁止改变 check/validate 既有 JSON schema（新字段仅追加）。

Enforcement:

- ENF-1: manual(回归测试：旧行为不变)


<!-- constraint-merged from manual-explicit/new-shall.md -->
# New SHALL Constraints

## Requirement: manual 显式化

- SHALL: validate 对 implicit-manual enforcement 报 `W-SPEC-017` advisory，指引改写为显式 manual(reason)，分类与阻断语义不变。
- SHALL: missingManualEvidence 识别结构化证据记录并按 constraintId 匹配，无记录时回落既有文本锚点。
- SHALL: classifyConstraintEntry 空 enforcement 按 isRegexCheckable 判 enforced-weak，否则 unverifiable。

Enforcement:

- ENF-1: manual(W-SPEC-017 触发 + 结构化证据解析 + entry 三分测试锁定)


<!-- change-spec-merged from manual-explicit/.mumuspec/tech.md -->
## Requirement: Architecture Constraints

### SHALL
- `implicit-manual` enforcement 由 validator 报 `W-SPEC-017` advisory（不改变分类与阻断）。
- `missingManualEvidence` 结构化证据记录按 constraintId 匹配，无记录回落既有文本锚点（向后兼容，纯函数）。
- `classifyConstraintEntry` 空 enforcement 按 isRegexCheckable 判 enforced-weak，`manual(...)` 判 manual。

### SHALL NOT
- 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- 禁止改变 check/validate 既有 JSON schema。

### Enforcement
- TECH-manual-explicit-1: W-SPEC-017 发放与显式 manual 无提示由 validator 测试锁定
- TECH-manual-explicit-2: 结构化证据解析/回落与 entry 三分由 verifier-classify 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/core/errors.ts（W-SPEC-017）、src/spec/validator.ts（发放）、src/spec/verifier-classify.ts（证据解析 + entry 分类）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/manual-explicit.test.ts（TC-L0-01~05）。


<!-- delta-merged from evaluator-inprocess/.-tech.md -->
# Delta Spec: 评估器 in-process 同批

## Requirement: 评估器轻量通道

- SHALL: spec-compliance / drift-score 评估器以 in-process 调用（buildCheckJsonPayload / detectDriftInProcess）为主路径，子进程通道保留为兜底。
- SHALL: in-process 入口与 CLI 共用同一 checkCompliance / detectDrift 函数（单一权威源，禁止本地复刻）。
- SHALL: 指标 value / weight / rawData 结构与既有输出逐字段一致（loop composite 权重与收敛语义不动）。
- SHALL NOT: 禁止改变 check/validate 既有 JSON schema 与指标输出契约（子进程通道输出不变）。
- SHALL NOT: 禁止为新通道引入独立实现（checker 与 metrics 不得存在语义不一致的双份逻辑）。

Enforcement:

- ENF-1: manual(测试锁定：in-process 与 CLI 契约一致性、子进程兜底存在、输出结构与值不变)


<!-- constraint-merged from evaluator-inprocess/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-inprocess/new-shall.md -->
# New SHALL Constraints




<!-- delta-merged from spec-context-projection/.-tech.md -->
# Delta Spec: Context 声明式投影

## Requirement: 披露清单投影

- SHALL: spec/tech/prd frontmatter 可声明 `disclosure: [Requirement 名...]`；声明后 `loadSpecContext` 仅披露清单内 Requirement 块（机械区块边界过滤）。
- SHALL: 声明 disclosure 的层其 `requirements` 数组与 content 同步投影；未声明的层输出与现状逐字节一致。
- SHALL: 投影过滤不得做语义判断（仅 heading/区块边界）。
- SHALL NOT: 禁止改变未声明 disclosure 时的既有加载行为与输出。
- SHALL NOT: 禁止改变 check/validate JSON schema 与 SpecLayerContext 的数据结构（仅内容收缩）。

Enforcement:

- ENF-1: manual(测试锁定：声明后只含清单区块、未声明逐字节回退、投影规则机械性)


<!-- constraint-merged from spec-context-projection/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from spec-context-projection/new-shall.md -->
# New SHALL Constraints




<!-- change-spec-merged from spec-context-projection/.mumuspec/tech.md -->
## Requirement: Architecture Constraints

### SHALL
- spec/tech/prd frontmatter 声明 `disclosure` 后，`loadSpecContext` 主链对 tech/spec/prd 做机械投影（frontmatter + 披露 Requirement 块），`requirements` 与 content 同步收缩。
- 未声明 disclosure 时输出与现状逐字节一致；投影不做语义判断。

### SHALL NOT
- 禁止改变未声明 disclosure 的既有加载行为与 SpecLayerContext 数据结构。

### Enforcement
- TECH-spec-context-projection-1: 投影/回退两态由 loader 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/core/types-spec.ts（disclosure 字段）、src/spec/loader.ts（projectToDisclosure + 主链接线）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/spec-context-projection.test.ts（TC-L0-01~03）。


<!-- delta-merged from strength-suggested/.-tech.md -->
# Delta Spec: Strength 建议值确定性推导

## Requirement: 强度建议值

- SHALL: `suggestStrengthFor` 由 severity 确定性推导强度建议（ERROR→high / WARN→medium / INFO→low），纯函数幂等。
- SHALL: `collectStrengthDeviations` 以 ERROR_CODES 注册表为单一权威源，报告建议值高于当前维度强度的偏差项。
- SHALL: `mumuspec doctor` 输出建议 vs 实际对照；偏差仅提示，不写入 config（人工签收机制保留）。
- SHALL NOT: 禁止自动修改 constraint_strength 配置（签收红线不变）。
- SHALL NOT: 禁止改变 evaluateConstraint 求值路径与既有 JSON schema。

Enforcement:

- ENF-1: manual(测试锁定：映射表、偏差收集、doctor 输出、不写 config)


<!-- constraint-merged from strength-suggested/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from strength-suggested/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from enforcement-gap/new-shall-not.md -->
# New SHALL NOT Constraints

- 禁止为 `constraints.yaml` 条目另立第二套分类判定逻辑（须复用 verifier-classify 判定序）。
- 禁止对账通道以语义判断决定进度好坏（只核对 `断言 vs 事实` 矛盾）。
- 禁止改变 `check`/`validate` 既有 JSON schema 结构（drift 项仅追加新 type 值）。
- 禁止 LLM 计算或手写对账结果与 `coverage` 数值。



<!-- constraint-merged from enforcement-gap/new-shall.md -->
# New SHALL Constraints

- 每条 constraints.yaml 约束条目与 spec.md 约束条目 SHALL 经同一分类判定序得出可验证性类别（单一权威源）。
- 约束的机读注解命中且对应通道真实执行时，该约束 SHALL 被归为 enforced-strong 并计入 enforcement_coverage。
- `docs/STATUS.md` 的机器可核断言 SHALL 与仓库事实逐项对账，矛盾项 SHALL 经 `mumuspec check` 的 drift 数组可见。
- 分类、对账结果与指标值 SHALL 全部由确定性代码推导。



<!-- constraint-merged from dogfood-migration-b1/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from dogfood-migration-b1/new-shall.md -->
# New SHALL Constraints



## behavior-gate 契约变更（engine-consolidation）

`MachineReadableAnnotation.type` 追加 `behavior-gate` 形态，配 `gate_ref` 指针（仅 `error-code:E-<DOMAIN>-<NNN>` 与 `corpus:<fixture-dir>` 两形态）。语义边界：该注解声明"此红线由被指向的门禁把守"——校验器静态核验**门禁存在且有本项目语料杀伤证据**（码须在 ERROR_CODES 注册且被至少一个 fixture 的 mustContain 命中；或 fixture 存在且声明非空），违规扫描由被指门禁自身承担，gate 不自行扫描代码。核验失败发射 E-GUARD-013（ERROR、forceable: false、always_enforce：悬空指针即假强制）。分类学位置：R1 机器通道成员，计入 enforced-strong。通道标记 `ast:`/`lex:` 只声明分类来源；豁免与扫描路由基于剥离标记后的正文（`stripChannelMarker` 归一），标记不得改变执行路径。
