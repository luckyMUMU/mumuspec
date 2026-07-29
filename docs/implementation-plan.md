# MumuSpec 实现计划

> **版本**: 0.10.0 | **日期**: 2026-07-09 | **状态**: 已交付（文档修复完成 + 验证通过）
>
> 基于 MumuSpec 0.10.0 设计文档的二次审查结果，参考 OpenSpec + Comet 工程实践，确保各能力成体系化。

---

## 1. 二次审查总结

### 1.1 能力体系化评估矩阵

| 能力层 | 设计完备性 | 层间集成 | 守卫覆盖 | 漂移检测 | 错误码 | CLI/MCP | 体系化评分 |
|--------|-----------|---------|---------|---------|--------|---------|-----------|
| **Spec Layer** | ✅ 完备 | ✅ 双向绑定 | ✅ 完整 | ✅ 规范漂移 | ✅ SPEC 域 | ✅ 完整 | A |
| **Contract Layer** | ✅ 完备 | ✅ 图谱集成 | ✅ 完整 | ✅ 6 类漂移 | ✅ CONTRACT 域 | ✅ 完整 | A |
| **Change Layer** | ✅ 完备 | ✅ 五阶段集成 | ✅ 完整 | — | ✅ CHANGE 域 | ✅ 完整 | A |
| **Knowledge Layer** | ✅ 完备 | ✅ 双向关联 | ✅ 完整 | ✅ 知识漂移 | ✅ KNOWLEDGE 域 | ✅ 完整 | A |
| **Guard Layer** | ✅ 完备 | ✅ 全层覆盖 | — | ✅ 全类型 | ✅ GUARD 域 | ✅ 完整 | A |
| **AI Integration** | ✅ 完备 | ✅ Skill 分发 | — | — | — | ✅ 完整 | A |
| **认知框架** | ✅ 完备 | ✅ Design 集成 | ✅ 守卫检查 | — | ✅ DESIGN 域 | ✅ 完整 | A |
| **Ponytail** | ✅ 完备 | ✅ 守卫集成 | ✅ 完整 | ✅ Ponytail 漂移 | ✅ PONYTAIL 域 | ✅ 完整 | A |

### 1.2 关键发现

**优势**：
1. 六层架构职责清晰，层间关系通过图谱边（GOVERNED_BY / DECIDED_BY / CONSUMES / EXPOSES）双向关联
2. 变更生命周期完整（Open → Design → Build → Verify → Archive + 回退 + 预设路径），参照 Comet 五阶段状态机增强
3. 认知框架（Q1-Q4）深度集成到 Design 阶段，与 Hyperplan 形成反馈循环
4. Knowledge Layer 将代码图谱（HOW）+ LLM-Wiki（WHY）+ PageIndex（WHERE）统一管理，解决设计知识失忆问题
5. 漂移检测覆盖规范、图谱、测试、契约、知识五大类型

**体系化缺口**（已全部修复 ✅）：
- ~~Knowledge Layer 缺少独立错误码域和部分 Phase Guard 集成~~ → 已补充 E-KNOWLEDGE-001~008 + open_to_design 知识加载守卫
- ~~Ponytail 集成不完整（缺守卫、错误码、漂移检测）~~ → 已补充 E-PONYTAIL-001~004 + Phase Guard + 漂移检测
- ~~Roadmap 缺少认知框架和 Ponytail 的实现任务~~ → 已补充 Phase 1-5 任务
- ~~少量文档一致性问题（重复术语表、遗留文件等）~~ → 已全部修复

> **设计完备性 vs 实现进度**: 设计完备性 100% 指设计文档完整，实现进度 0% 指代码未开始。详见 [STATUS.md](./STATUS.md)。

### 1.3 与 OpenSpec / Comet 的对齐分析

| 维度 | OpenSpec/Comet 实践 | MumuSpec 对齐状态 | 增强 |
|------|-------------------|------------------|------|
| 变更工件流水线 | proposal → design → tasks → archive | ✅ 完全对齐 | + constraints/ + cognitive-map.yaml + code-graph/ |
| 状态机 | 5 阶段 + verify-fail 回退 | ✅ 增强 | + 3 种回退路径 + 快照 + 回退计数上限 |
| Phase Guard | guard --apply 自动转换 | ✅ 对齐 | + 规范校验 + 认知框架检查 + 知识提取检查 |
| 预设路径 | hotfix / tweak | ✅ 对齐 | + 升级条件 + TDD 不豁免 |
| 上下文管理 | handoff 压缩包 | ✅ 替代方案 | 渐进式披露（更精准，按目录层级加载） |
| 工件持久化 | openspec/specs/ 主规范 | ✅ 对齐 | + Knowledge Layer 跨变更知识积累 |
| 决策记录 | decisions.md | ✅ 对齐 | + hash 防篡改 + 认知框架决策溯源 |
| Skill 生态 | 绑定 Superpowers | ✅ 增强 | 开放兼容多 Skill 生态 + 优先级体系 |
| 知识图谱 | CodeGraph 语义索引 | ✅ 增强 | + 规范-代码双向绑定 + LLM-Wiki + PageIndex |

---

## 2. 体系化缺口清单

### P0 — 阻断性缺口（已全部修复 ✅）

| 编号 | 缺口 | 影响范围 | 修复状态 |
|------|------|---------|---------|
| G-P0-01 | Knowledge Layer 缺少独立错误码域 | error-codes.md | ✅ 已新增 E-KNOWLEDGE-001 ~ E-KNOWLEDGE-008 |
| G-P0-02 | Roadmap Phase 3 缺少认知框架实现任务 | roadmap.md | ✅ 已补充到 Phase 2 |
| G-P0-03 | Roadmap Phase 3 缺少 Ponytail 实现任务 | roadmap.md | ✅ 已补充到 Phase 1 |
| G-P0-04 | Ponytail 缺少 Phase Guard 集成 | phase-guards.md, guard-layer.md | ✅ 已补充 design_to_build + build_to_verify 守卫 |
| G-P0-05 | code-graph-layer.md 遗留文件未清理 | design/ | ✅ 已标记为 archived |

### P1 — 一致性缺口（已全部修复 ✅）

