# Tasks: core-consolidation

## L0 基线复位
- [x] T0-1 `npm run build` 重建 dist（原过期：6 个 src 文件晚于构建）
- [x] T0-2 实测基线：384 约束 / strong 4 / weak 21 / manual 359 / unverifiable 0 / strong_ratio 1.0%；58→59 顶层命令；35 MCP 工具；约 5335 用例 0 skip
- [x] T0-3 `tests/.mumuspec/` 残留经实测确认不进规范 walker（不影响约束计数），保留原位不动未跟踪文件

## L1 起草覆盖面维度门
- [x] T1-1 `src/spec/aspects.ts`：维度枚举单一事实源 + classifyAspects + missingRequiredAspects + isAspectCoverageConverged（纯函数，测试先行）
- [x] T1-2 `templates/design-schema.yaml` 增 Security & Privacy 节（required_for: full），5 条 schema 契约断言
- [x] T1-3 `cognitive-map sync` 判定改维度身份（min 取自 cognitive_framework.q4_min_dimensions，经 utils 读取保持可 mock）
- [x] T1-4 `phase-guard` W-DESIGN-005 改按缺失维度名报出；`errors.ts` 描述与 fixSteps 同步（不再给"补 N 条"式行数指引）
- [x] T1-5 端到端反证：4 条同维度记录 ⇒ converged=false 且报缺失 security-compliance；恢复后 converged=true
- [x] T1-6 `mumuspec new --request "<原文>"` 落 `request.md`（逐字节一致；不带选项时调用形态与产物零变化，3 条断言锁定）
- [x] T1-7 skill 侧扩写清单：phase-open 结构改"目标→非目标→范围边界→关键未知→验收场景→安全与合规"；phase-design Q4 表按维度标识重写并声明判定归认知地图门
- [x] T1-8 安全盲区 companion 接线与不可达降级留痕：`WIRED_COMPANIONS` 判定源唯一，Q4 门缺 `security-compliance` 时读取 `discoverCompanion` 结果，不可达 ⇒ 告警点名敏感信息兜底（W-SECURITY-001）+ `aspect.security.degraded` 审计；可达 ⇒ 记"可用但本轮未产出该维度记录"（phase-guard 2 条 + 清单 2 条断言）
- [ ] T1-9 重装技能副本（`W-SKILL-001` 当前 2 条 WARN：源已改、`~/.workbuddy` 副本未同步）——写用户主目录，留待人工执行

## L2 初始架构偏好选型
- [x] T2-1 `src/core/design-preferences.ts` 偏好包常量（五议题，含"暂不约束"合法态，每项标注未选代价）
- [x] T2-2 `renderDesignSkeleton(analysis, picks)`：未选定显式未决；有选定而无备选或无理由 ⇒ 视同缺失（8 条断言）
- [x] T2-3 `mumuspec design-init <scope>` 接线（已存在 design.md 需 `--force`；未知议题/选项失败并列出候选）+ E-SPEC-006 fixSteps 指向该命令（由 conformance E1 探针锁定存在性）
- [x] T2-4 `onboard quickstart` 消除静默默认（缺 --preset 失败并列出可选值）
- [x] T2-5 选型表四字段完备性进阶段门：`findIncompleteSelections` 判定源扩展（未决标记 **或** 决策字段丢失，非选型块不误报），design→build 守卫按 CHG-5 纪律以 W-DESIGN-012 建议级列出未决议题；`design-init` 出口文案原宣称"选定后方可进入 Build"属过度声明，已改述为建议级并指向实际码；change-layer.md §11.3 处置表按实际判定重写（撤掉 E-GUARD-008 / E-DESIGN 段位的失实指向）

