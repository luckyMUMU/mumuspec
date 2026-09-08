# Error Codes Reference

> **Auto-generated** from `src/core/errors.ts`. Do not edit manually.
> Run `node scripts/gen-error-codes-doc.mjs` to regenerate.

Last updated: 2026-09-08

## Summary

| Domain | Count |
|--------|-------|
| SPEC | 15 |
| CHANGE | 13 |
| VERIFY | 3 |
| FINAL | 1 |
| HOOK | 1 |
| MERGE | 10 |
| GUARD | 8 |
| PONYTAIL | 4 |
| CONTRACT | 11 |
| KNOWLEDGE | 3 |
| DESIGN | 4 |
| SECURITY | 3 |
| STATE | 1 |
| AGENTS | 1 |
| RULES | 1 |
| CHECK | 1 |
| GIT | 3 |
| **Total** | **83** |

## SPEC Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-SPEC-001` | SPEC_FORMAT_INVALID | ERROR | spec.md YAML frontmatter 格式错误 | No |
| `E-SPEC-002` | SPEC_LAYER_EXCEED_MAX | ERROR | 规范层级超过 max_layer_depth | No |
| `E-SPEC-003` | SPEC_INHERITANCE_CONFLICT | ERROR | 子层 SHALL NOT 与父层 SHALL 矛盾 | No |
| `E-SPEC-004` | SPEC_ENFORCEMENT_MISSING | WARN | SHALL 无验证声明（无 Enforcement、无 annotation，P0 语义收窄：仅指 SHALL；SHALL NOT 走 E-SPEC-015） | No |
| `E-SPEC-005` | SPEC_DRIFT_DETECTED | ERROR | spec.md 声明的 Requirement 在代码中无实现 | No |
| `E-SPEC-006` | SPEC_DESIGN_DOC_MISSING | ERROR | 有 spec.md 但无 design.md | No |
| `E-SPEC-007` | SPEC_INDEX_OUTDATED | WARN | index.yaml 与实际目录结构不一致 | Yes |
| `E-SPEC-008` | PRD_FRONTMATTER_INVALID | ERROR | prd.md YAML frontmatter 缺少必填字段 (layer, scope) | No |
| `E-SPEC-009` | TECH_FRONTMATTER_INVALID | ERROR | tech.md YAML frontmatter 缺少必填字段 (layer, scope) | No |
| `E-SPEC-010` | PARENT_SPEC_NOT_FOUND | ERROR | parent_prd 或 parent_tech 指向的文件不存在 | No |
| `E-SPEC-011` | DISTRIBUTED_SPEC_FORMAT_INVALID | WARN | 分布式 prd.md/tech.md 使用非 Requirement 块格式 | Yes |
| `E-SPEC-012` | DIST_SPEC_SHALL_UNIMPLEMENTED | ERROR | tech.md 中声明的 SHALL 约束在代码中找不到实现 | No |
| `E-SPEC-013` | UNDEFINED_MUMUSPEC_DIRECTORY | ERROR | .mumuspec/ 下存在未定义的目录 | No |
| `E-SPEC-014` | UNDEFINED_MUMUSPEC_FILE | ERROR | .mumuspec/ 下存在未定义的文件 | No |
| `E-SPEC-015` | SPEC_SHALL_NOT_UNVERIFIABLE | ERROR | SHALL NOT 红线无可验证通道（无 annotation、正则兜底不可提取、无 manual 声明） | No |

### `E-SPEC-001`: SPEC_FORMAT_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: spec.md YAML frontmatter 格式错误

**Fix Steps**:
1. 检查 layer/scope/last_updated 字段类型
2. 运行 mumuspec validate 重新校验

### `E-SPEC-002`: SPEC_LAYER_EXCEED_MAX

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 规范层级超过 max_layer_depth

**Fix Steps**:
1. 检查目录嵌套深度
2. 调整 config.yaml: specs.max_layer_depth

### `E-SPEC-003`: SPEC_INHERITANCE_CONFLICT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 子层 SHALL NOT 与父层 SHALL 矛盾

**Fix Steps**:
1. 检查继承链
2. 调整子层 SHALL NOT 或父层 SHALL

### `E-SPEC-004`: SPEC_ENFORCEMENT_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: SHALL 无验证声明（无 Enforcement、无 annotation，P0 语义收窄：仅指 SHALL；SHALL NOT 走 E-SPEC-015）

**Fix Steps**:
1. 为该约束补充 Enforcement 检查规则
2. 或标记为 enforcement: manual(原因)
3. 或补充 frontmatter annotation

### `E-SPEC-005`: SPEC_DRIFT_DETECTED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: spec.md 声明的 Requirement 在代码中无实现