| 编号 | 缺口 | 影响范围 | 修复状态 |
|------|------|---------|---------|
| G-P1-01 | 术语表知识层条目重复 | glossary.md | ✅ 已合并去重 |
| G-P1-02 | Open 阶段缺少知识加载步骤描述 | change-layer.md | ✅ 已增加步骤 5 |
| G-P1-03 | open_to_design 守卫缺少知识加载检查 | phase-guards.md | ✅ 已增加 knowledge_context_loaded |
| G-P1-04 | Guard Layer 未列出 Ponytail 执行检查 | guard-layer.md | ✅ 已补充 Pre-commit + CI |
| G-P1-05 | Roadmap 版本映射中认知框架归属不当 | roadmap.md | ✅ 已修正为 Phase 2-3 |
| G-P1-06 | 目录结构缺少 audit.log | directory-structure.md | ✅ 已补充 |
| G-P1-07 | Ponytail 缺少错误码 | error-codes.md | ✅ 已新增 E-PONYTAIL-001 ~ E-PONYTAIL-004 |
| G-P1-08 | Ponytail 缺少漂移检测 | drift-detection.md | ✅ 已新增 ponytail_drift |

### P2 — 次要问题（已全部修复 ✅）

| 编号 | 缺口 | 影响范围 | 修复状态 |
|------|------|---------|---------|
| G-P2-01 | configuration.md 有过时注释 | configuration.md | ✅ 已清理 |
| G-P2-02 | 概览问题陈述缺少认知框架 | overview.md | ✅ 已增加"设计认知不系统" |
| G-P2-03 | 对比表缺少 Ponytail 与认知框架行 | comparison.md | ✅ 确认完整 |

---

## 3. 实现计划

### 3.0 计划概览

本计划分为三大工作流：

```
工作流 A: 文档一致性修复（G-P0 + G-P1 + G-P2）
  ├── A1: Knowledge Layer 错误码补充
  ├── A2: Ponytail 守卫/错误码/漂移检测集成
  ├── A3: Roadmap 任务补充与版本映射修正
  ├── A4: 文档一致性修复（术语表、目录结构、注释等）
  └── A5: 遗留文件清理

工作流 B: 能力体系化验证（确认各能力闭环）
  ├── B1: Spec Layer 闭环验证
  ├── B2: Contract Layer 闭环验证
  ├── B3: Change Layer 闭环验证
  ├── B4: Knowledge Layer 闭环验证
  ├── B5: Guard Layer 闭环验证
  ├── B6: AI Integration Layer 闭环验证
  ├── B7: 认知框架闭环验证
  └── B8: Ponytail 闭环验证

工作流 C: 实现路线图细化（Phase 1-5 任务分解）
  ├── C1: Phase 1 任务细化
  ├── C2: Phase 2 任务细化
  ├── C3: Phase 3 任务细化
  ├── C4: Phase 4 任务细化
  └── C5: Phase 5 任务细化
```

### 3.1 工作流 A: 文档一致性修复

#### Task A1: Knowledge Layer 错误码补充

**文件**: `docs/reference/error-codes.md`

**新增错误码**:

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 |
|--------|------|---------|---------|---------|---------|
| E-KNOWLEDGE-001 | KNOWLEDGE_PAGE_FORMAT_INVALID | ERROR | 知识页面 YAML frontmatter 格式错误 | id/title/type/status/scope 等必填字段缺失或类型不匹配 | 1. 检查 frontmatter 字段 2. 运行 `mumuspec knowledge verify --id <id>` |
| E-KNOWLEDGE-002 | KNOWLEDGE_EXTRACTION_FAIL | ERROR | Archive 阶段知识提取失败 | cognitive-map.yaml / decisions.md 格式异常或内容缺失 | 1. 检查变更工件完整性 2. 重新执行 `mumuspec knowledge extract <change>` |
| E-KNOWLEDGE-003 | KNOWLEDGE_PAGE_NOT_FOUND | ERROR | PageIndex 引用的知识页面文件不存在 | 知识文件被手动删除或移动 | 1. 检查 _index.yaml 条目 2. 恢复文件或更新索引 |
| E-KNOWLEDGE-004 | KNOWLEDGE_GRAPH_BINDING_INVALID | ERROR | 知识页面 graph_bindings 引用的代码节点不存在 | 代码重构后未更新知识页面关联 | 1. 运行 `mumuspec knowledge verify --id <id>` 2. 更新 graph_bindings 或标记 deprecated |
| E-KNOWLEDGE-005 | KNOWLEDGE_CONFLICT_UNRESOLVED | ERROR | 检测到知识冲突但未处理 | 新知识 supersede 旧知识但未标记 | 1. 运行 `mumuspec knowledge supersede <old-id> --by <new-id>` |
| E-KNOWLEDGE-006 | KNOWLEDGE_INDEX_CORRUPT | ERROR | PageIndex _index.yaml 与实际文件不一致 | 索引文件损坏或手动编辑 | 1. 运行 `mumuspec knowledge index --rebuild` |
| E-KNOWLEDGE-007 | KNOWLEDGE_FRESHNESS_EXPIRED | WARN | 知识页面超过 freshness.error_after_days | 长期未验证的知识页面 | 1. 运行 `mumuspec knowledge verify --all` 2. 重新验证或标记 deprecated |
| E-KNOWLEDGE-008 | KNOWLEDGE_REVERSE_INDEX_STALE | WARN | 反向索引与主索引不一致 | 反向索引未自动更新 | 1. 运行 `mumuspec knowledge index --update-reverse` |

**同时更新**:
- `error-codes.md` 域表新增 `KNOWLEDGE | E-KNOWLEDGE-001 ~ E-KNOWLEDGE-099 | 知识层错误`
- `--force` 选项说明表增加 E-KNOWLEDGE-007 和 E-KNOWLEDGE-008

#### Task A2: Ponytail 守卫/错误码/漂移检测集成

**文件**: `docs/reference/error-codes.md`, `docs/reference/phase-guards.md`, `docs/design/guard-layer.md`, `docs/reference/drift-detection.md`

**新增 Ponytail 错误码**:

| 错误码 | 名称 | 严重级别 | 触发条件 | 原因说明 | 修复步骤 |
|--------|------|---------|---------|---------|---------|
| E-PONYTAIL-001 | PONYTAIL_YAGNI_VIOLATION | WARN | 引入了未被请求的抽象层或功能 | 违反 YAGNI 原则 | 1. 删除不必要的抽象 2. 或用 `ponytail:` 注释标记理由 |
| E-PONYTAIL-002 | PONYTAIL_UNNECESSARY_DEPENDENCY | ERROR | 在标准库/平台特性已满足时引入新依赖 | 违反优先级阶梯第 3-5 级 | 1. 使用标准库/平台特性替代 2. 或使用已有依赖 |
| E-PONYTAIL-003 | PONYTAIL_BOILERPLATE | WARN | 生成未被请求的样板代码 | 违反最小实现原则 | 1. 删除样板代码 2. 使用最小可工作实现 |
| E-PONYTAIL-004 | PONYTAIL_CLEVER_OVER_SIMPLE | WARN | 用复杂方案替代简单方案 | 违反 boring over clever 原则 | 1. 简化为 boring 方案 2. 或用 `ponytail:` 注释标记理由 |

**Phase Guard 集成**:

在 `design_to_build` 守卫增加:
```yaml
  - ponytail_constraints_defined: true          # design.md 包含 Ponytail 约束检查
```

在 `build_to_verify` 守卫增加:
```yaml
  - ponytail_compliance_checked: true           # Build 阶段已执行 Ponytail 合规检查
```

**Guard Layer 更新**:
- Pre-commit 增加: Ponytail 快速检查（YAGNI + 依赖检查）
- CI 增加: Ponytail 全量检查（7 级阶梯合规）

**漂移检测新增**:
```yaml
ponytail_drift:
  - check: "代码引入了未在 design.md 中声明的新依赖"
    detection: "compare package.json/requirements.txt with design.md dependency declarations"
    severity: ERROR
    auto_fix: false
    recommendation: "新依赖需在设计阶段声明，或用 ponytail: 注释标记理由"

  - check: "代码存在未被请求的抽象层"
    detection: "AST analysis for unnecessary abstraction patterns"
    severity: WARN
    auto_fix: false
    recommendation: "检查是否违反 YAGNI，用 ponytail: 注释标记或移除"
```

#### Task A3: Roadmap 任务补充与版本映射修正

**文件**: `docs/appendix/roadmap.md`

**Phase 2 新增任务**:
```markdown
- [ ] **[P0]** 认知框架引擎（cognitive-map.yaml 验证、收敛逻辑、Q4 扫描自动化）
- [ ] **[P1]** 认知框架 CLI 命令（cognitive-map init/status/validate/converge）
- [ ] **[P1]** 认知框架 MCP 工具（get_cognitive_map/check_convergence/update_cognitive_map）
```

**Phase 1 新增任务**:
```markdown
- [ ] **[P0]** Ponytail 约束注入引擎（自动注入根层 spec.md）
- [ ] **[P1]** Ponytail lint 规则（YAGNI 检查、依赖检查、样板代码检测）
- [ ] **[P1]** `ponytail:` 注释标记解析器
```

**Phase 4 新增任务**:
```markdown
- [ ] **[P1]** Ponytail 漂移检测集成到 CI/CD
- [ ] **[P2]** Ponytail 约束模板库（常见技术栈的预置 Ponytail 约束）
```

**版本映射修正**:
```
| 0.8.0 | Phase 2-3 | Contract Layer 契约层；认知框架（乔哈里窗变体 Q1-Q4）集成到 Design 阶段 |
```
（原为 Phase 3，修正为 Phase 2-3，因认知框架是 Design 阶段功能）

#### Task A4: 文档一致性修复

**文件**: 多个

1. **glossary.md**: 合并两个"知识层术语"表（删除第 113-125 行的重复部分）
2. **change-layer.md**: Phase 1 Open 增加步骤 "9. 加载 affected_scopes 的历史知识（从 Knowledge Layer PageIndex）"
3. **phase-guards.md**: `open_to_design` 增加 `knowledge_context_loaded: true` 检查
4. **directory-structure.md**: `.mumuspec/` 目录补充 `audit.log` 文件
5. **configuration.md**: 清理 code_graph 合并注释（删除第 26-27 行过时注释）
6. **overview.md**: 问题陈述第 3 点增加 "设计认知不系统"

#### Task A5: 遗留文件清理

**文件**: `docs/design/code-graph-layer.md`

操作: 删除该文件（内容已合并到 `knowledge-layer.md`），或添加归档标记:
```markdown
> **⚠️ ARCHIVED**: 本文档已在 0.10.0 中合并到 [知识层设计](knowledge-layer.md)。
> 保留此文件仅供历史参考，请勿基于此文件进行开发。
```

### 3.2 工作流 B: 能力体系化验证

对每个能力层进行闭环验证，确认设计文档中该能力的以下要素完备：

#### B1: Spec Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 核心设计定义 | ✅ | SHALL/SHALL NOT + Ponytail 阶梯 |
| 目录结构 | ✅ | 树状分布 + 渐进式披露 |
| 文件格式 | ✅ | spec.md / design.md / prohibitions.md / index.yaml |
| 继承规则 | ✅ | 收紧不可放宽 + 边界条件 |
| 文档生成 | ✅ | 4 种文档类型 + 模板系统 |
| 图谱绑定 | ✅ | GOVERNED_BY / ENFORCED_BY 边 |
| Phase Guard | ✅ | design_to_build 检查 |
| 漂移检测 | ✅ | spec_drift |
| 错误码 | ✅ | E-SPEC-001 ~ 007 |
| CLI 命令 | ✅ | init/context/add-spec/validate |
| MCP 工具 | ✅ | get_spec_context/search_specs/get_prohibitions |
| 配置 | ✅ | specs.* 配置项 |

**结论**: Spec Layer 体系化完备 ✅

