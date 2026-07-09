# 术语表

> 层级: Level 2 参考文档

---

## 核心术语

| 术语 | 英文 | 定义 | 出处 |
|------|------|------|------|
| **规范** | Specification / Spec | 描述系统应满足的约束（SHALL）和不应做的行为（SHALL NOT）的文档 | Spec Layer |
| **SHALL** | SHALL | 强制性正向要求：系统**必须**满足的条件 | RFC 2119 |
| **SHALL NOT** | SHALL NOT | 强制性反向禁止：系统**不得**做的行为 | RFC 2119 |
| **SHOULD** | SHOULD | 推荐性要求：除非有充分理由否则应遵守 | RFC 2119 |
| **MAY** | MAY | 可选行为：由实现者自行决定 | RFC 2119 |
| **Enforcement** | Enforcement | 可执行的检查规则，用于验证 SHALL/SHALL NOT 约束是否被满足 | Spec Layer |
| **漂移** | Drift | 规范描述的约束与代码实际行为不一致 | Guard Layer |
| **渐进式披露** | Progressive Disclosure | 仅加载当前目录及祖先目录的规范，减少 AI 工具的 token 消耗 | Spec Layer |

## 规范层术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **规范层级** | Spec Layer / Level | 规范在目录树中的深度，Level 0 为项目根，数字递增 |
| **规范继承** | Spec Inheritance | 子层规范自动继承父层规范，可收紧但不可放松 |
| **规范树** | Spec Tree | 以目录结构组织的规范层级树 |
| **索引文件** | index.yaml | 记录当前层及子层规范结构的索引 |
| **设计文档** | design.md | 目录级设计决策文档，解释 spec.md 中约束的"为什么" |
| **禁止清单** | prohibitions.md | 反向约束的独立清单，SHALL NOT 条目集合 |
| **Delta Spec** | Delta Spec | 变更过程中对主规范的增量修改描述 |
| **Ponytail 阶梯** | Ponytail Ladder | 7 级优先级编码约束阶梯：YAGNI→复用→标准库→平台特性→已有依赖→一行代码→最小实现 |

## 变更层术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **变更** | Change | 一次有生命周期的规范修改 + 代码实现过程 |
| **阶段** | Phase | 变更生命周期的阶段：Open → Design → Build → Verify → Archive |
| **阶段守卫** | Phase Guard | 阶段转换时自动执行的校验门禁 |
| **回退** | Rollback | 从后序阶段回退到前序阶段（如 Build → Design） |
| **快照** | Snapshot | 阶段转换前的工件备份，用于回退恢复 |
| **预设路径** | Preset Path | 预定义的变更流程：hotfix / tweak / full |
| **单一活跃变更** | Single Active Change | 同一时间只允许一个变更处于活跃状态 |
| **决策日志** | decisions.md | 记录变更过程中的设计决策和回退原因 |
| **测试用例锁定** | Test Cases Lock | Design 阶段结束后测试用例不可变 |
| **不可变性校验** | Immutability Check | 验证测试用例和套件在锁定后未被篡改 |
| **Hyperplan** | Hyperplan | 变更前对抗式设计审查流程，多角色多轮次蒸馏 |

## 知识层术语（含代码图谱）