**Fix Steps**:
1. 检查是否遗漏实现
2. 或更新 spec.md 移除该 Requirement

### `E-SPEC-006`: SPEC_DESIGN_DOC_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 有 spec.md 但无 design.md

**Fix Steps**:
1. 运行 mumuspec design init <scope> 创建 design.md

### `E-SPEC-007`: SPEC_INDEX_OUTDATED

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: index.yaml 与实际目录结构不一致

**Fix Steps**:
1. 运行 mumuspec validate --update-index

### `E-SPEC-008`: PRD_FRONTMATTER_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: prd.md YAML frontmatter 缺少必填字段 (layer, scope)

**Fix Steps**:
1. 添加 layer 和 scope 字段
2. 运行 mumuspec validate 重新校验

### `E-SPEC-009`: TECH_FRONTMATTER_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: tech.md YAML frontmatter 缺少必填字段 (layer, scope)

**Fix Steps**:
1. 添加 layer 和 scope 字段
2. 运行 mumuspec validate 重新校验

### `E-SPEC-010`: PARENT_SPEC_NOT_FOUND

- **Severity**: ERROR
- **Forceable**: No
- **Description**: parent_prd 或 parent_tech 指向的文件不存在

**Fix Steps**:
1. 检查路径是否正确
2. 创建缺失的父文档或移除引用

### `E-SPEC-011`: DISTRIBUTED_SPEC_FORMAT_INVALID

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 分布式 prd.md/tech.md 使用非 Requirement 块格式

**Fix Steps**:
1. 使用 ## Requirement: <name> 格式定义约束
2. 运行 mumuspec validate --verbose

### `E-SPEC-012`: DIST_SPEC_SHALL_UNIMPLEMENTED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: tech.md 中声明的 SHALL 约束在代码中找不到实现

**Fix Steps**:
1. 检查代码是否满足约束
2. 或更新 tech.md 移除/调整约束

### `E-SPEC-013`: UNDEFINED_MUMUSPEC_DIRECTORY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: .mumuspec/ 下存在未定义的目录

**Fix Steps**:
1. 移除未定义的目录
2. 或将其内容合并到已定义的目录中

### `E-SPEC-014`: UNDEFINED_MUMUSPEC_FILE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: .mumuspec/ 下存在未定义的文件

**Fix Steps**:
1. 移除未定义的文件
2. 或将其内容合并到已定义的 spec 文件中

### `E-SPEC-015`: SPEC_SHALL_NOT_UNVERIFIABLE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: SHALL NOT 红线无可验证通道（无 annotation、正则兜底不可提取、无 manual 声明）

**Fix Steps**:
1. 补充 frontmatter annotation（enforced-strong）
2. 或改写文本使引号词可被正则兜底提取（enforced-weak）
3. 或声明 Enforcement `- ID: manual(原因)`

## CHANGE Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-CHANGE-001` | CHANGE_ALREADY_ACTIVE | ERROR | 已有活跃变更，无法创建新变更 | No |
| `E-CHANGE-002` | CHANGE_ROLLBACK_LIMIT | ERROR | rollback_count 达到上限 | No |
| `E-CHANGE-003` | CHANGE_REBUILD_LIMIT | ERROR | rebuild_count 达到上限，强制升级为 Design 回退 | No |
| `E-CHANGE-004` | CHANGE_TEST_CASES_LOCKED | ERROR | 尝试修改已锁定的 test-cases/ | No |
| `E-CHANGE-005` | CHANGE_WORKTREE_FAIL | ERROR | worktree 创建失败 | No |
| `E-CHANGE-006` | CHANGE_PHASE_INVALID_TRANSITION | ERROR | 非法状态机转换 | No |
| `E-CHANGE-007` | CHANGE_DECISIONS_HASH_MISMATCH | ERROR | decisions.md content_hash 不匹配 | No |
| `E-CHANGE-008` | CHANGE_SCOPE_OVERFLOW | ERROR | 变更 affected_scopes 超出当前作用域子树 | No |
| `E-CHANGE-009` | CHANGE_BRANCH_CREATE_FAILED | ERROR | 自动创建变更分支失败（已回退变更目录） | No |
| `E-CHANGE-010` | CHANGE_DISCARD_MOVE_FAILED | ERROR | 废弃变更时目录移动失败，变更保留在原位置 | No |
| `E-CHANGE-011` | CHANGE_ARCHIVE_MOVE_FAILED | ERROR | 归档变更时目录移动失败，变更保留在原位置 | No |
| `E-CHANGE-020` | CHANGE_ARTIFACT_SCHEMA_INVALID | ERROR | 完备性工件 schema 非法（open-questions.yaml / assumptions.yaml 违反 schema v1） | No |
| `E-CHANGE-021` | CHANGE_RESOLUTION_CHAIN_BROKEN | ERROR | 工件 resolution 链断裂（decision_ref 在 decisions.md 中无对应条目，或 deferred 缺 note） | No |

