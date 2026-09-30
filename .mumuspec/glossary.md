---
layer: 0
scope: "."
last_updated: "2026-09-06"
type: glossary
version: "1.3"
---

# MumuSpec 通用语言术语速查表

> 本文件是 MumuSpec 项目的**权威术语参考**（类似 DDD 的 Ubiquitous Language），所有文档、代码注释、沟通均应使用本表定义的统一术语。

---

## 1. 核心约束关键词（RFC 2119）

| 术语 | 英文 | 定义 |
|------|------|------|
| **必须** | SHALL | 强制性正向要求：系统**必须**满足的条件 |
| **禁止** | SHALL NOT | 强制性反向禁止：系统**不得**做的行为 |
| **应当** | SHOULD | 推荐性要求：除非有充分理由否则应遵守 |
| **可以** | MAY | 可选行为：由实现者自行决定 |
| **强制执行** | Enforcement | 可执行的检查规则，用于验证 SHALL/SHALL NOT 约束是否被满足 |

---

## 2. 规范层（Spec Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **规范** | Specification / Spec | 描述系统应满足的约束（SHALL）和不应做的行为（SHALL NOT）的文档 |
| **规范层级** | Spec Layer / Level | 规范在目录树中的深度，Level 0 为项目根，数字递增 |
| **规范继承** | Spec Inheritance | 子层规范自动继承父层规范，可收紧但不可放松 |
| **规范树** | Spec Tree | 以目录结构组织的规范层级树 |
| **渐进式披露** | Progressive Disclosure | 仅加载当前目录及祖先目录的规范，减少 AI 工具的 token 消耗 |
| **索引文件** | index.yaml | 记录当前层及子层规范结构的索引 |
| **设计文档** | design.md | 目录级设计决策文档，解释"为什么" |
| **产品需求文档** | prd.md | 目录级产品视角需求描述 |
| **技术文档** | tech.md | 目录级技术视角实现描述 |
| **禁止清单** | prohibitions.md | 反向约束的独立清单，SHALL NOT 条目集合 |
| **Delta Spec** | Delta Spec | 变更过程中对主规范的增量修改描述 |
| **契约派生** | Contract Derivation | 从契约自动派生规范约束并注入 spec.md |
| **Ponytail 阶梯** | Ponytail Ladder | 7 级优先级编码约束阶梯：YAGNI→复用→标准库→平台特性→已有依赖→一行代码→最小实现 |
| **零依赖模块** | Zero-Dependency Module | 除 Node.js 标准库外不引入任何外部 npm 依赖的模块 |

### Ponytail 7 级优先级阶梯

| 级别 | 问题 | 行动 |
|------|------|------|
| P1 | 这段代码需要存在吗？ | YAGNI — 不需要则不写 |
| P2 | 代码库中已有实现吗？ | 复用 — 找到并使用已有代码 |
| P3 | 标准库已经提供了吗？ | 使用标准库 — 不引入外部依赖 |
| P4 | 平台原生特性支持吗？ | 使用平台特性 — 不引入 polyfill |
| P5 | 已安装的依赖能做吗？ | 使用已有依赖 — 不引入新依赖 |
| P6 | 能一行写完吗？ | 一行代码 — 不过度抽象 |
| P7 | 以上都不满足 | 最小可工作代码 — 仅写必要的 |

---

