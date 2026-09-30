# Error Codes Reference

> **Auto-generated** from `src/core/errors.ts`. Do not edit manually.
> Run `node scripts/gen-error-codes-doc.mjs` to regenerate.

Last updated: 2026-09-30

## Summary

| Domain | Count |
|--------|-------|
| SPEC | 19 |
| GRAPH | 1 |
| CONSTRAINT | 3 |
| CHANGE | 16 |
| VERIFY | 4 |
| FINAL | 1 |
| HOOK | 1 |
| MERGE | 10 |
| GUARD | 15 |
| BUILD | 1 |
| PONYTAIL | 1 |
| CONTRACT | 11 |
| KNOWLEDGE | 1 |
| DESIGN | 17 |
| SECURITY | 5 |
| STATE | 1 |
| AGENTS | 1 |
| RULES | 1 |
| CHECK | 2 |
| SKILL | 3 |
| GIT | 3 |
| **Total** | **117** |

## SPEC Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-SPEC-001` | SPEC_FORMAT_INVALID | ERROR | spec.md YAML frontmatter 格式错误 | No | 有发射点 |
| `E-SPEC-002` | SPEC_LAYER_EXCEED_MAX | ERROR | 规范层级超过 max_layer_depth | No | 有发射点 |
| `E-SPEC-003` | SPEC_INHERITANCE_CONFLICT | ERROR | 子层 SHALL NOT 与父层 SHALL 矛盾 | No | 有发射点 |
| `E-SPEC-004` | SPEC_ENFORCEMENT_MISSING | WARN | SHALL 无验证声明（无 Enforcement、无 annotation，P0 语义收窄：仅指 SHALL；SHALL NOT 走 E-SPEC-015） | No | 有发射点 |
| `E-SPEC-005` | SPEC_DRIFT_DETECTED | ERROR | spec.md 声明的 Requirement 在代码中无实现 | No | 声明保留（无发射点） |
| `E-SPEC-006` | SPEC_DESIGN_DOC_MISSING | ERROR | 有 spec.md 但无 design.md | No | 有发射点 |
| `E-SPEC-007` | SPEC_INDEX_OUTDATED | WARN | index.yaml 与实际目录结构不一致 | Yes | 声明保留（无发射点） |
| `E-SPEC-008` | PRD_FRONTMATTER_INVALID | ERROR | prd.md YAML frontmatter 缺少必填字段 (layer, scope) | No | 有发射点 |
| `E-SPEC-009` | TECH_FRONTMATTER_INVALID | ERROR | tech.md YAML frontmatter 缺少必填字段 (layer, scope) | No | 有发射点 |
| `E-SPEC-010` | PARENT_SPEC_NOT_FOUND | ERROR | parent_prd 或 parent_tech 指向的文件不存在 | No | 有发射点 |
| `E-SPEC-011` | DISTRIBUTED_SPEC_FORMAT_INVALID | WARN | 分布式 prd.md/tech.md 使用非 Requirement 块格式 | Yes | 有发射点 |
| `E-SPEC-012` | DIST_SPEC_SHALL_UNIMPLEMENTED | ERROR | tech.md 中声明的 SHALL 约束在代码中找不到实现 | No | 声明保留（无发射点） |
| `E-SPEC-013` | UNDEFINED_MUMUSPEC_DIRECTORY | ERROR | .mumuspec/ 下存在未定义的目录 | No | 有发射点 |
| `E-SPEC-014` | UNDEFINED_MUMUSPEC_FILE | ERROR | .mumuspec/ 下存在未定义的文件 | No | 有发射点 |
| `E-SPEC-016` | SPEC_REUSE_SOURCE_UNRESOLVED | ERROR | 约束复用请求无法解析上游：来源范围不存在、条目不存在，或来源自身没有上游（越权约束不得扩散） | No | 有发射点 |
| `E-SPEC-017` | SPEC_REUSE_LOOSENS_STRENGTH | ERROR | 复用不得放宽来源约束强度：下层只可收紧，不可放宽 | No | 有发射点 |
| `E-SPEC-015` | SPEC_SHALL_NOT_UNVERIFIABLE | ERROR | SHALL NOT 红线无可验证通道（无 annotation、无 ast:/lex: 前缀、无 manual 声明） | No | 有发射点 |
| `W-SPEC-016` | STRUCTURE_VAGUE_QUALIFIER | WARN | 约束文本含无界限定词（合理/适当/必要时/尽量等），结构上不可判定满足与否 | Yes | 有发射点 |
| `W-SPEC-017` | MANUAL_IMPLICIT_LEGACY | WARN | Enforcement 为 legacy 自由文本（implicit-manual），建议改写为显式 manual(reason) 以便 verify 证据机器校验 | Yes | 有发射点 |

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
- **无发射点**: 声明与实现的覆盖核对由 mumuspec drift 通道承担；本码无发射点（DS-EVAL-004 裁决，M1 出范围）。

**Fix Steps**:
1. 检查是否遗漏实现
2. 或更新 spec.md 移除该 Requirement

### `E-SPEC-006`: SPEC_DESIGN_DOC_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 有 spec.md 但无 design.md

**Fix Steps**:
1. 用 mumuspec design-init <scope> 生成含选型表的 design.md 骨架，再补齐 frontmatter

### `E-SPEC-007`: SPEC_INDEX_OUTDATED

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: index.yaml 与实际目录结构不一致
- **无发射点**: 索引一致性核对由 PageIndex 重建与 mumuspec sync 承担；本码无发射点（DS-EVAL-004 裁决，M1 出范围）。

**Fix Steps**:
1. 运行 mumuspec sync 对齐 index.yaml 与实际目录结构

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
2. 运行 mumuspec validate 重新校验

### `E-SPEC-012`: DIST_SPEC_SHALL_UNIMPLEMENTED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: tech.md 中声明的 SHALL 约束在代码中找不到实现
- **无发射点**: 约束→实现的可验证性判定归 annotation/enforcement 通道（E-SPEC-004/015）；本码无发射点（DS-EVAL-004 裁决，M1 出范围）。

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

