# MumuSpec 设计文档改进计划

> **基于**: [设计文档审查报告](review-report.md) | **审查评分**: 78/100 (B)
> **创建日期**: 2026-07-09 | **状态**: ✅ P0+P1+P2 全部执行完成
> **目标评分**: ≥ 90/100 (A)

---

## 改进总览

| 优先级 | 任务数 | 涉及严重问题 | 涉及改进建议 | 预计工时 |
|--------|--------|-------------|-------------|---------|
| **P0 — 阻塞项** | 8 | S-01 ~ S-08 | — | 5-7 天 |
| **P1 — 短期改进** | 8 | — | I-01 ~ I-04, I-06, I-08 ~ I-10 | 4-5 天 |
| **P2 — 长期优化** | 4 | — | I-05, I-07, I-11 ~ I-13 | 后续迭代 |
| **总计** | 20 | 8 | 13 | 9-12 天 |

---

## P0：阻塞项（必须修复后才能进入实现阶段）

### Task P0-1：补充量化目标 [S-01]

- **目标文档**: `docs/overview.md`
- **问题**: 仅定性描述（4大挑战、3大支柱），缺少可量化成功指标
- **修改位置**: §1 问题陈述 之后，新增 §1.1 量化目标
- **具体内容**:

```markdown
## 1.1 量化目标

| 维度 | 指标 | 目标值 | 度量方式 |
|------|------|--------|---------|
| **性能** | Pre-commit 检查耗时 | < 5s（1万文件）| `mumuspec check --benchmark` |
| **性能** | CI 全量校验耗时 | < 5min（10万文件）| CI pipeline 计时 |
| **性能** | Phase Guard 耗时 | < 30s | `mumuspec guard --timing` |
| **性能** | 规范加载 token 消耗 | 较全量加载减少 ≥ 60% | 对比渐进式披露 vs 全量加载的 token 数 |
| **质量** | 规范-代码漂移检出率 | 100%（ERROR 级） | CI 漂移检测报告 |
| **质量** | SHALL NOT 违规阻断率 | 100% | Pre-commit + CI 统计 |
| **效率** | 变更回退率（rollback/total） | < 20% | .mumuspec.yaml 统计 |
| **效率** | Design→Build 一次通过率 | ≥ 80% | Phase Guard 日志 |
| **采纳** | `mumuspec init` 成功率 | ≥ 95% | CLI 遥测（匿名） |
| **采纳** | 新项目首次变更完成时间 | < 30min（hotfix） | CLI 计时 |
```

- **依赖**: 无
- **验证**: 指标可度量、可验收、与现有性能声明（<5s / <5min / <30s）一致

---

### Task P0-2：明确非目标（Non-Goals） [S-02]

- **目标文档**: `docs/overview.md`
- **问题**: 无 out-of-scope 声明，边界模糊
- **修改位置**: §1.1 量化目标 之后，新增 §1.2 非目标
- **具体内容**:

```markdown
## 1.2 非目标（Non-Goals）

以下功能明确不在 MumuSpec 当前范围内：

| 非目标 | 原因 | 未来可能 revisit 的版本 |
|--------|------|------------------------|
| **多项目规范同步** | 当前聚焦单项目规范管理，跨项目共享留给 Phase 5 生态层 | v1.0+ |
| **IDE 原生插件**（VS Code 扩展等） | 通过 MCP Server + CLI 覆盖 IDE 集成需求，原生插件投入产出比低 | v1.0+ |
| **可视化编辑器** | 规范文件为 YAML + Markdown，无需专用编辑器 | 不计划 |
| **规范自动生成**（从代码逆向生成 spec.md） | 规范是设计意图的表达，自动生成会导致"代码即规范"的循环依赖 | 不计划 |
| **多语言规范翻译** | 规范以项目主语言编写，AI 工具可自行翻译 | 不计划 |
| **实时协作编辑** | 单一活跃变更约束已序列化规范修改，无需实时协作 | 不计划 |
| **规范版本回滚**（rollback spec to historical version） | 规范变更通过 Git 版本控制管理，不额外实现 | 不计划 |
| **强制代码风格检查**（格式化、缩进等） | 由项目现有 ESLint/Prettier 负责，MumuSpec 聚焦架构约束 | 不计划 |
```

- **依赖**: 无
- **验证**: 与现有设计无矛盾；团队评审确认边界合理

---

### Task P0-3：安全设计补全 [S-03]

- **目标文档**: `docs/design/guard-layer.md`
- **问题**: 无认证授权、数据加密、输入校验、注入防护
- **修改位置**: §3 漂移检测 之后，新增 §4 安全校验
- **具体内容大纲**:

