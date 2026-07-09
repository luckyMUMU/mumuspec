# 与参考项目对比

> 层级: Level 3 附录

---

## 核心差异

| 特性 | OpenSpec | Comet | MumuSpec |
|------|---------|-------|----------|
| **约束方向** | 仅正向（SHALL） | 仅正向 | **正向 + 反向（SHALL + SHALL NOT）** |
| **规范分布** | 集中存放 `openspec/specs/` | 集中存放 | **树状分布，按目录结构分层** |
| **上下文加载** | 全量加载规范 | 全量 + handoff 压缩 | **渐进式披露，按切入层级加载** |
| **代码索引** | 无 | CodeGraph（0.3.7+） | **原生集成代码图谱（Knowledge Layer 子组件）** |
| **规范-代码绑定** | 无 | 无 | **GOVERNED_BY 边 + Enforcement** |
| **漂移检测** | 无 | 无 | **自动检测规范与代码漂移** |
| **禁止项可执行** | N/A | N/A | **每个 SHALL NOT 都有可执行检查** |
| **变更生命周期** | ✓ | ✓（状态机） | ✓（状态机 + 图谱验证 + 可回退） |
| **预设路径** | 无 | hotfix/tweak | hotfix/tweak（增加规范约束） |
| **CI/CD 集成** | 无 | 无 | **原生设计 pre-commit + CI + guard** |
| **默认隔离方式** | 无 | branch/worktree 可选 | **默认 worktree，物理隔离主分支** |
| **活跃变更数量** | 无限制 | 无限制 | **单一活跃变更约束** |
| **设计-实现方向** | 无约束 | 无约束 | **自顶向下设计 + 自下向上实现** |
| **TDD 模式** | 无 | 可选 | **默认红绿 TDD，固定不可关闭** |
| **测试不可变性** | 无 | 无 | **测试用例 Design 后锁定，套件 Build 后锁定** |
| **阶段回退** | 无 | verify-fail 可回退 | **Build/Verify 均可回退到 Design，带快照与回退计数** |
| **归档合并** | 无 | 无 | **Archive 阶段自动 git 提交 + 创建 MR + 合并到主分支** |
| **Skill 生态兼容** | 无 | 绑定 Superpowers | **开放兼容多 Skill 生态** |
| **服务契约管理** | 无 | 无 | **外部服务契约 + 自身对外契约，自动派生约束，契约漂移检测** |
| **设计知识持久化** | 无 | 无 | **Knowledge Layer：代码图谱 + LLM-Wiki + PageIndex，跨变更知识积累** |
| **基础编码约束** | 无 | 无 | **Ponytail 7 级优先级阶梯，YAGNI + 复用 + 最小实现** |
| **认知框架** | 无 | 无 | **乔哈里窗变体 Q1-Q4，Design 阶段系统化认知，最小化未知盲区** |

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

> **导航**: [← 目录结构](directory-structure.md) | [路线图 →](roadmap.md) | [返回概览](../overview.md)