## 3. 变更层（Change Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **变更** | Change | 一次有生命周期的规范修改 + 代码实现过程 |
| **阶段** | Phase | 变更生命周期的阶段：Open → Design → Build → Verify → Archive |
| **阶段守卫** | Phase Guard | 阶段转换时自动执行的校验门禁 |
| **回退** | Rollback | 从后序阶段退到前序阶段（如 Build → Design） |
| **快照** | Snapshot | 阶段转换前的工件备份，用于回退恢复 |
| **预设路径** | Preset Path | 预定义的变更流程：hotfix / tweak / full |
| **热修复** | Hotfix | 快速 Bug 修复路径，跳过 Design 阶段直接 Build |
| **微调** | Tweak | 文案/配置/文档微小调整路径 |
| **循环迭代** | Loop Workflow | 预设路径之一：直入 build 阶段、跳过 open/design 的循环迭代路径，适用于探索性任务与反复调优 |
| **归档进行中** | archive-in-progress | 变更进入归档阶段的进行中状态标识；规范写法为连字符 `archive-in-progress`（区别于旧写法 `archive-inprogress`） |
| **Hyperplan** | Hyperplan | 变更前对抗式设计审查流程，多角色多轮次蒸馏 |
| **单一活跃变更** | Single Active Change | 同一作用域只允许一个变更处于活跃状态 |
| **决策日志** | decisions.md | 记录变更过程中的设计决策和回退原因 |
| **测试用例锁定** | Test Cases Lock | Design 阶段结束后测试用例不可变 |
| **不可变性校验** | Immutability Check | 验证测试用例和套件在锁定后未被篡改 |
| **范围溢出** | Scope Overflow | 变更的影响范围超出当前目录子树 |
| **构建模式** | Build Mode | Build 阶段的执行方式：executing-plans / subagent-driven-development / direct |
| **构建暂停** | Build Pause | Build 阶段在 plan-ready 时暂停等待用户选择 |
| **隔离策略** | Isolation | 变更隔离方式：branch（分支）或 worktree（工作树） |

> **阶段守卫（Phase Guard）术语裁定**：统一使用"阶段守卫"指代 Phase Guard；"门禁"仅保留用于非 Phase Guard 的确认点（如 BP 用户确认门禁），二者不再互指。"守卫"不单独指代 Phase Guard，避免互指歧义。

### 阶段状态流转

```
Open → Design → Build → Verify → Archive
  ↕        ↕       ↕       ↕
  └────────┴───────┴───────┘（允许回退）
```

---

## 4. 知识层（Knowledge Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **代码图谱** | Code Graph | 基于代码 AST 构建的知识图谱 |
| **节点** | Node | 图谱中的实体：File / Function / Class / Spec / Contract / Change / KnowledgePage |
| **边** | Edge | 图谱中的关系：CALLS / IMPLEMENTS / GOVERNED_BY / ENFORCED_BY / CONSUMES / EXPOSURES / CONTRACT_DERIVES / DECIDED_BY / RISK_DOCUMENTED |
| **规范-代码绑定** | Spec-Code Binding | 通过 GOVERNED_BY/ENFORCED_BY 边连接规范约束与代码实体 |
| **影响分析** | Impact Analysis | 基于 CALLS 边分析代码变更的影响范围 |
| **增量索引** | Incremental Index | 仅解析变更文件的图谱更新方式 |
| **知识页面** | Knowledge Page | LLM-Wiki 中的结构化知识单元，包含元数据和正文 |
| **PageIndex** | PageIndex | 知识页面索引系统，支持渐进式加载 |
| **知识新鲜度** | Knowledge Freshness | 知识页面的验证状态：fresh / stale / unverified |
| **知识提取** | Knowledge Extraction | Archive 阶段从变更工件中提取持久性知识的过程 |
| **反向索引** | Reverse Index | 从代码图谱节点到知识页面的反向映射 |
| **知识漂移** | Knowledge Drift | 知识页面内容与代码实际行为不一致 |

---

## 5. 契约层（Contract Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **外部契约** | External Contract | 描述本服务依赖的外部服务接口约束 |
| **对外契约** | Outbound Contract | 描述本服务对外暴露的接口约束 |
| **契约注册表** | Contract Registry | 记录所有契约文件元数据的 _registry.yaml |
| **稳定性级别** | Stability Level | 契约的稳定性标记：stable / beta / deprecated |
| **向后兼容性** | Backward Compatibility | 新版契约不破坏已有消费者 |
| **契约快照** | Contract Snapshot | 某一时刻契约状态的序列化记录（存于 contracts/schemas/） |

---