### `E-CHANGE-001`: CHANGE_ALREADY_ACTIVE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 已有活跃变更，无法创建新变更

**Fix Steps**:
1. 完成或 Discard 当前变更
2. mumuspec list 查看活跃变更

### `E-CHANGE-002`: CHANGE_ROLLBACK_LIMIT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: rollback_count 达到上限

**Fix Steps**:
1. 接受偏差归档
2. 废弃变更
3. 手动提升上限（需审批）

### `E-CHANGE-003`: CHANGE_REBUILD_LIMIT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: rebuild_count 达到上限，强制升级为 Design 回退

**Fix Steps**:
1. 系统自动升级为 verify_to_design_rollback

### `E-CHANGE-004`: CHANGE_TEST_CASES_LOCKED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 尝试修改已锁定的 test-cases/

**Fix Steps**:
1. 回退到 Design: mumuspec rollback <name> --to design

### `E-CHANGE-005`: CHANGE_WORKTREE_FAIL

- **Severity**: ERROR
- **Forceable**: No
- **Description**: worktree 创建失败

**Fix Steps**:
1. 检查磁盘空间和权限
2. 降级为 branch 模式

### `E-CHANGE-006`: CHANGE_PHASE_INVALID_TRANSITION

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 非法状态机转换

**Fix Steps**:
1. 检查当前 phase
2. 参考 Phase Guard 确认可转换路径

### `E-CHANGE-007`: CHANGE_DECISIONS_HASH_MISMATCH

- **Severity**: ERROR
- **Forceable**: No
- **Description**: decisions.md content_hash 不匹配

**Fix Steps**:
1. 检查 decisions.md 是否被手动修改
2. 从 snapshots/ 恢复正确版本

### `E-CHANGE-008`: CHANGE_SCOPE_OVERFLOW

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更 affected_scopes 超出当前作用域子树

**Fix Steps**:
1. 缩减 affected_scopes 到当前作用域子树内
2. 或在父级作用域创建变更

### `E-CHANGE-009`: CHANGE_BRANCH_CREATE_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 自动创建变更分支失败（已回退变更目录）

**Fix Steps**:
1. 检查 git 仓库状态与分支名冲突
2. 解决后重新执行 mumuspec new

### `E-CHANGE-010`: CHANGE_DISCARD_MOVE_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 废弃变更时目录移动失败，变更保留在原位置

**Fix Steps**:
1. 检查目标目录是否已存在
2. 手动将变更目录移到 .mumuspec/changes/archive/discarded/

### `E-CHANGE-011`: CHANGE_ARCHIVE_MOVE_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 归档变更时目录移动失败，变更保留在原位置

**Fix Steps**:
1. 检查目标目录是否已存在
2. 手动将变更目录移到 .mumuspec/changes/archive/

### `E-CHANGE-020`: CHANGE_ARTIFACT_SCHEMA_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 完备性工件 schema 非法（open-questions.yaml / assumptions.yaml 违反 schema v1）

### `E-CHANGE-021`: CHANGE_RESOLUTION_CHAIN_BROKEN

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 工件 resolution 链断裂（decision_ref 在 decisions.md 中无对应条目，或 deferred 缺 note）

## VERIFY Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-VERIFY-001` | VERIFY_RESULT_NOT_PASS | ERROR | verify_result 不为 pass（验证未通过不等于通过；偏差须走 accept-deviations 旁路） | No |
| `E-VERIFY-002` | BRANCH_STATUS_UNHANDLED | ERROR | 变更分支状态未处理（branch_status 未标记 handled） | No |
| `E-VERIFY-003` | MANUAL_EVIDENCE_MISSING | ERROR | verify.md 缺少 manual 类约束的验证记录（按 Enforcement ID 或约束文本锚定） | Yes |

### `E-VERIFY-001`: VERIFY_RESULT_NOT_PASS

- **Severity**: ERROR
- **Forceable**: No
- **Description**: verify_result 不为 pass（验证未通过不等于通过；偏差须走 accept-deviations 旁路）

**Fix Steps**:
1. 修复验证失败项后重新验证
2. 或走 accept-deviations 旁路并记录偏差

### `E-VERIFY-002`: BRANCH_STATUS_UNHANDLED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更分支状态未处理（branch_status 未标记 handled）