### `E-SPEC-016`: SPEC_REUSE_SOURCE_UNRESOLVED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 约束复用请求无法解析上游：来源范围不存在、条目不存在，或来源自身没有上游（越权约束不得扩散）

**Fix Steps**:
1. 用 mumuspec constraints list 确认来源 scope 与条目 ID 存在
2. 先为来源条目补 source_specs（指向定义它的规范标题），再复用

### `E-SPEC-017`: SPEC_REUSE_LOOSENS_STRENGTH

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 复用不得放宽来源约束强度：下层只可收紧，不可放宽

**Fix Steps**:
1. 保持与来源相同的 min_strength，或用 --tighten 提高到更强档

### `E-SPEC-015`: SPEC_SHALL_NOT_UNVERIFIABLE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: SHALL NOT 红线无可验证通道（无 annotation、无 ast:/lex: 前缀、无 manual 声明）

**Fix Steps**:
1. 补充 frontmatter annotation（enforced-strong），或改写文本使引号词可被正则兜底提取（enforced-weak，legacy 兜底或显式 lex: 前缀）
2. 或对可 AST 判定的红线使用 `ast:` 前缀接 AST 通道
3. 或声明 Enforcement `- ID: manual(原因)`

### `W-SPEC-016`: STRUCTURE_VAGUE_QUALIFIER

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 约束文本含无界限定词（合理/适当/必要时/尽量等），结构上不可判定满足与否

**Fix Steps**:
1. 改写为可判定的具体动作或数值边界
2. 或拆分为枚举化的具体条件分支
3. 如模糊确属必要，在 Enforcement manual(...) 中说明人工核验方式

### `W-SPEC-017`: MANUAL_IMPLICIT_LEGACY

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: Enforcement 为 legacy 自由文本（implicit-manual），建议改写为显式 manual(reason) 以便 verify 证据机器校验

**Fix Steps**:
1. 改写为显式声明：`- ID: manual(核验方式)`
2. 或补充结构化证据记录 {constraintId, user, verdict, timestamp, evidence_hash}（evidence_hash 由 CLI computeHash 计算）

## GRAPH Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `W-GRAPH-001` | PHASE_BPS_SKILL_MISMATCH | WARN | 引擎 phase_bps 与 skill 侧 workflow.yaml 声明的 BP 集合不一致（缺声明或多余声明） | No | 有发射点 |

### `W-GRAPH-001`: PHASE_BPS_SKILL_MISMATCH

- **Severity**: WARN
- **Forceable**: No
- **Description**: 引擎 phase_bps 与 skill 侧 workflow.yaml 声明的 BP 集合不一致（缺声明或多余声明）

**Fix Steps**:
1. 核对 src/change/workflow.default.yaml（引擎侧权威）的 workflows.<wf>.phase_bps
2. 核对 skills/mumuspec/workflow.yaml（skill 侧结构化 BP 定义）的 phases/presets blocking_points
3. 按 design.md 的映射表补齐缺失或删除多余声明；skill 侧文件缺失时本检查自动跳过（fail-open）

## CONSTRAINT Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-CONSTRAINT-001` | CONSTRAINT_SOURCE_MISSING | ERROR | 约束条目缺少 source_specs（越权约束 — 无上游来源，不属于任何层级） | No | 有发射点 |
| `E-CONSTRAINT-002` | CONSTRAINT_SOURCE_FILE_MISSING | ERROR | 约束的来源文件不存在（悬空来源） | No | 有发射点 |
| `W-CONSTRAINT-003` | CONSTRAINT_SOURCE_ANCHOR_MISSING | WARN | 约束的来源锚点在目标文件中找不到对应标题（锚点漂移） | No | 有发射点 |

### `E-CONSTRAINT-001`: CONSTRAINT_SOURCE_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 约束条目缺少 source_specs（越权约束 — 无上游来源，不属于任何层级）

**Fix Steps**:
1. 为该约束补 source_specs，指向定义它的更高层规范标题
2. 或删除该约束（无来源即无授权）

### `E-CONSTRAINT-002`: CONSTRAINT_SOURCE_FILE_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 约束的来源文件不存在（悬空来源）

**Fix Steps**:
1. 修正 source_specs 的路径
2. 或删除该来源标注

### `W-CONSTRAINT-003`: CONSTRAINT_SOURCE_ANCHOR_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: 约束的来源锚点在目标文件中找不到对应标题（锚点漂移）

**Fix Steps**:
1. 把锚点改为目标规范中真实存在的标题（归一化后子串匹配）