## 6. 校验与同步层（Validation & Sync Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **漂移** | Drift | 规范描述的约束与代码实际行为不一致 |
| **漂移检测** | Drift Detection | 自动检测规范与代码之间不一致的过程 |
| **规范同步** | Sync | 将代码实际结构同步回规范文件的过程（`mumuspec sync`） |
| **同步检查** | Sync Check | 干跑模式，仅报告漂移不写文件（`--check`） |
| **同步迁移** | Sync Migrate | 检测旧格式结构并输出迁移计划（`--migrate`） |
| **Pre-commit 校验** | Pre-commit Check | Git 提交前的快速校验（仅 SHALL NOT） |
| **CI 校验** | CI Check | CI pipeline 中的全量规范校验 |
| **错误码** | Error Code | `E-<DOMAIN>-<NUMBER>` 格式的结构化错误标识 |

---

## 7. 代码审查层（Review Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **模块审查** | Module Review | 基于 7 维度的模块健康度评分（`mumuspec review`） |
| **维度** | Dimension | 审查的评价方向，共 7 个（D1-D7） |
| **模块分** | Module Score | 模块在 7 维度上的加权总分 |
| **整体均值** | Overall Average | 所有模块分的算数平均值 |

### 7 维度评价模型

| 编号 | 维度名称 | 评价重点 |
|------|---------|---------|
| D1 | 规范层一致性 | SHALL/SHALL NOT 约束与代码实现是否一致 |
| D2 | 契约层完整性 | 契约文件是否完整、是否注册、是否有快照 |
| D3 | 架构层依赖 | 模块间依赖方向是否正确、是否有循环 |
| D4 | 工作流完整性 | index.ts + BOUNDARY.md 章节完备性 |
| D5 | 类型系统 | 类型定义覆盖率、any 使用、strict 模式合规 |
| D6 | 测试覆盖度 | 测试数量与质量（4+ 测试 = 满分） |
| D7 | 文档同步 | 文档与代码同步状态、注释覆盖率 |

---

## 8. AI 集成层（AI Integration Layer）

| 术语 | 英文 | 定义 |
|------|------|------|
| **Skill 文件** | Skill File | 标准化的 AI 行为指令文件（SKILL.md） |
| **Skill Bridge** | Skill Bridge | 将 MumuSpec 规范转换为 AI 工具可理解指令的桥接层 |
| **Rules 文件** | Rules File | AI 工具的规则配置文件（CLAUDE.md / .cursorrules / AGENTS.md） |
| **MCP Server** | MCP Server | Model Context Protocol 服务器，为 AI 工具提供图谱查询等能力 |
| **编排器** | Orchestrator | 主编排 Skill，负责阶段检测和分发 |
| **阶段 Skill** | Phase Skill | 各阶段的具体执行 Skill（phase-open / design / build / verify / archive） |
| **Worktree 隔离** | Worktree Isolation | 通过 git worktree 实现变更环境隔离 |

---

## 9. 认知框架（Cognitive Framework）

| 术语 | 英文 | 定义 |
|------|------|------|
| **认知框架** | Cognitive Framework | Design 阶段的系统化认知方法，基于乔哈里窗变体 |
| **乔哈里窗** | Johari Window | 四象限认知模型，将信息分为 Q1-Q4 |
| **已知的已知** | Q1 / Known Knowns | Agent 和用户共同掌握的信息，推理地基 |
| **已知的未知** | Q2 / Known Unknowns | Agent 明确缺失的信息，需提问补全 |
| **未知的已知** | Q3 / Unknown Knowns | Agent 推导出的隐性需求，需用户确认 |
| **未知的未知** | Q4 / Unknown Unknowns | 盲区，通过扫描发现或写入兜底策略 |
| **认知地图** | Cognitive Map | cognitive-map.yaml，记录四象限状态和演化历史 |
| **认知收敛** | Cognitive Convergence | Q2/Q3 全部处理完毕，认知地图达到稳定状态 |
| **推理链** | Reasoning Chain | Q3 推导的格式化表达：Q1[编号] + Q1[编号] → Q3: 结论 |
| **盲区扫描** | Blind Spot Scanning | Q4 阶段的主动扫描，覆盖多维度潜在风险 |
| **兜底策略** | Fallback Strategy | Q4 残留风险的缓解措施 |

---

## 10. Loop 模式（Loop Mode）

