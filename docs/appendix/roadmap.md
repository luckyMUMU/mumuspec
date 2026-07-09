# 实施路线图

> 层级: Level 3 附录

---

## Phase 1: 核心规范引擎 (MVP)

**目标**：实现树状规范 + 双向约束 + 基础 CLI

- [ ] **[P0]** 规范文件格式定义（spec.md / design.md / prohibitions.md / index.yaml）
- [ ] **[P0]** Ponytail 约束注入引擎（自动注入根层 spec.md）
- [ ] **[P0]** 树状规范加载引擎（渐进式披露，含 spec + design）
- [ ] **[P0]** CLI 核心命令（init / context / validate / check）
- [ ] **[P0]** 基础 lint 规则引擎（执行 Enforcement 检查）
- [ ] **[P1]** Ponytail lint 规则（YAGNI 检查、依赖检查、样板代码检测）
- [ ] **[P1]** `ponytail:` 注释标记解析器
- [ ] **[P1]** 目录级设计文档（design.md）格式与加载引擎
- [ ] **[P1]** Rules 文件生成（CLAUDE.md / .cursorrules）
- [ ] **[P2]** 规范继承冲突检测（加载时约束可满足性检查）

### Phase 1 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 项目初始化 | `mumuspec init` 在空项目执行 | 成功生成 .mumuspec/ 目录结构，exit code 0 |
| 规范编写 | 创建 3 层 spec.md + SHALL + SHALL NOT | `mumuspec validate` 通过 |
| 规范加载 | 从 Level 2 目录执行 `mumuspec context` | 仅加载 Level 0-2 规范，token 数 < 全量加载的 40% |
| 约束校验 | `mumuspec check --shall --shall-not` | 正确识别违规并报告 |
| 渐进式披露 | 跨 3 个模块的项目验证 | 各模块独立加载，互不干扰 |
| CLI 可用性 | 新用户（无文档）完成 init→spec→check | < 15min，无需查阅外部文档 |

## Phase 2: 变更生命周期

**目标**：实现完整的变更管理流水线

- [ ] **[P0]** 变更状态机（.mumuspec.yaml）
- [ ] **[P0]** 五阶段流程（open → design → build → verify → archive）
- [ ] **[P0]** 状态机回退机制（build→design, verify→design, verify→build）
- [ ] **[P0]** 回退快照保存与恢复
- [ ] **[P0]** Phase guard 脚本（正向 + 反向回退守卫）
- [ ] **[P0]** delta spec 合并引擎
- [ ] **[P0]** 测试用例规格引擎（test-cases/ 定义、锁定、hash 校验）
- [ ] **[P0]** 红绿 TDD 循环强制执行（tdd_mode 固定、Phase Guard 校验）
- [ ] **[P0]** 决策记录引擎（decisions.md 追加式日志 + hash 防篡改）
- [ ] **[P0]** 认知框架引擎（cognitive-map.yaml 验证、收敛逻辑、Q4 扫描自动化）
- [ ] **[P1]** 认知框架 CLI 命令（cognitive-map init/status/validate/converge）
- [ ] **[P1]** 认知框架 MCP 工具（get_cognitive_map/check_convergence/update_cognitive_map）
- [ ] **[P1]** hotfix/tweak 预设路径
- [ ] **[P1]** Archive 阶段 git 提交 + MR/PR 创建 + 合并
- [ ] **[P1]** 测试套件映射与锁定（suite-map.yaml、套件 hash 校验）
- [ ] **[P1]** 设计文档同步机制（Design 阶段 delta-design 合并到 design.md）
- [ ] **[P1]** Skill 文件定义（阶段编排器）
- [ ] **[P1]** 外部 Skill 生态兼容层（Skill Bridge）
- [ ] **[P1]** 阶段-Skill 映射与分发协议
- [ ] **[P2]** Skill 优先级与冲突解决机制
- [ ] **[P2]** Superpowers/Agent Skills 集成
- [ ] **[P2]** Hyperplan 对抗式规划 Skill

### Phase 2 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 变更创建 | `mumuspec new test-change` | 成功创建工件结构 + worktree |
| 状态机流转 | Open→Design→Build→Verify→Archive | 每阶段 Phase Guard 通过 |
| 回退恢复 | Build→Design 回退 | 快照正确恢复，rollback_count 递增 |
| TDD 强制 | 跳过红绿 TDD 尝试提交 | Phase Guard 阻断 |
| 决策记录 | 查看 decisions.md | 各阶段决策已追加，hash 匹配 |
| delta spec 合并 | Archive 后检查主规范 | ADDED/MODIFIED/REMOVED 正确合并 |