## CHANGE Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-CHANGE-001` | CHANGE_ALREADY_ACTIVE | ERROR | 已有活跃变更，无法创建新变更 | No | 有发射点 |
| `E-CHANGE-002` | CHANGE_ROLLBACK_LIMIT | ERROR | rollback_count 达到上限 | No | 有发射点 |
| `E-CHANGE-003` | CHANGE_REBUILD_LIMIT | ERROR | rebuild_count 达到上限，强制升级为 Design 回退 | No | 有发射点 |
| `E-CHANGE-004` | CHANGE_TEST_CASES_LOCKED | ERROR | 尝试修改已锁定的 test-cases/ | No | 声明保留（无发射点） |
| `E-CHANGE-006` | CHANGE_PHASE_INVALID_TRANSITION | ERROR | 非法状态机转换 | No | 有发射点 |
| `E-CHANGE-007` | CHANGE_DECISIONS_HASH_MISMATCH | ERROR | decisions.md content_hash 不匹配 | No | 有发射点 |
| `E-CHANGE-008` | CHANGE_SCOPE_OVERFLOW | ERROR | 变更 affected_scopes 超出当前作用域子树 | No | 有发射点 |
| `E-CHANGE-009` | CHANGE_BRANCH_CREATE_FAILED | ERROR | 自动创建变更分支失败（已回退变更目录） | No | 有发射点 |
| `E-CHANGE-010` | CHANGE_DISCARD_MOVE_FAILED | ERROR | 废弃变更时目录移动失败，变更保留在原位置 | No | 有发射点 |
| `E-CHANGE-011` | CHANGE_ARCHIVE_MOVE_FAILED | ERROR | 归档变更时目录移动失败，变更保留在原位置 | No | 有发射点 |
| `E-CHANGE-012` | CHANGE_TWEAK_CARRIES_SPEC | ERROR | tweak 工作流归档会跳过 delta-spec 与知识合并，携带规范工件的变更不得用 tweak 归档 | No | 有发射点 |
| `E-CHANGE-013` | CHANGE_ACTIVE_CAPACITY_EXCEEDED | ERROR | 关闭单一活跃变更后，活跃变更数已达 workflow.max_active_changes 上限 | No | 有发射点 |
| `E-CHANGE-014` | CHANGE_WORKTREE_CREATE_FAILED | ERROR | 工作树创建失败——隔离未成立时不得继续推进阶段 | No | 有发射点 |
| `E-CHANGE-020` | CHANGE_ARTIFACT_SCHEMA_INVALID | ERROR | 完备性工件 schema 非法（open-questions.yaml / assumptions.yaml 违反 schema v1） | No | 有发射点 |
| `E-CHANGE-021` | CHANGE_RESOLUTION_CHAIN_BROKEN | ERROR | 工件 resolution 链断裂（decision_ref 在 decisions.md 中无对应条目，或 deferred 缺 note） | No | 有发射点 |
| `E-CHANGE-022` | DELTA_MERGE_INCOMPLETE | ERROR | 归档合并 delta-spec 存在未解决文件（目标缺失或读写失败），delta 内容未被合并，禁止静默归档 | No | 有发射点 |

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
- **无发射点**: 锁定后的改动由 hash 复核承担（W-GUARD-004 / E-CHANGE-022），不存在写入前置门；本码保留注册位、无发射点。

**Fix Steps**:
1. 回退到 Design: mumuspec state transition <name> design --reason <原因>

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

### `E-CHANGE-012`: CHANGE_TWEAK_CARRIES_SPEC

- **Severity**: ERROR
- **Forceable**: No
- **Description**: tweak 工作流归档会跳过 delta-spec 与知识合并，携带规范工件的变更不得用 tweak 归档

**Fix Steps**:
1. 改用 hotfix 工作流归档（mumuspec new <name> --workflow hotfix）
2. 或将 delta-specs/ 与 constraints/ 内容迁出到 hotfix 变更后再归档

### `E-CHANGE-013`: CHANGE_ACTIVE_CAPACITY_EXCEEDED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 关闭单一活跃变更后，活跃变更数已达 workflow.max_active_changes 上限

**Fix Steps**:
1. 归档或 Discard 至少一个活跃变更（mumuspec archive <name> --confirm / mumuspec discard <name>）
2. 或按团队容量调高 workflow.max_active_changes

### `E-CHANGE-014`: CHANGE_WORKTREE_CREATE_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 工作树创建失败——隔离未成立时不得继续推进阶段

**Fix Steps**:
1. 按报错原因修复 git 环境（脏工作树、分支冲突、路径占用）
2. 或显式降级为分支隔离：changes.default_isolation: branch（降级会留审计痕）

### `E-CHANGE-020`: CHANGE_ARTIFACT_SCHEMA_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 完备性工件 schema 非法（open-questions.yaml / assumptions.yaml 违反 schema v1）

### `E-CHANGE-021`: CHANGE_RESOLUTION_CHAIN_BROKEN

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 工件 resolution 链断裂（decision_ref 在 decisions.md 中无对应条目，或 deferred 缺 note）

### `E-CHANGE-022`: DELTA_MERGE_INCOMPLETE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 归档合并 delta-spec 存在未解决文件（目标缺失或读写失败），delta 内容未被合并，禁止静默归档

**Fix Steps**:
1. 为 delta 文件命名后缀对应的目标 scope 创建 .mumuspec/tech.md 或 .mumuspec/prd.md（<-scope>-tech.md / <-scope>-prd.md）
2. 或修正 delta 文件命名后缀使其匹配已存在的目标 scope
3. 或确认 delta 内容已废弃后删除该 delta-spec 文件，重新执行归档

## VERIFY Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-VERIFY-001` | VERIFY_RESULT_NOT_PASS | ERROR | verify_result 不为 pass（验证未通过不等于通过；偏差须走 accept-deviations 旁路） | No | 有发射点 |
| `E-VERIFY-002` | BRANCH_STATUS_UNHANDLED | ERROR | 变更分支状态未处理（branch_status 未标记 handled） | No | 有发射点 |
| `E-VERIFY-003` | MANUAL_EVIDENCE_MISSING | ERROR | verify.md 缺少 manual 类约束的验证记录（按 Enforcement ID 或约束文本锚定） | Yes | 有发射点 |
| `W-VERIFY-001` | VERIFY_SHALL_RECORD_MISSING | WARN | verify.md 未包含 SHALL / SHALL NOT 校验记录 | No | 有发射点 |

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

### `W-VERIFY-001`: VERIFY_SHALL_RECORD_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: verify.md 未包含 SHALL / SHALL NOT 校验记录

**Fix Steps**:
1. 在 verify.md 中补充 SHALL / SHALL NOT 的逐条校验结论

## FINAL Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-FINAL-001` | FINALIZE_STATE_INVALID | ERROR | finalize 前置状态不满足（变更未归档或 phase 非 archive-completed） | No | 有发射点 |

### `E-FINAL-001`: FINALIZE_STATE_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: finalize 前置状态不满足（变更未归档或 phase 非 archive-completed）

**Fix Steps**:
1. 先运行 mumuspec state transition <name> archive 完成归档流程
2. 再执行 finalize

## HOOK Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-HOOK-001` | HOOK_CHANGE_OWNERSHIP | ERROR | 分支上无活跃变更，直接提交将绕过 MumuSpec 流程 | No | 有发射点 |

### `E-HOOK-001`: HOOK_CHANGE_OWNERSHIP

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 分支上无活跃变更，直接提交将绕过 MumuSpec 流程

**Fix Steps**:
1. 运行 mumuspec new <name> 创建变更并切换到变更分支
2. 或将该分支加入 ci.ownership_ci_branches 白名单