**Fix Steps**:
1. 合并或清理变更分支
2. 更新 state.branch_status 为 handled

### `E-VERIFY-003`: MANUAL_EVIDENCE_MISSING

- **Severity**: ERROR
- **Forceable**: Yes
- **Description**: verify.md 缺少 manual 类约束的验证记录（按 Enforcement ID 或约束文本锚定）

**Fix Steps**:
1. 在 verify.md 中为每条 manual 约束补充验证记录（引用其 Enforcement ID 或原文）
2. 或将约束的 Enforcement 改为可自动执行的通道后重新验证
3. 或走 accept-deviations 旁路并记录偏差

## FINAL Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-FINAL-001` | FINALIZE_STATE_INVALID | ERROR | finalize 前置状态不满足（变更未归档或 phase 非 archive-completed） | No |

### `E-FINAL-001`: FINALIZE_STATE_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: finalize 前置状态不满足（变更未归档或 phase 非 archive-completed）

**Fix Steps**:
1. 先运行 mumuspec state transition <name> archive 完成归档流程
2. 再执行 finalize

## HOOK Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-HOOK-001` | HOOK_CHANGE_OWNERSHIP | ERROR | 分支上无活跃变更，直接提交将绕过 MumuSpec 流程 | No |

### `E-HOOK-001`: HOOK_CHANGE_OWNERSHIP

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 分支上无活跃变更，直接提交将绕过 MumuSpec 流程

**Fix Steps**:
1. 运行 mumuspec new <name> 创建变更并切换到变更分支
2. 或将该分支加入 ci.ownership_ci_branches 白名单

## MERGE Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-MERGE-001` | MERGE_CHANGE_NOT_FOUND | ERROR | 变更不存在，无法合并 | No |
| `E-MERGE-002` | MERGE_NOT_ARCHIVED | ERROR | 变更未归档，禁止合并分支 | No |
| `E-MERGE-003` | MERGE_BRANCH_NOT_HANDLED | ERROR | 变更分支代码未提交（branch_status 未置 handled） | No |
| `E-MERGE-004` | MERGE_ISOLATION_INVALID | ERROR | 变更不是分支隔离模式或缺少分支信息 | No |
| `E-MERGE-005` | MERGE_NOT_ON_MAIN | ERROR | 必须在主分支上执行合并 | No |
| `E-MERGE-006` | MERGE_WORKING_TREE_DIRTY | ERROR | 当前工作区有未提交改动，禁止合并 | No |
| `E-MERGE-007` | MERGE_BRANCH_MISSING | ERROR | 变更分支不存在 | No |
| `E-MERGE-008` | MERGE_MAIN_BRANCH_MISSING | ERROR | 未找到 main/master 主分支 | No |
| `E-MERGE-009` | MERGE_GATE_REJECTED | ERROR | 合并门禁未通过 | No |
| `E-MERGE-010` | MERGE_CONFLICT | ERROR | 合并发生冲突，已暂停 | No |

### `E-MERGE-001`: MERGE_CHANGE_NOT_FOUND

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更不存在，无法合并

**Fix Steps**:
1. 确认变更名称正确
2. mumuspec list 查看活跃/归档变更

### `E-MERGE-002`: MERGE_NOT_ARCHIVED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更未归档，禁止合并分支

**Fix Steps**:
1. 先执行 mumuspec archive <name> --confirm 归档变更
2. 归档完成后再合并

### `E-MERGE-003`: MERGE_BRANCH_NOT_HANDLED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更分支代码未提交（branch_status 未置 handled）

**Fix Steps**:
1. 提交分支代码后执行 mumuspec guard <name> archive-in-progress --apply --confirm

### `E-MERGE-004`: MERGE_ISOLATION_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更不是分支隔离模式或缺少分支信息

**Fix Steps**:
1. 确认 config.yaml changes.default_isolation 为 branch
2. 检查变更 state.branch 字段

### `E-MERGE-005`: MERGE_NOT_ON_MAIN

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 必须在主分支上执行合并

**Fix Steps**:
1. 切换到主分支 (git checkout main/master) 后重试

### `E-MERGE-006`: MERGE_WORKING_TREE_DIRTY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 当前工作区有未提交改动，禁止合并

**Fix Steps**:
1. 提交或 stash 当前改动后重试

### `E-MERGE-007`: MERGE_BRANCH_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更分支不存在

**Fix Steps**:
1. 确认变更分支是否已被删除
2. 检查 git branch -a

### `E-MERGE-008`: MERGE_MAIN_BRANCH_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 未找到 main/master 主分支

**Fix Steps**:
1. 确认仓库存在 main 或 master 分支