## Phase 3: 知识层集成

**目标**：实现代码图谱 + 规范-代码双向绑定 + 契约图谱 + LLM-Wiki + PageIndex

- [ ] **[P0]** 代码图谱构建引擎（AST 解析 → 图谱）
- [ ] **[P0]** 规范-代码绑定（GOVERNED_BY / ENFORCED_BY 边）
- [ ] **[P0]** MCP Server 实现
- [ ] **[P0]** 知识页面格式定义 + PageIndex 引擎
- [ ] **[P0]** 代码图谱扩展（KnowledgePage/Decision/Risk 节点 + 知识边类型）
- [ ] **[P1]** 影响分析工具（detect_changes）
- [ ] **[P1]** 调用链追踪（trace_path + 规范标注）
- [ ] **[P1]** 契约图谱集成（Contract 节点 + CONSUMES/EXPOSES/CONTRACT_DERIVES 边）
- [ ] **[P1]** 契约约束派生引擎（契约 → spec.md 自动注入）
- [ ] **[P1]** 知识 MCP 工具（get_knowledge_context / search_knowledge / get_code_knowledge）
- [ ] **[P2]** 契约漂移检测引擎
- [ ] **[P2]** 契约注册表管理（_registry.yaml 自动维护）

### Phase 3 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 图谱构建 | `mumuspec index` 在 1万文件项目 | 构建成功，耗时 < 1min |
| 规范绑定 | spec.md 中的 SHALL 有对应 GOVERNED_BY 边 | 绑定率 ≥ 90% |
| MCP 查询 | AI 工具通过 MCP 调用 search_graph | 返回正确结果，延迟 < 500ms |
| 影响分析 | `mumuspec impact <name>` | 正确识别受影响文件和函数 |
| 契约派生 | `mumuspec contract derive <name>` | 约束正确注入 spec.md |

## Phase 4: CI/CD 与自动化

**目标**：实现全链路自动化校验

- [ ] **[P0]** Pre-commit hook（SHALL NOT 快速检查）
- [ ] **[P0]** CI/CD pipeline 集成（全量校验）
- [ ] **[P0]** 漂移检测引擎（规范漂移 + 图谱漂移 + 设计文档漂移 + 契约漂移 + 知识漂移 + Ponytail 约束漂移）
- [ ] **[P0]** Archive 阶段知识提取子流程（D）
- [ ] **[P1]** 图谱自动更新（git hooks）
- [ ] **[P1]** 契约漂移检测集成到 CI/CD（外部服务漂移 + 对外接口漂移 + 向后兼容性检查）
- [ ] **[P1]** 契约派生约束 CI 校验
- [ ] **[P1]** 知识新鲜度管理 + 知识漂移检测 CI 集成
- [ ] **[P1]** Ponytail 漂移检测集成到 CI/CD
- [ ] **[P1]** 文档生成引擎（从 spec + design + contract 生成技术/业务/集成/依赖文档）
- [ ] **[P1]** `mumuspec knowledge` CLI 命令
- [ ] **[P2]** 文档模板系统（内置模板 + 自定义模板）
- [ ] **[P2]** 文档一致性校验（文档漂移检测 + 自动重新生成）
- [ ] **[P2]** 多格式输出（Markdown / HTML / PDF）
- [ ] **[P2]** 契约文档生成（集成指南 + 外部依赖文档）
- [ ] **[P2]** 仪表盘可视化

### Phase 4 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| Pre-commit | `git commit` 触发 hook | SHALL NOT 违规被阻断，耗时 < 5s |
| CI 全量 | 推送代码触发 CI | 全量校验通过，耗时 < 5min（10万文件） |
| 漂移检测 | `mumuspec drift` | 规范/图谱/契约漂移全部检出 |
| 文档生成 | `mumuspec doc generate` | 生成技术/业务/集成/依赖文档 |
| 文档一致性 | `mumuspec doc check` | 文档与规范一致 |

## Phase 5: 生态与分发

**目标**：跨平台分发与社区生态