| 术语 | 英文 | 定义 |
|------|------|------|
| **循环** | Loop | Plan → Act → Evaluate 迭代执行模式 |
| **轮次** | Round | Loop 的一次完整迭代 |
| **Grill 验证** | Grill | Loop 前的压力测试验证，确保 Goal 可行、Criteria 可测 |
| **目标** | Goal | Loop 要达成的明确、可验证状态 |
| **收敛标准** | Convergence Criteria | 判断 Loop 目标达成的客观条件 |
| **停滞检测** | Stagnation Detection | 连续 2 轮无进展时自动警告 |
| **收敛状态** | Converged | Loop 目标达成（progress ≥ 0.85） |
| **耗尽状态** | Exhausted | Loop 达到最大轮次限制 |
| **阻塞状态** | Blocked | Loop 等待用户输入 |
| **轮次计划** | Round Plan | 每轮的工作计划（`mumuspec loop round`） |
| **轮次行动** | Round Action | 每轮中执行的具体操作 |
| **轮次评估** | Round Evaluation | 每轮完成后的进度评估 |

### Loop 状态流转

```
plan → act → evaluate → commit → (next round)
              ↓
         converged / exhausted / blocked
```

---

## 11. Roadmap 层

| 术语 | 英文 | 定义 |
|------|------|------|
| **路线图** | Roadmap | 近期目标管理系统，管理跨模块的项目目标 |
| **目标条目** | Roadmap Item | 独立的近期目标单元（`R-<NNNN>.md`） |
| **条目 ID** | Item ID | 唯一标识，格式 `R-<NNNN>`（4 位零填充序号） |
| **容量预算** | Capacity Budget | 防止过度承诺的限制机制 |
| **优先级** | Priority | 三级分类：P0（必须）/ P1（应当）/ P2（可延后） |
| **依赖** | depends_on | 条目间的有向依赖关系（DAG） |
| **互斥** | mutex_with | 两个条目不可同时 active 的声明 |
| **完成标准** | DoD / Definition of Done | 条目完成的验证条件 |

### Item 状态流转

```
planning → planned → active → completed
   ↓          ↓        ↓
deprecated  blocked  deprecated
              ↓
          planned（解除阻塞后）
```

---

## 12. Drift 与错误码体系

### 错误码格式

```
E-<DOMAIN>-<NUMBER>
```

| 域名 | 含义 | 示例 |
|------|------|------|
| SPEC | 规范校验 | E-SPEC-004: Requirement 缺少 Enforcement |
| CHANGE | 变更管理 | E-CHANGE-006: 未知目标阶段 |
| DESIGN | 设计阶段 | W-DESIGN-001: cognitive-map.yaml 不存在 |
| GUARD | 守卫层 | E-GUARD-003: 阶段约束违规 |
| CONTRACT | 契约层 | E-CONTRACT-002: 契约引用不存在 |

### 常见 Drift 类型

| 类型 | 说明 |
|------|------|
| 规范-代码漂移 | 代码实现违反了规范约束 |
| 文档-代码漂移 | 文档描述与代码实际行为不一致 |
| 契约漂移 | 对外接口行为与契约描述不一致 |
| 知识漂移 | 知识页面内容与代码实际状态不一致 |

---

## 13. 边界与工件速查

### 目录边界文档

| 文件 | 用途 |
|------|------|
| `BOUNDARY.md` | 记录目录对外接口、依赖声明、数据契约、变更日志 |
| `_index.yaml` | PageIndex 知识页面索引 |
| `index.yaml` | 规范树结构索引 |
| `config.yaml` | 项目级 MumuSpec 配置 |
| `glossary.md` | 项目通用语言术语速查表（权威术语参考） |
| `temp/` | 临时文件唯一合法存放处（不纳入 git） |

### 变更工件

| 文件 | 阶段 | 用途 |
|------|------|------|
| `proposal.md` | Open | 变更提案 |
| `cognitive-map.yaml` | Open/Design | 认知四象限地图 |
| `design.md` | Design | 技术设计方案 |
| `test-cases/` | Design | 测试用例集 |
| `tasks.md` | Build | 实现任务列表 |
| `verify.md` | Verify | 验证报告 |
| `decisions.md` | 全程 | 设计决策日志 |

