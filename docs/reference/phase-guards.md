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

- `workflow.top_down_design: true`（默认）→ 守卫检查自顶向下设计
- `workflow.top_down_design: false` → 守卫跳过设计顺序检查

- `workflow.tdd_enforced: true`（默认）→ 守卫检查 TDD 红绿循环
- `workflow.tdd_enforced: false` → 守卫仅要求测试存在，不强制红绿循环

#### 强度等级联动行为（0.12.0+）

当 `workflow.*` 未显式设置或值为 `inherit` 时，按 `constraint_strength` 强度等级联动:

| 工作流规则 | 维度 | high | medium | low |
|-----------|------|------|--------|-----|
| `worktree_isolation` | RG | 强制 block | warn（允许 branch 降级） | info（关闭） |
| `single_active_change` | RG | 强制 1 个 | warn ≤3 并行 | info（无上限） |
| `top_down_design` | TD | 强制 Level 0→N | warn（允许跳跃） | info（关闭） |
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

### open_to_design

```yaml
checks:
  - proposal.md exists and non-empty
  - delta-specs/ has at least one spec file
  - affected_scopes defined in .mumuspec.yaml
  - code-graph/impact-analysis.json exists
  - single_active_change: true
  - worktree_created: true
  - brainstorming_completed: true       # hotfix/tweak 除外
  - decisions_log.counts.open > 0       # 至少 1 条决策
  - decisions_log.content_hash matches decisions.md actual hash
  - user_confirmed: true
  - knowledge_context_loaded: true                 # 0.10.0 新增：已加载 affected_scopes 的历史知识
on_fail: "Block transition, report missing artifacts, constraint violations, knowledge loading issues, or decisions.md issues"
```

### open_to_build_hotfix

hotfix/tweak 预设路径：跳过 Design 直接进入 Build。

```yaml
checks:
  - proposal.md exists and non-empty
  - delta-specs/ has at least one spec file
  - affected_scopes defined
  - code-graph/impact-analysis.json exists
  - single_active_change: true
  - worktree_created: true
  - workflow in ["hotfix", "tweak"]
  - build_layers defined (single layer, initialized in Open)
  - shall_not_new recorded
  - test-cases/ exists with at least one layer-0-cases.md
  - suite-map.yaml exists with single layer mapping
  - test_cases.design_locked: true
  - test_cases.design_content_hash matches test-cases/ actual hash
  - tdd_mode == "tdd"
  - decisions_log.counts.open > 0
  - decisions_log.content_hash matches
  - user_confirmed: true
note: "跳过 design 检查；但仍需 test-cases/ 定义与锁定；tweak 走此守卫后 Verify 走 light verify。hotfix/tweak 跳过 Design 阶段，不执行认知框架，无 cognitive-map.yaml 产出。"
```

### design_to_build

```yaml
checks:
  - design.md exists and non-empty
  - constraints/new-shall.md or new-shall-not.md exists
  - all enforcement checks are defined (not TBD)
  - code-graph verified no broken call chains
  - build_layers defined
  - design_layers_covered: [0,1,2,3]    # 自顶向下设计覆盖所有层级
  - each_layer_shall_defined: true
  - test-cases/ exists with at least one cases.md per layer
  - test_cases.design_locked: true
  - test_cases.design_content_hash matches test-cases/ actual hash
  - tdd_mode == "tdd"
  - hyperplan_result.hard_constraints all merged into design.md  # 仅 triggered==true 时检查
  - hyperplan_result.open_questions all resolved                 # 仅 triggered==true 时检查
  # 认知框架守卫（仅 workflow == "full" 时检查）
  - cognitive_framework.enabled: true                              # full 工作流必须启用
  - cognitive_framework.cognitive_map_ref exists                   # cognitive-map.yaml 存在
  - cognitive_framework.q1_count > 0                               # Q1 至少 1 条
  - cognitive_framework.q2_pending == 0 or cognitive_framework.rounds_completed >= 5  # Q2 无待处理或达上限
  - cognitive_framework.q3_pending == 0 or cognitive_framework.rounds_completed >= 5  # Q3 无待处理或达上限
  - cognitive_framework.q4_scans_completed >= 3                    # Q4 至少扫描 3 个维度
  - cognitive_framework.converged: true                            # 认知地图已收敛
  - ponytail_constraints_defined: true                             # 0.10.0 新增：design.md 包含 Ponytail 约束检查
  - decisions_log.counts.design > 0
  - decisions_log.content_hash matches
  - user_confirmed: true
on_fail: "Block, report missing design artifacts, test case issues, hyperplan issues, cognitive framework issues, or decisions.md issues"
```

> **认知框架说明**：hotfix/tweak 工作流跳过 Design 阶段，走 `open_to_build_hotfix` 守卫而非 `design_to_build`，因此不执行认知框架，上述认知框架检查项不适用。仅 `workflow == "full"` 时执行认知框架检查。

### build_to_verify

```yaml
checks:
  - all tasks.md items checked
  - code committed
  - build_command passed (if configured)
  - isolation field set (worktree preferred)
  - build_mode field set
  - tdd_mode == "tdd"
  - build_layers all status = done
  - build_layers_completed_in_bottom_up_order: true  # layer 3→0 顺序完成
  - each layer enforcement passed
  - code-graph updated after changes
  - test_cases.design_locked: true
  - test_cases.design_content_hash matches test-cases/ actual hash
  - test_cases.suites_locked: true
  - all layer suite hashes match suite-map.yaml
  - all test suites passed (green state)
  - ponytail_compliance_checked: true                              # 0.10.0 新增：Build 阶段已执行 Ponytail 合规检查
  - decisions_log.counts.build > 0
  - decisions_log.content_hash matches
on_fail: "Block, report incomplete tasks, failed build, test immutability violations, ponytail compliance issues, or decisions.md issues"
```