#### B2: Contract Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 契约分类 | ✅ | External + Outbound |
| 文件格式 | ✅ | YAML + derived_constraints |
| 约束派生 | ✅ | 自动注入 spec.md |
| 版本管理 | ✅ | 双重版本号 + 兼容性矩阵 |
| 图谱集成 | ✅ | Contract 节点 + CONSUMES/EXPOSES 边 |
| 生命周期集成 | ✅ | 五阶段契约动作 |
| Phase Guard | ✅ | build_to_verify 契约校验 |
| 漂移检测 | ✅ | 6 类契约漂移 |
| 错误码 | ✅ | E-CONTRACT-001 ~ 006 |
| CLI 命令 | ✅ | contract init/add/list/verify/derive/drift/impact/compat |
| MCP 工具 | ✅ | get_contract_context/check_contract_compliance/detect_contract_drift/trace_contract_impact |
| 配置 | ✅ | contracts.* 配置项 |
| 文档生成 | ✅ | 集成指南 + 外部依赖文档 |

**结论**: Contract Layer 体系化完备 ✅

#### B3: Change Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 生命周期 | ✅ | Open → Design → Build → Verify → Archive |
| 状态机 | ✅ | 正向流转 + 回退 + 旁路 |
| 预设路径 | ✅ | hotfix / tweak / full + 升级条件 |
| 回退机制 | ✅ | 3 种回退 + 快照 + 计数上限 |
| 错误恢复 | ✅ | 7 种决策树 |
| 工件结构 | ✅ | 完整变更目录 |
| TDD 集成 | ✅ | 红绿 TDD + 测试不可变性 |
| 认知框架集成 | ✅ | Design 步骤 0 |
| 图谱集成 | ✅ | 影响分析 + 调用链验证 |
| 知识集成 | ✅ | Open 阶段步骤 5 加载历史知识 + Archive D 子流程知识提取 |
| Phase Guard | ✅ | 5 个正向 + 4 个回退 + 2 个终态 |
| 错误码 | ✅ | E-CHANGE-001 ~ 007 |
| CLI 命令 | ✅ | new/status/list/archive/discard/rollback/snapshot |
| 决策记录 | ✅ | decisions.md + hash 防篡改 |

**结论**: Change Layer 体系化完备 ✅

#### B4: Knowledge Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 代码图谱 | ✅ | Schema + 存储 + 索引 |
| LLM-Wiki | ✅ | 知识页面格式 + 类型 + 状态机 |
| PageIndex | ✅ | 主索引 + 反向索引 + 渐进式加载 |
| 双向关联 | ✅ | graph_bindings + 7 种知识边 |
| 新鲜度管理 | ✅ | fresh/stale/unverified |
| 生命周期集成 | ✅ | 8 阶段交互（Open/Design/Build/Verify/Archive） |
| 知识提取 | ✅ | D1-D8 子流程 |
| Phase Guard | ✅ | verify_to_archive + open_to_design 知识加载检查均已补充 |
| 漂移检测 | ✅ | 4 类知识漂移 |
| 错误码 | ✅ | E-KNOWLEDGE-001 ~ 008 已补充 |
| CLI 命令 | ✅ | knowledge list/show/search/context/verify/graph/extract/stale/supersede |
| MCP 工具 | ✅ | 8 个知识管理工具 |
| 配置 | ✅ | knowledge.* 配置项 |
| 规范关系 | ✅ | 三者互补关系明确 |

**结论**: Knowledge Layer 体系化完备 ✅

#### B5: Guard Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 校验层次 | ✅ | Pre-commit + CI + Phase Guard |
| 性能指标 | ✅ | 矩阵完备 |
| 漂移检测 | ✅ | 12 种漂移类型 |
| 安全校验 | ✅ | 威胁模型 + 访问控制 + 输入校验 |
| 可观测性 | ✅ | 日志 + Audit + CI 告警 |
| Git Hooks | ✅ | pre-commit 集成 |
| Ponytail 检查 | ✅ | Pre-commit + CI 已补充 Ponytail 检查 |
| 错误码 | ✅ | E-GUARD-001 ~ 007 |

**结论**: Guard Layer 体系化完备 ✅

#### B6: AI Integration Layer 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Skill 编排器 | ✅ | 7 个阶段 Skill 文件 |
| Skill 生态兼容 | ✅ | 5 个生态 + 分发协议 |
| 优先级体系 | ✅ | 用户 > SHALL NOT > SHALL > Skill > 默认 |
| Rules 文件 | ✅ | CLAUDE.md / .cursorrules / AGENTS.md |
| MCP Server | ✅ | 配置 + 工具列表 |
| CLI | ✅ | 完整命令集 |
| 知识层集成 | ✅ | Rules 文件含知识层说明 |
| Ponytail 集成 | ✅ | Rules 文件含 Ponytail 约束 |

**结论**: AI Integration Layer 体系化完备 ✅

#### B7: 认知框架闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 四象限定义 | ✅ | Q1-Q4 + 操作策略 |
| 工作流程 | ✅ | 4 阶段递进 + 收敛规则 |
| 输出格式 | ✅ | cognitive-map.yaml + 6 种输出模板 |
| Design 集成 | ✅ | 步骤 0 + 与现有步骤映射 |
| Hyperplan 衔接 | ✅ | 双向反馈循环 |
| Phase Guard | ✅ | 6 项认知框架检查 |
| Skill 衔接 | ✅ | 4 象限 Skill 映射 + 分发协议 |
| decisions.md | ✅ | 认知框架决策记录 |
| 知识层联动 | ✅ | Q1 从知识库锚定 + Archive 知识提取 |
| 适用场景 | ✅ | full/hotfix/tweak/回退/复杂 |
| 错误码 | ✅ | E-DESIGN-001 ~ 006 |
| CLI 命令 | ✅ | cognitive-map init/status/validate/converge |
| MCP 工具 | ✅ | get_cognitive_map/check_convergence/update_cognitive_map |
| 配置 | ✅ | cognitive_framework.* 配置项 |

**结论**: 认知框架体系化完备 ✅