## MERGE Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-MERGE-001` | MERGE_CHANGE_NOT_FOUND | ERROR | 变更不存在，无法合并 | No | 有发射点 |
| `E-MERGE-002` | MERGE_NOT_ARCHIVED | ERROR | 变更未归档，禁止合并分支 | No | 有发射点 |
| `E-MERGE-003` | MERGE_BRANCH_NOT_HANDLED | ERROR | 变更分支代码未提交（branch_status 未置 handled） | No | 有发射点 |
| `E-MERGE-004` | MERGE_ISOLATION_INVALID | ERROR | 变更不是分支隔离模式或缺少分支信息 | No | 有发射点 |
| `E-MERGE-005` | MERGE_NOT_ON_MAIN | ERROR | 必须在主分支上执行合并 | No | 有发射点 |
| `E-MERGE-006` | MERGE_WORKING_TREE_DIRTY | ERROR | 当前工作区有未提交改动，禁止合并 | No | 有发射点 |
| `E-MERGE-007` | MERGE_BRANCH_MISSING | ERROR | 变更分支不存在 | No | 有发射点 |
| `E-MERGE-008` | MERGE_MAIN_BRANCH_MISSING | ERROR | 未找到 main/master 主分支 | No | 有发射点 |
| `E-MERGE-009` | MERGE_GATE_REJECTED | ERROR | 合并门禁未通过 | No | 有发射点 |
| `E-MERGE-010` | MERGE_CONFLICT | ERROR | 合并发生冲突，已暂停 | No | 有发射点 |

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

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-GUARD-001` | GUARD_ARTIFACT_MISSING | ERROR | Phase Guard 检查发现工件缺失 | No | 有发射点 |
| `E-GUARD-002` | GUARD_SHALL_VIOLATION | ERROR | SHALL 约束未满足 | Yes | 有发射点 |
| `E-GUARD-003` | GUARD_SHALL_NOT_VIOLATION | ERROR | SHALL NOT 约束被违反 | No | 有发射点 |
| `E-GUARD-004` | GUARD_TEST_IMMUTABILITY | ERROR | 测试用例或套件 hash 不匹配 | No | 声明保留（无发射点） |
| `E-GUARD-008` | GUARD_COMPLETENESS_GATE_BLOCK | ERROR | 完备性门禁阻塞（工件缺失 / 存在未消解 open 项 / 工件为空 / 声明路径缺人工签收） | No | 有发射点 |
| `E-GUARD-009` | DESIGN_COVERAGE_GAP | ERROR | 设计覆盖断链（I1 设计向上闭合）：覆盖了 Layer N 却缺少某个 Layer < N | Yes | 有发射点 |
| `E-GUARD-010` | DELTA_CONSTRAINT_UNCHANNELABLE | ERROR | 变更携带的 delta 约束无验证通道（无 Enforcement 声明、无词法锚点、无 ast: 前缀），禁止通过 verify 进入强制面 | No | 有发射点 |
| `E-GUARD-011` | FREEZE_GATE_UNSIGNED_DECISION | ERROR | 轻量档变更声明了 blocking 用户决策但未逐项经 decisions.md 签收，禁止进入 build（freeze gate — 仅在 proposal 显式声明 `[blocking]` 项时生效） | No | 有发射点 |
| `E-GUARD-012` | SHALL_UNSATISFIED | ERROR | 带机读注解或 ast: 前缀（enforced-strong）的 SHALL 约束经机器通道检查未满足——要求未达成即阻断 | No | 有发射点 |
| `E-GUARD-013` | GATE_POINTER_UNRESOLVED | ERROR | behavior-gate 注解指针悬空（错误码未注册、无语料杀伤证据、fixture 缺失或形态不识别）——悬空指针即假强制，任何强度组合恒阻断 | No | 有发射点 |
| `E-GUARD-014` | WORKTREE_ISOLATION_MISSING | ERROR | workflow.worktree_isolation 有效值为强制，但变更没有对应工作树——行为门指针必须有名有实 | No | 有发射点 |
| `E-DRIFT-016` | STATUS_ASSERTION_CONFLICT | WARN | docs/STATUS.md 的机器可核断言与仓库事实矛盾（包版本/能力层进度/命令与工具数量）——默认 WARN 恒可见，enforcement_strict 下升 ERROR（enforcement-gap L2） | Yes | 有发射点 |
| `W-GUARD-001` | GUARD_PREREQUISITE_MISSING | WARN | 阶段前置工件缺失或未锁定（test_cases / build_layers / tdd_mode 等行为约束） | No | 有发射点 |
| `W-GUARD-004` | GUARD_TEST_IMMUTABILITY_MISMATCH | WARN | 测试套件 hash 与 design_content_hash 不匹配（测试在锁定后被改动） | No | 有发射点 |
| `W-GUARD-009` | DESIGN_COVERAGE_GAP_ADVISORY | WARN | 设计覆盖断链（I1）的告警形态：top_down_design 解析为 false 时不阻塞，但仍写入 state.design_coverage | No | 有发射点 |

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
- **无发射点**: hash 复核由建议级 W-GUARD-004 报告（允许 Build 迭代调整测试）；本 error 档码保留注册位、无发射点。

**Fix Steps**:
1. 检查文件是否被手动修改
2. 从 snapshots/ 恢复

### `E-GUARD-008`: GUARD_COMPLETENESS_GATE_BLOCK

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 完备性门禁阻塞（工件缺失 / 存在未消解 open 项 / 工件为空 / 声明路径缺人工签收）

**Fix Steps**:
1. 起草并消解 open-questions.yaml / assumptions.yaml（resolution.decision_ref 指向 decisions.md 条目）
2. 或在 design.md 声明 <!-- no-open-questions --> / <!-- no-assumptions --> 并先落 decisions.md 签收条目

### `E-GUARD-009`: DESIGN_COVERAGE_GAP

- **Severity**: ERROR
- **Forceable**: Yes
- **Description**: 设计覆盖断链（I1 设计向上闭合）：覆盖了 Layer N 却缺少某个 Layer < N

**Fix Steps**:
1. 为缺失的更低层补 design 产物（design.md 的层级映射或 test-cases/layer-N-cases.md）
2. 或修正 build_layers 的层级编号
3. 强度为 medium 时本项降级为 W-GUARD-009 告警（top_down_design=false）

### `E-GUARD-010`: DELTA_CONSTRAINT_UNCHANNELABLE

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 变更携带的 delta 约束无验证通道（无 Enforcement 声明、无词法锚点、无 ast: 前缀），禁止通过 verify 进入强制面

**Fix Steps**:
1. 在约束所在 Requirement 块内声明 Enforcement `- ID: manual(核验方式)`
2. 或改写 SHALL NOT 文本使其含反引号词法锚点（长度>2 的标识符）
3. 或对可 AST 判定的红线使用 ast: 前缀接 AST 通道

### `E-GUARD-011`: FREEZE_GATE_UNSIGNED_DECISION

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 轻量档变更声明了 blocking 用户决策但未逐项经 decisions.md 签收，禁止进入 build（freeze gate — 仅在 proposal 显式声明 `[blocking]` 项时生效）

**Fix Steps**:
1. 逐项签收：mumuspec decisions append <change> "<条目文本>"（引用 proposal `## User Decisions` 段原句）

