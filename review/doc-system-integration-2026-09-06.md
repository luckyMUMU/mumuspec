# 文档体系整合总结报告（2026-09-06）

范围：`.mumuspec/` 全部文档 + `docs/` 34 文件 → 纳入统一体系。基线对照：README.md、`.mumuspec/prd.md`。

## 一、整合前盘点结论

| 区域 | 文档数 | 定位 | 主要问题 |
|------|--------|------|---------|
| `.mumuspec/` 根层（spec/prd/tech/design/goal/env-spec/glossary/prohibitions） | 8 | 约束、需求、实现概览、设计索引、北极星、术语 | design.md 双索引之一；glossary 落后于 docs 版裁定 |
| `.mumuspec/roadmap` + `contracts` + `adr` + `designs-archive` | 22 | 路线图、契约变更记录、ADR、旧设计归档 | designs-archive 位置违反 spec（应在 temp/ 下） |
| `.mumuspec/knowledge/`（decisions/patterns/rationales/risks/lessons/imports） | ~90 | WHY/WHERE 知识层 | KD/KP/KR 快照冻结于 0.12.x 却标 `fresh` |
| `docs/design/`（7 篇）+ `docs/design.md` | 8 | **设计权威**（spec/强度/变更/契约/守卫/知识/AI 集成） | 部分残留旧口径 |
| `docs/overview.md` / `STATUS.md` / `getting-started.md` | 3 | 总览 / 进度权威 / 教程 | overview 含"人工编写 Spec"旧口径；getting-started-agent.md **缺失**（README 引用 404） |
| `docs/reference/`（15 篇） | 15 | 用户参考 | 多篇停留在 0.12.1 口径；`.cursorrules` 仍作为现行方案讲解 |
| `docs/appendix/`（9 篇）+ `standards/` | 10 | 冻结研究报告 / 对外标准提案 | 4 篇未收录进知识层；提案无实现状态标注 |

## 二、变更清单

| # | 文件 | 变更 |
|---|------|------|
| 1 | `docs/overview.md` | 6 处旧口径修正：核心目标与流水线改为人机合著（大模型起草 ⇄ 追问补全 → 人签收 → AI 生成）；一等源文件口径；画像 1 目标；非目标理由；§2.1；新增 §2.7 规则-实现分离（KP-0060）；Worktree 规则对齐 README"配置级推荐" |
| 2 | `docs/design.md` | 定位声明与核心信息流改为人机合著口径 |
| 3 | `docs/reference/glossary.md` | 重写为权威术语表的对外快速入口（分类导航），不再独立维护定义，消除双源 |
| 4 | `.mumuspec/glossary.md` | v1.2→v1.3：合并 docs 版独有的 4 条（Loop Workflow、archive-in-progress 连字符裁定、Hyperplan、Phase Guard 术语裁定） |
| 5 | `docs/getting-started-agent.md` | **新建**（README 引用此前缺失）：Agent QuickStart，对齐 0.19.2 口径（AGENTS.md canonical、hotfix 预设、`--confirm` 归档、workflow.yaml override） |
| 6 | `docs/reference/ai-tools-setup.md` | §2.1 重写为 AGENTS.md canonical 路径；2 处 FAQ 修正（多工具规则文件关系 → canonical + 薄壳） |
| 7 | `docs/reference/faq.md` | Cursor 加载问题改用 AGENTS.md/MCP 路径；prerelease 示例版本更新至 0.19.2-alpha.1 |
| 8 | `docs/reference/configuration.md` | rules_files 示例改为 canonical + 薄壳（注明 C3 禁令）；特性表同步 |
| 9 | `docs/design/ai-integration.md` | 3 处 `.cursorrules` 现行口径 → 遗留禁令 |
| 10 | `docs/design/constraint-strength.md` | Rules 文件描述对齐 canonical 口径 |
| 11 | `docs/design/knowledge-layer.md` | 同上 |
| 12 | `docs/standards/mcp-guard-drift-proposal.md` | 补实现状态注记（内部能力已实现，跨工具 schema 标准化未落地） |
| 13 | `.mumuspec/design.md` | 新增「文档体系职责矩阵」：14 个区域职责与唯一源声明 |

## 三、发现的冲突/偏差及处理方式