#### B8: Ponytail 闭环验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 核心设计 | ✅ | 7 级优先级阶梯 + 硬性约束 |
| 不可懒惰领域 | ✅ | 7 个领域定义 |
| 与项目约束关系 | ✅ | 继承规则 + 可关闭配置 |
| 注释标记 | ✅ | `ponytail:` 标记格式 |
| Spec Layer 集成 | ✅ | 根层自动注入 |
| AI Rules 集成 | ✅ | Rules 文件含 Ponytail |
| Phase Guard | ✅ | design_to_build + build_to_verify 已补充 |
| 漂移检测 | ✅ | ponytail_drift 已补充 |
| 错误码 | ✅ | E-PONYTAIL-001 ~ 004 已补充 |
| CLI 命令 | ✅ | 配置项完整，通过 mumuspec check --ponytail 执行 |
| 配置 | ✅ | ponytail.* 配置项 |
| 术语表 | ✅ | Ponytail 阶梯定义 |

**结论**: Ponytail 体系化完备 ✅

### 3.3 工作流 C: 实现路线图细化

#### Phase 1: MVP — Spec + Change + Guard P0 + Rules + AI 工具适配层

**目标**: 树状规范（不含 Ponytail）+ 变更生命周期（不含 TDD 强制）+ Guard P0 漂移 + Rules 生成 + AI 工具适配层

> **Phase 划分说明**: Ponytail 移至 Phase 2；TDD 强制移至 Phase 2（可配置）；漂移检测 P0 部分前置到 Phase 1。

| 任务 ID | 任务 | 优先级 | 依赖 | 估算(人天) |
|---------|------|--------|------|-----------|
| P1-T01 | 规范文件格式定义（spec.md / design.md / prohibitions.md / index.yaml） | P0 | — | 2 |
| P1-T02 | 树状规范加载引擎（渐进式披露，含 spec + design） | P0 | P1-T01 | 2 |
| P1-T03 | CLI 核心命令（init / context / validate / check） | P0 | P1-T02 | 2 |
| P1-T04 | 基础 lint 规则引擎（执行 Enforcement 检查） | P0 | P1-T01 | 2 |
| P1-T05 | 目录级设计文档（design.md）格式与加载引擎 | P1 | P1-T02 | 1 |
| P1-T06 | Rules 文件生成（CLAUDE.md / .cursorrules / AGENTS.md） | P1 | P1-T02 | 1 |
| P1-T07 | 规范继承冲突检测（加载时约束可满足性检查） | P2 | P1-T02 | 1 |
| P1-T08 | 变更状态机（.mumuspec.yaml）+ 五阶段流程（open → design → build → verify → archive） | P0 | — | 3 |
| P1-T09 | 状态机回退机制（基础：build→design, verify→design, verify→build） | P0 | P1-T08 | 2 |
| P1-T10 | delta spec 合并引擎 | P0 | P1-T08 | 2 |
| P1-T11 | 测试用例规格引擎（test-cases/ 定义、锁定、hash 校验） | P0 | P1-T08 | 2 |
| P1-T12 | 决策记录引擎（decisions.md + hash 防篡改） | P0 | P1-T08 | 1 |
| P1-T13 | Phase guard 脚本（正向 + 反向基础回退守卫） | P0 | P1-T08 | 2 |
| P1-T14 | Guard P0 漂移检测（规范漂移 spec_drift） | P0 | P1-T02 | 1 |
| P1-T15 | AI 工具适配层（自动检测 CLAUDE.md / .cursorrules / AGENTS.md 生态并适配） | P1 | P1-T06 | 1 |

**Phase 1 关键路径**: P1-T01 → P1-T02 → P1-T03；P1-T08 → P1-T13
**Phase 1 可并行**: P1-T04 与 P1-T02 并行；P1-T05/T06/T07 与 P1-T08/T09/T10 并行；P1-T14/T15 与 P1-T13 并行
**Phase 1 估算**: 25 人天

#### Phase 2: Ponytail + TDD（可配置）+ 认知框架（可选）+ 回退增强 + 软假设降级 + Guard P1

**目标**: Ponytail 编码约束 + TDD 强制（可配置）+ 认知框架（可选，默认关闭）+ 状态机回退增强 + 软假设降级方案 + Guard P1 漂移检测

> **Phase 划分说明**: Ponytail 从 Phase 1 移入；TDD 强制改为可配置；认知框架改为可选（默认关闭）；Skill Bridge 移至 Phase 3；自建 Skill 编排器与 Hyperplan 移至 Phase 5；新增软假设降级方案；漂移检测 P1 部分前置到本 Phase。

| 任务 ID | 任务 | 优先级 | 依赖 | 估算(人天) |
|---------|------|--------|------|-----------|
| P2-T01 | Ponytail 约束注入引擎（自动注入根层 spec.md） | P0 | P1-T01 | 1 |
| P2-T02 | Ponytail lint 规则（YAGNI 检查、依赖检查、样板代码检测） | P1 | P2-T01, P1-T04 | 2 |
| P2-T03 | `ponytail:` 注释标记解析器 | P1 | P1-T04 | 1 |
| P2-T04 | 红绿 TDD 循环强制执行（可配置，默认开启，可通过 config disable 关闭） | P0 | P1-T11 | 2 |
| P2-T05 | 认知框架引擎（cognitive-map.yaml 验证、收敛逻辑、Q4 扫描，可选，默认关闭） | P1 | P1-T08 | 3 |
| P2-T06 | 认知框架 CLI 命令 + MCP 工具（init/status/validate/converge） | P2 | P2-T05 | 1 |
| P2-T07 | 状态机回退增强（回退快照保存与恢复 + 回退计数上限） | P1 | P1-T09 | 1 |
| P2-T08 | 软假设降级方案（Q4 残留兜底策略 + proposed 知识页面标记） | P1 | P2-T05 | 1 |
| P2-T09 | Guard P1 漂移检测（图谱漂移 + 契约漂移 + 知识漂移 + Ponytail 漂移） | P1 | P1-T14 | 2 |
| P2-T10 | hotfix/tweak 预设路径 | P1 | P1-T13 | 1 |
| P2-T11 | Archive 阶段 git 提交 + MR/PR 创建 + 合并 | P1 | P1-T10 | 1 |
| P2-T12 | 测试套件映射与锁定（suite-map.yaml） | P1 | P1-T11 | 1 |