### `E-GUARD-012`: SHALL_UNSATISFIED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 带机读注解或 ast: 前缀（enforced-strong）的 SHALL 约束经机器通道检查未满足——要求未达成即阻断

**Fix Steps**:
1. 修复对应源文件以满足 SHALL 要求（注解对应的 AST 约束）
2. 或该性质不再被要求时移除注解/ast: 前缀，让约束回落既有 E-SPEC-004 可见性语义
3. 或无法机器判定时改写为显式 manual(reason) 声明并由 verify 证据收口

### `E-GUARD-013`: GATE_POINTER_UNRESOLVED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: behavior-gate 注解指针悬空（错误码未注册、无语料杀伤证据、fixture 缺失或形态不识别）——悬空指针即假强制，任何强度组合恒阻断

**Fix Steps**:
1. 将 gate_ref 指向已注册且被本项目 .eval-corpus 语料 mustContain 命中的错误码
2. 或指向存在且声明非空的语料 fixture 目录名
3. 门禁不存在时改写为显式 manual(reason)——诚实降级优于虚假强控

### `E-GUARD-014`: WORKTREE_ISOLATION_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: workflow.worktree_isolation 有效值为强制，但变更没有对应工作树——行为门指针必须有名有实

**Fix Steps**:
1. 进入 design 时由生命周期创建隔离（mumuspec state transition <name> design）
2. 或显式降级为分支隔离 changes.default_isolation: branch（降级留审计痕，不做静默替换）

### `E-DRIFT-016`: STATUS_ASSERTION_CONFLICT

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: docs/STATUS.md 的机器可核断言与仓库事实矛盾（包版本/能力层进度/命令与工具数量）——默认 WARN 恒可见，enforcement_strict 下升 ERROR（enforcement-gap L2）

**Fix Steps**:
1. 修正 STATUS.md 断言使其与代码事实一致
2. 或修正事实源（若断言描述的才是应有状态）
3. 断言超出对账子集（如"设计完备性"）不参与核对，只拦矛盾不判好坏

### `W-GUARD-001`: GUARD_PREREQUISITE_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: 阶段前置工件缺失或未锁定（test_cases / build_layers / tdd_mode 等行为约束）

**Fix Steps**:
1. 补齐缺失工件
2. 或用 mumuspec state set 写入缺省值并在 decisions.md 说明

### `W-GUARD-004`: GUARD_TEST_IMMUTABILITY_MISMATCH

- **Severity**: WARN
- **Forceable**: No
- **Description**: 测试套件 hash 与 design_content_hash 不匹配（测试在锁定后被改动）

**Fix Steps**:
1. 回退 Design 重新锁定设计
2. 或用 mumuspec test-cases lock 重建 hash

### `W-GUARD-009`: DESIGN_COVERAGE_GAP_ADVISORY

- **Severity**: WARN
- **Forceable**: No
- **Description**: 设计覆盖断链（I1）的告警形态：top_down_design 解析为 false 时不阻塞，但仍写入 state.design_coverage

**Fix Steps**:
1. 为缺失的更低层补 design 产物
2. 或在约束强度中把 technical_design 提为 high 使其阻塞

## BUILD Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `W-BUILD-001` | BUILD_LAYER_COUPLING | WARN | 同层 scope 之间存在直接调用边（I3 层内默认可并行不成立 → 设计未闭合） | Yes | 有发射点 |

### `W-BUILD-001`: BUILD_LAYER_COUPLING

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 同层 scope 之间存在直接调用边（I3 层内默认可并行不成立 → 设计未闭合）

**Fix Steps**:
1. 将两个 scope 拆为不同 layer，或合并为一个模块
2. 确认耦合确实经由冻结契约后，用 --force 越过

## PONYTAIL Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-PONYTAIL-001` | PONYTAIL_YAGNI_VIOLATION | WARN | 引入了未被请求的抽象层或功能 | Yes | 有发射点 |

### `E-PONYTAIL-001`: PONYTAIL_YAGNI_VIOLATION

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 引入了未被请求的抽象层或功能

**Fix Steps**:
1. 删除不必要的抽象
2. 或用 ponytail: 注释标记理由