- [ ] **[P0]** npm 包发布（@mumuspec/cli + @mumuspec/mcp-server）
- [ ] **[P1]** 多平台 Skill 支持（Claude Code / Cursor / Copilot / Codex）
- [ ] **[P1]** 规范模板库（常见技术栈的预置规范）
- [ ] **[P1]** 契约模板库（RPC/REST/MQ 契约模板）
- [ ] **[P2]** Ponytail 约束模板库（常见技术栈的预置 Ponytail 约束）
- [ ] **[P2]** Skill 生态插件市场（社区贡献的 Skill 适配器）
- [ ] **[P2]** 文档模板市场（社区贡献的文档生成模板）
- [ ] **[P2]** 评估系统（Rubric / Pass@k）
- [ ] **[P2]** 文档与教程

### Phase 5 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| npm 发布 | `npm install -g @mumuspec/cli` | 安装成功，`mumuspec --version` 正常输出 |
| 多平台 Skill | Claude Code / Cursor 各加载 Skill | Skill 正常执行，无报错 |
| 模板库 | `mumuspec init --template <name>` | 正确生成对应技术栈规范 |
| 文档教程 | 新用户按教程完成全流程 | < 30min 完成首个变更 |

---

## 版本里程碑对应关系

| 版本 | 对应 Phase | 核心特性 |
|------|-----------|---------|
| 0.2.0 | Phase 1 | 工作流规则（worktree 隔离、单一活跃变更、自顶向下/自下向上） |
| 0.3.0 | Phase 2 | 状态机管理 + 回退机制 + Archive git 合并 |
| 0.4.0 | Phase 2 | 外部 Skill 生态兼容层 |
| 0.5.0 | Phase 4 | 目录级设计文档 + 文档生成引擎 |
| 0.6.0 | Phase 2 | 红绿 TDD + 测试不可变性约束 |
| 0.7.0 | Phase 2 | Hyperplan 对抗式规划 + Skill 矩阵 + 决策记录 |
| 0.8.0 | Phase 2-3 | Contract Layer 契约层（外部 + 对外契约 + 漂移检测）；认知框架（乔哈里窗变体 Q1-Q4）集成到 Design 阶段 |
| 0.9.0 | Phase 3-4 | Knowledge Layer 知识层（LLM-Wiki + PageIndex + 代码图谱集成）；全量审查修复 |
| 0.10.0 | Phase 1-3 | 合并 Code Graph Layer 到 Knowledge Layer；引入 Ponytail 基础编码约束 |

---

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

### Phase 内部依赖关系

#### Phase 1 依赖图

```
规范文件格式定义 ──→ 树状规范加载引擎 ──→ CLI 核心命令
                                              │
                          基础 lint 规则引擎 ←─┘
                                              │
                          Rules 文件生成  ←───┘
```
- **可并行**: 规范文件格式定义与 lint 规则引擎的规则设计可并行
- **关键路径**: 规范文件格式 → 加载引擎 → CLI

#### Phase 2 依赖图

```
状态机 ──→ 五阶段流程 ──→ Phase guard ──→ delta spec 合并
    │                                      │
    └──→ 回退快照                          │
                                         ↓
TDD 引擎 ←── test-cases 锁定 ←── 决策记录引擎
```
- **可并行**: Skill 集成与 TDD 引擎可并行开发
- **关键路径**: 状态机 → 五阶段 → Phase guard → delta spec 合并

#### Phase 3 依赖图

```
图谱构建引擎 ──→ 规范-代码绑定 ──→ MCP Server
                    │
                    └──→ 契约图谱 ──→ 契约派生引擎
                    │
                    └──→ 知识页面引擎 ──→ PageIndex ──→ 知识提取子流程
```
- **可并行**: 影响分析/调用链追踪与契约图谱可并行
- **关键路径**: 图谱构建 → 规范绑定 → MCP Server

### 运营成本评估

| 成本类别 | 项目 | 预估 |
|---------|------|------|
| **CI runner 资源** | GitHub Actions / 自建 runner | 每月 ~$50（10万文件项目，每日 10 次构建） |
| **issue 处理** | 社区 issue + PR review | 0.5 人/月（M5 后） |
| **文档更新** | 用户指南 + API 参考 + 示例 | 每个版本 2 人天 |
| **社区维护** | Discord/论坛 + 模板审核 | 0.3 人/月 |
| **依赖升级** | tree-sitter / SQLite / Commander.js | 每季度 1 人天 |
| **安全审计** | 定期安全扫描 + 漏洞响应 | 每季度 0.5 人天 |

---

> **导航**: [← 对比](comparison.md) | [开放问题 →](open-questions.md) | [返回概览](../overview.md)
