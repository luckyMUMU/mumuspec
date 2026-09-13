# Phase Guard 规则

> 层级: Level 2 参考文档

---

## 工作流规则与漂移检测守卫

### 工作流规则守卫（可配置）

工作流规则守卫 SHALL 按"显式配置 > 强度等级联动 > 默认值"的优先级求值:

1. **优先级 1**: `.mumuspec.yaml` 中 `workflow.*` 显式设置（true/false）— 直接生效
2. **优先级 2**: `constraint_strength.overrides.workflow.*`（非 `inherit`）— 覆盖强度等级
3. **优先级 3**: `constraint_strength.<dimension>` 强度等级 — 按维度联动
4. **优先级 4**: 默认值（high → 强制）

#### 显式配置行为（向后兼容 0.11.0）

- `workflow.worktree_isolation: true`（默认）→ 守卫检查 Worktree 隔离
- `workflow.worktree_isolation: false` → 守卫跳过 Worktree 检查，输出 WARN

- `workflow.single_active_change: true`（默认）→ 守卫检查单一活跃变更
- `workflow.single_active_change: false` → 守卫允许 N 个并行变更（上限默认 3）

- `workflow.top_down_design: true`（**非默认**：字面默认 false，TD=high 时有效值为 true）→ I1 设计覆盖断链**阻塞**（`E-GUARD-009`）
- `workflow.top_down_design: false` → I1 断链降级为恒可见 WARN（`W-GUARD-009`）；**不跳过检查**，`state.design_coverage` 三种强度下都写入

- `workflow.tdd_enforced: true`（默认）→ 守卫检查 TDD 红绿循环
- `workflow.tdd_enforced: false` → 守卫仅要求测试存在，不强制红绿循环

#### 强度等级联动行为（0.12.0+）

当 `workflow.*` 未显式设置或值为 `inherit` 时，按 `constraint_strength` 强度等级联动:

| 工作流规则 | 维度 | high | medium | low |
|-----------|------|------|--------|-----|
| `worktree_isolation` | RG | 强制 block | warn（允许 branch 降级） | info（关闭） |
| `single_active_change` | RG | 强制 1 个 | warn ≤3 并行 | info（无上限） |
| `top_down_design` | TD | block（I1 断链） | warn（I1 断链，恒可见） | info（不阻断，仍写工件） |
| `tdd_enforced` | TD | 强制 Red→Green→Refactor | warn（测试存在即可） | info（关闭） |