**Phase 2 关键路径**: P2-T01 → P2-T02；P2-T05 → P2-T08
**Phase 2 可并行**: P2-T02/T03 与 P2-T04/T05 并行；P2-T07/T09/T10/T11/T12 互相并行
**Phase 2 估算**: 17 人天

#### Phase 3: Knowledge 图谱（可插拔后端）+ 知识价值评估 + 契约层 + Skill Bridge + Guard P2

**目标**: 代码图谱（可插拔后端）+ 规范-代码绑定 + 契约层 + LLM-Wiki + PageIndex + 知识 MCP + 知识价值评估 + Skill Bridge + Guard P2 漂移检测

> **Phase 划分说明**: Knowledge 图谱改为可插拔后端（tree-sitter/SQLite 可替换为其他后端），核心图谱工作量从 16 人天调整为 6-8 人天；Skill Bridge 从 Phase 2 移入；新增知识价值评估；漂移检测 P2 部分前置到本 Phase。图谱架构依赖 Phase 1 MVP 范围。

| 任务 ID | 任务 | 优先级 | 依赖 | 估算(人天) |
|---------|------|--------|------|-----------|
| P3-T01 | 代码图谱构建引擎（可插拔后端：tree-sitter → SQLite，后端可替换） | P0 | P1-T02 | 3 |
| P3-T02 | 图谱 Schema 实现（结构/规范/变更/契约/知识节点 + 全部边类型） | P0 | P3-T01 | 2 |
| P3-T03 | 增量索引引擎（仅解析变更文件） | P0 | P3-T01 | 1 |
| P3-T04 | 规范-代码绑定（GOVERNED_BY / ENFORCED_BY 边） | P0 | P3-T02 | 2 |
| P3-T05 | 知识页面格式定义 + PageIndex 引擎（主索引 + 反向索引 + 自动更新） | P0 | — | 2 |
| P3-T06 | 渐进式知识加载（按 scope + 新鲜度筛选） | P0 | P3-T05 | 1 |
| P3-T07 | 代码图谱扩展（KnowledgePage/Decision/Risk 节点 + 知识边） | P0 | P3-T02, P3-T05 | 1 |
| P3-T08 | MCP Server 实现（全部工具） | P0 | P3-T04 | 1 |
| P3-T09 | 影响分析工具（detect_changes）+ 调用链追踪（trace_path） | P1 | P3-T04 | 1 |
| P3-T10 | 契约图谱集成（Contract 节点 + CONSUMES/EXPOSES/CONTRACT_DERIVES 边）+ 约束派生引擎 | P1 | P3-T02 | 2 |
| P3-T11 | 知识 MCP 工具（get_knowledge_context / search_knowledge 等 8 个） | P1 | P3-T06 | 1 |
| P3-T12 | 知识冲突检测引擎（D8 子流程）+ 知识价值评估（freshness/confidence/reuse_score） | P1 | P3-T07 | 1 |
| P3-T13 | Skill Bridge（外部 Skill 生态兼容层 + 阶段-Skill 映射与分发协议） | P1 | P1-T06 | 1 |
| P3-T14 | 契约注册表管理（_registry.yaml）+ 契约漂移检测引擎 | P2 | P3-T10 | 1 |
| P3-T15 | Guard P2 漂移检测（契约漂移 + 知识漂移全量检测） | P2 | P2-T09 | 1 |

**Phase 3 关键路径**: P3-T01 → P3-T02 → P3-T04 → P3-T08
**Phase 3 可并行**: P3-T05/T06 与 P3-T01/T02 并行；P3-T09/T10 与 P3-T11/T12 并行；P3-T13 与图谱任务并行
**Phase 3 估算**: 21 人天（其中核心图谱 P3-T01~T04 共 8 人天，原 16 人天，因可插拔后端方案缩减）

#### Phase 4: CI/CD + 全漂移检测 + 知识提取 + 文档生成

**目标**: Pre-commit + CI/CD pipeline + 全漂移检测集成（P0/P1/P2 合并）+ Archive 知识提取 + 文档生成

> **Phase 划分说明**: 漂移检测的 P0/P1/P2 部分已分散到 Phase 1/2/3，本 Phase 负责将各阶段漂移检测集成到 CI/CD 全链路；知识提取与文档生成保持不变。

| 任务 ID | 任务 | 优先级 | 依赖 | 估算(人天) |
|---------|------|--------|------|-----------|
| P4-T01 | Pre-commit hook（SHALL NOT + Ponytail 快速检查 + 测试不可变性） | P0 | — | 1 |
| P4-T02 | CI/CD pipeline 集成（全量校验 + Ponytail 全量检查） | P0 | P4-T01 | 2 |
| P4-T03 | 全漂移检测引擎集成（合并 P0/P1/P2：规范 + 图谱 + 契约 + 知识 + Ponytail 漂移） | P0 | P1-T14, P2-T09, P3-T15 | 2 |
| P4-T04 | Archive 阶段知识提取子流程（D1-D8） | P0 | P3-T07 | 1 |
| P4-T05 | 图谱自动更新（git hooks） | P1 | P3-T03 | 1 |
| P4-T06 | 文档生成引擎（技术/业务/集成/依赖 4 种文档） | P1 | — | 2 |
| P4-T07 | `mumuspec knowledge` CLI 命令 | P1 | P3-T06 | 1 |
| P4-T08 | 文档模板系统（内置 + 自定义）+ 文档一致性校验 | P2 | P4-T06 | 1 |
| P4-T09 | 多格式输出（Markdown / HTML / PDF）+ 仪表盘可视化 | P2 | P4-T06 | 1 |

**Phase 4 关键路径**: P4-T01 → P4-T02 → P4-T03
**Phase 4 可并行**: P4-T04 与 P4-T06 并行；P4-T05/T07 与 P4-T08/T09 并行
**Phase 4 估算**: 12 人天

#### Phase 5: 自建 Skill 编排器 + Hyperplan + 生态分发

**目标**: 自建 Skill 编排器（阶段编排）+ Hyperplan 对抗式规划 + npm 发布 + 多平台 Skill + 模板库 + 生态分发

> **Phase 划分说明**: 自建 Skill 编排器与 Hyperplan 从 Phase 2 移入（高级能力，非 MVP 必需）；生态分发保持不变。

