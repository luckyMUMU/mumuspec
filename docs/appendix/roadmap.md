# 实施路线图

> 层级: Level 3 附录

> **进度数据来源**: 本文档的 Phase 进度百分比引用自 [STATUS.md](../STATUS.md),为唯一权威来源。最后更新: 2026-07-29。

---

## Phase 1 MVP:核心规范驱动闭环

**目标**: 验证规范驱动开发的核心价值,30 分钟内完成首个变更
**进度**: 0%

任务:
- [ ] Spec Layer 基础: 树状规范 + SHALL/SHALL NOT + 渐进式披露(不含 Ponytail)
- [ ] Change Layer 基础: 五阶段状态机 + 基础回退(不含 TDD 强制、不含认知框架)
- [ ] Guard Layer P0: Pre-commit SHALL NOT 检查 + spec_drift + shall_not_violation
- [ ] AI Integration 基础: Rules 文件生成(CLAUDE.md/.cursorrules/AGENTS.md)
- [ ] AI 工具适配层: AIToolAdapter 接口 + ClaudeCodeAdapter + CursorAdapter
- [ ] CLI 基础: init/spec/change/status/validate 命令

### Phase 1 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 项目初始化 | `mumuspec init` 在空项目执行 | 成功生成 .mumuspec/ 目录结构，exit code 0 |
| 规范编写 | 创建 3 层 spec.md + SHALL + SHALL NOT | `mumuspec validate` 通过 |
| 规范加载 | 从 Level 2 目录执行 `mumuspec context` | 仅加载 Level 0-2 规范，token 数 < 全量加载的 40% |
| 约束校验 | `mumuspec check --shall --shall-not` | 正确识别违规并报告 |
| 渐进式披露 | 跨 3 个模块的项目验证 | 各模块独立加载，互不干扰 |
| CLI 可用性 | 新用户（无文档）完成 init→spec→check | < 15min，无需查阅外部文档 |

## Phase 2:工作流增强

**目标**: 完善工作流规则与编码约束
**进度**: 0%

任务:
- [ ] Ponytail 编码约束: 7 级阶梯 + Enforcement 注入
- [ ] TDD 强制(可配置): 红绿循环 + 测试不可变性
- [ ] 认知框架 Q1-Q4(可选,默认关闭): 乔哈里窗变体
- [ ] 状态机回退增强: 3 种回退路径
- [ ] 软假设降级方案: A-03/A-06/A-08 降级实现
- [ ] Guard Layer P1: graph_drift + test_immutability_drift + ponytail_drift
- [ ] workflow.* 配置项实现

### Phase 2 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 变更创建 | `mumuspec new test-change` | 成功创建工件结构 + worktree |
| 状态机流转 | Open→Design→Build→Verify→Archive | 每阶段 Phase Guard 通过 |
| 回退恢复 | Build→Design 回退 | 快照正确恢复，rollback_count 递增 |
| TDD 强制 | 跳过红绿 TDD 尝试提交 | Phase Guard 阻断 |
| 决策记录 | 查看 decisions.md | 各阶段决策已追加，hash 匹配 |
| delta spec 合并 | Archive 后检查主规范 | ADDED/MODIFIED/REMOVED 正确合并 |

## Phase 3:知识层与契约层

**目标**: 知识回流闭环 + 契约管理
**进度**: 0%

任务:
- [ ] Knowledge Layer 代码图谱: 可插拔后端(CBM/CGC/内置 adapter) — 6-8 人天(原 16 人天,改为可插拔后端架构后降低)
- [ ] 知识价值评估: 4 项指标(引用次数/冲突检出率/新鲜度验证通过率/用户确认率) + deprecated 标记
- [ ] LLM-Wiki 与 PageIndex
- [ ] Contract Layer: 外部契约 + 对外契约 + 派生约束 + 6 类漂移
- [ ] Skill Bridge: 兼容 Superpowers/OpenSpec/Comet 生态
- [ ] Guard Layer P2: contract_drift + knowledge_drift + design_doc_drift

### Phase 3 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| 图谱构建 | `mumuspec index` 在 1万文件项目 | 构建成功，耗时 < 1min |
| 规范绑定 | spec.md 中的 SHALL 有对应 GOVERNED_BY 边 | 绑定率 ≥ 90% |
| MCP 查询 | AI 工具通过 MCP 调用 search_graph | 返回正确结果，延迟 < 500ms |
| 影响分析 | `mumuspec impact <name>` | 正确识别受影响文件和函数 |
| 契约派生 | `mumuspec contract derive <name>` | 约束正确注入 spec.md |

## Phase 4:CI/CD 与全漂移

**目标**: 团队协作与持续集成
**进度**: 0%

任务:
- [ ] CI/CD 集成: GitHub Actions/GitLab CI 模板
- [ ] 全漂移检测: 12 种漂移完整实现
- [ ] 知识提取: D1-D8 自动提取流程
- [ ] 文档生成: 自动生成 API 文档与变更日志

### Phase 4 验收标准 (DoD)

| 验收项 | 验证方法 | 通过标准 |
|--------|---------|----------|
| Pre-commit | `git commit` 触发 hook | SHALL NOT 违规被阻断，耗时 < 5s |
| CI 全量 | 推送代码触发 CI | 全量校验通过，耗时 < 5min（10万文件） |
| 漂移检测 | `mumuspec drift` | 规范/图谱/契约漂移全部检出 |
| 文档生成 | `mumuspec doc generate` | 生成技术/业务/集成/依赖文档 |
| 文档一致性 | `mumuspec doc check` | 文档与规范一致 |

## Phase 5:Skill 编排器与生态

**目标**: 自建 Skill 生态与对抗式规划
**进度**: 0%

任务:
- [ ] 自建 Skill 编排器: 7 阶段 Skill 文件
- [ ] Hyperplan 对抗式规划
- [ ] 生态分发: npm/brew/cargo 包发布

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
| 0.11.0 | Phase 1 MVP | 设计优化版本（核心规范驱动闭环） |
| 0.12.0 | Phase 2 | 工作流增强（Ponytail + TDD + 认知框架） |
| 0.13.0 | Phase 3 | 知识层与契约层 |
| 0.14.0 | Phase 4 | CI/CD 与全漂移 |
| 1.0.0 | Phase 5 | 正式发布（Skill 编排器与生态） |

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

## 工作量估算

**总工作量**: 80-85 人天(基于 [implementation-plan.md](../implementation-plan.md) 详细估算)

> 注:本估算以 implementation-plan.md 为基准来源。其他文档提及工作量时 SHALL 引用此基准。

### 各 Phase 工作量分布

| Phase | 工作量 | 说明 |
|-------|-------|------|
| Phase 1 MVP | 20-25 人天 | 核心规范驱动闭环 |
| Phase 2 | 15-18 人天 | 工作流增强 |
| Phase 3 | 20-22 人天 | 知识层与契约层(图谱降为 6-8 人天) |
| Phase 4 | 12-13 人天 | CI/CD 与全漂移 |
| Phase 5 | 13-15 人天 | Skill 编排器与生态 |
| **总计** | **80-93 人天** | 含缓冲后取 80-85 人天为基准 |

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
