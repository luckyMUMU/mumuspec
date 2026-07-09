# 实施路线图

> 层级: Level 3 附录

---

## Phase 1: 核心规范引擎 (MVP)

**目标**：实现树状规范 + 双向约束 + 基础 CLI

- [ ] 规范文件格式定义（spec.md / design.md / prohibitions.md / index.yaml）
- [ ] 目录级设计文档（design.md）格式与加载引擎
- [ ] 树状规范加载引擎（渐进式披露，含 spec + design）
- [ ] CLI 核心命令（init / context / validate / check）
- [ ] 基础 lint 规则引擎（执行 Enforcement 检查）
- [ ] Rules 文件生成（CLAUDE.md / .cursorrules）

## Phase 2: 变更生命周期

**目标**：实现完整的变更管理流水线

- [ ] 变更状态机（.mumuspec.yaml）
- [ ] 五阶段流程（open → design → build → verify → archive）
- [ ] 状态机回退机制（build→design, verify→design, verify→build）
- [ ] 回退快照保存与恢复
- [ ] Archive 阶段 git 提交 + MR/PR 创建 + 合并
- [ ] Phase guard 脚本（正向 + 反向回退守卫）
- [ ] delta spec 合并引擎
- [ ] hotfix/tweak 预设路径
- [ ] 测试用例规格引擎（test-cases/ 定义、锁定、hash 校验）
- [ ] 测试套件映射与锁定（suite-map.yaml、套件 hash 校验）
- [ ] 红绿 TDD 循环强制执行（tdd_mode 固定、Phase Guard 校验）
- [ ] 设计文档同步机制（Design 阶段 delta-design 合并到 design.md）
- [ ] Skill 文件定义（阶段编排器）
- [ ] 外部 Skill 生态兼容层（Skill Bridge）
- [ ] 阶段-Skill 映射与分发协议
- [ ] Skill 优先级与冲突解决机制
- [ ] Superpowers/Agent Skills 集成
- [ ] Hyperplan 对抗式规划 Skill
- [ ] 决策记录引擎（decisions.md 追加式日志 + hash 防篡改）

## Phase 3: 代码图谱集成

**目标**：实现知识图谱 + 规范-代码双向绑定 + 契约图谱

- [ ] 代码图谱构建引擎（AST 解析 → 图谱）
- [ ] 规范-代码绑定（GOVERNED_BY / ENFORCED_BY 边）
- [ ] 影响分析工具（detect_changes）
- [ ] 调用链追踪（trace_path + 规范标注）
- [ ] MCP Server 实现
- [ ] 契约图谱集成（Contract 节点 + CONSUMES/EXPOSES/CONTRACT_DERIVES 边）
- [ ] 契约约束派生引擎（契约 → spec.md 自动注入）
- [ ] 契约漂移检测引擎
- [ ] 契约注册表管理（_registry.yaml 自动维护）

## Phase 4: CI/CD 与自动化

**目标**：实现全链路自动化校验

- [ ] Pre-commit hook（SHALL NOT 快速检查）
- [ ] CI/CD pipeline 集成（全量校验）
- [ ] 漂移检测引擎（规范漂移 + 图谱漂移 + 设计文档漂移 + 契约漂移）
- [ ] 图谱自动更新（git hooks）
- [ ] 契约漂移检测集成到 CI/CD（外部服务漂移 + 对外接口漂移 + 向后兼容性检查）
- [ ] 契约派生约束 CI 校验
- [ ] 文档生成引擎（从 spec + design + contract 生成技术/业务/集成/依赖文档）
- [ ] 文档模板系统（内置模板 + 自定义模板）
- [ ] 文档一致性校验（文档漂移检测 + 自动重新生成）
- [ ] 多格式输出（Markdown / HTML / PDF）
- [ ] 契约文档生成（集成指南 + 外部依赖文档）
- [ ] 仪表盘可视化

## Phase 5: 生态与分发

**目标**：跨平台分发与社区生态

- [ ] npm 包发布（@mumuspec/cli + @mumuspec/mcp-server）
- [ ] 多平台 Skill 支持（Claude Code / Cursor / Copilot / Codex）
- [ ] Skill 生态插件市场（社区贡献的 Skill 适配器）
- [ ] 规范模板库（常见技术栈的预置规范）
- [ ] 契约模板库（RPC/REST/MQ 契约模板）
- [ ] 文档模板市场（社区贡献的文档生成模板）
- [ ] 评估系统（Rubric / Pass@k）
- [ ] 文档与教程

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
| 0.8.0 | Phase 3 | Contract Layer 契约层（外部 + 对外契约 + 漂移检测） |

---

> **导航**: [← 目录结构](directory-structure.md) | [对比 →](comparison.md) | [开放问题 →](open-questions.md) | [返回概览](../overview.md)