| 任务 ID | 任务 | 优先级 | 依赖 | 估算(人天) |
|---------|------|--------|------|-----------|
| P5-T01 | 自建 Skill 编排器（7 个阶段 Skill 文件 + 阶段-Skill 映射） | P1 | P1-T06 | 2 |
| P5-T02 | Hyperplan 对抗式规划 Skill（与认知框架双向反馈循环） | P2 | P5-T01, P2-T05 | 2 |
| P5-T03 | npm 包发布（@mumuspec/cli + @mumuspec/mcp-server） | P0 | — | 1 |
| P5-T04 | 多平台 Skill 支持（Claude Code / Cursor / Copilot / Codex） | P1 | P5-T03, P3-T13 | 2 |
| P5-T05 | 规范 + 契约 + Ponytail 约束模板库（常见技术栈预置） | P1 | — | 2 |
| P5-T06 | 知识模板库（常见技术栈预置知识页面） | P2 | — | 1 |
| P5-T07 | Skill 生态插件市场 | P2 | P5-T04 | 1 |
| P5-T08 | 评估系统（Rubric / Pass@k）+ 文档与教程 | P2 | P5-T03 | 1 |

**Phase 5 关键路径**: P5-T03 → P5-T04；P5-T01 → P5-T02
**Phase 5 可并行**: P5-T01/T05/T06 与 P5-T03 并行；P5-T07/T08 依赖前置任务完成
**Phase 5 估算**: 12 人天

#### 工作量汇总

| Phase | 估算(人天) | 关键交付物 |
|-------|-----------|-----------|
| Phase 1 (MVP) | 25 | Spec + Change + Guard P0 + Rules + AI 工具适配层 |
| Phase 2 | 17 | Ponytail + TDD(可配置) + 认知框架(可选) + 回退增强 + 软假设降级 + Guard P1 |
| Phase 3 | 21 | Knowledge 图谱(可插拔) + 知识价值评估 + 契约层 + Skill Bridge + Guard P2 |
| Phase 4 | 12 | CI/CD + 全漂移检测集成 + 知识提取 + 文档生成 |
| Phase 5 | 12 | 自建 Skill 编排器 + Hyperplan + 生态分发 |
| **合计** | **87** | **约 85 人天（含新增任务：AI 工具适配层、知识价值评估、软假设降级方案）** |

#### 任务依赖关系（跨 Phase）

```
Phase 1 (MVP) ─────────────────────────────────────────┬── Phase 2 (Ponytail/TDD/认知框架)
  P1-T01~T07 (Spec)                                     │   P2-T01~T03 (Ponytail) → 依赖 P1-T01/T04
  P1-T08~T13 (Change)                                   │   P2-T04 (TDD) → 依赖 P1-T11
  P1-T14 (Guard P0 漂移)                                │   P2-T05 (认知框架) → 依赖 P1-T08
  P1-T15 (AI 工具适配层)                                │   P2-T09 (Guard P1) → 依赖 P1-T14
                                                        │
                                                        ├── Phase 3 (Knowledge/契约/Skill Bridge)
                                                        │   P3-T01 (图谱架构) → 依赖 P1-T02 (MVP 范围)
                                                        │   P3-T13 (Skill Bridge) → 依赖 P1-T06
                                                        │   P3-T15 (Guard P2) → 依赖 P2-T09
                                                        │
                                                        ├── Phase 4 (CI/CD)
                                                        │   P4-T03 (全漂移) → 依赖 P1-T14 + P2-T09 + P3-T15
                                                        │   P4-T04 (知识提取) → 依赖 P3-T07
                                                        │
                                                        └── Phase 5 (Skill 编排器/Hyperplan)
                                                            P5-T01 (Skill 编排器) → 依赖 P1-T06
                                                            P5-T02 (Hyperplan) → 依赖 P5-T01 + P2-T05
                                                            P5-T04 (多平台) → 依赖 P5-T03 + P3-T13
```

> **关键依赖说明**:
> - **图谱架构 (P3-T01) 依赖 MVP 范围 (P1-T02)**: 代码图谱需要绑定到树状规范，必须在 Phase 1 完成后才能启动。
> - **最小配置 (mumuspec config enable/disable) 依赖各层配置项定义**: config 命令的 feature 开关依赖 Phase 1-3 中各能力层(Spec/Change/Guard/Rules/AI)的配置项定义完成后才能统一实现。详见 [CLI 参考](./reference/cli-commands.md) 的 `mumuspec config` 命令族。

---

## 4. 能力体系化总览

### 4.1 能力闭环矩阵

以下矩阵展示每个能力在 MumuSpec 体系中的完备程度（修复后预期状态）：

| 能力 | 核心设计 | 层间集成 | Phase Guard | 漂移检测 | 错误码 | CLI | MCP | 配置 | 术语表 | 闭环 |
|------|---------|---------|------------|---------|--------|-----|-----|------|--------|------|
| Spec Layer (含 Ponytail) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contract Layer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change Layer | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Knowledge Layer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Guard Layer | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| AI Integration | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 认知框架 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 4.2 层间依赖关系图

```
                    ┌──────────────────────────────────────────────────┐
                    │             AI Integration Layer                  │
                    │  Skills ←→ MCP ←→ Rules ←→ CLI ←→ Hooks          │
                    └────────┬───────────────────────────┬──────────────┘
                             │                           │
                    ┌────────▼────────┐         ┌───────▼────────┐
                    │  Guard Layer    │         │  Change Layer  │
                    │  Pre-commit     │◄────────│  Open→Design   │
                    │  CI/CD          │         │  →Build→Verify │
                    │  Phase Guards   │         │  →Archive      │
                    │  Drift Detect   │         │  + Rollback    │
                    └────────┬────────┘         └───────┬────────┘
                             │                          │
           ┌─────────────────┼──────────────────────────┼──────────────┐
           │                 │                          │              │
    ┌──────▼──────┐  ┌──────▼──────┐          ┌───────▼──────┐ ┌────▼─────┐
    │ Spec Layer  │  │ Contract    │          │ Knowledge    │ │ Cognitive│
    │ SHALL/NOT   │  │ Layer       │          │ Layer        │ │ Framework│
    │ + Ponytail  │  │ Ext + Out   │          │ Graph+Wiki   │ │ Q1-Q4    │
    └──────┬──────┘  └──────┬──────┘          │ +PageIndex   │ │          │
           │                │                 └──────┬───────┘ └────┬─────┘
           │                │                        │              │
           └────────────────┴────────────────────────┘              │
                                    │                               │
                                    └───────────────────────────────┘
                                    图谱双向关联
```

