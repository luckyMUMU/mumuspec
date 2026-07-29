# Skill 生态参考

> 层级: Level 2 参考文档

---

> Skill 生态按 Phase 分阶段实现。Phase 1 仅 Rules 文件生成 + AI 工具适配层,Phase 3 实现 Skill Bridge,Phase 5 实现自建 Skill 编排器与 Hyperplan。

## 1. 设计原则

- **MumuSpec 管 WHAT**：通过 SHALL/SHALL NOT 定义做什么、不做什么
- **外部 Skill 管 HOW**：通过工作流方法指导怎么做
- **约束守卫兜底**：外部 Skill 产出必须通过 MumuSpec 约束校验，SHALL NOT 违规则阻断

## 2. 兼容的 Skill 生态

| 生态 | 来源 | dispatch_mode | 说明 |
|------|------|--------------|------|
| Superpowers | `~/.claude/skills/` | deep | 深度集成（TDD、调试、验证等） |
| Agent Skills | `~/.agents/skills/` | deep | 全生命周期覆盖 |
| Comet | `~/.claude/skills/comet/` | interop | 状态机层互操作 |
| Codex | `~/.codex/skills/` | platform | 平台适配（按需启用） |
| Custom | 项目 `.mumuspec/skills/custom/` | — | 可插拔扩展 |

## 3. 阶段-Skill 映射表

### Phase 1: Open

| 子步骤 | 外部 Skill | required | 约束守卫 |
|--------|-----------|----------|---------|
| 需求探索 | `brainstorming`, `interview-me` | true / false | 必须完成 brainstorming（hotfix/tweak 除外） |
| 影响分析 | `gitnexus-exploring`, `gitnexus-impact-analysis` | true | 结果记录到 impact-analysis.json |
| 规范草案 | `spec-driven-development` | true | delta-specs 必须含 SHALL 和 SHALL NOT |
| 工作区隔离 | `using-git-worktrees` | true | 必须创建 worktree（或记录降级） |

### Phase 2: Design

| 子步骤 | 外部 Skill | required | 约束守卫 |
|--------|-----------|----------|---------|
| 认知框架 | `brainstorming`, `interview-me` | true (full) | cognitive-map.yaml 存在且收敛 |
| 设计探索 | `brainstorming` | true | 自顶向下逐层细化 |
| 对抗审查 | `hyperplan` | conditional | 复杂变更必须触发（见 §5） |
| 接口设计 | `api-and-interface-design` | false (has_api_layer) | 符合各层 SHALL/SHALL NOT |
| 安全约束 | `security-and-hardening` | false | 安全 SHALL NOT 必须有 Enforcement |
| 性能约束 | `performance-optimization` | false | 性能约束必须可测量 |
| 决策记录 | `documentation-and-adrs` | true (on_exit) | 关键决策记录到 design.md |
| 测试用例 | `test-case-design` | true | 每层 cases.md；基于 hyperplan 硬约束；完成后锁定 |

### Phase 3: Build

| 子步骤 | 外部 Skill | required | 约束守卫 |
|--------|-----------|----------|---------|
| 实现计划 | `writing-plans` | true (tasks.md not exists) | 按 build_layers 从叶子到根排序 |
| 上下文管理 | `context-engineering` | true | 使用渐进式披露加载规范 |
| 源码验证 | `source-driven-development` | false | 依赖框架的代码必须有文档引用 |
| TDD 实现 | `test-driven-development` | true | tdd_mode 固定 tdd，不可跳过 |
| 执行方式 | `executing-plans` / `subagent-driven-development` | true | 执行方式记录到 .mumuspec.yaml |
| 调试修复 | `systematic-debugging` | false | 调试不能违反 SHALL NOT |
| 疑虑驱动 | `doubt-driven-development` | false | 不可逆操作必须经过审查 |

### Phase 4: Verify

| 子步骤 | 外部 Skill | required | 约束守卫 |
|--------|-----------|----------|---------|
| 完成验证 | `verification-before-completion` | true | 必须有验证证据 |
| 代码审查 | `requesting-code-review` | true | 审查覆盖 SHALL/SHALL NOT |
| 接收反馈 | `receiving-code-review` | true | 反馈处理不违反规范 |
| 回退决策 | `systematic-debugging` | false | 回退必须用户确认 + 保存快照 |

### Phase 5: Archive