### verify_to_archive

```yaml
checks:
  - verify_result: pass
  - verify.md exists with report
  - all SHALL enforcements passed
  - all SHALL NOT enforcements passed
  - no critical drift detected
  - code-graph integrity verified
  - all build_layers verified bottom-up
  - all_delta_spec_requirements_implemented: true
  - test_immutability_verified: true
  - decisions_log.counts.verify > 0
  - decisions_log.content_hash matches
on_fail: "Block archive, report verification failures or decisions.md issues"
```

### verify_to_archive_with_deviations

接受偏差归档：rollback_limit 超限或用户主动选择接受偏差。

```yaml
checks:
  - verify_result: pass-with-deviations
  - verify.md exists with report
  - accepted_deviations non-empty
  - deviation_reviewer recorded
  - deviation_approved_at recorded
  - all SHALL NOT enforcements passed   # SHALL NOT 不可接受偏差
  - test_immutability_verified: true    # 测试不可变性不可接受偏差
  - no critical drift detected
  - code-graph integrity verified
  - decisions_log.counts.verify > 0
  - decisions_log.content_hash matches
  - user_confirmed: true
note: "SHALL 正向要求的偏差可接受；SHALL NOT 反向禁止的偏差不可接受"
```

## 反向回退守卫

### build_to_design_rollback

```yaml
checks:
  - user_confirmed: true
  - rollback_reason recorded
  - rollback_count < rollback_limit
on_fail: "Block rollback, require user to choose accept-deviations or discard"
side_effects:
  - save current Build artifacts to snapshots/build-rollback-N/ (never overwrite)
  - record rollback_reason + rollback_history (counted: true)
  - increment rollback_count
  - reset build_layers status to pending (preserve code, only reset status)
  - reset test_cases.design_locked to false
  - reset test_cases.suites_locked to false
  - clear test_cases.suites_locked_layers
  - clear test_cases.suites_hash
  - set phase: design
```

### verify_to_design_rollback

```yaml
checks:
  - user_confirmed: true
  - rollback_reason recorded
  - rollback_count < rollback_limit
side_effects:
  - save artifacts + verify report to snapshots/verify-rollback-N/
  - record rollback_reason + rollback_history (counted: true)
  - increment rollback_count
  - reset build_layers status to pending
  - reset test_cases.design_locked to false
  - reset test_cases.suites_locked to false
  - clear test_cases.suites_locked_layers
  - clear test_cases.suites_hash
  - set phase: design
```

### verify_to_build_rollback

```yaml
checks:
  - user_confirmed: true
  - rollback_reason recorded
  - rebuild_count < rebuild_limit       # 独立计数，不计入 rollback_count
  - specific failed build_layers identified
on_fail: "Block; if rebuild_limit exceeded, force upgrade to verify_to_design_rollback"
side_effects:
  - save verify report to snapshots/verify-rebuild-N/
  - record rollback_history (counted: false, event: verify-rebuild)
  - increment rebuild_count (NOT rollback_count)
  - reset only failed build_layers to pending
  - set phase: build
note: "不增加 rollback_count；超过 rebuild_limit 时强制升级为 verify_to_design_rollback"
```

### archive_ci_fail_rollback

```yaml
description: "Archive 阶段 CI CRITICAL 失败回退到 Build"
checks:
  - user_confirmed: true
  - ci_failure_level == "CRITICAL"
  - rollback_reason recorded (含 CI 失败详情)
  - rollback_count < rollback_limit
side_effects:
  - save archive artifacts to snapshots/archive-rollback-N/
  - record rollback_reason + rollback_history (counted: true)
  - increment rollback_count
  - set phase: build
note: "仅 archive-in-progress 子状态可触发；archive-completed 为终态不可回退"
```

## 废弃守卫

### discard_change

```yaml
description: "废弃变更（旁路操作，open/design/build/verify/archive-in-progress 均可发起）"
checks:
  - user_confirmed: true
  - discard_reason recorded
  - phase != "archive-completed"
  - phase != "discarded"
side_effects:
  - save current artifacts to snapshots/discard/
  - clean up worktree
  - move change to archive/discarded/
  - set phase: discarded
  - release active_change_slot
```

## 终态守卫

### archive_is_terminal

```yaml
description: "archive-completed 为终态，拒绝任何转换"
checks:
  - phase != "archive-completed"
on_fail: "Block: archive-completed is terminal"
```

### archive_complete

```yaml
checks:
  - git_merge.merged: true
  - git_merge.commit_sha recorded
  - delta-specs merged to main specs
  - prohibitions.md updated
  - index.yaml updated
  - code-graph snapshot updated
  - spec changes committed to main branch
  - knowledge_extraction_completed: true         # 0.9.0 新增：知识提取完成
  - knowledge_pages_created_count > 0            # 0.9.0 新增：至少创建 1 个知识页面
  - knowledge_graph_bindings_verified: true      # 0.9.0 新增：知识页面与代码节点绑定已验证
  - knowledge_conflicts_resolved: true           # 0.9.0 新增：知识冲突已处理
  - change moved to archive/
  - worktree cleaned up
  - remote branch deleted
  - active_change_slot_released: true
```

---

> **导航**: [← 配置](configuration.md) | [漂移检测 →](drift-detection.md) | [返回概览](../overview.md)
