# Design: mumuspec

## Architecture Overview

MumuSpec 是一个**树状分布式双向约束规范系统**，用于 AI 辅助开发。整体采用六层架构，从下到上依次为：

```
┌─────────────────────────────────────────────────────┐
│  Entry Layer   │ cli.ts / mcp-server.ts / index.ts  │
├─────────────────────────────────────────────────────┤
│  Change Layer  │ manager.ts / state-machine.ts       │
├─────────────────────────────────────────────────────┤
│  Guard Layer   │ checker.ts / phase-guard.ts         │
├─────────────────────────────────────────────────────┤
│  Spec Layer    │ parser / loader / validator / ...    │
├─────────────────────────────────────────────────────┤
│  Knowledge Layer│ manager.ts (PageIndex + LLM-Wiki)   │
├─────────────────────────────────────────────────────┤
│  Core Layer    │ config / utils / errors / types      │
└─────────────────────────────────────────────────────┘
```

### 设计原则

1. **规范驱动** — 规范是行为的唯一真相来源，代码是规范的实现
2. **Ponytail 优先** — 能不写就不写，能复用就复用，能简单就简单
3. **渐进式披露** — 规范按需加载，Layer 0 → 1 → 2 逐步深入
4. **双向约束** — SHALL（正向要求）+ SHALL NOT（反向禁止）
5. **动态强度** — 约束按 high/medium/low 分级，映射到 block/warn/info
6. **零运行时依赖偏好** — install、bundle、i18n、skill-authoring 模块零外部依赖

### 模块分组

| 层 | 模块 | 职责 | 外部依赖 |
|----|------|------|----------|
| Entry | cli.ts | CLI 命令编排 | commander |
| Entry | mcp-server.ts | MCP 工具暴露给 LLM | @modelcontextprotocol/sdk |
| Change | manager.ts | 变更 CRUD + 构建层管理 | — |
| Change | state-machine.ts | 5 阶段状态机 + 回滚 | — |
| Guard | checker.ts | 合规检查 + 漂移检测 + 强度降级 | — |
| Guard | phase-guard.ts | 5 种阶段转换门禁 | — |
| Spec | parser.ts | spec.md 解析/序列化 | yaml |
| Spec | loader.ts | 渐进式上下文加载 | yaml |
| Spec | validator.ts | 全项目规范校验 | — |
| Spec | inheritance.ts | 继承冲突检测 | — |
| Spec | ponytail.ts | Ponytail 约束定义与注入 | — |
| Knowledge | manager.ts | 知识库 CRUD + PageIndex | — |
| Core | config.ts | 配置加载 + 约束树解析 + 强度矩阵 | — |
| Core | utils.ts | FS/YAML/Hash/审计工具 | — |
| Core | errors.ts | 标准化错误码 | — |
| Core | constraint-evaluator.ts | 运行时约束求值 | — |
| Core | constraints-loader.ts | 磁盘 I/O + 树加载 | — |
| Helper | generator.ts | AI 规则文件生成 | — |
| Helper | installer.ts | Skills/MCP/Commands 安装 | 零依赖 |
| Helper | packager.ts | 技能打包/验证 | 零依赖 |
| Helper | feedback.ts | 用户反馈管理 | — |
| Helper | hooks.ts | Git Hooks 管理 | — |
| Helper | eval.ts | 评估场景运行 | — |
| Helper | locales.ts | 国际化 | 零依赖 |
| Helper | protocol.ts | 技能创作协议 | 零依赖 |

## Key Decisions

### D-001: 六层架构分离

**Context**: 规范系统需要同时处理规范定义（Spec）、规范执行（Guard）、变更管理（Change）和知识沉淀（Knowledge）。

**Decision**: 采用六层架构，每层有清晰的职责边界。Spec 层只管解析，Guard 层只管检查，Change 层只管状态，Knowledge 层只管存储。

**Consequence**: 各层可独立测试和替换；新增功能只需在对应层添加模块。

### D-002: 树状约束系统

**Context**: 不同目录可能需要不同的约束强度，子目录应能继承并收紧父目录约束。

**Decision**: 实现 ConstraintTreeNode，支持继承 + 收紧 + 冲突检测。根层 ConstraintStrength 由 config.yaml 控制，子层可覆盖。

**Consequence**: 灵活的分层约束；收紧合法；放松非法（产生冲突）。

### D-003: 动态强度映射

**Context**: 不同项目/阶段需要不同的严格程度。一刀切的 block 不适合探索性项目。

**Decision**: high→block, medium→warn, low→info。9 条 always_enforce 异常始终阻断。

**Consequence**: 通过切换 strict/balanced/hotfix 预设适应不同场景。

### D-004: 零运行时依赖偏好

**Context**: 安装器、打包器、国际化、技能创作协议是基础设施，不应引入脆弱依赖链。

**Decision**: 这四个模块仅使用 Node.js 内置模块。

**Consequence**: 更小的安装体积、更快的启动、更少的 breaking changes。

### D-005: 5 阶段变更生命周期

**Context**: AI 开发需要结构化的工作流来管理变更。

**Decision**: open → design → build → verify → archive。支持回滚（build→design, verify→design, verify→build）和热修复跳过设计。

**Consequence**: 清晰的进度追踪；阶段门禁保证质量；回滚机制提供安全感。