## L3 减法收敛
- [x] T3-1 删除 code_graph 持久化假声明：`storage`/`db_path` 退出配置类型、默认值、项目 config.yaml，文档 index.db 条目改为实际形态
- [x] T3-7 多语言 AST 解析与图谱持久化后端登记入产品非目标表（含理由与承接路径）
- [x] T3-8 死文件与遗留规则文件移除：`scripts/cleanup-temp.mjs`（空、无引用）、根 `.cursorrules`（规范自身禁止）
- [x] T4-6 L4 门的 vitest 断言：隔离三态（强制/降级留痕/关闭）与容量门（超限抛 E-CHANGE-013、单一活跃开启时不介入）共 5 条
- [x] T6-11 发射面探针引用面口径修正（快照/历史工件/冻结研究不算承诺，语料按脱钩判违反）；据此区分并处置：删除 6 项纯残留码，11 项有规范引用者进待裁决登记（R-0020），E2 复测 141/141
- [x] T3-2 删除无引擎的多角色评审残留（状态字段、错误码、归档提取、配置键同批移除）
- [x] T3-3 删除占位协作命令面与未实现的发布命令（不留返回成功的占位路径）
- [x] T3-4 伴生能力清单接线区分：`wired` 由 `WIRED_COMPANIONS` 单源推导并在 `mumuspec skill companions` 输出中标注；清单本身保留为只读环境事实报告（枚举的消费者是代理，不是门禁），V6 的"必需"语义已在 0.4x 撤回。未接线条目不再有门禁依赖，故不构成死端
- [x] T3-5 BOUNDARY 判定源降格：`sync --check` 由"导出全集 ⊆ 文档"（18 模块每轮数百条未记录导出 ⇒ 常年全红等于无门禁）改为"**声明 ⊆ 代码**"；声明符号全仓不存在记 WARN（幻影），仅存在于兄弟模块记 INFO（归属错位）；符号采集支持生成器导出与再导出，注释行不再算声明（`ast-analyzer.ts` 的示例注释曾造出 `foo/Bar/IBar/MyType/baz` 幻影）。实测 18/18 模块对齐、幻影清零
- [x] T3-5a 消除新旧双份：删除被 `.mumuspec/BOUNDARY.md` 遮蔽的 `src/change`、`src/guard`、`src/install` 遗留副本；`src/team` 的遗留单份迁至 `.mumuspec/`（loader 的向后兼容分支保留给非本仓目录）
- [x] T3-5b 幻影行处置：bundle 删 3 行（BundleInfo/CreateBundleOptions/ValidationResult）、change 用实际再导出类型替换 4 行（BuildLayerView/ParallelPlan/ScopeCoupling）、knowledge 的 `searchKnowledge` 改指实际名 `knowledgeSearch`、sync 生成器不再产出 `(description pending)` 符号表
- [x] T3-5c 新模块边界补登：`src/graph/.mumuspec/BOUNDARY.md`（职责/边界/接口/依赖/契约，含确定性与失败优先约束）+ `index.yaml` 注册（此前 graph 两处告警由本轮渲染能力引入）
- [x] T3-5d 可达性核对发现 `src/team` 引擎零非测试引用 ⇒ 新立 R-0022（接入真实适配器并同批重暴露命令面，或连同 types-team 一并撤下；不得以占位命令面凑可达性）
- [x] T3-6 AST 旁路收口：`checkAstConstraints` 及其 eval/new-Function 识别链（findEvalUsage、findNewFunction、collectLocalEvalAliases、collectFunctionAliases、resolveCommaExpression、CodeViolation）删除——该套 AST 实现在 src 内零消费者，`no-eval`/`no-new-function` 未在任何 annotation 映射、约束类型表或禁令正文中声明，属"实现完整、测试充分、无人可达"的第二套并行判定面；AST 判定权威源回归 provider 注册表。javascript provider 已是 `...typescriptProvider` 的委派而非展开复制（无需改动）

## L4 隔离门与复用
- [x] T4-1 `createWorktree` 回归 `src/core/git.ts`（分支存在性判定 + 失败抛原因，不再悬空）
- [x] T4-2 `ensureWorktreeIsolation` 经强度矩阵解析；进入 design 时创建，档位不符时降级并写审计痕
- [x] T4-3 `E-GUARD-014`（强制档缺工作树）进 phase-guard；`E-CHANGE-014`（创建失败）注册并生成错误码文档
- [x] T4-4 `workflow.max_active_changes` 落地为门（关闭单一活跃变更后超限报 `E-CHANGE-013`），此前只有配置与文档承诺
- [x] T4-5 `workflow.tdd_enforced` 消费点落地：不一致在强制档升级为 error，非强制维持 WARN（默认行为零变化）
- [ ] T4-6 L4 门与上限的 vitest 断言补写（当前为 CLI 端到端实测证据）
- [x] T4-7 契约按范围导入 `mumuspec contract import --from <scope> [--id] [--to]`：复用既有注册与审计路径（`persistContract`），副本 source 标注来源注册表位置与条目号；来源缺失/条目不存在/注册表损坏三类均失败并列出可选项（不返回空成功）
- [x] T4-8 约束复用 `mumuspec constraints reuse --id [--from] [--to] [--tighten]`：经 `src/spec/reuse.ts` 纯规划 + 既有 `constraint-provenance` 通道继承上游来源；缺上游即拒（E-SPEC-016），放宽强度即拒（E-SPEC-017），写入后目标 constraints.yaml 带 `inherited`/`tightens` 标注
- [x] T4-9 契约注册表文件名一致：配置声明 `contracts/_registry.yaml` 与代码常量 `contracts.yaml` 的分歧收敛到实现侧真值（config-io 默认值与项目配置同步）