| 子步骤 | 外部 Skill | required | 约束守卫 |
|--------|-----------|----------|---------|
| 分支完成 | `finishing-a-development-branch` | true | 合并策略必须用户确认 |
| CI/CD 集成 | `ci-cd-and-automation` | true | CI 必须含全量检查 |
| 文档归档 | `documentation-and-adrs` | true (on_exit) | 归档含完整变更记录 |
| 发布准备 | `shipping-and-launch` | false | — |

### 横切关注点

| 关注点 | Skill | 触发时机 |
|--------|-------|---------|
| 工作区隔离 | `using-git-worktrees` | 所有阶段 |
| 上下文优化 | `context-engineering` | 会话开始/切换/降级 |
| 代码简化 | `code-simplification` | 实现完成后 |
| 废弃迁移 | `deprecation-and-migration` | 涉及移除旧系统时 |

## 4. Skill 分发协议

每个阶段 Skill 文件包含 `skill_dispatch` 配置：

```yaml
skill_dispatch:
  on_enter:                        # 进入阶段时分发（按序执行）
    - skill: context-engineering
      purpose: "加载规范上下文"
      required: true
    - skill: writing-plans
      purpose: "创建实现计划（消费 hyperplan_result）"
      required: true
      condition: "tasks.md not exists"

  on_execute:                      # 阶段执行中按需分发
    - skill: test-driven-development
      purpose: "TDD 循环（红绿重构）"
      required: true               # tdd_mode 固定，始终 required
    - skill: source-driven-development
      purpose: "基于官方文档验证"
      required: false
      condition: "使用框架"

  on_exit:                         # 阶段退出时分发
    - skill: verification-before-completion
      purpose: "验证所有层完成"
      required: true
    - skill: documentation-and-adrs
      purpose: "追加 decisions.md"
      required: true
```

**分发流程**：on_enter 按序执行 → 检查 Skill 可用性（required=true 不可用则阻断） → 约束守卫检查 → on_execute 条件分发 → 阶段核心逻辑 → on_exit 按序执行 → 阶段守卫检查 → 转换阶段。

## 5. Hyperplan 对抗式规划 Skill

### 核心定位

在 Design 阶段的 brainstorming 之后、test-cases/ 编写之前触发。通过 5 个敌对 critic 从正交角度交叉攻击设计方案，仅将通过对抗审查的洞察纳入最终设计。提取自 oh-my-openagent (OmO) 项目的 `/hyperplan` 命令。

### 触发条件（唯一定义处）

满足以下**任一**条件即触发：
- `affected_scopes.length >= 3`（多层级变更）
- `delta-specs` 引入新的 SHALL NOT
- `workflow == "full"`

**跳过条件**：hotfix/tweak 工作流，或不满足上述条件。

> hotfix/tweak 虽跳过 hyperplan，仍须在 Open 阶段定义并锁定单层 test-cases/（hyperplan 不豁免 TDD 规则）。

### 5 个对抗角色

| 角色 | category | 定位 | 攻击向量 | MumuSpec 衔接 |
|------|----------|------|----------|--------------|
| **skeptic** | `unspecified-low` | 实用主义怀疑者 | 过度工程、过早抽象、范围蔓延 | 过度工程的 SHALL NOT 建议移除 |
| **validator** | `unspecified-high` | 集成测试者 | 遗漏边界场景、跨模块破坏 | 遗漏场景补强为 SHALL NOT |
| **researcher** | `deep` | 自主研究者 | 无证据断言、未验证假设 | 无证据的 SHALL 须有文档引用 |
| **architect** | `ultrabrain` | 架构策略家 | 糟糕架构、隐藏耦合 | 架构 SHALL/SHALL NOT 须审查 |
| **creative** | `artistry` | 创意挑战者 | 正统思维、接受首选项 | 替代方案若更优则改写 SHALL |

**researcher 降级**：`deep` category 不可用时，降级为 4 角色团队（移除 researcher），`hyperplan_result.degraded = true`。4 个核心角色不可移除。

### 7 阶段执行流程

