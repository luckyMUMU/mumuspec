---
id: "KP-0034"
title: "MumuSpec Skill 设计优化 — 索引与设计原则"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - reference
  - pattern
source: "docs/reference/skills/README.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# MumuSpec Skill 设计优化 — 索引与设计原则

> **Source**: `docs/reference/skills/README.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 层级: Level 2 参考文档 | 版本: 0.11.0-draft | 日期: 2026-07-10

## Original Content

# MumuSpec Skill 设计优化 — 索引与设计原则

> 层级: Level 2 参考文档 | 版本: 0.11.0-draft | 日期: 2026-07-10

本文档是 MumuSpec 原生 Skill 文件的详细设计规范。参考 Comet（五阶段状态机 + 阻塞点 + 上下文恢复）、OpenSpec（工件驱动 + CLI 集成 + 守卫）、Superpowers（技能优先级 + 红旗自检 + 平台适配）三大参考体系的最佳实践，对 7+1 个原生 Skill 进行逐一深入设计优化。

---

## 1. 设计原则（从三大参考体系提炼）

### 1.1 从 Comet 借鉴的核心模式

| 模式 | 说明 | MumuSpec 适配方式 |
|------|------|------------------|
| **Decision Core** | 顶部放置决策核心，Agent 只需读取该部分即可决策 | 每个 Skill 顶部放置"快速决策"区块 |
| **自动阶段检测** | 读取状态文件自动判断当前阶段 | 读取 `.mumuspec.yaml` 的 `phase` + `workflow` |
| **阻塞点标记** | 用户决策点明确标记为 Blocking Point | 统一标注 `BLOCKING POINT` |
| **幂等性** | 所有操作可安全重执行 | 每步标注幂等性保证策略 |
| **上下文压缩恢复** | 长会话上下文丢失后的恢复机制 | 基于工件文件状态恢复 |
| **预设检测优先** | hotfix/tweak 优先于 full 路径检测 | 主编排器中预设检测最高优先级 |
| **升级条件** | 预设路径升级到 full 的明确条件 | 与 Comet 对齐 + 增量条件 |
| **红旗自检** | Agent 自我检查的反模式表 | 每个 Skill 包含 Red Flags 表 |
| **连续执行模式** | 预设路径一次性连续执行 | hotfix/tweak 连续执行 |
| **Domain Skill Hints** | 每阶段标注可选加载的领域 Skill | 保留并增强 |

### 1.2 从 OpenSpec 借鉴的核心模式

| 模式 | 说明 | MumuSpec 适配方式 |
|------|------|------------------|
| **工件驱动** | 每步操作围绕具体工件文件 | 以 `.mumuspec/changes/<name>/` 下工件为核心 |
| **CLI 集成** | `openspec status --json` 获取结构化状态 | `mumuspec status --json` 等命令集成 |
| **守卫栏** | 每步明确标注"不能做什么" | 结合 SHALL/SHALL NOT 约束 |
| **结构化输出** | 每步输出有明确格式 | 保留并增强为 MumuSpec 工件格式 |

### 1.3 从 Superpowers 借鉴的核心模式

| 模式 | 说明 | MumuSpec 适配方式 |
|------|------|------------------|
| **技能优先调用** | 相关 Skill 必须在任何响应前调用 | `required: true` 的 Skill 不可跳过 |
| **技能优先级** | 过程 Skill 优先于实现 Skill | 认知框架 > 对抗审查 > 实现执行 |
| **刚性 vs 柔性** | 区分必须严格遵守和可适配的 Skill | TDD/认知框架为刚性，领域 Skill 为柔性 |
| **用户指令最高** | 用户显式指令始终优先 | 保留在优先级体系第 1 位 |
| **红旗表** | Agent 自我检查的认知偏差 | 每阶段定制 Red Flags |

### 1.4 MumuSpec 独有增强

| 增强 | 说明 | 影响的 Skill |
|------|------|-------------|
| **双向约束守卫** | 外部 Skill 产出必须通过 SHALL/SHALL NOT 校验 | 所有阶段 |
| **认知框架集成** | Q1-Q4 四象限认知框架嵌入 Design | mumuspec-design |
| **知识层加载** | Open 阶段加载历史知识，Archive 提取知识 | open, archive |
| **Ponytail 约束** | 7 级优先级阶梯自动注入，Build 合规检查 | build |
| **代码图谱集成** | 影响分析、调用链验证贯穿全流程 | open, design, verify |
| **渐进式披露** | 按目录层级加载规范 | 所有阶段 |
| **测试不可变性** | Design 锁定后测试用例不可变更 | design, build, verify |
| **契约层集成** | 外部/对外契约约束自动派生 | open, design, verify |
| **回退快照机制** | 回退前保存快照，支持恢复 | build, verify |

---

## 2. Skill 文件清单

| Skill 文件 | 阶段 | 触发方式 | 对标 Comet |
|-----------|------|---------|-----------|
| [mumuspec.md](mumuspec.md) | 主编排器 | `/mumuspec` | comet.md |
| [mumuspec-open.md](mumuspec-open.md) | Phase 1: Open | `/mumuspec-open` | comet-open.md |
| [mumuspec-design.md](mumuspec-design.md) | Phase 2: Design | `/mumuspec-design` | comet-design.md |
| [mumuspec-build.md](mumuspec-build.md) | Phase 3: Build | `/mumuspec-build` | comet-build.md |
| [mumuspec-verify.md](mumuspec-verify.md) | Phase 4: Verify | `/mumuspec-verify` | comet-verify.md |
| [mumuspec-archive.md](mumuspec-archive.md) | Phase 5: Archive | `/mumuspec-archive` | comet-archive.md |
| [mumuspec-hotfix.md](mumuspec-hotfix.md) | 预设: Hotfix | `/mumuspec-hotfix` | comet-hotfix.md |
| [mumuspec-tweak.md](mumuspec-tweak.md) | 预设: Tweak | `/mumuspec-tweak` | comet-tweak.md |

---

## 3. 统一 Skill 结构模板

所有 MumuSpec 原生 Skill 遵循统一结构：

```
1. Frontmatter (name, description, phase, workflow)
2. 快速决策 (Decision Core) — 前置条件摘要、阻塞点清单、退出条件摘要
3. 前置条件 (Prerequisites)
4. 执行步骤 (Steps) — 含外部 Skill 分发点、阻塞点标记、幂等性保证
5. 退出条件 (Exit Conditions)
6. Phase Guard 调用
7. 自动流转到下一阶段
8. 上下文压缩恢复
9. Red Flags 自检表
10. 领域 Skill 提示 (Domain Skill Hints)
```

---

## 4. 优化对比矩阵

| 维度 | 优化前 | 优化后 | 参考来源 |
|------|--------|--------|---------|
| 阻塞点定义 | 仅提及"用户确认" | 明确 BLOCKING POINT + 选项 + 暂停行为 | Comet |
| 幂等性 | 未提及 | 每步标注幂等策略 | Comet |
| 上下文恢复 | 未提及 | 基于工件状态的恢复流程 | Comet |
| 红旗自检 | 未提及 | 每阶段定制 Red Flags 表 | Superpowers |
| Skill 分发协议 | 概要表格 | 详细 on_enter/on_execute/on_exit 配置 | OpenSpec + Comet |
| 认知框架集成 | 仅提及步骤 0 | 完整四阶段递进 + Q1-Q4 输出格式 | MumuSpec 独有 |
| 知识层集成 | 仅提及加载 | 渐进式知识加载 + 新鲜度检查 | MumuSpec 独有 |
| Ponytail 约束 | 仅提及注入 | Build 合规检查 + 漂移检测衔接 | MumuSpec 独有 |
| 契约层集成 | 仅提及加载 | 影响分析 + 兼容性检查 + 约束派生 | MumuSpec 独有 |
| 测试不可变性 | 仅提及锁定 | hash 校验 + 回退解锁 + 套件锁定 | MumuSpec 独有 |
| 领域 Skill 提示 | 未提及 | 每阶段标注可选领域 Skill | Comet + Superpowers |
| 错误处理 | 未提及 | 错误码映射 + 恢复决策树衔接 | Comet + OpenSpec |

---

## 5. 阻塞点全局清单

以下节点在所有工作流中均需用户显式确认，Agent 不可自动决策：

| 编号 | 阻塞点 | 所在阶段 | 适用工作流 |
|------|--------|---------|-----------|
| BP-1 | 需求澄清完成确认 | Open | full |
| BP-2 | PRD 拆分决策 | Open | full |
| BP-3 | 工件审查与确认 | Open | full / hotfix / tweak |
| BP-4 | 设计方案确认 | Design | full |
| BP-5 | 认知框架 Q2 回答 | Design | full |
| BP-6 | 认知框架 Q3 确认 | Design | full |
| BP-7 | Hyperplan 开放问题解决 | Design | full |
| BP-8 | 测试用例锁定确认 | Design | full |
| BP-9 | 计划就绪暂停选择 | Build | full |
| BP-10 | 工作区隔离 + 执行方式 + TDD 模式选择 | Build | full |
| BP-11 | 分支命名确认 | Build | full / hotfix |
| BP-12 | 规范增量更新（中型） | Build | full |
| BP-13 | 范围扩展拆分决策 | Build | full |
| BP-14 | 验证失败修复/接受偏差 | Verify | full / hotfix / tweak |
| BP-15 | Spec 漂移处理 | Verify | full |
| BP-16 | 分支处理方式选择 | Verify | full / hotfix / tweak |
| BP-17 | 归档最终确认 | Archive | full / hotfix / tweak |
| BP-18 | 升级条件触发确认 | 预设路径 | hotfix / tweak |

---

## 6. 状态机字段参考

### .mumuspec.yaml 核心字段

```yaml
# 变更状态
change_name: add-payment-api
phase: design                    # open|design|build|verify|archive|discarded
workflow: full                   # full|hotfix|tweak

# 工件路径
proposal: proposal.md
design_doc: design.md
cognitive_map: cognitive-map.yaml
test_cases_dir: test-cases/
suite_map: suite-map.yaml
tasks: tasks.md
decisions: decisions.md
verify_report: null

# 构建状态
build_layers: []                 # [{layer: 0, status: pending|done}, ...]
build_mode: null                 # executing-plans|subagent-driven-development|direct
build_pause: null                # null|plan-ready
isolation: null                  # branch|worktree
tdd_mode: tdd                    # tdd|direct (固定为 tdd)

# 测试状态
test_cases:
  design_locked: false
  design_content_hash: null
  suites_locked: false
  suites_locked_layers: []

# 认知框架状态
cognitive_framework:
  enabled: false
  mode: full                     # full|incremental
  rounds_completed: 0
  converged: false
  q1_count: 0
  q2_pending: 0
  q3_pending: 0
  q4_scans_completed: 0
  q4_residuals: 0

# 回退状态
rollback_count: 0
rollback_limit: 3
rebuild_count: 0
rebuild_limit: 5

# 影响范围
affected_scopes: []
base_ref: null

# 归档状态
archived: false
verified_at: null
```