```markdown
## 4. 安全校验

### 4.1 威胁模型

| 威胁面 | 威胁 | 影响 | 缓解措施 |
|--------|------|------|---------|
| MCP Server | 未授权访问 MCP 工具 | 规范/代码被篡改 | 本地绑定 + Token 认证 |
| 规范文件 | 恶意 YAML/Markdown 注入 | 执行任意代码 | 输入校验 + 沙箱解析 |
| CLI 命令 | 路径遍历攻击 | 读取项目外文件 | 路径白名单校验 |
| .mumuspec.yaml | 状态篡改 | 绕过 Phase Guard | hash 校验 + 不可变字段 |
| 契约文件 | 外部服务伪造契约 | 注入错误 RPC 约束 | 签名验证 + 来源标记 |
| Git Hooks | Hook 被禁用 | 绕过 pre-commit 检查 | CI 层兜底校验 |

### 4.2 MCP Server 访问控制

- 绑定 `127.0.0.1`，不暴露到网络
- Token 认证：`MUMUSPEC_MCP_TOKEN` 环境变量
- 工具权限分级：
  - `read`：search_graph / trace_path / get_spec_context / detect_drift
  - `write`：index_repository / check_compliance（需显式授权）
  - `admin`：contract derive / change state transition（需交互确认）

### 4.3 输入校验规则

| 输入来源 | 校验规则 | 失败行为 |
|---------|---------|---------|
| spec.md YAML frontmatter | Schema 校验（layer/scope/last_updated 类型检查） | 阻断加载，报告格式错误 |
| .mumuspec.yaml | 字段类型 + 枚举值 + 不可变字段校验 | 阻断状态转换 |
| CLI 参数（路径类） | 项目根目录路径白名单 | 拒绝执行，报告路径越界 |
| 契约 YAML | `$ref` 引用解析 + 字段完整性校验 | 阻断契约加载 |
| Enforcement check 表达式 | AST 表达式语法校验 | 阻断规则注册 |

### 4.4 敏感信息检测

- 规范文件和 decisions.md 扫描敏感信息模式：
  - API Key / Token / 密码模式（正则匹配）
  - 私有 IP / 内部域名
  - 数据库连接字符串
- 检测到敏感信息时 WARN 级别告警（不阻断，记录到 audit log）
- 可通过 config.yaml `security.sensitive_info_scan` 配置开关

### 4.5 审计日志

所有关键操作记录到 `.mumuspec/audit.log`：

```jsonl
{"ts":"2026-07-09T10:30:00Z","actor":"user","action":"change.create","change":"add-auth","result":"success"}
{"ts":"2026-07-09T10:35:00Z","actor":"agent:cli","action":"guard.transition","from":"open","to":"design","result":"success"}
{"ts":"2026-07-09T11:00:00Z","actor":"agent:mcp","action":"spec.validate","result":"fail","error":"E-SPEC-001"}
```
```

- **依赖**: 无
- **验证**: 覆盖 MCP/CLI/文件/YAML 四个威胁面；有具体的校验规则和失败行为

---

### Task P0-4：定义统一错误码体系 [S-04]

- **目标文档**: 新建 `docs/reference/error-codes.md`
- **问题**: 仅描述"阻断"但无分类，用户无法快速定位排查
- **具体内容大纲**:

```markdown
# 错误码参考

> 层级: Level 2 参考文档

## 错误码格式

`E-<DOMAIN>-<NUMBER>`

| Domain | 范围 | 说明 |
|--------|------|------|
| SPEC | E-SPEC-001 ~ E-SPEC-099 | 规范层错误 |
| CHANGE | E-CHANGE-001 ~ E-CHANGE-099 | 变更层错误 |
| GUARD | E-GUARD-001 ~ E-GUARD-099 | 校验层错误 |
| GRAPH | E-GRAPH-001 ~ E-GRAPH-099 | 代码图谱错误 |
| CONTRACT | E-CONTRACT-001 ~ E-CONTRACT-099 | 契约层错误 |
| SECURITY | E-SECURITY-001 ~ E-SECURITY-099 | 安全错误 |

## 错误码定义表

### SPEC — 规范层

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-SPEC-001 | SPEC_FORMAT_INVALID | ERROR | spec.md YAML frontmatter 格式错误 | 检查 frontmatter 字段类型，参考 [规范格式](../design/spec-layer.md#4-规范文件格式) |
| E-SPEC-002 | SPEC_LAYER_EXCEED_MAX | ERROR | 规范层级超过 max_layer_depth | 检查目录嵌套深度或调整 config.yaml `specs.max_layer_depth` |
| E-SPEC-003 | SPEC_INHERITANCE_CONFLICT | ERROR | 子层 SHALL NOT 与父层 SHALL 矛盾 | 检查继承链，调整子层约束或父层约束 |
| E-SPEC-004 | SPEC_ENFORCEMENT_MISSING | WARN | SHALL/SHALL NOT 无对应 Enforcement | 为该约束补充 Enforcement 检查规则 |
| E-SPEC-005 | SPEC_DRIFT_DETECTED | ERROR | spec.md 声明的 Requirement 在代码中无实现 | 实现该 Requirement 或更新 spec.md |
| E-SPEC-006 | SPEC_DESIGN_DOC_MISSING | ERROR | 有 spec.md 但无 design.md | 创建 design.md 文件 |
| E-SPEC-007 | SPEC_INDEX_OUTDATED | WARN | index.yaml 与实际目录结构不一致 | 运行 `mumuspec spec index --update` |

### CHANGE — 变更层

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-CHANGE-001 | CHANGE_ALREADY_ACTIVE | ERROR | 已有活跃变更，无法创建新变更 | 先完成或 Discard 当前变更 |
| E-CHANGE-002 | CHANGE_ROLLBACK_LIMIT | ERROR | rollback_count 达到上限（默认 3） | 选择 accept-deviations 或 Discard 变更；参考 [错误恢复路径](#错误恢复决策树) |
| E-CHANGE-003 | CHANGE_REBUILD_LIMIT | ERROR | rebuild_count 达到上限（默认 5） | 强制升级为 verify_to_design_rollback |
| E-CHANGE-004 | CHANGE_TEST_CASES_LOCKED | ERROR | 尝试修改已锁定的 test-cases/ | 回退到 Design 阶段重新设计 |
| E-CHANGE-005 | CHANGE_WORKTREE_FAIL | ERROR | worktree 创建失败 | 降级为 branch 模式（记录原因到 decisions.md） |
| E-CHANGE-006 | CHANGE_PHASE_INVALID_TRANSITION | ERROR | 非法状态机转换 | 检查当前 phase 和目标 phase，参考 [Phase Guard](phase-guards.md) |
| E-CHANGE-007 | CHANGE_DECISIONS_HASH_MISMATCH | ERROR | decisions.md content_hash 不匹配 | 检查 decisions.md 是否被手动篡改 |

### GUARD — 校验层

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-GUARD-001 | GUARD_ARTIFACT_MISSING | ERROR | Phase Guard 检查发现工件缺失 | 根据守卫报告补充缺失工件 |
| E-GUARD-002 | GUARD_SHALL_VIOLATION | ERROR | SHALL 约束未满足 | 实现 SHALL 要求或调整规范 |
| E-GUARD-003 | GUARD_SHALL_NOT_VIOLATION | ERROR | SHALL NOT 约束被违反 | 移除违规代码或调整规范 |
| E-GUARD-004 | GUARD_TEST_IMMUTABILITY | ERROR | 测试用例或套件 hash 不匹配 | 检查 test-cases/ 或 suite-map.yaml 是否被篡改 |
| E-GUARD-005 | GUARD_HYPERPLAN_NOT_MERGED | ERROR | hyperplan 硬约束未合并到 design.md | 将 hyperplan_result.hard_constraints 合并到 design.md |
| E-GUARD-006 | GUARD_HYPERPLAN_OPEN_QUESTIONS | ERROR | hyperplan 开放问题未解决 | 解决 open_questions 后继续 |
| E-GUARD-007 | GUARD_PRE_COMMIT_TIMEOUT | WARN | Pre-commit 检查超过 5s | 考虑缩小检查范围或优化规则 |

### GRAPH — 代码图谱

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-GRAPH-001 | GRAPH_INDEX_FAIL | ERROR | 代码索引失败 | 检查文件权限和 tree-sitter 语法支持 |
| E-GRAPH-002 | GRAPH_DRIFT | WARN | 图谱节点与实际代码不一致 | 运行 `mumuspec graph index --rebuild` |
| E-GRAPH-003 | GRAPH_BROKEN_CHAIN | ERROR | 检测到断裂的调用链 | 检查代码是否删除了被引用的函数/类 |
| E-GRAPH-004 | GRAPH_LANGUAGE_UNSUPPORTED | WARN | 检测到不支持的语言文件 | 安装对应语言的 tree-sitter 语法包 |

### CONTRACT — 契约层

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-CONTRACT-001 | CONTRACT_NOT_REGISTERED | WARN | 契约文件未在 _registry.yaml 注册 | 运行 `mumuspec contract register <name>` |
| E-CONTRACT-002 | CONTRACT_DRIFT_EXTERNAL | ERROR | 代码调用外部服务但无契约声明 | 为该外部服务创建契约文件 |
| E-CONTRACT-003 | CONTRACT_DRIFT_OUTBOUND | ERROR | 代码暴露接口未在 outbound 契约声明 | 为该接口创建 outbound 契约 |
| E-CONTRACT-004 | CONTRACT_BREAKING_CHANGE | ERROR | stable 端点字段被删除或类型改变 | 走 deprecation 流程或新增版本 |
| E-CONTRACT-005 | CONTRACT_DERIVE_FAIL | ERROR | 派生约束注入失败 | 检查 derived_constraints.scope 路径是否存在 |
| E-CONTRACT-006 | CONTRACT_REF_UNRESOLVED | ERROR | $ref 引用无法解析 | 检查 schemas/ 目录引用路径 |

### SECURITY — 安全

| 错误码 | 名称 | 严重级别 | 触发条件 | 用户操作 |
|--------|------|---------|---------|---------|
| E-SECURITY-001 | SECURITY_PATH_TRAVERSAL | ERROR | CLI 参数路径超出项目根目录 | 使用项目内相对路径 |
| E-SECURITY-002 | SECURITY_MCP_UNAUTHORIZED | ERROR | MCP 调用未通过 Token 认证 | 检查 MUMUSPEC_MCP_TOKEN 环境变量 |
| E-SECURITY-003 | SECURITY_SENSITIVE_INFO | WARN | 规范文件中检测到敏感信息模式 | 移除敏感信息或标记为允许 |
| E-SECURITY-004 | SECURITY_YAML_INJECTION | ERROR | YAML 文件包含潜在注入载荷 | 检查 YAML 内容，移除危险标签 |

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

## 错误恢复决策树

见 [Task P0-8: 错误恢复路径](#task-p0-8错误恢复路径-s-08)
```

- **依赖**: 无
- **验证**: 覆盖 6 个 Domain；每个错误码有触发条件和用户操作；格式可被 CLI 解析

---

### Task P0-5：MVP 范围与优先级锁定 [S-06]

- **目标文档**: `docs/appendix/roadmap.md`
- **问题**: 功能点无 P0/P1/P2 标注，Phase 1 验收标准（DoD）不明确
- **修改位置**: 各 Phase 功能清单增加优先级标注；Phase 1 末尾增加 DoD
- **具体修改**:

**Phase 1 功能清单增加优先级**:

```markdown
## Phase 1: 核心规范引擎 (MVP)

**目标**：实现树状规范 + 双向约束 + 基础 CLI

- [P0] 规范文件格式定义（spec.md / design.md / prohibitions.md / index.yaml）
- [P0] 树状规范加载引擎（渐进式披露，含 spec + design）
- [P0] CLI 核心命令（init / context / validate / check）
- [P0] 基础 lint 规则引擎（执行 Enforcement 检查）
- [P1] 目录级设计文档（design.md）格式与加载引擎
- [P1] Rules 文件生成（CLAUDE.md / .cursorrules）
- [P2] 规范继承冲突检测（加载时约束可满足性检查）

### Phase 1 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|---------|
| 项目初始化 | `mumuspec init` 在空项目执行 | 成功生成 .mumuspec/ 目录结构，exit code 0 |
| 规范编写 | 创建 3 层 spec.md + SHALL + SHALL NOT | `mumuspec validate` 通过 |
| 规范加载 | 从 Level 2 目录执行 `mumuspec context` | 仅加载 Level 0-2 规范，token 数 < 全量加载的 40% |
| 约束校验 | `mumuspec check --shall --shall-not` | 正确识别违规并报告 |
| 渐进式披露 | 跨 3 个模块的项目验证 | 各模块独立加载，互不干扰 |
| CLI 可用性 | 新用户（无文档）完成 init→spec→check | < 15min，无需查阅外部文档 |
```

**Phase 2-5 同理增加 P0/P1/P2 标注**（此处省略重复模式）。

- **依赖**: 无
- **验证**: 每个 Phase 有 DoD；P0 项构成最小可用闭环

---

### Task P0-6：项目规划补全 [S-05]

- **目标文档**: `docs/appendix/roadmap.md`
- **问题**: 无工作量估算、无时间线、无资源需求
- **修改位置**: 文件末尾增加 §项目规划
- **具体内容**:

```markdown
## 项目规划

### 资源需求

| 角色 | 数量 | 投入周期 | 职责 |
|------|------|---------|------|
| Tech Lead / 架构师 | 1 | 全周期 | 设计决策、规范审查、Phase 验收 |
| CLI 工具开发 | 1 | Phase 1-4 | Commander.js CLI、lint 引擎、状态机 |
| 图谱引擎开发 | 1 | Phase 3-4 | tree-sitter 集成、SQLite 图谱、MCP Server |
| Skill 集成开发 | 1 | Phase 2 | Skill 文件、Skill Bridge、hyperplan 集成 |
| CI/CD 工程师 | 0.5 | Phase 4 | Pre-commit hook、CI pipeline、文档生成 |
| 技术文档 | 0.5 | 全周期 | 用户指南、API 参考、示例项目 |

### 工作量估算（人天）

| Phase | 功能模块 | 估算（人天） | 依据 |
|-------|---------|-------------|------|
| Phase 1 | 规范格式 + 加载引擎 | 5 | YAML schema + 树遍历 + 渐进式披露逻辑 |
| Phase 1 | CLI 核心命令 | 3 | init/context/validate/check 4 个命令 |
| Phase 1 | lint 规则引擎 | 4 | 规则注册 + AST 检查 + ESLint 适配器 |
| Phase 1 | Rules 文件生成 | 2 | 模板渲染 + 多格式输出 |
| **Phase 1 小计** | | **14 人天** | 1 人 × 3 周（含缓冲） |
| Phase 2 | 状态机 + 回退 | 5 | 五阶段 + 3 种回退 + 快照 |
| Phase 2 | delta spec 合并 | 3 | ADDED/MODIFIED/REMOVED 语义合并 |
| Phase 2 | TDD 引擎 | 4 | test-cases 锁定 + hash + 红绿循环 |
| Phase 2 | Skill 集成 | 5 | Skill 文件 + Bridge + hyperplan + 矩阵 |
| Phase 2 | 决策记录 | 2 | decisions.md + hash 防篡改 |
| **Phase 2 小计** | | **19 人天** | 2 人 × 2 周（含缓冲） |
| Phase 3 | 图谱引擎 | 8 | tree-sitter + SQLite + 增量索引 |
| Phase 3 | 规范-代码绑定 | 4 | GOVERNED_BY/ENFORCED_BY 边 |
| Phase 3 | 契约图谱 | 4 | Contract 节点 + 派生约束注入 |
| **Phase 3 小计** | | **16 人天** | 2 人 × 2 周（含缓冲） |
| Phase 4 | CI/CD 集成 | 4 | pre-commit + CI pipeline + GitHub Actions |
| Phase 4 | 漂移检测 | 4 | 8 种漂移类型 |
| Phase 4 | 文档生成 | 4 | 模板引擎 + 4 种文档类型 |
| **Phase 4 小计** | | **12 人天** | 2 人 × 1.5 周（含缓冲） |
| Phase 5 | npm 包 + 多平台 | 5 | 打包 + 发布 + Claude/Cursor/Codex 适配 |
| Phase 5 | 模板库 + 文档 | 4 | 规范模板 + 契约模板 + 教程 |
| **Phase 5 小计** | | **9 人天** | 1.5 人 × 1.5 周（含缓冲） |
| **总计** | | **70 人天** | 约 3.5 个月（2 人并行） |

### 里程碑时间线

| 里程碑 | 目标日期 | 交付物 | 缓冲 |
|--------|---------|--------|------|
| M1 — MVP 内测 | T+3 周 | Phase 1 完成，3 个项目验证通过 | 20% |
| M2 — 变更管理 | T+5 周 | Phase 2 完成，完整五阶段流程可用 | 20% |
| M3 — 图谱集成 | T+7 周 | Phase 3 完成，10 万文件图谱可用 | 25% |
| M4 — CI/CD 就绪 | T+9 周 | Phase 4 完成，全链路自动化校验 | 20% |
| M5 — 公开发布 | T+11 周 | Phase 5 完成，npm 包发布 | 20% |

> T = 项目启动日。缓冲时间已包含在估算中。
```