> 完整的强度等级映射、Phase Guard 检查项分级、阻塞点分级见 [动态约束强度系统](../design/constraint-strength.md#6-工作流限制的渐进式放开)。

### 漂移检测守卫分级

| 阶段 | 运行的漂移检测 | 阻断行为 |
|------|--------------|---------|
| Pre-commit | 仅 P0（spec_drift + shall_not_violation） | 阻断 git commit（low 强度下降为 WARN） |
| CI | P0 + P1（spec_drift + shall_not_violation + graph_drift + test_immutability_drift + ponytail_drift） | 阻断 PR 合并（SHALL NOT 不论强度始终阻断） |
| Report | P0 + P1 + P2（全部 12 种） | 仅生成报告 |

> **强度联动**：Low 强度下 Pre-commit 可降为 WARN，但 CI 阶段 SHALL NOT 违规始终阻断（属例外清单 `shall_not_violation_in_ci`）。

### Phase Guard 检查项分级（0.12.0+）

每个 Phase Guard 检查项标注 `min_strength` 字段。求值规则：

```typescript
function evaluate(check, currentStrength): 'block' | 'warn' | 'info' {
  // 1. 例外清单：始终 block
  if (check.always_enforce) return 'block';

  // 2. 当前强度低于 min_strength：跳过（info）
  if (rank(currentStrength) < rank(check.min_strength)) return 'info';

  // 3. 按当前强度执行
  return currentStrength === 'high' ? 'block'
       : currentStrength === 'medium' ? 'warn'
       : 'info';
}
```

完整检查项分级表见 [动态约束强度系统 §6.2](../design/constraint-strength.md#62-phase-guard-渐进式放开)。

## 正向转换守卫

> **文档与代码的一致性纪律（2026-09-12 收敛）**：本节此前的检查项清单列入了大量**代码中并不存在**
> 的字段（`design_layers_covered`、`each_layer_shall_defined`、`ponytail_constraints_defined`、
> `build_layers_completed_in_bottom_up_order`、`subagent_dispatch` 等）。已逐条裁决为"实现它"或
> "删掉它"，不留第三种状态。**下表即 `src/guard/phase-guard.ts` 的实际输出**，落点列给出函数名。

**级别图例**

| 标记 | 含义 |
|------|------|
| **E** | 以 ERROR 发出；再经 `applyStrengthToGuardResult()` 按 `ERROR_CODES[code].dimension` 与当前强度折叠（high→block / medium→warn / low→丢弃） |
| **E\*** | 同上，但该码标注 `always_enforce`，任何强度都不折叠 |
| **W** | 以 WARN 发出（强度为 low 时可被折叠丢弃） |
| **—** | 非本守卫职责，由其它层保证（见各节"非本守卫职责"） |

### open_to_design

实现落点：`checkOpenToDesign()`

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| proposal.md 存在且非空（≥10 字符） | E | `E-GUARD-001` |
| delta-specs/ 目录存在 | W | `E-GUARD-001` |
| affected_scopes 非空 | W | `E-GUARD-001` |
| decisions.md content_hash 匹配 | E\* | `E-CHANGE-007` |
| decisions_log.counts.open > 0 | W | `E-GUARD-001` |

**非本守卫职责**：`single_active_change` 于 `createChange()` 在变更创建时校验（`E-CHANGE-001`）；
`user_confirmed` 由 state-machine 的 `requiresUserConfirmation()` + CLI `--confirm` 保证；
worktree 隔离由 `createChange()` 的 `ensureChangeBranch()` / worktree 创建流程保证。

### open_to_build_hotfix

hotfix/tweak 预设路径：跳过 Design 直接进入 Build。
实现落点：`checkOpenToBuildHotfix()`

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| workflow ∈ {hotfix, tweak} | E | `E-CHANGE-006` |
| proposal.md 存在 | W | `W-GUARD-001` |
| build_layers 已定义 | W | `W-GUARD-001` |
| test-cases/ 目录存在 | W | `W-GUARD-001` |
| test_cases.design_locked | W | `W-GUARD-001` |
| tdd_mode 合法（tdd \| non-tdd）且等于 default_tdd_mode | E / W | `E-GUARD-001` / `W-GUARD-001` |

> CHG-5（0.20）：hotfix 路径只增结果约束，不加新的过程硬门。上表 W 项全部是可省略的过程建议，
> 真正的把关点是 `build_to_verify` 的"全部层完成"与 Verify 的"测试全绿"。

**非本守卫职责**：delta-specs/ 存在性、code-graph/impact-analysis.json、shall_not_new 记录、
suite-map.yaml、decisions_log.* —— 这些在 hotfix 路径**没有守卫检查**（此前文档声称有，已删除）。

### design_to_build

仅 `workflow === "full"`；hotfix/tweak 走 `open_to_build_hotfix`。
实现落点：`checkDesignToBuild()` + `checkCompletenessGate()` + `checkDesignCoverage()`

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| design.md 存在且非空（≥10 字符） | E | `E-GUARD-001` |
| constraints/ 下存在 new-shall.md 或 new-shall-not.md | W | `E-GUARD-001` |
| build_layers 已定义 | W | `W-GUARD-001` |
| test_cases.design_locked | W | `W-GUARD-001` |
| test-cases hash 匹配 design_content_hash | W | `W-GUARD-004` |
| tdd_mode 合法且等于 default_tdd_mode | E / W | `E-GUARD-001` / `W-GUARD-001` |
| design.md 结构化段落完整（`templates/design-schema.yaml` 驱动） | W | `W-DESIGN-009` |
| 跨工件一致性（proposal Plan 步骤 / FR-ID / delta-spec scope 须在 design 中出现） | W | `W-DESIGN-010` |
| 认知框架（仅 `workflow=full` 且 `enabled`）：cognitive_map_ref / Q1 / Q2 / Q3 / Q4 / converged | W | `W-DESIGN-001`..`006` |
| grill-me（`grill_me_result.phase = design`）：completed / rounds ≤ max / deferred 共识 | W | `W-DESIGN-007` / `008` / `011` |
| **完备性门禁**：open-questions.yaml 存在、schema 合法、无未消解 open 项、有签收 | E\* | `E-GUARD-008` |
| **I1 设计覆盖断链**（2026-09-12 新增）：覆盖 L*N* 必覆盖 L0..*N*-1 | E / W | `E-GUARD-009` / `W-GUARD-009` |

**I1 说明**：结论**始终写入** `state.design_coverage`（`covered_layers` / `expected_layers` /
`unreachable_from` / `checked_at` / `enforced`），三种强度下都不静默。级别由
`workflow.top_down_design` 的有效值决定（`resolveWorkflowRule()`：显式 override > 强度矩阵）；
默认 TD=medium → 有效值 false → **WARN 且恒可见**。

> **易踩的坑（2026-09-12 核查）**：`checkCrossArtifactConsistencySync()` 内部按
> `E-DESIGN-010` 构造，但**唯一调用点**（`phase-guard.ts:402-405`）把它整体重映射为
> `W-DESIGN-010` 后才放进 `warnings`。因此实际发出的是 `W-DESIGN-010`，而注册表里的
> `E-DESIGN-010` 在当前调用路径上**不会出现**。按字面量搜代码会得到错误结论——
> 判定"某个码是否真的会被发出"必须看调用点的映射，不能只看出错处的字面量。

**非本守卫职责**：`hyperplan_result.*`（`hard_constraints_merged` / `open_questions_resolved` /
`degraded`）字段存在于 `ChangeState` 但**无守卫消费者**——Hyperplan 的硬约束合并当前由
`phase-design` skill 的过程要求承担，不在守卫内；`design.md 无 TBD 未定义项`、`code-graph 无断裂调用链`
同样**没有实现**，已从本文档删除。

### build_to_verify

实现落点：`checkBuildToVerify()` + `checkLayerParallelism()` + `checkCompletenessGate()` + `collectUnchanneledDeltaConstraints()`

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| build_layers 全部 status = done | E | `E-GUARD-002` |
| test_cases.design_locked | W | `W-GUARD-004` |
| test_cases.suites_locked | W | `W-GUARD-004` |
| **I3 同层 scope 耦合**（2026-09-12 新增）：同 layer 多 scope 之间存在直接调用边 | W | `W-BUILD-001` |
| **完备性门禁**：assumptions.yaml（仅 `workflow=full`） | E\* | `E-GUARD-008` |
| **delta 约束通道核验**（2026-09-13 新增）：constraints/ 与 delta-specs/ 条目须具备验证通道（Enforcement 声明 / 词法锚点 / ast: 前缀），否则禁止进入 verify | E | `E-GUARD-010` |

**层间自下而上顺序**：由 `mumuspec state layer <name> <layer> <status>` 在**写入时**校验——
低层未全部 done 时拒绝把高层置 done（`--force` 可越过）。它不再是守卫检查项，因为顺序是**写时事实**，
事后无法从 `status` 字段反推。

**非本守卫职责**：tasks.md 勾选进度由 `mumuspec tasks next` 提供（只读定位，不做门禁）；
`isolation` / `build_mode` 字段由 `open` 阶段写入、守卫**不读**；`code committed` / `build_command passed` /
`code-graph updated` / `all test suites passed` / Ponytail 合规 —— **均无守卫检查**（Ponytail 合规由
`mumuspec check` 的 `checkPonytail()` 承担，是独立通道），已从本文档删除。

### verify_to_archive

实现落点：`checkVerifyToArchive(state, projectRoot, changeName, strict)`
（`strict` = `options.strength?.enforcement_strict !== false`）

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| verify.md 存在 | E | `E-GUARD-001` |
| build_layers 全部 status = done | E | `E-GUARD-002` |
| test immutability 校验（computeTestCasesHash vs design_content_hash） | W | `W-GUARD-004` |
| verify_result ∈ {pass, pass-with-deviations} | E | `E-VERIFY-001` |
| branch_status = handled | E | `E-VERIFY-002` |
| verify.md 含 SHALL / SHALL NOT 校验记录 | W | `W-VERIFY-001` |
| `strict` 时：受影响 scope 的 manual 类约束须在 verify.md 有验证记录（Enforcement ID 或原文锚定） | E | `E-VERIFY-003` |

**接受偏差**：与 `verify_to_archive` **是同一个函数**——`verify_result = pass-with-deviations` 走同一张表。
`accepted_deviations` / `deviation_reviewer` / `deviation_approved_at` **不由守卫校验**（此前文档声称校验，
已删除）；是否允许进入该路径由 state-machine 的 `requiresUserConfirmation()` + CLI `--confirm` 决定。

**非本守卫职责**：`no critical drift detected`、`code-graph integrity verified`、
`all_delta_spec_requirements_implemented`、`decisions_log.*` —— **均无守卫检查**，已从本文档删除。

## 反向回退守卫

实现落点：`src/change/state-machine.ts` 的 `executeRollback()` / `canRollback()` / `executeTransition()`
（`RollbackType` 定义于 `state-machine.ts:26-40`）。

四类回退边：

| RollbackType | from → to | 计数 |
|--------------|-----------|------|
| `build_to_design` | build → design | rollback |
| `verify_to_design` | verify → design | rollback |
| `verify_to_build` | verify → build | rebuild |
| `archive_ci_fail` | archive-in-progress → build | rollback |

**实际校验**（`executeRollback` / `canRollback`）

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| rollbackType 已知 | E | `E-CHANGE-006` |
| 当前 phase 等于边的 from | E | `E-CHANGE-006` |
| `rollback_count < rollback_limit`（countAs=rollback 时） | E | `E-CHANGE-002` |
| `rebuild_count < rebuild_limit`（countAs=rebuild 时；超限需升级为 Design 回退） | E | `E-CHANGE-003` |

**实际副作用**（`executeTransition()` 的 backward 分支，`state-machine.ts:235-271`）

- 追加 `rollback_history` 条目（`counted` = 该边是否计 rollback）
- countAs=rollback：`rollback_count++`；`build_layers` 全部重置为 `pending`；
  `test_cases` 重置为 `design_locked=false, suites_locked=false, suites_locked_layers=[], suites_hash={}`
- countAs=rebuild：`rebuild_count++`；仅把 `status === 'done'` 的层重置为 `pending`（保留 in-progress）
- 设置 `phase` 为边的 `to`

> **已知缺口（2026-09-12 核查，未修）**：本项目对规范文本的机械校验极强，对引擎自身的副作用却缺少一致性检查。
>
> 1. **快照从未落盘**：本节此前声称"save current artifacts to snapshots/xxx-rollback-N/"。
>    实现中 `saveSnapshot()`（`src/change/lifecycle.ts:348`）**零调用方**——回退不写任何快照。
> 2. **`rollback_reason` 不校验**：`reason` 仅作为 history 的文本字段传入，缺失或为空不报错。
> 3. **`user_confirmed` 不由引擎校验**：由 CLI 层 `requiresUserConfirmation()` + `--confirm` 保证。
> 4. **`archive_ci_fail` 不校验 CI 等级**：`ci_failure_level == "CRITICAL"` 无实现；
>    `verify_to_build` 的"具体失败层识别"同样无实现（只按 `countAs` 决定重置范围）。

## 废弃守卫

### discard_change

实现落点：`discardChange()`（`src/change/lifecycle.ts:206-280`）

| 检查项 | 级别 | 错误码 |
|--------|------|--------|
| phase ∉ {archive-completed, discarded}（终态不可回退） | E | `E-CHANGE-006` |
| 目录重命名成功（失败则不推进 phase，保留原状） | E | `E-CHANGE-010` |

**实际副作用**

- `changeDir → archive/discarded/<name>/`（`renameSync`；成功后才改 phase，避免 D2 式状态分裂）
- `phase = 'discarded'`，追加 `rollback_history` 条目（`counted: false, event: 'discard'`）
- `appendAuditLog`（成功/失败均记）
- 若存在 worktree → `removeWorktree()`（失败非致命，已废弃变更不回滚）

> **已知缺口**：`ensureDir(<changeDir>/snapshots/discard)` 只创建**空目录**（该目录随后随变更目录一起被移走），
> 并未复制任何工件。此前文档声称的"save current artifacts to snapshots/discard/"不成立。
> 另 `user_confirmed` / `discard_reason` 不由 `discardChange()` 校验（reason 仅入 history）。

## 终态守卫

### archive_is_terminal

`archive-completed` 为终态：`executeTransition()` 对其只允许 `discarded`；`discardChange()` 直接拒绝
（`E-CHANGE-006`，"终态不可回退"）。

### archive_complete

归档过程由 `archiveChange()`（`src/change/archive.ts`）与 `finalize-archive` 承担，**不是** Phase Guard。
下面区分"已实现"与"无实现"：

| 声称项 | 实际 |
|--------|------|
| change moved to archive/ | ✓ `moveDirSync`（注意 D2 教训：路径派生不变量在物理移动后失效） |
| delta-specs merged to main specs | ✓ `mergeDeltaSpecsToMain()`（**tweak 归档会跳过**，见 D4——携带 delta-spec 必须走 hotfix） |
| prohibitions.md updated / index.yaml updated | ✓ `finalize-archive` 内重建 |
| knowledge_extraction_completed / knowledge_pages_created_count > 0 / graph_bindings_verified / conflicts_resolved | ✓ `extractKnowledgeToGlobal()` |
| git_merge.merged / commit_sha recorded | ✓ `git_merge` 状态字段 |
| code-graph snapshot updated | ✓ finalize-archive 重建 code-graph 快照 |
| ~~spec changes committed to main branch~~ | ✗ 合并由人工 `git merge --no-ff` 完成——`mumuspec merge` 在分支模型下自相矛盾（D6） |
| ~~worktree cleaned up~~ | ✓ `worktree remove --force`（注意：未跟踪文件会随之一并丢失） |
| ~~remote branch deleted~~ | ✗ **无实现**，已删除该行 |
| ~~active_change_slot_released~~ | ✗ **无实现**（无显式 slot 结构；活跃性是按分支动态判定的），已删除该行 |

> **归档一致性自检**：`src/change/archive-consistency.ts` 提供 `E-ARCH-001/002/003`，接入
> `mumuspec check` 的 drift 数组——这是本项目唯一一处"引擎状态工件 ↔ 物理布局"一致性校验。

> **导航**: [← 配置](configuration.md) | [漂移检测 →](drift-detection.md) | [返回概览](../overview.md)
