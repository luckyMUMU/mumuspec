# 文档整理记录

> **整理日期**: 2026-07-29
> **设计版本**: 0.12.1-draft

本次整理对 docs 目录下的文档进行了系统化重组，使其与最新版本 (0.12.1) 对齐。

---

## 一、删除的过时文档

| 文件 | 原因 |
|------|------|
| `docs/design/code-graph-layer.md` | 已归档文件，内容已于 0.10.0 合并到 `knowledge-layer.md` |

---

## 二、版本号更新

| 文件 | 更新前 | 更新后 |
|------|--------|--------|
| `docs/design.md` | 0.11.0-draft | 0.12.1-draft |
| `docs/implementation-plan.md` | 0.10.0 | 0.12.1 (标记为已归档) |
| `docs/overview.md` | 日期 2026-07-27 | 日期 2026-07-29 |
| `docs/appendix/roadmap.md` | 日期 2026-07-24 | 日期 2026-07-29 |

---

## 三、版本变更记录补全

在 `docs/design.md` 中添加了以下版本的变更记录：

- **0.11.0** (2026-07-24): 设计优化（可插拔图谱后端、MVP 范围收敛、工作流规则可配置化等）
- **0.12.0** (2026-07-27): 动态约束强度系统
- **0.12.1** (2026-07-27): constraints.yaml 树状层级化
- **0.12.2** (2026-07-29): Skill 驱动工作流编排

---

## 四、文档去重策略

为避免过度删除导致信息丢失，采用以下去重策略：

1. **保留核心详文档**：将详细信息保留在最相关的文档中
2. **交叉引用**：在其他文档中使用链接引用，而非复制内容
3. **分层级组织**：
   - Level 0 (overview.md): 仅保留高层概览和快速导航
   - Level 1 (design/): 保留各层详细设计
   - Level 2 (reference/): 保留操作参考信息
   - Level 3 (appendix/): 保留深度分析内容

---

## 五、文档导航结构

```
docs/
├── design.md              # 设计文档索引（入口）
├── overview.md            # 全局概览（Level 0）
├── STATUS.md              # 项目状态（权威进度源）
├── getting-started.md     # 用户上手指南（CLI）
├── getting-started-agent.md # Agent QuickStart（AI 工具）
├── tutorial.md            # 分步教程
├── implementation-plan.md # 实现计划（已归档，指向 roadmap.md）
├── design/                # 架构设计文档（Level 1）
│   ├── spec-layer.md      # 规范层设计
│   ├── contract-layer.md  # 契约层设计
│   ├── change-layer.md    # 变更层设计
│   ├── knowledge-layer.md # 知识层设计
│   ├── guard-layer.md     # 校验层设计
│   ├── ai-integration.md  # AI 集成层设计
│   └── constraint-strength.md # 动态约束强度系统
├── reference/             # 参考文档（Level 2）
│   ├── cli-commands.md    # CLI 命令参考
│   ├── mcp-tools.md       # MCP 工具参考
│   ├── configuration.md   # 配置参考
│   ├── phase-guards.md    # Phase Guard 规则
│   ├── drift-detection.md # 漂移检测规则
│   ├── cognitive-framework.md # 认知框架
│   ├── error-codes.md     # 错误码参考
│   ├── glossary.md        # 术语表
│   └── ...
└── appendix/              # 附录（Level 3）
    ├── roadmap.md         # 实施路线图
    ├── comparison.md      # 项目对比
    ├── directory-structure.md # 目录结构
    ├── mumuspec-ecosystem-comparison.md # 生态对标
    ├── ai-agent-ecosystem-research.md   # 生态调研
    └── open-questions.md  # 开放问题
```

---

## 六、后续维护建议

1. **版本号同步**：每次设计变更时，同步更新相关文档版本号
2. **交叉引用**：重复内容使用链接引用，避免多处维护
3. **定期审查**：每季度审查一次文档，及时归档过时内容
4. **单一权威源**：进度数据以 STATUS.md 为准，其他文档引用

---

> **导航**: [返回概览](overview.md) | [设计文档索引](design.md)
