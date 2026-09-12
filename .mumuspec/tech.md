---
scope: .
layer: 0
last_updated: '2026-09-05'
---

# 技术概览: MumuSpec

## 六层架构

MumuSpec 采用六层架构，从上到下依次为：

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

## 模块分组

| 层 | 模块 | 职责 | 外部依赖 |
|----|------|------|----------|
| Entry | cli.ts | CLI 命令编排 | commander |
| Entry | mcp-server.ts | MCP 工具暴露给 LLM | @modelcontextprotocol/sdk |
| Change | manager.ts | 变更 CRUD + 构建层管理 | — |
| Change | state-machine.ts | 5 阶段状态机 + 回滚 | — |
| Change | phase-graph.ts | workflow 图构建（PHASE_ORDER 同构基准） | — |
| Change | phase-graph-loader.ts | 声明式 workflow YAML 加载 + 项目级 override | yaml |
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

## 关键决策

### D-001: 六层架构分离
**Decision**: 采用六层架构，每层有清晰的职责边界。Spec 层只管解析，Guard 层只管检查，Change 层只管状态，Knowledge 层只管存储。
**Consequence**: 各层可独立测试和替换；新增功能只需在对应层添加模块。

### D-002: 树状约束系统
**Decision**: 实现 ConstraintTreeNode，支持继承 + 收紧 + 冲突检测。根层 ConstraintStrength 由 config.yaml 控制，子层可覆盖。
**Consequence**: 灵活的分层约束；收紧合法；放松非法（产生冲突）。

### D-003: 动态强度映射
**Decision**: high→block, medium→warn, low→info。9 条 always_enforce 异常始终阻断。
**Consequence**: 通过切换 strict/balanced/hotfix 预设适应不同场景。

### D-004: 零运行时依赖偏好
**Decision**: install、bundle、i18n、skill-authoring 四个模块仅使用 Node.js 内置模块。
**Consequence**: 更小的安装体积、更快的启动、更少的 breaking changes。

### D-005: 5 阶段变更生命周期
**Decision**: open → design → build → verify → archive。支持回退（build→design, verify→design, verify→build）和热修复跳过设计。
**Consequence**: 清晰的进度追踪；阶段门禁保证质量；回滚机制提供安全感。

### D-006: Workflow 声明式外化（CHG-6 / CHG-7）
**Decision**: 阶段状态机的 phases / edges / breakpoints 以声明式 YAML 定义（`src/change/workflow.default.yaml` 为单一事实源，由 phase-graph-loader.ts 加载，AC-01 测试锁定与 PHASE_ORDER 同构）；项目可通过 `.mumuspec/workflow.yaml` override，在 guard 入口由 activateProjectWorkflow() 加载——存在且合法即生效，损坏/非法时 WARN 并回退内置默认。
**Consequence**: 流程定义与引擎代码分离（KP-0060 规则-实现分离）；项目可裁剪 BP、调整回退边而无需改代码；非法 override 被 loader 校验拒绝。

## 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 语言 | TypeScript (ESM) | 全栈类型安全 |
| 运行时 | Node.js >= 20.0.0 | 唯一运行时依赖 |
| CLI 框架 | commander | 命令行解析 |
| MCP SDK | @modelcontextprotocol/sdk | AI 工具集成 |
| YAML | yaml 库 | spec.md / config.yaml 解析 |
| 测试 | vitest | 单元测试 + 集成测试 |
| 构建 | tsc (TypeScript compiler) | ESM 编译 |
| Lint | ESLint + Prettier | 代码风格检查 |
| 零依赖模块 | Node.js 内置模块 | install/bundle/i18n/skill-authoring |


<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-completeness-artifacts-freedom-metrics/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from 2026-09-09-review-followup-hardening/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from freedom-metrics-loop-closure/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-prune-safety/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-prune-safety/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from archive-state-integrity/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from archive-state-integrity/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from self-improvement-loop-p0/new-shall.md -->
# New SHALL Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall-not.md -->
# New SHALL NOT Constraints




<!-- constraint-merged from evaluator-weight-single-source/new-shall.md -->
# New SHALL Constraints