- **依赖**: Task P0-5（优先级标注完成后才能估算工作量）
- **验证**: 估算颗粒度到功能模块级；时间线含缓冲；角色覆盖所有 Phase

---

### Task P0-7：发布与回滚方案 [S-07]

- **目标文档**: 新建 `docs/reference/release-strategy.md`
- **问题**: 缺少 npm 包发布策略、版本回滚、灰度测试、配置迁移方案
- **具体内容大纲**:

```markdown
# 发布与回滚策略

> 层级: Level 2 参考文档

## 1. 版本策略

采用 SemVer：`MAJOR.MINOR.PATCH`

| 版本类型 | 触发条件 | 示例 |
|---------|---------|------|
| MAJOR | 不兼容的规范格式变更、配置 schema 变更 | 0.x → 1.0 |
| MINOR | 新功能、新 Phase 交付、向后兼容 | 0.7.0 → 0.8.0 |
| PATCH | Bug 修复、文档修正、性能优化 | 0.8.0 → 0.8.1 |

### Pre-release 标签

| 标签 | 含义 | 目标用户 |
|------|------|---------|
| `-alpha.N` | 内部测试 | 核心团队 |
| `-beta.N` | 邀请测试 | 早期采用者 |
| `-rc.N` | 发布候选 | 公开测试 |
| `-draft` | 设计草案（当前阶段） | 仅文档 |

## 2. 发布流程

```
1. 完成 Phase DoD 验收
2. 更新 CHANGELOG.md
3. 运行 `npm version <type>` 生成 tag
4. `npm publish --tag next`（先发 next 标签）
5. 邀请测试者验证（至少 2 个项目）
6. `npm dist-tag add @mumuspec/cli@<version> latest`（正式发布）
7. 发布 Release Notes（GitHub Releases）
8. 更新文档站点
```

## 3. 灰度策略

| 阶段 | 范围 | 持续时间 | 通过标准 |
|------|------|---------|---------|
| Canary | 核心团队 2-3 项目 | 3 天 | 无 CRITICAL bug |
| Beta | 邀请 5-10 个早期用户 | 1 周 | 无 MAJOR bug，成功率 ≥ 90% |
| RC | 公开 `npm install @mumuspec/cli@rc` | 3 天 | 无新 bug 报告 |
| Stable | `npm install @mumuspec/cli@latest` | — | — |

## 4. 回滚方案

### CLI 回滚

```bash
# 回滚到上一个稳定版本
npm install -g @mumuspec/cli@<previous-stable>

# 或指定版本
npm install -g @mumuspec/cli@0.7.0
```

### 配置迁移回滚

| 场景 | 回滚方法 |
|------|---------|
| config.yaml schema 变更 | MumuSpec 内置 `mumuspec migrate --rollback --from <ver> --to <ver>` |
| .mumuspec.yaml 字段变更 | 向后兼容追加；删除字段前标注 deprecated 一个版本 |
| spec.md 格式变更 | 提供格式转换脚本 `mumuspec spec convert --from <ver>` |

### npm 包撤回

```bash
# 撤回版本（72 小时内）
npm unpublish @mumuspec/cli@<version>

# 或标记为 deprecated
npm deprecate @mumuspec/cli@<version> "Critical bug: <description>. Use <stable-version> instead."
```

## 5. 兼容性保障

| 变更类型 | 兼容性策略 |
|---------|-----------|
| config.yaml 新增字段 | 默认值兼容，旧配置无需修改 |
| config.yaml 删除字段 | 标注 deprecated，保留 1 个版本周期 |
| CLI 命令变更 | 旧命令标注 deprecated，保留 1 个版本周期 |
| spec.md 格式变更 | 提供自动转换脚本 |
| .mumuspec.yaml schema 变更 | `mumuspec migrate` 自动迁移 |
```

- **依赖**: Task P0-6（版本里程碑确定后才能规划灰度）
- **验证**: 覆盖版本策略、发布流程、灰度、回滚、兼容性五个方面

---

### Task P0-8：错误恢复路径 [S-08]

- **目标文档**: `docs/design/change-layer.md`
- **问题**: 回退超限、CI 失败等卡点场景无明确引导
- **修改位置**: §8 预设路径 之后，新增 §9 错误恢复决策树
- **具体内容**:

```markdown
## 9. 错误恢复决策树

### 9.1 rollback_count 超限

```
rollback_count >= rollback_limit (默认 3)
├── 用户选择 accept-deviations
│   ├── verify_result == pass-with-deviations → 走 verify_to_archive_with_deviations
│   └── verify_result != pass → 阻断，提示需先完成 Verify
├── 用户选择 Discard
│   └── 走 discard_change（保存快照，归档到 discarded/）
└── 用户选择手动提升上限
    ├── 记录原因到 decisions.md
    ├── mumuspec config set changes.rollback_limit <N>
    └── 继续回退（不推荐，需 Tech Lead 审批）
