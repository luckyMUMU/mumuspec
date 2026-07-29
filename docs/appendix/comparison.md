# 与参考项目对比

> 层级: Level 3 附录

MumuSpec vs OpenSpec vs Comet 速查表。三项目关键特性一图速览，详细多项目对比与差距分析见文末深度链接。

---

## 核心差异

| 特性 | MumuSpec | OpenSpec | Comet |
|------|----------|---------|-------|
| **约束方向（规范优先级体系）** | 正向+反向（SHALL+SHALL NOT），每个 SHALL NOT 可执行检查；Ponytail 7 级优先级阶梯 | 仅正向（SHALL） | 仅正向 |
| **规范分布** | 树状分布，按目录结构分层 | 集中存放 `openspec/specs/` | 集中存放 |
| **上下文加载（AI 集成）** | 渐进式披露，按切入层级加载，Token 减少 ≥60% | 全量加载规范 | 全量 + handoff 压缩 |
| **代码索引 / 知识层** | 原生集成代码图谱 + LLM-Wiki + PageIndex，跨变更知识积累 | 无 | CodeGraph（0.3.7+） |
| **规范-代码绑定** | GOVERNED_BY 边 + Enforcement | 无 | 无 |
| **漂移检测** | 自动检测 12 类漂移（规范/图谱/测试/契约/知识/Ponytail） | 无 | 无 |
| **变更状态机** | 状态机 + 图谱验证 + 可回退 | ✓ | ✓（状态机） |
| **阶段回退** | Build/Verify 均可回退 Design，带快照与回退计数 | 无 | verify-fail 可回退 build |
| **预设路径** | hotfix/tweak（增加规范约束） | 无 | hotfix/tweak |
| **工作流规则 - TDD** | 默认红绿 TDD，固定不可关闭 | 无 | 可选 |
| **工作流规则 - 隔离** | 默认 worktree 物理隔离主分支；单一活跃变更约束 | 无 | branch/worktree 可选；无限制 |
| **设计-实现方向** | 自顶向下设计 + 自下向上实现 | 无约束 | 无约束 |
| **测试不可变性** | 测试用例 Design 后锁定，套件 Build 后锁定 | 无 | 无 |
| **CI/CD 集成** | 原生设计 pre-commit + CI + guard | 无 | 无 |
| **归档合并** | Archive 阶段自动 git 提交 + 创建 MR + 主分支合并 | 无 | 无 |
| **Skill 生态兼容** | 开放兼容多 Skill 生态 | 无 | 绑定 Superpowers |
| **服务契约管理** | 外部+对外契约，自动派生约束，契约漂移检测 | 无 | 无 |
| **认知框架** | 乔哈里窗变体 Q1-Q4，Design 阶段系统化认知 | 无 | 无 |

## 借鉴与增强

| 来源项目 | 贡献 | MumuSpec 的增强 |
|---------|------|----------------|
| **OpenSpec** | delta spec 语义 | 保留 + 增加 SHALL NOT delta |
| | 变更工件流水线 | 保留 + 增加约束工件 (constraints/) |
| | archive 历史归档 | 保留 + 增加图谱快照归档 |
| **Comet** | 五阶段状态机 | 保留 + 每阶段增加图谱验证 + 支持反向回退 |
| | phase guard 脚本 | 保留 + 增加规范校验守卫 + 回退守卫 |
| | hotfix/tweak 预设 | 保留 + 增加升级时的规范约束 |
| | handoff 上下文压缩 | 替换为渐进式披露（更精准） |
| | CodeGraph 语义索引 | 增强 + 与规范双向绑定 |
| | branch/worktree 可选 | 默认 worktree + 降级机制 |
| | 多变更并行 | 单一活跃变更约束（强制专注） |
| | 无设计-实现方向约束 | 自顶向下设计 + 自下向上实现 |
| | verify-fail 仅回退 build | Build/Verify 均可回退 Design + 快照 |
| | 无归档合并 | Archive 阶段 git 提交 + MR + 主分支合并 |
| **Superpowers** | brainstorming 设计门禁 | 保留 + 在 Open/Design 阶段强制分发 |
| | TDD 实现方法 | 保留 + 固定为默认模式 + 测试用例作为设计产出 |
| | systematic-debugging | 保留 + 回退决策时分发 |
| | verification-before-completion | 保留 + 阶段转换强制调用 |
| | writing-plans 任务分解 | 保留 + 受 build_layers 顺序约束 |
| | Skill 优先级体系 | 扩展 + 增加 MumuSpec 约束层（SHALL NOT > Skill） |
| **codebase-memory** | 知识图谱 (Nodes + Edges) | 保留 + 增加 Spec/Enforcement/Contract/KnowledgePage/Decision/Risk 节点，合并到 Knowledge Layer |
| | search_graph/trace_path | 保留 + 返回路径上的规范约束 |
| | detect_changes | 保留 + 检测受影响的规范 |
| **context-engineering** | 分层上下文策略 | 实现为树状渐进式披露 |
| | 反模式避免 | 设计为加载策略约束 |
| | 选择性包含 | 通过 index.yaml 实现选择性加载 |
| **LLM-Wiki / PageIndex** | 知识页面模型 + 索引系统 | 实现为 Knowledge Layer，与代码图谱双向关联，渐进式知识加载 |
| **Ponytail** | 懒惰高级开发者编码约束 | 7 级优先级阶梯（YAGNI→复用→标准库→平台特性→已有依赖→一行代码→最小实现），作为 Spec Layer 基础编码约束 |