## L5 图数据确定性渲染
- [x] T5-1 `src/graph/render.ts`：四视图（阶段×BP 泳道 / 含回退计数状态机 / 约束继承树 / 契约上下游）
- [x] T5-2 格式封闭枚举 mermaid|dot|json，未知格式与矛盾源数据分别失败（E-GRAPH-002 / E-GRAPH-003）
- [x] T5-3 确定性、未把守边可见、不可达节点可见、回退边可区分——16 条断言
- [x] T5-4 `mumuspec graph render` 接线（消费 workflow.yaml 图数据与变更 state，纯只读）
- [x] T5-5 适配层单一化 `src/graph/facts.ts`：CLI 与 MCP 共用同一投影构建器，杜绝 checker/builder 式双实现
- [x] T5-6 MCP 只读工具 render_diagram 接入（并登记进 PATH_TOOLS 路径校验，`path` 参数受既有目录安全门约束）；工具面 36 declared / 36 dispatched，E2 探针复跑通过
- [x] T5-7 文档审计增阻塞点标识对账：docs 中出现的门禁编号必须存在于工作流图数据（默认 + 项目 override 并集 19 个），WARN 起步不影响退出码；实测 unknown BP refs=0
- [x] T5-8 结构对账以生成页承载：`src/graph/doc-page.ts` 把四视图投影为 `docs/reference/workflow-diagrams.md`（变更状态不入页，避免随阶段抖动），`build` 末段重生成、`docs:audit` 用同一投影比对并给出首个差异行；散落在设计文档内的手写图块仍**不做**结构比对——布局差异不可判定，强行比对等于把不可判定的东西伪装成门禁（diagram-rendering.md §5 记录该边界）。7 条断言覆盖字节一致性、四视图齐备、未把守可见、篡改定位、截断与空文件

## L6 声明一致率与文档对账
- [x] T6-1 `declaration-conformance` 五探针（fixSteps 命令存在性、命令模块注册可达、声明实现集合、产出消费配对、门指针引用）+ assembleReport
- [x] T6-2 `mumuspec conformance` 命令面（独立上报，未接入收敛评估权重/阈值/稳定窗口；check/validate JSON schema 未动）
- [x] T6-3 实测结果：E1 78/78、E2 35/35、E3 5/5 均为 1.000；未建探针类另列，不以空集充当绿灯
- [x] T6-4 E1/E3 违规清零过程留痕：3 个悬空门指针与 1 处持久化假声明均由探针捕获后处置
- [x] T6-5 `status_assertion` 通道改双向（"43+ 命令 / 25+ 工具"的低估此前静默通过；容差 5 保留 "N+" 表达自由，3 条新断言）
- [x] T6-6 进度文档复位：STATUS（384 约束 / strong 4 / weak 21、59+ 命令、35+ 工具、图谱后端、Phase 4/5、Change Layer 备注、更新日期）、overview（去版本字面量，指向 STATUS）、goal.md（Phase 2/4/5 实况 + 三等式口径）；`improvement-plan.md` 已取代指针化
- [x] T6-7 版本 bump 0.46.0-alpha.1 + CHANGELOG + 全量门禁比对（tsc 0 错、check 通过、enforce 0 error、ci:check 通过、docs:audit unknown refs=0）
- [x] T6-8 第六探针 error-code-emitted：扫出 17 个无发射点码，其中全部被文档/模板/测试引用 ⇒ 进 advisory 待裁决（不计比值、不计通过），实测 E1 76/76、E2 138/138、E3 5/5
- [x] T6-9 顺带纠正一处文档假强制：`design-schema.yaml` 与模板 prd 宣称缺失节返回 E-DESIGN-009 错误，引擎实际发射 W-DESIGN-009（建议级）；两处已改指实际码，残余 16 码交 R-0020
- [x] T6-10 锁定用例事实更正：TC-L1-003 的码名改指实际发射码并经 `test-cases lock-suite --layer 1` 重锁，`decisions append` 留审计（判定强度与条数未减，未放宽门禁）
- [x] T6-11 发射面探针补实：MCP 声明-分发配对 + 引用面口径排除（导入快照/历史工件/债务登记/冻结研究/生成文档）+ 语料期望冲突判违反，E2 由 138→152 项且 advisory 归零
- [x] T6-12 R-0020 裁决落地：注册表新增 `reserved` 字段为唯一事实源（生成文档呈现「无发射点 + 现由哪条通道承担」，`error-declarations.ts` 由表推导，语料测试与探针同读一份清单）；8 码声明保留、2 码补发射点（E-SECURITY-003 MCP 必填参数、E-KNOWLEDGE-001 挂上 organize 的缺失字段发现并档位对齐）、1 码撤回（E-PONYTAIL-002 机械不可判定）
- [x] T6-13 敏感信息扫描落地：`src/guard/sensitive-info.ts` 固定模式集 + 掩码摘录 + audit 记录 + W-SECURITY-001，挂 `mumuspec check` 全量模式；guard-layer.md §5.3/§5.4 改述实际发射码与「不提供开关」的机制依据；7 条测试覆盖五种模式、掩码、扫描范围（跳过导入件与冻结历史）、每文件一条告警与净样本零写入
- [x] T6-14 第七探针 always-enforce-exception（E3）：例外清单条目须为求值面可见的 check id；实测 9 条目全部不参与折叠 ⇒ 新立 R-0021（两条修复路径各有前置条件，改名对齐属强度收紧需人工签收，故进 advisory 而非比值）

