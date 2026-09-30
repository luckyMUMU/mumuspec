# Decision Log: core-consolidation


## [open] 2026-09-30T15:52:08.106Z

基线实测（重建 dist 后）：约束 384 条，enforced-strong 4 / weak 21 / manual 359 / unverifiable 0，declared_ratio 100%、strong_ratio 1.0%；顶层命令 58、MCP 工具 35 与 handler 35 对齐；测试文件 302、用例约 5335、无 skip/todo。实现度口径按三条闭合等式（声明⊆实现、实现⊆消费、门⊆事实）计算，本变更以该口径推进，禁止以削弱门禁换取变绿。

## [open] 2026-09-30T15:53:17.938Z

BP 签收方式：用户授权本变更全部必需阻塞点（BP-3/BP-4/BP-14/BP-17）预签收，由执行方带 --confirm 推进，每批次完成后交实测结果；不可逆动作（归档、版本 bump、发布）仍在 verify 前汇报。

## [build] 2026-09-30T17:16:07.069Z

锁定用例修正：TC-L1-003 原写 E-DESIGN-009（该码在装载面无发射点），实为 W-DESIGN-009（phase-guard.ts:441-447，建议级、不阻断，符合 CHG-5 过程约束 advisory 纪律）。仅更正事实指向，未放宽任何判定；suite 1 重新锁定。

## [build] 2026-09-30T18:25:28.141Z

R-0020 裁决落地：无发射点码由注册表 reserved 字段声明（生成文档与 conformance 同源），8 码声明保留、E-SECURITY-003 与 E-KNOWLEDGE-001 补发射点、E-PONYTAIL-002 撤回；敏感信息扫描接线（W-SECURITY-001，check 全量模式，无开关）。E2 实测 152/152、advisory 中错误码项归零。新立 R-0021：always_enforce 例外清单 9 条目不参与强度求值，改名对齐属收紧须人工签收，故进 advisory 不入比值。

## [build] 2026-09-30T18:49:03.650Z

T2-5 落地：选型表四字段完备性由 design→build 守卫以 W-DESIGN-012（建议级，CHG-5 过程约束不阻断）报告；findIncompleteSelections 增加字段丢失态且不误报非选型块。同批撤回两处过度声明：design-init 出口文案的选定后方可进入 Build、change-layer.md §11.3 指向 E-GUARD-008/E-DESIGN 段位的失实处置表。本变更 design.md 补 Security & Privacy 节（W-DESIGN-009 实测清零）。

## [build] 2026-09-30T19:08:12.755Z

T3-5 落地：BOUNDARY 判定源由'导出全集⊆文档'降格为'声明⊆代码'（前者每轮数百条未记录导出，常年全红等于无门禁）；幻影与归属错位分档 WARN/INFO，符号采集支持生成器与再导出并排除注释行。同批删除被遮蔽的 change/guard/install 遗留副本、迁移 team 遗留单份、补登 src/graph 边界与 index.yaml 注册。可达性核对发现 src/team 引擎零非测试引用，按'不得以有测试代替已接线'立 R-0022 裁决而非当场删除（超出已锁定设计范围）。

## [build] 2026-09-30T19:16:58.633Z

T3-6 落地：删除 src 内零消费者的第二套 AST 判定面 checkAstConstraints 与 eval/new-Function 识别链（no-eval/no-new-function 未在任何注解映射、约束类型表或禁令正文声明），AST 判定回归 provider 注册表单一来源；guard BOUNDARY 的对应行改指实际接口（reportSensitiveInfo / SensitiveFinding），新降格的声明⊆代码判定当场捕到这两行幻影并清零。复测 18/18 模块、312 文件 5448 用例全绿、E1 77/77 E2 153/153 E3 5/5、违反 0。

## [build] 2026-09-30T19:26:17.207Z

T5-8 落地：结构对账改由生成页承载——docs/reference/workflow-diagrams.md 为四视图的图数据投影（src/graph/doc-page.ts，build 末段重生成），docs:audit 以同一投影比对并定位首个差异行；散设文档内的手写图块不做结构比对（布局差异不可判定，比对即伪装门禁）。最终复测：313 文件 5455 用例全绿、E1 77/77 E2 153/153 E3 5/5 违反 0、sync 幻影 0、enforce 0 error、docs:audit 四类计数全零且 diagram drift=none。

## [design] 2026-09-30T19:27:09.667Z

假设签收（AS-01..AS-05 同批）：①实现程度以三条闭合等式（声明⊆实现／实现⊆消费／门⊆事实）判定，不以特性清单长度判定；②强度折叠的 check id 取值域是错误码与 hook 自建 id，故 always_enforce 例外清单需改名或退休才参与求值（R-0021）；③图示布局性差异不可机械判定，结构对账只覆盖生成页，不把手写图块伪装成门禁；④生成页不含变更状态，否则每次阶段移动都会抖动而使对账失去基线；⑤多语言 AST 与图谱持久化后端属产品非目标，本轮不为其建发射面。

## [verify] 2026-09-30T19:30:01.098Z

test-cases lock 重算 design_content_hash（de30a25ade654286，由 CLI 从磁盘推导，非手写）：Build 期间按层重锁 suite 1 使设计级锁定被重置，六层 suite 与磁盘内容一致后统一复锁；W-GUARD-004 随之清零，判定强度与用例条数未减。
