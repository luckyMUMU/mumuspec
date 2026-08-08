import type { Severity } from './types.js';

/** Error code definition */
export interface ErrorCodeDef {
  code: string;
  name: string;
  severity: Severity;
  description: string;
  fixSteps: string[];
  forceable: boolean;
}

/** All error code definitions */
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
    description: 'SHALL/SHALL NOT 无对应 Enforcement',
    fixSteps: ['为该约束补充 Enforcement 检查规则', '或标记为 enforcement: manual'],
    forceable: true,
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
    fixSteps: ['运行 mumuspec design init <scope> 创建 design.md'],
    forceable: false,
  },
  'E-SPEC-007': {
    code: 'E-SPEC-007',
    name: 'SPEC_INDEX_OUTDATED',
    severity: 'WARN',
    description: 'index.yaml 与实际目录结构不一致',
    fixSteps: ['运行 mumuspec validate --update-index'],
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
    fixSteps: ['使用 ## Requirement: <name> 格式定义约束', '运行 mumuspec validate --verbose'],
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
    fixSteps: ['回退到 Design: mumuspec rollback <name> --to design'],
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
  },
  'E-CHANGE-007': {
    code: 'E-CHANGE-007',
    name: 'CHANGE_DECISIONS_HASH_MISMATCH',
    severity: 'ERROR',
    description: 'decisions.md content_hash 不匹配',
    fixSteps: ['检查 decisions.md 是否被手动修改', '从 snapshots/ 恢复正确版本'],
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
  },
  'E-GUARD-002': {
    code: 'E-GUARD-002',
    name: 'GUARD_SHALL_VIOLATION',
    severity: 'ERROR',
    description: 'SHALL 约束未满足',
    fixSteps: ['实现 SHALL 要求', '或调整 spec.md 降低约束'],
    forceable: true,
  },
  'E-GUARD-003': {
    code: 'E-GUARD-003',
    name: 'GUARD_SHALL_NOT_VIOLATION',
    severity: 'ERROR',
    description: 'SHALL NOT 约束被违反',
    fixSteps: ['移除违规代码', 'SHALL NOT 不可通过 --force 跳过'],
    forceable: false,
  },
  'E-GUARD-004': {
    code: 'E-GUARD-004',
    name: 'GUARD_TEST_IMMUTABILITY',
    severity: 'ERROR',
    description: '测试用例或套件 hash 不匹配',
    fixSteps: ['检查文件是否被手动修改', '从 snapshots/ 恢复'],
    forceable: false,
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

  // PONYTAIL domain
  'E-PONYTAIL-001': {
    code: 'E-PONYTAIL-001',
    name: 'PONYTAIL_YAGNI_VIOLATION',
    severity: 'WARN',
    description: '引入了未被请求的抽象层或功能',
    fixSteps: ['删除不必要的抽象', '或用 ponytail: 注释标记理由'],
    forceable: true,
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
    fixSteps: ['创建 BOUNDARY.md 并声明对外接口、依赖、数据契约', '运行 mumuspec drift --fix-auto'],
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
    fixSteps: ['检查变更工件完整性', '重新执行 mumuspec knowledge extract <change>'],
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
  },
  'E-DESIGN-002': {
    code: 'E-DESIGN-002',
    name: 'COGNITIVE_Q1_EMPTY',
    severity: 'ERROR',
    description: 'Q1 已知的已知为空',
    fixSteps: ['检查 proposal.md 和 spec.md 是否已加载', '重新执行 Stage 1 信息采集'],
    forceable: false,
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