```

**CLI 引导输出**:
```
[E-CHANGE-002] 回退次数已达上限 (3/3)

当前变更 "add-user-auth" 已用尽回退次数。请选择：

  [1] 接受偏差归档（推荐）
      → 当前实现通过 SHALL NOT + 测试不可变性检查即可归档
      → 命令: mumuspec change accept-deviations --change add-user-auth

  [2] 废弃变更
      → 保存快照后归档到 discarded/，释放活跃变更槽位
      → 命令: mumuspec change discard --change add-user-auth

  [3] 手动提升上限（需审批）
      → 记录原因到 decisions.md，由 Tech Lead 确认
      → 命令: mumuspec config set changes.rollback_limit 5

详细说明: docs/reference/error-codes.md#E-CHANGE-002
```

### 9.2 rebuild_count 超限

```
rebuild_count >= rebuild_limit (默认 5)
└── 强制升级为 verify_to_design_rollback
    ├── rollback_count + 1
    ├── 若 rollback_count 也超限 → 进入 9.1 决策树
    └── 提示: "实现层面多次修复失败，建议回退到设计阶段重新评估"
```

### 9.3 CI CRITICAL 失败

```
Archive 阶段 CI CRITICAL 失败
├── 自动回退到 Build (archive_ci_fail_rollback)
│   ├── rollback_count + 1
│   └── 若 rollback_count 超限 → 进入 9.1 决策树
└── 用户选择 Discard
    └── 走 discard_change
```

### 9.4 test-cases 锁定后需修改

```
test-cases/ 已锁定 (design_locked == true)
├── 实现中发现测试用例遗漏场景
│   ├── 回退到 Design (build_to_design_rollback)
│   │   ├── rollback_count + 1
│   │   ├── test-cases/ 解锁
│   │   └── 修改后重新锁定
│   └── 若 rollback_count 超限 → 进入 9.1 决策树
└── hyperplan 洞察遗漏
    ├── 回退到 Design
    ├── 重新触发 hyperplan
    └── 新洞察合并后重新设计 test-cases/
```

### 9.5 worktree 创建失败

```
worktree 创建失败
├── 原因: 磁盘空间不足 / 权限问题 / git 异常
├── 降级为 branch 模式
│   ├── 记录降级原因到 decisions.md (Open 阶段)
│   ├── config: changes.default_isolation = branch
│   └── 继续变更流程
└── 若用户拒绝降级
    └── 阻断变更创建，提示修复 worktree 环境
```

### 9.6 hyperplan 执行失败

```
hyperplan 执行中失败
├── subagent 创建失败
│   ├── 重试 1 次
│   ├── 仍失败 → 降级为 4 角色（移除 researcher）
│   └── 4 角色也失败 → 跳过 hyperplan，记录到 decisions.md
├── 单角色执行超时
│   ├── 跳过该角色的 Round 2/3
│   ├── Lead 用已有 Round 1 发现蒸馏
│   └── 标注 hyperplan_result.degraded = true
└── 用户门禁无响应
    ├── 等待用户决策（不超时）
    └── 用户可选择跳过开放问题（记录到 decisions.md，标记为已知风险）
```

### 9.7 Discard 后恢复

```
变更已 Discard
├── 从 snapshots/discard/ 恢复工件
│   ├── mumuspec change restore --from-snapshot <change>
│   └── 创建新变更（不复活旧变更，复用工件）
└── 工件已用于参考
    └── snapshots/discard/ 保留 30 天后清理
```
```

- **依赖**: Task P0-4（错误码体系定义完成后再引用）
- **验证**: 覆盖 7 个常见卡点场景；每个场景有明确的操作引导和 CLI 命令

---

## P1：短期改进（1-2 周内）

### Task P1-1：设计假设声明 [I-01]

- **目标文档**: `docs/overview.md`
- **修改位置**: §1.2 非目标 之后，新增 §1.3 设计假设
- **具体内容**:

```markdown
## 1.3 设计假设

| 编号 | 假设 | 影响范围 | 若假设不成立 |
|------|------|---------|-------------|
| A-01 | 项目使用 Git 进行版本控制 | 全局 | MumuSpec 无法管理变更历史 |
| A-02 | 项目主语言被 tree-sitter 支持 | Code Graph Layer | 图谱功能降级为文件级索引 |
| A-03 | 单一活跃变更约束可被团队接受 | Change Layer | 需引入变更队列机制 |
| A-04 | AI 工具支持 MCP 协议或 Rules 文件 | AI Integration Layer | 需开发平台特定适配器 |
| A-05 | 项目目录结构相对稳定（不频繁大重构） | Spec Layer | 规范层级需频繁重建 |
| A-06 | 测试框架支持红绿 TDD 循环 | Change Layer | TDD 强制约束无法执行 |
| A-07 | CI 环境可运行 Node.js | Guard Layer | 需提供 Docker 镜像 |
| A-08 | 团队接受 SHALL NOT 优先于 SHALL | 全局 | 优先级体系需重新设计 |
```

- **依赖**: 无

---

### Task P1-2：边界条件补充 [I-02]

- **目标文档**: `docs/design/spec-layer.md` + `docs/design/change-layer.md`
- **修改位置**: spec-layer.md §5 继承规则 之后；change-layer.md §1 状态机特性 之后
- **具体内容**:

```markdown
## 边界条件

### 并发操作

| 场景 | 处理策略 |
|------|---------|
| 多人同时编辑同一层 spec.md | 单一活跃变更约束自然序列化；若 Git 合并冲突，CI 阻断并报告冲突 |
| AI 与用户同时操作 .mumuspec.yaml | 文件级锁（`.mumuspec/.lock`），AI 操作前检查锁状态 |
| 并行 CI 触发 | 仅第一个 CI 运行全量检查，后续 CI 检查锁文件并跳过或排队 |

### 超深目录

| 目录深度 | 处理策略 |
|---------|---------|
| ≤ max_layer_depth (默认 5) | 正常加载 |
| > max_layer_depth | 深层目录共享父层规范，不创建独立 .mumuspec/ |
| 超深目录告警 | `mumuspec validate` 报告 WARN: "目录深度 X 超过 max_layer_depth" |

### 空项目

| 场景 | 处理策略 |
|------|---------|
| `mumuspec init` 在空目录执行 | 创建最小 .mumuspec/ 结构（spec.md + design.md + config.yaml） |
| 无代码文件的项目 | 图谱功能跳过，规范校验仅检查格式 |
| 无 src/ 目录的项目 | 根层规范直接管理，不创建子层 |
```

- **依赖**: 无

---

### Task P1-3：外部依赖版本约束 [I-03]

- **目标文档**: `docs/appendix/comparison.md` §技术选型建议
- **修改位置**: 技术选型建议表格增加版本约束列
- **具体内容**: 为每个技术选型增加版本范围、封装边界、降级策略

- **依赖**: 无

---

### Task P1-4：术语表建立 [I-04]

- **目标文档**: 新建 `docs/reference/glossary.md`
- **具体内容**: 统一中英文术语映射，包含 SHALL / SHALL NOT / Enforcement / 漂移 / 渐进式披露等核心术语

- **依赖**: 无

---

### Task P1-5：性能指标矩阵 [I-06]

- **目标文档**: `docs/design/guard-layer.md` §2 校验层次
- **修改位置**: 各层次耗时指标增加按库规模拆分
- **具体内容**:

```markdown
### 性能指标矩阵

| 操作 | 1k 文件 | 10k 文件 | 100k 文件 | 约束 |
|------|---------|---------|---------|---------|
| Pre-commit SHALL NOT 检查 | < 1s | < 3s | < 5s | 增量检查（仅 staged 文件） |
| CI 全量 SHALL + SHALL NOT | < 30s | < 2min | < 5min | 并行检查 + 缓存 |
| Phase Guard | < 5s | < 15s | < 30s | 仅检查工件完整性 |
| 图谱索引（全量） | < 10s | < 1min | < 5min | 增量索引优先 |
| 图谱索引（增量） | < 1s | < 3s | < 10s | 仅解析变更文件 |
| 漂移检测（全量） | < 20s | < 1min | < 3min | 规范 + 图谱 + 契约 |
| 规范加载（渐进式披露） | < 100ms | < 300ms | < 500ms | 仅加载 3 层 |
```

- **依赖**: 无

---

### Task P1-6：新手友好设计 [I-10]

- **目标文档**: `docs/reference/cli-commands.md`（增加新命令）+ `docs/design/ai-integration.md` §6 CLI 命令
- **具体内容**: 增加 `mumuspec status` / `mumuspec doctor` / `mumuspec wizard` 命令设计

```markdown
### mumuspec status — 变更状态概览

显示当前活跃变更的状态摘要：
- 当前 Phase 和 Workflow
- build_layers 进度
- test-cases 锁定状态
- rollback/rebuild 计数
- 下一步操作建议

### mumuspec doctor — 环境诊断

检查 MumuSpec 运行环境：
- Node.js 版本
- Git 仓库状态
- .mumuspec/ 目录完整性
- config.yaml 校验
- 图谱索引新鲜度
- Skill 生态可用性
- 依赖工具（tree-sitter 等）

### mumuspec wizard — 交互式引导

为新用户提供交互式引导：
- 初始化项目规范
- 创建第一个变更
- 选择 Workflow（hotfix/tweak/full）
- 逐步引导完成五阶段流程
```

- **依赖**: Task P0-4（错误码体系，doctor 命令需要引用）

---

### Task P1-7：错误提示可操作性增强 [I-09]

- **目标文档**: `docs/reference/error-codes.md`（Task P0-4 创建的文档）
- **修改位置**: 每个错误码的"用户操作"列
- **具体内容**: 为每个错误码补充：原因说明、修复步骤列表、相关文档链接、`--force` 选项说明

- **依赖**: Task P0-4

---

### Task P1-8：典型用户画像 [I-08]

- **目标文档**: `docs/overview.md`
- **修改位置**: §1 问题陈述 之前，新增 §0 目标用户
- **具体内容**:

```markdown
## 0. 目标用户

### 画像 1: 独立开发者 Alex

- **角色**: 全栈开发者，独立维护 1-2 个中型项目
- **场景**: 使用 AI 编程工具（Claude Code / Cursor）加速开发
- **痛点**: AI 不了解项目规范，经常生成不符合架构约束的代码
- **目标**: 用 MumuSpec 约束 AI 行为，减少手动审查
- **使用路径**: `mumuspec init` → 编写规范 → AI 加载规范 → 自动校验

### 画像 2: Tech Lead Jordan

- **角色**: 技术负责人，管理 5-10 人团队
- **场景**: 团队使用多种 AI 工具，代码质量参差不齐
- **痛点**: 架构规范写在 wiki 中无人遵守，AI 修改代码时无感知
- **目标**: 用 MumuSpec 统一规范管理 + CI 自动校验
- **使用路径**: 规范分层设计 → CI 集成 → Phase Guard 强制 → 决策审计

### 画像 3: AI 工具贡献者 Sam

- **角色**: AI 编程工具生态开发者
- **场景**: 开发新的 AI Skill 或 MCP 工具
- **痛点**: 缺乏标准化的规范接口
- **目标**: 通过 MumuSpec 的 Skill Bridge 和 MCP Server 集成
- **使用路径**: Skill 适配 → MCP 工具开发 → 规范-代码绑定
```

- **依赖**: 无

---

## P2：长期优化（后续迭代）

### Task P2-1：可观测性增强 [I-05]

- **目标文档**: `docs/design/guard-layer.md`
- **具体内容**: 增加结构化日志格式（JSON）、CLI verbosity 控制（`--verbose` / `--quiet` / `--json`）、关键操作 audit log、CI 告警输出格式

---

### Task P2-2：技术风险验证 Sprint [I-07]

- **目标文档**: `docs/appendix/open-questions.md`
- **具体内容**: 为 Top 3 风险（多语言 AST、10 万文件图谱性能、规范冲突检测）补充：备选方案对比表、决策截止时间、验证 Sprint 安排

---

### Task P2-3：运营成本评估 [I-11]

- **目标文档**: `docs/appendix/roadmap.md`
- **具体内容**: 增加 §运营成本——CI runner 资源消耗、issue 处理人力、文档更新频率、社区维护成本

---

### Task P2-4：Phase 内部依赖关系与并行优化 [I-12, I-13]

- **目标文档**: `docs/appendix/roadmap.md`
- **具体内容**: 为每个 Phase 内部任务标注依赖关系图，识别可并行任务；为每个 Phase 增加 DoD（Definition of Done）

---

## 任务依赖关系

```
P0-1 (量化目标)          ─┐
P0-2 (非目标)            ─┤
P0-3 (安全设计)          ─┤
P0-4 (错误码体系)        ─┼─→ P0-8 (错误恢复路径)
P0-5 (MVP 优先级)        ─┼─→ P0-6 (项目规划) ─→ P0-7 (发布回滚)
                         ─┘

P1-1 (设计假设)          ── 独立
P1-2 (边界条件)          ── 独立
P1-3 (依赖版本约束)      ── 独立
P1-4 (术语表)            ── 独立
P1-5 (性能指标矩阵)      ── 独立
P1-6 (新手友好)          ── 依赖 P0-4
P1-7 (错误提示增强)      ── 依赖 P0-4
P1-8 (用户画像)          ── 独立

P2-1 ~ P2-4             ── 依赖 P0 全部完成
```

### 并行执行建议

| 批次 | 可并行任务 | 前置条件 |
|------|-----------|---------|
| 批次 1 | P0-1, P0-2, P0-3, P0-4, P0-5, P1-1, P1-2, P1-3, P1-4, P1-5, P1-8 | 无 |
| 批次 2 | P0-6, P0-8, P1-6, P1-7 | 批次 1 中的 P0-4, P0-5 完成 |
| 批次 3 | P0-7 | 批次 2 中的 P0-6 完成 |
| 批次 4 | P2-1, P2-2, P2-3, P2-4 | P0 全部完成 |

---

## 执行检查清单

### P0 完成标准

- [x] overview.md 包含量化目标、非目标、设计假设、用户画像
- [x] guard-layer.md 包含安全校验章节
- [x] error-codes.md 创建完成，覆盖 6 个 Domain
- [x] roadmap.md 包含 P0/P1/P2 标注、DoD、工作量估算、时间线
- [x] release-strategy.md 创建完成
- [x] change-layer.md 包含错误恢复决策树
- [x] 所有严重问题（S-01 ~ S-08）已修复

### P1 完成标准

- [x] overview.md 包含设计假设、用户画像
- [x] spec-layer.md + change-layer.md 包含边界条件
- [x] comparison.md 包含版本约束
- [x] glossary.md 创建完成
- [x] guard-layer.md 包含性能指标矩阵
- [x] cli-commands.md 包含 status/doctor/wizard 命令
- [x] error-codes.md 每个错误码有修复步骤
- [x] 所有改进建议（I-01 ~ I-10, I-12, I-13）已处理

### P2 完成标准

- [x] guard-layer.md 包含结构化日志设计
- [x] open-questions.md Top 3 风险有验证计划
- [x] roadmap.md 包含运营成本评估
- [x] roadmap.md 包含 Phase 内部依赖图和 DoD

---

## 预期效果

| 指标 | 当前 | 改进后（P0 完成） | 改进后（P0+P1 完成） |
|------|------|------------------|---------------------|
| 完整性与一致性 | 19/25 | 23/25 | 24/25 |
| 技术可行性 | 20/25 | 23/25 | 24/25 |
| 用户体验 | 19/25 | 22/25 | 24/25 |
| 成本与可行性 | 20/25 | 24/25 | 24/25 |
| **总计** | **78/100** | **92/100** | **96/100** |
| **等级** | B | A | A |

---

> **导航**: [← 审查报告](review-report.md) | [返回概览](overview.md)