### 4.3 数据流闭环

```
用户需求
  │
  ▼
Open 阶段
  ├── 加载 Spec Layer 规范 (渐进式披露)
  ├── 加载 Knowledge Layer 历史知识 (PageIndex)
  ├── 代码图谱影响分析 (trace_path + detect_changes)
  ├── 加载 Contract Layer 契约 (CONSUMES/EXPOSES)
  └── 产出: proposal.md + delta-specs/ + 影响分析
  │
  ▼
Design 阶段
  ├── 认知框架 Step 0 (Q1 锚定 → Q2 提问 → Q3 推理 → Q4 扫描)
  │   ├── Q1 来源: Spec + Knowledge + Contract + Code Graph
  │   ├── Q3 confirmed → 转化为 SHALL/SHALL NOT
  │   └── Q4 残留 → 兜底策略 + 标记为 proposed 知识页面
  ├── 自顶向下逐层设计 (Level 0 → Level N)
  ├── Hyperplan 对抗审查 (→ 反馈到认知框架)
  ├── 测试用例锁定 (design_locked = true)
  └── 产出: design.md + cognitive-map.yaml + test-cases/ (锁定)
  │
  ▼
Build 阶段
  ├── 自下向上逐层实现 (Layer N → Layer 0)
  ├── 红绿 TDD (Red → Green → Refactor)
  ├── Ponytail 约束合规检查
  ├── 代码图谱增量更新
  └── 产出: 代码提交 + 图谱更新
  │
  ▼
Verify 阶段
  ├── 规范一致性 (SHALL + SHALL NOT + Enforcement)
  ├── 漂移检测 (规范 + 图谱 + 测试 + 契约 + 知识 + Ponytail)
  ├── 知识新鲜度验证
  └── 产出: verify.md (验证报告)
  │
  ▼
Archive 阶段
  ├── Git 合并 (MR/PR + CI 全量检查)
  ├── 规范归档 (delta-specs 合并到主 spec.md)
  ├── 知识提取 (D1-D8: cognitive-map → knowledge pages)
  │   ├── D1-D5: 从变更工件提取知识
  │   ├── D6: 确认 graph_bindings
  │   ├── D7: 更新 PageIndex
  │   └── D8: 检查知识冲突
  └── 清理 (worktree + 槽位释放)
  │
  ▼
持久化知识回流到下一变更的 Open 阶段 ← (闭环)
```

---

## 5. 执行计划

### 5.1 工作流 A 执行顺序

```
A1 (Knowledge 错误码) ──┐
A2 (Ponytail 集成)   ──┤── A4 (文档一致性) ── A5 (遗留清理)
A3 (Roadmap 补充)    ──┘
```

A1、A2、A3 可并行执行，A4 依赖前三者完成后统一修复，A5 最后执行。

### 5.2 工作流 B 执行顺序

B1-B8 可并行执行（纯验证工作），但 B4 (Knowledge) 和 B8 (Ponytail) 依赖工作流 A 的修复完成后才能通过验证。

### 5.3 工作流 C 执行顺序

C1-C5 按顺序执行（Phase 1 → 5），但文档细化可一次性完成。

### 5.4 整体时间线

| 阶段 | 工作流 | 预计耗时 | 交付物 |
|------|--------|---------|--------|
| Step 1 | 工作流 A (文档修复) | 1-2 小时 | 修复后的设计文档 |
| Step 2 | 工作流 B (体系验证) | 0.5 小时 | 能力闭环验证报告 |
| Step 3 | 工作流 C (路线图细化) | 0.5 小时 | 细化的实施路线图 |
| **合计** | | **2-3 小时** | 完整实现计划 |

---

## 6. 验收标准

### 6.1 文档一致性验收

- [x] error-codes.md 包含 KNOWLEDGE 和 PONYTAIL 错误码域
- [x] phase-guards.md 包含 Ponytail 和知识加载守卫检查
- [x] guard-layer.md 包含 Ponytail 执行检查
- [x] drift-detection.md 包含 Ponytail 漂移类型
- [x] roadmap.md 包含认知框架和 Ponytail 实现任务
- [x] glossary.md 无重复术语表
- [x] change-layer.md Open 阶段包含知识加载步骤
- [x] directory-structure.md 包含 audit.log
- [x] code-graph-layer.md 已归档

### 6.2 能力体系化验收

- [x] §4.1 能力闭环矩阵所有能力标记为 ✅
- [x] §4.3 数据流闭环完整（Open → Design → Build → Verify → Archive → 知识回流）
- [x] 每个能力层有完整的：核心设计 + 层间集成 + Phase Guard + 错误码 + CLI + MCP + 配置

### 6.3 实现路线图验收

- [x] Phase 1-5 每个任务有 ID、优先级、依赖、估算
- [x] 关键路径和可并行任务明确标注
- [x] 总工作量估算合理（约 85 人天，含新增任务：AI 工具适配层、知识价值评估、软假设降级方案）
- [x] Phase 划分已按新方案更新（Ponytail→Phase 2，TDD 可配置，认知框架可选，Skill Bridge→Phase 3，自建 Skill 编排器/Hyperplan→Phase 5）
- [x] 漂移检测已分散到 Phase 1(P0)/Phase 2(P1)/Phase 3(P2)
- [x] Knowledge 图谱改为可插拔后端，工作量从 16 人天调整为 8 人天
- [x] 跨 Phase 任务依赖关系已标注（图谱架构依赖 MVP，config 命令依赖各层配置项）

---

> **导航**: [返回概览](overview.md) | [设计文档索引](design.md) | [实施路线图](appendix/roadmap.md)