---

## 技术选型建议

| 组件 | 推荐技术 | 版本范围 | 封装边界 | 降级策略 | 理由 |
|------|---------|---------|---------|---------|------|
| CLI 框架 | Node.js + Commander.js | Node.js ≥ 18 LTS / Commander ≥ 12 | 独立进程，CLI 层封装 | 降级为纯 Node.js 脚本 | 跨平台、与 Comet 生态对齐 |
| AST 解析 | tree-sitter | tree-sitter ≥ 0.22 | 图谱引擎内部，通过 adapter 接口暴露 | 不支持的语言降级为文件级索引 | 多语言支持、性能好 |
| 图谱存储 | SQLite + 图查询层 | SQLite ≥ 3.40 / better-sqlite3 ≥ 11 | 图谱引擎内部，封装为 MCP 工具 | 降级为内存图（小型项目） | 轻量、嵌入式、无需额外服务 |
| MCP Server | @modelcontextprotocol/sdk | ≥ 1.0 | 独立进程，通过 stdio/HTTP 通信 | 降级为 CLI 命令替代 | 标准化 AI 工具集成 |
| Lint 引擎 | 自研规则引擎 + ESLint/Semgrep 插件 | ESLint ≥ 9 / Semgrep ≥ 1.5 | 规则引擎核心自研，适配器层封装外部工具 | 自研引擎可独立运行 | 灵活扩展 + 复用生态 |
| 规范格式 | YAML + Markdown frontmatter | YAML ≥ 2.0（gray-matter 解析） | 规范加载器内部 | 纯 Markdown（无 frontmatter）降级 | 人类可读 + 机器可解析 |
| 状态管理 | YAML 文件 + 脚本校验 | — | 变更状态机内部 | — | 简单、可版本控制 |
| CI 集成 | GitHub Actions / GitLab CI 插件 | — | 独立 Action/插件，通过 CLI 交互 | 降级为手动 CLI 调用 | 主流 CI/CD 平台 |

### 版本约束原则

1. **Node.js LTS 优先**: 仅依赖 Active LTS 或 Maintenance LTS 版本
2. **语义版本锁定**: `package.json` 中使用 `^` 范围，CI 中锁版本
3. **封装边界清晰**: 所有第三方依赖封装在内部模块中，不泄漏到公共 API
4. **降级路径**: 每个依赖有明确的降级策略，确保核心功能不受影响
5. **安全更新**: 定期扫描依赖漏洞，安全补丁优先升级

---

## 深度链接

本速查表仅汇总三项目核心差异。更全面的生态对标与深度分析见下列文档：

- [mumuspec-ecosystem-comparison.md](./mumuspec-ecosystem-comparison.md) — 详细多项目（8 个）对比与差距分析。覆盖规范驱动、工作流编排、代码图谱、记忆层、多代理编排五大维度，含成熟度差距分析与战略建议。
- [ai-agent-ecosystem-research.md](./ai-agent-ecosystem-research.md) — AI Coding Agent 生态深度调研报告。解析 skills / OpenSpec / superpowers / mem0 / CGC / CBM / comet / OmO 八个标杆项目的设计理念、核心流程与架构，含 OpenCode 插件开发体系深度解析。

---

> **导航**: [← 目录结构](directory-structure.md) | [路线图 →](roadmap.md) | [返回概览](../overview.md)
