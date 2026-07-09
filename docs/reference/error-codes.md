# 错误码参考

> 层级: Level 2 参考文档

---

## 错误码格式

`E-<DOMAIN>-<NUMBER>`

| Domain | 范围 | 说明 |
|--------|------|------|
| SPEC | E-SPEC-001 ~ E-SPEC-099 | 规范层错误 |
| CHANGE | E-CHANGE-001 ~ E-CHANGE-099 | 变更层错误 |
| GUARD | E-GUARD-001 ~ E-GUARD-099 | 校验层错误 |
| GRAPH | E-GRAPH-001 ~ E-GRAPH-099 | 代码图谱错误 |
| CONTRACT | E-CONTRACT-001 ~ E-CONTRACT-099 | 契约层错误 |
| DESIGN | E-DESIGN-001 ~ E-DESIGN-099 | 设计层错误（认知框架） |
| SECURITY | E-SECURITY-001 ~ E-SECURITY-099 | 安全错误 |

---

## 错误码定义表

### SPEC — 规范层

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-SPEC-001 | SPEC_FORMAT_INVALID | ERROR | spec.md YAML frontmatter 格式错误 | frontmatter 字段类型不匹配或缺失必填字段 | 1. 检查 `layer`/`scope`/`last_updated` 字段类型 2. 参考 [规范格式](../design/spec-layer.md#4-规范文件格式) 3. 运行 `mumuspec validate` 重新校验 | [规范层设计](../design/spec-layer.md) |
| E-SPEC-002 | SPEC_LAYER_EXCEED_MAX | ERROR | 规范层级超过 max_layer_depth | 目录嵌套深度超过 config.yaml 中 `specs.max_layer_depth`（默认 5） | 1. 检查目录嵌套深度 2. 调整 `config.yaml: specs.max_layer_depth` 3. 或将深层目录规范合并到父层 | [配置参考](configuration.md) |
| E-SPEC-003 | SPEC_INHERITANCE_CONFLICT | ERROR | 子层 SHALL NOT 与父层 SHALL 矛盾 | 子层收紧约束到与父层 SHALL 要求互斥 | 1. 检查继承链 2. 调整子层 SHALL NOT 或父层 SHALL 3. 必要时引入中间层过渡 | [规范层设计](../design/spec-layer.md#5-规范层级关系与继承) |
| E-SPEC-004 | SPEC_ENFORCEMENT_MISSING | WARN | SHALL/SHALL NOT 无对应 Enforcement | 约束声明缺少可执行检查规则 | 1. 为该约束补充 Enforcement 检查规则 2. 或标记为 `enforcement: manual`（降级为人工检查） | [规范层设计](../design/spec-layer.md) |
| E-SPEC-005 | SPEC_DRIFT_DETECTED | ERROR | spec.md 声明的 Requirement 在代码中无实现 | 规范与代码不一致 | 1. 检查是否遗漏实现 2. 或更新 spec.md 移除该 Requirement 3. 运行 `mumuspec drift` 确认修复 | [漂移检测](drift-detection.md) |
| E-SPEC-006 | SPEC_DESIGN_DOC_MISSING | ERROR | 有 spec.md 但无 design.md | 每个有 spec.md 的目录必须维护 design.md | 1. 运行 `mumuspec design init <scope>` 创建 design.md 2. 填写设计决策和架构原理 | [规范层设计](../design/spec-layer.md#43-designmd--目录级设计文档) |
| E-SPEC-007 | SPEC_INDEX_OUTDATED | WARN | index.yaml 与实际目录结构不一致 | 子目录新增/删除后未更新索引 | 1. 运行 `mumuspec spec index --update` 2. 或设置 `config.yaml: specs.auto_index: true` | [配置参考](configuration.md) |

### CHANGE — 变更层

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-CHANGE-001 | CHANGE_ALREADY_ACTIVE | ERROR | 已有活跃变更，无法创建新变更 | 单一活跃变更约束阻止并行变更 | 1. 完成或 Discard 当前变更 2. `mumuspec list` 查看活跃变更 3. `mumuspec archive <name>` 或 `mumuspec discard <name>` | [变更层设计](../design/change-layer.md) |
| E-CHANGE-002 | CHANGE_ROLLBACK_LIMIT | ERROR | rollback_count 达到上限（默认 3） | 变更回退次数耗尽 | 1. 接受偏差: `mumuspec change accept-deviations --change <name>` 2. 废弃: `mumuspec discard <name>` 3. 手动提升上限（需审批）: `mumuspec config set changes.rollback_limit 5` | [错误恢复决策树](../design/change-layer.md#9-错误恢复决策树) |
| E-CHANGE-003 | CHANGE_REBUILD_LIMIT | ERROR | rebuild_count 达到上限（默认 5） | 重建次数耗尽，强制升级为 Design 回退 | 1. 系统自动升级为 `verify_to_design_rollback` 2. 若 rollback_count 也超限 → 进入 E-CHANGE-002 流程 | [错误恢复决策树](../design/change-layer.md#92-rebuild_count-超限) |
| E-CHANGE-004 | CHANGE_TEST_CASES_LOCKED | ERROR | 尝试修改已锁定的 test-cases/ | Design 阶段锁定后测试用例不可变 | 1. 回退到 Design: `mumuspec rollback <name> --to design` 2. 修改 test-cases/ 3. 重新锁定: `mumuspec test-cases lock <name>` | [变更层设计](../design/change-layer.md) |
| E-CHANGE-005 | CHANGE_WORKTREE_FAIL | ERROR | worktree 创建失败 | 磁盘空间不足/权限问题/git 异常 | 1. 检查磁盘空间和权限 2. 降级为 branch 模式: `mumuspec config set changes.default_isolation branch` 3. 记录降级原因到 decisions.md | [错误恢复决策树](../design/change-layer.md#95-worktree-创建失败) |
| E-CHANGE-006 | CHANGE_PHASE_INVALID_TRANSITION | ERROR | 非法状态机转换 | 当前 phase 不允许转换到目标 phase | 1. 检查当前 phase: `mumuspec status <name>` 2. 参考 [Phase Guard](phase-guards.md) 确认可转换路径 3. 使用 `mumuspec state graph <name>` 可视化状态机 | [Phase Guard](phase-guards.md) |
| E-CHANGE-007 | CHANGE_DECISIONS_HASH_MISMATCH | ERROR | decisions.md content_hash 不匹配 | decisions.md 被手动篡改 | 1. 检查 decisions.md 是否被手动修改 2. 从 snapshots/ 恢复正确版本 3. 运行 `mumuspec guard <name> <phase>` 重新校验 | [Phase Guard](phase-guards.md) |

### GUARD — 校验层

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-GUARD-001 | GUARD_ARTIFACT_MISSING | ERROR | Phase Guard 检查发现工件缺失 | 阶段转换缺少必要文件 | 1. 查看守卫报告确认缺失工件 2. 补充缺失工件 3. 重新运行 `mumuspec guard <name> <phase>` | [Phase Guard](phase-guards.md) |
| E-GUARD-002 | GUARD_SHALL_VIOLATION | ERROR | SHALL 约束未满足 | 正向要求未实现 | 1. 实现 SHALL 要求 2. 或调整 spec.md 降低约束 3. 运行 `mumuspec check --shall` 验证 | [漂移检测](drift-detection.md) |
| E-GUARD-003 | GUARD_SHALL_NOT_VIOLATION | ERROR | SHALL NOT 约束被违反 | 反向禁止被触碰 | 1. 移除违规代码 2. 或调整 spec.md（需走变更流程） 3. SHALL NOT 不可通过 `--force` 跳过 | [漂移检测](drift-detection.md) |
| E-GUARD-004 | GUARD_TEST_IMMUTABILITY | ERROR | 测试用例或套件 hash 不匹配 | test-cases/ 或 suite-map.yaml 被篡改 | 1. 检查文件是否被手动修改 2. 从 snapshots/ 恢复 3. 运行 `mumuspec test-immutability <name>` 验证 | [漂移检测](drift-detection.md) |
| E-GUARD-005 | GUARD_HYPERPLAN_NOT_MERGED | ERROR | hyperplan 硬约束未合并到 design.md | 对抗审查产出未整合到设计文档 | 1. 读取 `.mumuspec.yaml: hyperplan_result.hard_constraints` 2. 将硬约束合并到 design.md 的 SHALL/SHALL NOT 3. 运行 `mumuspec check --hyperplan-merged --change <name>` | [变更层设计](../design/change-layer.md) |
| E-GUARD-006 | GUARD_HYPERPLAN_OPEN_QUESTIONS | ERROR | hyperplan 开放问题未解决 | 对抗审查的未收敛争议阻断后续步骤 | 1. 查看开放问题列表 2. 用户决策后标记为 resolved 3. 运行 `mumuspec check --hyperplan-open-questions --change <name>` | [变更层设计](../design/change-layer.md) |
| E-GUARD-007 | GUARD_PRE_COMMIT_TIMEOUT | WARN | Pre-commit 检查超过 5s | 检查规则过多或项目过大 | 1. 考虑缩小检查范围 2. 优化规则性能 3. 或使用 `--staged-only` 限制检查范围 | [校验层设计](../design/guard-layer.md) |

### GRAPH — 代码图谱

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-GRAPH-001 | GRAPH_INDEX_FAIL | ERROR | 代码索引失败 | 文件权限/tree-sitter 语法支持问题 | 1. 检查文件读写权限 2. 确认 tree-sitter 语法包已安装 3. 运行 `mumuspec index --verbose` 查看详情 | [知识层设计](../design/knowledge-layer.md) |
| E-GRAPH-002 | GRAPH_DRIFT | WARN | 图谱节点与实际代码不一致 | 代码变更后未更新图谱 | 1. 运行 `mumuspec index` 更新图谱 2. 或启用 `config.yaml: code_graph.auto_index_on_commit: true` | [漂移检测](drift-detection.md) |
| E-GRAPH-003 | GRAPH_BROKEN_CHAIN | ERROR | 检测到断裂的调用链 | 被引用的函数/类已被删除 | 1. 检查代码是否删除了被引用的符号 2. 修复引用或恢复符号 3. 运行 `mumuspec trace <symbol>` 验证 | [知识层设计](../design/knowledge-layer.md) |
| E-GRAPH-004 | GRAPH_LANGUAGE_UNSUPPORTED | WARN | 检测到不支持的语言文件 | tree-sitter 未安装该语言语法包 | 1. 安装对应语言的 tree-sitter 语法包 2. 或在 config.yaml `code_graph.languages` 中排除该语言 | [配置参考](configuration.md) |

### CONTRACT — 契约层

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-CONTRACT-001 | CONTRACT_NOT_REGISTERED | WARN | 契约文件未在 _registry.yaml 注册 | 新添加的契约文件未注册 | 1. 运行 `mumuspec contract registry update` 2. 或手动编辑 _registry.yaml | [契约层设计](../design/contract-layer.md) |
| E-CONTRACT-002 | CONTRACT_DRIFT_EXTERNAL | ERROR | 代码调用外部服务但无契约声明 | 发现未声明的跨服务调用 | 1. 在 `contracts/external/` 中创建对应契约 2. 运行 `mumuspec contract derive <name>` 派生约束 | [契约层设计](../design/contract-layer.md) |
| E-CONTRACT-003 | CONTRACT_DRIFT_OUTBOUND | ERROR | 代码暴露接口未在 outbound 契约声明 | 对外接口缺少正式契约 | 1. 在 `contracts/outbound/` 中创建对应契约 2. 运行 `mumuspec contract verify --all` 验证 | [契约层设计](../design/contract-layer.md) |
| E-CONTRACT-004 | CONTRACT_BREAKING_CHANGE | ERROR | stable 端点字段被删除或类型改变 | 向后兼容性破坏 | 1. 走 deprecation 流程（先标注 deprecated） 2. 或新增 API 版本 3. 运行 `mumuspec contract compat-check <name>` | [契约层设计](../design/contract-layer.md#7-版本管理与兼容性) |
| E-CONTRACT-005 | CONTRACT_DERIVE_FAIL | ERROR | 派生约束注入失败 | scope 路径不存在或格式错误 | 1. 检查 `derived_constraints.scope` 路径 2. 确认目标 `.mumuspec/` 目录存在 3. 运行 `mumuspec contract derive <name> --verbose` | [契约层设计](../design/contract-layer.md#6-约束派生机制) |
| E-CONTRACT-006 | CONTRACT_REF_UNRESOLVED | ERROR | $ref 引用无法解析 | schemas/ 目录中引用路径错误 | 1. 检查 `$ref` 路径 2. 确认 schemas/ 目录结构 3. 运行 `mumuspec contract verify <name>` | [契约层设计](../design/contract-layer.md) |

### DESIGN — 设计层（认知框架）

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-DESIGN-001 | COGNITIVE_MAP_MISSING | ERROR | cognitive-map.yaml 不存在 | Design 阶段未执行认知框架 | 1. 回退到 Design 2. 执行认知框架 Step 0 3. 生成 cognitive-map.yaml | [认知框架](cognitive-framework.md) |
| E-DESIGN-002 | COGNITIVE_Q1_EMPTY | ERROR | Q1 已知的已知为空 | 信息采集未完成 | 1. 检查 proposal.md 和 spec.md 是否已加载 2. 重新执行 Stage 1 信息采集 | [认知框架](cognitive-framework.md) |
| E-DESIGN-003 | COGNITIVE_Q2_PENDING | ERROR | Q2 存在待回答问题且未达轮次上限 | 有未解决的已知未知 | 1. 回答待处理的 Q2 问题 2. 或达到轮次上限后强制收敛 | [认知框架](cognitive-framework.md) |
| E-DESIGN-004 | COGNITIVE_Q3_PENDING | ERROR | Q3 存在待确认推导且未达轮次上限 | 有未确认的隐性需求 | 1. 确认或拒绝待处理的 Q3 推导 2. 或达到轮次上限后强制收敛 | [认知框架](cognitive-framework.md) |
| E-DESIGN-005 | COGNITIVE_Q4_INCOMPLETE | ERROR | Q4 盲区扫描未完成（少于 3 个维度） | 盲区扫描不充分 | 1. 补充 Q4 扫描维度 2. 确保至少扫描 3 个维度 | [认知框架](cognitive-framework.md) |
| E-DESIGN-006 | COGNITIVE_NOT_CONVERGED | ERROR | 认知地图未收敛且未达轮次上限 | 认知框架未完成收敛 | 1. 继续执行 Q2/Q3 轮次 2. 或达到轮次上限后强制收敛 3. 重新通过 design_to_build 守卫 | [认知框架](cognitive-framework.md) |

### SECURITY — 安全

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 | 相关文档 |
|--------|------|---------|---------|---------|---------|---------|
| E-SECURITY-001 | SECURITY_PATH_TRAVERSAL | ERROR | CLI 参数路径超出项目根目录 | 路径遍历攻击防护 | 1. 使用项目内相对路径 2. 不使用 `../` 等路径逃逸符号 | [校验层设计](../design/guard-layer.md#5-安全校验) |
| E-SECURITY-002 | SECURITY_MCP_UNAUTHORIZED | ERROR | MCP 调用未通过 Token 认证 | MCP Server 访问控制 | 1. 设置 `MUMUSPEC_MCP_TOKEN` 环境变量 2. 确认 Token 与配置一致 | [校验层设计](../design/guard-layer.md#52-mcp-server-访问控制) |
| E-SECURITY-003 | SECURITY_SENSITIVE_INFO | WARN | 规范文件中检测到敏感信息模式 | API Key/Token/密码等可能泄露 | 1. 移除敏感信息 2. 或在 config.yaml 中标记为允许的模式 3. 检查是否应使用环境变量替代 | [校验层设计](../design/guard-layer.md#54-敏感信息检测) |
| E-SECURITY-004 | SECURITY_YAML_INJECTION | ERROR | YAML 文件包含潜在注入载荷 | 危险 YAML 标签（如 `!!python/eval`） | 1. 检查 YAML 内容 2. 移除危险标签 3. 使用安全 YAML 解析器 | [校验层设计](../design/guard-layer.md#53-输入校验规则) |

---

## 错误信息模板

每个错误输出遵循以下格式：

```
[E-CHANGE-002] CHANGE_ROLLBACK_LIMIT (ERROR)
  描述: rollback_count 已达到上限 (3/3)
  当前变更: add-user-auth
  上下文: Verify 阶段发现设计缺陷，需回退到 Design
  可选操作:
    1. 接受偏差归档: mumuspec change accept-deviations --change add-user-auth
    2. 废弃变更:     mumuspec change discard --change add-user-auth
    3. 手动提升上限: mumuspec config set changes.rollback_limit 5 (需记录原因)
  相关文档: docs/reference/error-codes.md#E-CHANGE-002
```

### `--force` 选项说明

| 错误码 | `--force` 行为 | 说明 |
|--------|---------------|------|
| E-SPEC-004 | 可跳过 WARN | 标记为 `enforcement: manual` |
| E-SPEC-007 | 可跳过 WARN | 自动更新 index.yaml |
| E-GUARD-002 | 可跳过（记录偏差） | 仅记录到 accepted_deviations，不阻断 |
| E-GUARD-003 | **不可跳过** | SHALL NOT 违规不可 force |
| E-GUARD-007 | 可跳过 WARN | 继续提交 |
| E-CONTRACT-001 | 可跳过 WARN | 自动注册 |
| E-SECURITY-003 | 可跳过 WARN | 标记为允许的模式 |

> **重要**: SHALL NOT 违规（E-GUARD-003）和测试不可变性违规（E-GUARD-004）**永远不可**通过 `--force` 跳过。

---

> **导航**: [← Skill 生态](skill-ecosystem.md) | [发布策略 →](release-strategy.md) | [返回概览](../overview.md)