### `E-MERGE-009`: MERGE_GATE_REJECTED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 合并门禁未通过

**Fix Steps**:
1. 查看门禁错误详情并逐项修复

### `E-MERGE-010`: MERGE_CONFLICT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 合并发生冲突，已暂停

**Fix Steps**:
1. 手动解决冲突 (git status)
2. git add <files> && git commit
3. 重新执行 mumuspec merge

## GUARD Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-GUARD-001` | GUARD_ARTIFACT_MISSING | ERROR | Phase Guard 检查发现工件缺失 | No |
| `E-GUARD-002` | GUARD_SHALL_VIOLATION | ERROR | SHALL 约束未满足 | Yes |
| `E-GUARD-003` | GUARD_SHALL_NOT_VIOLATION | ERROR | SHALL NOT 约束被违反 | No |
| `E-GUARD-004` | GUARD_TEST_IMMUTABILITY | ERROR | 测试用例或套件 hash 不匹配 | No |
| `E-GUARD-005` | GUARD_HYPERPLAN_NOT_MERGED | ERROR | hyperplan 硬约束未合并到 design.md | No |
| `E-GUARD-006` | GUARD_HYPERPLAN_OPEN_QUESTIONS | ERROR | hyperplan 开放问题未解决 | No |
| `E-GUARD-007` | GUARD_PRE_COMMIT_TIMEOUT | WARN | Pre-commit 检查超过 5s | Yes |
| `E-GUARD-008` | GUARD_COMPLETENESS_GATE_BLOCK | ERROR | 完备性门禁阻塞（工件缺失 / 存在未消解 open 项 / 工件为空 / 声明路径缺人工签收） | No |

### `E-GUARD-001`: GUARD_ARTIFACT_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: Phase Guard 检查发现工件缺失

**Fix Steps**:
1. 查看守卫报告确认缺失工件
2. 补充缺失工件

### `E-GUARD-002`: GUARD_SHALL_VIOLATION

- **Severity**: ERROR
- **Forceable**: Yes
- **Description**: SHALL 约束未满足

**Fix Steps**:
1. 实现 SHALL 要求
2. 或调整 spec.md 降低约束

### `E-GUARD-003`: GUARD_SHALL_NOT_VIOLATION

- **Severity**: ERROR
- **Forceable**: No
- **Description**: SHALL NOT 约束被违反

**Fix Steps**:
1. 移除违规代码
2. SHALL NOT 不可通过 --force 跳过

### `E-GUARD-004`: GUARD_TEST_IMMUTABILITY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 测试用例或套件 hash 不匹配

**Fix Steps**:
1. 检查文件是否被手动修改
2. 从 snapshots/ 恢复

### `E-GUARD-005`: GUARD_HYPERPLAN_NOT_MERGED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: hyperplan 硬约束未合并到 design.md

**Fix Steps**:
1. 将硬约束合并到 design.md 的 SHALL/SHALL NOT

### `E-GUARD-006`: GUARD_HYPERPLAN_OPEN_QUESTIONS

- **Severity**: ERROR
- **Forceable**: No
- **Description**: hyperplan 开放问题未解决

**Fix Steps**:
1. 查看开放问题列表
2. 用户决策后标记为 resolved

### `E-GUARD-007`: GUARD_PRE_COMMIT_TIMEOUT

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: Pre-commit 检查超过 5s

**Fix Steps**:
1. 考虑缩小检查范围
2. 优化规则性能

### `E-GUARD-008`: GUARD_COMPLETENESS_GATE_BLOCK

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 完备性门禁阻塞（工件缺失 / 存在未消解 open 项 / 工件为空 / 声明路径缺人工签收）

**Fix Steps**:
1. 起草并消解 open-questions.yaml / assumptions.yaml（resolution.decision_ref 指向 decisions.md 条目）
2. 或在 design.md 声明 <!-- no-open-questions --> / <!-- no-assumptions --> 并先落 decisions.md 签收条目

## PONYTAIL Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-PONYTAIL-001` | PONYTAIL_YAGNI_VIOLATION | WARN | 引入了未被请求的抽象层或功能 | Yes |
| `E-PONYTAIL-002` | PONYTAIL_UNNECESSARY_DEPENDENCY | ERROR | 在标准库/平台特性已满足时引入新依赖 | No |
| `E-PONYTAIL-003` | PONYTAIL_BOILERPLATE | WARN | 生成未被请求的样板代码 | Yes |
| `E-PONYTAIL-004` | PONYTAIL_CLEVER_OVER_SIMPLE | WARN | 用复杂方案替代简单方案 | Yes |

### `E-PONYTAIL-001`: PONYTAIL_YAGNI_VIOLATION

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 引入了未被请求的抽象层或功能