| 术语 | 英文 | 定义 |
|------|------|------|
| **代码图谱** | Code Graph | 基于代码 AST 构建的知识图谱，知识层的代码结构子组件 |
| **节点** | Node | 图谱中的实体：File / Function / Class / Spec / Contract / Change / KnowledgePage |
| **边** | Edge | 图谱中的关系：CALLS / IMPLEMENTS / GOVERNED_BY / ENFORCED_BY / CONSUMES / EXPOSES / CONTRACT_DERIVES / DECIDED_BY / RISK_DOCUMENTED |
| **规范-代码绑定** | Spec-Code Binding | 通过 GOVERNED_BY/ENFORCED_BY 边连接规范约束与代码实体 |
| **影响分析** | Impact Analysis | 基于 CALLS 边分析代码变更的影响范围 |
| **增量索引** | Incremental Index | 仅解析变更文件的图谱更新方式 |
| **知识页面** | Knowledge Page | LLM-Wiki 中的结构化知识单元，包含元数据和正文 |
| **PageIndex** | PageIndex | 知识页面索引系统，支持按代码路径/图谱节点渐进式加载 |
| **知识图谱集成** | Knowledge-Graph Integration | 知识页面通过 DECIDED_BY/RISK_DOCUMENTED 边与代码图谱节点双向关联 |
| **知识新鲜度** | Knowledge Freshness | 知识页面的验证状态：fresh / stale / unverified |
| **知识提取** | Knowledge Extraction | Archive 阶段从变更工件中提取持久性知识到全局知识库的子流程 |
| **反向索引** | Reverse Index | 从代码图谱节点到知识页面的反向映射 |
| **知识漂移** | Knowledge Drift | 知识页面内容与代码实际行为不一致 |

## 契约层术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **外部契约** | External Contract | 描述本服务依赖的外部服务接口约束 |
| **对外契约** | Outbound Contract | 描述本服务对外暴露的接口约束 |
| **契约派生** | Contract Derivation | 从契约自动派生规范约束并注入 spec.md |
| **契约注册表** | Contract Registry | _registry.yaml，记录所有契约文件的元数据 |
| **稳定性级别** | Stability Level | 契约的稳定性标记：stable / beta / deprecated |
| **向后兼容性** | Backward Compatibility | 新版契约不破坏已有消费者 |

## 校验层术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **Pre-commit 校验** | Pre-commit Check | Git 提交前的快速校验（仅 SHALL NOT） |
| **CI 校验** | CI Check | CI pipeline 中的全量规范校验 |
| **Phase Guard** | Phase Guard | 阶段转换时的工件完整性 + 规范合规性校验 |
| **错误码** | Error Code | `E-<DOMAIN>-<NUMBER>` 格式的结构化错误标识 |

## AI 集成术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **Skill 文件** | Skill File | 标准化的 AI 行为指令文件（SKILL.md） |
| **Skill Bridge** | Skill Bridge | 将 MumuSpec 规范转换为 AI 工具可理解指令的桥接层 |
| **Rules 文件** | Rules File | AI 工具的规则配置文件（CLAUDE.md / .cursorrules / AGENTS.md） |
| **MCP Server** | MCP Server | Model Context Protocol 服务器，为 AI 工具提供图谱查询等能力 |
| **Skill 生态矩阵** | Skill Ecosystem Matrix | AI 工具 × MumuSpec 功能的支持矩阵 |

## 认知框架术语

| 术语 | 英文 | 定义 |
|------|------|------|
| **认知框架** | Cognitive Framework | Design 阶段的系统化认知方法，基于乔哈里窗变体 |
| **乔哈里窗** | Johari Window | 四象限认知模型，将信息分为 Q1-Q4 四个象限 |
| **Q1** | Known Knowns | 已知的已知 — Agent 和用户共同掌握的信息，推理地基 |
| **Q2** | Known Unknowns | 已知的未知 — Agent 明确缺失的信息，需提问补全 |
| **Q3** | Unknown Knowns | 未知的已知 — Agent 推导出的隐性需求，需用户确认 |
| **Q4** | Unknown Unknowns | 未知的未知 — 盲区，通过扫描发现或写入兜底策略 |
| **认知地图** | Cognitive Map | cognitive-map.yaml，记录四象限状态和演化历史 |
| **认知收敛** | Cognitive Convergence | Q2/Q3 全部处理完毕，认知地图达到稳定状态 |
| **推理链** | Reasoning Chain | Q3 推导的格式化表达：Q1[编号] + Q1[编号] → Q3: 结论 |
| **盲区扫描** | Blind Spot Scanning | Q4 阶段的主动扫描，覆盖 8 个维度的潜在风险 |
| **兜底策略** | Fallback Strategy | Q4 残留风险的缓解措施：监控兜底/测试兜底/回退兜底/降级兜底 |

---

> **导航**: [← 发布策略](release-strategy.md) | [返回概览](../overview.md)
