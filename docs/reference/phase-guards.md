# Phase Guard 规则

> 层级: Level 2 参考文档

---

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
on_fail: "Block transition, report missing artifacts, constraint violations, or decisions.md issues"
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
note: "跳过 design 检查；但仍需 test-cases/ 定义与锁定；tweak 走此守卫后 Verify 走 light verify"
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
  - decisions_log.counts.design > 0
  - decisions_log.content_hash matches
  - user_confirmed: true
on_fail: "Block, report missing design artifacts, test case issues, hyperplan issues, cognitive framework issues, or decisions.md issues"
```

> **认知框架豁免**：hotfix 工作流豁免 `q2_pending == 0` 和 `q3_pending == 0` 检查，仅要求 `q1_count > 0` 和 `q4_scans_completed >= 3`（轻量模式）。tweak 工作流完全豁免认知框架检查。

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
  - decisions_log.counts.build > 0
  - decisions_log.content_hash matches
on_fail: "Block, report incomplete tasks, failed build, test immutability violations, or decisions.md issues"
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
  - change moved to archive/
  - worktree cleaned up
  - remote branch deleted
  - active_change_slot_released: true
```

---

> **导航**: [← 配置](configuration.md) | [漂移检测 →](drift-detection.md) | [返回概览](../overview.md)