**Fix Steps**:
1. 删除不必要的抽象
2. 或用 ponytail: 注释标记理由

### `E-PONYTAIL-002`: PONYTAIL_UNNECESSARY_DEPENDENCY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 在标准库/平台特性已满足时引入新依赖

**Fix Steps**:
1. 使用标准库/平台特性替代
2. 或使用已有依赖

### `E-PONYTAIL-003`: PONYTAIL_BOILERPLATE

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 生成未被请求的样板代码

**Fix Steps**:
1. 删除样板代码
2. 使用最小可工作实现

### `E-PONYTAIL-004`: PONYTAIL_CLEVER_OVER_SIMPLE

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 用复杂方案替代简单方案

**Fix Steps**:
1. 简化为 boring 方案
2. 或用 ponytail: 注释标记理由

## CONTRACT Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-CONTRACT-001` | BOUNDARY_DOC_MISSING | WARN | 有代码的目录缺少 BOUNDARY.md 边界文档 | Yes |
| `E-CONTRACT-002` | BOUNDARY_EXPORT_NOT_FOUND | ERROR | BOUNDARY.md 声明的对外接口在代码中未找到实现 | No |
| `E-CONTRACT-003` | BOUNDARY_DEPENDENCY_UNUSED | WARN | BOUNDARY.md 声明的依赖在代码中未发现实际使用 | Yes |
| `E-CONTRACT-004` | BOUNDARY_CHANGELOG_EMPTY | WARN | BOUNDARY.md 缺少变更日志 | Yes |
| `E-CONTRACT-005` | CONTRACT_SOURCE_MISSING | ERROR | contracts.yaml 声明的契约源文件不存在 | No |
| `E-CONTRACT-006` | CONTRACT_DEPRECATED_IN_USE | WARN | 已标记为 deprecated 的契约仍被上游消费者使用 | Yes |
| `E-CONTRACT-007` | CONTRACT_SCHEMA_MISSING | WARN | 契约缺少 schema 定义 | Yes |
| `E-CONTRACT-008` | CONTRACT_GRAPH_INCONSISTENT | WARN | 契约依赖图中引用了不存在的契约 ID | Yes |
| `E-CONTRACT-009` | CONTRACT_BREAKING_CHANGE | ERROR | 检测到破坏性契约变更，但未提供迁移路径 | No |
| `E-CONTRACT-010` | CONTRACT_LOCK_TIMEOUT | ERROR | 获取契约文件锁超时（5s），另一个进程可能正在修改契约 | No |
| `E-CONTRACT-011` | CONTRACT_REGISTRY_INVALID | ERROR | 契约注册表文件结构无效（缺少必需字段或含 __proto__/constructor/prototype 污染键） | No |

### `E-CONTRACT-001`: BOUNDARY_DOC_MISSING

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 有代码的目录缺少 BOUNDARY.md 边界文档

**Fix Steps**:
1. 创建 BOUNDARY.md 并声明对外接口、依赖、数据契约
2. 运行 mumuspec drift --fix-auto

### `E-CONTRACT-002`: BOUNDARY_EXPORT_NOT_FOUND

- **Severity**: ERROR
- **Forceable**: No
- **Description**: BOUNDARY.md 声明的对外接口在代码中未找到实现

**Fix Steps**:
1. 实现缺失的接口
2. 或更新 BOUNDARY.md 移除该声明

### `E-CONTRACT-003`: BOUNDARY_DEPENDENCY_UNUSED

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: BOUNDARY.md 声明的依赖在代码中未发现实际使用

**Fix Steps**:
1. 移除未使用的依赖声明
2. 或在代码中补充引入该依赖

### `E-CONTRACT-004`: BOUNDARY_CHANGELOG_EMPTY

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: BOUNDARY.md 缺少变更日志

**Fix Steps**:
1. 在 BOUNDARY.md 中添加变更日志条目

### `E-CONTRACT-005`: CONTRACT_SOURCE_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: contracts.yaml 声明的契约源文件不存在

**Fix Steps**:
1. 创建源文件
2. 或更新 contracts.yaml 修正 source 路径

### `E-CONTRACT-006`: CONTRACT_DEPRECATED_IN_USE

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 已标记为 deprecated 的契约仍被上游消费者使用

**Fix Steps**:
1. 提供迁移路径 (migrationPath)
2. 或通知消费者切换到新契约

### `E-CONTRACT-007`: CONTRACT_SCHEMA_MISSING

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 契约缺少 schema 定义

**Fix Steps**:
1. 在 contracts.yaml 中为契约添加 schema 字段