| 冲突/偏差 | 处理 |
|-----------|------|
| 术语表双源分叉（canonical 119 条缺新裁定，docs 版 71 条含裁定） | 裁定合并入 canonical（v1.3），docs 版降为薄入口，design.md 矩阵声明唯一源 |
| "人工编写 Spec"旧口径 9 处（overview ×6、design.md ×2、KRA-0004） | overview/design.md 全部修正为人机合著；KRA-0004 为 README 历史快照，属知识层冻结记录，不改源、由"冲突以源文档为准"规则覆盖 |
| `.cursorrules` 作为现行方案 ×8 处（reference ×5、design ×3） | 全部改为 AGENTS.md canonical + 遗留格式禁令口径 |
| README 引用 `getting-started-agent.md` 404 | 新建该文件 |
| 双索引（`.mumuspec/design.md` vs `docs/design.md`） | 职责确认为不同（规范链索引 vs 对外入口），非重复，写入矩阵；"不一致以 docs/design/ 为准"声明保留 |
| knowledge KD/KP/KR 快照过期标 fresh | 不手工改快照（知识层工具管理）；矩阵声明"快照与源文档冲突时以源文档为准"；工具侧修复列入待决策 |
| 版本号示例停留在 0.12.1（packaging/feedback 等） | 属示例/历史记录性质（feedback 表格为历史裁定不可改），仅修正 faq 的"当前版本"表述；全面刷新列入待决策 |

## 四、对照 README/PRD 设计理念核验

| # | 设计理念 | 文档体系核验结果 |
|---|---------|----------------|
| 1 | Spec 即一等源文件（人机合著，KP-0059） | ✅ overview §0/§2.1、design.md 定位、prd.md 一致；getting-started-agent 补充说明 |
| 2 | 双向约束 + 可验证性一等化（E-SPEC-015） | ✅ design/spec-layer.md + constraint-strength.md §9.0（Verifier 前置判定存在且被正确引用） |
| 3 | 树状分布 + 渐进式披露 | ✅ spec-layer.md、glossary、tutorial 一致 |
| 4 | 持久化 + 代码绑定 | ✅ knowledge-layer.md（Code Graph + GOVERNED_BY） |
| 5 | 双维度动态约束强度 | ✅ constraint-strength.md 为唯一设计权威，overview/PRD 摘要与之一致 |
| 6 | 为目标增加限制不限制过程（CHG-5） | ✅ overview §0 核心原则 + prd.md 非目标一致 |
| 7 | 规则-实现分离（KP-0060） | ✅ overview 新增 §2.7；CLI-first §5 与根 spec 一致 |

核验手段：README 全部 13 个文档链接存在性检查 ✓；`mumuspec validate` / `check` 通过 ✓。

## 五、待人工决策事项 → 裁决结果（2026-09-06 逐项决策）

1. **TEMP 规范矛盾** → 裁决：spec 修订而非代码追改。designs-archive 定位为**版本化设计归档目录**（留在 `.mumuspec/` 根级）；temp/ 改为按需创建；TEMP-4 白名单补入 3 个功能性状态文件（constraints.yaml / audit.log / agents-hash.json）。落地：structure-validator 接受 temp/ + spec.md TEMP 块修订，随变更 `doc-governance-decisions`（0.19.2-alpha.8）归档。
2. **glossary 校验器路径** → 裁决：代码指向 canonical。GLOSSARY_MD_REL 改为 `.mumuspec/glossary.md`，测试 fixture 同步，同上变更落地。
3. **knowledge 快照新鲜度** → 裁决：不重导。KD/KP/KR 导入页定位为**历史快照**，与源文档冲突时以源文档为准（`.mumuspec/design.md` 职责矩阵已声明）。快照重导归工具侧 backlog。
4. **appendix 去留** → 裁决：保留 docs/appendix 为冻结研究区（原位），不迁入 knowledge/imports——避免手工制造双源，知识快照只能由工具生成。
5. **reference 版本示例刷新** → 裁决：不全面刷新。0.12.1 均为示例或历史裁定记录，批量替换引入错误风险；"当前版本"类表述保持准确即可（faq 已修）。
6. **standards 提案** → 裁决：维持 Draft + 实现状态注记，不主动推进外部标准化提交。
7. **校准 P0 立项** → 裁决：已创建变更 `p0-calibration-hardening`（full 工作流，Open 阶段），proposal 含剩余 4 项 P0（Capability Tier / loader 硬编码 3 层 / 32KiB 断言 / finalize-archive 四缺口）与 3 个前置决策问题，待设计阶段签收。TEMP 与 GLOSSARY 两项已在本决策轮消解。

### 决策过程新发现

- **rules 刷新无独立命令**：AGENTS.md/agents-hash.json 再生只能经 `mumuspec init`（已初始化目录被拒）。本次以 init 同源函数（generateRulesFiles）完成再生；建议新增 `mumuspec rules sync` 命令（P1 候选，可并入 p0-calibration-hardening）。
- **归档目录移动 EPERM**：Windows 文件锁导致 E-CHANGE-011，且失败残留半成品归档目录（嵌套）。与校准 P0-D"防重跑/原子性"同源，已并入 P0-D 证据。
