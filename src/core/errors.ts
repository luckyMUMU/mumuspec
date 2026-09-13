import type { Severity } from './types.js';
import type { ConstraintDimension, ConstraintStrength } from './types-constraint.js';

/** Error code definition */
export interface ErrorCodeDef {
  code: string;
  name: string;
  severity: Severity;
  description: string;
  fixSteps: string[];
  forceable: boolean;
  /**
   * Enforcement dimension (Phase 3.3): which strength axis governs this code.
   * Single source of truth — guard/checker.ts and consumers derive from here
   * instead of maintaining parallel code→metadata maps.
   */
  dimension?: ConstraintDimension;
  /** Minimum strength at which this code still fires. Default: 'low'. */
  min_strength?: ConstraintStrength;
  /** Cannot be downgraded by any strength configuration. */
  always_enforce?: boolean;
}

/**
 * All error code definitions.
 *
 * **Code-prefix convention** (2026-09-12): `severity` is authoritative for the
 * level; the prefix is a readability hint. Advisory codes emitted by the guards
 * use the `W-<DOMAIN>-NNN` form (`W-DESIGN-*`, `W-GUARD-*`, `W-VERIFY-*`).
 * A legacy set predating this convention carries a `WARN` severity under an
 * `E-` prefix (`E-GUARD-007`, `E-PONYTAIL-001`, `E-CONTRACT-003`, …);
 * renaming those is a breaking change for downstream consumers, so they are
 * left as-is pending a human ruling.
 *
 * Every code the engine can emit MUST have an entry here — otherwise
 * `checkMetadataFor()` silently falls back to
 * `{ dimension: 'technical_design', min_strength: 'low' }` and the generated
 * `docs/reference/error-codes.md` omits it. `tests/guard/error-code-registry.test.ts`
 * enforces this.
 */