### `E-CONTRACT-008`: CONTRACT_GRAPH_INCONSISTENT

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 契约依赖图中引用了不存在的契约 ID

**Fix Steps**:
1. 修正 outbound_ids / inbound_ids 或补全缺失的契约定义

### `E-CONTRACT-009`: CONTRACT_BREAKING_CHANGE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 检测到破坏性契约变更，但未提供迁移路径

**Fix Steps**:
1. 为破坏性变更添加 migrationPath
2. 执行影响分析并征询用户同意后修改

### `E-CONTRACT-010`: CONTRACT_LOCK_TIMEOUT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 获取契约文件锁超时（5s），另一个进程可能正在修改契约

**Fix Steps**:
1. 等待其他 mumuspec 进程完成
2. 检查并删除陈旧锁目录 .mumuspec/contracts/.lock

### `E-CONTRACT-011`: CONTRACT_REGISTRY_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 契约注册表文件结构无效（缺少必需字段或含 __proto__/constructor/prototype 污染键）

**Fix Steps**:
1. 检查 contracts.json/contracts.yaml 的 version、contracts、outbound_ids、inbound_ids 结构
2. 文件损坏时从版本控制恢复，或重新生成契约注册表

## KNOWLEDGE Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-KNOWLEDGE-001` | KNOWLEDGE_PAGE_FORMAT_INVALID | ERROR | 知识页面 YAML frontmatter 格式错误 | No |
| `E-KNOWLEDGE-002` | KNOWLEDGE_EXTRACTION_FAIL | ERROR | Archive 阶段知识提取失败 | No |
| `E-KNOWLEDGE-003` | KNOWLEDGE_PAGE_NOT_FOUND | ERROR | PageIndex 引用的知识页面文件不存在 | No |

### `E-KNOWLEDGE-001`: KNOWLEDGE_PAGE_FORMAT_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 知识页面 YAML frontmatter 格式错误

**Fix Steps**:
1. 检查 frontmatter 字段
2. 运行 mumuspec knowledge verify --id <id>

### `E-KNOWLEDGE-002`: KNOWLEDGE_EXTRACTION_FAIL

- **Severity**: ERROR
- **Forceable**: No
- **Description**: Archive 阶段知识提取失败

**Fix Steps**:
1. 检查变更工件完整性
2. 重新执行 mumuspec knowledge extract <change>

### `E-KNOWLEDGE-003`: KNOWLEDGE_PAGE_NOT_FOUND

- **Severity**: ERROR
- **Forceable**: No
- **Description**: PageIndex 引用的知识页面文件不存在

**Fix Steps**:
1. 检查 _index.yaml 条目
2. 恢复文件或更新索引

## DESIGN Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-DESIGN-001` | COGNITIVE_MAP_MISSING | ERROR | cognitive-map.yaml 不存在 | No |
| `E-DESIGN-009` | DESIGN_SCHEMA_SECTION_MISSING | ERROR | design.md 缺少 templates/design-schema.yaml 要求的必填 section | No |
| `E-DESIGN-010` | CROSS_ARTIFACT_INCONSISTENCY | ERROR | proposal 与 design 跨工件不一致（Plan 步骤未映射到 Layers、FR 未被 design 引用） | No |
| `E-DESIGN-002` | COGNITIVE_Q1_EMPTY | ERROR | Q1 已知的已知为空 | No |

### `E-DESIGN-001`: COGNITIVE_MAP_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: cognitive-map.yaml 不存在

**Fix Steps**:
1. 回退到 Design
2. 执行认知框架 Step 0

### `E-DESIGN-009`: DESIGN_SCHEMA_SECTION_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: design.md 缺少 templates/design-schema.yaml 要求的必填 section

**Fix Steps**:
1. 按 schema 补充缺失的 section
2. 运行 mumuspec guard <change> design --verbose 查看匹配规则

### `E-DESIGN-010`: CROSS_ARTIFACT_INCONSISTENCY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: proposal 与 design 跨工件不一致（Plan 步骤未映射到 Layers、FR 未被 design 引用）

**Fix Steps**:
1. 在 design.md 中补充对应 Layer 或 FR 引用
2. 或修正 proposal.md 使步骤与设计对齐

### `E-DESIGN-002`: COGNITIVE_Q1_EMPTY

- **Severity**: ERROR
- **Forceable**: No
- **Description**: Q1 已知的已知为空

**Fix Steps**:
1. 检查 proposal.md 和 spec.md 是否已加载
2. 重新执行 Stage 1 信息采集