---

## 14. 缩写与简写

| 缩写 | 全称 | 含义 |
|------|------|------|
| YAGNI | You Aren't Gonna Need It | 不需要就不写 |
| TDD | Test-Driven Development | 测试驱动开发（Red-Green） |
| DoD | Definition of Done | 完成标准 |
| DAG | Directed Acyclic Graph | 有向无环图 |
| AST | Abstract Syntax Tree | 抽象语法树 |
| MCP | Model Context Protocol | 模型上下文协议 |
| ADR | Architecture Decision Record | 架构决策记录 |
| `Q1-Q4` | Quadrant 1-4 | 认知框架四象限 |

---

## 15. 归档与清理术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **临时目录** | Temp Directory | `.mumuspec/temp/`，存放非规范文件、运行时日志、测试样本、迁移过渡文件的唯一合法位置 |
| **归档清理** | Archive Cleanup | finalize-archive 阶段整理 temp/ 内容并清理的过程 |
| **知识导入** | Knowledge Import | 从 temp/ 中筛选有价值内容迁移至 knowledge/ 对应分类的操作 |
| **白名单根文件** | Root File Whitelist | `.mumuspec/` 根目录允许存放的非目录型规范文件清单：spec.md / prd.md / tech.md / goal.md / env-spec.md / prohibitions.md / glossary.md / index.yaml / config.yaml |
| **归档归档** | Archive Clean State | 归档完成后 temp/ 为空或仅保留待确认内容（DoD 之一） |

---

## 16. 能力分层（Capability Tier）

| 术语 | 英文 | 定义 |
|------|------|------|
| **通用基础能力** | General Capability | 灵活、可组合、支持探索的低风险操作层级，无副作用，无需显式确认即可执行 |
| **专用工具** | Dedicated Tool | 严格约束、高风险或强业务规则的操作层级，必须经过守门流程 |
| **能力分层** | Capability Tier / Layering | 根据风险等级和业务规则强度将系统能力划分为 general 和 dedicated 两层的模型 |
| **守门流程** | Guard Flow | 专用工具的标准化执行流程：前置校验 → 影响预览 → 显式确认 → 执行 → 后置验证 → 报告 |
| **二次确认** | Secondary Confirmation | 不可逆操作前要求用户输入关键标识（如变更名称）以确认意图的安全机制 |
| **不可逆操作** | Irreversible Operation | 执行后无法回滚或回滚成本极高的操作（archive / discard / force overwrite） |
| **能力元数据** | CommandMetadata | 每个命令自描述其能力层级的接口，包含 `tier` / `risk` / `confirmRequired` / `reversible` / `composable` 字段 |
| **能力自描述** | Capability Self-Description | 命令通过 `mumuspec capability <cmd>` 查询自身属性的机制 |
| **组合自由度** | Composition Freedom | 通用能力之间自由编排的灵活程度（链式 / 并行 / 迭代 / 重试） |
| **能力切换** | Capability Switch | 从通用能力组合过渡到专用工具执行时必须经过的用户确认边界 |
| **影响预览** | Impact Preview | 专用工具执行前展示变更范围的 dry-run 报告（diff 格式） |

### 能力判定标准

| 维度 | 通用基础能力 | 专用工具 |
|------|-------------|----------|
| 可逆性 | 可逆或幂等 | 不可逆或回滚成本高 |
| 影响范围 | 仅当前上下文 | 项目全局或多个模块 |
| 用户确认 | 可选（默认跳过） | 强制显式确认 |
| 组合自由度 | 高（可自由编排） | 低（预设流程，不可跳转） |
| 错误容忍 | 可重试、无副作用 | 错误需人工介入 |

### 能力流转模型

```
用户请求
    │
    ▼
能力路由器 ──► 通用基础能力（直接执行 / 自由组合）
    │
    └──► 专用工具（守门流程：校验 → 确认 → 执行 → 验证）
```

> **维护规则**：新增术语必须经过团队共识，更新本表后同步更新代码注释与文档中的对应表述。禁止在不同文档中对同一术语赋予不同含义。