| Phase | 动作 | MumuSpec 衔接 |
|-------|------|--------------|
| 0 — 确认请求 | Lead 确认触发条件，声明 "HYPERPLAN MODE ENABLED" | 读取 affected_scopes、workflow、delta-specs |
| 1 — 创建对抗团队 | 通过 subagent-driven-development 创建 5 成员团队 | subagent 可读取 design.md 草案与 delta-specs |
| 2 — Round 1 独立分析 | 每成员产出 3-7 条发现（须引用 design.md 行号） | 发现须指向 SHALL/SHALL NOT 条目 |
| 3 — Round 2 交叉攻击 | 每成员攻击其他 4 人的发现（STANDS 或攻击） | 攻击须引用 MumuSpec 既有约束 |
| 4 — Round 3 防御精炼 | DEFEND / REFINE / CONCEDE | Conceded 发现被过滤 |
| 5 — Lead 蒸馏幸存洞察 | 蒸馏为 4 类幸存洞察 | provenance 记录幸存发现数 |
| 6 — 持久化 | 持久化到 .mumuspec.yaml: hyperplan_result | SHALL NOT 在 Design 阶段调用 writing-plans |
| 7 — 清理 | 销毁 subagent | team_run_id 保留供追溯 |

### 4 类幸存洞察

| 类型 | MumuSpec 衔接动作 |
|------|-------------------|
| `hard_constraints` | 合并到 design.md 的 SHALL/SHALL NOT；design_to_build 守卫检查已合并 |
| `decisions` | 记录到 design.md 决策章节 + decisions.md Design 章节 |
| `risks` | 记录到 design.md 风险章节；test-cases/ 须有对应验证用例 |
| `open_questions` | 用户输入门禁，阻断 test-cases/ 编写；守卫检查已解决 |

### TDD 衔接

- hyperplan 须在 test-cases/ 编写前完成
- test-cases/ 须基于 hyperplan 幸存的硬约束设计
- risks 须有对应测试用例验证缓解措施
- test-cases/ 锁定后发现遗漏，需回退到 Design 重新触发

### Lead 职责边界

- Lead 只负责蒸馏幸存洞察并持久化（Phase 5/6）
- Lead **SHALL NOT** 自行编写 tasks.md（由 Build 阶段 writing-plans 负责）
- 跳过 Phase 5 蒸馏视为反模式，阻断 design_to_build 守卫
- 对抗角色 **SHALL NOT** 看到其他成员 Round 1 原始回复

### 反模式表

| 反模式 | 后果 |
|--------|------|
| 跳过 Round 2/3 "节省时间" | 守卫 `hyperplan-rounds-completed` 失败 |
| 软化对抗语气 | 对抗失效，产出视为无效 |
| 提前综合发现 | 蒸馏结果作废 |
| Lead 自写 tasks.md | tasks.md 作废，重新走 Build |
| hyperplan 内部调用 writing-plans | 阶段隔离违规，tasks.md 作废 |
| 对抗角色看到 Round 1 原始回复 | 独立性破坏，Round 1 产出作废 |

## 6. Skill 矩阵（反向索引）

按 Skill 类别组织，便于判断哪些 Skill 必需、哪些可选。

| Skill 类别 | Phase | Open | Design | Build | Verify | Archive | 横切 |
|------------|------|------|--------|-------|--------|---------|------|
| **规划与探索** | Phase 3 | brainstorming (req) / spec-driven-development (req) / gitnexus-* (req) | brainstorming (req) / **认知框架 (req, full)** | — | — | — | — |
| **设计与架构** | Phase 3 | — | api-and-interface-design (opt) / security-and-hardening (opt) / performance-optimization (opt) | — | — | — | — |
| **对抗审查** | Phase 5 | — | hyperplan (conditional) / **认知框架 Q4 扫描 (req, full)** | — | — | — | — |
| **实现与执行** | Phase 3 | — | — | writing-plans (req) / executing-plans (req) / systematic-debugging (opt) | systematic-debugging (opt) | — | — |
| **验证与审查** | Phase 3 | — | — | verification-before-completion (req) / source-driven-development (opt) | verification-before-completion (req) / requesting-code-review (req) / receiving-code-review (req) | — | — |
| **归档与发布** | Phase 3 | — | — | — | — | finishing-a-development-branch (req) / ci-cd-and-automation (req) / shipping-and-launch (opt) | — |
| **上下文管理** | Phase 3 | — | context-engineering (req) | context-engineering (req) | — | — | context-engineering (req) |
| **工作区隔离** | Phase 3 | using-git-worktrees (req) | — | — | — | — | using-git-worktrees (req) |
| **测试用例设计** | Phase 3 | — | test-case-design (req) / documentation-and-adrs (req) | red-green-tdd (req, tdd_mode 固定) / documentation-and-adrs (req) | documentation-and-adrs (req) | documentation-and-adrs (req) | — |

> `req` = required: true; `opt` = required: false; `conditional` = 满足条件时触发。