## CONTRACT Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-CONTRACT-001` | BOUNDARY_DOC_MISSING | WARN | 有代码的目录缺少 BOUNDARY.md 边界文档 | Yes | 有发射点 |
| `E-CONTRACT-002` | BOUNDARY_EXPORT_NOT_FOUND | ERROR | BOUNDARY.md 声明的对外接口在代码中未找到实现 | No | 有发射点 |
| `E-CONTRACT-003` | BOUNDARY_DEPENDENCY_UNUSED | WARN | BOUNDARY.md 声明的依赖在代码中未发现实际使用 | Yes | 有发射点 |
| `E-CONTRACT-004` | BOUNDARY_CHANGELOG_EMPTY | WARN | BOUNDARY.md 缺少变更日志 | Yes | 有发射点 |
| `E-CONTRACT-005` | CONTRACT_SOURCE_MISSING | ERROR | contracts.yaml 声明的契约源文件不存在 | No | 有发射点 |
| `E-CONTRACT-006` | CONTRACT_DEPRECATED_IN_USE | WARN | 已标记为 deprecated 的契约仍被上游消费者使用 | Yes | 有发射点 |
| `E-CONTRACT-007` | CONTRACT_SCHEMA_MISSING | WARN | 契约缺少 schema 定义 | Yes | 有发射点 |
| `E-CONTRACT-008` | CONTRACT_GRAPH_INCONSISTENT | WARN | 契约依赖图中引用了不存在的契约 ID | Yes | 有发射点 |
| `E-CONTRACT-009` | CONTRACT_BREAKING_CHANGE | ERROR | 检测到破坏性契约变更，但未提供迁移路径 | No | 有发射点 |
| `E-CONTRACT-010` | CONTRACT_LOCK_TIMEOUT | ERROR | 获取契约文件锁超时（5s），另一个进程可能正在修改契约 | No | 有发射点 |
| `E-CONTRACT-011` | CONTRACT_REGISTRY_INVALID | ERROR | 契约注册表文件结构无效（缺少必需字段或含 __proto__/constructor/prototype 污染键） | No | 有发射点 |

### `E-CONTRACT-001`: BOUNDARY_DOC_MISSING

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 有代码的目录缺少 BOUNDARY.md 边界文档

**Fix Steps**:
1. 创建 BOUNDARY.md 并声明对外接口、依赖、数据契约
2. 运行 mumuspec drift --fix --dry-run 预览可自动修复项

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

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-KNOWLEDGE-001` | KNOWLEDGE_PAGE_FORMAT_INVALID | WARN | 知识页面 frontmatter 必填字段缺失（id/title/type/status/scope） | No | 有发射点 |

### `E-KNOWLEDGE-001`: KNOWLEDGE_PAGE_FORMAT_INVALID

- **Severity**: WARN
- **Forceable**: No
- **Description**: 知识页面 frontmatter 必填字段缺失（id/title/type/status/scope）

**Fix Steps**:
1. 检查 frontmatter 字段
2. 运行 mumuspec knowledge verify --id <id>

## DESIGN Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-DESIGN-001` | COGNITIVE_MAP_MISSING | ERROR | cognitive-map.yaml 不存在 | No | 声明保留（无发射点） |
| `E-DESIGN-009` | DESIGN_SCHEMA_SECTION_MISSING | ERROR | design.md 缺少 templates/design-schema.yaml 要求的必填 section | No | 声明保留（无发射点） |
| `E-DESIGN-010` | CROSS_ARTIFACT_INCONSISTENCY | ERROR | proposal 与 design 跨工件不一致（Plan 步骤未映射到 Layers、FR 未被 design 引用） | No | 有发射点 |
| `E-DESIGN-002` | COGNITIVE_Q1_EMPTY | ERROR | Q1 已知的已知为空 | No | 声明保留（无发射点） |
| `W-DESIGN-001` | COGNITIVE_MAP_MISSING | WARN | cognitive_framework.enabled 但 cognitive-map.yaml 不存在 | No | 有发射点 |
| `W-DESIGN-002` | COGNITIVE_Q1_EMPTY | WARN | Q1 已知的已知为空（cognitive_framework.q1_count == 0） | No | 有发射点 |
| `W-DESIGN-003` | COGNITIVE_Q2_PENDING | WARN | Q2 存在未回答的问题（cognitive_framework.q2_pending > 0） | No | 有发射点 |
| `W-DESIGN-004` | COGNITIVE_Q3_PENDING | WARN | Q3 存在未确认的推导（cognitive_framework.q3_pending > 0） | No | 有发射点 |
| `E-GRAPH-002` | GRAPH_UNKNOWN_RENDER_FORMAT | ERROR | 图渲染请求了未支持的格式，不回落默认格式 | Yes | 有发射点 |
| `E-GRAPH-003` | GRAPH_INCONSISTENT_SOURCE_DATA | ERROR | 渲染源数据自相矛盾（边引用未声明节点） | No | 有发射点 |
| `W-DESIGN-005` | COGNITIVE_Q4_INSUFFICIENT_SCANS | WARN | Q4 盲区扫描覆盖维度不足（按维度身份判定，记录条数不构成覆盖） | No | 有发射点 |
| `W-DESIGN-006` | COGNITIVE_MAP_NOT_CONVERGED | WARN | 认知地图未收敛（cognitive_framework.converged == false） | No | 有发射点 |
| `W-DESIGN-007` | GRILL_ME_INCOMPLETE | WARN | grill-me 压力测试未完成（grill_me_result.completed == false） | No | 有发射点 |
| `W-DESIGN-008` | GRILL_ME_ROUNDS_EXCEEDED | WARN | grill-me 追问轮次超出上限 | No | 有发射点 |
| `W-DESIGN-009` | DESIGN_SCHEMA_SECTION_MISSING | WARN | design.md 缺少 templates/design-schema.yaml 要求的 section | No | 有发射点 |
| `W-DESIGN-010` | CROSS_ARTIFACT_INCONSISTENCY | WARN | proposal / design / delta-specs 跨工件不一致（调用点由 E-DESIGN-010 重映射而来） | No | 有发射点 |
| `W-DESIGN-011` | GRILL_ME_DEFERRED_UNRESOLVED | WARN | grill-me 存在未达成共识的 deferred 分支 | No | 有发射点 |

### `E-DESIGN-001`: COGNITIVE_MAP_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: cognitive-map.yaml 不存在
- **无发射点**: 认知地图缺位在守卫路径上是建议级 W-DESIGN-001（CHG-5 降档）；本 error 档码保留注册位、无发射点。

**Fix Steps**:
1. 回退到 Design
2. 执行认知框架 Step 0

### `E-DESIGN-009`: DESIGN_SCHEMA_SECTION_MISSING

