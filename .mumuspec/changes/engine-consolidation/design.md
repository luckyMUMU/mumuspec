# Design: engine-consolidation

> 分节获批记录：§1-§3 用户确认（含 E-GUARD-013 恒不可 force）；§4-§6 随批呈现。

## L1 根因修复：通道标记剥离归一

- `src/spec/verifier-classify.ts` 导出 `stripChannelMarker(text): string`（`^\s*(ast|lex):\s*` 剥离），`isRegexCheckable` 内部由现仅剥 `ast:` 统一为共用该函数。
- `src/guard/checker.ts` 三入口先剥再判：`isCoexistenceConstraint`、`isAgentBehaviorConstraint`、词法违规扫描的 prohibition 文本入参（E-GUARD-003 展示文本仍用原文，不丢标记信息）。
- legacy 守卫 `!text.startsWith('ast:') && !text.startsWith('lex:')` 判定改为对剥离后文本判断（语义等价，写法归一）。
- 分类判定序（R1→R4）不动；`legacy_lexical_channel=true` 时既有 R2 行为零变化红线保持。

## L2 behavior-gate 契约变更

### 类型与语法
`MachineReadableAnnotation`：`type` 联合追加 `'behavior-gate'`；新增可选 `gate_ref?: string`，仅两形态：
- `error-code:E-<DOMAIN>-<NNN>` —— 该红线由已注册错误码门禁把守；
- `corpus:<fixture-dir>` —— 该红线由具名语料场景把守。

### 校验器（`src/guard/gate-validator.ts`，纯函数 + fs 只读）
`resolveGate(annotation, registryCodes, corpusIndex): {ok:true} | {ok:false, reason}`：
- error-code 形态：`ERROR_CODES` 含该码 **且** `.eval-corpus/**/expected.yaml` 至少一条 mustContain 含该码（复用 `loadFixtureExpectation` 枚举，语料↔发射面挂钩红线的正方向落实）；
- corpus 形态：fixture 目录存在且其 expected.yaml 的 mustContain 非空；
- 静态核验，不 spawn、不做语义判断。`corpusIndex` 由调用方构建一次共享（每 check 一轮）。

### 分类与执行
- `classifyConstraint`：R1 扩展——`annotation.type==='behavior-gate' && gate 核验 ok` ⇒ `enforced-strong`；核验失败 ⇒ 仍入 strong 候选但发射 **E-GUARD-013 GATE_POINTER_UNRESOLVED**（ERROR，forceable: false，dimension requirement_goals，min_strength high，always_enforce: true——悬空指针即假强制，任何强度组合恒可见）。
- SHALL/SHALL NOT 双极性、spec.md frontmatter 注解与 constraints.yaml 条目注解（复用 constraintEntryToItem 通道）同标准。
- tech.md 契约变更节写明 gate 语义边界：strong 的证据=门禁存在+语料杀伤，违规扫描由被指门禁自身承担；防"strong=自行扫描"误读。

## L3 诚实降档与翻闸拆分

- 批 A（根 spec.md B/D 族群逐条清单先行）：C 类有门禁证据者挂 `behavior-gate`；B 类挂单测指针者→`manual(单测指针：路径)`；D 类 roadmap 9 条→`manual(指针：roadmap validator 候选)`，validator 本体另立后续变更（新引擎面不入本批）。
- 显式化解锁：L1 修复后，21 条 legacy_weak 中可挂 gate 者转 strong、可挂 `lex:` 真实扫描者转显式 weak（豁免类不再误报）、其余 manual——目标 `legacy_weak ≤ 8` 且逐条可解释。
- doctor advisory：输出 legacy 兜底条目清单（复用 coverage.actionable_weak，代码推导）。
- `review/legacy-flip-decision-2026-09-20.md`：翻闸 breaking 分析 + 回退路径；本轮默认值不动。

## 错误处理
- gate_ref 缺失/形态不识别 ⇒ 视为悬空指针 E-GUARD-013（fail-closed）。
- .eval-corpus 缺失 ⇒ corpusIndex 为空，一切 code 指针悬空（dogfood 仓库必有；外部项目无 corpus 时挂 gate 即报错——正确的诚实）。
- expected.yaml 解析失败 ⇒ 该 fixture 不计入索引 + 既有静默丢弃红线由语料侧通道保障（不新增）。

## 测试策略（红绿，锁后不可变）
- L1：stripChannelMarker 表驱动；同路径等价（豁免/agent 行为/词法三类）；fixture `bad-lex-exempt-001`。
- L2：gate 五态单测；E-GUARD-013 注册与 registry 文档再生；fixture `bad-gate-001`（悬空→必中 013）+ `clean-05`（合法→0 误报）；corpus-fixtures 计数 16→17 同批。
- L3：迁移清单工件化（逐条映射进 changes/engine-consolidation/migration/）；`legacy_weak` 数值断言；doctor advisory 输出含 actionable_weak。
- 回归：vitest 全量 / eval run eval-corpus --report / ci-check / check+validate。

## 完成判据
1. 带/不带前缀执行路径等价单测绿（假强制根因清零）；
2. E-GUARD-013 注册、悬空即阻断、不可 force；
3. `legacy_weak ≤ 8`，strong ≥ 迁移清单实际核验通过数（不预设造假线）；
4. 全部门禁绿 + STATUS 对账 0 矛盾 + AGENTS 与 delta-spec 一致。

## 明确不做
- 不改 R1→R4 判定序与既有兼容面；不新增解析引擎；不翻默认闸；不做 roadmap validator（后续变更）；不支持 unit-test 指针形态。