## 完成判据进度

| 判据 | 状态 |
|------|------|
| 三条闭合等式比值均为 1.0 | ✅ E1 76/76、E2 152/152、E3 5/5；advisory 剩 9 项属 R-0021（例外清单脱钩，裁决需人工签收强度语义），不计比值也不计通过 |
| §三 14 条裁决全部落地 | ⚠ 7/14（V1 非目标登记、V2 删声明、V3 hyperplan 删除、V4 team 命令面删除、V5 bundle publish 删除、V8 补隔离、V9/V10/V12 能力、V13/V14 死文件均已完成；V6 companion 收缩、V7 BOUNDARY 降格、V11 复用未动） |
| Q4 门认维度不认行数 | ✅ 端到端反证通过 |
| E-SPEC-006 出路为真实命令 | ✅ design-init 接线，且由 E1 fixSteps 探针锁定 |
| 工作树门与创建路径成对 | ✅ 强制档建树、降档留痕、缺失阻断三态齐备 |
| 四视图渲染确定性可复现 | ✅ 16 条断言 + CLI/MCP 双消费面 |
| 文档与代码差异表清零 | ⚠ 已清 7 处（sqlite 声明与 index.db、configuration/knowledge-layer 配置样例、team 命令面文档、E-DESIGN-009 假强制、glossary 的 DESIGN 域示例码、guard-layer 敏感信息条目所指码与「可配置开关」、STATUS 与 overview/goal 数字）；BOUNDARY 导出漂移待 T3-5 |
| 全量门禁相对基线无退化 | ✅ 313 文件 / 5455 用例全绿（基线 306/5416），tsc 0 错、check exit 0、enforce 0 error、ci:check 通过、docs:audit 四类全零、sync 幻影 0；未削弱任何门禁 |

## L7 Verify

- [x] T7-1 假设工件补齐（assumptions.yaml，AS-01..AS-05，`decision_ref` 指向 decisions.md 签收条目）——E-GUARD-008 完备性门经 `decisions append` 双签闭合，未手工编辑
- [x] T7-2 六层 build_layers 经 `state layer` 置 done；`verify_mode=full` 经 `state scale` 判定后由 `state set` 写入
- [x] T7-3 设计级 test-cases hash 经 CLI 复锁（`de30a25ade654286`）并以 `test-cases verify` 复核，W-GUARD-004 清零；六层 suite 保持锁定
- [x] T7-4 verify.md 落证：全量用例、六道门禁、总验收八判据逐条对照，含 E-VERIFY-003 的 manual 约束逐条核验（`src/mcp` 5 条 / `src/team` 6 条）与三条偏差记录（技能副本滞后、forks RPC 超时、advisory 不折算）
- [x] T7-5 `guard core-consolidation verify` 通过且无告警；`guard … archive-in-progress` 仅剩 E-VERIFY-002 branch_status 一项
- [ ] T7-6 分支收尾（提交/合并）与 BP-17 归档放行——涉及 git 写操作与将差分约束并入根规范，待用户执行；执行后 `state set … branch_status handled` 再转 archive

## 下一批（本变更内继续）

剩余人工/裁决项：R-0021 例外清单裁决（改名对齐属强度收紧，需人工签收）→ R-0022 无消费者的 team 引擎裁决 → T1-9 技能副本重装（写用户主目录）→ 本变更转 verify