- **Severity**: ERROR
- **Forceable**: No
- **Description**: design.md 缺少 templates/design-schema.yaml 要求的必填 section
- **无发射点**: 结构缺节自 CHG-5 起为建议级 W-DESIGN-009（不阻断）；本 error 档码保留注册位、无发射点。

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
- **无发射点**: Q1 为空由守卫以建议级 W-DESIGN-002 报告（phase-guard.ts，CHG-5 降档）；本 error 档码保留注册位、无发射点。

**Fix Steps**:
1. 检查 proposal.md 和 spec.md 是否已加载
2. 重新执行 Stage 1 信息采集

### `W-DESIGN-001`: COGNITIVE_MAP_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: cognitive_framework.enabled 但 cognitive-map.yaml 不存在

**Fix Steps**:
1. 产出 cognitive-map.yaml
2. 或在 .mumuspec.yaml 中关闭 cognitive_framework

### `W-DESIGN-002`: COGNITIVE_Q1_EMPTY

- **Severity**: WARN
- **Forceable**: No
- **Description**: Q1 已知的已知为空（cognitive_framework.q1_count == 0）

**Fix Steps**:
1. 把 cognitive_framework.q1_count 更新为实际条目数

### `W-DESIGN-003`: COGNITIVE_Q2_PENDING

- **Severity**: WARN
- **Forceable**: No
- **Description**: Q2 存在未回答的问题（cognitive_framework.q2_pending > 0）

**Fix Steps**:
1. 回答或关闭 Q2 条目
2. 或达到轮次上限后显式收敛

### `W-DESIGN-004`: COGNITIVE_Q3_PENDING

- **Severity**: WARN
- **Forceable**: No
- **Description**: Q3 存在未确认的推导（cognitive_framework.q3_pending > 0）

**Fix Steps**:
1. 确认或驳回 Q3 推导
2. 或达到轮次上限后显式收敛

### `E-GRAPH-002`: GRAPH_UNKNOWN_RENDER_FORMAT

- **Severity**: ERROR
- **Forceable**: Yes
- **Description**: 图渲染请求了未支持的格式，不回落默认格式

**Fix Steps**:
1. 改用 mermaid / dot / json 三者之一

### `E-GRAPH-003`: GRAPH_INCONSISTENT_SOURCE_DATA

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 渲染源数据自相矛盾（边引用未声明节点）

**Fix Steps**:
1. 修正 workflow 配置的 phases / terminal / edges 一致性后重试 graph verify

### `W-DESIGN-005`: COGNITIVE_Q4_INSUFFICIENT_SCANS

- **Severity**: WARN
- **Forceable**: No
- **Description**: Q4 盲区扫描覆盖维度不足（按维度身份判定，记录条数不构成覆盖）

**Fix Steps**:
1. 按 cognitive-map sync 报出的缺失维度名补写对应 category 的 Q4 条目
2. 必需维度（含 security-compliance）齐备且不同维度数达到 q4_min_dimensions 才算收敛

### `W-DESIGN-006`: COGNITIVE_MAP_NOT_CONVERGED

- **Severity**: WARN
- **Forceable**: No
- **Description**: 认知地图未收敛（cognitive_framework.converged == false）

**Fix Steps**:
1. 清空 q2_pending / q3_pending 后置 converged: true

### `W-DESIGN-007`: GRILL_ME_INCOMPLETE

- **Severity**: WARN
- **Forceable**: No
- **Description**: grill-me 压力测试未完成（grill_me_result.completed == false）

**Fix Steps**:
1. 执行 grill-me 并写入 grill_me_result
2. 或在 decisions.md 记录跳过理由

### `W-DESIGN-008`: GRILL_ME_ROUNDS_EXCEEDED

- **Severity**: WARN
- **Forceable**: No
- **Description**: grill-me 追问轮次超出上限

**Fix Steps**:
1. 收敛剩余分支
2. 或调整 max_rounds 并记录决策

### `W-DESIGN-009`: DESIGN_SCHEMA_SECTION_MISSING

- **Severity**: WARN
- **Forceable**: No
- **Description**: design.md 缺少 templates/design-schema.yaml 要求的 section

**Fix Steps**:
1. 按 schema 补充缺失的 section

### `W-DESIGN-010`: CROSS_ARTIFACT_INCONSISTENCY

- **Severity**: WARN
- **Forceable**: No
- **Description**: proposal / design / delta-specs 跨工件不一致（调用点由 E-DESIGN-010 重映射而来）

**Fix Steps**:
1. 在 design.md 中补充对应 Layer 或 FR 引用
2. 或修正 proposal.md 使步骤与设计对齐

### `W-DESIGN-011`: GRILL_ME_DEFERRED_UNRESOLVED

- **Severity**: WARN
- **Forceable**: No
- **Description**: grill-me 存在未达成共识的 deferred 分支

**Fix Steps**:
1. 就 deferred 分支达成共识
2. 或在 decisions.md 显式接受该不确定性

## SECURITY Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-SECURITY-001` | SECURITY_PATH_TRAVERSAL | ERROR | CLI 参数路径超出项目根目录 | No | 有发射点 |
| `E-SECURITY-002` | CHANGE_NAME_INVALID | ERROR | 变更名称含非法字符（路径分隔符或 .. 序列） | No | 有发射点 |
| `E-SECURITY-003` | MCP_PATH_REQUIRED | ERROR | MCP 工具调用未提供 path 参数或参数类型错误 | No | 有发射点 |
| `W-SECURITY-001` | SENSITIVE_INFO_DETECTED | WARN | 规范工件中出现疑似凭据/内网地址/数据源连接串（掩码后的片段） | No | 有发射点 |
| `W-DESIGN-012` | DESIGN_PREFERENCE_UNRESOLVED | WARN | design.md 的架构偏好选型表仍有议题未决（选定项/备选/理由/未选代价四字段不完备） | No | 有发射点 |

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

### `W-SECURITY-001`: SENSITIVE_INFO_DETECTED

- **Severity**: WARN
- **Forceable**: No
- **Description**: 规范工件中出现疑似凭据/内网地址/数据源连接串（掩码后的片段）

**Fix Steps**:
1. 将实际值替换为环境变量占位符
2. 确认为示例文本后可继续（告警不阻断）