> **Phase 归属说明**：
> - **Phase 1**：Rules 文件生成（CLAUDE.md / .cursorrules / AGENTS.md）+ AI 工具适配层 — Skill 仅在 Rules 文件中声明引用,不调用
> - **Phase 3**：Skill Bridge 兼容层（兼容 Superpowers / OpenSpec / Comet）+ MCP Server — 外部 Skill 可被调用
> - **Phase 5**：自建 Skill 编排器（7 阶段 Skill 文件）+ Hyperplan 对抗式规划 — 全量阶段编排与对抗审查

## 7. 决策记录 Skill 分发

每个阶段的 `on_exit` 分发 `documentation-and-adrs` skill，将关键决策追加到 `decisions.md`。

### 决策类型表

| 阶段 | 必须记录的决策类型 |
|------|-------------------|
| **Open** | 是否拆分、affected_scopes 判定、workflow 选择、worktree 降级 |
| **Design** | 分层设计选择、SHALL/SHALL NOT 理由、**认知框架决策（Q2 回答/Q3 确认/Q4 兜底）**、hyperplan 幸存洞察、test-cases 依据、接口契约决策 |
| **Build** | 实现方式选择、TDD 红绿证据、调试根因、回退发起 |
| **Verify** | 回退目标、偏差接受、验证失败处理 |
| **Archive** | 合并策略、CI 失败处理、重验范围 |

### 不可变性

- 已完成阶段的记录 **SHALL NOT** 被修改或删除，仅允许追加
- CI 校验 `decisions_log.content_hash` 与 `decisions.md` 实际 hash 匹配
- 无关键决策时须记录一条说明，`counts.<phase>` 仍 > 0

### 与回退的衔接

- 回退前的决策记录保留不删除
- 重新进入某阶段时追加新记录（不覆盖），`DEC-<编号>` 递增
- 回退决策本身须在 Verify 章节记录

## 8. 认知框架 Skill 衔接

Design 阶段的认知框架（乔哈里窗变体）与外部 Skill 的衔接关系。详见 [参考：认知框架](cognitive-framework.md)。

### 四象限与 Skill 映射

| 象限 | 阶段 | 外部 Skill | 用途 |
|------|------|-----------|------|
| Q1（已知的已知） | Stage 1 | `gitnexus-exploring`, `gitnexus-impact-analysis` | 代码图谱探索 + 影响分析 |
| Q2（已知的未知） | Stage 2 | `brainstorming`, `interview-me` | 结构化提问 + 选项生成 |
| Q3（未知的已知） | Stage 3 | `brainstorming` | 推理链推导 + 隐性需求发现 |
| Q4（未知的未知） | Stage 3 | `security-and-hardening`, `performance-optimization`, `doubt-driven-development` | 盲区扫描（安全/性能/疑虑） |

### 认知框架分发协议

```yaml
skill_dispatch:
  on_enter:                        # 认知框架启动时分发
    - skill: gitnexus-exploring
      purpose: "Q1 信息采集 - 代码图谱探索"
      required: true
      stage: stage_1
    - skill: brainstorming
      purpose: "Q2 提问生成 + Q3 推理链推导"
      required: true
      stage: stage_2_3

  on_execute:                      # Q4 盲区扫描时分发
    - skill: security-and-hardening
      purpose: "Q4 安全盲区扫描"
      required: false
      stage: stage_3
      condition: "涉及用户数据或外部服务"
    - skill: performance-optimization
      purpose: "Q4 性能盲区扫描"
      required: false
      stage: stage_3
      condition: "在 critical path 上"
    - skill: doubt-driven-development
      purpose: "Q4 疑虑驱动审查"
      required: false
      stage: stage_3
      condition: "不可逆操作"

  on_exit:                         # 认知框架完成后分发
    - skill: documentation-and-adrs
      purpose: "记录认知框架决策到 decisions.md"
      required: true
      stage: stage_4
```

### 与 Hyperplan 的 Skill 衔接

认知框架 Stage 3（盲区扫描）与 hyperplan 的衔接：

1. 认知框架 Q3 confirmed 约束 → 作为 hyperplan Round 1 各角色的审查输入
2. 认知框架 Q4 残留项 → hyperplan `risks` 补充来源
3. hyperplan `open_questions` → 转化为认知框架新 Q2 问题（增量轮次）
4. hyperplan `risks` → 转化为认知框架新 Q4 扫描维度

---

> **导航**: [← 认知框架](cognitive-framework.md) | [错误码 →](error-codes.md) | [返回概览](../overview.md)