export const ERROR_CODES: Record<string, ErrorCodeDef> = {
  // SPEC domain
  'E-SPEC-001': {
    code: 'E-SPEC-001',
    name: 'SPEC_FORMAT_INVALID',
    severity: 'ERROR',
    description: 'spec.md YAML frontmatter 格式错误',
    fixSteps: ['检查 layer/scope/last_updated 字段类型', '运行 mumuspec validate 重新校验'],
    forceable: false,
  },
  'E-SPEC-002': {
    code: 'E-SPEC-002',
    name: 'SPEC_LAYER_EXCEED_MAX',
    severity: 'ERROR',
    description: '规范层级超过 max_layer_depth',
    fixSteps: ['检查目录嵌套深度', '调整 config.yaml: specs.max_layer_depth'],
    forceable: false,
  },
  'E-SPEC-003': {
    code: 'E-SPEC-003',
    name: 'SPEC_INHERITANCE_CONFLICT',
    severity: 'ERROR',
    description: '子层 SHALL NOT 与父层 SHALL 矛盾',
    fixSteps: ['检查继承链', '调整子层 SHALL NOT 或父层 SHALL'],
    forceable: false,
  },
  'E-SPEC-004': {
    code: 'E-SPEC-004',
    name: 'SPEC_ENFORCEMENT_MISSING',
    severity: 'WARN',
    description: 'SHALL 无验证声明（无 Enforcement、无 annotation，P0 语义收窄：仅指 SHALL；SHALL NOT 走 E-SPEC-015）',
    fixSteps: ['为该约束补充 Enforcement 检查规则', '或标记为 enforcement: manual(原因)', '或补充 frontmatter annotation'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
    always_enforce: true,
  },
  'E-SPEC-005': {
    code: 'E-SPEC-005',
    name: 'SPEC_DRIFT_DETECTED',
    severity: 'ERROR',
    description: 'spec.md 声明的 Requirement 在代码中无实现',
    fixSteps: ['检查是否遗漏实现', '或更新 spec.md 移除该 Requirement'],
    forceable: false,
  },
  'E-SPEC-006': {
    code: 'E-SPEC-006',
    name: 'SPEC_DESIGN_DOC_MISSING',
    severity: 'ERROR',
    description: '有 spec.md 但无 design.md',
    fixSteps: ['用 mumuspec add-spec <scope> 创建 design.md 并补齐 frontmatter'],
    forceable: false,
  },
  'E-SPEC-007': {
    code: 'E-SPEC-007',
    name: 'SPEC_INDEX_OUTDATED',
    severity: 'WARN',
    description: 'index.yaml 与实际目录结构不一致',
    fixSteps: ['运行 mumuspec sync 对齐 index.yaml 与实际目录结构'],
    forceable: true,
  },

  'E-SPEC-008': {
    code: 'E-SPEC-008',
    name: 'PRD_FRONTMATTER_INVALID',
    severity: 'ERROR',
    description: 'prd.md YAML frontmatter 缺少必填字段 (layer, scope)',
    fixSteps: ['添加 layer 和 scope 字段', '运行 mumuspec validate 重新校验'],
    forceable: false,
  },
  'E-SPEC-009': {
    code: 'E-SPEC-009',
    name: 'TECH_FRONTMATTER_INVALID',
    severity: 'ERROR',
    description: 'tech.md YAML frontmatter 缺少必填字段 (layer, scope)',
    fixSteps: ['添加 layer 和 scope 字段', '运行 mumuspec validate 重新校验'],
    forceable: false,
  },
  'E-SPEC-010': {
    code: 'E-SPEC-010',
    name: 'PARENT_SPEC_NOT_FOUND',
    severity: 'ERROR',
    description: 'parent_prd 或 parent_tech 指向的文件不存在',
    fixSteps: ['检查路径是否正确', '创建缺失的父文档或移除引用'],
    forceable: false,
  },
  'E-SPEC-011': {
    code: 'E-SPEC-011',
    name: 'DISTRIBUTED_SPEC_FORMAT_INVALID',
    severity: 'WARN',
    description: '分布式 prd.md/tech.md 使用非 Requirement 块格式',
    fixSteps: ['使用 ## Requirement: <name> 格式定义约束', '运行 mumuspec validate 重新校验'],
    forceable: true,
  },
  'E-SPEC-012': {
    code: 'E-SPEC-012',
    name: 'DIST_SPEC_SHALL_UNIMPLEMENTED',
    severity: 'ERROR',
    description: 'tech.md 中声明的 SHALL 约束在代码中找不到实现',
    fixSteps: ['检查代码是否满足约束', '或更新 tech.md 移除/调整约束'],
    forceable: false,
  },
  'E-SPEC-013': {
    code: 'E-SPEC-013',
    name: 'UNDEFINED_MUMUSPEC_DIRECTORY',
    severity: 'ERROR',
    description: '.mumuspec/ 下存在未定义的目录',
    fixSteps: ['移除未定义的目录', '或将其内容合并到已定义的目录中'],
    forceable: false,
  },
  'E-SPEC-014': {
    code: 'E-SPEC-014',
    name: 'UNDEFINED_MUMUSPEC_FILE',
    severity: 'ERROR',
    description: '.mumuspec/ 下存在未定义的文件',
    fixSteps: ['移除未定义的文件', '或将其内容合并到已定义的 spec 文件中'],
    forceable: false,
  },
  'E-SPEC-015': {
    code: 'E-SPEC-015',
    name: 'SPEC_SHALL_NOT_UNVERIFIABLE',
    severity: 'ERROR',
    description: 'SHALL NOT 红线无可验证通道（无 annotation、正则兜底不可提取、无 manual 声明）',
    fixSteps: [
      '补充 frontmatter annotation（enforced-strong）',
      '或改写文本使引号词可被正则兜底提取（enforced-weak）',
      '或声明 Enforcement `- ID: manual(原因)`',
    ],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },

  // CONSTRAINT domain — 自由度边界：约束来源闭合（「下层受上层约束」的可判定形式）
  // 由 src/spec/constraint-provenance.ts 发出，接入 `mumuspec check` 的 drift 数组。
  // 注：drift 通道直接携带 severity，不经 applyStrengthToGuardResult 折叠；
  // dimension / min_strength 在此仅用于文档化（与 E-SPEC-* 同域语义）。
  'E-CONSTRAINT-001': {
    code: 'E-CONSTRAINT-001',
    name: 'CONSTRAINT_SOURCE_MISSING',
    severity: 'ERROR',
    description: '约束条目缺少 source_specs（越权约束 — 无上游来源，不属于任何层级）',
    fixSteps: [
      '为该约束补 source_specs，指向定义它的更高层规范标题',
      '或删除该约束（无来源即无授权）',
    ],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-CONSTRAINT-002': {
    code: 'E-CONSTRAINT-002',
    name: 'CONSTRAINT_SOURCE_FILE_MISSING',
    severity: 'ERROR',
    description: '约束的来源文件不存在（悬空来源）',
    fixSteps: ['修正 source_specs 的路径', '或删除该来源标注'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'W-CONSTRAINT-003': {
    code: 'W-CONSTRAINT-003',
    name: 'CONSTRAINT_SOURCE_ANCHOR_MISSING',
    severity: 'WARN',
    description: '约束的来源锚点在目标文件中找不到对应标题（锚点漂移）',
    fixSteps: ['把锚点改为目标规范中真实存在的标题（归一化后子串匹配）'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // CHANGE domain
  'E-CHANGE-001': {
    code: 'E-CHANGE-001',
    name: 'CHANGE_ALREADY_ACTIVE',
    severity: 'ERROR',
    description: '已有活跃变更，无法创建新变更',
    fixSteps: ['完成或 Discard 当前变更', 'mumuspec list 查看活跃变更'],
    forceable: false,
  },
  'E-CHANGE-002': {
    code: 'E-CHANGE-002',
    name: 'CHANGE_ROLLBACK_LIMIT',
    severity: 'ERROR',
    description: 'rollback_count 达到上限',
    fixSteps: ['接受偏差归档', '废弃变更', '手动提升上限（需审批）'],
    forceable: false,
  },
  'E-CHANGE-003': {
    code: 'E-CHANGE-003',
    name: 'CHANGE_REBUILD_LIMIT',
    severity: 'ERROR',
    description: 'rebuild_count 达到上限，强制升级为 Design 回退',
    fixSteps: ['系统自动升级为 verify_to_design_rollback'],
    forceable: false,
  },
  'E-CHANGE-004': {
    code: 'E-CHANGE-004',
    name: 'CHANGE_TEST_CASES_LOCKED',
    severity: 'ERROR',
    description: '尝试修改已锁定的 test-cases/',
    fixSteps: ['回退到 Design: mumuspec state transition <name> design --reason <原因>'],
    forceable: false,
  },
  'E-CHANGE-005': {
    code: 'E-CHANGE-005',
    name: 'CHANGE_WORKTREE_FAIL',
    severity: 'ERROR',
    description: 'worktree 创建失败',
    fixSteps: ['检查磁盘空间和权限', '降级为 branch 模式'],
    forceable: false,
  },
  'E-CHANGE-006': {
    code: 'E-CHANGE-006',
    name: 'CHANGE_PHASE_INVALID_TRANSITION',
    severity: 'ERROR',
    description: '非法状态机转换',
    fixSteps: ['检查当前 phase', '参考 Phase Guard 确认可转换路径'],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-CHANGE-007': {
    code: 'E-CHANGE-007',
    name: 'CHANGE_DECISIONS_HASH_MISMATCH',
    severity: 'ERROR',
    description: 'decisions.md content_hash 不匹配',
    fixSteps: ['检查 decisions.md 是否被手动修改', '从 snapshots/ 恢复正确版本'],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-CHANGE-008': {
    code: 'E-CHANGE-008',
    name: 'CHANGE_SCOPE_OVERFLOW',
    severity: 'ERROR',
    description: '变更 affected_scopes 超出当前作用域子树',
    fixSteps: ['缩减 affected_scopes 到当前作用域子树内', '或在父级作用域创建变更'],
    forceable: false,
  },
  'E-CHANGE-009': {
    code: 'E-CHANGE-009',
    name: 'CHANGE_BRANCH_CREATE_FAILED',
    severity: 'ERROR',
    description: '自动创建变更分支失败（已回退变更目录）',
    fixSteps: ['检查 git 仓库状态与分支名冲突', '解决后重新执行 mumuspec new'],
    forceable: false,
  },
  // P0-1 Fix: New error codes for rename and directory move failures
  'E-CHANGE-010': {
    code: 'E-CHANGE-010',
    name: 'CHANGE_DISCARD_MOVE_FAILED',
    severity: 'ERROR',
    description: '废弃变更时目录移动失败，变更保留在原位置',
    fixSteps: ['检查目标目录是否已存在', '手动将变更目录移到 .mumuspec/changes/archive/discarded/'],
    forceable: false,
  },
  'E-CHANGE-011': {
    code: 'E-CHANGE-011',
    name: 'CHANGE_ARCHIVE_MOVE_FAILED',
    severity: 'ERROR',
    description: '归档变更时目录移动失败，变更保留在原位置',
    fixSteps: ['检查目标目录是否已存在', '手动将变更目录移到 .mumuspec/changes/archive/'],
    forceable: false,
  },
  'E-CHANGE-012': {
    code: 'E-CHANGE-012',
    name: 'CHANGE_TWEAK_CARRIES_SPEC',
    severity: 'ERROR',
    description: 'tweak 工作流归档会跳过 delta-spec 与知识合并，携带规范工件的变更不得用 tweak 归档',
    fixSteps: [
      '改用 hotfix 工作流归档（mumuspec new <name> --workflow hotfix）',
      '或将 delta-specs/ 与 constraints/ 内容迁出到 hotfix 变更后再归档',
    ],
    forceable: false,
  },
  // Completeness gate artifacts (goal-p0-dispatch-gate, C4) — KP-0060 axiom 3:
  // guard refuses to consume invalid artifacts, never degrades.
  'E-CHANGE-020': {
    code: 'E-CHANGE-020',
    name: 'CHANGE_ARTIFACT_SCHEMA_INVALID',
    severity: 'ERROR',
    description: '完备性工件 schema 非法（open-questions.yaml / assumptions.yaml 违反 schema v1）',
    fixSteps: [
      '按 schema v1 修正工件：version: 1、change 匹配当前变更、items[] 字段齐全',
      'status 使用合法枚举 open | resolved | accepted | deferred',
      'status != open 时补充 resolution.decision_ref（decisions.md 条目时间戳）',
    ],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-CHANGE-021': {
    code: 'E-CHANGE-021',
    name: 'CHANGE_RESOLUTION_CHAIN_BROKEN',
    severity: 'ERROR',
    description: '工件 resolution 链断裂（decision_ref 在 decisions.md 中无对应条目，或 deferred 缺 note）',
    fixSteps: [
      '将 decision_ref 指向 decisions.md 中实存条目的时间戳（## [<phase>] <时间戳>）',
      '或先在 decisions.md 落签收条目，再回填工件 decision_ref',
      'status=deferred 时补充 resolution.note 说明理由',
    ],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-CHANGE-022': {
    code: 'E-CHANGE-022',
    name: 'DELTA_MERGE_INCOMPLETE',
    severity: 'ERROR',
    description: '归档合并 delta-spec 存在未解决文件（目标缺失或读写失败），delta 内容未被合并，禁止静默归档',
    fixSteps: [
      '为 delta 文件命名后缀对应的目标 scope 创建 .mumuspec/tech.md 或 .mumuspec/prd.md（<-scope>-tech.md / <-scope>-prd.md）',
      '或修正 delta 文件命名后缀使其匹配已存在的目标 scope',
      '或确认 delta 内容已废弃后删除该 delta-spec 文件，重新执行归档',
    ],
    forceable: false,
  },

  // VERIFY domain (P0 verifier semantics — manual evidence gate)
  'E-VERIFY-001': {
    code: 'E-VERIFY-001',
    name: 'VERIFY_RESULT_NOT_PASS',
    severity: 'ERROR',
    description: 'verify_result 不为 pass（验证未通过不等于通过；偏差须走 accept-deviations 旁路）',
    fixSteps: ['修复验证失败项后重新验证', '或走 accept-deviations 旁路并记录偏差'],
    forceable: false,
  },
  'E-VERIFY-002': {
    code: 'E-VERIFY-002',
    name: 'BRANCH_STATUS_UNHANDLED',
    severity: 'ERROR',
    description: '变更分支状态未处理（branch_status 未标记 handled）',
    fixSteps: ['合并或清理变更分支', '更新 state.branch_status 为 handled'],
    forceable: false,
  },
  'E-VERIFY-003': {
    code: 'E-VERIFY-003',
    name: 'MANUAL_EVIDENCE_MISSING',
    severity: 'ERROR',
    description: 'verify.md 缺少 manual 类约束的验证记录（按 Enforcement ID 或约束文本锚定）',
    fixSteps: [
      '在 verify.md 中为每条 manual 约束补充验证记录（引用其 Enforcement ID 或原文）',
      '或将约束的 Enforcement 改为可自动执行的通道后重新验证',
      '或走 accept-deviations 旁路并记录偏差',
    ],
    forceable: true,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'W-VERIFY-001': {
    code: 'W-VERIFY-001',
    name: 'VERIFY_SHALL_RECORD_MISSING',
    severity: 'WARN',
    description: 'verify.md 未包含 SHALL / SHALL NOT 校验记录',
    fixSteps: ['在 verify.md 中补充 SHALL / SHALL NOT 的逐条校验结论'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // FINAL domain (finalize-archive — 归档收尾命令)
  'E-FINAL-001': {
    code: 'E-FINAL-001',
    name: 'FINALIZE_STATE_INVALID',
    severity: 'ERROR',
    description: 'finalize 前置状态不满足（变更未归档或 phase 非 archive-completed）',
    fixSteps: ['先运行 mumuspec state transition <name> archive 完成归档流程', '再执行 finalize'],
    forceable: false,
  },

  // HOOK domain (CHG-1 — pre-commit 变更归属校验)
  'E-HOOK-001': {
    code: 'E-HOOK-001',
    name: 'HOOK_CHANGE_OWNERSHIP',
    severity: 'ERROR',
    description: '分支上无活跃变更，直接提交将绕过 MumuSpec 流程',
    fixSteps: ['运行 mumuspec new <name> 创建变更并切换到变更分支', '或将该分支加入 ci.ownership_ci_branches 白名单'],
    forceable: false,
  },

  // MERGE domain (branch-driven workflow)
  'E-MERGE-001': {
    code: 'E-MERGE-001',
    name: 'MERGE_CHANGE_NOT_FOUND',
    severity: 'ERROR',
    description: '变更不存在，无法合并',
    fixSteps: ['确认变更名称正确', 'mumuspec list 查看活跃/归档变更'],
    forceable: false,
  },
  'E-MERGE-002': {
    code: 'E-MERGE-002',
    name: 'MERGE_NOT_ARCHIVED',
    severity: 'ERROR',
    description: '变更未归档，禁止合并分支',
    fixSteps: ['先执行 mumuspec archive <name> --confirm 归档变更', '归档完成后再合并'],
    forceable: false,
  },
  'E-MERGE-003': {
    code: 'E-MERGE-003',
    name: 'MERGE_BRANCH_NOT_HANDLED',
    severity: 'ERROR',
    description: '变更分支代码未提交（branch_status 未置 handled）',
    fixSteps: ['提交分支代码后执行 mumuspec guard <name> archive-in-progress --apply --confirm'],
    forceable: false,
  },
  'E-MERGE-004': {
    code: 'E-MERGE-004',
    name: 'MERGE_ISOLATION_INVALID',
    severity: 'ERROR',
    description: '变更不是分支隔离模式或缺少分支信息',
    fixSteps: ['确认 config.yaml changes.default_isolation 为 branch', '检查变更 state.branch 字段'],
    forceable: false,
  },
  'E-MERGE-005': {
    code: 'E-MERGE-005',
    name: 'MERGE_NOT_ON_MAIN',
    severity: 'ERROR',
    description: '必须在主分支上执行合并',
    fixSteps: ['切换到主分支 (git checkout main/master) 后重试'],
    forceable: false,
  },
  'E-MERGE-006': {
    code: 'E-MERGE-006',
    name: 'MERGE_WORKING_TREE_DIRTY',
    severity: 'ERROR',
    description: '当前工作区有未提交改动，禁止合并',
    fixSteps: ['提交或 stash 当前改动后重试'],
    forceable: false,
  },
  'E-MERGE-007': {
    code: 'E-MERGE-007',
    name: 'MERGE_BRANCH_MISSING',
    severity: 'ERROR',
    description: '变更分支不存在',
    fixSteps: ['确认变更分支是否已被删除', '检查 git branch -a'],
    forceable: false,
  },
  'E-MERGE-008': {
    code: 'E-MERGE-008',
    name: 'MERGE_MAIN_BRANCH_MISSING',
    severity: 'ERROR',
    description: '未找到 main/master 主分支',
    fixSteps: ['确认仓库存在 main 或 master 分支'],
    forceable: false,
  },
  'E-MERGE-009': {
    code: 'E-MERGE-009',
    name: 'MERGE_GATE_REJECTED',
    severity: 'ERROR',
    description: '合并门禁未通过',
    fixSteps: ['查看门禁错误详情并逐项修复'],
    forceable: false,
  },
  'E-MERGE-010': {
    code: 'E-MERGE-010',
    name: 'MERGE_CONFLICT',
    severity: 'ERROR',
    description: '合并发生冲突，已暂停',
    fixSteps: ['手动解决冲突 (git status)', 'git add <files> && git commit', '重新执行 mumuspec merge'],
    forceable: false,
  },

  // GUARD domain
  'E-GUARD-001': {
    code: 'E-GUARD-001',
    name: 'GUARD_ARTIFACT_MISSING',
    severity: 'ERROR',
    description: 'Phase Guard 检查发现工件缺失',
    fixSteps: ['查看守卫报告确认缺失工件', '补充缺失工件'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-GUARD-002': {
    code: 'E-GUARD-002',
    name: 'GUARD_SHALL_VIOLATION',
    severity: 'ERROR',
    description: 'SHALL 约束未满足',
    fixSteps: ['实现 SHALL 要求', '或调整 spec.md 降低约束'],
    forceable: true,
    dimension: 'requirement_goals',
    min_strength: 'high',
  },
  'E-GUARD-003': {
    code: 'E-GUARD-003',
    name: 'GUARD_SHALL_NOT_VIOLATION',
    severity: 'ERROR',
    description: 'SHALL NOT 约束被违反',
    fixSteps: ['移除违规代码', 'SHALL NOT 不可通过 --force 跳过'],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-GUARD-004': {
    code: 'E-GUARD-004',
    name: 'GUARD_TEST_IMMUTABILITY',
    severity: 'ERROR',
    description: '测试用例或套件 hash 不匹配',
    fixSteps: ['检查文件是否被手动修改', '从 snapshots/ 恢复'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-GUARD-005': {
    code: 'E-GUARD-005',
    name: 'GUARD_HYPERPLAN_NOT_MERGED',
    severity: 'ERROR',
    description: 'hyperplan 硬约束未合并到 design.md',
    fixSteps: ['将硬约束合并到 design.md 的 SHALL/SHALL NOT'],
    forceable: false,
  },
  'E-GUARD-006': {
    code: 'E-GUARD-006',
    name: 'GUARD_HYPERPLAN_OPEN_QUESTIONS',
    severity: 'ERROR',
    description: 'hyperplan 开放问题未解决',
    fixSteps: ['查看开放问题列表', '用户决策后标记为 resolved'],
    forceable: false,
  },
  'E-GUARD-007': {
    code: 'E-GUARD-007',
    name: 'GUARD_PRE_COMMIT_TIMEOUT',
    severity: 'WARN',
    description: 'Pre-commit 检查超过 5s',
    fixSteps: ['考虑缩小检查范围', '优化规则性能'],
    forceable: true,
  },
  'E-GUARD-008': {
    code: 'E-GUARD-008',
    name: 'GUARD_COMPLETENESS_GATE_BLOCK',
    severity: 'ERROR',
    description: '完备性门禁阻塞（工件缺失 / 存在未消解 open 项 / 工件为空 / 声明路径缺人工签收）',
    fixSteps: [
      '起草并消解 open-questions.yaml / assumptions.yaml（resolution.decision_ref 指向 decisions.md 条目）',
      '或在 design.md 声明 <!-- no-open-questions --> / <!-- no-assumptions --> 并先落 decisions.md 签收条目',
    ],
    forceable: false,
    dimension: 'requirement_goals',
    min_strength: 'high',
    always_enforce: true,
  },
  'E-GUARD-009': {
    code: 'E-GUARD-009',
    name: 'DESIGN_COVERAGE_GAP',
    severity: 'ERROR',
    description: '设计覆盖断链（I1 设计向上闭合）：覆盖了 Layer N 却缺少某个 Layer < N',
    fixSteps: [
      '为缺失的更低层补 design 产物（design.md 的层级映射或 test-cases/layer-N-cases.md）',
      '或修正 build_layers 的层级编号',
      '强度为 medium 时本项降级为 W-GUARD-009 告警（top_down_design=false）',
    ],
    forceable: true,
    dimension: 'technical_design',
    min_strength: 'high',
    // Emitted as an ERROR only when top_down_design resolves true; the strength
    // folding below must not silently re-downgrade an explicitly enabled rule.
    always_enforce: true,
  },
  // BUILD domain
  'W-BUILD-001': {
    code: 'W-BUILD-001',
    name: 'BUILD_LAYER_COUPLING',
    severity: 'WARN',
    description: '同层 scope 之间存在直接调用边（I3 层内默认可并行不成立 → 设计未闭合）',
    fixSteps: [
      '将两个 scope 拆为不同 layer，或合并为一个模块',
      '确认耦合确实经由冻结契约后，用 --force 越过',
    ],
    forceable: true,
    dimension: 'technical_design',
    min_strength: 'medium',
  },

  // GUARD domain — advisory codes actually emitted by the guards.
  //
  // Like the W-DESIGN-* family below, these were emitted without a registry
  // entry, so `checkMetadataFor()` fell back to
  // { dimension: 'technical_design', min_strength: 'low' }. The values here are
  // exactly that fallback → a documentation-only change with provably identical
  // strength folding (`evaluateConstraint()` derives the action from the
  // *dimension* strength alone; `min_strength` only labels the reason).
  'W-GUARD-001': {
    code: 'W-GUARD-001',
    name: 'GUARD_PREREQUISITE_MISSING',
    severity: 'WARN',
    description: '阶段前置工件缺失或未锁定（test_cases / build_layers / tdd_mode 等行为约束）',
    fixSteps: ['补齐缺失工件', '或用 mumuspec state set 写入缺省值并在 decisions.md 说明'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-GUARD-004': {
    code: 'W-GUARD-004',
    name: 'GUARD_TEST_IMMUTABILITY_MISMATCH',
    severity: 'WARN',
    description: '测试套件 hash 与 design_content_hash 不匹配（测试在锁定后被改动）',
    fixSteps: ['回退 Design 重新锁定设计', '或用 mumuspec test-cases lock 重建 hash'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-GUARD-009': {
    code: 'W-GUARD-009',
    name: 'DESIGN_COVERAGE_GAP_ADVISORY',
    severity: 'WARN',
    description: '设计覆盖断链（I1）的告警形态：top_down_design 解析为 false 时不阻塞，但仍写入 state.design_coverage',
    fixSteps: ['为缺失的更低层补 design 产物', '或在约束强度中把 technical_design 提为 high 使其阻塞'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // PONYTAIL domain
  'E-PONYTAIL-001': {
    code: 'E-PONYTAIL-001',
    name: 'PONYTAIL_YAGNI_VIOLATION',
    severity: 'WARN',
    description: '引入了未被请求的抽象层或功能',
    fixSteps: ['删除不必要的抽象', '或用 ponytail: 注释标记理由'],
    forceable: true,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-PONYTAIL-002': {
    code: 'E-PONYTAIL-002',
    name: 'PONYTAIL_UNNECESSARY_DEPENDENCY',
    severity: 'ERROR',
    description: '在标准库/平台特性已满足时引入新依赖',
    fixSteps: ['使用标准库/平台特性替代', '或使用已有依赖'],
    forceable: false,
  },
  'E-PONYTAIL-003': {
    code: 'E-PONYTAIL-003',
    name: 'PONYTAIL_BOILERPLATE',
    severity: 'WARN',
    description: '生成未被请求的样板代码',
    fixSteps: ['删除样板代码', '使用最小可工作实现'],
    forceable: true,
  },
  'E-PONYTAIL-004': {
    code: 'E-PONYTAIL-004',
    name: 'PONYTAIL_CLEVER_OVER_SIMPLE',
    severity: 'WARN',
    description: '用复杂方案替代简单方案',
    fixSteps: ['简化为 boring 方案', '或用 ponytail: 注释标记理由'],
    forceable: true,
  },

  // CONTRACT domain — Contract Layer (Contract & Boundary Rules)
  'E-CONTRACT-001': {
    code: 'E-CONTRACT-001',
    name: 'BOUNDARY_DOC_MISSING',
    severity: 'WARN',
    description: '有代码的目录缺少 BOUNDARY.md 边界文档',
    fixSteps: ['创建 BOUNDARY.md 并声明对外接口、依赖、数据契约', '运行 mumuspec drift --fix --dry-run 预览可自动修复项'],
    forceable: true,
  },
  'E-CONTRACT-002': {
    code: 'E-CONTRACT-002',
    name: 'BOUNDARY_EXPORT_NOT_FOUND',
    severity: 'ERROR',
    description: 'BOUNDARY.md 声明的对外接口在代码中未找到实现',
    fixSteps: ['实现缺失的接口', '或更新 BOUNDARY.md 移除该声明'],
    forceable: false,
  },
  'E-CONTRACT-003': {
    code: 'E-CONTRACT-003',
    name: 'BOUNDARY_DEPENDENCY_UNUSED',
    severity: 'WARN',
    description: 'BOUNDARY.md 声明的依赖在代码中未发现实际使用',
    fixSteps: ['移除未使用的依赖声明', '或在代码中补充引入该依赖'],
    forceable: true,
  },
  'E-CONTRACT-004': {
    code: 'E-CONTRACT-004',
    name: 'BOUNDARY_CHANGELOG_EMPTY',
    severity: 'WARN',
    description: 'BOUNDARY.md 缺少变更日志',
    fixSteps: ['在 BOUNDARY.md 中添加变更日志条目'],
    forceable: true,
  },
  'E-CONTRACT-005': {
    code: 'E-CONTRACT-005',
    name: 'CONTRACT_SOURCE_MISSING',
    severity: 'ERROR',
    description: 'contracts.yaml 声明的契约源文件不存在',
    fixSteps: ['创建源文件', '或更新 contracts.yaml 修正 source 路径'],
    forceable: false,
  },
  'E-CONTRACT-006': {
    code: 'E-CONTRACT-006',
    name: 'CONTRACT_DEPRECATED_IN_USE',
    severity: 'WARN',
    description: '已标记为 deprecated 的契约仍被上游消费者使用',
    fixSteps: ['提供迁移路径 (migrationPath)', '或通知消费者切换到新契约'],
    forceable: true,
  },
  'E-CONTRACT-007': {
    code: 'E-CONTRACT-007',
    name: 'CONTRACT_SCHEMA_MISSING',
    severity: 'WARN',
    description: '契约缺少 schema 定义',
    fixSteps: ['在 contracts.yaml 中为契约添加 schema 字段'],
    forceable: true,
  },
  'E-CONTRACT-008': {
    code: 'E-CONTRACT-008',
    name: 'CONTRACT_GRAPH_INCONSISTENT',
    severity: 'WARN',
    description: '契约依赖图中引用了不存在的契约 ID',
    fixSteps: ['修正 outbound_ids / inbound_ids 或补全缺失的契约定义'],
    forceable: true,
  },
  'E-CONTRACT-009': {
    code: 'E-CONTRACT-009',
    name: 'CONTRACT_BREAKING_CHANGE',
    severity: 'ERROR',
    description: '检测到破坏性契约变更，但未提供迁移路径',
    fixSteps: ['为破坏性变更添加 migrationPath', '执行影响分析并征询用户同意后修改'],
    forceable: false,
  },
  // P0-3 Fix: Lock acquisition timeout
  'E-CONTRACT-010': {
    code: 'E-CONTRACT-010',
    name: 'CONTRACT_LOCK_TIMEOUT',
    severity: 'ERROR',
    description: '获取契约文件锁超时（5s），另一个进程可能正在修改契约',
    fixSteps: ['等待其他 mumuspec 进程完成', '检查并删除陈旧锁目录 .mumuspec/contracts/.lock'],
    forceable: false,
  },
  'E-CONTRACT-011': {
    code: 'E-CONTRACT-011',
    name: 'CONTRACT_REGISTRY_INVALID',
    severity: 'ERROR',
    description: '契约注册表文件结构无效（缺少必需字段或含 __proto__/constructor/prototype 污染键）',
    fixSteps: [
      '检查 contracts.json/contracts.yaml 的 version、contracts、outbound_ids、inbound_ids 结构',
      '文件损坏时从版本控制恢复，或重新生成契约注册表',
    ],
    forceable: false,
  },

  // KNOWLEDGE domain
  'E-KNOWLEDGE-001': {
    code: 'E-KNOWLEDGE-001',
    name: 'KNOWLEDGE_PAGE_FORMAT_INVALID',
    severity: 'ERROR',
    description: '知识页面 YAML frontmatter 格式错误',
    fixSteps: ['检查 frontmatter 字段', '运行 mumuspec knowledge verify --id <id>'],
    forceable: false,
  },
  'E-KNOWLEDGE-002': {
    code: 'E-KNOWLEDGE-002',
    name: 'KNOWLEDGE_EXTRACTION_FAIL',
    severity: 'ERROR',
    description: 'Archive 阶段知识提取失败',
    fixSteps: ['检查变更工件完整性', '重新执行 mumuspec finalize-archive <change> 补充知识提取'],
    forceable: false,
  },
  'E-KNOWLEDGE-003': {
    code: 'E-KNOWLEDGE-003',
    name: 'KNOWLEDGE_PAGE_NOT_FOUND',
    severity: 'ERROR',
    description: 'PageIndex 引用的知识页面文件不存在',
    fixSteps: ['检查 _index.yaml 条目', '恢复文件或更新索引'],
    forceable: false,
  },

  // DESIGN domain
  'E-DESIGN-001': {
    code: 'E-DESIGN-001',
    name: 'COGNITIVE_MAP_MISSING',
    severity: 'ERROR',
    description: 'cognitive-map.yaml 不存在',
    fixSteps: ['回退到 Design', '执行认知框架 Step 0'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-DESIGN-009': {
    code: 'E-DESIGN-009',
    name: 'DESIGN_SCHEMA_SECTION_MISSING',
    severity: 'ERROR',
    description: 'design.md 缺少 templates/design-schema.yaml 要求的必填 section',
    fixSteps: ['按 schema 补充缺失的 section', '运行 mumuspec guard <change> design --verbose 查看匹配规则'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-DESIGN-010': {
    code: 'E-DESIGN-010',
    name: 'CROSS_ARTIFACT_INCONSISTENCY',
    severity: 'ERROR',
    description: 'proposal 与 design 跨工件不一致（Plan 步骤未映射到 Layers、FR 未被 design 引用）',
    fixSteps: ['在 design.md 中补充对应 Layer 或 FR 引用', '或修正 proposal.md 使步骤与设计对齐'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },
  'E-DESIGN-002': {
    code: 'E-DESIGN-002',
    name: 'COGNITIVE_Q1_EMPTY',
    severity: 'ERROR',
    description: 'Q1 已知的已知为空',
    fixSteps: ['检查 proposal.md 和 spec.md 是否已加载', '重新执行 Stage 1 信息采集'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'medium',
  },

  // DESIGN domain — advisory family actually emitted by the design guards.
  //
  // These were previously *unregistered*: `phase-guard.ts` pushed them while
  // `ERROR_CODES` had no entry, so `checkMetadataFor()` fell back to
  // { dimension: 'technical_design', min_strength: 'low' }. They are registered
  // here with **exactly those fallback values**, which makes this a
  // documentation-only change with provably identical strength folding —
  // the registry no longer under-reports what the engine emits.
  //
  // Note: the registered E-DESIGN-001/002/009 have no emission site on the
  // guard path (kept for compatibility; see docs/reference/phase-guards.md).
  'W-DESIGN-001': {
    code: 'W-DESIGN-001',
    name: 'COGNITIVE_MAP_MISSING',
    severity: 'WARN',
    description: 'cognitive_framework.enabled 但 cognitive-map.yaml 不存在',
    fixSteps: ['产出 cognitive-map.yaml', '或在 .mumuspec.yaml 中关闭 cognitive_framework'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-002': {
    code: 'W-DESIGN-002',
    name: 'COGNITIVE_Q1_EMPTY',
    severity: 'WARN',
    description: 'Q1 已知的已知为空（cognitive_framework.q1_count == 0）',
    fixSteps: ['把 cognitive_framework.q1_count 更新为实际条目数'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-003': {
    code: 'W-DESIGN-003',
    name: 'COGNITIVE_Q2_PENDING',
    severity: 'WARN',
    description: 'Q2 存在未回答的问题（cognitive_framework.q2_pending > 0）',
    fixSteps: ['回答或关闭 Q2 条目', '或达到轮次上限后显式收敛'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-004': {
    code: 'W-DESIGN-004',
    name: 'COGNITIVE_Q3_PENDING',
    severity: 'WARN',
    description: 'Q3 存在未确认的推导（cognitive_framework.q3_pending > 0）',
    fixSteps: ['确认或驳回 Q3 推导', '或达到轮次上限后显式收敛'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-005': {
    code: 'W-DESIGN-005',
    name: 'COGNITIVE_Q4_INSUFFICIENT_SCANS',
    severity: 'WARN',
    description: 'Q4 盲区扫描维度不足（cognitive_framework.q4_scans_completed < 3）',
    fixSteps: ['至少补充 3 个 Q4 blind-spot entry'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-006': {
    code: 'W-DESIGN-006',
    name: 'COGNITIVE_MAP_NOT_CONVERGED',
    severity: 'WARN',
    description: '认知地图未收敛（cognitive_framework.converged == false）',
    fixSteps: ['清空 q2_pending / q3_pending 后置 converged: true'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-007': {
    code: 'W-DESIGN-007',
    name: 'GRILL_ME_INCOMPLETE',
    severity: 'WARN',
    description: 'grill-me 压力测试未完成（grill_me_result.completed == false）',
    fixSteps: ['执行 grill-me 并写入 grill_me_result', '或在 decisions.md 记录跳过理由'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-008': {
    code: 'W-DESIGN-008',
    name: 'GRILL_ME_ROUNDS_EXCEEDED',
    severity: 'WARN',
    description: 'grill-me 追问轮次超出上限',
    fixSteps: ['收敛剩余分支', '或调整 max_rounds 并记录决策'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-009': {
    code: 'W-DESIGN-009',
    name: 'DESIGN_SCHEMA_SECTION_MISSING',
    severity: 'WARN',
    description: 'design.md 缺少 templates/design-schema.yaml 要求的 section',
    fixSteps: ['按 schema 补充缺失的 section'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-010': {
    code: 'W-DESIGN-010',
    name: 'CROSS_ARTIFACT_INCONSISTENCY',
    severity: 'WARN',
    description: 'proposal / design / delta-specs 跨工件不一致（调用点由 E-DESIGN-010 重映射而来）',
    fixSteps: ['在 design.md 中补充对应 Layer 或 FR 引用', '或修正 proposal.md 使步骤与设计对齐'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'W-DESIGN-011': {
    code: 'W-DESIGN-011',
    name: 'GRILL_ME_DEFERRED_UNRESOLVED',
    severity: 'WARN',
    description: 'grill-me 存在未达成共识的 deferred 分支',
    fixSteps: ['就 deferred 分支达成共识', '或在 decisions.md 显式接受该不确定性'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // SECURITY domain
  'E-SECURITY-001': {
    code: 'E-SECURITY-001',
    name: 'SECURITY_PATH_TRAVERSAL',
    severity: 'ERROR',
    description: 'CLI 参数路径超出项目根目录',
    fixSteps: ['使用项目内相对路径', '不使用 ../ 等路径逃逸符号'],
    forceable: false,
  },
  'E-SECURITY-002': {
    code: 'E-SECURITY-002',
    name: 'CHANGE_NAME_INVALID',
    severity: 'ERROR',
    description: '变更名称含非法字符（路径分隔符或 .. 序列）',
    fixSteps: ['使用字母数字 + . _ - 组合的名称', '名称不能以 . 或 - 开头'],
    forceable: false,
  },
  'E-SECURITY-003': {
    code: 'E-SECURITY-003',
    name: 'MCP_PATH_REQUIRED',
    severity: 'ERROR',
    description: 'MCP 工具调用未提供 path 参数或参数类型错误',
    fixSteps: ['检查调用参数是否包含有效的 path 字符串', '确保 path 为相对路径且非空'],
    forceable: false,
  },

  // STATE domain (CHG-2 — 守卫绕过审计 / 受保护字段)
  'E-STATE-001': {
    code: 'E-STATE-001',
    name: 'STATE_PROTECTED_FIELD',
    severity: 'ERROR',
    description: 'state set 尝试修改受保护字段（认知/测试/阶段等），且 guard.bypass_audit=false 拒绝绕过',
    fixSteps: ['通过 guard --apply 正规流程推进阶段', '如需绕过请在 config.yaml 设置 guard.bypass_audit: true 并接受审计'],
    forceable: false,
  },

  // AGENTS domain (CHG-3 — 规范同步 hash)
  'E-AGENTS-001': {
    code: 'E-AGENTS-001',
    name: 'AGENTS_SPEC_DRIFT',
    severity: 'ERROR',
    description: 'AGENTS.md 与 spec 内容漂移（生成的 rules 基于旧版规范）',
    fixSteps: ['重新运行 mumuspec init 同步 AGENTS.md 与 agents-hash.json'],
    forceable: false,
  },

  // RULES domain（分发层容量预算 — 分发层 ENF-3）
  'E-RULES-001': {
    code: 'E-RULES-001',
    name: 'RULES_BUDGET_EXCEEDED',
    severity: 'ERROR',
    description: '生成的 Rules 产物超过 32KiB 容量预算（禁止在 Rules 文件中内联全量规范上下文）',
    fixSteps: [
      '缩减 Rules 内容：渐进式披露职责归 MCP，Rules 文件仅保留摘要与速查',
      '检查 spec 摘要是否被全量内联（应为逐层摘要而非全文）',
    ],
    forceable: false,
  },

  // CHECK domain（spec.ts 统一 `mumuspec check` action — LOOP-4 L2）
  'E-CHECK-001': {
    code: 'E-CHECK-001',
    name: 'CHECK_ACTION_FAILED',
    severity: 'ERROR',
    description: 'mumuspec check 执行过程中发生未预期错误（compliance / glossary 或 check 主体流程抛错；drift 检测源的失败已逐源隔离为 W-CHECK-002，不再走到这里）',
    fixSteps: ['查看下方错误信息定位具体子系统', '修复后重新运行 mumuspec check'],
    forceable: false,
  },
  'W-CHECK-002': {
    code: 'W-CHECK-002',
    name: 'DRIFT_SOURCE_FAILED',
    severity: 'WARN',
    description: '某个 drift 检测源抛出异常——该源本轮无结果（盲区），其余检测源不受影响',
    fixSteps: ['查看消息中的源名与异常原因', '修复该检测源后重新运行 mumuspec check'],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // SKILL domain（技能分发与安装：副本漂移、插件清单、登记文件）
  'W-SKILL-001': {
    code: 'W-SKILL-001',
    name: 'SKILL_COPY_DRIFT',
    severity: 'WARN',
    description: '技能源与已安装副本的正文不一致（比对已剥离 frontmatter 版本行，故版本戳印不产生噪声）',
    fixSteps: [
      '核对诊断中给出的源路径与安装路径差异',
      '重新安装技能以同步副本：mumuspec install <agent> <packages...> --force',
    ],
    forceable: true,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'E-SKILL-002': {
    code: 'E-SKILL-002',
    name: 'PLUGIN_MANIFEST_INVALID',
    severity: 'ERROR',
    description: '插件或市场清单未通过官方规范校验（name 形态、语义化版本、相对路径、source 存在性等）',
    fixSteps: [
      '按违例列表逐条修正 path + rule + message 指向的字段',
      '重新执行最小构建（mumuspec bundle plugin）确认清单通过校验器',
    ],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'E-SKILL-003': {
    code: 'E-SKILL-003',
    name: 'PLUGIN_REGISTRY_WRITE_FAILED',
    severity: 'ERROR',
    description: '宿主插件登记文件不可写或内容不是合法 JSON——安装整体失败，不留"已复制但未登记"的中间态',
    fixSteps: [
      '检查登记文件权限与其 JSON 结构（version + plugins 两字段）',
      '修复后重新安装；或用 --dry-run 先查看待登记内容',
    ],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },
  'E-BUNDLE-001': {
    code: 'E-BUNDLE-001',
    name: 'BUNDLE_PUBLISH_UNIMPLEMENTED',
    severity: 'ERROR',
    description: 'bundle publish 能力未实现——动作未完成时 fail-closed，不得返回假成功',
    fixSteps: [
      '改用插件标准产出：mumuspec bundle plugin --out <dir>',
      '发布登记需宿主侧配合，当前不提供自动发布',
    ],
    forceable: false,
    dimension: 'technical_design',
    min_strength: 'low',
  },

  // GIT domain（git.ts 统一封装的错误）
  'E-GIT-001': {
    code: 'E-GIT-001',
    name: 'GIT_SPAWN_FAILED',
    severity: 'ERROR',
    description: 'git 命令无法启动（未安装 git 或不在 PATH 中）',
    fixSteps: ['确认已安装 git 且 git --version 可正常执行', '检查 PATH 环境变量包含 git'],
    forceable: false,
  },
  'E-GIT-002': {
    code: 'E-GIT-002',
    name: 'GIT_COMMAND_FAILED',
    severity: 'ERROR',
    description: 'git 命令执行失败（非零退出码）',
    fixSteps: ['根据下方输出排查 git 失败原因', '确认当前目录是有效的 git 仓库', '检查分支/提交引用是否存在'],
    forceable: false,
  },
  'E-GIT-003': {
    code: 'E-GIT-003',
    name: 'GIT_MAIN_BRANCH_NOT_FOUND',
    severity: 'ERROR',
    description: '未找到 main 或 master 主分支',
    fixSteps: ['确认仓库已初始化且存在 main/master 分支', '或手动指定目标分支'],
    forceable: false,
  },
};

/** Get error code definition */
export function getErrorCode(code: string): ErrorCodeDef | undefined {
  return ERROR_CODES[code];
}

/** Format error message */
export function formatError(code: string, context?: Record<string, unknown>): string {
  const def = ERROR_CODES[code];
  if (!def) return `[${code}] Unknown error`;

  const lines: string[] = [];
  lines.push(`[${def.code}] ${def.name} (${def.severity})`);
  lines.push(`  描述: ${def.description}`);

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (def.fixSteps.length > 0) {
    lines.push('  修复步骤:');
    def.fixSteps.forEach((step, i) => {
      lines.push(`    ${i + 1}. ${step}`);
    });
  }

  if (def.forceable) {
    lines.push('  可通过 --force 跳过');
  }

  return lines.join('\n');
}

/** MumuSpec error class */
export class MumuSpecError extends Error {
  code: string;
  severity: Severity;
  context?: Record<string, unknown>;
  forceable: boolean;

  constructor(code: string, context?: Record<string, unknown>) {
    const def = ERROR_CODES[code];
    super(formatError(code, context));
    this.name = 'MumuSpecError';
    this.code = code;
    this.severity = def?.severity ?? 'ERROR';
    this.context = context;
    this.forceable = def?.forceable ?? false;
  }
}