### `W-DESIGN-012`: DESIGN_PREFERENCE_UNRESOLVED

- **Severity**: WARN
- **Forceable**: No
- **Description**: design.md 的架构偏好选型表仍有议题未决（选定项/备选/理由/未选代价四字段不完备）

**Fix Steps**:
1. 逐项选定，或显式选择「暂不约束」
2. 运行 mumuspec design-init <scope> --pick "议题=选项:理由" 重建选型表

## STATE Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-STATE-001` | STATE_PROTECTED_FIELD | ERROR | state set 尝试修改受保护字段（认知/测试/阶段等），且 guard.bypass_audit=false 拒绝绕过 | No | 有发射点 |

### `E-STATE-001`: STATE_PROTECTED_FIELD

- **Severity**: ERROR
- **Forceable**: No
- **Description**: state set 尝试修改受保护字段（认知/测试/阶段等），且 guard.bypass_audit=false 拒绝绕过

**Fix Steps**:
1. 通过 guard --apply 正规流程推进阶段
2. 如需绕过请在 config.yaml 设置 guard.bypass_audit: true 并接受审计

## AGENTS Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-AGENTS-001` | AGENTS_SPEC_DRIFT | ERROR | AGENTS.md 与 spec 内容漂移（生成的 rules 基于旧版规范） | No | 有发射点 |

### `E-AGENTS-001`: AGENTS_SPEC_DRIFT

- **Severity**: ERROR
- **Forceable**: No
- **Description**: AGENTS.md 与 spec 内容漂移（生成的 rules 基于旧版规范）

**Fix Steps**:
1. 重新运行 mumuspec init 同步 AGENTS.md 与 agents-hash.json

## RULES Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-RULES-001` | RULES_BUDGET_EXCEEDED | ERROR | 生成的 Rules 产物超过 32KiB 容量预算（禁止在 Rules 文件中内联全量规范上下文） | No | 有发射点 |

### `E-RULES-001`: RULES_BUDGET_EXCEEDED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 生成的 Rules 产物超过 32KiB 容量预算（禁止在 Rules 文件中内联全量规范上下文）

**Fix Steps**:
1. 缩减 Rules 内容：渐进式披露职责归 MCP，Rules 文件仅保留摘要与速查
2. 检查 spec 摘要是否被全量内联（应为逐层摘要而非全文）

## CHECK Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-CHECK-001` | CHECK_ACTION_FAILED | ERROR | mumuspec check 执行过程中发生未预期错误（compliance / glossary 或 check 主体流程抛错；drift 检测源的失败已逐源隔离为 W-CHECK-002，不再走到这里） | No | 有发射点 |
| `W-CHECK-002` | DRIFT_SOURCE_FAILED | WARN | 某个 drift 检测源抛出异常——该源本轮无结果（盲区），其余检测源不受影响 | No | 有发射点 |

### `E-CHECK-001`: CHECK_ACTION_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: mumuspec check 执行过程中发生未预期错误（compliance / glossary 或 check 主体流程抛错；drift 检测源的失败已逐源隔离为 W-CHECK-002，不再走到这里）

**Fix Steps**:
1. 查看下方错误信息定位具体子系统
2. 修复后重新运行 mumuspec check

### `W-CHECK-002`: DRIFT_SOURCE_FAILED

- **Severity**: WARN
- **Forceable**: No
- **Description**: 某个 drift 检测源抛出异常——该源本轮无结果（盲区），其余检测源不受影响

**Fix Steps**:
1. 查看消息中的源名与异常原因
2. 修复该检测源后重新运行 mumuspec check

## SKILL Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `W-SKILL-001` | SKILL_COPY_DRIFT | WARN | 技能源与已安装副本的正文不一致（比对已剥离 frontmatter 版本行，故版本戳印不产生噪声） | Yes | 有发射点 |
| `E-SKILL-002` | PLUGIN_MANIFEST_INVALID | ERROR | 插件或市场清单未通过官方规范校验（name 形态、语义化版本、相对路径、source 存在性等） | No | 有发射点 |
| `E-SKILL-003` | PLUGIN_REGISTRY_WRITE_FAILED | ERROR | 宿主插件登记文件不可写或内容不是合法 JSON——安装整体失败，不留"已复制但未登记"的中间态 | No | 有发射点 |

### `W-SKILL-001`: SKILL_COPY_DRIFT

- **Severity**: WARN
- **Forceable**: Yes
- **Description**: 技能源与已安装副本的正文不一致（比对已剥离 frontmatter 版本行，故版本戳印不产生噪声）

**Fix Steps**:
1. 核对诊断中给出的源路径与安装路径差异
2. 重新安装技能以同步副本：mumuspec install <agent> <packages...> --force

### `E-SKILL-002`: PLUGIN_MANIFEST_INVALID

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 插件或市场清单未通过官方规范校验（name 形态、语义化版本、相对路径、source 存在性等）

**Fix Steps**:
1. 按违例列表逐条修正 path + rule + message 指向的字段
2. 重新执行最小构建（mumuspec bundle plugin）确认清单通过校验器

### `E-SKILL-003`: PLUGIN_REGISTRY_WRITE_FAILED

- **Severity**: ERROR
- **Forceable**: No
- **Description**: 宿主插件登记文件不可写或内容不是合法 JSON——安装整体失败，不留"已复制但未登记"的中间态

**Fix Steps**:
1. 检查登记文件权限与其 JSON 结构（version + plugins 两字段）
2. 修复后重新安装；或用 --dry-run 先查看待登记内容

## GIT Domain

| Code | Name | Severity | Description | Forceable | Emission |
|------|------|----------|-------------|-----------|----------|
| `E-GIT-001` | GIT_SPAWN_FAILED | ERROR | git 命令无法启动（未安装 git 或不在 PATH 中） | No | 有发射点 |
| `E-GIT-002` | GIT_COMMAND_FAILED | ERROR | git 命令执行失败（非零退出码） | No | 有发射点 |
| `E-GIT-003` | GIT_MAIN_BRANCH_NOT_FOUND | ERROR | 未找到 main 或 master 主分支 | No | 有发射点 |

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