## SECURITY Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-SECURITY-001` | SECURITY_PATH_TRAVERSAL | ERROR | CLI 参数路径超出项目根目录 | No |
| `E-SECURITY-002` | CHANGE_NAME_INVALID | ERROR | 变更名称含非法字符（路径分隔符或 .. 序列） | No |
| `E-SECURITY-003` | MCP_PATH_REQUIRED | ERROR | MCP 工具调用未提供 path 参数或参数类型错误 | No |

### `E-SECURITY-001`: SECURITY_PATH_TRAVERSAL

- **Severity**: ERROR
- **Forceable**: No
- **Description**: CLI 参数路径超出项目根目录

**Fix Steps**:
1. 使用项目内相对路径
2. 不使用 ../ 等路径逃逸符号

### `E-SECURITY-002`: CHANGE_NAME_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更名称含非法字符（路径分隔符或 .. 序列）

**Fix Steps**:
1. 使用字母数字 + . _ - 组合的名称
2. 名称不能以 . 或 - 开头

### `E-SECURITY-003`: MCP_PATH_REQUIRED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: MCP 工具调用未提供 path 参数或参数类型错误

**Fix Steps**:
1. 检查调用参数是否包含有效的 path 字符串
2. 确保 path 为相对路径且非空

## STATE Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-STATE-001` | STATE_PROTECTED_FIELD | ERROR | state set 尝试修改受保护字段（认知/测试/阶段等），且 guard.bypass_audit=false 拒绝绕过 | No |

### `E-STATE-001`: STATE_PROTECTED_FIELD

- **Severity**: ERROR
- **Forceable**: No
- **Description**: state set 尝试修改受保护字段（认知/测试/阶段等），且 guard.bypass_audit=false 拒绝绕过

**Fix Steps**:
1. 通过 guard --apply 正规流程推进阶段
2. 如需绕过请在 config.yaml 设置 guard.bypass_audit: true 并接受审计

## AGENTS Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-AGENTS-001` | AGENTS_SPEC_DRIFT | ERROR | AGENTS.md 与 spec 内容漂移（生成的 rules 基于旧版规范） | No |

### `E-AGENTS-001`: AGENTS_SPEC_DRIFT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: AGENTS.md 与 spec 内容漂移（生成的 rules 基于旧版规范）

**Fix Steps**:
1. 重新运行 mumuspec init 同步 AGENTS.md 与 agents-hash.json

## RULES Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-RULES-001` | RULES_BUDGET_EXCEEDED | ERROR | 生成的 Rules 产物超过 32KiB 容量预算（禁止在 Rules 文件中内联全量规范上下文） | No |

### `E-RULES-001`: RULES_BUDGET_EXCEEDED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 生成的 Rules 产物超过 32KiB 容量预算（禁止在 Rules 文件中内联全量规范上下文）

**Fix Steps**:
1. 缩减 Rules 内容：渐进式披露职责归 MCP，Rules 文件仅保留摘要与速查
2. 检查 spec 摘要是否被全量内联（应为逐层摘要而非全文）

## CHECK Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-CHECK-001` | CHECK_ACTION_FAILED | ERROR | mumuspec check 执行过程中发生未预期错误（compliance / drift / glossary 任一子系统抛错） | No |

### `E-CHECK-001`: CHECK_ACTION_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: mumuspec check 执行过程中发生未预期错误（compliance / drift / glossary 任一子系统抛错）

**Fix Steps**:
1. 查看下方错误信息定位具体子系统
2. 修复后重新运行 mumuspec check

## GIT Domain

| Code | Name | Severity | Description | Forceable |
|------|------|----------|-------------|-----------|
| `E-GIT-001` | GIT_SPAWN_FAILED | ERROR | git 命令无法启动（未安装 git 或不在 PATH 中） | No |
| `E-GIT-002` | GIT_COMMAND_FAILED | ERROR | git 命令执行失败（非零退出码） | No |
| `E-GIT-003` | GIT_MAIN_BRANCH_NOT_FOUND | ERROR | 未找到 main 或 master 主分支 | No |

### `E-GIT-001`: GIT_SPAWN_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: git 命令无法启动（未安装 git 或不在 PATH 中）

**Fix Steps**:
1. 确认已安装 git 且 git --version 可正常执行
2. 检查 PATH 环境变量包含 git

### `E-GIT-002`: GIT_COMMAND_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: git 命令执行失败（非零退出码）

**Fix Steps**:
1. 根据下方输出排查 git 失败原因
2. 确认当前目录是有效的 git 仓库
3. 检查分支/提交引用是否存在

### `E-GIT-003`: GIT_MAIN_BRANCH_NOT_FOUND

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 未找到 main 或 master 主分支

**Fix Steps**:
1. 确认仓库已初始化且存在 main/master 分支
2. 或手动指定目标分支
